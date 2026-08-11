import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaHotel,
  FaCalendarAlt,
  FaUsers,
  FaUtensils,
  FaCheckCircle,
} from "react-icons/fa";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import "../../styles/HotelBookingPage.css";
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  Accordion,
  Alert,
  Badge,
  Modal,
} from "react-bootstrap";
import axiosInstance from "../../components/AxiosInstance";
import toast from "react-hot-toast";
import { toLocalDateTime, formatDateTime } from "../../utils/dateUtils";

// Same 11-chip list Inhouse HotelBookingPage uses so the two pages read
// identically. Kept as a top-level constant so it stays out of render
// deps.
const SPECIAL_REQUEST_OPTIONS = [
  "Early Check-In",
  "Non-Smoking Rooms",
  "High Floor",
  "VIP Client",
  "Late Check-In",
  "Inter-connecting rooms",
  "Low Floor",
  "Room with Bathtub",
  "Late check-Out",
  "Honeymooners / Anniversary",
  "Smoking Room",
];

// ATHARVA policy text comes back with raw <div>/<br/>/<p>/<ul>/<li> tags
// mixed with plain text. Modal renders it as free text — turn block-level
// tags into line breaks, list items into bullets, drop the rest, and decode
// the handful of HTML entities the supplier actually emits.
const stripPolicyHtml = (raw) => {
  if (raw == null) return "";
  let s = String(raw);
  s = s.replace(/<\s*br\s*\/?\s*>/gi, "\n");
  s = s.replace(/<\s*\/(p|div|ul|h[1-6])\s*>/gi, "\n");
  s = s.replace(/<\s*(p|div|ul|h[1-6])[^>]*>/gi, "\n");
  s = s.replace(/<\s*li[^>]*>/gi, "\n• ");
  s = s.replace(/<\s*\/li\s*>/gi, "");
  s = s.replace(/<[^>]+>/g, "");
  s = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  s = s.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  return s.trim();
};

/**
 * API booking page — visual shell restyled to match the Inhouse
 * HotelBookingPage (two-column sticky layout, .hbp-* classes,
 * pink guest-details-accordion, red primary buttons, confirm-booking-modal
 * dialog). All business logic — sessionStorage.bookingData shape,
 * /api/hotel-booking/create payload, employee dropdown, credit-check
 * gate, form validation rules — is preserved verbatim.
 */
