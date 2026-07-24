import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaHotel,
  FaCalendarAlt,
  FaUsers,
  FaUtensils,
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

  // ─────────────────────────── effects ────────────────────────────────
  useEffect(() => {
    const storedData = sessionStorage.getItem("bookingData");
    if (storedData) {
      const parsedData = JSON.parse(storedData);
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

    return { errors, hasErrors };
  };

  /**
   * Step 1 of the confirm flow — validate the form, then show the Policy
   * consent modal. On Proceed the consent modal calls handleSubmit()
   * which builds the payload and opens the booking-summary modal. Mirrors
   * Inhouse HotelBookingPage's openPolicyConsent.
   */
  const openPolicyConsent = (e) => {
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
      toast.error(
        errors.bookingMode || "Please fill in all required fields correctly.",
      );
      return;
    }
    setValidationErrors({});
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

              if (nonRefundable === true) {
                const today = new Date();
                const deadline = new Date(today);
                deadline.setDate(today.getDate() - 2);
                deadline.setHours(0, 0, 0, 0);
                return deadline;
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
    setShowConfirmModal(false);
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

      if (
        bookingResponse &&
        bookingResponse.status === "CONFIRMED" &&
        bookingResponse.bookingId != 0
      ) {
        toast.success(bookingResponse.message);
        navigate("/booking-details/hotel-booking-list");
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
                          <div className="policy-text">
                            {p?.policyText || "—"}
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

                        {/* Per-room category + meal plan */}
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

                        {/* Lead Passenger */}
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

                        <Col xs={12}>
                          <p className="mb-1">
                            <strong>Cancellation Policy:</strong>
                          </p>
                          <ul className="mb-0 ps-3">
                            {pendingPayload.cancellationPolicy &&
                            pendingPayload.cancellationPolicy.length > 0 ? (
                              pendingPayload.cancellationPolicy.map(
                                (policy, index) => (
                                  <li key={index} className="text-dark">
                                    {policy}
                                  </li>
                                ),
                              )
                            ) : (
                              <li className="text-muted">
                                No cancellation policy available.
                              </li>
                            )}
                          </ul>
                        </Col>

                        <Col xs={12}>
                          {activeUserRole === "ADMIN" && (
                            <div className="p-3 rounded bg-white shadow-sm mt-2 border">
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

                          <div className="p-3 rounded bg-gradient-success text-white text-center mt-2">
                            <h6 className="mb-0 fw-bold">Total Price</h6>
                            <h4 className="mb-0">
                              {formatPrice(newTotal)} for{" "}
                              {pendingPayload.rooms.length}{" "}
                              {pendingPayload.rooms.length > 1
                                ? "rooms"
                                : "room"}
                            </h4>
                          </div>
                        </Col>
                      </Row>

                      <div className="mt-3 text-center">
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
                    Cancel
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
                      "Confirm"
                    )}
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
