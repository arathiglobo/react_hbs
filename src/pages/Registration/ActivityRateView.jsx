import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Container, Row, Col, Spinner, Alert, Card, Image } from "react-bootstrap";
import { FaArrowLeft, FaCalendarAlt, FaMapMarkerAlt, FaClock } from "react-icons/fa";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import toast from "react-hot-toast";

// Visual tokens copied from PackageDetailedView so the activity-rate view
// matches the existing "view" pages in the system (Bookings, Packages).
const BUTTON_STYLE = {
  backgroundColor: "#555",
  color: "#fff",
  border: "none",
  borderRadius: "3px",
  padding: "6px 14px",
  fontSize: "0.78rem",
  fontWeight: "600",
  cursor: "pointer",
  letterSpacing: "0.4px",
  whiteSpace: "nowrap",
};

const SECTION_HEADER = {
  backgroundColor: "#f0f0f0",
  padding: "7px 12px",
  fontWeight: "600",
  fontSize: "0.9rem",
  borderBottom: "1px solid #ddd",
  display: "flex",
  alignItems: "center",
  gap: "6px",
};

const INFO_LABEL = {
  fontWeight: "600",
  color: "#555",
  fontSize: "0.82rem",
  minWidth: "160px",
  display: "inline-block",
};

const INFO_VALUE = {
  color: "#222",
  fontSize: "0.82rem",
};

const CARD = {
  border: "1px solid #ddd",
  borderRadius: "4px",
  marginBottom: "14px",
  overflow: "hidden",
  backgroundColor: "#fff",
  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
};

// Image URL resolver — same shape PackageDetailedView uses so backend
// paths from any OS render correctly through /api/files/.
const getImageUrl = (imagePath) => {
  if (!imagePath) return "";
  if (imagePath.startsWith("http")) return imagePath;
  const base = process.env.REACT_APP_API_BASE_URL || "";
  if (imagePath.includes("\\") || imagePath.includes(":")) {
    const filename = imagePath.split("\\").pop();
    return `${base}/api/files/${filename}`;
  }
  return `${base}/api/files/${imagePath}`;
};

const InfoRow = ({ label, value }) => (
  <div style={{ marginBottom: "6px", display: "flex", alignItems: "flex-start" }}>
    <span style={INFO_LABEL}>{label}</span>
    <span style={{ ...INFO_VALUE, marginLeft: "8px" }}>
      {value === null || value === undefined || value === "" ? "-" : value}
    </span>
  </div>
);

// Friendly labels for the activity-type code stored on the rate.
// The picker in ActivityRates.jsx ships these as the option values:
//   "1" = Private, "2" = SIC
// Keys are strings because the backend returns activityType as a
// String on ActivityRateDTO; bracket-lookup works either way since
// JS object keys are always strings under the hood.
const ACTIVITY_TYPE_LABEL = {
  1: "Private",
  2: "SIC",
};

