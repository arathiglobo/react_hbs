import React, { useState, useEffect } from "react";
import { Row, Col, Spinner, Modal, Form, Button, Card } from "react-bootstrap";
import axiosInstance from "../../../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import {
  FaHotel,
  FaCheckCircle,
  FaTimesCircle,
  FaPhoneAlt,
  FaEnvelope,
  FaMapMarkerAlt,
  FaChevronDown,
  FaShieldAlt,
  FaRegClock,
  FaSuitcase,
} from "react-icons/fa";

const HotelsTab = ({ searchParams, bookingData, programme, updateData, updateProgramme, onPrev, onNext }) => {
  const [hotels, setHotels] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [packageView, setPackageView] = useState(null);
  const [isPackageLoading, setIsPackageLoading] = useState(false);
  // Every day starts collapsed — the operator picks which day to expand by
  // clicking its header. Previously index 0 was seeded open, which visually
  // singled out Day 01 on load; that guidance is no longer wanted.
  const [openDays, setOpenDays] = useState({});
  // Hotel selection. The user is encouraged to pick a hotel — it is NOT
  // auto-selected. If they press Next without one, a warning popup asks them
  // to acknowledge (via a checkbox) before proceeding.
  const [selectedHotelId, setSelectedHotelId] = useState(null);
  const [showNoHotelModal, setShowNoHotelModal] = useState(false);
  const [ackNoHotel, setAckNoHotel] = useState(false);

  // ── Hotel-list filters ──
  // Mirrors the "Filters" panel on /room-list (Refund Policy + Room Type).
  // The two dimensions the package hotel list actually exposes are:
  //   • location (hotel.stateName) — analogous to Room Type
  //   • duration (hotel.noOfnight) — a checkbox list of the distinct stays
  //     the package offers, useful when a package includes hotels with
  //     different night counts (city stop vs. resort leg).
  // Both start empty (no filter) so the sidebar is purely additive; clicking
  // "Clear filters" restores that state.
  const [selectedLocations, setSelectedLocations] = useState([]);
  const [selectedNights, setSelectedNights] = useState([]);
  const toggleLocation = (name) =>
    setSelectedLocations((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name],
    );
  const toggleNights = (n) =>
    setSelectedNights((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n],
    );
  const clearHotelFilters = () => {
    setSelectedLocations([]);
    setSelectedNights([]);
  };

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

  // Pre-select a hotel when returning to this step with one already chosen
  // (e.g. the user went forward then came back). Runs once hotels load.
  useEffect(() => {
    if (!hotels.length) return;
    const existing =
      Array.isArray(bookingData?.selectedHotels) &&
      bookingData.selectedHotels.length === 1
        ? bookingData.selectedHotels[0]?.hotelId
        : null;
    if (existing != null && hotels.some((h) => h.hotelId === existing)) {
      setSelectedHotelId(existing);
    }
  }, [hotels]);

  const setField = (field, value) => updateProgramme({ [field]: value });

  // Select a single hotel and push it (with its rate) into the shared booking
  // state so the Total Price sidebar and submit payload reflect the choice.
  const selectHotel = (hotel) => {
    setSelectedHotelId(hotel.hotelId);
    updateData({
      selectedHotels: [hotel],
      hotelPrice: Number(hotel.totalRateWithMarkup || 0),
    });
  };

  // On Next: if no hotel is chosen — whether because none was selected or none
  // is available for this package — open the warning popup instead of
  // advancing. The user must tick the acknowledgement box to proceed. A
  // selected hotel skips the popup entirely.
  const handleNext = () => {
    if (!selectedHotelId) {
      setAckNoHotel(false);
      setShowNoHotelModal(true);
      return;
    }
    onNext();
  };

  const closeNoHotelModal = () => {
    setShowNoHotelModal(false);
    setAckNoHotel(false);
  };

  // Proceed to the next step after the user acknowledges via the checkbox.
  const proceedWithoutHotel = () => {
    setShowNoHotelModal(false);
    setAckNoHotel(false);
    onNext();
  };

  const toggleDay = (idx) =>
    setOpenDays((prev) => ({ ...prev, [idx]: !prev[idx] }));

  const nights = packageView?.noOfNights || "";
  const nightsInt = parseInt(nights, 10);
  const daysInt = Number.isFinite(nightsInt) ? nightsInt + 1 : null;

  const itineraries = Array.isArray(packageView?.itineraries) ? packageView.itineraries : [];
  const inclusions = Array.isArray(packageView?.inclusions) ? packageView.inclusions : [];
  const exclusions = Array.isArray(packageView?.exclusions) ? packageView.exclusions : [];

  // ── Filter options derived from the loaded hotel list ──
  // Same shape /room-list uses for its Room Type list: only surface values
  // that actually appear in the current results so a checkbox can never
  // narrow to zero from the outset. Duplicates are collapsed.
  const locationOptions = Array.from(
    new Set(hotels.map((h) => h.stateName).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));
  const nightsOptions = Array.from(
    new Set(hotels.map((h) => h.noOfnight).filter((n) => n != null)),
  ).sort((a, b) => a - b);

  // Apply the two filters — location OR-matches the picked stateName; nights
  // OR-matches the picked stay length. Empty pick = no restriction.
  const filteredHotels = hotels.filter((h) => {
    if (
      selectedLocations.length > 0 &&
      !selectedLocations.includes(h.stateName)
    ) {
      return false;
    }
    if (
      selectedNights.length > 0 &&
      !selectedNights.includes(h.noOfnight)
    ) {
      return false;
    }
    return true;
  });

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
      {/* ────── HERO: selected-package summary ────── */}
      <div className="prg-hero mb-3">
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
          The full programme — what's included, what's not, and the
          cancellation window — is shown below.
        </div>
      </div>

      {/* ────── Day-wise itinerary — now full width so its two-column day
          grid spreads across the page. Includes / Excludes / After booking
          sit in their own row below. ────── */}
      <Row className="g-3 mb-3">
        <Col lg={12}>
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
      </Row>

      {/* ────── Package Information ──────
          Wraps the three-column Includes / Excludes / After booking row in a
          titled outer card modelled on the "Hotel Information" card on
          /room-list — same round icon + title + subtitle header treatment —
          so the two booking flows keep the same content-grouping pattern.
          h-100 on each inner column keeps the three cards equal height. */}
      <Card
        className="mb-3 shadow-sm"
        style={{ overflow: "hidden", border: "1px solid #e5e9f0" }}
      >
        <Card.Header
          className="d-flex align-items-center gap-3 py-3"
          style={{
            background: "#f4f7fc",
            color: "#2b3648",
            border: "none",
            borderBottom: "1px solid #e5e9f0",
          }}
        >
          <div
            className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
            style={{
              width: 40,
              height: 40,
              backgroundColor: "#fde7ed",
              color: "#EC0B43",
              fontSize: "1.15rem",
            }}
          >
            <FaSuitcase />
          </div>
          <div>
            <div
              className="fw-bold"
              style={{ fontSize: "1.1rem", lineHeight: 1.2 }}
            >
              Package Information
            </div>
            <div className="small text-muted">
              What's included, what's not, and what happens after booking
            </div>
          </div>
        </Card.Header>
        <Card.Body className="p-3">
          {/* Three sections stack vertically (one full-width block per row)
              mirroring how the "Hotel Information" card on /room-list stacks
              its Cancellation / Amendment / Child policy blocks. Each block
              spans the whole width so its bullets can flow horizontally in a
              wrapping grid — see .prg-bullets-grid below — instead of running
              down the page as a tall single column. */}
          <div className="d-flex flex-column gap-3">
            <div className="prg-section prg-section-ok">
              <div className="prg-section-head">
                <FaCheckCircle className="me-2" />
                <span>Includes</span>
              </div>
              <div className="prg-section-body">
                {inclusions.length === 0 ? (
                  <div className="prg-empty">Includes will be uploaded by supplier.</div>
                ) : (
                  <ul className="prg-bullets prg-bullets-ok prg-bullets-grid">
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
                  <ul className="prg-bullets prg-bullets-warn prg-bullets-grid">
                    {exclusions.map((x) => (
                      <li key={`exc-${x.otherId}`}>{x.description}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* After booking gets the same section shell as its two siblings
                so the vertical rhythm holds — the info-card look was only
                needed when it sat as the third column. Its body arranges the
                two "columns" (Confirmation email + Need help?) side-by-side
                so this row also reads horizontally. */}
            <div className="prg-section prg-section-info">
              <div className="prg-section-head">
                <FaEnvelope className="me-2" />
                <span>After booking</span>
              </div>
              <div className="prg-section-body">
                <div className="prg-after-grid">
                  <div>
                    <p className="prg-info-text mb-1">
                      A confirmation will be sent to your email within{" "}
                      <strong>12 hours</strong> with the package subject code.
                    </p>
                    <p className="prg-info-hint mb-0">
                      Don't forget to check your junk folder.
                    </p>
                  </div>
                  <div>
                    <div className="prg-info-title small mb-1">
                      <FaPhoneAlt className="me-2" />Need help?
                    </div>
                    <div className="d-flex flex-wrap gap-3">
                      <a
                        href="tel:+971561752667"
                        className="prg-info-link"
                      >
                        +971 56 175 2667
                      </a>
                      <a
                        href="mailto:support@ibyta.com"
                        className="prg-info-link"
                      >
                        support@ibyta.com
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* ────── Hotels in the package + Filters sidebar ──────
          Same two-column pattern as /room-list's "Available Room Categories"
          (Filters at Col lg={3}, results at Col lg={9}) so the two flows read
          the same way. On smaller viewports the filters card sits above the
          hotel grid — same fallback /room-list uses. */}
      <Row className="g-3 mb-3">
        <Col lg={3} md={4}>
          <Card className="room-filters-card">
            <Card.Body className="p-3">
              <h6 className="filter-title mb-3">Filters</h6>

              <div className="filter-group mb-3">
                <div className="filter-group-label">Location</div>
                {locationOptions.length === 0 ? (
                  <div className="text-muted small">No options</div>
                ) : (
                  locationOptions.map((loc) => (
                    <Form.Check
                      key={`floc-${loc}`}
                      type="checkbox"
                      id={`filter-loc-${loc}`}
                      label={loc}
                      checked={selectedLocations.includes(loc)}
                      onChange={() => toggleLocation(loc)}
                    />
                  ))
                )}
              </div>

              <div className="filter-group">
                <div className="filter-group-label">Nights</div>
                {nightsOptions.length === 0 ? (
                  <div className="text-muted small">No options</div>
                ) : (
                  nightsOptions.map((n) => (
                    <Form.Check
                      key={`fn-${n}`}
                      type="checkbox"
                      id={`filter-nights-${n}`}
                      label={`${n} Night${n === 1 ? "" : "s"}`}
                      checked={selectedNights.includes(n)}
                      onChange={() => toggleNights(n)}
                    />
                  ))
                )}
              </div>

              {(selectedLocations.length > 0 || selectedNights.length > 0) && (
                <Button
                  variant="link"
                  size="sm"
                  className="p-0 mt-2"
                  onClick={clearHotelFilters}
                >
                  Clear filters
                </Button>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col lg={9} md={8}>
          <div className="prg-section">
            <div className="prg-section-head">
              <FaHotel className="me-2" />
              <span>Hotels included in this package</span>
              {hotels.length > 0 && (
                <span className="prg-section-pill">
                  {filteredHotels.length === hotels.length
                    ? `${hotels.length} hotel${hotels.length === 1 ? "" : "s"}`
                    : `${filteredHotels.length} of ${hotels.length} hotel${hotels.length === 1 ? "" : "s"}`}
                </span>
              )}
            </div>
            <div className="prg-section-body">
              {/* Neutral guidance only. The "no hotel selected" warning is shown
                  as a popup when the user presses Next (see the Modal below). */}
              {hotels.length > 0 && (
                <div className="prg-hotel-select-hint">
                  Select a hotel to continue.
                </div>
              )}
              {isLoading ? (
                <div className="prg-loading">
                  <Spinner animation="border" size="sm" /> <span>Searching for hotels…</span>
                </div>
              ) : hasSearched && filteredHotels.length > 0 ? (
                <Row className="g-3">
                  {filteredHotels.map((hotel) => {
                const isSelected = selectedHotelId === hotel.hotelId;
                return (
                <Col key={hotel.hotelId} md={6}>
                  <div
                    className={`prg-hotel-card ${isSelected ? "selected" : ""}`}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    onClick={() => selectHotel(hotel)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        selectHotel(hotel);
                      }
                    }}
                  >
                    <div className="prg-hotel-thumb">
                      <img
                        src={hotel.image || "https://via.placeholder.com/150?text=Hotel"}
                        alt={hotel.hotelName}
                      />
                    </div>
                    <div className="prg-hotel-body">
                      <div className="d-flex justify-content-between align-items-start">
                        <h6 className="prg-hotel-name mb-1">{hotel.hotelName}</h6>
                        <span
                          className={`prg-pill ${
                            isSelected ? "prg-pill-selected" : "prg-pill-ok"
                          }`}
                        >
                          {isSelected ? (
                            <>
                              <FaCheckCircle size={10} className="me-1" />
                              Selected
                            </>
                          ) : (
                            "Included"
                          )}
                        </span>
                      </div>
                      <div className="prg-hotel-loc">
                        <FaMapMarkerAlt size={10} /> {hotel.stateName}
                      </div>
                      <div className="d-flex gap-2 align-items-center mt-2">
                        <span className="prg-pill prg-pill-soft">{hotel.noOfnight} Night{hotel.noOfnight === 1 ? "" : "s"}</span>
                        <span className="prg-pill prg-pill-pref">Preferred</span>
                        <span
                          className={`prg-hotel-radio ms-auto ${
                            isSelected ? "on" : ""
                          }`}
                          aria-hidden="true"
                        >
                          {isSelected && <FaCheckCircle />}
                        </span>
                      </div>
                    </div>
                  </div>
                </Col>
                );
              })}
            </Row>
          ) : hasSearched && hotels.length > 0 ? (
            // Search ran, hotels were returned, but the filter picks match
            // nothing. Suggest the user loosen filters rather than the query.
            <div className="prg-empty-state">
              <FaHotel size={28} />
              <p className="mb-0 mt-2 fw-semibold">No hotels match the filters</p>
              <p className="small text-muted">Try removing a location or nights checkbox.</p>
              <Button
                variant="link"
                size="sm"
                className="p-0"
                onClick={clearHotelFilters}
              >
                Clear filters
              </Button>
            </div>
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
        </Col>
      </Row>

      {/* ────── Cancellation policy — moved here (below the hotels list) so it
          reads as a full-width closing note instead of a cramped sidebar
          card. ────── */}
      <div className="prg-cxl-card mb-3">
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

      {/* Mode of payment moved to the Pax Info step's right sidebar (below
          the Total Price card). T&C acceptance lives in the Confirm-booking
          popup on the same step. */}

      <div className="sticky-nav-row d-flex justify-content-between">
        <button className="btn-nav-prev" onClick={onPrev}>← Previous</button>
        <button className="btn-nav-next" onClick={handleNext}>Next →</button>
      </div>

      {/* ────── No-hotel-selected warning popup ──────
          Shown when Next is pressed without a hotel. The user must tick the
          acknowledgement checkbox to enable "Proceed anyway". */}
      <Modal show={showNoHotelModal} onHide={closeNoHotelModal} centered>
        <Modal.Header closeButton>
          <Modal.Title className="d-flex align-items-center" style={{ fontSize: "1.05rem" }}>
            <FaTimesCircle className="me-2" style={{ color: "#dc2626" }} />
            {hotels.length === 0 ? "No hotels available" : "No hotel selected"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-3" style={{ fontSize: "0.9rem", color: "#475569" }}>
            {hotels.length === 0
              ? "There are no hotels available for this package at the moment. You can still proceed with the booking without a hotel."
              : "You haven't selected a hotel for this package. We recommend picking a hotel before continuing. If you'd like to proceed without selecting one, please confirm below."}
          </p>
          <Form.Check
            type="checkbox"
            id="ack-proceed-without-hotel"
            checked={ackNoHotel}
            onChange={(e) => setAckNoHotel(e.target.checked)}
            label={
              hotels.length === 0
                ? "I understand and want to proceed without a hotel."
                : "I understand and want to proceed without selecting a hotel."
            }
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={closeNoHotelModal}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={!ackNoHotel}
            onClick={proceedWithoutHotel}
          >
            Proceed to next step
          </Button>
        </Modal.Footer>
      </Modal>

      <style>{`
        /* === HERO ===
           Flat light card that matches the .prg-section blocks below and the
           page-level .hotel-header-card / .booking-summary hero at the top of
           the page. The pink gradient that used to live here duplicated the
           top hero's role — since the top hero now surfaces "N Nights /
           N Days", this box just carries the section title + Flight details
           input, so it should read as a plain content card. */
        .prg-hero {
          background: var(--rl-card, #ffffff);
          color: var(--rl-text, #15171C);
          padding: 20px 24px;
          border-radius: 16px;
          border: 1px solid var(--rl-border, #e2e8f0);
          box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06);
          transition: box-shadow 0.28s ease;
          animation: prgFadeInUp 0.45s ease both;
        }
        .prg-hero:hover {
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
        }
        .prg-hero-eyebrow {
          font-size: 0.7rem;
          letter-spacing: 0.18em;
          color: #EC0B43;
          font-weight: 700;
          text-transform: uppercase;
        }
        .prg-hero-title {
          font-size: 1.7rem;
          font-weight: 700;
          margin: 4px 0 8px;
          color: #15171C;
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .prg-hero-divider { color: #C5C5BE; font-weight: 400; }
        /* "01 Nights / 02 Days" — brand gradient text, matching the page's
           red→violet CTA buttons. */
        .prg-hero-title strong {
          background: linear-gradient(135deg, #EC0B43 0%, #8b5cf6 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          font-weight: 800;
        }
        .prg-hero-sub {
          font-size: 0.86rem;
          color: #6B7280;
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
          background: #FAFAF8;
          border: 1px solid #E5E5E1;
          border-radius: 12px;
          padding: 8px 12px;
          transition: background 0.15s, border-color 0.15s;
        }
        .prg-hero-input-row:focus-within {
          background: #ffffff;
          border-color: #EC0B43;
          box-shadow: 0 0 0 3px rgba(236, 11, 67, 0.10);
        }
        .prg-hero-input-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #FDE7ED;
          color: #EC0B43;
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
          color: #8A8A85;
        }
        .prg-hero-input-row input {
          background: transparent;
          border: none;
          outline: none;
          color: #15171C;
          font-size: 0.9rem;
          padding: 2px 0;
        }
        .prg-hero-input-row input::placeholder { color: #9A9A95; }

        /* === SECTION CARDS ===
           Same border / radius / shadow as the .hotel-header-card hero on the
           page above, so every section on the Package Details step reads as a
           direct sibling of that hero. */
        .prg-section {
          background: var(--rl-card, #ffffff);
          border: 1px solid var(--rl-border, #e2e8f0);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 6px 18px rgba(15,23,42,0.06);
          transition: box-shadow 0.28s ease;
          animation: prgFadeInUp 0.5s ease both;
        }
        .prg-section:hover {
          box-shadow: 0 2px 6px rgba(15,23,42,0.06), 0 14px 34px rgba(15,23,42,0.08);
        }
        .prg-section-head {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 14px 18px;
          background: #f8fafc;
          border-bottom: 1px solid #e5e7eb;
          font-weight: 600;
          font-size: 0.92rem;
          letter-spacing: 0.01em;
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
        /* Two-column day grid: Day 02 sits next to Day 01. align-items:start
           so a collapsed day never stretches to a taller expanded neighbour. */
        .prg-timeline {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          align-items: start;
        }
        @media (max-width: 767.98px) {
          .prg-timeline { grid-template-columns: 1fr; }
        }
        .prg-day {
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          overflow: hidden;
          background: #fff;
          transition: border-color 0.18s ease, box-shadow 0.18s ease;
        }
        .prg-day:hover {
          box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06);
        }
        .prg-day.open {
          border-color: #F8C9D5;
          box-shadow: 0 0 0 3px rgba(236, 11, 67, 0.12);
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
        .prg-day-head:hover { background: #FFF5F8; }
        .prg-day-num {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          background: linear-gradient(135deg, #EC0B43, #8b5cf6);
          color: #fff;
          font-weight: 700;
          font-size: 0.85rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 4px 10px rgba(236, 11, 67, 0.28);
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
        .prg-day.open .prg-day-chev { transform: rotate(180deg); color: #EC0B43; }
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
        /* Horizontal bullet flow — bullets sit in a responsive grid that
           auto-fills across the row instead of stacking as a single column,
           so Includes / Excludes are short-wide blocks rather than tall
           narrow ones. Each cell keeps its own bullet indent. */
        .prg-bullets-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          column-gap: 20px;
          row-gap: 0;
        }
        .prg-bullets-grid li {
          break-inside: avoid;
        }
        @media (max-width: 575.98px) {
          .prg-bullets-grid {
            grid-template-columns: 1fr;
          }
        }

        /* After booking header — same look as .prg-section-ok / -warn but in
           the info blue palette so all three section heads read as siblings. */
        .prg-section-info .prg-section-head {
          background: #eff6ff;
          color: #1e40af;
          border-bottom-color: #bfdbfe;
        }
        /* Two-column split inside the After booking body: confirmation text
           on the left, contact info on the right. Collapses to one column on
           narrow viewports. */
        .prg-after-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 20px;
          align-items: start;
        }
        @media (max-width: 767.98px) {
          .prg-after-grid {
            grid-template-columns: 1fr;
          }
        }
        /* When .prg-info-link sits inside the After booking .prg-section body
           it should behave as an inline chip (they're beside each other in a
           flex row now), not a full-width block. */
        .prg-section-info .prg-info-link {
          display: inline-block;
        }
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
          border-radius: 16px;
          padding: 16px;
          box-shadow: 0 1px 2px rgba(15,23,42,0.04), 0 8px 20px rgba(15,23,42,0.04);
          transition: box-shadow 0.28s ease;
          animation: prgFadeInUp 0.5s ease both;
        }
        .prg-info-card:hover {
          box-shadow: 0 2px 6px rgba(15,23,42,0.06), 0 14px 34px rgba(15,23,42,0.08);
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
          border-radius: 16px;
          padding: 16px;
          box-shadow: 0 1px 2px rgba(202,138,4,0.06), 0 8px 20px rgba(202,138,4,0.08);
          transition: box-shadow 0.28s ease;
          animation: prgFadeInUp 0.5s ease both;
        }
        .prg-cxl-card:hover {
          box-shadow: 0 2px 6px rgba(202,138,4,0.08), 0 14px 34px rgba(202,138,4,0.12);
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
          cursor: pointer;
          transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
        }
        .prg-hotel-card:hover {
          border-color: #F8C9D5;
          box-shadow: 0 8px 20px rgba(236, 11, 67, 0.10);
          transform: translateY(-2px);
        }
        .prg-hotel-card:focus-visible {
          outline: none;
          border-color: #10b981;
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.18);
        }
        .prg-hotel-card.selected {
          border-color: #10b981;
          background: #f0fdf4;
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.18);
        }
        /* Selected-state pill + radio indicator */
        .prg-pill-selected {
          background: #10b981;
          color: #fff;
          display: inline-flex;
          align-items: center;
        }
        .prg-hotel-radio {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 2px solid #cbd5e1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #10b981;
          font-size: 0.95rem;
          flex-shrink: 0;
        }
        .prg-hotel-radio.on {
          border-color: #10b981;
        }
        /* Neutral select-a-hotel guidance (the warning itself is a popup) —
           rendered as a soft rose chip so it reads as friendly guidance. */
        .prg-hotel-select-hint {
          display: inline-flex;
          align-items: center;
          font-size: 0.78rem;
          font-weight: 600;
          color: #C11049;
          background: #FFF5F8;
          border: 1px dashed #F8C9D5;
          border-radius: 999px;
          padding: 6px 14px;
          margin-bottom: 12px;
        }
        .prg-hotel-thumb {
          width: 90px;
          height: 90px;
          border-radius: 12px;
          overflow: hidden;
          flex-shrink: 0;
          background: #f1f5f9;
          box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.06);
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

        /* Branded count pills ("2 days", "2 hotels") — the same red→violet
           gradient as the page's CTAs. */
        .prg-section-pill {
          padding: 3px 12px;
          background: linear-gradient(135deg, #EC0B43, #8b5cf6);
          color: #ffffff;
          box-shadow: 0 2px 6px rgba(236, 11, 67, 0.25);
        }
        /* Brand-red icons on the neutral section headers (Itinerary, Hotels)
           and the sidebar info card — Includes/Excludes keep their own
           green/orange headers. */
        .prg-section:not(.prg-section-ok):not(.prg-section-warn) > .prg-section-head > svg {
          color: #EC0B43;
        }
        .prg-info-title > svg {
          color: #EC0B43;
        }
        .prg-info-link {
          transition: color 0.15s ease, transform 0.15s ease;
        }
        .prg-info-link:hover {
          transform: translateX(2px);
        }

        /* Gentle entrance for the step's cards */
        @keyframes prgFadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .prg-hero,
          .prg-section,
          .prg-info-card,
          .prg-cxl-card {
            animation: none;
          }
          .prg-hero:hover { transform: none; }
        }

        /* Responsive tweaks */
        @media (max-width: 991.98px) {
          .prg-hero-title { font-size: 1.4rem; }
        }
      `}</style>
    </div>
  );
};

export default HotelsTab;
