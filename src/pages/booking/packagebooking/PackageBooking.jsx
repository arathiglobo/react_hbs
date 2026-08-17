import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Row, Col, Spinner, Form, Modal, Button, Card, Badge } from "react-bootstrap";
import Sidebar from "../../../components/Sidebar";
import TopBar from "../../../components/TopBar";
import AgentBalanceDisplay from "../../../components/AgentBalanceDisplay";
import axiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import {
  FaCreditCard,
  FaCheckCircle,
  FaShieldAlt,
  FaRegClock,
  FaTimesCircle,
  FaFileContract,
  FaSuitcase,
  FaCalendarAlt,
  FaUsers,
  FaBed,
  FaGlobe,
  FaClock,
  FaMapMarkerAlt,
} from "react-icons/fa";

import HotelsTab from "./tabs/HotelsTab";
import CabsTab from "./tabs/CabsTab";
import ActivitiesTab from "./tabs/ActivitiesTab";
import PaxInformation from "./tabs/PaxInformation";
// Basic Details step removed — package category is now resolved from the
// occupancy chosen on the Package Search page, and Pax passport moved to the
// Pax Info step. BasicDetails.jsx is intentionally no longer imported.

import "../../../styles/PackageBooking_Stepper.css";
// Reused from the Hotel booking flow (/room-list) so this page inherits the
// same visual language — --rl-* palette, .hs-page-heading-title header, the
// .back-to-search-btn pill, and the .hotel-header-card / .booking-summary
// card patterns applied to the package hero below.
import "../../../styles/RoomList.css";

const STEPS = ["Package Details", "Pax Info"];

// Mode of payment options — rendered in the right sidebar on the Pax Info
// step (moved from the Hotels step). Stored on bookingData.programme.modeOfPayment.
const PAYMENT_MODES = [
  { value: "CREDIT", label: "Credit Limit" },
  { value: "CARD", label: "Card" },
];

