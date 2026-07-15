import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { Row, Col, Spinner, Form, Modal, Button } from "react-bootstrap";
import Sidebar from "../../../components/Sidebar";
import TopBar from "../../../components/TopBar";
import AgentBalanceDisplay from "../../../components/AgentBalanceDisplay";
import axiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import {
  FaChevronLeft,
  FaCreditCard,
  FaCheckCircle,
  FaShieldAlt,
  FaRegClock,
  FaTimesCircle,
  FaFileContract,
} from "react-icons/fa";

import HotelsTab from "./tabs/HotelsTab";
import CabsTab from "./tabs/CabsTab";
import ActivitiesTab from "./tabs/ActivitiesTab";
import PaxInformation from "./tabs/PaxInformation";
// Basic Details step removed — package category is now resolved from the
// occupancy chosen on the Package Search page, and Pax passport moved to the
// Pax Info step. BasicDetails.jsx is intentionally no longer imported.

import "../../../styles/PackageBooking_Stepper.css";

const STEPS = ["Package Details", "Pax Info"];

// Mode of payment options — rendered in the right sidebar on the Pax Info
// step (moved from the Hotels step). Stored on bookingData.programme.modeOfPayment.
const PAYMENT_MODES = [
  { value: "CREDIT", label: "Agent credit limit" },
  { value: "CARD", label: "Card payment" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "CASH", label: "Cash" },
];

// Per-person price multiplier based on the package's sharing category.
// The searched rate is treated as the Triple Sharing baseline (1.0x);
// fewer people sharing a room costs more per person, more sharing costs
// less. Matches standard hotel/package pricing convention.
const getCategoryPriceMultiplier = (categoryName) => {
  const name = String(categoryName || "").trim().toLowerCase();
  if (!name) return 1;
  if (name.includes("single")) return 2.0;
  if (name.includes("twin") || name.includes("double")) return 1.4;
  if (name.includes("triple")) return 1.0;
  if (name.includes("quad")) return 0.8;
  return 1;
};

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
      paxPassport: null,
      nativeCountry: "",
      agentId: agentId || "",
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

    // If hotelPrice is present (meaning hotels were fetched and have a markup rate),
    // it should be the new base for the package total.
    const effectiveBase = hotelPrice > 0 ? hotelPrice : baseRate;

    // Apply the sharing-category multiplier (single = 2x, twin = 1.4x,
    // triple = 1x, quadruple = 0.8x). Name is pushed up from BasicDetails
    // when the user picks a category; falls back to 1x while empty.
    const categoryMultiplier = getCategoryPriceMultiplier(
      bookingData.searchParams.packageCategoryName,
    );

    setTotalPrice(effectiveBase * categoryMultiplier + cabPrice + activityPrice);
  }, [bookingData.selections, bookingData.searchParams.packageCategoryName, packageData, searchRate]);

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

  // Two steps now (Basic Details removed): the track fills fully at step 2.
  const progressWidth = `${(currentStep - 1) * 100}%`;

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
    <div
      className="min-vh-100 d-flex flex-column"
      // Soft rose hero band fading into the neutral page background —
      // mirrors the Package Search page's branded feel.
      style={{
        background:
          "linear-gradient(180deg, #FFE9F0 0%, #FDF3F6 160px, #F0F4F8 420px)",
      }}
    >
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 booking-stepper-container">

          <div className="d-flex justify-content-end mb-2">
            <AgentBalanceDisplay agentId={agentId} />
          </div>

          {/* Page header */}
          <div className="mb-4">
            <Link to="/new-booking/package-search" className="back-link mb-2 d-inline-flex">
              <FaChevronLeft size={10} /> Back to search
            </Link>
            <h1 className="page-title mb-0">
              {editingBookingId ? "Amend Package Booking" : "Package Booking"}
            </h1>
          </div>

          <Row className="g-4">
            {/* ── Main card ── */}
            <Col lg={9}>
              <div className="main-booking-card">

                {/* Package name strip */}
                <div className="booking-package-name">
                  <span className="package-subtitle">Booking for &nbsp;</span>
                  {packageData?.packageName || "Package"}
                </div>

                {/* Stepper */}
                <div className="stepper-wrapper">
                  <div className="stepper-header">
                    <div className="stepper-track">
                      <div className="stepper-track-fill" style={{ width: progressWidth }} />
                    </div>
                    {STEPS.map((label, i) => {
                      const step = i + 1;
                      return (
                        <div
                          key={step}
                          className={`step-item ${currentStep === step ? "active" : ""} ${currentStep > step ? "completed" : ""}`}
                        >
                          <div className="step-circle">
                            {currentStep > step ? (
                              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                <path d="M2.5 7l3 3 6-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            ) : step}
                          </div>
                          <div className="step-label">{label}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Tab content */}
                <div className="tab-content-area">
                  {renderStep()}
                </div>
              </div>
            </Col>

            {/* ── Price sidebar ── */}
            <Col lg={3}>
              {/* One sticky wrapper so Total Price + Mode of payment move and
                  pin together when scrolling, just below the header. */}
              <div className="sidebar-sticky">
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
                  <FaShieldAlt className="me-2" />
                  Cancellation Policies &amp; Terms &amp; Conditions
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
                      label="Book and Pay Now"
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
                .sidebar-pay-card {
                  border: 1.5px solid #e5e7eb;
                  border-radius: 14px;
                  padding: 14px 16px;
                  background: #fff;
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
                /* Red "Cancellation Policies & Terms" link under Total Price */
                .price-policy-link {
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  gap: 2px;
                  width: 100%;
                  border: none;
                  background: transparent;
                  color: #EC0B43;
                  font-weight: 700;
                  font-size: 0.82rem;
                  line-height: 1.35;
                  text-decoration: underline;
                  text-align: center;
                  cursor: pointer;
                  padding: 2px 0;
                  transition: color 0.15s ease;
                }
                .price-policy-link:hover { color: #b3082f; }
              `}</style>
            </Col>
          </Row>
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
          {/* Cancellation policy */}
          <h6
            className="fw-bold d-flex align-items-center mb-2"
            style={{ color: "#92400e" }}
          >
            <FaRegClock className="me-2" /> Cancellation Policy
          </h6>
          <div className="mb-2">
            {cancellationParts.map((p, i) => (
              <div
                key={i}
                className="small mb-2 p-2 rounded"
                style={{
                  background:
                    p.tone === "ok"
                      ? "rgba(16,185,129,0.12)"
                      : p.tone === "warn"
                        ? "rgba(249,115,22,0.14)"
                        : "rgba(148,163,184,0.15)",
                  color:
                    p.tone === "ok"
                      ? "#065f46"
                      : p.tone === "warn"
                        ? "#9a3412"
                        : "#475569",
                }}
              >
                {p.text}
              </div>
            ))}
            <div
              className="small mt-2 p-2 rounded d-flex align-items-center"
              style={{ background: "rgba(239,68,68,0.1)", color: "#b91c1c" }}
            >
              <FaShieldAlt className="me-2 flex-shrink-0" />
              <span>
                This is a <strong>NON-REFUNDABLE</strong> package within the
                charge window.
              </span>
            </div>
          </div>

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