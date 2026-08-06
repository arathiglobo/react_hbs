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
  { value: "CREDIT", label: "Agent credit limit" },
  { value: "CARD", label: "Card payment" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "CASH", label: "Cash" },
];

const PackageBooking = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  // location.state is the historical channel (in-tab navigate). The
  // search page now opens this route in a NEW TAB, so values are also
  // accepted via URL query params and we fall back to those when state
  // is empty.
  const urlParams = new URLSearchParams(location.search);
  const stateData = location.state || {};
  const agentId =
    stateData.agentId || urlParams.get("agentId") || "";
  const destinationCountryId =
    stateData.destinationCountryId ||
    urlParams.get("destinationCountryId") ||
    "";
  const searchRate =
    stateData.searchRate != null
      ? stateData.searchRate
      : urlParams.get("searchRate");
  // Nationality picked on the Package Search page (?nationalityId=&
  // nationalityName=). Seeds the booking's native country / "Pax passport"
  // so the operator doesn't re-enter it — the Hotels, Cabs and Activities
  // steps all send nativeCountry with their rate lookups.
  const searchNationalityId =
    stateData.nationalityId ?? urlParams.get("nationalityId");
  const searchNationalityName =
    stateData.nationalityName ?? urlParams.get("nationalityName");
  // "Booking Done By Employee" picked on the Package Search page. Carried
  // through to the submit payload so it is persisted on the booking.
  const searchEmployeeId =
    stateData.employeeId ?? urlParams.get("employeeId");
  // Rooms & Guests selection carried over from the Package Search page
  // (?adultCount=&childCount=&childAges=). Seeds the initial pax counts so
  // the booking defaults to what was chosen on the search screen; the user
  // can still adjust them, and picking a package category still overrides
  // them (see BasicDetails.jsx).
  const searchAdultCount =
    stateData.adultCount ?? urlParams.get("adultCount");
  const searchChildCount =
    stateData.childCount ?? urlParams.get("childCount");
  const searchChildAges =
    stateData.childAges ?? urlParams.get("childAges");
  // Category resolved by the search page for the chosen occupancy — replaces
  // the removed Basic Details category picker. Drives the Hotels fetch and the
  // Total Price sharing multiplier.
  const searchPackageCategory =
    stateData.packageCategory ?? urlParams.get("packageCategory");
  const searchPackageCategoryName =
    stateData.packageCategoryName ?? urlParams.get("packageCategoryName");
  const { mode, bookingId } = stateData;
  const isEditMode = mode === "edit" && bookingId;

  // Amend → child-booking flow (mirrors Hotel "ADD NEW ITEM").
  // PackageBookingDetailView's Amend navigates here with
  // ?parentBookingCode=GPKG-... so the backend can stamp "{parent}/{n}"
  // for the new booking on submit. Threaded through to PaxInformation.
  const parentBookingCode = urlParams.get("parentBookingCode");

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
    const { hotelPrice, cabPrice, activityPrice } = bookingData.selections;

    // Show the package rate exactly as it appeared on the search card until
    // the user actually picks a hotel. Applying any category- or pax-based
    // multiplier here would make the sidebar disagree with the number the
    // user clicked "Book Now" on for their package. Once a hotel IS
    // selected, its totalRateWithMarkup is the authoritative charge
    // (already pax-sized by the backend as
    // perAdultRate*adultCount + perChildRate*childCount + markup), so it
    // takes over directly.
    const packageTotal = hotelPrice > 0 ? hotelPrice : baseRate;

    setTotalPrice(packageTotal + cabPrice + activityPrice);
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
  const heroRoomCount =
    Number(urlParams.get("noOfRooms")) || 1;
  const heroNationality =
    urlParams.get("nationalityName") ||
    bookingData?.searchParams?.nationalityName ||
    "—";
  const heroPackageType =
    packageView?.packageTypeName || packageData?.packageType || "";
  const heroPackageCategory =
    bookingData?.searchParams?.packageCategoryName ||
    urlParams.get("packageCategoryName") ||
    "";
  const heroDestination =
    packageView?.arriveCountryName ||
    (Array.isArray(packageView?.arrivePlaces) && packageView.arrivePlaces.length
      ? packageView.arrivePlaces.map((p) => p.name).filter(Boolean).join(", ")
      : "");

  // Cancellation policy + Terms & Conditions for the popup. Same derivation as
  // the Package Details step's cancellation card, kept in sync.
  const termsList = Array.isArray(packageView?.termsAndConditions)
    ? packageView.termsAndConditions
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

  const renderStep = () => {
    switch (currentStep) {
      case 1: return <HotelsTab
                        searchParams={bookingData.searchParams}
                        bookingData={bookingData.selections}
                        programme={bookingData.programme}
                        updateData={updateSelections}
                        updateProgramme={updateProgramme}
                        onPrev={() => navigate("/new-booking/package-search")}
                        onNext={() => setCurrentStep(2)} />;
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
    // Room-List chrome — same outer classes as /room-list so the --rl-* CSS
    // variables in RoomList.css resolve for the hero + booking-summary cards
    // rendered inside. Replaces the previous inline pink→neutral gradient.
    <div className="min-vh-100 bg-light d-flex flex-column room-list-container">
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
                Direct sibling of /room-list's Hotel Header card — same
                .hotel-header-card shell, .hotel-icon rounded-square badge,
                .hotel-name / .hotel-details typography, and a right-side
                .booking-summary card so the two pages read as one system. */}
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
                              <p className="someproperties">
                                Review the full itinerary, inclusions and
                                cancellation policy below before completing
                                the booking. Rates are per person and exclude
                                flights, visas and personal expenses unless
                                explicitly listed under Inclusions.
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
                              {formatDateForDisplay(heroCheckIn) || "—"}
                            </span>
                          </div>
                          <div className="d-flex justify-content-between mb-2">
                            <span>
                              <FaCalendarAlt className="text-muted me-2" />
                              Check-out:
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
                          <div className="d-flex justify-content-between mb-2">
                            <span>
                              <FaBed className="text-muted me-2" />
                              Rooms:
                            </span>
                            <span className="fw-semibold">
                              {heroRoomCount}
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

          <Row className="g-4">
            {/* ── Main card ── */}
            <Col lg={9}>
              <div className="main-booking-card">
                {/* Tab content */}
                <div className="tab-content-area">
                  {renderStep()}
                </div>
              </div>
            </Col>

            {/* ── Price sidebar ── */}
            <Col lg={3}>
              {/* The sidebar block is sticky-pinned near the top of the
                  viewport (see .sidebar-stack in PackageBooking_Stepper.css)
                  so the Total Price stays visible while the operator scrolls
                  through the main content. It unpins naturally when its
                  column ends. */}
              <div className="sidebar-stack">
              <div className="price-sidebar-card">
                <div className="price-sidebar-label">Total Price</div>
                <div className="price-sidebar-amount">
                  {totalPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="price-sidebar-sub">AED · Selling price</div>

                <hr className="price-divider" />

                {/* <div className="price-breakdown-row">
                  <span className="price-breakdown-label">Base fare</span>
                  <span className="price-breakdown-value">
                    {Number(packageData?.rate || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div> */}

                {bookingData.selections.hotelPrice > 0 && (
                  <div className="price-breakdown-row">
                    <span className="price-breakdown-label">Hotels</span>
                    <span className="price-breakdown-value">
                      {bookingData.selections.hotelPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                {bookingData.selections.cabPrice > 0 && (
                  <div className="price-breakdown-row">
                    <span className="price-breakdown-label">Cabs</span>
                    <span className="price-breakdown-value">
                      {bookingData.selections.cabPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                {bookingData.selections.activityPrice > 0 && (
                  <div className="price-breakdown-row">
                    <span className="price-breakdown-label">Activities</span>
                    <span className="price-breakdown-value">
                      {bookingData.selections.activityPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                <hr className="price-divider" />

                {/* Step indicator */}
                <div style={{ fontSize: "0.72rem", color: "#94a3b8", textAlign: "center" }}>
                  Step {currentStep} of {STEPS.length} &mdash; {STEPS[currentStep - 1]}
                </div>

                {/* Cancellation Policies & Terms — opens the policy popup. */}
                <hr className="price-divider" />
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

              {/* Mode of payment — only shown on the Pax Info step (now
                  step 2 after Basic Details was removed). Sits next to the
                  Total Price the user is about to commit to. */}
              {currentStep === 2 && (
                <div className="sidebar-pay-card">
                  <div className="sidebar-pay-title">
                    <FaCreditCard className="me-2" />
                    Mode of payment
                    <span className="sidebar-pay-required">required</span>
                  </div>
                  <Form.Select
                    aria-label="Mode of payment"
                    className="sidebar-pay-select"
                    value={bookingData.programme.modeOfPayment || ""}
                    onChange={(e) =>
                      updateProgramme({ modeOfPayment: e.target.value })
                    }
                  >
                    <option value="">Select payment mode</option>
                    {PAYMENT_MODES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </Form.Select>
                </div>
              )}

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
                  color: #FF0000;
                  font-weight: 700;
                  font-size: 0.82rem;
                  line-height: 1.35;
                  cursor: pointer;
                  padding: 2px 0;
                  transition: color 0.15s ease;
                }
                .price-policy-link:hover { color: #CC0000; }
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