const PackageBooking = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  // The URL now carries only /{id} (no query params — per spec). Search-page
  // context (agent, destination, pax, rate, nationality, employee, category…)
  // is handed off via a localStorage draft keyed by packageId, written by
  // PackageSearch just before window.open. The draft is intentionally NOT
  // deleted on read — it must survive a page reload so downstream fetches
  // like /api/v1/package-booking/hotel-details, which require agentId +
  // packageCategoryid + destinationCountryId, keep working after F5. Each
  // "Book Now" on the search page overwrites the draft for that packageId,
  // so a fresh search always beats stale context; the only edge is a
  // direct-URL visit long after the last search, which then re-seeds from
  // the last-known context instead of raw defaults. location.state still
  // wins when set (in-tab navigate from PackageBookingDetailView amend/edit).
  const [searchContext] = useState(() => {
    if (!id) return {};
    try {
      const raw = localStorage.getItem(`packageBookingContext:${id}`);
      if (!raw) return {};
      return JSON.parse(raw) || {};
    } catch {
      return {};
    }
  });
  const stateData = location.state || {};
  const agentId =
    stateData.agentId || searchContext.agentId || "";
  const destinationCountryId =
    stateData.destinationCountryId ||
    searchContext.destinationCountryId ||
    "";
  const searchRate =
    stateData.searchRate != null
      ? stateData.searchRate
      : searchContext.searchRate;
  // Nationality picked on the Package Search page. Seeds the booking's
  // native country / "Pax passport" so the operator doesn't re-enter it —
  // the Hotels, Cabs and Activities steps all send nativeCountry with
  // their rate lookups.
  const searchNationalityId =
    stateData.nationalityId ?? searchContext.nationalityId;
  const searchNationalityName =
    stateData.nationalityName ?? searchContext.nationalityName;
  // "Booking Done By Employee" picked on the Package Search page. Carried
  // through to the submit payload so it is persisted on the booking.
  const searchEmployeeId =
    stateData.employeeId ?? searchContext.employeeId;
  // Rooms & Guests selection carried over from the Package Search page.
  // Seeds the initial pax counts so the booking defaults to what was chosen
  // on the search screen; the user can still adjust them, and picking a
  // package category still overrides them (see BasicDetails.jsx).
  const searchAdultCount =
    stateData.adultCount ?? searchContext.adultCount;
  const searchChildCount =
    stateData.childCount ?? searchContext.childCount;
  const searchChildAges =
    stateData.childAges ?? searchContext.childAges;
  // Category resolved by the search page for the chosen occupancy — replaces
  // the removed Basic Details category picker. Drives the Hotels fetch and the
  // Total Price sharing multiplier.
  const searchPackageCategory =
    stateData.packageCategory ?? searchContext.packageCategory;
  const searchPackageCategoryName =
    stateData.packageCategoryName ?? searchContext.packageCategoryName;
  const { mode, bookingId } = stateData;
  const isEditMode = mode === "edit" && bookingId;

  // Amend → child-booking flow (mirrors Hotel "ADD NEW ITEM").
  // PackageBookingDetailView's Amend navigates to the search page with
  // ?parentBookingCode=GPKG-... which PackageSearch then stores in the
  // one-shot draft above so the backend can stamp "{parent}/{n}" for the
  // new booking on submit. Threaded through to PaxInformation.
  const parentBookingCode = searchContext.parentBookingCode || null;

  const [currentStep, setCurrentStep] = useState(1);
  const [packageData, setPackageData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  // Set when the page is opened in amendment mode so the submit step
  // chooses PUT over POST.
  const [editingBookingId, setEditingBookingId] = useState(
    isEditMode ? bookingId : null
  );

  const [bookingData, setBookingData] = useState({
    searchParams: {
      packageId: id,
      travelDate: new Date().toISOString().split("T")[0],
      adultCount: Number(searchAdultCount) > 0 ? Number(searchAdultCount) : 1,
      childCount: Number(searchChildCount) >= 0 ? Number(searchChildCount) : 0,
      infantCount: 0,
      childAge: searchChildAges || "",
      infantAge: "",
      packageCategory: searchPackageCategory || "",
      packageCategoryName: searchPackageCategoryName || "",
      // Seeded from the search page's Nationality filter when present; the
      // Pax Information step can still change it.
      paxPassport: searchNationalityId
        ? {
            value: Number(searchNationalityId),
            label: searchNationalityName || "",
          }
        : null,
      nativeCountry: searchNationalityId || "",
      agentId: agentId || "",
      employeeId: searchEmployeeId || "",
      destinationCountryId: destinationCountryId || "",
    },
    selections: {
      selectedHotels: [],
      selectedCab: null,
      selectedActivity: null,
      hotelPrice: 0,
      cabPrice: 0,
      activityPrice: 0,
      // Meal plan picked on the Hotels tab (BB/HB/FB/AI), sourced from the
      // selected hotel's mealPlans list — same category+occupancy rates
      // configured in PackageRates.jsx's Meal Plan Rates block. mealPlanPrice
      // is the pax-scaled, markup-applied total for the chosen plan; it's
      // added on top of hotelPrice in the Total Price sidebar below.
      selectedMealPlan: null,
      mealPlanPrice: 0,
    },
    // Contact card was removed — the first traveller is the primary contact
    // and their email + mobile are captured directly on the traveller row.
    paxInfo: {
      travellers: [],
    },
    // Programme inputs captured on the Hotels tab (per the static
    // mock-up). Lifted to the parent so they survive tab navigation and
    // flow into the submit payload via PaxInformation.
    programme: {
      checkInDate: "",
      flightDetails: "",
      // Optional free-text notes captured under the Pax Info step's "Others"
      // heading. Sent on the /book POST as `initialNote`; backend persists it
      // as a package_booking_related_notes row so it lands in the detail
      // view's Notes panel. Only used on create — amend/PUT skips the field.
      notes: "",
      modeOfPayment: "",
      // "Book & Voucher" (Book and Pay Now) | "Book Now & Voucher later"
      // (Hold Room and Pay Later). Empty = no choice yet (required on confirm).
      bookingConfirmation: "",
      termsAccepted: false,
    },
  });

  const [totalPrice, setTotalPrice] = useState(0);

  useEffect(() => {
    const fetchPackageDetails = async () => {
      try {
        setIsLoading(true);
        const response = await axiosInstance.get(`/api/packageRates/${id}`);
        setPackageData(response.data);
        // Prefer the rate that was shown on the search-result card so the
        // Total Price sidebar mirrors what the user clicked Book Now on.
        // Falls back to the rates-API value for direct/refresh visits.
        const baseRate =
          Number(searchRate) > 0
            ? Number(searchRate)
            : Number(response.data?.rate) || 0;
        setTotalPrice(baseRate);
      } catch (error) {
        console.error("Error fetching package details:", error);
      } finally {
        setIsLoading(false);
      }
    };
    if (id) fetchPackageDetails();
  }, [id]);

  // Full package view — supplies the cancellation policy + Terms & Conditions
  // shown in the "Cancellation Policies & Terms & Conditions" popup opened from
  // the Total Price card. Same endpoint the Package Details step uses.
  const [packageView, setPackageView] = useState(null);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    axiosInstance
      .get(`/api/TravelPackage/view/${id}`)
      .then((res) => {
        if (!cancelled) setPackageView(res.data || null);
      })
      .catch(() => {
        if (!cancelled) setPackageView(null);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Default the Mode of payment based on the agent's available credit:
  //  • has credit limit available → "Agent credit limit" (CREDIT)
  //  • no credit available (0 / unavailable) → "Card payment" (CARD)
  // Only seeds the default when nothing is chosen yet, so it never overrides a
  // user's manual pick. Skipped in edit mode (the saved value is loaded).
  useEffect(() => {
    if (isEditMode || !agentId) return;
    let cancelled = false;
    const applyDefault = (mode) => {
      if (cancelled) return;
      setBookingData((prev) =>
        prev.programme.modeOfPayment
          ? prev
          : { ...prev, programme: { ...prev.programme, modeOfPayment: mode } },
      );
    };
    axiosInstance
      .get(`/api/agent-credit-limit/agent/${agentId}`)
      .then((res) => {
        const avail =
          res?.data?.effectiveAvailableCreditLimit ??
          res?.data?.availableCreditLimit ??
          null;
        const hasCredit = avail != null && Number(avail) > 0;
        applyDefault(hasCredit ? "CREDIT" : "CARD");
      })
      .catch(() => {
        // Credit info unavailable → treat as no credit limit → card payment.
        applyDefault("CARD");
      });
    return () => {
      cancelled = true;
    };
  }, [agentId, isEditMode]);

  // Edit mode — fetch the existing booking and hydrate state so the user
  // can amend any tab and submit via PUT. Runs once on mount.
  useEffect(() => {
    if (!isEditMode || !bookingId) return;
    const loadExistingBooking = async () => {
      try {
        const res = await axiosInstance.get(
          `/api/v1/package-booking/booking/${bookingId}`
        );
        const b = res.data;
        if (!b) return;

        // Map back into the shape the tabs expect. Names / shapes mirror
        // what is sent in handleSubmitBooking() so a round-trip works.
        setBookingData((prev) => ({
          ...prev,
          // Preserve the saved Tourism Dirham so the amend flow doesn't
          // silently drop it (or, if the FE were to resend the stored total
          // that already includes it, get it double-added on save).
          tourismDirham: b.tourismDirham != null ? b.tourismDirham : null,
          searchParams: {
            ...prev.searchParams,
            packageId: b.packageId || prev.searchParams.packageId,
            travelDate: b.travelDate || prev.searchParams.travelDate,
            packageCategory: b.packageCategory || "",
            nativeCountry: b.nativeCountry || "",
            agentId: b.agentId || prev.searchParams.agentId,
            destinationCountryId:
              b.destinationCountryId || prev.searchParams.destinationCountryId,
            destinationCityId: b.destinationCityId || "",
            adultCount: b.counts?.adultCount ?? 1,
            childCount: b.counts?.childCount ?? 0,
            infantCount: b.counts?.infantCount ?? 0,
            childAge: b.counts?.childAge || "",
            infantAge: b.counts?.infantAge || "",
          },
          selections: {
            ...prev.selections,
            selectedHotels: (b.selections?.hotels || []).map((h) => ({
              hotelId: h.hotelId,
              hotelName: h.hotelName,
              totalRateWithMarkup: h.selectedRate,
              currencyCode: h.currency,
            })),
            hotelPrice: (b.selections?.hotels || []).reduce(
              (sum, h) => sum + Number(h.selectedRate || 0),
              0
            ),
            cabPrice: Number(b.selections?.cab?.selectedRate || 0),
            activityPrice: Number(b.selections?.activity?.selectedRate || 0),
          },
          paxInfo: {
            travellers: (b.travellers || []).map((t, i) => ({
              type: t.type || (i === 0 ? "Adult" : "Adult"),
              id: `${(t.type || "adult").toLowerCase()}-${i}-${Date.now()}`,
              title: t.title || "Mr",
              firstName: t.firstName || "",
              middleName: t.middleName || "",
              lastName: t.lastName || "",
              // Email + mobile aren't on the per-traveller payload — pull
              // them from the booking-level contactInfo for the first row.
              email: i === 0 ? b.contactInfo?.email || "" : "",
              mobile: i === 0 ? b.contactInfo?.mobile || "" : "",
            })),
          },
          programme: {
            checkInDate: b.checkInDate || "",
            flightDetails: b.flightDetails || "",
            modeOfPayment: b.modeOfPayment || "",
            bookingConfirmation: b.bookingConfirmation || "",
            termsAccepted: !!b.termsAccepted,
          },
        }));
      } catch (err) {
        console.error("Edit-mode load failed:", err);
        toast.error("Failed to load booking for amendment");
      }
    };
    loadExistingBooking();
  }, [isEditMode, bookingId]);

  useEffect(() => {
    // Same precedence as the initial fetch — prefer the searched rate so
    // the sidebar stays aligned with what the user clicked Book Now on,
    // even after selections trigger a recompute.
    const baseRate =
      Number(searchRate) > 0
        ? Number(searchRate)
        : Number(packageData?.rate) || 0;
    const { hotelPrice, cabPrice, activityPrice, mealPlanPrice } = bookingData.selections;

    // Show the package rate exactly as it appeared on the search card until
    // the user actually picks a hotel. Applying any category- or pax-based
    // multiplier here would make the sidebar disagree with the number the
    // user clicked "Book Now" on for their package. Once a hotel IS
    // selected, its totalRateWithMarkup is the authoritative charge
    // (already pax-sized by the backend as
    // perAdultRate*adultCount + perChildRate*childCount + markup), so it
    // takes over directly.
    const packageTotal = hotelPrice > 0 ? hotelPrice : baseRate;

    // Meal plan (if any) is appended on top — its rate is already pax-scaled
    // + markup-applied by the backend (see mealPlanPrice from HotelsTab).
    setTotalPrice(packageTotal + cabPrice + activityPrice + (Number(mealPlanPrice) || 0));
  }, [bookingData.selections, packageData, searchRate]);

  const updateSelections = (selections) =>
    setBookingData((prev) => ({ ...prev, selections: { ...prev.selections, ...selections } }));

  const updateProgramme = (programme) =>
    setBookingData((prev) => ({ ...prev, programme: { ...prev.programme, ...programme } }));

  const handleFinish = async () => {
    try {
      toast.loading("Processing booking...");
      setTimeout(() => {
        toast.dismiss();
        toast.success("Booking confirmed successfully!");
        navigate("/booking-details/package-booking-list");
      }, 1500);
    } catch {
      toast.error("Failed to confirm booking");
    }
  };

  // ── Hero card derivations ─────────────────────────────────────────────
  // Feeds the Room-List-style Booking Summary card at the top of the page.
  // Every field falls back to a dash so the summary always renders even when
  // the search page didn't forward a value.
  const packageNights = (() => {
    const raw =
      packageView?.noOfNights ??
      packageData?.noOfNights ??
      packageData?.duration ??
      packageView?.duration;
    const n = parseInt(String(raw || "").trim(), 10);
    return Number.isNaN(n) ? 0 : n;
  })();
  // Human-readable dd MMM yyyy so the summary matches how /room-list formats
  // its Check-in / Check-out rows (a plain string, not the ISO used on the
  // payload).
  const formatDateForDisplay = (isoOrEmpty) => {
    if (!isoOrEmpty) return "";
    const d = new Date(isoOrEmpty);
    if (Number.isNaN(d.getTime())) return String(isoOrEmpty);
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };
  const heroCheckIn = bookingData?.searchParams?.travelDate || "";
  const heroCheckOut = (() => {
    if (!heroCheckIn || !packageNights) return "";
    const d = new Date(heroCheckIn);
    if (Number.isNaN(d.getTime())) return "";
    d.setDate(d.getDate() + packageNights);
    return d.toISOString().split("T")[0];
  })();
  const heroAdults = Number(bookingData?.searchParams?.adultCount) || 0;
  const heroChildren = Number(bookingData?.searchParams?.childCount) || 0;
  const heroGuestSummary = [
    heroAdults ? `${heroAdults} adult${heroAdults === 1 ? "" : "s"}` : "",
    heroChildren
      ? `${heroChildren} child${heroChildren === 1 ? "" : "ren"}`
      : "",
  ]
    .filter(Boolean)
    .join(", ") || "—";
  // heroRoomCount was consumed only by the Rooms row in the Booking Summary,
  // which was removed per product spec — derivation dropped along with it.
  const heroNationality =
    searchContext.nationalityName ||
    bookingData?.searchParams?.nationalityName ||
    "—";
  const heroPackageType =
    packageView?.packageTypeName || packageData?.packageType || "";
  const heroPackageCategory =
    bookingData?.searchParams?.packageCategoryName ||
    searchContext.packageCategoryName ||
    "";
  const heroDestination =
    packageView?.arriveCountryName ||
    (Array.isArray(packageView?.arrivePlaces) && packageView.arrivePlaces.length
      ? packageView.arrivePlaces.map((p) => p.name).filter(Boolean).join(", ")
      : "");

  // Cancellation policy + Includes + Excludes + Terms & Conditions for the
  // popup. Includes / Excludes moved here from HotelsTab per product spec;
  // the underlying packageView.inclusions / packageView.exclusions arrays
  // are unchanged — only the display location moved.
  const termsList = Array.isArray(packageView?.termsAndConditions)
    ? packageView.termsAndConditions
    : [];
  const inclusions = Array.isArray(packageView?.inclusions)
    ? packageView.inclusions
    : [];
  const exclusions = Array.isArray(packageView?.exclusions)
    ? packageView.exclusions
    : [];
  const cancellationParts = (() => {
    const free = packageView?.cancellationDaysFree;
    const withCharge = packageView?.cancellationDaysWithCharge;
    const type = packageView?.cancellationChargeType;
    const value = packageView?.cancellationChargeValue;
    if (free == null && withCharge == null && !value) {
      return [
        {
          tone: "muted",
          text: "Cancellation policy will be confirmed by the supplier.",
        },
      ];
    }
    const parts = [];
    if (free != null) {
      parts.push({
        tone: "ok",
        text: `Free cancellation up to ${free} day${free === 1 ? "" : "s"} before travel.`,
      });
    }
    if (withCharge != null) {
      let chargeText = "";
      if (value) {
        chargeText =
          type && type.toLowerCase() === "percent" ? `${value}%` : value;
      }
      parts.push({
        tone: "warn",
        text: `Within ${withCharge} day${withCharge === 1 ? "" : "s"} of travel${
          chargeText
            ? `, ${chargeText} cancellation charge applies`
            : ", cancellation charge applies"
        }.`,
      });
    }
    return parts;
  })();

  // Package Checkout (step-2) opens in a NEW BROWSER TAB per product spec —
  // /new-booking/package-checkout/{id}. Payload travels through localStorage
  // (NOT sessionStorage) because a new tab spawned by window.open does not
  // reliably inherit the opener's sessionStorage but DOES share localStorage
  // on the same origin. The draft is cleared by PackageCheckout on
  // successful booking / going back. If the popup is blocked (window.open
  // returns null), fall back to same-tab navigation so the flow still works.
  const goToCheckout = () => {
    const payload = {
      bookingData,
      packageData,
      packageView,
      editingBookingId,
      parentBookingCode,
      searchRate,
    };
    try {
      localStorage.setItem(
        `packageCheckoutDraft:${id}`,
        JSON.stringify(payload),
      );
    } catch {
      /* quota exceeded — see fallback below */
    }
    const url = `${window.location.origin}/new-booking/package-checkout/${id}`;
    const newTab = window.open(url, "_blank");
    if (!newTab) {
      // Popup blocked → same-tab navigation as a fallback so the user
      // isn't stranded. Same URL, same localStorage payload.
      navigate(`/new-booking/package-checkout/${id}`, { state: payload });
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1: return <HotelsTab
                        searchParams={bookingData.searchParams}
                        bookingData={bookingData.selections}
                        programme={bookingData.programme}
                        updateData={updateSelections}
                        updateProgramme={updateProgramme}
                        packageRate={
                          Number(searchRate) > 0
                            ? Number(searchRate)
                            : Number(packageData?.rate || 0)
                        }
                        onPrev={() => navigate("/new-booking/package-search")}
                        onNext={goToCheckout} />;
      // case 2 was PaxInformation — moved to a dedicated route
      // (/new-booking/package-checkout/{id}, see PackageCheckout.jsx). Kept
      // as a defensive fallback here so a stale link that still points at
      // currentStep === 2 doesn't render nothing; the useEffect below
      // never sets currentStep to 2 anymore.
      case 2: return <PaxInformation
                        searchParams={bookingData.searchParams}
                        bookingData={bookingData}
                        updateData={setBookingData}
                        onPrev={() => setCurrentStep(1)}
                        onFinish={handleFinish}
                        packageData={packageData}
                        totalPrice={totalPrice}
                        editingBookingId={editingBookingId}
                        parentBookingCode={parentBookingCode}
                      />;
      default: return null;
    }
  };

  if (isLoading) {
    return (
      <div className="min-vh-100 bg-light d-flex flex-column">
        <TopBar />
        <div className="d-flex flex-grow-1">
          <Sidebar />
          <main className="flex-grow-1 d-flex justify-content-center align-items-center">
            <Spinner animation="border" variant="primary" />
          </main>
        </div>
      </div>
    );
  }

  return (
    // Outer shell aligned to /hotel-booking-page: both `hotel-booking-container`
    // AND `room-list-container` classes are applied to the same element so
    // both stylesheets' page-shell variables resolve — HotelBookingPage.css
    // takes precedence for the ones both define, while the sticky-sidebar
    // behaviour that depended on the room-list wrapper still works. The
    // `--rl-*` CSS variables in RoomList.css still power the sidebar cards.
    <div className="min-vh-100 bg-light d-flex flex-column hotel-booking-container room-list-container">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main
          className="content-wrapper flex-grow-1 booking-stepper-container"
          /* overflowX must be `clip`, not `hidden`. `hidden` promotes the
             other axis to `auto` and makes <main> a scroll container, which
             breaks `position: sticky` on the Total Price sidebar (the sticky
             element ends up anchored to <main> instead of the real page
             scroll). `clip` prevents horizontal overflow the same way without
             establishing a scroll container. */
          style={{ minWidth: 0, overflowX: "clip" }}
        >
          <div className="container-fluid" style={{ paddingTop: "10px" }}>
            {/* Page heading — mirrors /room-list's "Accommodation" heading. */}
            <div className="hs-page-heading">
              <h3 className="hs-page-heading-title">
                {editingBookingId ? "Amend Package Booking" : "Package Booking"}
              </h3>
            </div>

            {/* Top toolbar: Back to Search pill + Available Balance,
                matching /room-list's toolbar row. */}
            <div className="d-flex justify-content-between align-items-center mb-3 gap-2 flex-wrap">
              <Button
                variant="outline-primary"
                size="sm"
                onClick={() => navigate("/new-booking/package-search")}
                className="back-to-search-btn"
              >
                ← Back to Search
              </Button>
              <AgentBalanceDisplay agentId={agentId} />
            </div>

            {/* ── Package Hero card ──
                Two-column layout — package identification on the left
                (md=8), Booking Summary on the right (md=4). Per operator
                feedback the Booking Summary belongs INSIDE this card, not
                as a standalone tile in the sidebar (which is why the
                sidebar Booking Summary block below was removed). */}
            <Card className="hotel-header-card mb-4">
              <Card.Body className="p-4">
                <Row>
                  <Col md={8}>
                    <div className="d-flex align-items-start gap-3">
                      <div className="hotel-icon">
                        <FaSuitcase size={40} className="text-primary" />
                      </div>
                      <div className="hotel-info">
                        <h2 className="hotel-name mb-2">
                          {packageData?.packageName ||
                            packageView?.packageName ||
                            "Package"}
                        </h2>
                        <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
                          {heroPackageType && (
                            <Badge bg="primary">{heroPackageType}</Badge>
                          )}
                          {heroPackageCategory && (
                            <Badge bg="info">{heroPackageCategory}</Badge>
                          )}
                          {packageNights > 0 && (
                            <span
                              className="d-inline-flex align-items-center gap-1 fw-semibold"
                              style={{ color: "#475569", fontSize: "0.9rem" }}
                            >
                              <FaClock className="text-primary" />
                              {packageNights} Night
                              {packageNights === 1 ? "" : "s"} /{" "}
                              {packageNights + 1} Days
                            </span>
                          )}
                        </div>
                        <div className="hotel-details">
                          {heroDestination && (
                            <p className="mb-1">
                              <FaMapMarkerAlt className="text-muted me-2" />
                              {heroDestination}
                            </p>
                          )}
                          <div className="mt-2">
                            <small className="text-muted">
                              <strong>Please note:</strong>{" "}
                              <span className="someproperties">
                                Review the full itinerary, inclusions and
                                cancellation policy below before completing
                                the booking. Rates are per person and exclude
                                flights, visas and personal expenses unless
                                explicitly listed under Inclusions.
                              </span>
                            </small>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Col>
                  <Col md={4}>
                    {/* Booking Summary — nested inside the hero per operator
                        feedback. Same rows / data / labels the standalone
                        sidebar card had (now removed to avoid duplication). */}
                    <Card className="booking-summary">
                      <Card.Body className="p-4">
                        <h6 className="mb-3">Booking Summary</h6>
                        <div className="booking-details">
                          <div className="d-flex justify-content-between mb-2">
                            <span>
                              <FaCalendarAlt className="text-muted me-2" />
                              Arrival date:
                            </span>
                            <span className="fw-semibold">
                              {formatDateForDisplay(heroCheckIn) || "—"}
                            </span>
                          </div>
                          <div className="d-flex justify-content-between mb-2">
                            <span>
                              <FaCalendarAlt className="text-muted me-2" />
                              Departure date:
                            </span>
                            <span className="fw-semibold">
                              {formatDateForDisplay(heroCheckOut) || "—"}
                            </span>
                          </div>
                          <div className="d-flex justify-content-between mb-2">
                            <span>
                              <FaUsers className="text-muted me-2" />
                              Guests:
                            </span>
                            <span className="fw-semibold">
                              {heroGuestSummary}
                            </span>
                          </div>
                          <div className="d-flex justify-content-between">
                            <span>
                              <FaGlobe className="text-muted me-2" />
                              Nationality:
                            </span>
                            <span className="fw-semibold">
                              {heroNationality}
                            </span>
                          </div>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              </Card.Body>
            </Card>

          {/* Grid ratio mirrors /hotel-booking-page (Col lg=8 left, lg=4
              right) so the two booking flows read as one system. The
              hbp-left-col / hbp-right-col class hooks let HotelBookingPage.css
              rules (sticky sidebar, gutter tuning, responsive stacking) apply
              here too. Kept the .main-booking-card / .tab-content-area
              wrapping so step-2 (PaxInformation) — which the user asked me
              NOT to change — continues to render inside the same shell. */}
          <Row className="g-3">
            {/* ── Main card ── */}
            <Col lg={8} className="hbp-left-col">
              <div className="main-booking-card">
                {/* Tab content */}
                <div className="tab-content-area">
                  {renderStep()}
                </div>
              </div>
            </Col>

            {/* ── Price sidebar ── */}
            <Col lg={4} className="hbp-right-col">
              {/* The sidebar block is sticky-pinned near the top of the
                  viewport (see .sidebar-stack in PackageBooking_Stepper.css)
                  so the Total Price stays visible while the operator scrolls
                  through the main content. It unpins naturally when its
                  column ends. */}
              {/* ── Displayed total (add-view) vs submitted total (billing) ──
                  The number rendered here in the sidebar is INTENTIONALLY the
                  sum: Package rate + Hotel (when selected) + Cabs + Activities
                  — so the operator sees the components stacking up as they
                  make selections. The `totalPrice` state that flows into the
                  /book POST body is kept on its existing "hotel replaces
                  package rate" logic (see the useEffect above), because
                  hotel.totalRateWithMarkup ALREADY includes the package's
                  pax-sized base + agent markup; adding baseRate on top of
                  that would double-deduct the agent's credit at line 1374 of
                  PackageBookingServiceImpl.java. So display ≠ billed on
                  purpose — this component is presentational only. */}
              <div className="sidebar-stack">
              {/* Booking Summary card was moved INTO the hero card at the top
                  of the page (right-side column, md=4) per operator feedback,
                  so the sidebar no longer duplicates it. The Total Price card
                  below is now the first sidebar item. */}

              {/* Total Price — just the headline number. Per product spec
                  the rate-splits (Package rate / Hotels / Cabs / Activities
                  breakdown rows) were removed on this page so the operator
                  sees the single total they're about to commit to. The
                  detailed breakdown still appears on /new-booking/
                  package-checkout/{id} if needed. */}
              <div className="price-sidebar-card">
                <div className="price-sidebar-label">Total Price</div>
                <div className="price-sidebar-amount">
                  {(
                    (Number(searchRate) > 0 ? Number(searchRate) : Number(packageData?.rate) || 0) +
                    (Number(bookingData.selections.hotelPrice) || 0) +
                    (Number(bookingData.selections.cabPrice) || 0) +
                    (Number(bookingData.selections.activityPrice) || 0) +
                    (Number(bookingData.selections.mealPlanPrice) || 0)
                  ).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="price-sidebar-sub">AED · Selling price</div>
                {/* Meal plan line — only shown once one is picked on the
                    Hotels tab, so the operator can see what's stacked on
                    top of the hotel rate at a glance. */}
                {bookingData.selections.selectedMealPlan && (
                  <div className="price-sidebar-mealplan">
                    + {bookingData.selections.selectedMealPlan.label} meal plan · AED{" "}
                    {Number(bookingData.selections.mealPlanPrice || 0).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                )}
              </div>

              {/* Cancellation Policies & Terms — moved out of the Total
                  Price card per product spec. Its own compact sidebar
                  card so operators can still open the policy popup from
                  the sticky sidebar without visually cluttering the
                  price/breakdown block. */}
              <div className="sidebar-policy-card">
                <button
                  type="button"
                  className="price-policy-link"
                  onClick={() => setShowPolicyModal(true)}
                >
                  <FaShieldAlt className="policy-link-icon" />
                  <span className="policy-link-text">
                    Cancellation Policies &amp; Terms &amp; Conditions
                  </span>
                </button>
              </div>

              {/* Mode of payment card was moved OUT of the right sidebar
                  per product spec — it now lives inside the Pax Info step,
                  directly under the "Others" section (see PaxInformation.jsx).
                  bookingData.programme.modeOfPayment is still the source of
                  truth; PaxInformation reads / writes via the same
                  updateData(prev => …) channel. */}

              {/* Mandatory booking-continuation choice — mirrors the hotel
                  booking page's "Book and Pay Now / Hold Room and Pay Later"
                  option. Gated by the Confirm booking button in PaxInformation. */}
              {currentStep === 2 && (
                <div className="sidebar-pay-card">
                  <div className="sidebar-pay-title">
                    <FaCheckCircle className="me-2" />
                    Are you sure you want to continue with the booking?
                    <span className="sidebar-pay-required">required</span>
                  </div>
                  <div className="d-flex flex-column gap-2 mt-1">
                    <Form.Check
                      type="radio"
                      id="pkg-book-pay-now"
                      name="pkgBookingConfirmation"
                      label="Book Package and Pay Now"
                      value="Book & Voucher"
                      checked={
                        bookingData.programme.bookingConfirmation ===
                        "Book & Voucher"
                      }
                      onChange={(e) =>
                        updateProgramme({ bookingConfirmation: e.target.value })
                      }
                    />
                    <Form.Check
                      type="radio"
                      id="pkg-hold-pay-later"
                      name="pkgBookingConfirmation"
                      label="Hold Package and Pay Later"
                      value="Book Now & Voucher later"
                      checked={
                        bookingData.programme.bookingConfirmation ===
                        "Book Now & Voucher later"
                      }
                      onChange={(e) =>
                        updateProgramme({ bookingConfirmation: e.target.value })
                      }
                    />
                  </div>
                </div>
              )}
              </div>

              <style>{`
                /* Matches the .booking-summary card in the hero above and the
                   .price-sidebar-card block — same --rl-* palette, same
                   border, same rhythm. */
                .sidebar-pay-card {
                  border: 1px solid var(--rl-border, #e2e8f0);
                  border-radius: 14px;
                  padding: 14px 16px;
                  background: var(--rl-card, #ffffff);
                  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08);
                  margin-top: 16px;
                }
                /* Cancellation Policies & Terms card — same shell as
                   .sidebar-pay-card so the sidebar cards read as one
                   consistent stack. Sits below the Total Price card,
                   above the (step 2) Mode of Payment card. */
                .sidebar-policy-card {
                  border: 1px solid var(--rl-border, #e2e8f0);
                  border-radius: 14px;
                  padding: 12px 16px;
                  background: var(--rl-card, #ffffff);
                  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08);
                  margin-top: 16px;
                }
                .sidebar-pay-title {
                  display: flex;
                  align-items: center;
                  font-weight: 600;
                  font-size: 0.85rem;
                  color: #1e293b;
                  margin-bottom: 10px;
                }
                .sidebar-pay-required {
                  margin-left: auto;
                  font-size: 0.6rem;
                  letter-spacing: 0.08em;
                  text-transform: uppercase;
                  color: #b91c1c;
                  background: #fee2e2;
                  padding: 2px 8px;
                  border-radius: 999px;
                  font-weight: 700;
                }
                .sidebar-pay-select {
                  border: 1.5px solid #e5e7eb !important;
                  border-radius: 10px !important;
                  font-size: 0.85rem !important;
                  padding: 0.55rem 0.75rem !important;
                  color: #1e293b !important;
                  background-color: #ffffff !important;
                }
                .sidebar-pay-select:focus {
                  border-color: #2563eb !important;
                  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12) !important;
                }
                /* Pure-red "Cancellation Policies & Terms" link under Total
                   Price. The outer button just centers a compact inline group
                   so the shield sits IMMEDIATELY next to the text — even when
                   the label wraps to two lines. */
                .price-policy-link {
                  display: flex;
                  align-items: flex-start;
                  justify-content: center;
                  width: 100%;
                  border: none;
                  background: transparent;
                  color: #EC0B43;
                  font-weight: 700;
                  font-size: 0.82rem;
                  line-height: 1.35;
                  cursor: pointer;
                  padding: 2px 0;
                  transition: color 0.15s ease;
                }
                .price-policy-link:hover { color: #b8092f; }
                .policy-link-icon {
                  flex-shrink: 0;
                  margin-right: 6px;
                  margin-top: 3px; /* aligns with the first line of text */
                  font-size: 0.9em;
                }
                .policy-link-text {
                  text-decoration: underline;
                  text-underline-offset: 2px;
                  text-align: center;
                }
              `}</style>
            </Col>
          </Row>
          </div>
        </main>
      </div>

      {/* ── Cancellation Policies & Terms & Conditions popup ──
          Opened from the red link under the Total Price card. Shows the same
          cancellation policy that appears at the bottom of the Package Details
          step, plus the package's Terms & Conditions. */}
      <Modal
        show={showPolicyModal}
        onHide={() => setShowPolicyModal(false)}
        centered
        size="lg"
        scrollable
      >
        <Modal.Header closeButton style={{ background: "#f8fafc" }}>
          <Modal.Title
            className="d-flex align-items-center"
            style={{ fontSize: "1.05rem" }}
          >
            <FaShieldAlt className="me-2" style={{ color: "#EC0B43" }} />
            Cancellation Policies &amp; Terms &amp; Conditions
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4">
          {/* Cancellation policy — matches the room-list "Cancellation Policy"
              block (see RoomList.jsx:2020-2047) and the equivalent block on
              the Package Details step (HotelsTab.jsx): red danger-toned h6
              heading with the solid X-circle icon, and a bulleted <ul> list.
              The NON-REFUNDABLE note is folded in as the final list item so
              the emphasis carries over without a separate callout row. */}
          <h6 className="text-danger mb-3">
            <FaTimesCircle className="me-2" />
            Cancellation Policy
          </h6>
          <ul className="mb-0 ps-3">
            {cancellationParts.map((p, i) => (
              <li key={i} className="mb-2">
                <div style={{ whiteSpace: "pre-line" }}>{p.text}</div>
              </li>
            ))}
            <li className="mb-0 text-danger">
              <FaShieldAlt className="me-2" />
              This is a <strong>NON-REFUNDABLE</strong> package within the charge window.
            </li>
          </ul>

          {/* Includes — moved here from the removed Package Information card
              on the Package Details step. Same "empty state" fallback as
              before so operators still see the "will be uploaded by supplier"
              hint when the package has no inclusions attached yet. */}
          <h6 className="text-success mb-3 mt-4">
            <FaCheckCircle className="me-2" />
            Includes
          </h6>
          {inclusions.length > 0 ? (
            <ul className="mb-0 ps-3">
              {inclusions.map((x) => (
                <li key={`inc-${x.otherId}`} className="mb-2">
                  {x.description}
                </li>
              ))}
            </ul>
          ) : (
            <p className="small text-muted fst-italic mb-0">
              Includes will be uploaded by supplier.
            </p>
          )}

          {/* Excludes — same treatment as Includes above. */}
          <h6 className="text-danger mb-3 mt-4">
            <FaTimesCircle className="me-2" />
            Excludes
          </h6>
          {exclusions.length > 0 ? (
            <ul className="mb-0 ps-3">
              {exclusions.map((x) => (
                <li key={`exc-${x.otherId}`} className="mb-2">
                  {x.description}
                </li>
              ))}
            </ul>
          ) : (
            <p className="small text-muted fst-italic mb-0">
              Excludes will be uploaded by supplier.
            </p>
          )}

          {/* Terms & Conditions */}
          <h6
            className="fw-bold d-flex align-items-center mb-2 mt-4"
            style={{ color: "#1e293b" }}
          >
            <FaFileContract className="me-2 text-danger" /> Terms &amp; Conditions
          </h6>
          {termsList.length > 0 ? (
            <ul className="small mb-0 ps-3">
              {termsList.map((t) => (
                <li key={t.otherId} className="mb-2">
                  {t.description}
                </li>
              ))}
            </ul>
          ) : (
            <p className="small text-muted fst-italic mb-0">
              No specific terms were attached to this package. By proceeding you
              confirm you have read the cancellation window and accept the
              standard package conditions.
            </p>
          )}
        </Modal.Body>
        <Modal.Footer style={{ background: "#f1f5f9" }}>
          <Button
            variant="outline-secondary"
            onClick={() => setShowPolicyModal(false)}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default PackageBooking;