const ApiBookingPageForHotels = () => {
  const navigate = useNavigate();

  const activeUserRole = localStorage.getItem("currentActiveRole");

  const [bookingData, setBookingData] = useState(null);
  const [rooms, setRooms] = useState([]);
  // Lead-guest selector — mirrors HotelBookingPage's pattern of picking
  // the primary guest via a radio in the Guest Details grid instead of a
  // duplicate Primary Guest Details card. Defaults to Room 1 / Guest 0
  // so a booking with no explicit pick still resolves to a lead.
  const [leadIndex, setLeadIndex] = useState({ roomIdx: 0, guestIdx: 0 });
  const [validationErrors, setValidationErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingPayload, setPendingPayload] = useState(null);
  // Duplicate-booking modal — shown when the backend surfaces
  // status="DUPLICATE" (GRN's error code 6000). GRN detects the duplicate
  // on its side; we just render a clean modal so the operator knows the
  // booking already exists and doesn't retry blindly.
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateMessage, setDuplicateMessage] = useState("");
  // Policy consent modal — shown first when the operator clicks Confirm
  // Booking. Cancellation policies come from the search-time rate object
  // (API-side hotels don't expose a /policies endpoint). Only after
  // "I have read and accept" is checked does the on-page Confirm route
  // through to handleSubmit → booking summary modal → actual POST.
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  // Special Requests — now a chip-checkbox array matching Inhouse
  // (see SPECIAL_REQUEST_OPTIONS above). Backend accepts arrays for
  // this key (@JsonFormat ACCEPT_SINGLE_VALUE_AS_ARRAY on the DTO).
  const [specialRequests, setSpecialRequests] = useState([]);
  // Admin-only free-text tag rendered above the chip grid; matches
  // Inhouse's "Booking Done For" field.
  const [bookingDoneFor, setBookingDoneFor] = useState("");
  // Payment Mode picker + inputs for its 3-scenario availability logic.
  // Same UX Inhouse HotelBookingPage exposes.
  const [paymentMode, setPaymentMode] = useState("CREDITLIMIT");
  const [agentAvailableBalance, setAgentAvailableBalance] = useState(null);
  const [agentCardPaymentEnabled, setAgentCardPaymentEnabled] = useState(false);
  // ATHARVA-only booking-mode picker. Starts unset so neither radio
  // is pre-selected on page load — the operator must explicitly
  // choose "Book and Pay Now" or "Hold Room and Pay Later" before
  // Confirm Booking is allowed to proceed. openPolicyConsent below
  // enforces the pick with a toast + inline error for apiId===3.
  const [bookingConfirmation, setBookingConfirmation] = useState(null);

  // ATHARVA-only PAN inputs (apiId===3 + Indian-national primary guest).
  // Atharva §6.1 flags PAN as MANDATORY for Indian nationals booking a hotel
  // outside India — omitting it makes HCreateBooking reject with error 3006
  // ("Invalid PAN details") and returns no APIRefNo, which the operator sees
  // as an opaque failure. The two inputs render below in an Atharva-gated
  // card; other suppliers (IWTX/X3/Inhouse/Jumeirah/Ratehawk/Darina) never
  // see this card and ignore the fields on the payload.
  const [panCardNo, setPanCardNo] = useState("");
  // Default to "2" (Personal) — the correct choice for an individual traveller
  // per the vendor's PANCardType enum. Corporate/Trust/etc. can be picked in
  // the dropdown if the booking is on behalf of an entity.
  const [panCardType, setPanCardType] = useState("2");
  // GRN-optional PAN Company Name — forwarded to holder.pan_company_name
  // for corporate PANs. Only rendered when the selected rate is GRN AND
  // panRequired=true. Left empty for personal PANs (no impact on GRN).
  const [panCompanyName, setPanCompanyName] = useState("");

  // ─────────────────────────── effects ────────────────────────────────
  useEffect(() => {
    const storedData = sessionStorage.getItem("bookingData");
    if (storedData) {
      const parsedData = JSON.parse(storedData);

      // Diagnostic: dump the exact bookingData handed off from
      // /api-room-list so we can see whether Darina-specific fields
      // (deadlineDate, cancellationPolicies, apiId) survive the transfer.
      // Grouped for readability — collapse "BookingPage: incoming data"
      // in DevTools console.
      // eslint-disable-next-line no-console
      console.groupCollapsed(
        "%cBookingPage: incoming data from /api-room-list",
        "color:#0d6efd;font-weight:bold",
      );
      // eslint-disable-next-line no-console
      console.log("bookingData (full):", parsedData);
      // eslint-disable-next-line no-console
      console.log("bookingData.payload.apiId:", parsedData?.payload?.apiId,
        "typeof:", typeof parsedData?.payload?.apiId);
      // eslint-disable-next-line no-console
      console.log(
        "bookingData.selectedRate (per slot deadline + cancellation):",
        (parsedData?.selectedRate || []).map((slot, i) => ({
          index: i,
          roomCategory: slot?.roomCategory,
          mealPlan: slot?.mealPlan,
          deadlineDate: slot?.deadlineDate,
          nonRefundable: slot?.nonRefundable,
          cancellationPolicy_count:
            Array.isArray(slot?.cancellationPolicy)
              ? slot.cancellationPolicy.length
              : slot?.cancellationPolicy
                ? 1
                : 0,
          cancellationPolicy_first: Array.isArray(slot?.cancellationPolicy)
            ? slot.cancellationPolicy[0]
            : slot?.cancellationPolicy,
        })),
      );
      // eslint-disable-next-line no-console
      console.groupEnd();

      setBookingData(parsedData);

      const initialRooms = parsedData.payload.rooms.map((room) => ({
        ...room,
        guests: Array.from({ length: room.adults + room.children }, (_, i) => ({
          salutation: "",
          firstName: "",
          middleName: "",
          lastName: "",
          gender: "",
          isChild: i >= room.adults,
        })),
      }));
      setRooms(initialRooms);
    }
  }, []);

  // ───────────────── agent credit + card-enabled fetches ──────────────
  // Same two endpoints Inhouse HotelBookingPage hits so the Payment
  // Mode picker exposes identical options. Both are read-only GETs —
  // no side effect on any other flow.
  useEffect(() => {
    const aId = bookingData?.payload?.agentId;
    if (!aId) return;
    let cancelled = false;
    axiosInstance
      .get(`/api/agent-credit-limit/agent/${aId}`)
      .then((res) => {
        if (cancelled) return;
        // Prefer the combined effective figure (regular credit + any
        // active Temporary Credit Limit) — matches Inhouse.
        setAgentAvailableBalance(
          res?.data?.effectiveAvailableCreditLimit ??
            res?.data?.availableCreditLimit ??
            null,
        );
      })
      .catch(() => {
        if (!cancelled) setAgentAvailableBalance(null);
      });
    return () => {
      cancelled = true;
    };
  }, [bookingData]);

  useEffect(() => {
    const aId = bookingData?.payload?.agentId;
    if (!aId) return;
    let cancelled = false;
    axiosInstance
      .get(`/api/agent/${aId}`)
      .then((res) => {
        if (!cancelled) {
          setAgentCardPaymentEnabled(!!res?.data?.cardPaymentEnabled);
        }
      })
      .catch(() => {
        if (!cancelled) setAgentCardPaymentEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bookingData]);

  // ─────────────────────────── handlers ───────────────────────────────
  const handleSpecialRequestToggle = (request) => {
    setSpecialRequests((prev) =>
      prev.includes(request)
        ? prev.filter((r) => r !== request)
        : [...prev, request],
    );
  };

  const handleGuestChange = (roomIndex, guestIndex, field, value) => {
    setRooms((prevRooms) => {
      const updatedRooms = [...prevRooms];
      updatedRooms[roomIndex].guests[guestIndex][field] = value;
      return updatedRooms;
    });

    const guestKey = `room_${roomIndex}_guest_${guestIndex}_${field}`;
    if (validationErrors[guestKey]) {
      setValidationErrors((prev) => {
        const updated = { ...prev };
        delete updated[guestKey];
        return updated;
      });
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

  // ATHARVA-only helper: is this an Indian-national booking that needs a PAN?
  // Matches the same ISO alias set the backend uses (isIndianNational in
  // AtharvaHotelBookingService) so FE + BE agree on who the PAN gate applies
  // to. The nationality is stamped by the search page into
  // bookingData.payload.nationality — we don't peek at per-guest values.
  const requiresAtharvaPan = () => {
    if (!bookingData) return false;
    if (Number(bookingData?.payload?.apiId) !== 3) return false;
    const n = String(bookingData?.payload?.nationality || "").trim().toUpperCase();
    return n === "IN" || n === "IND" || n === "INDIA";
  };

  // GRN-only PAN requirement: rate's pan_required=true (set from the recheck
  // response and carried through on each selectedRate). Independent of the
  // guest's nationality — GRN flags per-rate, not per-nationality. When true,
  // the same PAN input card renders (shared with Atharva) and the payload
  // sends holder.pan_number / pan_company_name. Any selectedRate having the
  // flag is sufficient — a mixed multi-room booking with even one
  // pan_required rate needs PAN.
  const requiresGrnPan = () => {
    if (!bookingData) return false;
    if (Number(bookingData?.payload?.apiId) !== 20) return false;
    const rates = bookingData?.selectedRate || [];
    return rates.some((r) => r?.panRequired === true);
  };

  // Unified PAN-required check that either supplier can trigger. Kept as a
  // helper so the PAN input card, validation, and payload builder all share
  // one truth source and can't drift.
  const requiresPan = () => requiresAtharvaPan() || requiresGrnPan();

  const validateForm = () => {
    const errors = {};
    let hasErrors = false;

    // Per-guest validation only — IWTX / IOL-X mandatory fields per
    // docs.iol-x.com are Title, PassengerType (derived), Age (derived),
    // FirstName, LastName, Nationality (from search), Gender. No email
    // / phone / agent LPO required by vendor OR by our backend's
    // PrimaryGuestRequest DTO (@NotBlank only on salutation/first/last).
    rooms.forEach((room, roomIndex) => {
      room.guests.forEach((guest, guestIndex) => {
        const guestKey = `room_${roomIndex}_guest_${guestIndex}`;
        if (!guest.salutation || guest.salutation.trim() === "") {
          errors[`${guestKey}_salutation`] = "Salutation is required";
          hasErrors = true;
        }
        if (!guest.firstName || guest.firstName.trim() === "") {
          errors[`${guestKey}_firstName`] = "First Name is required";
          hasErrors = true;
        }
        if (!guest.lastName || guest.lastName.trim() === "") {
          errors[`${guestKey}_lastName`] = "Last Name is required";
          hasErrors = true;
        }
        if (!guest.gender || guest.gender.trim() === "") {
          errors[`${guestKey}_gender`] = "Gender is required";
          hasErrors = true;
        }
      });
    });

    // PAN mandatory when either supplier requires it:
    //   • ATHARVA (apiId=3) + Indian primary guest — vendor rejects
    //     HCreateBooking with error 3006 otherwise.
    //   • GRN (apiId=20) + rate.pan_required=true — GRN rejects the
    //     create-booking call and returns an error envelope.
    // Length-only check (10 chars) — strict ABCDE1234F format is not
    // enforced here per product decision. PAN Card Type is Atharva-only
    // so it's still gated on requiresAtharvaPan().
    if (requiresPan()) {
      const trimmed = (panCardNo || "").trim().toUpperCase();
      if (!trimmed) {
        errors.panCardNo = requiresAtharvaPan()
          ? "PAN Card No is required (Indian primary guest booking with Atharva)."
          : "PAN Card No is required (this GRN rate mandates PAN on the holder).";
        hasErrors = true;
      } else if (trimmed.length !== 10) {
        errors.panCardNo = "PAN must be 10 characters.";
        hasErrors = true;
      }
      if (requiresAtharvaPan() && !panCardType) {
        errors.panCardType = "PAN Card Type is required.";
        hasErrors = true;
      }
    }

    return { errors, hasErrors };
  };

  /**
   * ATHARVA-only: ensure fresh HPreBooking keys + cancellation policies
   * are on bookingData.selectedRate before we render the policy modal.
   * Runs when the operator skipped the Cancellation Policies modal in
   * /api-room-list (atharvaPrebooked=false). Mutates the in-memory
   * bookingData so both the policy modal and the eventual /create
   * payload pick up the fresh tokens transparently. Returns true when
   * safe to proceed, false when the vendor rejected the prebook.
   */
  const ensureAtharvaPrebook = async () => {
    if (!bookingData) return false;
    const isAtharva = String(bookingData?.payload?.apiId || "") === "3";
    if (!isAtharva) return true;
    const selectedRates = bookingData.selectedRate || [];
    const firstRate = selectedRates[0] || {};
    const isMultiRoom = selectedRates.length > 1;

    // Multi-room: enforce all selected rates share the same search-time
    // HKey/vendor. Atharva's HPreBooking accepts ONE HKey for the whole
    // call; every per-room RateKey must belong to that HKey's VendorList.
    // Mixing rates across vendors is what returns "1005: Invalid RateKey".
    // Surface the mismatch here so the operator gets an actionable
    // message instead of a supplier error code they can't decode.
    if (isMultiRoom) {
      const hKeys = selectedRates
        .map((r) => r?.atharvaSearchHKey || r?.atharvaHKey)
        .filter(Boolean);
      const uniqueHKeys = [...new Set(hKeys)];
      if (uniqueHKeys.length > 1) {
        toast.error(
          "Atharva multi-room bookings require all rooms to be selected from the same rate group. Please go back and reselect rates that appear under the same vendor.",
        );
        return false;
      }
    }

    // Single-room fast path — the operator already prebooked via the
    // Cancellation Policies modal, so `bookingData.selectedRate[0]`
    // carries fresh tokenId/hKey/rateKey and running prebook again would
    // just invalidate them. Multi-room ALWAYS re-prebooks (below) with
    // search-time keys so every room's rateKey lives under the same fresh
    // HKey.
    if (!isMultiRoom && firstRate.atharvaPrebooked) return true;

    // Always use SEARCH-time tokens for the prebook payload — per-room
    // `atharva*` fields might have been overwritten with fresh keys from
    // a partial modal-prebook (Room 1 opened, Room 2 not) and mixing
    // fresh + search values across rooms trips 1005. `atharvaSearch*`
    // fields hold the untouched HSearchByHotelCode_V2 values.
    try {
      const preReq = {
        agentId: bookingData.payload.agentId
          ? String(bookingData.payload.agentId)
          : null,
        cityId: bookingData.payload?.cityId || null,
        nationalityId: bookingData.payload?.nationalityId || null,
        nationality: bookingData.payload?.nationality || null,
        checkInDate: bookingData.payload?.checkInDate,
        checkOutDate: bookingData.payload?.checkOutDate,
        hotelCode:
          selectedRates[0]?.hotelCode ||
          bookingData.payload?.hotelCode ||
          "",
        tokenId: firstRate.atharvaSearchTokenId || firstRate.atharvaTokenId,
        hKey: firstRate.atharvaSearchHKey || firstRate.atharvaHKey,
        rooms: (rooms.length ? rooms : bookingData.payload?.rooms || []).map(
          (room, i) => {
            const rate = selectedRates[i] || firstRate;
            return {
              roomSrNo: i + 1,
              noOfAdult: room.adults,
              noOfChild: room.children || 0,
              childAges: room.childAges || [],
              rateKey:
                rate.atharvaSearchRateKey || rate.atharvaRateKey || null,
            };
          },
        ),
      };
      const resp = await axiosInstance.post(
        "/api/hotel-booking/atharva/prebook",
        preReq,
      );
      const data = resp?.data;
      if (!data || data.success === false) {
        toast.error(
          data?.message ||
            "Atharva prebook failed — rate may no longer be available. Please repeat the search.",
        );
        return false;
      }
      const freshRooms = Array.isArray(data.rooms) ? data.rooms : [];
      const patched = bookingData.selectedRate.map((r, i) => {
        const match =
          freshRooms.find((pr) => (pr.roomSrNo ?? null) === i + 1) ||
          freshRooms[i];
        return {
          ...r,
          atharvaTokenId: data.tokenId || r.atharvaTokenId,
          atharvaHKey: data.hKey || r.atharvaHKey,
          atharvaRateKey: match?.rateKey || r.atharvaRateKey,
          atharvaPrebooked: true,
          cancellationPolicy:
            (data.cancellationPolicies?.length && data.cancellationPolicies) ||
            r.cancellationPolicy,
          // Capture the HPreBooking-response echoes so /api/hotel-booking/create
          // can forward them as atharvaExpectedAmount / atharvaWithinTimeLimit /
          // atharvaPackageRate. The BE uses these for ExpectedAmount cost
          // verification (docs 6.1) — a mismatch triggers error 3002.
          atharvaExpectedAmount:
            data.amountWithoutMarkup ?? data.amount ?? r.atharvaExpectedAmount ?? null,
          atharvaWithinTimeLimit:
            data.withinTimeLimit ?? r.atharvaWithinTimeLimit ?? null,
          atharvaPackageRate:
            data.packageRate ?? r.atharvaPackageRate ?? null,
        };
      });
      setBookingData({ ...bookingData, selectedRate: patched });
      return true;
    } catch (err) {
      const backendMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Atharva prebook request failed";
      toast.error(backendMsg);
      return false;
    }
  };

  /**
   * Step 1 of the confirm flow — validate the form, then show the Policy
   * consent modal. On Proceed the consent modal calls handleSubmit()
   * which builds the payload and opens the booking-summary modal. Mirrors
   * Inhouse HotelBookingPage's openPolicyConsent.
   */
  const openPolicyConsent = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    if (noPaymentPathAvailable) {
      toast.error(
        "Booking cannot be completed — no payment method available for this agent.",
      );
      return;
    }

    const { errors, hasErrors } = validateForm();

    // ATHARVA (apiId 3): the operator MUST pick a booking mode
    // (Book and Pay Now / Hold Room and Pay Later) before we open the
    // policy modal. Merges into the same validationErrors bag as the
    // guest-detail errors so a single toast covers both cases.
    if (
      bookingData?.payload?.apiId === 3 &&
      bookingConfirmation !== "Book & Voucher" &&
      bookingConfirmation !== "Hold & Book Later"
    ) {
      errors.bookingMode =
        "Please select a booking mode: Book and Pay Now or Hold Room and Pay Later.";
    }

    if (hasErrors || errors.bookingMode) {
      setValidationErrors(errors);
      // Priority order for the shared toast: PAN gate first (Atharva-only,
      // most likely to bite operators mid-booking with a cryptic upstream
      // failure otherwise), then booking-mode gate, then the generic message.
      toast.error(
        errors.panCardNo ||
          errors.panCardType ||
          errors.bookingMode ||
          "Please fill in all required fields correctly.",
      );
      return;
    }
    setValidationErrors({});

    // Late Atharva prebook — the modal has to render the vendor's
    // policies, so we fetch them here (only when /api-room-list skipped
    // it). Gate the modal on prebook success so the operator never sees
    // an empty policies list after a silent failure.
    setIsSubmitting(true);
    try {
      const ok = await ensureAtharvaPrebook();
      if (!ok) return;
    } finally {
      setIsSubmitting(false);
    }

    setPolicyAccepted(false);
    setShowPolicyModal(true);
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    const { errors, hasErrors } = validateForm();
    if (hasErrors) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});

    try {
      setIsSubmitting(true);

      const cinStr = toLocalDateTime(bookingData.payload.checkInDate);
      const coutStr = toLocalDateTime(bookingData.payload.checkOutDate);
      const checkIn = new Date(cinStr);
      const checkOut = new Date(coutStr);
      const nights = Math.max(
        1,
        Math.round((checkOut - checkIn) / (1000 * 60 * 60 * 24)),
      );

      // Derive primaryGuest from the lead-selected guest (default: Room 1
      // / Guest 0). Only salutation / first / last are populated because
      // those are the only @NotBlank fields on the backend
      // PrimaryGuestRequest DTO; the rest are optional and left blank.
      const leadRoom = rooms[leadIndex.roomIdx] || rooms[0];
      const leadGuest =
        leadRoom?.guests?.[leadIndex.guestIdx] ||
        leadRoom?.guests?.[0] ||
        rooms[0]?.guests?.[0] ||
        {};

      // ATHARVA (apiId 3): the create-booking endpoint requires the
      // session TokenId + vendor HKey stamped at the top level. Every
      // room in a single hotel search shares the same pair, so it's safe
      // to lift them from the first rate. Left null for other suppliers.
      // Fresh HPreBooking keys are already stamped on selectedRate by
      // ensureAtharvaPrebook() (either from /api-room-list's policies-modal
      // fetch or from openPolicyConsent's late-prebook step) — nothing to
      // do here.
      const firstRate = bookingData.selectedRate[0] || {};

      const payload = {
        agentId: bookingData.payload.agentId || null,
        apiId: bookingData.payload.apiId || null,
        hotelId: bookingData.selectedRate[0]?.hotelId || "",
        hotelCode:
          bookingData.selectedRate[0]?.hotelCode ||
          bookingData.payload?.hotelCode ||
          "",
        // ATHARVA carriers (harmless nulls for other suppliers).
        tokenId: firstRate.atharvaTokenId || null,
        hKey: firstRate.atharvaHKey || null,
        // ATHARVA HPreBooking-response echoes. The BE uses these on
        // HCreateBooking so ExpectedAmount matches the vendor's total on the
        // first try (no error 3002 / no double call), WithinTimeLimit drives
        // the RR vs KK gate correctly, and PackageRate triggers
        // AirlineName/AirlinePNR when the vendor tagged the rate as a package
        // (docs §5.3, §6.1). Null when no prebook has run yet — BE falls back
        // to legacy behaviour.
        atharvaExpectedAmount: firstRate.atharvaExpectedAmount ?? null,
        atharvaWithinTimeLimit: firstRate.atharvaWithinTimeLimit ?? null,
        atharvaPackageRate: firstRate.atharvaPackageRate ?? null,
        cityId: bookingData.payload?.cityId || null,
        nationalityId: bookingData.payload?.nationalityId || null,
        hotelName: bookingData.hotelStaticData.hotelName,
        address: bookingData.hotelStaticData.address,
        starRating: bookingData.hotelStaticData.starRating,
        checkInDate: cinStr,
        checkOutDate: coutStr,
        nights: nights,
        // Employee is chosen on the hotel search page — ride the same
        // slot the Inhouse flow uses (bookingData.payload.employeeId).
        employeeId: bookingData.payload.employeeId || null,
        roomStatus: "Available",
        cancellationPolicy: [
          ...new Set(
            bookingData.selectedRate.flatMap((rate) =>
              (rate.cancellationPolicy || []).map((p) => p.policyText),
            ),
          ),
        ],
        deadlineDate: (() => {
          const deadlines = bookingData.selectedRate
            .map((rate) => {
              const nonRefundable =
                rate.nonRefundable === true ||
                rate.nonRefundable === "true" ||
                rate.nonRefundable === "Y";

              // Darina (apiId=16): rate.deadlineDate is the LIVE
              // free-cancellation cut-off carried from
              // CheckAvailabilityWithCancellation_NoCache_LiveCalculation
              // (BE parses the "Free Cancellation" band's toDate). It is
              // the deadline the operator sees in the room accordion.
              // Use it verbatim — the generic "earliest cancellationPolicy
              // fromDate minus 2 days" fallback below picks up the Free
              // Cancellation band's FromDate instead of the cut-off, which
              // reports a wildly earlier date (September vs December).
              if (
                bookingData?.payload?.apiId === 16 &&
                !nonRefundable &&
                rate.deadlineDate
              ) {
                const iso = String(rate.deadlineDate).slice(0, 10);
                const parts = iso.split("-");
                if (parts.length === 3) {
                  const d = new Date(
                    Number(parts[0]),
                    Number(parts[1]) - 1,
                    Number(parts[2]),
                  );
                  if (!isNaN(d.getTime())) {
                    d.setHours(0, 0, 0, 0);
                    return d;
                  }
                }
              }

              if (nonRefundable === true) {
                // Non-refundable rates have no free-cancellation window, so
                // no deadline applies — send nothing rather than a fabricated
                // "today - 2 days" date (which always lands in the past and
                // confuses anything that reads deadlineDate literally).
                return null;
              } else {
                const policies = rate.cancellationPolicy || [];
                if (policies.length === 0) return null;
                const dates = policies
                  .map((p) => (p.fromDate ? new Date(p.fromDate) : null))
                  .filter((date) => date !== null && !isNaN(date.getTime()));
                if (dates.length === 0) return null;
                const earliestDate = new Date(
                  Math.min(...dates.map((d) => d.getTime())),
                );
                const deadline = new Date(earliestDate);
                deadline.setDate(earliestDate.getDate() - 2);
                deadline.setHours(0, 0, 0, 0);
                return deadline;
              }
            })
            .filter((d) => d !== null);

          if (deadlines.length === 0) return null;
          const overallDeadline = new Date(
            Math.min(...deadlines.map((d) => d.getTime())),
          );
          const year = overallDeadline.getFullYear();
          const month = String(overallDeadline.getMonth() + 1).padStart(2, "0");
          const day = String(overallDeadline.getDate()).padStart(2, "0");
          return `${year}-${month}-${day}T00:00:00`;
        })(),
        isBookandVoucher: bookingConfirmation === "Book & Voucher",
        primaryGuest: {
          salutation: leadGuest.salutation || "",
          firstName: leadGuest.firstName || "",
          middleName: "",
          lastName: leadGuest.lastName || "",
          email: "",
          phone: "",
          passportNo: "",
          agentLpo: "",
          nativeCountry: bookingData.payload.nationality,
          // PAN carriers — populated when either Atharva (Indian primary
          // guest) or GRN (rate.pan_required=true) requires them. panCardNo
          // is the shared PAN number field forwarded to Atharva's PANCardNo
          // and GRN's holder.pan_number. panCardType is Atharva-only.
          // panCompanyName is GRN-only (optional, for corporate PANs).
          // When neither supplier requires PAN, the fields stay null so
          // non-PAN payloads are byte-for-byte identical to before.
          panCardNo: requiresPan()
            ? (panCardNo || "").trim().toUpperCase()
            : null,
          panCardType: requiresAtharvaPan() ? panCardType || "2" : null,
          panCompanyName: requiresGrnPan()
            ? (panCompanyName || "").trim() || null
            : null,
        },
        rooms: rooms.map((room, roomIndex) => {
          const rate = bookingData.selectedRate[roomIndex] || {};
          return {
            roomNo: roomIndex + 1,
            roomCategory: rate.roomCategory,
            mealPlan: rate.mealPlan,
            nonRefundable:
              rate.nonRefundable === true ||
              rate.nonRefundable === "true" ||
              rate.nonRefundable === "Y",
            currency: rate.currency || "AED",
            rate: parseFloat(rate.rate || 0),
            rateWithoutMarkup: parseFloat(rate.rateWithoutMarkup || 0),
            adults: room.adults,
            children: room.children,
            childAges: room.childAges || [],
            // IWTX booking payload fields — forwarded from the search
            // response so IwtxHotelBookingService can build its JSON
            // BookHotel body. Null / omitted on non-IWTX flows.
            roomTypeCode: rate.roomTypeCode,
            mealPlanCode: rate.mealPlanCode,
            contractTokenId: rate.contractTokenId,
            // ATHARVA per-room rate key. Prefers the prebook-refreshed
            // value; falls back to the search-time key so a room whose
            // prebook was skipped still round-trips. Ignored by other
            // suppliers (RoomBookingRequest.rateKey is @Nullable).
            rateKey: rate.atharvaRateKey || null,
            // Darina free-cancellation deadline shown to the customer at
            // rate-selection time (ISO yyyy-MM-dd). BE audits this in
            // DarinaHotelBookingService so we know exactly which cut-off
            // was in effect when the booking was confirmed. Null / ignored
            // by other suppliers.
            cancellationDeadline: rate.deadlineDate || null,
            guests: room.guests.map((guest) => ({
              salutation: guest.salutation,
              firstName: guest.firstName,
              middleName: guest.middleName || "",
              lastName: guest.lastName,
              gender: guest.gender,
              isChild: guest.isChild,
            })),
          };
        }),
        // Remarks + Tourism Dirhams UI hidden (matches Inhouse); send
        // safe defaults so the backend payload contract is unchanged.
        remarks: "",
        // Backend accepts either a String or an array (@JsonFormat
        // ACCEPT_SINGLE_VALUE_AS_ARRAY on HotelBookingRequest.specialRequests).
        specialRequests: specialRequests,
        tourismDirhams: 0,
        // Booking-Done-For + payment mode — match Inhouse payload keys.
        bookingDoneFor: bookingDoneFor.trim() || null,
        paymentMode,
        bookingConfirmation: bookingConfirmation || "Book & Voucher",
      };

      setPendingPayload(payload);
      setShowConfirmModal(true);
    } catch (err) {
      console.error("booking payload error", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmBooking = async () => {
    if (!pendingPayload) return;
    // Keep the summary modal open while /api/hotel-booking/create is in
    // flight — the Confirm button already renders a spinner + "Processing…"
    // label off `isSubmitting`, but the modal used to close synchronously
    // here so the operator never saw it. Modal is dismissed in `finally`
    // below once the outcome (success or failure) is known.
    setIsSubmitting(true);

    try {
      // Re-apply the modal's current Vouchered / Confirmed choice on
      // submit. handleSubmit snapshotted bookingConfirmation into
      // pendingPayload before the modal opened, so a mid-modal radio
      // change would otherwise be dropped. Rebuild only the two fields
      // the backend actually reads.
      const effectivePayload = {
        ...pendingPayload,
        isBookandVoucher: bookingConfirmation === "Book & Voucher",
        bookingConfirmation: bookingConfirmation || "Book & Voucher",
      };

      const agentId = effectivePayload.agentId;
      const requiredAmount = effectivePayload.rooms.reduce(
        (sum, r) => sum + (r.rate || 0),
        0,
      );

      // ATHARVA Hold Room and Pay Later: docs say no balance is
      // required — the booking is held until the time limit. Skip the
      // client-side credit gate so the operator isn't blocked with
      // "insufficient credit" for a valid hold. Backend still enforces
      // its own rules. Guarded to apiId===3 so other suppliers are
      // unaffected.
      const isAtharvaHold =
        effectivePayload.apiId === 3 &&
        effectivePayload.isBookandVoucher === false;

      if (!isAtharvaHold) {
        const creditResponse = await axiosInstance.get(
          `/api/agent-credit-limit/check-sufficient-credit?agentId=${agentId}&requiredAmount=${requiredAmount}`,
        );

        if (creditResponse.data === false) {
          toast.error(
            "Insufficient credit. Please proceed with online payment.",
          );
          return;
        }
      }

      const response = await axiosInstance.post(
        "/api/hotel-booking/create",
        effectivePayload,
      );
      const bookingResponse = response.data;

      // Backend returns "CONFIRMED" for Inhouse and "Reconfirmed" for API
      // suppliers (IWTX/X3/etc. — see HotelBookingResponse.success
      // factories). Both mean the booking was created; failures come back
      // as "FAILED" or "NOT_IMPLEMENTED". Match case-insensitively so a
      // successful IWTX/X3 booking doesn't fall through to the error toast.
      const statusUpper = String(bookingResponse?.status || "").toUpperCase();
      const isSuccess =
        (statusUpper === "CONFIRMED" || statusUpper === "RECONFIRMED") &&
        bookingResponse?.bookingId != 0;

      if (bookingResponse && isSuccess) {
        toast.success(bookingResponse.message);
        // All suppliers land on the booking list after a successful confirm
        // (matches IWTX / X3 / ATHARVA / DARINA / JUMEIRAH / JUNIPER). GRN
        // used to route straight to its detail page instead but the client
        // asked for uniform post-confirm UX — the detail page is still one
        // click away from the list row.
        navigate("/booking-details/hotel-booking-list");
      } else if (statusUpper === "DUPLICATE") {
        // GRN error code 6000 — the exact booking already exists at the
        // supplier. Show a dedicated modal (not a toast) so the operator
        // has to acknowledge before continuing, and doesn't retry blindly.
        setDuplicateMessage(
          bookingResponse?.message ||
            "Duplicate booking detected. This exact booking was already made. Please check your recent bookings before retrying.",
        );
        setShowDuplicateModal(true);
      } else {
        // Surface backend / IWTX validation message when present (e.g.
        // "invalid_passengers[0].gender") instead of the generic
        // "please try again" that hides the real cause.
        const detail =
          bookingResponse?.message ||
          bookingResponse?.error ||
          "Booking submission failed. Please try again.";
        toast.error(detail);
      }
    } catch (err) {
      console.error("Error in booking confirmation:", err);
      const detail =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Booking submission failed. Please try again.";
      toast.error(detail);
    } finally {
      setIsSubmitting(false);
      setShowConfirmModal(false);
    }
  };

  const formatPrice = (price) =>
    new Intl.NumberFormat("en-AE", {
      style: "currency",
      currency: "AED",
    }).format(price);

  // Derived pricing — computed BEFORE the early return so the useMemo /
  // useEffect calls below stay in the same call order every render
  // (rules-of-hooks). Safe access resolves a null bookingData to 0.
  const selectedRate = bookingData?.selectedRate || [];
  const totalPrice = selectedRate.reduce(
    (sum, room) => sum + parseFloat(room.rate || 0),
    0,
  );

  const isAdmin = activeUserRole === "ADMIN";

  // ── Payment Mode availability (mirrors Inhouse's 3-scenario logic) ──
  // Client-side prediction only. The server /api/hotel-booking/create
  // enforces the definitive credit check on submit (via
  // /api/agent-credit-limit/check-sufficient-credit inside
  // confirmBooking), so a wrong client guess here just adjusts UX —
  // never lets a booking through it shouldn't.
  const hasSufficientCredit = useMemo(() => {
    if (agentAvailableBalance == null) return null;
    return Number(agentAvailableBalance) >= totalPrice;
  }, [agentAvailableBalance, totalPrice]);

  const noPaymentPathAvailable =
    hasSufficientCredit === false && !agentCardPaymentEnabled;

  const paymentModeOptions = useMemo(() => {
    if (hasSufficientCredit === true) {
      return [{ value: "CREDITLIMIT", label: "Credit Limit" }];
    }
    if (hasSufficientCredit === false && agentCardPaymentEnabled) {
      return [{ value: "CARD", label: "Card" }];
    }
    if (hasSufficientCredit === false && !agentCardPaymentEnabled) {
      return [];
    }
    // hasSufficientCredit still null → default to Credit Limit so
    // nothing flashes empty during first render.
    return [{ value: "CREDITLIMIT", label: "Credit Limit" }];
  }, [hasSufficientCredit, agentCardPaymentEnabled]);

  useEffect(() => {
    if (paymentModeOptions.length === 0) return;
    if (!paymentModeOptions.some((o) => o.value === paymentMode)) {
      setPaymentMode(paymentModeOptions[0].value);
    }
  }, [paymentModeOptions, paymentMode]);

  if (!bookingData) return <div>Loading booking data...</div>;

  const { hotelStaticData, payload } = bookingData;
  // Tourism Dirhams input removed on this page; treat as 0 so the
  // sidebar row auto-hides and New Total equals Selling Price.
  const tourismDirhamsAmount = 0;
  const newTotal = totalPrice;

  // Cancellation / refundability signals for the confirm modal — mirror
  // the Inhouse derivations in HotelBookingPage.jsx so this modal renders
  // the same non-refundable warning / deadline pill / payment-mode badge
  // combination. Reads `nonRefundable` and `deadlineDate` from
  // bookingData.selectedRate (both populated by the prebook pass).
  const isNonRefundableRate = selectedRate.some(
    (r) =>
      r?.nonRefundable === true ||
      r?.nonRefundable === "true" ||
      r?.nonRefundable === "Y",
  );
  const cancellationDeadline = (() => {
    const dates = selectedRate
      .map((r) => r?.deadlineDate)
      .filter(Boolean)
      .map((d) => new Date(d))
      .filter((d) => !Number.isNaN(d.getTime()));
    if (dates.length === 0) return null;
    return new Date(Math.min(...dates.map((d) => d.getTime())));
  })();
  const isOutsideDeadline = (() => {
    if (!cancellationDeadline) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today > cancellationDeadline;
  })();

  return (
    <div className="min-vh-100 bg-light d-flex flex-column hotel-booking-container">
      <TopBar />
      <div className="main-content">
        <Sidebar />
        <main className="content-wrapper py-4">
          <Container fluid="xl">
            {/* Results-page heading — same "Accommodation" tag Inhouse uses.
                Right-side agent balance is shown in red per the operator's
                request; only rendered when the credit-limit endpoint has
                returned a number for the current agent. */}
            <div
              className="hs-page-heading d-flex justify-content-between align-items-center flex-wrap gap-2"
            >
              <h3 className="hs-page-heading-title mb-0">Accommodation</h3>
              {agentAvailableBalance != null && (
                <div
                  className="fw-bold"
                  style={{ color: "#dc2626" }}
                  title="Available agent balance"
                >
                  Available Balance: {formatPrice(agentAvailableBalance)}
                </div>
              )}
            </div>

            <Form onSubmit={openPolicyConsent}>
              <Row className="g-3">
                {/* ────────────── Left column ────────────── */}
                <Col lg={8} className="hbp-left-col">
                  {/* Guest Details */}
                  <Card className="mb-2 shadow-sm border-0">
                    <Card.Header className="bg-light py-2">
                      <div className="d-flex align-items-center">
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          onClick={() => navigate(-1)}
                          className="me-3"
                        >
                          ← Back
                        </Button>
                        <h6 className="mb-0 fw-bold text-dark">
                          Guest Details
                        </h6>
                      </div>
                    </Card.Header>
                    <Card.Body className="p-0">
                      <Accordion
                        alwaysOpen
                        defaultActiveKey={rooms.map((_, i) => i.toString())}
                        className="guest-details-accordion"
                      >
                        {rooms.map((room, roomIndex) => {
                          const slot = selectedRate[roomIndex] || {};
                          return (
                            <Accordion.Item
                              key={roomIndex}
                              eventKey={roomIndex.toString()}
                              className="mb-3 guest-room-item"
                            >
                              <Accordion.Header className="bg-primary text-white">
                                <h6 className="mb-0 fw-bold w-100 d-flex flex-wrap align-items-center gap-2">
                                  <span>
                                    Room {roomIndex + 1}
                                    {slot.roomCategory
                                      ? ` - ${slot.roomCategory}`
                                      : ""}
                                  </span>
                                  {slot.mealPlan && (
                                    <Badge
                                      bg="light"
                                      text="dark"
                                      className="ms-2"
                                    >
                                      <FaUtensils className="me-1" />
                                      {slot.mealPlan}
                                    </Badge>
                                  )}
                                  {/* ATHARVA (apiId 3): show the backend-computed
                                      display deadline (raw supplier deadline
                                      minus 2 days). Rendered as an inline
                                      "| Deadline: DD MMM YYYY, 11:59 PM (UAE)"
                                      string per the operator's requested look;
                                      time is intentionally static at 11:59 PM. */}
                                  {bookingData?.payload?.apiId === 3 &&
                                    slot.atharvaDisplayDeadlineDate &&
                                    (() => {
                                      const parts =
                                        slot.atharvaDisplayDeadlineDate.split(
                                          "-",
                                        );
                                      if (parts.length !== 3) return null;
                                      const [y, m, d] = parts;
                                      const monthNames = [
                                        "Jan",
                                        "Feb",
                                        "Mar",
                                        "Apr",
                                        "May",
                                        "Jun",
                                        "Jul",
                                        "Aug",
                                        "Sep",
                                        "Oct",
                                        "Nov",
                                        "Dec",
                                      ];
                                      const idx = parseInt(m, 10) - 1;
                                      if (
                                        !y ||
                                        !d ||
                                        Number.isNaN(idx) ||
                                        idx < 0 ||
                                        idx > 11
                                      )
                                        return null;
                                      return (
                                        <span
                                          className="ms-2 small fw-normal"
                                          style={{ opacity: 0.95 }}
                                          title="Cancel by this date/time to avoid charges"
                                        >
                                          | Deadline: {d} {monthNames[idx]}{" "}
                                          {y}, 11:59 PM (UAE)
                                        </span>
                                      );
                                    })()}
                                  {/* Darina (apiId 16) free-cancellation deadline
                                      — slot.deadlineDate is ISO yyyy-MM-dd from
                                      the search-time cancellation ladder (the
                                      "Free cancellation until X" band's toDate). */}
                                  {bookingData?.payload?.apiId === 16 &&
                                    slot.deadlineDate &&
                                    (() => {
                                      const parts =
                                        slot.deadlineDate.split("-");
                                      if (parts.length !== 3) return null;
                                      const [y, m, d] = parts;
                                      const monthNames = [
                                        "Jan",
                                        "Feb",
                                        "Mar",
                                        "Apr",
                                        "May",
                                        "Jun",
                                        "Jul",
                                        "Aug",
                                        "Sep",
                                        "Oct",
                                        "Nov",
                                        "Dec",
                                      ];
                                      const idx = parseInt(m, 10) - 1;
                                      if (
                                        !y ||
                                        !d ||
                                        Number.isNaN(idx) ||
                                        idx < 0 ||
                                        idx > 11
                                      )
                                        return null;
                                      return (
                                        <span
                                          className="ms-2 small fw-normal"
                                          style={{ opacity: 0.95 }}
                                          title="Free cancellation until this date/time"
                                        >
                                          | Free cancellation until{" "}
                                          {parseInt(d, 10)} {monthNames[idx]}{" "}
                                          {y}, 11:59 PM (UAE)
                                        </span>
                                      );
                                    })()}
                                  {/* {slot.rate != null && (
                                    <span
                                      className="ms-auto small fw-normal"
                                      style={{ opacity: 0.9 }}
                                    >
                                      {formatPrice(slot.rate)}
                                    </span>
                                  )} */}
                                </h6>
                              </Accordion.Header>
                              <Accordion.Body className="p-3">
                                {/* Column headers — matches Inhouse's
                                    Guest Details grid layout with an
                                    added Gender column (IWTX-mandatory
                                    per docs.iol-x.com) and a Lead radio
                                    column that replaces the separate
                                    Primary Guest Details card. */}
                                <Row className="fw-semibold small text-muted px-2 mb-1 d-none d-md-flex">
                                  <Col md={2}>Passenger</Col>
                                  <Col md={2}>Title *</Col>
                                  <Col md={2}>First Name *</Col>
                                  <Col md={2}>Last Name *</Col>
                                  <Col md={2}>Gender *</Col>
                                  <Col md={2} className="text-center">
                                    Lead
                                  </Col>
                                </Row>
                                {room.guests.map((guest, guestIndex) => (
                                  <div
                                    key={guestIndex}
                                    className="guest-row mb-2"
                                  >
                                    <Row className="align-items-center g-2">
                                      <Col md={2}>
                                        <span className="fw-semibold text-muted">
                                          {guest.isChild
                                            ? `Child ${
                                                guestIndex - room.adults + 1
                                              } (Age: ${
                                                room.childAges[
                                                  guestIndex - room.adults
                                                ]
                                              })`
                                            : `Adult ${guestIndex + 1}`}{" "}
                                          *
                                        </span>
                                      </Col>
                                      <Col md={2}>
                                        <Form.Select
                                          value={guest.salutation}
                                          onChange={(e) =>
                                            handleGuestChange(
                                              roomIndex,
                                              guestIndex,
                                              "salutation",
                                              e.target.value,
                                            )
                                          }
                                          className="form-control-sm"
                                          isInvalid={
                                            !!validationErrors[
                                              `room_${roomIndex}_guest_${guestIndex}_salutation`
                                            ]
                                          }
                                        >
                                          <option value="">SELECT</option>
                                          <option value="Mr">Mr</option>
                                          <option value="Mrs">Mrs</option>
                                          <option value="Ms">Ms</option>
                                          <option value="Dr">Master</option>
                                        </Form.Select>
                                        {validationErrors[
                                          `room_${roomIndex}_guest_${guestIndex}_salutation`
                                        ] && (
                                          <Form.Control.Feedback type="invalid">
                                            {
                                              validationErrors[
                                                `room_${roomIndex}_guest_${guestIndex}_salutation`
                                              ]
                                            }
                                          </Form.Control.Feedback>
                                        )}
                                      </Col>
                                      <Col md={2}>
                                        <Form.Control
                                          type="text"
                                          placeholder="First Name *"
                                          value={guest.firstName}
                                          onChange={(e) =>
                                            handleGuestChange(
                                              roomIndex,
                                              guestIndex,
                                              "firstName",
                                              e.target.value,
                                            )
                                          }
                                          className="form-control-sm"
                                          isInvalid={
                                            !!validationErrors[
                                              `room_${roomIndex}_guest_${guestIndex}_firstName`
                                            ]
                                          }
                                        />
                                        {validationErrors[
                                          `room_${roomIndex}_guest_${guestIndex}_firstName`
                                        ] && (
                                          <Form.Control.Feedback type="invalid">
                                            {
                                              validationErrors[
                                                `room_${roomIndex}_guest_${guestIndex}_firstName`
                                              ]
                                            }
                                          </Form.Control.Feedback>
                                        )}
                                      </Col>
                                      <Col md={2}>
                                        <Form.Control
                                          type="text"
                                          placeholder="Last Name *"
                                          value={guest.lastName}
                                          onChange={(e) =>
                                            handleGuestChange(
                                              roomIndex,
                                              guestIndex,
                                              "lastName",
                                              e.target.value,
                                            )
                                          }
                                          className="form-control-sm"
                                          isInvalid={
                                            !!validationErrors[
                                              `room_${roomIndex}_guest_${guestIndex}_lastName`
                                            ]
                                          }
                                        />
                                        {validationErrors[
                                          `room_${roomIndex}_guest_${guestIndex}_lastName`
                                        ] && (
                                          <Form.Control.Feedback type="invalid">
                                            {
                                              validationErrors[
                                                `room_${roomIndex}_guest_${guestIndex}_lastName`
                                              ]
                                            }
                                          </Form.Control.Feedback>
                                        )}
                                      </Col>
                                      <Col md={2}>
                                        <Form.Select
                                          value={guest.gender}
                                          onChange={(e) =>
                                            handleGuestChange(
                                              roomIndex,
                                              guestIndex,
                                              "gender",
                                              e.target.value,
                                            )
                                          }
                                          className="form-control-sm"
                                          isInvalid={
                                            !!validationErrors[
                                              `room_${roomIndex}_guest_${guestIndex}_gender`
                                            ]
                                          }
                                        >
                                          <option value="">Gender</option>
                                          <option value="Male">Male</option>
                                          <option value="Female">Female</option>
                                          <option value="Other">Other</option>
                                        </Form.Select>
                                        {validationErrors[
                                          `room_${roomIndex}_guest_${guestIndex}_gender`
                                        ] && (
                                          <Form.Control.Feedback type="invalid">
                                            {
                                              validationErrors[
                                                `room_${roomIndex}_guest_${guestIndex}_gender`
                                              ]
                                            }
                                          </Form.Control.Feedback>
                                        )}
                                      </Col>
                                      {/* Lead radio — picks the primary
                                          guest at submit time. Same
                                          pattern Inhouse HotelBookingPage
                                          uses; replaces the redundant
                                          Primary Guest Details card. */}
                                      <Col md={2} className="text-center">
                                        <Form.Check
                                          type="radio"
                                          name="leadGuest"
                                          id={`lead_${roomIndex}_${guestIndex}`}
                                          checked={
                                            leadIndex.roomIdx === roomIndex &&
                                            leadIndex.guestIdx === guestIndex
                                          }
                                          onChange={() =>
                                            setLeadIndex({
                                              roomIdx: roomIndex,
                                              guestIdx: guestIndex,
                                            })
                                          }
                                          disabled={guest.isChild}
                                          title={
                                            guest.isChild
                                              ? "Children cannot be the lead passenger"
                                              : "Set as lead passenger"
                                          }
                                        />
                                      </Col>
                                    </Row>
                                    {guestIndex < room.guests.length - 1 && (
                                      <hr className="my-3" />
                                    )}
                                  </div>
                                ))}
                              </Accordion.Body>
                            </Accordion.Item>
                          );
                        })}
                      </Accordion>
                    </Card.Body>
                  </Card>

                  {/* PAN Card capture — rendered when EITHER supplier
                      requires PAN on the primary guest:
                        • Atharva (apiId=3) + Indian primary guest —
                          §6.1 mandates PAN or HCreateBooking rejects with
                          error 3006 ("Invalid PAN details").
                        • GRN (apiId=20) + rate.pan_required=true — GRN
                          returns an error envelope when holder.pan_number
                          is missing on a pan_required rate.
                      The card is fully hidden when neither applies, so
                      every other supplier / non-PAN rate keeps its
                      existing 4-card layout unchanged. The PAN Card Type
                      dropdown is Atharva-only; the PAN Company Name
                      input is GRN-only (optional, for corporate PANs). */}
                  {requiresPan() && (
                    <Card className="p-4 mb-2 shadow-sm border-0">
                      <h5 className="mb-1 fw-bold">
                        Primary Guest PAN Details
                      </h5>
                      <div className="text-muted small mb-3">
                        {requiresAtharvaPan()
                          ? "PAN is required for Indian nationals booking with Atharva. Enter the primary guest's PAN card details."
                          : "This GRN rate mandates PAN on the holder. Enter the primary guest's PAN details."}
                      </div>
                      <Row className="g-3">
                        <Col md={6}>
                          <Form.Group>
                            <Form.Label className="fw-semibold">
                              PAN Card No <span className="text-danger">*</span>
                            </Form.Label>
                            <Form.Control
                              type="text"
                              value={panCardNo}
                              maxLength={10}
                              placeholder="Enter 10-character PAN"
                              isInvalid={!!validationErrors.panCardNo}
                              onChange={(e) => {
                                // Uppercase-only on typing so the pattern
                                // match in validateForm is stable regardless
                                // of caps lock state.
                                setPanCardNo(e.target.value.toUpperCase());
                                if (validationErrors.panCardNo) {
                                  setValidationErrors((prev) => {
                                    const next = { ...prev };
                                    delete next.panCardNo;
                                    return next;
                                  });
                                }
                              }}
                            />
                            {validationErrors.panCardNo && (
                              <Form.Control.Feedback type="invalid">
                                {validationErrors.panCardNo}
                              </Form.Control.Feedback>
                            )}
                          </Form.Group>
                        </Col>
                        {requiresAtharvaPan() && (
                          <Col md={6}>
                            <Form.Group>
                              <Form.Label className="fw-semibold">
                                PAN Card Type{" "}
                                <span className="text-danger">*</span>
                              </Form.Label>
                              <Form.Select
                                value={panCardType}
                                isInvalid={!!validationErrors.panCardType}
                                onChange={(e) => {
                                  setPanCardType(e.target.value);
                                  if (validationErrors.panCardType) {
                                    setValidationErrors((prev) => {
                                      const next = { ...prev };
                                      delete next.panCardType;
                                      return next;
                                    });
                                  }
                                }}
                              >
                                {/* Values are the Atharva PANCardType enum
                                    per §6.1 — sent verbatim on the wire. */}
                                <option value="2">Personal</option>
                                <option value="1">Corporate</option>
                                <option value="3">Government</option>
                                <option value="4">Proprietor</option>
                                <option value="5">Firm</option>
                                <option value="6">HUF</option>
                                <option value="7">Trust</option>
                                <option value="8">Education Society</option>
                              </Form.Select>
                              {validationErrors.panCardType && (
                                <Form.Control.Feedback type="invalid">
                                  {validationErrors.panCardType}
                                </Form.Control.Feedback>
                              )}
                            </Form.Group>
                          </Col>
                        )}
                        {requiresGrnPan() && (
                          <Col md={6}>
                            <Form.Group>
                              <Form.Label className="fw-semibold">
                                PAN Company Name{" "}
                                <span className="text-muted small">
                                  (optional)
                                </span>
                              </Form.Label>
                              <Form.Control
                                type="text"
                                value={panCompanyName}
                                placeholder="Only for corporate PANs"
                                onChange={(e) =>
                                  setPanCompanyName(e.target.value)
                                }
                              />
                            </Form.Group>
                          </Col>
                        )}
                      </Row>
                    </Card>
                  )}

                  {/* Special Requests card — matches Inhouse
                      HotelBookingPage: optional Booking Done For text
                      (admin only) at the top, then the 11-chip preset
                      grid inside .special-request-grid. */}
                  <Card className="p-4 mb-2 shadow-sm border-0">
                    <h5 className="mb-3 fw-bold">Special Requests</h5>
                    <Row className="g-3">
                      {isAdmin && (
                        <Col md={12}>
                          <Form.Group className="mb-2">
                            <Form.Label className="fw-semibold">
                              Booking Done For{" "}
                              <span className="text-muted small">
                                (optional)
                              </span>
                            </Form.Label>
                            <Form.Control
                              type="text"
                              value={bookingDoneFor}
                              onChange={(e) =>
                                setBookingDoneFor(e.target.value)
                              }
                              placeholder="Name of the person this booking is done for"
                            />
                          </Form.Group>
                        </Col>
                      )}
                      <Col md={12}>
                        <Form.Group className="mb-0">
                          <div className="special-request-grid">
                            {SPECIAL_REQUEST_OPTIONS.map((request) => (
                              <Form.Check
                                key={request}
                                type="checkbox"
                                id={`special-request-${request.replace(/[^a-zA-Z0-9]/g, "-")}`}
                                label={request}
                                checked={specialRequests.includes(request)}
                                onChange={() =>
                                  handleSpecialRequestToggle(request)
                                }
                                className="mb-2 special-request-check"
                              />
                            ))}
                          </div>
                        </Form.Group>
                      </Col>
                    </Row>
                  </Card>

                  {/* Payment Mode card — same 3-scenario logic Inhouse
                      HotelBookingPage uses:
                        1. Sufficient credit           → Credit Limit only
                        2. Insufficient + Card enabled → Card only + note
                        3. Insufficient + Card blocked → hard-block banner */}
                  <Card className="p-4 mb-2 shadow-sm border-0">
                    <h5 className="mb-3 fw-bold">Payment Mode</h5>
                    {paymentModeOptions.length > 0 ? (
                      <>
                        <Row className="g-3">
                          <Col md={6}>
                            <Form.Group>
                              <Form.Label className="fw-semibold mb-1">
                                Mode
                              </Form.Label>
                              <Form.Select
                                value={paymentMode}
                                onChange={(e) =>
                                  setPaymentMode(e.target.value)
                                }
                              >
                                {paymentModeOptions.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </Form.Select>
                            </Form.Group>
                          </Col>
                        </Row>
                        {hasSufficientCredit === false &&
                          agentCardPaymentEnabled && (
                            <div className="text-danger small mt-2 fw-semibold">
                              Insufficient credit. Pay with credit card
                              before time limit and reconfirm.
                            </div>
                          )}
                      </>
                    ) : (
                      <Alert variant="danger" className="mb-0">
                        You do not have sufficient credit limit, and online
                        card payment is not enabled for your account.
                        Therefore, this booking cannot be completed. Please
                        contact your account manager or administrator to
                        enable a payment method.
                      </Alert>
                    )}
                  </Card>
                </Col>

                {/* ────────────── Right sticky column ────────────── */}
                <Col lg={4} className="hbp-right-col">
                  <div className="hbp-sticky-summary">
                    {/* Booking Summary sidebar — same class + row pattern
                        as Inhouse (hbp-summary-*). */}
                    <Card className="shadow-sm rounded-3 mb-3 booking-summary-card border-0 overflow-hidden">
                      <Card.Header className="bg-primary text-white py-2 rounded-top">
                        <h6 className="mb-0 d-flex align-items-center">
                          <FaHotel className="me-2" /> Booking Summary
                        </h6>
                      </Card.Header>
                      <Card.Body className="p-3">
                        <div className="mb-3">
                          <div className="fw-bold text-primary mb-1">
                            {hotelStaticData.hotelName}
                          </div>
                          <div className="text-muted small mb-2">
                            {hotelStaticData.address}
                          </div>
                          <div className="d-flex flex-wrap align-items-center gap-2">
                            {hotelStaticData.starRating != null && (
                              <span className="badge bg-warning text-dark">
                                ⭐ {hotelStaticData.starRating} Star
                              </span>
                            )}
                          </div>
                          {/* Per-room refund badges — keeps API's multi-
                              rate display without cluttering the header. */}
                          {selectedRate.length > 0 && (
                            <div className="mt-2 d-flex flex-column gap-1">
                              {selectedRate.map((room, i) => (
                                <div
                                  key={i}
                                  className="d-flex align-items-center gap-2 small"
                                >
                                  <span className="fw-semibold text-dark">
                                    Room {i + 1}:
                                  </span>
                                  {getRefundStatusBadge(
                                    room.nonRefundable === true ||
                                      room.nonRefundable === "true" ||
                                      room.nonRefundable === "Y"
                                      ? "NON REFUNDABLE"
                                      : "FLEXIBLE",
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="hbp-summary-row">
                          <div className="hbp-summary-label">
                            <FaCalendarAlt className="me-2 text-primary" />
                            Check-in
                          </div>
                          <div className="hbp-summary-value">
                            {formatDateTime(payload.checkInDate)}
                          </div>
                        </div>
                        <div className="hbp-summary-row">
                          <div className="hbp-summary-label">
                            <FaCalendarAlt className="me-2 text-primary" />
                            Check-out
                          </div>
                          <div className="hbp-summary-value">
                            {formatDateTime(payload.checkOutDate)}
                          </div>
                        </div>
                        <div className="hbp-summary-row align-items-start">
                          <div className="hbp-summary-label">
                            <FaUsers className="me-2 text-primary" />
                            Guests
                          </div>
                          <div className="hbp-summary-value text-end">
                            {payload.rooms.map((room, i) => (
                              <div key={i} className="small">
                                Room {i + 1}: {room.adults} Adult
                                {room.adults > 1 ? "s" : ""}
                                {room.children
                                  ? `, ${room.children} Child${
                                      room.children > 1 ? "ren" : ""
                                    }`
                                  : ""}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="hbp-summary-row align-items-start">
                          <div className="hbp-summary-label">
                            <FaUtensils className="me-2 text-primary" />
                            Meal Plan
                          </div>
                          <div className="hbp-summary-value text-end">
                            {selectedRate.map((room, i) => (
                              <div key={i} className="small">
                                Room {i + 1}: {room.mealPlan || "—"}
                              </div>
                            ))}
                          </div>
                        </div>
                      </Card.Body>
                    </Card>

                    {/* Price Details card — same hbp-price-card + hbp-summary-row
                        rows as Inhouse. */}
                    <Card className="shadow-sm rounded-3 border-0 hbp-price-card">
                      <Card.Header className="bg-light py-2">
                        <h6 className="mb-0 fw-bold">Price Details</h6>
                      </Card.Header>
                      <Card.Body className="p-3">
                        <div className="hbp-summary-row">
                          <div className="hbp-summary-label">Selling Price</div>
                          <div className="hbp-summary-value">
                            {formatPrice(totalPrice)}
                          </div>
                        </div>
                        {tourismDirhamsAmount > 0 && (
                          <div className="hbp-summary-row">
                            <div className="hbp-summary-label">
                              Tourism Dirhams
                            </div>
                            <div className="hbp-summary-value">
                              {formatPrice(tourismDirhamsAmount)}
                            </div>
                          </div>
                        )}
                        <hr className="my-2" />
                        <div className="hbp-summary-row fw-bold">
                          <div className="hbp-summary-label text-danger">
                            New Total
                          </div>
                          <div className="hbp-summary-value text-danger">
                            {formatPrice(newTotal)}
                          </div>
                        </div>
                        {activeUserRole === "ADMIN" && (
                          <div className="hbp-summary-row mt-2">
                            <div className="hbp-summary-label text-muted small">
                              Total (incl. markup)
                            </div>
                            <div className="hbp-summary-value text-success fw-bold">
                              {formatPrice(totalPrice)}
                            </div>
                          </div>
                        )}
                      </Card.Body>
                    </Card>

                    {/* ATHARVA (apiId 3) ONLY: Vouchered vs Confirmed booking
                        choice per the HCreateBooking docs. Sits right above
                        the action bar so the operator picks the mode
                        immediately before hitting Confirm Booking.
                          "Book and Pay Now"        → VoucherBooking = true
                              (auto-vouchers; needs sufficient credit)
                          "Hold Room and Pay Later" → VoucherBooking = false
                              (confirmed hold; no balance needed; auto-cancels
                               if not vouchered before the time limit)
                        Guarded by apiId===3 so other suppliers on this page
                        are untouched. */}
                    {bookingData?.payload?.apiId === 3 && (
                      <Card className="shadow-sm rounded-3 border-0 mt-3">
                        {/* <Card.Header className="bg-light py-2">
                          <h6 className="mb-0 fw-bold">Booking Mode</h6>
                        </Card.Header> */}
                        <Card.Body className="p-3">
                          {/* <div className="text-muted small mb-2 fw-bold">
                            Are you sure you want to continue with the
                            booking?
                          </div> */}
                          <Form.Label className="mb-2 fw-semibold">
                               Are you sure you want to continue with the booking?
                          </Form.Label>
                          <Form.Check
                            type="radio"
                            name="atharvaBookingMode"
                            id="atharva-mode-voucher"
                            label="Book and Pay Now"
                            checked={bookingConfirmation === "Book & Voucher"}
                            onChange={() => {
                              setBookingConfirmation("Book & Voucher");
                              if (validationErrors.bookingMode) {
                                setValidationErrors((prev) => {
                                  const next = { ...prev };
                                  delete next.bookingMode;
                                  return next;
                                });
                              }
                            }}
                            className="mb-1"
                          />
                          <Form.Check
                            type="radio"
                            name="atharvaBookingMode"
                            id="atharva-mode-hold"
                            label="Hold Room and Pay Later"
                            checked={
                              bookingConfirmation === "Hold & Book Later"
                            }
                            onChange={() => {
                              setBookingConfirmation("Hold & Book Later");
                              if (validationErrors.bookingMode) {
                                setValidationErrors((prev) => {
                                  const next = { ...prev };
                                  delete next.bookingMode;
                                  return next;
                                });
                              }
                            }}
                          />
                          {validationErrors.bookingMode && (
                            <div className="text-danger small mt-2">
                              {validationErrors.bookingMode}
                            </div>
                          )}
                        </Card.Body>
                      </Card>
                    )}

                    <div className="hbp-action-bar mt-3 d-flex gap-2">
                      <Button
                        variant="outline-secondary"
                        onClick={() => navigate(-1)}
                        className="flex-grow-1"
                      >
                        Back
                      </Button>
                      <Button
                        variant="primary"
                        type="button"
                        className="flex-grow-1"
                        onClick={openPolicyConsent}
                        disabled={isSubmitting || noPaymentPathAvailable}
                        title={
                          noPaymentPathAvailable
                            ? "Booking cannot be completed — no payment method available for this agent."
                            : undefined
                        }
                      >
                        Confirm Booking
                      </Button>
                    </div>
                  </div>
                </Col>
              </Row>

              {/* Policy + T&C consent modal — shown after the on-page
                  Confirm Booking button, before the booking summary
                  modal. Cancellation policies come from the search-time
                  rate object (bookingData.selectedRate[i].cancellationPolicy)
                  since API-side hotels don't expose a /policies endpoint.
                  Mirrors HotelBookingPage's PolicyConsentModal. */}
              <Modal
                show={showPolicyModal}
                onHide={() => setShowPolicyModal(false)}
                centered
                backdrop="static"
                size="lg"
                scrollable
                dialogClassName="policy-modal"
              >
                <Modal.Header closeButton className="policy-modal-header">
                  <Modal.Title className="policy-modal-title">
                    Hotel Policies &amp; Terms
                  </Modal.Title>
                </Modal.Header>
                <Modal.Body className="policy-modal-body">
                  {/* Cancellation Policy — for a Non-Refundable rate the
                      supplier policy is suppressed and we render a fixed
                      "no refund" notice, matching Inhouse. */}
                  <section className="policy-section">
                    <h6 className="policy-section-title">
                      Cancellation Policy
                    </h6>
                    {(() => {
                      const anyNonRefundable = selectedRate.some(
                        (r) =>
                          r.nonRefundable === true ||
                          r.nonRefundable === "true" ||
                          r.nonRefundable === "Y",
                      );
                      if (anyNonRefundable) {
                        return (
                          <div className="policy-item">
                            <div
                              className="policy-text fw-bold"
                              style={{ color: "#dc2626" }}
                            >
                              Non-refundable
                            </div>
                            <div className="policy-text">
                              No refund will be provided if this booking is
                              cancelled.
                            </div>
                            <div className="policy-text">
                              100% cancellation charges apply from the time
                              of booking.
                            </div>
                          </div>
                        );
                      }
                      const allPolicies = selectedRate.flatMap(
                        (r) => r.cancellationPolicy || [],
                      );
                      if (!allPolicies.length) {
                        return (
                          <div className="policy-empty">
                            No cancellation policy specified.
                          </div>
                        );
                      }
                      return allPolicies.map((p, idx) => (
                        <div key={idx} className="policy-item">
                          <div
                            className="policy-text"
                            style={{ whiteSpace: "pre-line" }}
                          >
                            {stripPolicyHtml(p?.policyText) || "—"}
                          </div>
                          {(p?.fromDate || p?.toDate) && (
                            <div className="policy-meta">
                              Valid{" "}
                              {p?.fromDate
                                ? new Date(p.fromDate).toLocaleDateString()
                                : "—"}
                              {" – "}
                              {p?.toDate
                                ? new Date(p.toDate).toLocaleDateString()
                                : "—"}
                            </div>
                          )}
                        </div>
                      ));
                    })()}
                  </section>

                  {/* Terms & Conditions — external suppliers don't return
                      T&C through the search response. Kept as a section so
                      the modal shape matches Inhouse; shows an "unspecified"
                      note rather than an empty area. */}
                  <section className="policy-section policy-section-last">
                    <h6 className="policy-section-title">
                      Terms &amp; Conditions
                    </h6>
                    <div className="policy-empty">
                      Standard supplier terms &amp; conditions apply. Please
                      contact your account manager for the current terms.
                    </div>
                  </section>
                </Modal.Body>
                <Modal.Footer className="policy-modal-footer">
                  <Form.Check
                    type="checkbox"
                    id="api-policy-accept"
                    className="me-auto policy-accept-check"
                    label="I have read and accept the policies and terms & conditions"
                    checked={policyAccepted}
                    onChange={(e) => setPolicyAccepted(e.target.checked)}
                  />
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => setShowPolicyModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!policyAccepted}
                    onClick={() => {
                      setShowPolicyModal(false);
                      handleSubmit();
                    }}
                  >
                    Proceed
                  </Button>
                </Modal.Footer>
              </Modal>

              {/* Confirmation modal — same confirm-booking-modal shell +
                  layout as Inhouse. */}
              <Modal
                show={showConfirmModal}
                onHide={() => setShowConfirmModal(false)}
                centered
                backdrop="static"
                dialogClassName="confirm-booking-modal"
              >
                <Modal.Header
                  closeButton
                  className="bg-primary text-white py-2"
                  style={{ borderBottom: "none" }}
                >
                  <Modal.Title className="fw-semibold d-flex align-items-center">
                    <FaHotel className="me-2" /> Confirm Your Booking
                  </Modal.Title>
                </Modal.Header>
                <Modal.Body className="px-3 py-2 bg-light">
                  {pendingPayload && (
                    <div className="border rounded-3 bg-white shadow-sm p-2">
                      <div className="mb-2">
                        <p className="mb-0 d-flex align-items-center flex-wrap">
                          <span className="fw-bold text-primary fs-5">
                            {pendingPayload.hotelName}
                          </span>
                          {pendingPayload.address && (
                            <span className="text-muted small ms-1">
                              , {pendingPayload.address}
                            </span>
                          )}
                        </p>
                      </div>

                      <hr className="my-2" />

                      <Row className="gy-1">
                        <Col xs={6}>
                          <p className="mb-1">
                            <strong>Check-In:</strong>
                            <br />
                            <span className="text-dark">
                              {formatDateTime(pendingPayload.checkInDate)}
                            </span>
                          </p>
                        </Col>
                        <Col xs={6}>
                          <p className="mb-1">
                            <strong>Check-Out:</strong>
                            <br />
                            <span className="text-dark">
                              {formatDateTime(pendingPayload.checkOutDate)}
                            </span>
                          </p>
                        </Col>
                        <Col xs={6}>
                          <p className="mb-1">
                            <strong>Rooms:</strong>{" "}
                            {pendingPayload.rooms.length}
                          </p>
                        </Col>
                        <Col xs={6}>
                          <p className="mb-1">
                            <strong>Nights:</strong> {pendingPayload.nights}
                          </p>
                        </Col>

                        {/* Room category + meal plan — same WHAT-am-I-booking
                            info that the per-room Accordion.Header shows in
                            the Guest Details section. pendingPayload.rooms
                            already carries per-room roomCategory / mealPlan
                            copied from the selected rate at submit time. */}
                        {pendingPayload.rooms.map((s, i) => (
                          <React.Fragment key={i}>
                            <Col xs={6}>
                              <p className="mb-1">
                                <strong>Room Category:</strong>
                                <br />
                                <span className="text-dark">
                                  {pendingPayload.rooms.length > 1
                                    ? `Room ${s.roomNo ?? i + 1} - `
                                    : ""}
                                  {s.roomCategory || "—"}
                                </span>
                              </p>
                            </Col>
                            <Col xs={6}>
                              <p className="mb-1">
                                <strong>Meal Plan:</strong>
                                <br />
                                <span className="text-dark">
                                  {s.mealPlan || "—"}
                                </span>
                              </p>
                            </Col>
                          </React.Fragment>
                        ))}

                        {/* Lead Passenger — uses the lead guest captured into
                            primaryGuest at submit time. Only shown when there
                            is a usable name; gracefully hides on empty. */}
                        {(() => {
                          const lp = pendingPayload?.primaryGuest;
                          if (!lp) return null;
                          const fullName = [
                            lp.salutation,
                            lp.firstName,
                            lp.middleName,
                            lp.lastName,
                          ]
                            .filter((p) => p && String(p).trim() !== "")
                            .join(" ");
                          if (!fullName) return null;
                          return (
                            <Col xs={12}>
                              <p className="mb-1">
                                <strong>Lead Passenger:</strong>
                                <br />
                                <span className="text-dark">{fullName}</span>
                              </p>
                            </Col>
                          );
                        })()}

                        {/* Cancellation block — for Non-Refundable rates the
                            deadline doesn't apply at all, so we render a clear
                            "no refund" notice instead. The rate's refundability
                            takes precedence over the Hotel Cancellation Policy
                            (also overridden in the Policies modal below).
                            Payment Mode badge sits in a paired md=6 column so
                            the two read as one row (deadline left, mode right)
                            on tablet+, and stack cleanly on mobile. */}
                        {isNonRefundableRate ? (
                          <Col xs={12} md={6}>
                            <div
                              className="p-2 rounded border"
                              style={{
                                borderColor: "#dc2626",
                                background: "#fef2f2",
                              }}
                            >
                              <p
                                className="mb-1 fw-bold"
                                style={{ color: "#dc2626" }}
                              >
                                Non-refundable
                              </p>
                              <p className="mb-1 text-dark small">
                                No refund will be provided if this booking is
                                cancelled.
                              </p>
                              <p className="mb-0 text-dark small">
                                100% cancellation charges apply from the time of
                                booking.
                              </p>
                            </div>
                          </Col>
                        ) : (
                          cancellationDeadline && (
                            <Col xs={12} md={6}>
                              <p className="mb-1">
                                <strong>Cancellation Deadline:</strong>
                                <br />
                                <span className="text-dark">
                                  {cancellationDeadline.toLocaleDateString(
                                    "en-GB",
                                    {
                                      day: "2-digit",
                                      month: "short",
                                      year: "numeric",
                                    },
                                  )}
                                  , 02:00 PM (UAE)
                                </span>
                                {isOutsideDeadline ? (
                                  <span
                                    className="badge bg-danger ms-2"
                                    style={{ fontSize: "0.7rem" }}
                                  >
                                    Passed
                                  </span>
                                ) : (
                                  <span
                                    className="badge bg-success ms-2"
                                    style={{ fontSize: "0.7rem" }}
                                  >
                                    Refundable until this date
                                  </span>
                                )}
                              </p>
                            </Col>
                          )
                        )}

                        {/* Payment Mode — small badge beside the cancellation
                            deadline / non-refundable notice. Shown for either
                            refundable branch so the user re-confirms which
                            method will be used before submitting. */}
                        {(isNonRefundableRate || cancellationDeadline) && (
                          <Col
                            xs={12}
                            md={6}
                            className="d-flex align-items-start justify-content-md-end"
                          >
                            <p className="mb-1">
                              <strong>Payment Mode:</strong>
                              <br />
                              <span
                                className="badge bg-success"
                                style={{ fontSize: "0.75rem" }}
                              >
                                {paymentMode === "CREDITLIMIT"
                                  ? "Credit Limit"
                                  : paymentMode === "CARD"
                                    ? "Online Payment"
                                    : paymentMode === "CASH"
                                      ? "Cash"
                                      : paymentMode || "—"}
                              </span>
                            </p>
                          </Col>
                        )}

                        <Col xs={12}>
                          {/* ✅ Show Selling Price only if ADMIN */}
                          {activeUserRole === "ADMIN" && (
                            <div className="p-2 rounded bg-white border mt-2">
                              <div className="d-flex justify-content-between align-items-center">
                                <h6 className="mb-0 text-muted">
                                  Selling Price
                                </h6>
                                <h5 className="mb-0 text-success fw-bold">
                                  {formatPrice(totalPrice)}
                                </h5>
                              </div>
                            </div>
                          )}

                          {/* Payable row — plain border, no green
                              highlight. Single-line layout. */}
                          <div className="p-2 rounded bg-white border mt-2 d-flex justify-content-between align-items-center">
                            <h6 className="mb-0 fw-bold">Payable</h6>
                            <h5 className="mb-0 fw-bold">
                              {formatPrice(newTotal)}{" "}
                              <span className="text-muted small fw-normal">
                                for {pendingPayload.rooms.length}{" "}
                                {pendingPayload.rooms.length > 1
                                  ? "rooms"
                                  : "room"}
                              </span>
                            </h5>
                          </div>
                        </Col>
                      </Row>

                      <div className="mt-1 p-2 bg-white border rounded">
                        <h6 className="fw-bold mb-1">Rate Split</h6>
                        <div className="d-flex justify-content-between">
                          <span>Selling Price</span>
                          <span>{formatPrice(totalPrice)}</span>
                        </div>
                        <hr className="my-1" />
                        <div className="d-flex justify-content-between fw-bold">
                          <span>Total (Selling)</span>
                          <span>{formatPrice(totalPrice)}</span>
                        </div>
                      </div>

                      <div className="mt-1 p-2 bg-white border rounded d-flex align-items-center">
                        <span
                          className="me-2 d-inline-flex align-items-center justify-content-center"
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: "50%",
                            background: "#16a34a",
                            color: "#fff",
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            lineHeight: 1,
                          }}
                          aria-hidden="true"
                        >
                          ✓
                        </span>
                        <span className="small text-dark">
                          Hotel policies and terms &amp; conditions accepted
                        </span>
                      </div>

                      <div className="mt-1 text-center">
                        <p className="text-muted small mb-0">
                          Please review the booking details carefully before
                          confirming.
                        </p>
                      </div>
                    </div>
                  )}
                </Modal.Body>

                <Modal.Footer className="bg-light border-0 d-flex justify-content-between">
                  <Button
                    variant="outline-secondary"
                    onClick={() => setShowConfirmModal(false)}
                    disabled={isSubmitting}
                  >
                    <i className="bi bi-x-circle me-1"></i> Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={confirmBooking}
                    disabled={isSubmitting}
                    className="px-4 fw-semibold"
                  >
                    {isSubmitting ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                        ></span>
                        Processing...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-circle me-1"></i> Confirm
                      </>
                    )}
                  </Button>
                </Modal.Footer>
              </Modal>

              {/* Duplicate-booking modal — opened when the backend replies
                  status="DUPLICATE" (GRN error code 6000). Read-only
                  acknowledgement; the operator dismisses and goes to check
                  the existing booking. No retry action here on purpose. */}
              <Modal
                show={showDuplicateModal}
                onHide={() => setShowDuplicateModal(false)}
                centered
                backdrop="static"
              >
                <Modal.Header closeButton>
                  <Modal.Title>
                    <i className="bi bi-exclamation-triangle-fill text-warning me-2"></i>
                    Duplicate Booking
                  </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                  <p className="mb-2">{duplicateMessage}</p>
                  <p className="text-muted small mb-0">
                    Please check the Hotel Bookings list for the existing
                    reservation before retrying.
                  </p>
                </Modal.Body>
                <Modal.Footer>
                  <Button
                    variant="outline-secondary"
                    onClick={() => setShowDuplicateModal(false)}
                  >
                    Close
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => {
                      setShowDuplicateModal(false);
                      navigate("/booking-details/hotel-booking-list");
                    }}
                  >
                    View Bookings
                  </Button>
                </Modal.Footer>
              </Modal>
            </Form>
          </Container>
        </main>
      </div>
    </div>
  );
};

export default ApiBookingPageForHotels;
