import React, { useState, useEffect } from "react";
import { Row, Col, Spinner } from "react-bootstrap";
import axiosInstance from "../../../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import {
  FaHotel,
  FaCheckCircle,
  FaTimesCircle,
  FaPhoneAlt,
  FaEnvelope,
  FaPlaneDeparture,
  FaCalendarCheck,
  FaMapMarkerAlt,
  FaChevronDown,
  FaShieldAlt,
  FaCreditCard,
  FaUniversity,
  FaMoneyBillWave,
  FaWallet,
  FaRegClock,
} from "react-icons/fa";

const PAYMENT_MODES = [
  { value: "CREDIT", label: "Agent credit limit", icon: FaWallet },
  { value: "CARD", label: "Card payment", icon: FaCreditCard },
  { value: "BANK_TRANSFER", label: "Bank transfer", icon: FaUniversity },
  { value: "CASH", label: "Cash", icon: FaMoneyBillWave },
];

const HotelsTab = ({ searchParams, bookingData, programme, updateData, updateProgramme, onPrev, onNext }) => {
  const [hotels, setHotels] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [packageView, setPackageView] = useState(null);
  const [isPackageLoading, setIsPackageLoading] = useState(false);
  const [openDays, setOpenDays] = useState({ 0: true });

  const formatDateForApi = (dateStr) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  };

  // Rich package view drives the static programme blocks (day-wise
  // itinerary, includes / excludes, cancellation policy). Same endpoint
  // as the detail-view page and the email-as-PDF feature.
  useEffect(() => {
    const pkgId = searchParams.packageId;
    if (!pkgId) return;
    let cancelled = false;
    (async () => {
      try {
        setIsPackageLoading(true);
        const res = await axiosInstance.get(`/api/TravelPackage/view/${pkgId}`);
        if (!cancelled) setPackageView(res.data || null);
      } catch (err) {
        console.error("Failed to load package view:", err);
      } finally {
        if (!cancelled) setIsPackageLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [searchParams.packageId]);

  useEffect(() => {
    fetchHotels();
  }, [searchParams]);

  const fetchHotels = async () => {
    try {
      setIsLoading(true);
      setHasSearched(true);
      const payload = {
        countryId: searchParams.destinationCountryId || "",
        packageid: searchParams.packageId || "",
        packageCategoryid: searchParams.packageCategory || "",
        travelDate: formatDateForApi(searchParams.travelDate) || "",
        adultCount: String(searchParams.adultCount || 1),
        childCount: String(searchParams.childCount || 0),
        infantCount: String(searchParams.infantCount || 0),
        childAge: searchParams.childAge || "",
        infantAge: searchParams.infantAge || "",
        nativeCountry: String(searchParams.nativeCountry || ""),
        agentId: String(searchParams.agentId || ""),
      };

      const response = await axiosInstance.post("/api/v1/package-booking/hotel-details", payload);
      setHotels(Array.isArray(response.data) ? response.data : []);

      if (!response.data?.length) {
        toast.error("No hotels available for the selected criteria.");
      } else {
        toast.success(`Found ${response.data.length} hotels.`);
      }
    } catch (error) {
      console.error("Error searching hotels:", error);
      toast.error("Failed to fetch hotels");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (hotels.length > 0) {
      const totalPrice = Number(hotels[0]?.totalRateWithMarkup || 0);
      updateData({
        selectedHotels: hotels,
        hotelPrice: totalPrice,
      });
    }
  }, [hotels]);

  const setField = (field, value) => updateProgramme({ [field]: value });

  const toggleDay = (idx) =>
    setOpenDays((prev) => ({ ...prev, [idx]: !prev[idx] }));

  const nights = packageView?.noOfNights || "";
  const nightsInt = parseInt(nights, 10);
  const daysInt = Number.isFinite(nightsInt) ? nightsInt + 1 : null;

  const itineraries = Array.isArray(packageView?.itineraries) ? packageView.itineraries : [];
  const inclusions = Array.isArray(packageView?.inclusions) ? packageView.inclusions : [];
  const exclusions = Array.isArray(packageView?.exclusions) ? packageView.exclusions : [];

  const cancellationParts = (() => {
    const free = packageView?.cancellationDaysFree;
    const withCharge = packageView?.cancellationDaysWithCharge;
    const type = packageView?.cancellationChargeType;
    const value = packageView?.cancellationChargeValue;
    if (free == null && withCharge == null && !value) {
      return [{ tone: "muted", text: "Cancellation policy will be confirmed by the supplier." }];
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
        chargeText = type && type.toLowerCase() === "percent" ? `${value}%` : value;
      }
      parts.push({
        tone: "warn",
        text: `Within ${withCharge} day${withCharge === 1 ? "" : "s"} of travel${chargeText ? `, ${chargeText} cancellation charge applies` : ", cancellation charge applies"}.`,
      });
    }
    return parts;
  })();

  return (
    <div className="tab-pane-active">
      {/* ────── HERO: package summary + journey inputs ────── */}
      <div className="prg-hero mb-3">
        <Row className="g-3 align-items-center">
          <Col md={7}>
            <div className="prg-hero-eyebrow">SELECTED PACKAGE</div>
            <div className="prg-hero-title">
              {nights ? (
                <>
                  <strong>{String(nights).padStart(2, "0")} Nights</strong>
                  <span className="prg-hero-divider">/</span>
                  <strong>{String(daysInt ?? "").padStart(2, "0")} Days</strong>
                </>
              ) : (
                "Package Programme"
              )}
            </div>
            <div className="prg-hero-sub">
              Confirm your journey details below. The full programme — what's
              included, what's not, and the cancellation window — is shown on the right.
            </div>
          </Col>
          <Col md={5}>
            <div className="prg-hero-inputs">
              <label className="prg-hero-input-row">
                <span className="prg-hero-input-icon"><FaCalendarCheck /></span>
                <span className="prg-hero-input-body">
                  <span className="prg-hero-input-label">Check-in date</span>
                  <input
                    type="date"
                    value={programme.checkInDate || ""}
                    onChange={(e) => setField("checkInDate", e.target.value)}
                  />
                </span>
              </label>
              <label className="prg-hero-input-row">
                <span className="prg-hero-input-icon"><FaPlaneDeparture /></span>
                <span className="prg-hero-input-body">
                  <span className="prg-hero-input-label">Flight details</span>
                  <input
                    type="text"
                    placeholder="EK 503  STN-DXB  21:45 / 06:50"
                    value={programme.flightDetails || ""}
                    onChange={(e) => setField("flightDetails", e.target.value)}
                  />
                </span>
              </label>
            </div>
          </Col>
        </Row>
      </div>

      {/* ────── Programme grid: itinerary | inc/exc | confirmation ────── */}
      <Row className="g-3 mb-3">
        {/* Left: Day-wise itinerary */}
        <Col lg={6}>
          <div className="prg-section">
            <div className="prg-section-head">
              <FaMapMarkerAlt className="me-2" />
              <span>Day-wise Itinerary</span>
              {itineraries.length > 0 && (
                <span className="prg-section-pill">{itineraries.length} day{itineraries.length === 1 ? "" : "s"}</span>
              )}
            </div>
            <div className="prg-section-body">
              {isPackageLoading ? (
                <div className="prg-loading">
                  <Spinner animation="border" size="sm" /> <span>Loading itinerary…</span>
                </div>
              ) : itineraries.length === 0 ? (
                <div className="prg-empty">No itinerary uploaded for this package yet.</div>
              ) : (
                <div className="prg-timeline">
                  {itineraries.map((it, idx) => {
                    const open = !!openDays[idx];
                    return (
                      <div key={`day-${it.day}-${idx}`} className={`prg-day ${open ? "open" : ""}`}>
                        <button
                          type="button"
                          className="prg-day-head"
                          onClick={() => toggleDay(idx)}
                        >
                          <span className="prg-day-num">{String(it.day).padStart(2, "0")}</span>
                          <span className="prg-day-title">
                            <span className="prg-day-title-main">
                              Day {String(it.day).padStart(2, "0")}
                              {it.heading ? ` – ${it.heading}` : ""}
                            </span>
                            {it.placeName && (
                              <span className="prg-day-place">
                                <FaMapMarkerAlt size={10} /> {it.placeName}
                              </span>
                            )}
                          </span>
                          <FaChevronDown className="prg-day-chev" />
                        </button>
                        {open && it.dayActivities && (
                          <div className="prg-day-body">
                            <p style={{ whiteSpace: "pre-line", margin: 0 }}>
                              {it.dayActivities}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </Col>

        {/* Middle: Includes / Excludes */}
        <Col lg={3}>
          <div className="prg-section prg-section-ok mb-3">
            <div className="prg-section-head">
              <FaCheckCircle className="me-2" />
              <span>Includes</span>
            </div>
            <div className="prg-section-body">
              {inclusions.length === 0 ? (
                <div className="prg-empty">Includes will be uploaded by supplier.</div>
              ) : (
                <ul className="prg-bullets prg-bullets-ok">
                  {inclusions.map((x) => (
                    <li key={`inc-${x.otherId}`}>{x.description}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="prg-section prg-section-warn">
            <div className="prg-section-head">
              <FaTimesCircle className="me-2" />
              <span>Excludes</span>
            </div>
            <div className="prg-section-body">
              {exclusions.length === 0 ? (
                <div className="prg-empty">Excludes will be uploaded by supplier.</div>
              ) : (
                <ul className="prg-bullets prg-bullets-warn">
                  {exclusions.map((x) => (
                    <li key={`exc-${x.otherId}`}>{x.description}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Col>

        {/* Right: Confirmation + cancellation */}
        <Col lg={3}>
          <div className="prg-info-card mb-3">
            <div className="prg-info-title">
              <FaEnvelope className="me-2" />After booking
            </div>
            <p className="prg-info-text">
              A confirmation will be sent to your email within{" "}
              <strong>12 hours</strong> with the package subject code.
            </p>
            <p className="prg-info-hint">Don't forget to check your junk folder.</p>
            <div className="prg-info-divider" />
            <div className="prg-info-title small">
              <FaPhoneAlt className="me-2" />Need help?
            </div>
            <a href="tel:+971561752667" className="prg-info-link">+971 56 175 2667</a>
            <a href="mailto:support@ibyta.com" className="prg-info-link">support@ibyta.com</a>
          </div>

          <div className="prg-cxl-card">
            <div className="prg-cxl-title">
              <FaRegClock className="me-2" />Cancellation policy
            </div>
            {cancellationParts.map((p, i) => (
              <div key={i} className={`prg-cxl-line prg-cxl-${p.tone}`}>{p.text}</div>
            ))}
            <div className="prg-cxl-note">
              <FaShieldAlt className="me-2" />
              This is a <strong>NON-REFUNDABLE</strong> package within the charge window.
            </div>
          </div>
        </Col>
      </Row>

      {/* ────── Hotels in the package ────── */}
      <div className="prg-section mb-3">
        <div className="prg-section-head">
          <FaHotel className="me-2" />
          <span>Hotels included in this package</span>
          {hotels.length > 0 && (
            <span className="prg-section-pill">{hotels.length} hotel{hotels.length === 1 ? "" : "s"}</span>
          )}
        </div>
        <div className="prg-section-body">
          {isLoading ? (
            <div className="prg-loading">
              <Spinner animation="border" size="sm" /> <span>Searching for hotels…</span>
            </div>
          ) : hasSearched && hotels.length > 0 ? (
            <Row className="g-3">
              {hotels.map((hotel) => (
                <Col key={hotel.hotelId} md={6}>
                  <div className="prg-hotel-card">
                    <div className="prg-hotel-thumb">
                      <img
                        src={hotel.image || "https://via.placeholder.com/150?text=Hotel"}
                        alt={hotel.hotelName}
                      />
                    </div>
                    <div className="prg-hotel-body">
                      <div className="d-flex justify-content-between align-items-start">
                        <h6 className="prg-hotel-name mb-1">{hotel.hotelName}</h6>
                        <span className="prg-pill prg-pill-ok">Included</span>
                      </div>
                      <div className="prg-hotel-loc">
                        <FaMapMarkerAlt size={10} /> {hotel.stateName}
                      </div>
                      <div className="d-flex gap-2 align-items-center mt-2">
                        <span className="prg-pill prg-pill-soft">{hotel.noOfnight} Night{hotel.noOfnight === 1 ? "" : "s"}</span>
                        <span className="prg-pill prg-pill-pref">Preferred</span>
                      </div>
                    </div>
                  </div>
                </Col>
              ))}
            </Row>
          ) : hasSearched ? (
            <div className="prg-empty-state">
              <FaHotel size={28} />
              <p className="mb-0 mt-2 fw-semibold">No hotels found</p>
              <p className="small text-muted">Try adjusting your search criteria.</p>
            </div>
          ) : (
            <div className="prg-empty-state">
              <FaHotel size={28} />
              <p className="mb-0 mt-2 fw-semibold">Loading hotels…</p>
            </div>
          )}
        </div>
      </div>

      {/* ────── Footer: Mode of payment ──────
          T&C acceptance was moved to the Pax Info step (popup dialog
          after the user clicks Confirm booking). */}
      <Row className="g-3 mt-1">
        <Col lg={12}>
          <div className="prg-pay">
            <div className="prg-pay-title">
              <FaCreditCard className="me-2" />Mode of payment
              <span className="prg-pay-required">required</span>
            </div>
            <div className="prg-pay-options">
              {PAYMENT_MODES.map((m) => {
                const Icon = m.icon;
                const selected = programme.modeOfPayment === m.value;
                return (
                  <button
                    type="button"
                    key={m.value}
                    className={`prg-pay-option ${selected ? "selected" : ""}`}
                    onClick={() => setField("modeOfPayment", m.value)}
                  >
                    <Icon className="prg-pay-option-icon" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </Col>
      </Row>

      <div className="sticky-nav-row d-flex justify-content-between">
        <button className="btn-nav-prev" onClick={onPrev}>← Previous</button>
        <button
          className="btn-nav-next"
          onClick={() => {
            if (!programme.modeOfPayment) {
              toast.error("Please select a mode of payment.");
              return;
            }
            onNext();
          }}
        >
          Next →
        </button>
      </div>

      <style>{`
        /* === HERO === */
        .prg-hero {
          background:
            radial-gradient(1200px 200px at -10% -50%, rgba(255,255,255,0.18), transparent),
            linear-gradient(135deg, #1e3a5f 0%, #2563eb 60%, #3b82f6 100%);
          color: #fff;
          padding: 22px 26px;
          border-radius: 18px;
          box-shadow: 0 10px 30px -10px rgba(37, 99, 235, 0.45);
        }
        .prg-hero-eyebrow {
          font-size: 0.7rem;
          letter-spacing: 0.18em;
          color: rgba(255,255,255,0.75);
          font-weight: 600;
        }
        .prg-hero-title {
          font-size: 1.7rem;
          font-weight: 700;
          margin: 4px 0 8px;
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .prg-hero-divider { opacity: 0.55; font-weight: 400; }
        .prg-hero-sub {
          font-size: 0.86rem;
          color: rgba(255,255,255,0.8);
          line-height: 1.5;
          max-width: 540px;
        }
        .prg-hero-inputs {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .prg-hero-input-row {
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(255,255,255,0.12);
          border: 1px solid rgba(255,255,255,0.25);
          border-radius: 12px;
          padding: 8px 12px;
          backdrop-filter: blur(6px);
          transition: background 0.15s, border-color 0.15s;
        }
        .prg-hero-input-row:focus-within {
          background: rgba(255,255,255,0.18);
          border-color: rgba(255,255,255,0.55);
        }
        .prg-hero-input-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.18);
          flex-shrink: 0;
        }
        .prg-hero-input-body {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-width: 0;
        }
        .prg-hero-input-label {
          font-size: 0.66rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.75);
        }
        .prg-hero-input-row input {
          background: transparent;
          border: none;
          outline: none;
          color: #fff;
          font-size: 0.9rem;
          padding: 2px 0;
        }
        .prg-hero-input-row input::placeholder { color: rgba(255,255,255,0.55); }
        .prg-hero-input-row input::-webkit-calendar-picker-indicator {
          filter: invert(1) opacity(0.8);
          cursor: pointer;
        }

        /* === SECTION CARDS === */
        .prg-section {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 1px 2px rgba(15,23,42,0.04);
        }
        .prg-section-head {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 12px 16px;
          background: #f8fafc;
          border-bottom: 1px solid #e5e7eb;
          font-weight: 600;
          font-size: 0.92rem;
          color: #1e293b;
        }
        .prg-section-pill {
          margin-left: auto;
          font-size: 0.7rem;
          background: #e0e7ff;
          color: #3730a3;
          padding: 2px 9px;
          border-radius: 999px;
          font-weight: 600;
        }
        .prg-section-body { padding: 14px 16px; }
        .prg-section-ok .prg-section-head {
          background: #ecfdf5;
          color: #065f46;
          border-bottom-color: #a7f3d0;
        }
        .prg-section-warn .prg-section-head {
          background: #fff7ed;
          color: #9a3412;
          border-bottom-color: #fed7aa;
        }

        /* === TIMELINE / DAYS === */
        .prg-timeline { display: flex; flex-direction: column; gap: 8px; }
        .prg-day {
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          overflow: hidden;
          background: #fff;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .prg-day.open {
          border-color: #93c5fd;
          box-shadow: 0 0 0 3px rgba(147, 197, 253, 0.18);
        }
        .prg-day-head {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 10px 12px;
          border: none;
          background: transparent;
          text-align: left;
          cursor: pointer;
          transition: background 0.12s;
        }
        .prg-day-head:hover { background: #f8fafc; }
        .prg-day-num {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          background: linear-gradient(135deg, #2563eb, #3b82f6);
          color: #fff;
          font-weight: 700;
          font-size: 0.85rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .prg-day-title { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .prg-day-title-main {
          font-weight: 600;
          font-size: 0.88rem;
          color: #1e293b;
        }
        .prg-day-place {
          font-size: 0.74rem;
          color: #64748b;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .prg-day-chev {
          color: #94a3b8;
          transition: transform 0.18s;
        }
        .prg-day.open .prg-day-chev { transform: rotate(180deg); color: #2563eb; }
        .prg-day-body {
          padding: 0 14px 12px 58px;
          font-size: 0.83rem;
          color: #475569;
          line-height: 1.55;
        }

        /* === BULLETS === */
        .prg-bullets {
          list-style: none;
          padding: 0;
          margin: 0;
          font-size: 0.82rem;
        }
        .prg-bullets li {
          position: relative;
          padding: 4px 0 4px 18px;
          line-height: 1.45;
          color: #334155;
        }
        .prg-bullets li::before {
          content: "";
          position: absolute;
          left: 0;
          top: 11px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .prg-bullets-ok li::before { background: #10b981; }
        .prg-bullets-warn li::before { background: #f97316; }
        .prg-empty {
          font-size: 0.8rem;
          color: #94a3b8;
          font-style: italic;
        }
        .prg-loading {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #64748b;
          font-size: 0.85rem;
        }

        /* === INFO + CANCELLATION CARDS === */
        .prg-info-card {
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 14px;
        }
        .prg-info-title {
          font-weight: 600;
          color: #1e293b;
          font-size: 0.85rem;
          display: flex;
          align-items: center;
          margin-bottom: 6px;
        }
        .prg-info-title.small { font-size: 0.78rem; }
        .prg-info-text { font-size: 0.78rem; color: #475569; margin: 0 0 4px; line-height: 1.5; }
        .prg-info-hint { font-size: 0.72rem; color: #94a3b8; margin: 0 0 4px; }
        .prg-info-divider {
          height: 1px;
          background: #e5e7eb;
          margin: 10px 0;
        }
        .prg-info-link {
          display: block;
          font-size: 0.82rem;
          color: #2563eb;
          text-decoration: none;
          font-weight: 500;
          margin-top: 2px;
        }
        .prg-info-link:hover { text-decoration: underline; }
        .prg-cxl-card {
          background: linear-gradient(135deg, #fef3c7, #fff7ed);
          border: 1px solid #fcd34d;
          border-radius: 14px;
          padding: 14px;
        }
        .prg-cxl-title {
          font-weight: 600;
          color: #92400e;
          font-size: 0.85rem;
          display: flex;
          align-items: center;
          margin-bottom: 8px;
        }
        .prg-cxl-line {
          font-size: 0.76rem;
          line-height: 1.5;
          padding: 6px 8px;
          border-radius: 8px;
          margin-bottom: 4px;
        }
        .prg-cxl-ok { background: rgba(16, 185, 129, 0.12); color: #065f46; }
        .prg-cxl-warn { background: rgba(249, 115, 22, 0.14); color: #9a3412; }
        .prg-cxl-muted { background: rgba(148, 163, 184, 0.15); color: #475569; }
        .prg-cxl-note {
          margin-top: 8px;
          padding: 8px 10px;
          background: rgba(239, 68, 68, 0.1);
          color: #b91c1c;
          font-size: 0.72rem;
          border-radius: 8px;
          display: flex;
          align-items: center;
        }

        /* === HOTEL CARDS === */
        .prg-hotel-card {
          display: flex;
          gap: 12px;
          padding: 12px;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          background: #fff;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .prg-hotel-card:hover {
          border-color: #93c5fd;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.08);
        }
        .prg-hotel-thumb {
          width: 90px;
          height: 90px;
          border-radius: 10px;
          overflow: hidden;
          flex-shrink: 0;
          background: #f1f5f9;
        }
        .prg-hotel-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .prg-hotel-body { flex: 1; min-width: 0; }
        .prg-hotel-name {
          font-size: 0.92rem;
          font-weight: 600;
          color: #1e293b;
        }
        .prg-hotel-loc {
          font-size: 0.74rem;
          color: #64748b;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .prg-pill {
          font-size: 0.66rem;
          padding: 2px 8px;
          border-radius: 999px;
          font-weight: 600;
          letter-spacing: 0.02em;
        }
        .prg-pill-ok { background: #d1fae5; color: #065f46; }
        .prg-pill-soft { background: #f1f5f9; color: #475569; }
        .prg-pill-pref {
          background: linear-gradient(135deg, #fef3c7, #fde68a);
          color: #92400e;
        }
        .prg-empty-state {
          text-align: center;
          padding: 24px;
          color: #94a3b8;
        }

        /* === T&C === */
        .prg-tnc {
          border: 1.5px solid #e5e7eb;
          border-radius: 14px;
          padding: 14px 16px;
          background: #fff;
          transition: border-color 0.15s, background 0.15s;
        }
        .prg-tnc.accepted {
          border-color: #10b981;
          background: #ecfdf5;
        }
        .prg-tnc-row {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          cursor: pointer;
          margin: 0;
        }
        .prg-tnc-row .form-check { margin-top: 2px; }
        .prg-tnc-row .form-check-input {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }
        .prg-tnc-title {
          display: block;
          font-weight: 600;
          color: #1e293b;
          font-size: 0.88rem;
        }
        .prg-tnc.accepted .prg-tnc-title { color: #065f46; }
        .prg-tnc-sub {
          display: block;
          font-size: 0.76rem;
          color: #64748b;
          margin-top: 2px;
          line-height: 1.45;
        }
        .prg-tnc-details {
          margin-top: 10px;
          font-size: 0.78rem;
          color: #475569;
        }
        .prg-tnc-details summary {
          cursor: pointer;
          color: #2563eb;
          font-weight: 500;
        }
        .prg-tnc-details ul {
          margin-top: 6px;
          padding-left: 18px;
        }

        /* === PAYMENT === */
        .prg-pay {
          border: 1.5px solid #e5e7eb;
          border-radius: 14px;
          padding: 14px 16px;
          background: #fff;
          height: 100%;
        }
        .prg-pay-title {
          display: flex;
          align-items: center;
          font-weight: 600;
          font-size: 0.88rem;
          color: #1e293b;
          margin-bottom: 10px;
        }
        .prg-pay-required {
          margin-left: auto;
          font-size: 0.62rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #b91c1c;
          background: #fee2e2;
          padding: 2px 8px;
          border-radius: 999px;
          font-weight: 700;
        }
        .prg-pay-options {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .prg-pay-option {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          border: 1.5px solid #e5e7eb;
          background: #fff;
          border-radius: 10px;
          font-size: 0.78rem;
          font-weight: 500;
          color: #475569;
          cursor: pointer;
          transition: all 0.15s;
          text-align: left;
        }
        .prg-pay-option:hover {
          border-color: #93c5fd;
          color: #1e293b;
        }
        .prg-pay-option.selected {
          border-color: #2563eb;
          background: #eff6ff;
          color: #1e3a8a;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
        }
        .prg-pay-option-icon {
          flex-shrink: 0;
          color: #2563eb;
        }

        /* Responsive tweaks */
        @media (max-width: 991.98px) {
          .prg-hero-title { font-size: 1.4rem; }
          .prg-pay-options { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
};

export default HotelsTab;
