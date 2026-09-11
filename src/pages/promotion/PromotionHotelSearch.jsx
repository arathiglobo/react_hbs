import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  Row,
  Col,
  Form,
  Button,
  Spinner,
  Table,
  Modal,
  Badge,
} from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  FaStar,
  FaTag,
  FaMapMarkerAlt,
  FaCalendarAlt,
  FaGift,
  FaPercent,
  FaBed,
  FaHotel,
  FaListUl,
  FaTimes,
  FaFire,
  FaCheckCircle,
} from "react-icons/fa";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import chevronStyle from "../../components/filters/dropdownChevron";
import "../../styles/HotelSearch.css";

/**
 * Simplified /promotion page — redesigned for a modern "deals showcase"
 * feel inspired by popular hotel-deals pages (Booking / Agoda / Hotels.com
 * promotions strips): a bold branded hero band with the month picker, a
 * quick-glance stats row, filter pills by promotion family, and a 3-up
 * card grid.
 *
 * The page is NOT part of the hotel-booking flow — all search inputs
 * (Agent, Destination, Nationality, Check-In/Out, Nights, Rooms &
 * Guests) were removed. Data comes from
 * GET /api/hotelPromotions/active-hotels, which returns every in-house
 * hotel that has at least one live promotion together with the compact
 * promotion detail rows shown inside the modal.
 */
const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

// Colour-coding used for the "type" pill on each promotion row. Kept
// aligned with the deal-pill palette on the standard /new-booking/hotel
// results strip so anyone who moves between the two pages recognises the
// same badge colours.
const PROMOTION_STYLES = {
  // Special Rates uses the Globosoft brand red so the dominant-family
  // ribbon on each hotel card matches the app header.
  "Special Rates": { bg: "#EC0B43", icon: FaGift, key: "special" },
  Discount: { bg: "#f0ad4e", icon: FaPercent, key: "discount" },
  StayPay: { bg: "#198754", icon: FaBed, key: "staypay" },
};

const styleForPromotion = (type) => {
  const key = (type || "").toLowerCase();
  if (key.includes("special")) return PROMOTION_STYLES["Special Rates"];
  if (key.includes("discount")) return PROMOTION_STYLES.Discount;
  if (key.includes("stay")) return PROMOTION_STYLES.StayPay;
  return { bg: "#6c757d", icon: FaTag, key: "other" };
};

// The four filter chips: All + one per promotion family. Wired up so
// clicking a chip narrows the visible cards to hotels with at least one
// promotion of that family.
const FAMILY_TABS = [
  { key: "all", label: "All Promotions", icon: FaFire },
  { key: "special", label: "Special Rates", icon: FaGift },
  { key: "discount", label: "Discount", icon: FaPercent },
  { key: "staypay", label: "Stay Pay", icon: FaBed },
];

