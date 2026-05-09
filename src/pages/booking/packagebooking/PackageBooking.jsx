import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { Row, Col, Spinner } from "react-bootstrap";
import Sidebar from "../../../components/Sidebar";
import TopBar from "../../../components/TopBar";
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
  const { agentId, destinationCountryId } = location.state || {};

  const [currentStep, setCurrentStep] = useState(1);
  const [packageData, setPackageData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

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
    paxInfo: {
      contactTitle: "Mr",
      contactName: "",
      contactEmail: "",
      contactMobile: "",
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

          {/* Page header */}
          <div className="mb-4">
            <Link to="/new-booking/package-search" className="back-link mb-2 d-inline-flex">
              <FaChevronLeft size={10} /> Back to search
            </Link>
            <h1 className="page-title mb-0">Package Booking</h1>
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