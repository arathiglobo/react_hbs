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

const HotelsTab = ({ searchParams, bookingData, programme, updateData, updateProgramme, packageRate, onPrev, onNext }) => {
  const [hotels, setHotels] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [packageView, setPackageView] = useState(null);
  const [isPackageLoading, setIsPackageLoading] = useState(false);
  // Per-day expand/collapse state for the Day-wise Itinerary accordion.
  // Every day starts collapsed; the operator clicks a day head to reveal
  // its details, and can keep multiple days open at once (independent
  // toggles keyed by index).
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
  // Price-range filter (AED). Bounds are strings so an empty input just
  // means "no lower / upper bound" — filteredHotels below reads them as
  // numbers only when non-empty. Wired against hotel.totalRateWithMarkup,
  // which is the same number driving the Total Price sidebar.
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
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
    setPriceMin("");
    setPriceMax("");
  };

  // Resolves relative / windows-path image paths from packageView into
  // absolute /api/files/{filename} URLs (same pattern PackageSearch uses).
  // Used by the Day-wise Itinerary accordion to render each day's photo.
  const getImageUrl = (imagePath) => {
    if (!imagePath) return "";
    if (imagePath.startsWith("http")) return imagePath;
    const base = process.env.REACT_APP_API_BASE_URL || "";
    const filename = imagePath.includes("\\")
      ? imagePath.split("\\").pop()
      : imagePath.split("/").pop();
    return filename
      ? `${base}/api/files/${filename}`
      : `${base}/api/files/${imagePath}`;
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

  // Toggle a hotel selection. Clicking an unselected row picks it (only one
  // hotel per package, so the previous pick is replaced). Clicking the
  // already-selected row clears the pick — the operator can back out of a
  // choice without having to navigate away. Both branches push through
  // updateData so the Total Price sidebar and the /book payload stay in
  // sync with what's visible on the row.
  const selectHotel = (hotel) => {
    if (selectedHotelId === hotel.hotelId) {
      setSelectedHotelId(null);
      updateData({
        selectedHotels: [],
        hotelPrice: 0,
      });
      return;
    }
    setSelectedHotelId(hotel.hotelId);
    updateData({
      selectedHotels: [hotel],
      hotelPrice: Number(hotel.totalRateWithMarkup || 0),
    });
  };

  // On Next: a hotel MUST be selected before proceeding to checkout — no
  // "proceed anyway" escape hatch per product spec. Toast the operator and
  // stop; onNext (which navigates to the checkout tab) only fires when
  // selectedHotelId is set.
  const handleNext = () => {
    if (!selectedHotelId) {
      toast.error("Please select a hotel to continue.");
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
  // inclusions / exclusions were previously derived here for the removed
  // Package Information card. Now consumed inside the Cancellation Policies
  // popup in PackageBooking.jsx, which reads them directly from packageView.

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

  // Price-range gate — evaluated ONCE against the PACKAGE rate (the
  // single value that drives the Total Price sidebar / search-result
  // card), not each hotel's own totalRateWithMarkup. When the package
  // rate falls outside the picked [Min, Max] window, the whole hotel
  // list is hidden; when it falls inside, only Location + Nights
  // continue to filter individual rows. Bounds default to no-op when
  // priceMin / priceMax are empty strings.
  const pkgRate = Number(packageRate);
  const withinPriceRange =
    (!Number.isFinite(pkgRate)) ||
    ((priceMin === "" || pkgRate >= Number(priceMin)) &&
      (priceMax === "" || pkgRate <= Number(priceMax)));

  // Apply the row-level filters. If the package rate is outside the
  // chosen band, `withinPriceRange` short-circuits every hotel out.
  const filteredHotels = hotels.filter((h) => {
    if (!withinPriceRange) return false;
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

  // cancellationParts derivation was removed with the Cancellation Policy
  // card. The same fields on packageView still drive the identical block
  // inside the Cancellation Policies popup (PackageBooking.jsx), which
  // maintains its own cancellationParts derivation.

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

      {/* Day-wise Itinerary was moved INSIDE the Filters + Hotels row
          below (top of the right-hand Col lg=9) so the sticky Filters
          column on the left runs beside it AND continues beside the
          hotel list as the operator scrolls. Same accordion behaviour
          and content — only the wrapping location changed. */}

      {/* Package Information card (Includes / Excludes / After booking) was
          removed per product spec:
          • Includes + Excludes now live in the Cancellation Policies popup
            (see PackageBooking.jsx, opened from the Total Price card).
          • "After booking" (confirmation-email note + Need help contact) was
            dropped from the page altogether.
          The underlying data — packageView.inclusions / packageView.exclusions —
          is untouched and still fetched by PackageBooking; only its display
          location moved. */}

      {/* ────── Hotels in the package + Filters sidebar ──────
          Same two-column pattern as /room-list's "Available Room Categories"
          (Filters at Col lg={3}, results at Col lg={9}) so the two flows read
          the same way. On smaller viewports the filters card sits above the
          hotel grid — same fallback /room-list uses. */}
      <Row className="g-3 mb-3">
        <Col lg={3} md={4}>
          {/* .room-filters-card owns its own position: sticky (see
              RoomList.css) so the panel follows scroll on long hotel lists —
              same behaviour as /room-list's filters. `h-100` was previously
              stretching the card to match the hotel column, which killed the
              sticky (a sticky element can't scroll-follow inside a container
              it fully fills). Dropped to restore the intended behaviour. */}
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

              <div className="filter-group mb-3">
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

              {/* Price Range (AED) — two number inputs; empty = no bound.
                  Wired against hotel.totalRateWithMarkup. */}
              <div className="filter-group">
                <div className="filter-group-label">Price Range (AED)</div>
                <div className="d-flex align-items-center gap-2">
                  <Form.Control
                    type="number"
                    size="sm"
                    min="0"
                    placeholder="Min"
                    value={priceMin}
                    onChange={(e) => setPriceMin(e.target.value)}
                  />
                  <span className="text-muted small">–</span>
                  <Form.Control
                    type="number"
                    size="sm"
                    min="0"
                    placeholder="Max"
                    value={priceMax}
                    onChange={(e) => setPriceMax(e.target.value)}
                  />
                </div>
              </div>

              {(selectedLocations.length > 0 ||
                selectedNights.length > 0 ||
                priceMin !== "" ||
                priceMax !== "") && (
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
          {/* ────── Day-wise Itinerary — moved here from its own standalone
              Row so the sticky Filters column on the left runs beside it
              (and continues beside the Hotels list below). Same accordion
              behaviour and content as before; only the wrapping location
              changed. ────── */}
          <div className="prg-section mb-3">
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
                        {open && (
                          <div className="prg-day-body">
                            {it.packageItinearyImage && (
                              <img
                                src={getImageUrl(it.packageItinearyImage)}
                                alt={`Day ${it.day}`}
                                className="prg-day-image"
                                onError={(e) => { e.target.style.display = "none"; }}
                              />
                            )}
                            {it.heading && (
                              <div className="prg-day-body-heading">
                                {it.heading}
                              </div>
                            )}
                            {it.placeName && (
                              <div className="prg-day-body-place">
                                <FaMapMarkerAlt size={10} className="me-1" />
                                {it.placeName}
                              </div>
                            )}
                            {it.dayActivities ? (
                              <p style={{ whiteSpace: "pre-line", margin: 0 }}>
                                {it.dayActivities}
                              </p>
                            ) : (
                              !it.packageItinearyImage && !it.heading && !it.placeName && (
                                <p className="text-muted small fst-italic mb-0">
                                  No additional details for this day.
                                </p>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* "Hotels included in this package" list — restructured to mirror
              /room-list's "Available Room Categories" section: same
              .room-categories-section wrapper, same h4 title with the red
              gradient underline (from RoomList.css), same .room-category-item
              + .room-category-header row shape (name + subtitle on the left,
              price + primary button on the right, red left-edge accent from
              .room-category-header). Selection functionality is UNCHANGED —
              click anywhere on the row selects the hotel, same handler as
              before; the button just visually surfaces the current state. */}
          <div className="room-categories-section">
            <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
              <h4 className="mb-0">
                Hotels included in this package
              </h4>
              {hotels.length > 0 && (
                <span className="prg-section-pill">
                  {filteredHotels.length === hotels.length
                    ? `${hotels.length} hotel${hotels.length === 1 ? "" : "s"}`
                    : `${filteredHotels.length} of ${hotels.length} hotel${hotels.length === 1 ? "" : "s"}`}
                </span>
              )}
            </div>

            {/* Neutral guidance only. The "no hotel selected" warning is shown
                as a popup when the user presses Next (see the Modal below). */}
            {hotels.length > 0 && (
              <div className="prg-hotel-select-hint mb-3">
                Select a hotel to continue.
              </div>
            )}

            {isLoading ? (
              <div className="prg-loading">
                <Spinner animation="border" size="sm" /> <span>Searching for hotels…</span>
              </div>
            ) : hasSearched && filteredHotels.length > 0 ? (
              <div className="d-flex flex-column gap-3">
                {filteredHotels.map((hotel) => {
                  const isSelected = selectedHotelId === hotel.hotelId;
                  return (
                    <div
                      key={hotel.hotelId}
                      className={`room-category-item ${isSelected ? "pkg-hotel-selected" : ""}`}
                    >
                      <div
                        className="room-category-header"
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
                        style={{ cursor: "pointer" }}
                      >
                        <div className="d-flex justify-content-between align-items-center w-100 flex-wrap gap-3">
                          {/* Left cluster — hotel thumbnail + name / location.
                              Thumbnail uses hotel.image (from the /hotel-details
                              response). Broken URLs auto-hide via onError so a
                              missing image never leaves an ugly frame. */}
                          <div className="d-flex align-items-center gap-3 flex-grow-1" style={{ minWidth: 0 }}>
                            <div className="pkg-hotel-thumb">
                              {hotel.image ? (
                                <img
                                  src={getImageUrl(hotel.image)}
                                  alt={hotel.hotelName}
                                  onError={(e) => { e.target.style.display = "none"; }}
                                />
                              ) : (
                                <div className="pkg-hotel-thumb-fallback">
                                  <FaHotel />
                                </div>
                              )}
                            </div>
                            <div className="room-category-info" style={{ minWidth: 0 }}>
                              <h5 className="mb-1 d-flex align-items-center flex-wrap gap-2">
                                <span>{hotel.hotelName}</span>
                                {isSelected && (
                                  <span className="pkg-selected-badge">
                                    <FaCheckCircle size={10} />
                                    <span>SELECTED IN PACKAGE</span>
                                  </span>
                                )}
                              </h5>
                              <p className="mb-0 text-muted small">
                                <FaMapMarkerAlt size={10} className="me-1" />
                                {hotel.stateName}
                              </p>
                            </div>
                          </div>
                          <div className="d-flex align-items-center gap-3">
                            <div className="room-category-price text-end">
                              <div className="price-range">
                                {hotel.noOfnight} Night{hotel.noOfnight === 1 ? "" : "s"}
                              </div>
                              <div className="rates-count small text-muted">
                                Included in package
                              </div>
                            </div>
                            <Button
                              variant={isSelected ? "primary" : "outline-primary"}
                              size="sm"
                              className="d-flex align-items-center gap-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                selectHotel(hotel);
                              }}
                            >
                              {isSelected ? (
                                <>
                                  <FaCheckCircle size={12} />
                                  Selected
                                </>
                              ) : (
                                "Select Hotel"
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
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
        </Col>
      </Row>

      {/* Cancellation Policy card removed per product spec — the same
          cancellation-window details are still accessible from the
          "Cancellation Policies & Terms & Conditions" popup opened via the
          red link under the Total Price sidebar (see PackageBooking.jsx).
          The underlying cancellation fields on packageView are untouched. */}

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
        /* "01 Nights / 02 Days" — rendered in solid black per design. */
        .prg-hero-title strong {
          background: none;
          -webkit-background-clip: initial;
          background-clip: initial;
          color: #000000;
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
        /* Full-width single-column accordion: each day card takes the whole
           row so clicking Day 01 doesn't leave an odd tall/short pair with
           Day 02 in the same row. Matches the traditional accordion pattern
           the operator expects when clicking a day head. */
        .prg-timeline {
          display: flex;
          flex-direction: column;
          gap: 8px;
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
          background: #ffffff;
          color: #000000;
          font-weight: 700;
          font-size: 0.85rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border: 1px solid #e5e7eb;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
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
        /* Day photo — shown above the heading / place / activities in the
           expanded body. Rounded + subtle shadow so it echoes the hotel
           card thumbnails on /room-list. */
        .prg-day-image {
          display: block;
          width: 100%;
          max-height: 220px;
          object-fit: cover;
          border-radius: 10px;
          margin-bottom: 12px;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
        }
        .prg-day-body-heading {
          font-weight: 700;
          font-size: 0.95rem;
          color: #1e293b;
          margin-bottom: 4px;
        }
        .prg-day-body-place {
          display: inline-flex;
          align-items: center;
          font-size: 0.78rem;
          color: #64748b;
          margin-bottom: 10px;
        }

        /* ── Hotel row: thumbnail + selected state ──
           Thumbnail sits at the left of each .room-category-header row,
           before the hotel name. Fixed size so long hotel names don't
           squeeze the image and every row lines up. */
        .pkg-hotel-thumb {
          width: 96px;
          height: 72px;
          border-radius: 10px;
          overflow: hidden;
          flex-shrink: 0;
          background: #f1f5f9;
          box-shadow: 0 2px 6px rgba(15, 23, 42, 0.06);
        }
        .pkg-hotel-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .pkg-hotel-thumb-fallback {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
          font-size: 1.6rem;
          background: #f1f5f9;
        }
        @media (max-width: 575.98px) {
          .pkg-hotel-thumb { width: 72px; height: 56px; }
        }

        /* "SELECTED IN PACKAGE" chip — sits inline next to the hotel
           name so operators can spot the current pick at a glance
           without reading the button on the far right. */
        .pkg-selected-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          border-radius: 999px;
          background: #dcfce7;
          color: #15803d;
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          line-height: 1;
          white-space: nowrap;
        }

        /* Whole-row highlight for the selected hotel — subtle green tint
           + accent border so the row stands out from unselected ones
           even when the operator has scrolled past the button. */
        .pkg-hotel-selected .room-category-header {
          background: linear-gradient(to right, rgba(34, 197, 94, 0.05), transparent 60%);
          border-color: #22c55e !important;
        }
        .pkg-hotel-selected {
          box-shadow: 0 0 0 1px #22c55e, 0 6px 18px rgba(34, 197, 94, 0.10);
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

        /* Count pills ("2 days", "2 hotels") — white box, black text,
           matching the .prg-day-num day-index chips. */
        .prg-section-pill {
          padding: 3px 12px;
          background: #ffffff;
          color: #000000;
          border: 1px solid #e5e7eb;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
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
