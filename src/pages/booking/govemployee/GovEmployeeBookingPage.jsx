/**
 * GovEmployeeBookingPage.jsx
 *
 * Booking page for the gov-employee flow.
 *
 * Layout / UX mirrors /hotel-booking-page (HotelBookingPage.jsx):
 *  - Right-sticky Booking Summary + Price Details column.
 *  - Confirm Booking → fetches policies + T&C → consent modal →
 *    Proceed → order-summary modal → Confirm → spinner → POST.
 *  - Validation errors highlight fields on Confirm click.
 *  - Per-passenger "Lead" radio in the Guest Details grid replaces
 *    the separate Primary Guest card. The lead guest's name + the
 *    contact-info card (email / phone / passport / agent LPO) below
 *    are sent as the booking's primary-guest data.
 *
 * Gov-employee specifics preserved:
 *  - Government Employee Verification block (Employee Code OR
 *    Government ID Upload).
 *  - Standard / discounted price display (struck-through + new
 *    total in green when a discount is active).
 *  - POST /api/gov-employee-booking/create — the server re-applies
 *    the discount authoritatively, checks the agent credit limit,
 *    and decrements it.
 */

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaHotel,
  FaCalendarAlt,
  FaUsers,
  FaUtensils,
  FaIdBadge,
  FaFileUpload,
  FaArrowLeft,
  FaBed,
} from "react-icons/fa";
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  Accordion,
  Badge,
  Modal,
  Spinner,
} from "react-bootstrap";
import Sidebar from "../../../components/Sidebar";
import TopBar from "../../../components/TopBar";
import axiosInstance from "../../../components/AxiosInstance";
import { createAmendmentLink } from "../../../utils/amendmentLink";
import toast from "react-hot-toast";
import "../../../styles/HotelBookingPage.css";

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
  "Smoking Room",
];

const METHOD_CODE = "EMPLOYEE_CODE";
const METHOD_UPLOAD = "GOVT_ID_UPLOAD";

const formatDateTime = (dateStr) => {
  if (!dateStr) return "-";
  // Accept either "YYYY-MM-DD" or full ISO; render as "YYYY-MM-DD"
  // so the summary matches HotelBookingPage's style.
  const s = String(dateStr);
  if (s.length >= 10) return s.slice(0, 10);
  return s;
};

