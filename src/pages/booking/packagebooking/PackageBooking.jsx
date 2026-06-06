import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { Row, Col, Spinner } from "react-bootstrap";
import Sidebar from "../../../components/Sidebar";
import TopBar from "../../../components/TopBar";
import AgentBalanceDisplay from "../../../components/AgentBalanceDisplay";
import axiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import { FaChevronLeft } from "react-icons/fa";

import BasicDetails from "./tabs/BasicDetails";
import HotelsTab from "./tabs/HotelsTab";
import CabsTab from "./tabs/CabsTab";
import ActivitiesTab from "./tabs/ActivitiesTab";
import PaxInformation from "./tabs/PaxInformation";

import "../../../styles/PackageBooking_Stepper.css";

const STEPS = ["Basic Details", "Hotels", "Pax Info"];

const PackageBooking = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { agentId, destinationCountryId, mode, bookingId } =
    location.state || {};
  const isEditMode = mode === "edit" && bookingId;

  // Amend → child-booking flow (mirrors Hotel "ADD NEW ITEM").
  // PackageBookingDetailView's Amend navigates here with
  // ?parentBookingCode=GPKG-... so the backend can stamp "{parent}/{n}"
  // for the new booking on submit. Threaded through to PaxInformation.
  const parentBookingCode = new URLSearchParams(location.search).get(
    "parentBookingCode"
  );

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
      adultCount: 1,
      childCount: 0,
      infantCount: 0,
      childAge: "",
      infantAge: "",
      packageCategory: "",
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
  });

  const [totalPrice, setTotalPrice] = useState(0);

  useEffect(() => {
    const fetchPackageDetails = async () => {
      try {
        setIsLoading(true);
        const response = await axiosInstance.get(`/api/packageRates/${id}`);
        setPackageData(response.data);
        setTotalPrice(Number(response.data?.rate) || 0);
      } catch (error) {
        console.error("Error fetching package details:", error);
      } finally {
        setIsLoading(false);
      }
    };
    if (id) fetchPackageDetails();
  }, [id]);

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
        }));
      } catch (err) {
        console.error("Edit-mode load failed:", err);
        toast.error("Failed to load booking for amendment");
      }
    };
    loadExistingBooking();
  }, [isEditMode, bookingId]);

  useEffect(() => {
    const baseRate = Number(packageData?.rate) || 0;
    const { hotelPrice, cabPrice, activityPrice } = bookingData.selections;
    
    // If hotelPrice is present (meaning hotels were fetched and have a markup rate), 
    // it should be the new base for the package total.
    const effectiveBase = hotelPrice > 0 ? hotelPrice : baseRate;
    
    setTotalPrice(effectiveBase + cabPrice + activityPrice);
  }, [bookingData.selections, packageData]);

  const updateSearchParams = (params) =>
    setBookingData((prev) => ({ ...prev, searchParams: { ...prev.searchParams, ...params } }));

  const updateSelections = (selections) =>
    setBookingData((prev) => ({ ...prev, selections: { ...prev.selections, ...selections } }));

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

  const progressWidth = `${(currentStep - 1) * 50}%`;

  const renderStep = () => {
    switch (currentStep) {
      case 1: return <BasicDetails data={bookingData.searchParams} updateData={updateSearchParams} onNext={() => setCurrentStep(2)} />;
      case 2: return <HotelsTab searchParams={bookingData.searchParams} bookingData={bookingData.selections} updateData={updateSelections} onPrev={() => setCurrentStep(1)} onNext={() => setCurrentStep(3)} />;
      case 3: return <PaxInformation
                        searchParams={bookingData.searchParams}
                        bookingData={bookingData}
                        updateData={setBookingData}
                        onPrev={() => setCurrentStep(2)}
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
    <div className="min-vh-100 d-flex flex-column" style={{ background: "#f0f4f8" }}>
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

          <Row className="g-4 align-items-start">
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
              </div>
            </Col>
          </Row>
        </main>
      </div>
    </div>
  );
};

export default PackageBooking;