export default function PromotionHotelSearch() {
  const navigate = useNavigate();
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [month, setMonth] = useState("");
  // Modal state — the hotel whose promotion details are being shown.
  const [detailsHotel, setDetailsHotel] = useState(null);
  // Filter-pill state: "all" | "special" | "discount" | "staypay"
  const [familyFilter, setFamilyFilter] = useState("all");

  const currentYear = useMemo(() => new Date().getFullYear(), []);

  useEffect(() => {
    const fetchHotels = async () => {
      setIsLoading(true);
      try {
        const params = {};
        if (month) {
          params.month = month;
          params.year = currentYear;
        }
        const res = await axiosInstance.get(
          "/api/hotelPromotions/active-hotels",
          { params },
        );
        setResults(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Failed to load hotels with active promotions", err);
        toast.error("Failed to load hotels with active promotions");
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHotels();
  }, [month, currentYear]);

  // Reset the family filter whenever the underlying result set changes
  // so a stale chip doesn't hide every card after switching months.
  useEffect(() => {
    setFamilyFilter("all");
  }, [results]);

  const openHotelPromotions = (h) => {
    if (!h || !h.hotelId) return;
    navigate(`/hotel-actions/${h.hotelId}/promotions`);
  };

  // Counts per family across all fetched hotels — powers both the stats
  // row and the badge counts on the family filter pills.
  const familyCounts = useMemo(() => {
    const counts = { special: 0, discount: 0, staypay: 0 };
    for (const h of results) {
      for (const p of h.promotions || []) {
        const key = styleForPromotion(p.promotionType).key;
        if (counts[key] != null) counts[key] += 1;
      }
    }
    return counts;
  }, [results]);

  const totalActivePromotions =
    familyCounts.special + familyCounts.discount + familyCounts.staypay;

  const selectedMonthLabel = useMemo(
    () => MONTHS.find((m) => String(m.value) === String(month))?.label,
    [month],
  );

  // Apply the family-tab filter to the fetched hotels. "all" passes
  // everything through; anything else keeps only hotels that have at
  // least one promotion of that family.
  const visibleResults = useMemo(() => {
    if (familyFilter === "all") return results;
    return results.filter((h) =>
      (h.promotions || []).some(
        (p) => styleForPromotion(p.promotionType).key === familyFilter,
      ),
    );
  }, [results, familyFilter]);

  const renderStars = (rating) => {
    const r = Number(rating) || 0;
    const total = 5;
    return (
      <span
        className="d-inline-flex align-items-center gap-1"
        title={`${r} star${r === 1 ? "" : "s"}`}
      >
        {Array.from({ length: total }).map((_, i) => (
          <FaStar
            key={i}
            style={{
              color: i < r ? "#f5b301" : "#e0e0e0",
              fontSize: "0.85rem",
            }}
          />
        ))}
      </span>
    );
  };

  const detailsPromoRows = Array.isArray(detailsHotel?.promotions)
    ? detailsHotel.promotions
    : [];

  // ── Inline style helpers ──────────────────────────────────────────
  // The whole page keeps the brand red `#EC0B43` (already in use across
  // the app) and Bootstrap defaults for typography. The hero card is
  // plain white with a soft border so it sits cleanly on the light page
  // background; only the "Live Deals" chip carries the brand red.
  const heroStyle = {
    background: "#ffffff",
    borderRadius: "16px",
    color: "#212529",
    padding: "28px 32px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
    border: "1px solid #eef0f2",
    position: "relative",
    overflow: "hidden",
  };

  // Subtle decorative circles behind the hero title — now tinted with
  // the brand red at low opacity so they still add depth against the
  // white background without stealing attention from the headline.
  const heroDecorStyle = {
    position: "absolute",
    right: -60,
    top: -60,
    width: 220,
    height: 220,
    borderRadius: "50%",
    background: "rgba(236,11,67,0.06)",
    pointerEvents: "none",
  };
  const heroDecorSmallStyle = {
    position: "absolute",
    right: 90,
    bottom: -40,
    width: 120,
    height: 120,
    borderRadius: "50%",
    background: "rgba(236,11,67,0.04)",
    pointerEvents: "none",
  };

  const statCardStyle = (accent) => ({
    backgroundColor: "white",
    borderRadius: "12px",
    padding: "16px 18px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
    borderLeft: `4px solid ${accent}`,
    display: "flex",
    alignItems: "center",
    gap: 12,
    height: "100%",
  });

  const familyPillStyle = (isActive) => ({
    padding: "8px 16px",
    borderRadius: "999px",
    border: isActive ? "1px solid #EC0B43" : "1px solid #dee2e6",
    backgroundColor: isActive ? "#EC0B43" : "white",
    color: isActive ? "white" : "#495057",
    fontSize: "0.85rem",
    fontWeight: 500,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    transition: "all 0.15s ease-in-out",
    boxShadow: isActive ? "0 2px 6px rgba(236,11,67,0.25)" : "none",
  });

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          {/* ─── Hero band ───────────────────────────────────────── */}
          <div style={heroStyle} className="mb-4">
            <div style={heroDecorStyle} />
            <div style={heroDecorSmallStyle} />
            <div
              className="d-flex justify-content-between align-items-start flex-wrap gap-3"
              style={{ position: "relative" }}
            >
              <div>
                <div
                  className="d-inline-flex align-items-center gap-2 px-3 py-1 mb-2"
                  style={{
                    backgroundColor: "rgba(236,11,67,0.10)",
                    color: "#EC0B43",
                    borderRadius: "999px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    letterSpacing: "0.5px",
                    textTransform: "uppercase",
                  }}
                >
                  <FaFire /> Live Deals
                </div>
                <h2
                  className="fw-bold mb-1 text-danger"
                  style={{ fontSize: "1.9rem", lineHeight: 1.15 }}
                >
                  Hotels with Active Promotions
                </h2>
                <p
                  className="mb-0 text-muted"
                  style={{ fontSize: "0.95rem", maxWidth: 640 }}
                >
                  Browse every in-house hotel currently running a Special
                  Rate, Discount or Stay-Pay promotion
                  {selectedMonthLabel
                    ? `, valid in ${selectedMonthLabel} ${currentYear}`
                    : ""}
                  .
                </p>
              </div>

              {/* Month picker — sits inside the hero for a compact filter */}
              <div
                className="d-flex align-items-center gap-2 px-3 py-2"
                style={{
                  backgroundColor: "#f8f9fa",
                  border: "1px solid #eef0f2",
                  borderRadius: "12px",
                  minWidth: 240,
                }}
              >
                <FaCalendarAlt className="text-danger" />
                <Form.Label
                  className="mb-0 small fw-semibold text-dark"
                >
                  Month
                </Form.Label>
                <Form.Select
                  size="sm"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  style={{
                    ...chevronStyle,
                    minWidth: 130,
                    backgroundColor: "white",
                    color: "#212529",
                    fontWeight: 500,
                  }}
                >
                  <option value="">All Months</option>
                  {MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </Form.Select>
                {month && (
                  <button
                    type="button"
                    onClick={() => setMonth("")}
                    className="btn btn-link p-0 text-danger text-decoration-none small"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ─── Stats row ──────────────────────────────────────── */}
          {!isLoading && results.length > 0 && (
            <Row className="g-3 mb-4">
              <Col md={3} sm={6} xs={12}>
                <div style={statCardStyle("#EC0B43")}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      backgroundColor: "rgba(236,11,67,0.10)",
                      color: "#EC0B43",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1.1rem",
                    }}
                  >
                    <FaHotel />
                  </div>
                  <div>
                    <div
                      className="text-muted small"
                      style={{ letterSpacing: "0.3px" }}
                    >
                      Hotels on offer
                    </div>
                    <div
                      className="fw-bold"
                      style={{ fontSize: "1.35rem", color: "#212529" }}
                    >
                      {results.length}
                    </div>
                  </div>
                </div>
              </Col>
              <Col md={3} sm={6} xs={12}>
                <div style={statCardStyle("#EC0B43")}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      backgroundColor: "rgba(236,11,67,0.10)",
                      color: "#EC0B43",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1.1rem",
                    }}
                  >
                    <FaGift />
                  </div>
                  <div>
                    <div
                      className="text-muted small"
                      style={{ letterSpacing: "0.3px" }}
                    >
                      Special Rates
                    </div>
                    <div
                      className="fw-bold"
                      style={{ fontSize: "1.35rem", color: "#212529" }}
                    >
                      {familyCounts.special}
                    </div>
                  </div>
                </div>
              </Col>
              <Col md={3} sm={6} xs={12}>
                <div style={statCardStyle("#f0ad4e")}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      backgroundColor: "rgba(240,173,78,0.12)",
                      color: "#f0ad4e",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1.1rem",
                    }}
                  >
                    <FaPercent />
                  </div>
                  <div>
                    <div
                      className="text-muted small"
                      style={{ letterSpacing: "0.3px" }}
                    >
                      Discount Offers
                    </div>
                    <div
                      className="fw-bold"
                      style={{ fontSize: "1.35rem", color: "#212529" }}
                    >
                      {familyCounts.discount}
                    </div>
                  </div>
                </div>
              </Col>
              <Col md={3} sm={6} xs={12}>
                <div style={statCardStyle("#198754")}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      backgroundColor: "rgba(25,135,84,0.12)",
                      color: "#198754",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1.1rem",
                    }}
                  >
                    <FaBed />
                  </div>
                  <div>
                    <div
                      className="text-muted small"
                      style={{ letterSpacing: "0.3px" }}
                    >
                      Stay-Pay Deals
                    </div>
                    <div
                      className="fw-bold"
                      style={{ fontSize: "1.35rem", color: "#212529" }}
                    >
                      {familyCounts.staypay}
                    </div>
                  </div>
                </div>
              </Col>
            </Row>
          )}

          {/* ─── Family filter pills ────────────────────────────── */}
          {!isLoading && results.length > 0 && (
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-4">
              <div className="d-flex align-items-center flex-wrap gap-2">
                {FAMILY_TABS.map((tab) => {
                  const isActive = familyFilter === tab.key;
                  const count =
                    tab.key === "all"
                      ? totalActivePromotions
                      : familyCounts[tab.key] || 0;
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      style={familyPillStyle(isActive)}
                      onClick={() => setFamilyFilter(tab.key)}
                    >
                      <Icon style={{ fontSize: "0.75rem" }} />
                      {tab.label}
                      <Badge
                        pill
                        bg={isActive ? "light" : "secondary"}
                        text={isActive ? "danger" : "light"}
                        style={{ fontSize: "0.7rem", fontWeight: 600 }}
                      >
                        {count}
                      </Badge>
                    </button>
                  );
                })}
              </div>
              <small className="text-muted">
                Showing <span className="fw-semibold">{visibleResults.length}</span>{" "}
                of {results.length} hotel{results.length === 1 ? "" : "s"}
              </small>
            </div>
          )}

          {/* ─── Content: loading / empty / grid ────────────────── */}
          {isLoading ? (
            <Card className="shadow-sm rounded-xl mb-4">
              <Card.Body className="text-center py-5">
                <Spinner animation="border" variant="danger" />
                <p className="text-muted mt-2 mb-0">
                  Loading hotels with active promotions…
                </p>
              </Card.Body>
            </Card>
          ) : visibleResults.length === 0 ? (
            <Card className="shadow-sm rounded-xl">
              <Card.Body className="text-center text-muted py-5">
                <div
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: "50%",
                    backgroundColor: "rgba(236,11,67,0.08)",
                    color: "#EC0B43",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "2rem",
                    marginBottom: 16,
                  }}
                >
                  <FaTag />
                </div>
                <h5 className="text-dark">No hotels found</h5>
                <p className="mb-0">
                  {results.length === 0
                    ? month
                      ? `No hotels have active promotions valid in ${selectedMonthLabel} ${currentYear}.`
                      : "No hotels have any active promotions."
                    : "No hotels match the selected promotion type."}
                </p>
                {results.length > 0 && familyFilter !== "all" && (
                  <Button
                    variant="outline-danger"
                    size="sm"
                    className="mt-3"
                    onClick={() => setFamilyFilter("all")}
                  >
                    Show all promotions
                  </Button>
                )}
              </Card.Body>
            </Card>
          ) : (
            <Row className="g-4">
              {visibleResults.map((h) => {
                const promoRows = Array.isArray(h.promotions)
                  ? h.promotions
                  : [];
                // Pick the dominant promotion family for the top ribbon.
                // Order of preference matches business priority: Special
                // Rates, then Discount, then Stay-Pay.
                const familyOrder = ["Special Rates", "Discount", "StayPay"];
                const dominantFamily =
                  familyOrder.find((f) =>
                    (h.promotionTypes || []).includes(f),
                  ) || (h.promotionTypes || [])[0];
                const dominantStyle = styleForPromotion(dominantFamily);
                const DominantIcon = dominantStyle.icon;
                return (
                  <Col xl={4} md={6} xs={12} key={h.hotelId}>
                    <div
                      style={{
                        backgroundColor: "white",
                        borderRadius: "14px",
                        border: "1px solid #eef0f2",
                        boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
                        overflow: "hidden",
                        transition:
                          "transform 0.15s ease-out, box-shadow 0.15s ease-out",
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-3px)";
                        e.currentTarget.style.boxShadow =
                          "0 8px 22px rgba(0,0,0,0.10)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow =
                          "0 2px 10px rgba(0,0,0,0.05)";
                      }}
                    >
                      {/* Colored ribbon — dominant promotion family */}
                      <div
                        style={{
                          backgroundColor: dominantStyle.bg,
                          color: "white",
                          padding: "10px 16px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          fontSize: "0.78rem",
                          fontWeight: 600,
                          letterSpacing: "0.3px",
                        }}
                      >
                        <span className="d-inline-flex align-items-center gap-2">
                          <DominantIcon />
                          {dominantFamily || "Promotion"}
                        </span>
                        <span
                          style={{
                            backgroundColor: "rgba(255,255,255,0.22)",
                            padding: "2px 8px",
                            borderRadius: "999px",
                            fontSize: "0.7rem",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <FaCheckCircle style={{ fontSize: "0.7rem" }} />
                          Live
                        </span>
                      </div>

                      {/* Body */}
                      <div
                        style={{
                          padding: "16px 18px",
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                          flexGrow: 1,
                        }}
                      >
                        {/* Top row — INHOUSE tag + Active count */}
                        <div className="d-flex align-items-center justify-content-between">
                          <span
                            style={{
                              backgroundColor: "#f1f3f5",
                              color: "#495057",
                              padding: "3px 10px",
                              borderRadius: "999px",
                              fontSize: "0.7rem",
                              fontWeight: 600,
                              letterSpacing: "0.3px",
                            }}
                          >
                            INHOUSE
                          </span>
                          <div className="d-inline-flex align-items-center gap-1">
                            <span
                              className="fw-bold"
                              style={{
                                fontSize: "1.5rem",
                                color: "#EC0B43",
                                lineHeight: 1,
                              }}
                            >
                              {h.promotionCount || 0}
                            </span>
                            <span
                              className="text-muted small"
                              style={{ lineHeight: 1 }}
                            >
                              active
                              <br />
                              promotion
                              {h.promotionCount === 1 ? "" : "s"}
                            </span>
                          </div>
                        </div>

                        {/* Hotel name */}
                        <div>
                          <h5
                            style={{
                              fontSize: "1.05rem",
                              fontWeight: 600,
                              marginBottom: 4,
                              color: "#212529",
                              lineHeight: 1.3,
                            }}
                          >
                            {h.hotelName || "Hotel Name Not Available"}
                          </h5>
                          <div className="d-flex align-items-center gap-2">
                            {renderStars(h.starRating)}
                            {h.hotelType && (
                              <span
                                className="text-muted small"
                                style={{ fontSize: "0.75rem" }}
                              >
                                · {h.hotelType}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Address */}
                        <div
                          className="d-flex align-items-start gap-1 text-muted"
                          style={{ fontSize: "0.82rem" }}
                        >
                          <FaMapMarkerAlt
                            className="text-danger flex-shrink-0"
                            style={{ fontSize: "0.75rem", marginTop: 3 }}
                          />
                          <span
                            style={{
                              overflow: "hidden",
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                            }}
                          >
                            {h.hotelAddress ||
                              [h.cityName, h.countryName]
                                .filter(Boolean)
                                .join(", ") ||
                              "Address Not Available"}
                          </span>
                        </div>

                        {/* Family badges */}
                        <div className="d-flex flex-wrap align-items-center gap-2">
                          {(h.promotionTypes || []).map((t) => {
                            const { bg, icon: Icon } = styleForPromotion(t);
                            return (
                              <span
                                key={t}
                                style={{
                                  backgroundColor: `${bg}18`,
                                  color: bg,
                                  border: `1px solid ${bg}55`,
                                  padding: "3px 10px",
                                  borderRadius: "999px",
                                  fontSize: "0.72rem",
                                  fontWeight: 600,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "5px",
                                }}
                              >
                                <Icon style={{ fontSize: "0.7rem" }} />
                                {t}
                              </span>
                            );
                          })}
                        </div>

                        {/* Footer actions */}
                        <div
                          className="d-flex align-items-center gap-2 mt-auto pt-3"
                          style={{ borderTop: "1px solid #f1f3f5" }}
                        >
                          <Button
                            size="sm"
                            variant="outline-secondary"
                            onClick={() => setDetailsHotel(h)}
                            className="d-inline-flex align-items-center gap-2 flex-grow-1"
                            disabled={promoRows.length === 0}
                          >
                            <FaListUl style={{ fontSize: "0.75rem" }} />
                            View Details
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => openHotelPromotions(h)}
                            className="flex-grow-1"
                          >
                            Manage
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Col>
                );
              })}
            </Row>
          )}

          {/* ─── Promotion details modal ────────────────────────── */}
          <Modal
            show={!!detailsHotel}
            onHide={() => setDetailsHotel(null)}
            size="lg"
            centered
            scrollable
          >
            <Modal.Header
              className="border-0"
              style={{ backgroundColor: "#ffffff" }}
            >
              <Modal.Title className="d-flex align-items-center gap-2 text-danger">
                <FaGift />
                Active Promotion Details
              </Modal.Title>
              <button
                type="button"
                className="btn btn-link text-secondary p-0 ms-auto"
                onClick={() => setDetailsHotel(null)}
                aria-label="Close"
                style={{ fontSize: "1.1rem", lineHeight: 1 }}
              >
                <FaTimes />
              </button>
            </Modal.Header>
            <Modal.Body style={{ backgroundColor: "#ffffff" }}>
              {detailsHotel && (
                <>
                  {/* Hotel header inside the modal */}
                  <Card
                    className="shadow-sm border-0 mb-3"
                    style={{ borderRadius: 10 }}
                  >
                    <Card.Body className="py-3 px-3">
                      <div className="d-flex align-items-start justify-content-between flex-wrap gap-2">
                        <div>
                          <h5
                            style={{
                              fontSize: "1.05rem",
                              fontWeight: 600,
                              marginBottom: 4,
                              color: "#212529",
                            }}
                          >
                            {detailsHotel.hotelName ||
                              "Hotel Name Not Available"}
                          </h5>
                          <div
                            className="d-flex align-items-center gap-1 text-muted"
                            style={{ fontSize: "0.85rem" }}
                          >
                            <FaMapMarkerAlt
                              className="text-danger"
                              style={{ fontSize: "0.75rem" }}
                            />
                            <span>
                              {detailsHotel.hotelAddress ||
                                [
                                  detailsHotel.cityName,
                                  detailsHotel.countryName,
                                ]
                                  .filter(Boolean)
                                  .join(", ") ||
                                "Address Not Available"}
                            </span>
                          </div>
                        </div>
                        <div className="d-flex flex-column align-items-end gap-1">
                          {renderStars(detailsHotel.starRating)}
                          <span
                            style={{
                              backgroundColor: "#ffffff",
                              color: "#EC0B43",
                              border: "1px solid #EC0B43",
                              padding: "3px 10px",
                              borderRadius: "12px",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <FaGift style={{ fontSize: "0.7rem" }} />
                            {detailsPromoRows.length} Active
                          </span>
                        </div>
                      </div>

                      {(detailsHotel.promotionTypes || []).length > 0 && (
                        <div className="d-flex flex-wrap align-items-center gap-2 mt-3">
                          {(detailsHotel.promotionTypes || []).map((t) => {
                            const { bg, icon: Icon } = styleForPromotion(t);
                            return (
                              <span
                                key={t}
                                style={{
                                  backgroundColor: "#ffffff",
                                  color: bg,
                                  border: `1px solid ${bg}`,
                                  padding: "4px 10px",
                                  borderRadius: "20px",
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "5px",
                                }}
                              >
                                <Icon style={{ fontSize: "0.7rem" }} />
                                {t}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </Card.Body>
                  </Card>

                  <Card
                    className="shadow-sm border-0"
                    style={{ borderRadius: 10 }}
                  >
                    <Card.Body className="p-0">
                      {detailsPromoRows.length === 0 ? (
                        <div className="text-center text-muted py-4">
                          <FaTag className="display-6 text-muted mb-2" />
                          <p className="mb-0">
                            No active promotion details available.
                          </p>
                        </div>
                      ) : (
                        <div className="table-responsive">
                          <Table
                            hover
                            className="mb-0 align-middle"
                            style={{ fontSize: "0.9rem" }}
                          >
                            <thead
                              style={{
                                backgroundColor: "#f8f9fa",
                                borderBottom: "2px solid #dee2e6",
                              }}
                            >
                              <tr>
                                <th style={{ width: 60 }} className="text-center">
                                  #
                                </th>
                                <th style={{ width: "22%" }}>Type</th>
                                <th style={{ width: "20%" }}>Code</th>
                                <th style={{ width: "15%" }}>Day Type</th>
                                <th>Validity</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detailsPromoRows.map((p, idx) => {
                                const { bg, icon: Icon } = styleForPromotion(
                                  p.promotionType,
                                );
                                const validities = Array.isArray(p.validities)
                                  ? p.validities
                                  : [];
                                return (
                                  <tr key={`${p.promotionType}-${p.id}-${idx}`}>
                                    <td className="text-center text-muted">
                                      {idx + 1}
                                    </td>
                                    <td>
                                      <span
                                        style={{
                                          backgroundColor: "#ffffff",
                                          color: bg,
                                          border: `1px solid ${bg}`,
                                          padding: "3px 10px",
                                          borderRadius: "12px",
                                          fontSize: "0.72rem",
                                          fontWeight: 600,
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: "5px",
                                        }}
                                      >
                                        <Icon style={{ fontSize: "0.7rem" }} />
                                        {p.promotionType}
                                      </span>
                                    </td>
                                    <td>
                                      <code
                                        style={{
                                          color: "#212529",
                                          backgroundColor: "#f1f3f5",
                                          padding: "3px 8px",
                                          borderRadius: "4px",
                                          fontSize: "0.82rem",
                                        }}
                                      >
                                        {p.promotionCode || "—"}
                                      </code>
                                    </td>
                                    <td>
                                      <span className="fw-semibold text-dark">
                                        {p.dayType || "—"}
                                      </span>
                                    </td>
                                    <td>
                                      {validities.length === 0 ? (
                                        <span className="text-muted">—</span>
                                      ) : (
                                        <div className="d-flex flex-column gap-1">
                                          {validities.map((v, i) => (
                                            <span
                                              key={i}
                                              className="d-inline-flex align-items-center gap-2"
                                              style={{ fontSize: "0.85rem" }}
                                            >
                                              <FaCalendarAlt
                                                className="text-danger"
                                                style={{ fontSize: "0.75rem" }}
                                              />
                                              <span className="fw-semibold">
                                                {v.validityFrom || "—"}
                                              </span>
                                              <span className="text-muted">
                                                →
                                              </span>
                                              <span className="fw-semibold">
                                                {v.validityTo || "—"}
                                              </span>
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </Table>
                        </div>
                      )}
                    </Card.Body>
                  </Card>
                </>
              )}
            </Modal.Body>
            <Modal.Footer
              className="d-flex justify-content-between align-items-center"
              style={{ backgroundColor: "#ffffff" }}
            >
              <small className="text-muted">
                {detailsPromoRows.length} promotion
                {detailsPromoRows.length === 1 ? "" : "s"} shown
              </small>
              <div className="d-flex gap-2">
                <Button
                  variant="outline-secondary"
                  onClick={() => setDetailsHotel(null)}
                >
                  Close
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    if (detailsHotel) openHotelPromotions(detailsHotel);
                    setDetailsHotel(null);
                  }}
                >
                  Manage Promotions
                </Button>
              </div>
            </Modal.Footer>
          </Modal>
        </main>
      </div>
    </div>
  );
}