const formatDate = (s) => {
  if (!s) return "";
  // Accept "YYYY-MM-DD" or ISO; render dd-MM-yyyy.
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()}`;
};

export default function ActivityRateView() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [rate, setRate] = useState(null);
  const [extras, setExtras] = useState({ inclusions: [], terms: [], cancellations: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);

    // Fire both calls in parallel — the activity record AND the
    // inclusions/T&C/cancellation rows. Either failing alone shouldn't
    // block the other from rendering, so each catch falls back to an
    // empty slice and we only error-toast the rate fetch itself (it's
    // the one that decides whether the page has anything to show).
    Promise.allSettled([
      axiosInstance.get(`/api/activityRate/${id}`),
      axiosInstance.get(`/api/activityRate/inclutionAndTerms/${id}`),
    ])
      .then(([rateRes, extrasRes]) => {
        if (cancelled) return;
        if (rateRes.status === "fulfilled" && rateRes.value?.data) {
          setRate(rateRes.value.data);
        } else {
          toast.error("Failed to load activity details");
        }
        if (extrasRes.status === "fulfilled" && Array.isArray(extrasRes.value?.data)) {
          const all = extrasRes.value.data;
          setExtras({
            inclusions:    all.filter((x) => x.type === 1).map((x) => x.data || "").filter(Boolean),
            terms:         all.filter((x) => x.type === 2).map((x) => x.data || "").filter(Boolean),
            cancellations: all.filter((x) => x.type === 3).map((x) => x.data || "").filter(Boolean),
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const allMissing =
    !loading &&
    extras.inclusions.length === 0 &&
    extras.terms.length === 0 &&
    extras.cancellations.length === 0;

  const renderBulletList = (items, emptyLabel) => {
    if (!items || items.length === 0) {
      return <div className="text-muted small">{emptyLabel}</div>;
    }
    return (
      <ul className="mb-0 ps-3" style={{ fontSize: "0.85rem" }}>
        {items.map((line, i) => (
          <li key={i} className="mb-1">
            {line}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4" style={{ overflow: "auto" }}>
          <Container fluid style={{ maxWidth: "1100px" }}>
            <div className="mb-3 d-flex align-items-center gap-3 flex-wrap">
              <button style={BUTTON_STYLE} onClick={() => navigate(-1)}>
                <FaArrowLeft className="me-1" /> Back
              </button>
              <span
                style={{
                  fontWeight: "700",
                  fontSize: "1.1rem",
                  color: "#333",
                }}
              >
                Activity Details
              </span>
            </div>

            {loading ? (
              <div className="text-center py-5">
                <Spinner animation="border" style={{ color: "#c0392b" }} />
                <p className="mt-3 text-muted">Loading activity details...</p>
              </div>
            ) : !rate ? (
              <div className="text-center py-5 text-muted">
                Activity not found.
              </div>
            ) : (
              <>
                {/* Red banner shown ONLY when all three buckets
                    (Inclusions, T&C, Cancellation policies) are empty.
                    Mirrors the user's "in red color these are not still
                    added for this tour on top" requirement. */}
                {allMissing && (
                  <Alert variant="danger" className="py-2 mb-3 small">
                    Inclusions, Exclusions and Terms &amp; Conditions have not
                    been added for this tour yet.
                  </Alert>
                )}

                {/* ── Basic Details ────────────────────────────────── */}
                <div style={CARD}>
                  <div style={SECTION_HEADER}>Basic Details</div>
                  <div style={{ padding: "12px 16px" }}>
                    <Row>
                      <Col md={6}>
                        <InfoRow label="Activity Name" value={rate.activityName} />
                        <InfoRow label="Activity Code" value={rate.activityCode} />
                        <InfoRow
                          label="Activity Type"
                          value={
                            ACTIVITY_TYPE_LABEL[rate.activityType] ||
                            rate.activityType ||
                            "-"
                          }
                        />
                        <InfoRow
                          label="Market Type"
                          value={
                            // Backend returns marketType as a list of
                            // IDs (List<Long>) on ActivityRateDTO; we
                            // don't have a name lookup so just join
                            // them with commas. Single-value form
                            // searches also seed marketType[0] only.
                            Array.isArray(rate.marketType)
                              ? rate.marketType.join(", ")
                              : rate.marketType || "-"
                          }
                        />
                        <InfoRow label="Rating" value={rate.rating} />
                      </Col>
                      <Col md={6}>
                        <InfoRow
                          label="Duration"
                          value={
                            (rate.durationHr || rate.durationMin)
                              ? `${rate.durationHr || 0}h ${rate.durationMin || 0}m`
                              : "-"
                          }
                        />
                        {/* ActivityRateDTO ships only the IDs, no
                            countryName/placeName. We show the ID
                            with a hint label so the view stays
                            useful until the backend enriches the
                            DTO with names. */}
                        <InfoRow
                          label="Country"
                          value={
                            rate.countryName ||
                            (rate.countryId ? `ID: ${rate.countryId}` : "-")
                          }
                        />
                        <InfoRow
                          label="Place"
                          value={
                            rate.placeName ||
                            (rate.placeId ? `ID: ${rate.placeId}` : "-")
                          }
                        />
                        <InfoRow
                          label="Reporting Point"
                          value={rate.reportingPoint}
                        />
                        <InfoRow
                          label="Total Users Allowed"
                          value={rate.totalUsersAllowed}
                        />
                      </Col>
                    </Row>
                    {rate.activityDetails && (
                      <div className="mt-2">
                        <div style={INFO_LABEL}>Activity Details</div>
                        <div
                          style={{
                            ...INFO_VALUE,
                            whiteSpace: "pre-wrap",
                            marginTop: "4px",
                          }}
                        >
                          {rate.activityDetails}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Pricing ──────────────────────────────────────── */}
                <div style={CARD}>
                  <div style={SECTION_HEADER}>Pricing</div>
                  <div style={{ padding: "12px 16px" }}>
                    <Row>
                      <Col md={6}>
                        <InfoRow label="Adult Rate" value={rate.adultRate} />
                        <InfoRow label="Child Rate" value={rate.childRate} />
                        <InfoRow label="Activity Rate" value={rate.activityRate} />
                      </Col>
                      <Col md={6}>
                        <InfoRow
                          label="Min Pax"
                          value={rate.minimunPax ?? rate.minPax}
                        />
                        <InfoRow label="Max Pax" value={rate.maxPax} />
                        <InfoRow
                          label="Child Age Range"
                          value={
                            rate.childAgeMin != null && rate.childAgeMax != null
                              ? `${rate.childAgeMin} – ${rate.childAgeMax}`
                              : "-"
                          }
                        />
                      </Col>
                    </Row>
                  </div>
                </div>

                {/* ── Pickup / Drop-off ──────────────────────────────── */}
                {(rate.pickupName ||
                  rate.dropOffName ||
                  rate.pickupTime ||
                  rate.dropOffTime) && (
                  <div style={CARD}>
                    <div style={SECTION_HEADER}>
                      <FaMapMarkerAlt /> Pickup / Drop-off
                    </div>
                    <div style={{ padding: "12px 16px" }}>
                      <Row>
                        <Col md={6}>
                          <InfoRow label="Pickup Source" value={rate.pickupSource} />
                          <InfoRow label="Pickup Name" value={rate.pickupName} />
                          <InfoRow
                            label="Pickup Time"
                            value={
                              rate.pickupTime && (
                                <>
                                  <FaClock className="me-1 text-muted" />
                                  {rate.pickupTime}
                                </>
                              )
                            }
                          />
                        </Col>
                        <Col md={6}>
                          <InfoRow label="Drop-off Source" value={rate.dropOffSource} />
                          <InfoRow label="Drop-off Name" value={rate.dropOffName} />
                          <InfoRow
                            label="Drop-off Time"
                            value={
                              rate.dropOffTime && (
                                <>
                                  <FaClock className="me-1 text-muted" />
                                  {rate.dropOffTime}
                                </>
                              )
                            }
                          />
                        </Col>
                      </Row>
                    </div>
                  </div>
                )}

                {/* ── Validity ──────────────────────────────────────── */}
                {Array.isArray(rate.validity) && rate.validity.length > 0 && (
                  <div style={CARD}>
                    <div style={SECTION_HEADER}>
                      <FaCalendarAlt /> Validity
                    </div>
                    <div style={{ padding: "12px 16px" }}>
                      {rate.validity.map((v, i) => (
                        <div
                          key={v.validityId || v.id || i}
                          className="d-flex gap-3 small mb-1"
                        >
                          <span style={{ minWidth: 70, color: "#555" }}>
                            Period {i + 1}:
                          </span>
                          <span>
                            {formatDate(v.validityFrom)} → {formatDate(v.validityTo)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Inclusions ────────────────────────────────────── */}
                <div style={CARD}>
                  <div style={SECTION_HEADER}>Inclusions</div>
                  <div style={{ padding: "12px 16px" }}>
                    {renderBulletList(
                      extras.inclusions,
                      "No inclusions added for this tour.",
                    )}
                  </div>
                </div>

                {/* ── Terms & Conditions ────────────────────────────── */}
                <div style={CARD}>
                  <div style={SECTION_HEADER}>Terms &amp; Conditions</div>
                  <div style={{ padding: "12px 16px" }}>
                    {renderBulletList(
                      extras.terms,
                      "No terms & conditions added for this tour.",
                    )}
                  </div>
                </div>

                {/* ── Cancellation Policies ─────────────────────────── */}
                <div style={CARD}>
                  <div style={SECTION_HEADER}>Cancellation Policies</div>
                  <div style={{ padding: "12px 16px" }}>
                    {renderBulletList(
                      extras.cancellations,
                      "No cancellation policies added for this tour.",
                    )}
                  </div>
                </div>

                {/* ── Images ────────────────────────────────────────── */}
                {(rate.imagePath ||
                  (Array.isArray(rate.imagePaths) && rate.imagePaths.length > 0)) && (
                  <div style={CARD}>
                    <div style={SECTION_HEADER}>Images</div>
                    <div style={{ padding: "12px 16px" }}>
                      <div className="d-flex flex-wrap gap-2">
                        {rate.imagePath && (
                          <Image
                            src={getImageUrl(rate.imagePath)}
                            rounded
                            thumbnail
                            style={{ maxHeight: 120 }}
                            alt="Primary"
                          />
                        )}
                        {Array.isArray(rate.imagePaths) &&
                          rate.imagePaths.map((p, i) => (
                            <Image
                              key={i}
                              src={getImageUrl(p)}
                              rounded
                              thumbnail
                              style={{ maxHeight: 120 }}
                              alt={`Gallery ${i + 1}`}
                            />
                          ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </Container>
        </main>
      </div>
    </div>
  );
}
