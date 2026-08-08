import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Row, Col, Card, Modal, Button, Form } from "react-bootstrap";
import Sidebar from "../../../components/Sidebar";
import TopBar from "../../../components/TopBar";
import { toast } from "react-hot-toast";
import {
  FaCalendarAlt,
  FaUsers,
  FaGlobe,
  FaShieldAlt,
  FaTimesCircle,
  FaFileContract,
  FaCheckCircle,
  FaHotel,
} from "react-icons/fa";
import PaxInformation from "./tabs/PaxInformation";
import "../../../styles/PackageBooking_Stepper.css";
import "../../../styles/RoomList.css";
// HotelBookingPage's Booking-Summary card + Price-Details card classes
// (booking-summary-card, hbp-summary-row, hbp-price-card, hbp-sticky-summary)
// live in this stylesheet — imported so the sidebar picks up the HBP treatment.
import "../../../styles/HotelBookingPage.css";

// The stash channel that survives a hard refresh on this page. PackageBooking
// writes it just before navigating here (see setCurrentStep-turned-navigate
// handler), and this page reads it if location.state was dropped by a refresh.
const SESSION_KEY = (id) => `packageCheckoutDraft:${id}`;

const PackageCheckout = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // ── State hydration ─────────────────────────────────────────────────
  // Prefer location.state (fresh from PackageBooking's Next click). Fall
  // back to localStorage on refresh. If neither is present, redirect
  // back to Package Details — the user must complete step 1 first.
  const [checkoutState] = useState(() => {
    if (location.state?.bookingData) {
      try {
        localStorage.setItem(
          SESSION_KEY(id),
          JSON.stringify(location.state),
        );
      } catch {
        /* session storage unavailable → won't survive refresh, but the
           current tab still works from location.state */
      }
      return location.state;
    }
    try {
      const raw = localStorage.getItem(SESSION_KEY(id));
      if (raw) return JSON.parse(raw);
    } catch {
      /* corrupt draft → treated as missing */
    }
    return null;
  });

  useEffect(() => {
    if (!checkoutState && id) {
      toast.error("Please complete Package Details first.");
      navigate(`/new-booking/package-booking/${id}`, { replace: true });
    }
  }, [checkoutState, id, navigate]);

  const [bookingData, setBookingData] = useState(
    checkoutState?.bookingData || null,
  );
  const packageData = checkoutState?.packageData || null;
  const packageView = checkoutState?.packageView || null;
  const editingBookingId = checkoutState?.editingBookingId || null;
  const parentBookingCode = checkoutState?.parentBookingCode || null;
  const searchRate = checkoutState?.searchRate ?? null;

  // Ref into PaxInformation so the sidebar Confirm booking button (rendered
  // directly below the "Are you sure you want to continue with the booking?"
  // card) can invoke the same triggerConfirmClick() flow the old sticky-nav
  // Confirm used to run — validate pax → require modeOfPayment → require
  // bookingConfirmation → open the Terms & Conditions modal that ultimately
  // fires handleSubmitBooking.
  const paxInfoRef = useRef(null);

  // Keep localStorage in sync with bookingData mutations so a refresh
  // preserves whatever the operator has typed / selected on this page.
  useEffect(() => {
    if (!id || !bookingData) return;
    try {
      localStorage.setItem(
        SESSION_KEY(id),
        JSON.stringify({
          bookingData,
          packageData,
          packageView,
          editingBookingId,
          parentBookingCode,
          searchRate,
        }),
      );
    } catch {
      /* ignore quota errors */
    }
  }, [
    bookingData,
    id,
    packageData,
    packageView,
    editingBookingId,
    parentBookingCode,
    searchRate,
  ]);

  // ── Total price ─────────────────────────────────────────────────────
  // Same REPLACE logic as PackageBooking (hotel.totalRateWithMarkup already
  // contains the pax-sized + marked-up package cost — adding baseRate on
  // top would double-charge the agent's credit). Kept in state so the
  // /book payload sent from PaxInformation matches what the sidebar shows.
  const [totalPrice, setTotalPrice] = useState(0);
  useEffect(() => {
    if (!bookingData) return;
    const baseRate =
      Number(searchRate) > 0
        ? Number(searchRate)
        : Number(packageData?.rate) || 0;
    const { hotelPrice = 0, cabPrice = 0, activityPrice = 0 } =
      bookingData.selections || {};
    const packageTotal = hotelPrice > 0 ? hotelPrice : baseRate;
    setTotalPrice(packageTotal + cabPrice + activityPrice);
  }, [bookingData, packageData, searchRate]);

  const [showPolicyModal, setShowPolicyModal] = useState(false);

  const handlePrev = () => {
    navigate(`/new-booking/package-booking/${id}`, {
      state: {
        bookingData,
        packageData,
        packageView,
        editingBookingId,
        parentBookingCode,
        searchRate,
      },
    });
  };

  const handleFinish = async () => {
    try {
      toast.loading("Processing booking...");
      setTimeout(() => {
        toast.dismiss();
        toast.success("Booking confirmed successfully!");
        try {
          localStorage.removeItem(SESSION_KEY(id));
        } catch {
          /* ignore */
        }
        navigate("/booking-details/package-booking-list");
      }, 1500);
    } catch {
      toast.error("Failed to confirm booking");
    }
  };

  // ── Sidebar Booking Summary derivations ─────────────────────────────
  // Same shape / labels as PackageBooking so the operator sees the same
  // trip snapshot they had on the Package Details page.
  const formatDateForDisplay = (isoOrEmpty) => {
    if (!isoOrEmpty) return "";
    try {
      const [y, m, d] = isoOrEmpty.split("-").map(Number);
      const dt = new Date(y, m - 1, d);
      if (isNaN(dt.getTime())) return isoOrEmpty;
      return dt.toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return isoOrEmpty;
    }
  };

  if (!bookingData) return null;

  const packageNights = (() => {
    const raw =
      packageView?.noOfNights != null
        ? parseInt(packageView.noOfNights, 10)
        : NaN;
    return Number.isFinite(raw) ? raw : 0;
  })();
  const heroCheckIn = bookingData.searchParams?.travelDate || "";
  const heroCheckOut = (() => {
    if (!heroCheckIn || !packageNights) return "";
    const d = new Date(heroCheckIn);
    if (isNaN(d.getTime())) return "";
    d.setDate(d.getDate() + packageNights);
    return d.toISOString().split("T")[0];
  })();
  const heroGuestSummary =
    [
      bookingData.searchParams?.adultCount
        ? `${bookingData.searchParams.adultCount} adult${
            bookingData.searchParams.adultCount > 1 ? "s" : ""
          }`
        : "",
      bookingData.searchParams?.childCount
        ? `${bookingData.searchParams.childCount} child${
            bookingData.searchParams.childCount > 1 ? "ren" : ""
          }`
        : "",
    ]
      .filter(Boolean)
      .join(", ") || "—";
  const heroNationality =
    bookingData.searchParams?.paxPassport?.label ||
    bookingData.searchParams?.nationalityName ||
    "—";

  // ── Cancellation Policies popup content ────────────────────────────
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

  return (
    <div className="min-vh-100 bg-light d-flex flex-column hotel-booking-container room-list-container">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main
          className="content-wrapper flex-grow-1 booking-stepper-container"
          style={{ minWidth: 0, overflowX: "clip" }}
        >
          <div className="container-fluid" style={{ paddingTop: "10px" }}>
            <div className="hs-page-heading">
              <h3 className="hs-page-heading-title">Package Checkout</h3>
            </div>

            <Row className="g-3">
              <Col lg={8} className="hbp-left-col">
                <div className="main-booking-card">
                  <div className="tab-content-area">
                    <PaxInformation
                      ref={paxInfoRef}
                      searchParams={bookingData.searchParams}
                      bookingData={bookingData}
                      updateData={setBookingData}
                      onPrev={handlePrev}
                      onFinish={handleFinish}
                      packageData={packageData}
                      totalPrice={totalPrice}
                      editingBookingId={editingBookingId}
                      parentBookingCode={parentBookingCode}
                    />
                  </div>
                </div>
              </Col>

              <Col lg={4} className="hbp-right-col">
                <div className="sidebar-stack">
                  {/* Booking Summary — ported from HotelBookingPage.jsx's
                      right-sidebar booking-summary-card so the two flows
                      read as one system: blue Card.Header with icon + title,
                      package name (fw-bold text-primary) + destination
                      (text-muted small), then .hbp-summary-row rows for the
                      trip details. Data comes from the same derived vars
                      that fed the plain card before — nothing else changed. */}
                  <Card className="shadow-sm rounded-3 mb-3 booking-summary-card border-0 overflow-hidden">
                    <Card.Header className="bg-primary text-white py-2 rounded-top">
                      <h6 className="mb-0 d-flex align-items-center">
                        <FaHotel className="me-2" /> Booking Summary
                      </h6>
                    </Card.Header>
                    <Card.Body className="p-3">
                      {(packageData?.packageName || packageView?.packageName) && (
                        <div className="mb-3">
                          <div className="fw-bold text-primary mb-1">
                            {packageData?.packageName || packageView?.packageName}
                          </div>
                          {packageView?.arriveCountryName && (
                            <div className="text-muted small mb-2">
                              {packageView.arriveCountryName}
                            </div>
                          )}
                          {bookingData.selections?.selectedHotels?.[0]?.hotelName && (
                            <div className="d-flex flex-wrap align-items-center gap-2">
                              <span className="badge bg-warning text-dark">
                                {bookingData.selections.selectedHotels[0].hotelName}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="hbp-summary-row">
                        <div className="hbp-summary-label">
                          <FaCalendarAlt className="me-2 text-primary" />
                          Arrival date
                        </div>
                        <div className="hbp-summary-value">
                          {formatDateForDisplay(heroCheckIn) || "—"}
                        </div>
                      </div>
                      <div className="hbp-summary-row">
                        <div className="hbp-summary-label">
                          <FaCalendarAlt className="me-2 text-primary" />
                          Departure date
                        </div>
                        <div className="hbp-summary-value">
                          {formatDateForDisplay(heroCheckOut) || "—"}
                        </div>
                      </div>
                      <div className="hbp-summary-row">
                        <div className="hbp-summary-label">
                          <FaUsers className="me-2 text-primary" />
                          Guests
                        </div>
                        <div className="hbp-summary-value">
                          {heroGuestSummary}
                        </div>
                      </div>
                      <div className="hbp-summary-row">
                        <div className="hbp-summary-label">
                          <FaGlobe className="me-2 text-primary" />
                          Nationality
                        </div>
                        <div className="hbp-summary-value">
                          {heroNationality}
                        </div>
                      </div>
                    </Card.Body>
                  </Card>

                  {/* Total Price — add-view (baseRate + hotels + cabs +
                      activities), same as PackageBooking's sidebar display.
                      /book payload uses totalPrice state (REPLACE logic),
                      not this display number. */}
                  <div className="price-sidebar-card">
                    <div className="price-sidebar-label">Total Price</div>
                    <div className="price-sidebar-amount">
                      {(
                        (Number(searchRate) > 0
                          ? Number(searchRate)
                          : Number(packageData?.rate) || 0) +
                        (Number(bookingData.selections?.hotelPrice) || 0) +
                        (Number(bookingData.selections?.cabPrice) || 0) +
                        (Number(bookingData.selections?.activityPrice) || 0)
                      ).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                    <div className="price-sidebar-sub">AED · Selling price</div>
                  </div>

                  {/* Cancellation Policies link — same button + class as the
                      Package Details page's sidebar so the popup styling is
                      inherited. */}
                  {/* <div className="sidebar-policy-card">
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
                  </div> */}

                  {/* Booking Confirmation radios — required before Confirm
                      Booking (gated inside PaxInformation). */}
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
                          bookingData.programme?.bookingConfirmation ===
                          "Book & Voucher"
                        }
                        onChange={(e) =>
                          setBookingData((prev) => ({
                            ...prev,
                            programme: {
                              ...prev.programme,
                              bookingConfirmation: e.target.value,
                            },
                          }))
                        }
                      />
                      <Form.Check
                        type="radio"
                        id="pkg-hold-pay-later"
                        name="pkgBookingConfirmation"
                        label="Hold Package and Pay Later"
                        value="Book Now & Voucher later"
                        checked={
                          bookingData.programme?.bookingConfirmation ===
                          "Book Now & Voucher later"
                        }
                        onChange={(e) =>
                          setBookingData((prev) => ({
                            ...prev,
                            programme: {
                              ...prev.programme,
                              bookingConfirmation: e.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                  </div>

                  {/* Confirm booking — moved out of the sticky-nav row inside
                      PaxInformation so it sits directly below the "Are you
                      sure…" card. Triggers PaxInformation.triggerConfirmClick()
                      through the ref, which runs the same validate → mode of
                      payment → bookingConfirmation → Terms modal gate the
                      old button did. */}
                  <button
                    type="button"
                    className="btn-nav-next sidebar-confirm-btn"
                    onClick={() => paxInfoRef.current?.triggerConfirmClick()}
                  >
                    {editingBookingId ? "Save amendment →" : "Confirm booking →"}
                  </button>
                </div>

                <style>{`
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
                  /* Sidebar Confirm booking button — sits directly below the
                     "Are you sure…" card. Reuses .btn-nav-next's styling from
                     PackageBooking_Stepper.css but forces full width + adds
                     the same margin-top spacing the sidebar cards use. */
                  .sidebar-confirm-btn {
                    display: block;
                    width: 100%;
                    margin-top: 16px;
                  }
                  .sidebar-policy-card {
                    border: 1px solid var(--rl-border, #e2e8f0);
                    border-radius: 14px;
                    padding: 12px 16px;
                    background: var(--rl-card, #ffffff);
                    box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08);
                    margin-top: 16px;
                  }
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
                    margin-top: 3px;
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

      {/* Cancellation Policies popup — same content as PackageBooking's
          modal (Cancellation → Includes → Excludes → Terms). */}
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
              This is a <strong>NON-REFUNDABLE</strong> package within the
              charge window.
            </li>
          </ul>

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

          <h6
            className="fw-bold d-flex align-items-center mb-2 mt-4"
            style={{ color: "#1e293b" }}
          >
            <FaFileContract className="me-2 text-danger" /> Terms &amp;
            Conditions
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
              No specific terms were attached to this package.
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

export default PackageCheckout;