const GovEmployeeBookingPage = () => {
  const navigate = useNavigate();
  const activeUserRole = localStorage.getItem("currentActiveRole");

  // ── State pulled from sessionStorage (set by GovEmployeeRoomList) ─
  const [bookingData, setBookingData] = useState(null);
  const [agentAvailableBalance, setAgentAvailableBalance] = useState(null);

  // ── Per-room guest details (one row per adult / child) ──────────
  const [rooms, setRooms] = useState([]);

  // ── Lead passenger marker — { roomIdx, guestIdx } pointing at the
  //    single guest the user has flagged as Lead. Replaces the
  //    separate Primary Guest card.
  const [leadIndex, setLeadIndex] = useState({ roomIdx: 0, guestIdx: 0 });

  // ── Contact info for the lead guest — the name fields come from
  //    the guest grid itself; only email / phone / passport / agent
  //    LPO live here.
  const [contactInfo, setContactInfo] = useState({
    email: "",
    phone: "",
    passportNo: "",
    agentLpo: "",
  });

  // Remarks + special requests.
  // "Booking Done By Employee" was moved to GovEmployeeSearch — the
  // chosen employeeId now arrives on bookingData.payload.employeeId
  // and is read straight into the create payload below.
  const [remarks, setRemarks] = useState("");
  const [specialRequests, setSpecialRequests] = useState([]);
  // Payment Mode — defaults to Credit Limit; rides on the create payload
  // (same field as StudentBookingPage / SeniorCitizenBookingPage). Only
  // Credit Limit / Cash / Card are exposed per business decision.
  const [paymentMode, setPaymentMode] = useState("CREDITLIMIT");

  // ── Government employee verification block ──────────────────────
  const [verificationMethod, setVerificationMethod] = useState(METHOD_CODE);
  const [govEmployeeCode, setGovEmployeeCode] = useState("");
  const [govEmployeeName, setGovEmployeeName] = useState("");
  const [govEmployeeDepartment, setGovEmployeeDepartment] = useState("");
  const [idFile, setIdFile] = useState(null);
  const [uploadedFilePath, setUploadedFilePath] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [uploading, setUploading] = useState(false);

  // ── Submission state ────────────────────────────────────────────
  const [validationErrors, setValidationErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingPayload, setPendingPayload] = useState(null);

  // ── Voucher-choice + booking-flow status (mirrors HotelBookingPage) ──
  // Refundable + Available rate with a still-upcoming deadline → surface
  // the "Book Now & Voucher Now" / "Book Now & Voucher Later" choice
  // above the Confirm Booking button. Non-refundable / on-request / past-
  // deadline flows skip the choice and resolve to Reconfirmed.
  const [bookingConfirmation, setBookingConfirmation] = useState("Book & Voucher");
  const [voucherChoiceMade, setVoucherChoiceMade] = useState(false);
  const [voucherChoiceError, setVoucherChoiceError] = useState(false);

  // ── Policy + T&C consent flow (mirrors HotelBookingPage) ────────
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [policyData, setPolicyData] = useState(null);
  const [termsAndConditions, setTermsAndConditions] = useState("");
  const [policiesLoading, setPoliciesLoading] = useState(false);
  const [policyAccepted, setPolicyAccepted] = useState(false);

  // ── Load bookingData from sessionStorage ────────────────────────
  useEffect(() => {
    const stored = sessionStorage.getItem("govEmployeeBookingData");
    if (!stored) return;
    const parsed = JSON.parse(stored);
    setBookingData(parsed);
    const payloadRooms = parsed?.payload?.rooms || [];
    setRooms(
      payloadRooms.map((room) => ({
        ...room,
        guests: Array.from(
          { length: (room.adults || 0) + (room.children || 0) },
          (_, i) => ({
            salutation: "",
            firstName: "",
            middleName: "",
            lastName: "",
            gender: "",
            isChild: i >= (room.adults || 0),
          }),
        ),
      })),
    );
  }, []);

  // Employee list fetch removed — "Booking Done By Employee" is now
  // selected on GovEmployeeSearch and travels here on
  // bookingData.payload.employeeId.

  // ── Agent credit balance ───────────────────────────────────────
  useEffect(() => {
    const aId = bookingData?.payload?.agentId;
    if (!aId) {
      setAgentAvailableBalance(null);
      return;
    }
    let cancelled = false;
    axiosInstance
      .get(`/api/agent-credit-limit/agent/${aId}`)
      .then((res) => {
        if (!cancelled)
          setAgentAvailableBalance(res?.data?.availableCreditLimit ?? null);
      })
      .catch(() => {
        if (!cancelled) setAgentAvailableBalance(null);
      });
    return () => {
      cancelled = true;
    };
  }, [bookingData]);

  // ── Guest input handlers ────────────────────────────────────────
  const handleGuestChange = (roomIndex, guestIndex, field, value) => {
    setRooms((prev) => {
      const next = [...prev];
      next[roomIndex] = {
        ...next[roomIndex],
        guests: next[roomIndex].guests.map((g, i) =>
          i === guestIndex ? { ...g, [field]: value } : g,
        ),
      };
      return next;
    });
    const k = `room_${roomIndex}_guest_${guestIndex}_${field}`;
    if (validationErrors[k]) {
      setValidationErrors((e) => {
        const n = { ...e };
        delete n[k];
        return n;
      });
    }
  };

  // Children can't be the lead — silently ignore the change.
  const handleLeadSelect = (roomIdx, guestIdx) => {
    const g = rooms[roomIdx]?.guests[guestIdx];
    if (g?.isChild) return;
    setLeadIndex({ roomIdx, guestIdx });
  };

  const handleContactChange = (field, value) => {
    setContactInfo((p) => ({ ...p, [field]: value }));
    if (validationErrors[field]) {
      setValidationErrors((e) => {
        const n = { ...e };
        delete n[field];
        return n;
      });
    }
  };

  const toggleSpecialRequest = (req) => {
    setSpecialRequests((prev) =>
      prev.includes(req) ? prev.filter((r) => r !== req) : [...prev, req],
    );
  };

  // ── File upload for govt-ID method ─────────────────────────────
  const onFileChange = (e) => {
    setIdFile(e.target.files?.[0] || null);
    setUploadedFilePath("");
    setUploadedFileName("");
  };
  const handleUpload = async () => {
    if (!idFile) {
      toast.error("Please choose a file first");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", idFile);
      const { data } = await axiosInstance.post(
        "/api/gov-employee-id-upload",
        fd,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      if (data?.success) {
        setUploadedFilePath(data.filePath);
        setUploadedFileName(data.fileName);
        toast.success("Document uploaded");
      } else {
        toast.error(data?.message || "Upload failed");
      }
    } catch (e) {
      toast.error(e?.response?.data?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  // ── Helpers ────────────────────────────────────────────────────
  // Display currency carried from the search/room-list (rates are AED; this
  // converts them for display only — the create payload stays AED). AED → 1.
  const formatPrice = (price) => {
    const cur = bookingData?.searchCtx?.currency || { code: "AED", factor: 1 };
    const code = cur.code || "AED";
    const factor = Number(cur.factor) > 0 ? Number(cur.factor) : 1;
    return `${code} ${((Number(price) || 0) * factor).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // ────────────────────────────────────────────────────────────────
  // Booking-flow derivation — mirrors HotelBookingPage's confirm-booking
  // flowchart. Gov-employee stores the workflow state in
  // `confirmationStatus` ("Confirmed" / "ReConfirmed") rather than the
  // uppercase BookingStatus enum, so the resolved strings we send match
  // that title-case convention. The deadline is the check-in date
  // (end-of-day, matching how the page has always stored it in
  // `deadlineDate`) — no separate maxCancellationNights lookup needed.
  // ────────────────────────────────────────────────────────────────
  const isOnRequestRate =
    bookingData?.selectedRate?.roomStatus === "On Request";
  const isNonRefundableRate =
    bookingData?.selectedRate?.nonRefundable === true ||
    bookingData?.selectedRate?.nonRefundable === "true";
  const cancellationDeadline = (() => {
    const cinRaw = bookingData?.payload?.checkInDate;
    if (!cinRaw) return null;
    const cin = new Date(cinRaw);
    if (isNaN(cin.getTime())) return null;
    const deadline = new Date(cin);
    deadline.setHours(0, 0, 0, 0);
    return deadline;
  })();
  const isOutsideDeadline = (() => {
    if (!cancellationDeadline) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today > cancellationDeadline;
  })();
  // Only Available + refundable rates whose deadline is still upcoming
  // get the choice. Every other case skips the card and resolves to
  // ReConfirmed automatically.
  const showVoucherChoice =
    !isOnRequestRate &&
    !isNonRefundableRate &&
    !!cancellationDeadline &&
    !isOutsideDeadline;
  // Resolved confirmationStatus that travels to the backend.
  //   • Non-refundable        → ReConfirmed
  //   • Deadline already past → ReConfirmed (force Voucher Now)
  //   • Within deadline       → respect the radio pick
  //       - "Book Now & Voucher later" → Confirmed
  //       - otherwise                  → ReConfirmed
  const resolvedConfirmationStatus = (() => {
    if (isNonRefundableRate) return "ReConfirmed";
    if (isOutsideDeadline) return "ReConfirmed";
    return bookingConfirmation === "Book Now & Voucher later"
      ? "Confirmed"
      : "ReConfirmed";
  })();
  // Reset the choice whenever it no longer applies (guard against stale
  // picks bleeding into the payload).
  useEffect(() => {
    if (!bookingData?.selectedRate) return;
    if (!showVoucherChoice && bookingConfirmation !== "Book & Voucher") {
      setBookingConfirmation("Book & Voucher");
    }
    if (!showVoucherChoice && voucherChoiceMade) {
      setVoucherChoiceMade(false);
      setVoucherChoiceError(false);
    }
  }, [bookingData, bookingConfirmation, showVoucherChoice, voucherChoiceMade]);

  // ── Validation ─────────────────────────────────────────────────
  // Per spec: the Confirm Booking button is always enabled — pressing
  // it runs validation and surfaces missing-field errors inline so the
  // user knows exactly what's wrong. The verification block (employee
  // code OR uploaded govt-ID) is validated here too instead of gating
  // the button.
  const validateForm = () => {
    const errors = {};

    // Verification block
    if (verificationMethod === METHOD_CODE) {
      if (!govEmployeeCode.trim()) {
        errors.govEmployeeCode = "Government Employee Code is required";
      }
    } else if (verificationMethod === METHOD_UPLOAD) {
      if (!uploadedFilePath) {
        errors.govtIdFile = "Please upload the government ID document";
      }
    }

    rooms.forEach((room, ri) => {
      room.guests.forEach((g, gi) => {
        const k = `room_${ri}_guest_${gi}`;
        if (!g.salutation) errors[`${k}_salutation`] = "Required";
        if (!g.firstName) errors[`${k}_firstName`] = "Required";
        if (!g.lastName) errors[`${k}_lastName`] = "Required";
        
      });
    });

    // Lead must point at a real, adult guest.
    const lead = rooms[leadIndex.roomIdx]?.guests[leadIndex.guestIdx];
    if (!lead) {
      errors.lead = "Please mark a guest as Lead";
    } else if (lead.isChild) {
      errors.lead = "The lead must be an adult";
    }

    return { errors, hasErrors: Object.keys(errors).length > 0 };
  };

  // ── Step 1: Confirm Booking → validate + fetch policies + open
  //            T&C consent modal. Mirrors HotelBookingPage.
  const openPolicyConsent = async () => {
    // Validation only — no button disabling. Errors are surfaced
    // inline (red borders + helper text) so the user can see exactly
    // which mandatory field is missing.
    const { errors, hasErrors } = validateForm();
    if (hasErrors) {
      setValidationErrors(errors);
      toast.error("Please complete the highlighted fields");
      return;
    }
    // Voucher-choice gate — mirrors HotelBookingPage. When the Voucher
    // Now / Later choice is shown, the user must pick one explicitly
    // before we can proceed to the policies / confirm modal.
    if (showVoucherChoice && !voucherChoiceMade) {
      setVoucherChoiceError(true);
      toast.error("Please select a booking option to continue.");
      return;
    }
    setValidationErrors({});

    const hotelId =
      bookingData?.selectedRate?.hotelId ||
      bookingData?.searchCtx?.hotelCode ||
      null;

    setPolicyAccepted(false);
    setShowPolicyModal(true);
    setPoliciesLoading(true);

    try {
      const calls = hotelId
        ? [
            axiosInstance.get(`/api/hotels/${hotelId}/policies`),
            axiosInstance.get(`/api/hotels/${hotelId}/terms-and-conditions`),
          ]
        : [Promise.resolve({ data: null }), Promise.resolve({ data: "" })];
      const [policiesRes, termsRes] = await Promise.allSettled(calls);

      setPolicyData(
        policiesRes.status === "fulfilled"
          ? policiesRes.value?.data || null
          : null,
      );

      if (termsRes.status === "fulfilled") {
        const d = termsRes.value?.data;
        let tc = "";
        if (Array.isArray(d)) {
          tc = d
            .map((row) =>
              typeof row === "string" ? row : row?.description || "",
            )
            .filter(Boolean)
            .join("\n\n");
        } else if (typeof d === "string") {
          tc = d;
        } else {
          tc =
            d?.termsAndConditions || d?.terms || d?.data || d?.message || "";
        }
        setTermsAndConditions(tc);
      } else {
        setTermsAndConditions("");
      }
    } catch (err) {
      console.error("policies/T&C fetch error", err);
    } finally {
      setPoliciesLoading(false);
    }
  };

  // ── Step 2: build payload + open the order-summary confirm modal.
  const handleSubmit = (e) => {
    e?.preventDefault?.();

    const { errors, hasErrors } = validateForm();
    if (hasErrors) {
      setValidationErrors(errors);
      toast.error("Please complete the highlighted fields");
      return;
    }
    setValidationErrors({});

    const { selectedRate, hotelStaticData, payload, activePromotion, searchCtx } =
      bookingData;
    const ci = new Date(payload.checkInDate);
    const co = new Date(payload.checkOutDate);
    const nights = Math.max(1, Math.round((co - ci) / 86400000));

    // Per-room rate breakdown.
    //
    // Multi-room aware: when GovEmployeeRoomList sent a per-room
    // `roomBreakdown` array (one entry per booked room), each room
    // pulls its OWN roomCategory / mealPlan / rate / etc. from that
    // slot — so the DB receives real per-room rates. Without
    // `roomBreakdown` (every legacy single-room flow), `slot` falls
    // back to the combined `selectedRate` and behaves exactly as
    // before — so no other flow is affected.
    const allRooms = (rooms || []).map((room, idx) => {
      const slot = bookingData.roomBreakdown?.[idx] || selectedRate;
      return {
        roomNo: idx + 1,
        roomCategory: slot.roomCategory,
        mealPlan: slot.mealPlan,
        nonRefundable: !!slot.nonRefundable,
        rate: Number(slot.rate || 0),
        rateBeforeDiscount: Number(
          slot.rateBeforeDiscount || slot.rate || 0,
        ),
        rateWithoutMarkup: Number(slot.rate || 0),
        adults: room.adults,
        children: room.children,
        childAges: room.childAges || [],
        currency: slot.currency || "AED",
        guests: (room.guests || []).map((g, gi) => ({
          salutation: g.salutation,
          firstName: g.firstName,
          middleName: g.middleName || "",
          lastName: g.lastName,
          gender: g.gender,
          isChild: !!g.isChild,
          // Mark the lead guest so the backend knows who the primary
          // contact is on the booking.
          isLead:
            idx === leadIndex.roomIdx && gi === leadIndex.guestIdx,
        })),
      };
    });

    // Derive the primary-guest block from the lead guest + the
    // contact-info card. Keeps the backend contract from the previous
    // version of this page intact.
    const leadGuest =
      rooms[leadIndex.roomIdx]?.guests[leadIndex.guestIdx] || {};
    const primaryGuest = {
      salutation: leadGuest.salutation || "",
      firstName: leadGuest.firstName || "",
      middleName: leadGuest.middleName || "",
      lastName: leadGuest.lastName || "",
      email: contactInfo.email,
      phone: contactInfo.phone,
      passportNo: contactInfo.passportNo,
      agentLpo: contactInfo.agentLpo,
      nativeCountry: "",
    };

    const built = {
      agentId: String(payload.agentId || searchCtx?.agentId || ""),
      apiId: String(payload.apiId || searchCtx?.apiId || 1),
      hotelId: String(
        selectedRate.hotelId || searchCtx?.hotelCode || "",
      ),
      hotelName: hotelStaticData.hotelName,
      address: hotelStaticData.address,
      starRating: hotelStaticData.starRating,
      checkInDate: payload.checkInDate,
      checkOutDate: payload.checkOutDate,
      // Cancellation deadline = end of the check-in day (mirrors senior flow);
      // shown on the confirm modal + the booking detail view.
      deadlineDate: payload.checkInDate
        ? `${String(payload.checkInDate).slice(0, 10)}T23:59:59`
        : null,
      nights,
      primaryGuest,
      rooms: allRooms,
      remarks,
      specialRequests,
      paymentMode,
      // ── Booking-flow status inputs (mirror HotelBookingPage) ──
      // The frontend has already decided the target confirmationStatus
      // based on refundability + deadline + Voucher choice. Backend
      // trusts these directly instead of re-deriving them.
      bookingConfirmation: bookingConfirmation || "Book & Voucher",
      confirmationStatus: resolvedConfirmationStatus,
      isBookandVoucher:
        !isNonRefundableRate && bookingConfirmation === "Book & Voucher",
      isOutsideDeadline,
      source: "WEB",
      createdByRole: activeUserRole || "agent",
      verificationMethod,
      govEmployeeCode:
        verificationMethod === METHOD_CODE ? govEmployeeCode.trim() : null,
      govtIdFilePath:
        verificationMethod === METHOD_UPLOAD ? uploadedFilePath : null,
      govtIdFileName:
        verificationMethod === METHOD_UPLOAD ? uploadedFileName : null,
      govEmployeeName: govEmployeeName.trim() || null,
      govEmployeeDepartment: govEmployeeDepartment.trim() || null,
      discountPercent: activePromotion?.discountPercent ?? null,
      discountAmount: activePromotion?.discountAmount ?? null,
      totalRateBeforeDiscount: allRooms.reduce(
        (s, r) => s + Number(r.rateBeforeDiscount || 0),
        0,
      ),
      // employeeId is picked in GovEmployeeSearch and rides on
      // bookingData.payload — backend stamps the Employee relation.
      employeeId: bookingData?.payload?.employeeId || null,
      // Display currency chosen on the search page. `displayCurrencyRate` is
      // the AED→target factor; the total stays AED and the backend stores the
      // code + converted amount. AED → factor 1.
      displayCurrencyCode: bookingData?.searchCtx?.currency?.code || "AED",
      displayCurrencyRate:
        Number(bookingData?.searchCtx?.currency?.factor) > 0
          ? Number(bookingData.searchCtx.currency.factor)
          : 1,
    };

    setPendingPayload(built);
    setShowConfirmModal(true);
  };

  // ── Step 3: Confirm modal → POST + spinner ─────────────────────
  const confirmBooking = async () => {
    if (!pendingPayload) return;
    setIsSubmitting(true);
    try {
      const { data } = await axiosInstance.post(
        "/api/gov-employee-booking/create",
        pendingPayload,
      );
      if (data?.success) {
        setShowConfirmModal(false);
        toast.success(`Booking ${data.bookingCode} created`);
        // "Add New Item" amendment flow: link to the parent hotel booking and
        // return to its detail page; otherwise keep the normal list redirect.
        const parentBookingCode = bookingData?.payload?.parentBookingCode;
        if (parentBookingCode) {
          const parentId = await createAmendmentLink({
            parentBookingCode,
            childType: "GOV_EMPLOYEE",
            childTypeLabel: "Government Employee",
            childBookingId: data.bookingId,
            childBookingCode: data.bookingCode,
            childDetailRoutePrefix: "/booking-details/gov-employee-booking/",
            childReferenceNumber: data.referenceNumber || data.bookingCode,
            childStatus: data.confirmationStatus || data.status || "Confirmed",
            childHotelName: pendingPayload.hotelName,
            childCheckInDate: pendingPayload.checkInDate,
            childCheckOutDate: pendingPayload.checkOutDate,
            childTotalRate: pendingPayload.totalRateBeforeDiscount,
            childGuestName: `${pendingPayload.primaryGuest?.firstName || ""} ${
              pendingPayload.primaryGuest?.lastName || ""
            }`.trim(),
          });
          if (parentId) {
            navigate(`/booking-details/hotel-booking/${parentId}`);
            return;
          }
        }
        navigate("/booking-details/gov-employee-booking-list");
      } else {
        toast.error(data?.message || "Booking failed");
      }
    } catch (e) {
      console.error("[gov-employee] booking failed:", e);
      toast.error(e?.response?.data?.message || "Booking failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!bookingData) {
    return (
      <div className="min-vh-100 bg-light d-flex flex-column">
        <TopBar />
        <div className="d-flex flex-grow-1">
          <Sidebar />
          <main className="flex-grow-1 d-flex justify-content-center align-items-center">
            <div className="text-muted">Loading booking data…</div>
          </main>
        </div>
      </div>
    );
  }

  const { hotelStaticData, payload, selectedRate, activePromotion } =
    bookingData;
  // Multi-room aware: when `roomBreakdown` is present the combined
  // `selectedRate.rate` is ALREADY the sum across all rooms.
  // Multiplying again by `rooms.length` would double-count. Sum
  // per-room values directly instead. Legacy single-room flows keep
  // `selectedRate.X × rooms.length`, which equals `selectedRate.X`
  // when there is one room.
  const totalBefore = bookingData.roomBreakdown?.length
    ? bookingData.roomBreakdown.reduce(
        (s, r) => s + Number(r.rateBeforeDiscount || r.rate || 0),
        0,
      )
    : Number(selectedRate.rateBeforeDiscount || 0) * (rooms.length || 1);
  const totalAfter = bookingData.roomBreakdown?.length
    ? bookingData.roomBreakdown.reduce((s, r) => s + Number(r.rate || 0), 0)
    : Number(selectedRate.rate || 0) * (rooms.length || 1);

  return (
    <div className="min-vh-100 bg-light d-flex flex-column hotel-booking-container">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main
          className="content-wrapper py-3 flex-grow-1"
          style={{ minWidth: 0, overflowX: "hidden" }}
        >
          <Container fluid="xl">
            {/* Top action bar — Back to Room List + Available Balance.
                Using navigate(-1) preserves the room-list page's
                in-memory state (selected dates, agent, occupancy)
                instead of remounting it fresh. */}
            <div className="d-flex justify-content-between align-items-center mb-2">
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => navigate(-1)}
                title="Back to Room List"
              >
                <FaArrowLeft className="me-2" />
                Back to Room List
              </Button>
              {agentAvailableBalance != null && (
                <span
                  className="fw-bold"
                  style={{ color: "#dc3545", fontSize: "0.95rem" }}
                >
                  Available Balance:{" "}
                  {Number(agentAvailableBalance).toFixed(2)}
                </span>
              )}
            </div>

            <Form onSubmit={(e) => e.preventDefault()}>
              <Row>
                {/* ─────────── Left main column ─────────── */}
                <Col lg={8}>
                  {/* Government Employee Verification block */}
                  <Card className="mb-2 shadow-sm border-0">
                    <Card.Header className="bg-primary text-white py-2">
                      <h6 className="mb-0 fw-bold d-flex align-items-center">
                        <FaIdBadge className="me-2" /> Government Employee
                        Verification
                      </h6>
                    </Card.Header>
                    <Card.Body className="p-2">
                      <div className="d-flex gap-4 mb-2">
                        <Form.Check
                          type="radio"
                          id="vm-code"
                          name="verificationMethod"
                          label="Employee Code"
                          checked={verificationMethod === METHOD_CODE}
                          onChange={() => setVerificationMethod(METHOD_CODE)}
                        />
                        <Form.Check
                          type="radio"
                          id="vm-upload"
                          name="verificationMethod"
                          label="Government ID Upload"
                          checked={verificationMethod === METHOD_UPLOAD}
                          onChange={() => setVerificationMethod(METHOD_UPLOAD)}
                        />
                      </div>

                      {verificationMethod === METHOD_CODE && (
                        <Row className="g-3">
                          <Col md={6}>
                            <Form.Label className="fw-semibold">
                              Government Employee Code *
                            </Form.Label>
                            <Form.Control
                              placeholder="e.g. GOV-1001"
                              isInvalid={!!validationErrors.govEmployeeCode}
                              value={govEmployeeCode}
                              onChange={(e) => {
                                setGovEmployeeCode(e.target.value);
                                if (validationErrors.govEmployeeCode) {
                                  setValidationErrors((errs) => {
                                    const n = { ...errs };
                                    delete n.govEmployeeCode;
                                    return n;
                                  });
                                }
                              }}
                            />
                            {validationErrors.govEmployeeCode && (
                              <Form.Control.Feedback type="invalid">
                                {validationErrors.govEmployeeCode}
                              </Form.Control.Feedback>
                            )}
                          </Col>
                        </Row>
                      )}

                      {verificationMethod === METHOD_UPLOAD && (
                        <Row className="g-3 align-items-end">
                          <Col md={6}>
                            <Form.Label className="fw-semibold">
                              Government ID Document *
                            </Form.Label>
                            <Form.Control
                              type="file"
                              accept=".pdf,.png,.jpg,.jpeg"
                              isInvalid={!!validationErrors.govtIdFile}
                              onChange={(e) => {
                                onFileChange(e);
                                if (validationErrors.govtIdFile) {
                                  setValidationErrors((errs) => {
                                    const n = { ...errs };
                                    delete n.govtIdFile;
                                    return n;
                                  });
                                }
                              }}
                            />
                            {validationErrors.govtIdFile ? (
                              <Form.Control.Feedback type="invalid">
                                {validationErrors.govtIdFile}
                              </Form.Control.Feedback>
                            ) : (
                              <Form.Text className="text-muted">
                                PDF, PNG or JPG. Max ~5 MB.
                              </Form.Text>
                            )}
                          </Col>
                          <Col md={3}>
                            <Button
                              variant="outline-primary"
                              onClick={handleUpload}
                              disabled={!idFile || uploading}
                            >
                              {uploading ? (
                                <Spinner size="sm" />
                              ) : (
                                <>
                                  <FaFileUpload className="me-1" /> Upload
                                </>
                              )}
                            </Button>
                          </Col>
                          <Col md={3}>
                            {uploadedFilePath ? (
                              <Badge bg="success" className="p-2">
                                ✓ Uploaded: {uploadedFileName}
                              </Badge>
                            ) : idFile ? (
                              <span className="text-muted small">
                                Click Upload to save
                              </span>
                            ) : null}
                          </Col>
                        </Row>
                      )}

                      <Row className="g-2 mt-1">
                        <Col md={6}>
                          <Form.Label>Employee Name (optional)</Form.Label>
                          <Form.Control
                            value={govEmployeeName}
                            onChange={(e) =>
                              setGovEmployeeName(e.target.value)
                            }
                          />
                        </Col>
                        <Col md={6}>
                          <Form.Label>Department (optional)</Form.Label>
                          <Form.Control
                            value={govEmployeeDepartment}
                            onChange={(e) =>
                              setGovEmployeeDepartment(e.target.value)
                            }
                          />
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>

                  {/* Per-room guest details with Lead radio per row */}
                  <Card className="mb-2 shadow-sm border-0">
                    <Card.Header className="bg-light py-2">
                      <h6 className="mb-0 fw-bold text-dark">
                        Guest Details
                      </h6>
                      {validationErrors.lead && (
                        <small className="text-danger d-block mt-1">
                          {validationErrors.lead}
                        </small>
                      )}
                    </Card.Header>
                    <Card.Body className="p-0">
                      <Accordion defaultActiveKey="0" alwaysOpen>
                        {rooms.map((room, roomIndex) => (
                          <Accordion.Item
                            key={roomIndex}
                            eventKey={String(roomIndex)}
                          >
                            <Accordion.Header>
                              <span className="fw-bold">
                                {/* Per-room label from roomBreakdown when
                                    present (multi-room flow); else the
                                    combined selectedRate (legacy single-room).
                                    Shows room category + meal plan, matching
                                    the booking summary. */}
                                {(() => {
                                  const slot =
                                    bookingData.roomBreakdown?.[roomIndex] ||
                                    selectedRate;
                                  const cat = slot.roomCategory || "—";
                                  const meal = slot.mealPlan;
                                  return `Room ${roomIndex + 1} — ${cat}${
                                    meal ? ` · ${meal}` : ""
                                  }`;
                                })()}
                              </span>
                            </Accordion.Header>
                            <Accordion.Body className="p-3">
                              {/* Column headers — match the screenshot
                                  the user referenced: Room # | Title |
                                  First Name | Surname | Gender | Lead. */}
                              <Row className="fw-semibold small text-muted px-2 mb-1 d-none d-md-flex">
                                <Col md={2}>Passenger</Col>
                                <Col md={2}>Title *</Col>
                                <Col md={3}>First Name *</Col>
                                <Col md={3}>Surname *</Col>
                                <Col md={2} className="text-center">
                                  Lead
                                </Col>
                              </Row>
                              {room.guests.map((guest, guestIndex) => {
                                const k = `room_${roomIndex}_guest_${guestIndex}`;
                                const isLead =
                                  leadIndex.roomIdx === roomIndex &&
                                  leadIndex.guestIdx === guestIndex;
                                return (
                                  <Row
                                    key={guestIndex}
                                    className="align-items-center g-2 mb-2"
                                  >
                                    <Col md={2}>
                                      <span className="fw-semibold text-muted">
                                        {guest.isChild
                                          ? `Child ${
                                              guestIndex - room.adults + 1
                                            }`
                                          : `Adult ${guestIndex + 1}`}
                                      </span>
                                    </Col>
                                    <Col md={2}>
                                      <Form.Select
                                        isInvalid={
                                          !!validationErrors[`${k}_salutation`]
                                        }
                                        value={guest.salutation}
                                        onChange={(e) =>
                                          handleGuestChange(
                                            roomIndex,
                                            guestIndex,
                                            "salutation",
                                            e.target.value,
                                          )
                                        }
                                      >
                                        <option value="">Title</option>
                                        <option>Mr</option>
                                        <option>Mrs</option>
                                        <option>Ms</option>
                                        <option>Dr</option>
                                      </Form.Select>
                                    </Col>
                                    <Col md={3}>
                                      <Form.Control
                                        placeholder="First Name"
                                        isInvalid={
                                          !!validationErrors[`${k}_firstName`]
                                        }
                                        value={guest.firstName}
                                        onChange={(e) =>
                                          handleGuestChange(
                                            roomIndex,
                                            guestIndex,
                                            "firstName",
                                            e.target.value,
                                          )
                                        }
                                      />
                                    </Col>
                                    <Col md={3}>
                                      <Form.Control
                                        placeholder="Surname"
                                        isInvalid={
                                          !!validationErrors[`${k}_lastName`]
                                        }
                                        value={guest.lastName}
                                        onChange={(e) =>
                                          handleGuestChange(
                                            roomIndex,
                                            guestIndex,
                                            "lastName",
                                            e.target.value,
                                          )
                                        }
                                      />
                                    </Col>
                                    {/* Gender column hidden by
                                        request. State `guest.gender`
                                        keeps its default empty
                                        string. */}
                                    <Col md={2} className="text-center">
                                      {/* Lead radio — only adults can be
                                          lead. Disabled+greyed for children
                                          so the row still aligns. */}
                                      <Form.Check
                                        type="radio"
                                        name="lead-guest"
                                        id={`lead-${roomIndex}-${guestIndex}`}
                                        checked={isLead}
                                        disabled={guest.isChild}
                                        onChange={() =>
                                          handleLeadSelect(
                                            roomIndex,
                                            guestIndex,
                                          )
                                        }
                                        title={
                                          guest.isChild
                                            ? "Children cannot be the lead"
                                            : "Mark as Lead passenger"
                                        }
                                      />
                                    </Col>
                                  </Row>
                                );
                              })}
                            </Accordion.Body>
                          </Accordion.Item>
                        ))}
                      </Accordion>
                    </Card.Body>
                  </Card>

                  {/* Contact Details card hidden per spec — the lead
                      guest's name fields (from the Guest Details grid
                      above) are sent as the primary-guest data; the
                      contact channels (email / phone / passport / agent
                      LPO) ride along as empty strings until the
                      operator decides to capture them. */}

                  {/* Special Requests (Remarks textarea hidden by
                      request — state `remarks` keeps its default
                      empty string). */}
                  <Card className="p-2 mb-2 shadow-sm border-0">
                    <h6 className="mb-2 fw-bold text-primary">
                      Special Requests
                    </h6>
                    <div className="mb-2 d-flex flex-wrap gap-2">
                      {SPECIAL_REQUEST_OPTIONS.map((req) => (
                        <Form.Check
                          key={req}
                          type="checkbox"
                          id={`sr-${req}`}
                          label={req}
                          checked={specialRequests.includes(req)}
                          onChange={() => toggleSpecialRequest(req)}
                        />
                      ))}
                    </div>
                  </Card>

                  {/* Payment Mode — mirrors HotelBookingPage /
                      StudentBookingPage / SeniorCitizenBookingPage. Rides
                      on the create payload. Only Credit Limit / Cash /
                      Card are exposed per business decision. */}
                  <Card className="p-3 mb-2 shadow-sm border-0">
                    <h6 className="mb-2 fw-bold text-primary">Payment Mode</h6>
                    <Row className="g-3">
                      <Col md={6}>
                        <Form.Group>
                          <Form.Label className="fw-semibold mb-1">Mode</Form.Label>
                          <Form.Select
                            value={paymentMode}
                            onChange={(e) => setPaymentMode(e.target.value)}
                          >
                            <option value="CREDITLIMIT">Credit Limit</option>
                            <option value="CASH">Cash</option>
                            <option value="CARD">Card</option>
                          </Form.Select>
                        </Form.Group>
                      </Col>
                    </Row>
                  </Card>

                  {/* "Booking Done By Employee" was moved into the
                      GovEmployeeSearch criteria (optional). The chosen
                      employeeId now rides on bookingData.payload and is
                      sent to /api/gov-employee-booking/create from there. */}
                </Col>

                {/* ─────────── Right sticky summary column ─────────── */}
                <Col lg={4} className="hbp-right-col">
                  <div className="hbp-sticky-summary">
                    <Card className="shadow-sm rounded-3 mb-2 booking-summary-card border-0 overflow-hidden">
                      <Card.Header className="bg-primary text-white py-2 rounded-top">
                        <h6 className="mb-0 d-flex align-items-center">
                          <FaHotel className="me-2" /> Booking Summary
                        </h6>
                      </Card.Header>
                      <Card.Body className="p-2">
                        <div className="mb-2">
                          <div className="fw-bold text-primary mb-1">
                            {hotelStaticData.hotelName}
                          </div>
                          <div className="text-muted small mb-2">
                            {hotelStaticData.address}
                          </div>
                          <div className="d-flex flex-wrap align-items-center gap-2">
                            <span className="badge bg-warning text-dark">
                              ⭐ {hotelStaticData.starRating} Star
                            </span>
                            {selectedRate?.nonRefundable !== undefined && (
                              <Badge
                                bg={
                                  selectedRate.nonRefundable === true ||
                                  selectedRate.nonRefundable === "true"
                                    ? "danger"
                                    : "success"
                                }
                              >
                                {selectedRate.nonRefundable === true ||
                                selectedRate.nonRefundable === "true"
                                  ? "Non-Refundable"
                                  : "Flexible"}
                              </Badge>
                            )}
                            {activePromotion && (
                              <Badge
                                bg="success"
                                className="d-inline-flex align-items-center"
                              >
                                <FaIdBadge className="me-1" /> Gov Discount
                                {activePromotion.discountPercent
                                  ? ` ${activePromotion.discountPercent}%`
                                  : ""}
                                {activePromotion.discountAmount
                                  ? ` + ${activePromotion.discountAmount}`
                                  : ""}
                              </Badge>
                            )}
                          </div>
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
                            <FaBed className="me-2 text-primary" />
                            Room
                          </div>
                          <div className="hbp-summary-value text-end">
                            {payload.rooms.map((room, i) => {
                              const slot =
                                bookingData.roomBreakdown?.[i] || selectedRate;
                              return (
                                <div key={i} className="small">
                                  {payload.rooms.length > 1 ? `Room ${i + 1}: ` : ""}
                                  {slot.roomCategory || "—"}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <div className="hbp-summary-row align-items-start">
                          <div className="hbp-summary-label">
                            <FaUtensils className="me-2 text-primary" />
                            Meal Plan
                          </div>
                          <div className="hbp-summary-value text-end">
                            {payload.rooms.map((room, i) => {
                              const slot =
                                bookingData.roomBreakdown?.[i] || selectedRate;
                              return (
                                <div key={i} className="small">
                                  {slot.mealPlan || "—"}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </Card.Body>
                    </Card>

                    <Card className="shadow-sm rounded-3 border-0 hbp-price-card">
                      <Card.Header className="bg-light py-2">
                        <h6 className="mb-0 fw-bold">Price Details</h6>
                      </Card.Header>
                      <Card.Body className="p-2">
                        {activePromotion && totalBefore !== totalAfter && (
                          <div className="hbp-summary-row">
                            <div className="hbp-summary-label">
                              Standard Total
                            </div>
                            <div className="hbp-summary-value text-decoration-line-through text-muted">
                              {formatPrice(totalBefore)}
                            </div>
                          </div>
                        )}
                        <div className="hbp-summary-row">
                          <div className="hbp-summary-label">Rate</div>
                          <div className="hbp-summary-value">
                            {formatPrice(selectedRate.rate || 0)} ×{" "}
                            {rooms.length || 1}
                          </div>
                        </div>
                        <hr className="my-2" />
                        <div className="hbp-summary-row fw-bold">
                          <div className="hbp-summary-label text-danger">
                            New Total
                            {activePromotion ? " (after Gov discount)" : ""}
                          </div>
                          <div className="hbp-summary-value text-danger">
                            {formatPrice(totalAfter)}
                          </div>
                        </div>
                      </Card.Body>
                    </Card>

                    {/* Voucher-choice card — mirrors HotelBookingPage.
                        Shown only when the rate is Available + refundable
                        AND the deadline hasn't passed. Non-refundable /
                        on-request / past-deadline flows skip it and
                        resolve to ReConfirmed automatically. */}
                    {showVoucherChoice && (
                      <Card className="shadow-sm rounded-3 border-0 mt-3">
                        <Card.Body className="p-3">
                          <Form.Group className="mb-0">
                            <Form.Label className="mb-2 fw-semibold">
                              Are you sure to continue booking?
                            </Form.Label>
                            <div className="d-flex flex-column gap-2 mt-1">
                              <Form.Check
                                type="radio"
                                id="ge-book-voucher"
                                name="geBookingConfirmation"
                                label="Book Now & Voucher Now "
                                value="Book & Voucher"
                                checked={
                                  voucherChoiceMade &&
                                  bookingConfirmation === "Book & Voucher"
                                }
                                onChange={(e) => {
                                  setBookingConfirmation(e.target.value);
                                  setVoucherChoiceMade(true);
                                  setVoucherChoiceError(false);
                                }}
                                className="mb-0"
                              />
                              <Form.Check
                                type="radio"
                                id="ge-book-now-voucher-later"
                                name="geBookingConfirmation"
                                label="Book Now & Voucher Later"
                                value="Book Now & Voucher later"
                                checked={
                                  voucherChoiceMade &&
                                  bookingConfirmation ===
                                    "Book Now & Voucher later"
                                }
                                onChange={(e) => {
                                  setBookingConfirmation(e.target.value);
                                  setVoucherChoiceMade(true);
                                  setVoucherChoiceError(false);
                                }}
                              />
                            </div>
                            {voucherChoiceError && (
                              <div className="text-danger small mt-2">
                                Please select a booking option to continue.
                              </div>
                            )}
                          </Form.Group>
                        </Card.Body>
                      </Card>
                    )}

                    <div className="hbp-action-bar mt-2 d-flex gap-2">
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
                        onClick={openPolicyConsent}
                        className="flex-grow-1"
                      >
                        Confirm Booking
                      </Button>
                    </div>
                  </div>
                </Col>
              </Row>

              {/* ─────────── Policy + T&C consent modal ─────────── */}
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
                  {policiesLoading ? (
                    <div className="text-center py-4">
                      <div className="spinner-border spinner-border-sm text-secondary" />
                      <div className="mt-2 text-muted small">
                        Loading policies &amp; terms…
                      </div>
                    </div>
                  ) : (
                    <>
                      <section className="policy-section">
                        <h6 className="policy-section-title">
                          Cancellation Policy
                        </h6>
                        {policyData?.policies?.cancellationPolicy?.length ? (
                          policyData.policies.cancellationPolicy.map(
                            (p, idx) => (
                              <div key={idx} className="policy-item">
                                <div className="policy-text">
                                  {p.policyText || "—"}
                                </div>
                              </div>
                            ),
                          )
                        ) : (
                          <div className="policy-empty">
                            No cancellation policy specified.
                          </div>
                        )}
                      </section>

                      <section className="policy-section">
                        <h6 className="policy-section-title">
                          Amendment Policy
                        </h6>
                        {policyData?.policies?.amendmentPolicy?.length ? (
                          policyData.policies.amendmentPolicy.map((p, idx) => (
                            <div key={idx} className="policy-item">
                              <div className="policy-text">
                                {p.policyText || "—"}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="policy-empty">
                            No amendment policy specified.
                          </div>
                        )}
                      </section>

                      <section className="policy-section">
                        <h6 className="policy-section-title">Child Policy</h6>
                        {policyData?.policies?.childPolicy?.length &&
                        policyData.policies.childPolicy.some(
                          (p) => p.policyText,
                        ) ? (
                          policyData.policies.childPolicy.map((p, idx) => (
                            <div key={idx} className="policy-item">
                              <div className="policy-text">
                                {p.policyText || "—"}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="policy-empty">
                            No child policy specified.
                          </div>
                        )}
                      </section>

                      <section className="policy-section policy-section-last">
                        <h6 className="policy-section-title">
                          Terms &amp; Conditions
                        </h6>
                        {termsAndConditions ? (
                          <div
                            className="terms-content"
                            dangerouslySetInnerHTML={{
                              __html: termsAndConditions,
                            }}
                          />
                        ) : (
                          <div className="policy-empty">
                            No terms &amp; conditions configured for this
                            hotel.
                          </div>
                        )}
                      </section>
                    </>
                  )}
                </Modal.Body>
                <Modal.Footer className="policy-modal-footer">
                  <Form.Check
                    type="checkbox"
                    id="policy-accept"
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
                    disabled={!policyAccepted || policiesLoading}
                    onClick={() => {
                      setShowPolicyModal(false);
                      handleSubmit();
                    }}
                  >
                    Proceed
                  </Button>
                </Modal.Footer>
              </Modal>

              {/* ─────────── Order-summary confirm modal ─────────── */}
              <Modal
                show={showConfirmModal}
                onHide={() => !isSubmitting && setShowConfirmModal(false)}
                centered
                backdrop="static"
                size="lg"
                dialogClassName="confirm-booking-modal"
              >
                <Modal.Header
                  closeButton={!isSubmitting}
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

                      <Row className="gy-2">
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
                        {/* Room category + meal plan per booked room — mirrors
                            the booking summary. */}
                        {(pendingPayload.rooms || []).map((rm, i) => (
                          <React.Fragment key={i}>
                            <Col xs={6}>
                              <p className="mb-1">
                                <strong>Room Category:</strong>
                                <br />
                                <span className="text-dark">
                                  {pendingPayload.rooms.length > 1
                                    ? `Room ${i + 1} - `
                                    : ""}
                                  {rm.roomCategory || "—"}
                                </span>
                              </p>
                            </Col>
                            <Col xs={6}>
                              <p className="mb-1">
                                <strong>Meal Plan:</strong>
                                <br />
                                <span className="text-dark">
                                  {rm.mealPlan || "—"}
                                </span>
                              </p>
                            </Col>
                          </React.Fragment>
                        ))}

                        <Col xs={12}>
                          <p className="mb-1">
                            <strong>Lead Passenger:</strong>{" "}
                            {[
                              pendingPayload.primaryGuest.salutation,
                              pendingPayload.primaryGuest.firstName,
                              pendingPayload.primaryGuest.lastName,
                            ]
                              .filter(Boolean)
                              .join(" ") || "-"}
                          </p>
                          <p className="mb-1">
                            <strong>Verification:</strong>{" "}
                            {pendingPayload.verificationMethod ===
                            METHOD_UPLOAD
                              ? `Government ID Upload (${
                                  pendingPayload.govtIdFileName || "uploaded"
                                })`
                              : `Employee Code (${
                                  pendingPayload.govEmployeeCode || "-"
                                })`}
                          </p>
                        </Col>

                        {/* Cancellation block — mirrors HotelBookingPage's
                            confirm modal placement (after Lead Passenger,
                            before Rate Split). Non-refundable → clear "no
                            refund" notice. Refundable + deadline → the
                            free-cancellation deadline with a green
                            "Refundable until this date" badge, or a red
                            "Passed" badge if already crossed. */}
                        {isNonRefundableRate ? (
                          <Col xs={12}>
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
                                No refund will be provided if this booking
                                is cancelled.
                              </p>
                              <p className="mb-0 text-dark small">
                                100% cancellation charges apply from the
                                time of booking.
                              </p>
                            </div>
                          </Col>
                        ) : (
                          cancellationDeadline && (
                            <Col xs={12}>
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
                      </Row>

                      <div className="mt-2 p-2 bg-white border rounded">
                        <h6 className="fw-bold mb-1">Rate Split</h6>
                        {pendingPayload.totalRateBeforeDiscount >
                          pendingPayload.rooms.reduce(
                            (s, r) => s + r.rate,
                            0,
                          ) && (
                          <div className="d-flex justify-content-between">
                            <span>Standard Total</span>
                            <span className="text-decoration-line-through text-muted">
                              {formatPrice(
                                pendingPayload.totalRateBeforeDiscount,
                              )}
                            </span>
                          </div>
                        )}
                        {(pendingPayload.discountPercent ||
                          pendingPayload.discountAmount) && (
                          <div className="d-flex justify-content-between text-success">
                            <span>Government Discount</span>
                            <span>
                              {pendingPayload.discountPercent
                                ? `${pendingPayload.discountPercent}%`
                                : ""}
                              {pendingPayload.discountAmount
                                ? ` + ${pendingPayload.discountAmount}`
                                : ""}
                            </span>
                          </div>
                        )}
                        <hr className="my-1" />
                        <div className="d-flex justify-content-between fw-bold">
                          <span>Total Payable</span>
                          <span>
                            {formatPrice(
                              pendingPayload.rooms.reduce(
                                (s, r) => s + r.rate,
                                0,
                              ),
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 p-2 bg-white border rounded d-flex align-items-center">
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
                        >
                          ✓
                        </span>
                        <span className="small text-dark">
                          Hotel policies and terms &amp; conditions accepted
                        </span>
                      </div>

                      <div className="mt-2 text-center">
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
                        <Spinner size="sm" className="me-2" /> Processing
                        booking…
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

export default GovEmployeeBookingPage;
