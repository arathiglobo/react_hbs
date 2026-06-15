import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Container,
  Row,
  Col,
  Spinner,
  Table,
  Form,
  Button,
  Card,
} from "react-bootstrap";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import toast from "react-hot-toast";
import { FaPaperPlane, FaArrowLeft } from "react-icons/fa";

// ── Styling tokens, adopted from BookingDetailedView so this page
//    has the same look-and-feel as the hotel booking details screen. ──
const BUTTON_STYLE = {
  backgroundColor: "#c0392b",
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

const StatusBadge = ({ status }) => {
  const isActive = status === true || status === "true";
  return (
    <span
      style={{
        color: isActive ? "#27ae60" : "#888",
        fontWeight: "700",
        fontSize: "0.85rem",
      }}
    >
      {isActive ? "Active" : "Inactive"}
    </span>
  );
};

// Image URL resolver — mirrors the existing helper in PackageReg.jsx so
// images saved with a Windows absolute path still render in-browser.
const getImageUrl = (imagePath) => {
  if (!imagePath) return "";
  if (imagePath.startsWith("http")) return imagePath;
  if (imagePath.includes("\\") || imagePath.includes(":")) {
    const filename = imagePath.split("\\").pop();
    return `${process.env.REACT_APP_API_BASE_URL}/api/files/${filename}`;
  }
  return `${process.env.REACT_APP_API_BASE_URL}/api/files/${imagePath}`;
};

const InfoRow = ({ label, value }) => (
  <div style={{ marginBottom: "6px", display: "flex", alignItems: "flex-start" }}>
    <span style={INFO_LABEL}>{label}</span>
    <span style={{ ...INFO_VALUE, marginLeft: "8px" }}>{value ?? "-"}</span>
  </div>
);

const card = {
  border: "1px solid #ddd",
  borderRadius: "4px",
  marginBottom: "14px",
  overflow: "hidden",
  backgroundColor: "#fff",
  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
};

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function PackageDetailedView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [pkg, setPkg] = useState(null);
  const [loading, setLoading] = useState(true);

  // Email-send state
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    axiosInstance
      .get(`/api/TravelPackage/view/${id}`)
      .then((res) => {
        if (res.data) {
          setPkg(res.data);
        } else {
          toast.error("Failed to load package details");
        }
      })
      .catch((err) => {
        console.error("Error loading package details:", err);
        toast.error(
          err.response?.data?.message || "Error loading package details"
        );
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleSendEmail = async () => {
    const e = email.trim();
    if (!e) {
      setEmailError("Email is required");
      return;
    }
    if (!EMAIL_RX.test(e)) {
      setEmailError("Please enter a valid email address");
      return;
    }
    setEmailError("");
    setSending(true);
    try {
      const res = await axiosInstance.post(
        `/api/TravelPackage/sendByEmail/${id}`,
        { email: e }
      );
      if (res.data?.status === "SUCCESS") {
        toast.success(res.data.message || `Package emailed to ${e}`);
        setEmail("");
      } else {
        toast.error(res.data?.message || "Failed to send email");
      }
    } catch (err) {
      console.error("Email send failed:", err);
      toast.error(
        err.response?.data?.message ||
          err.message ||
          "Failed to send email"
      );
    } finally {
      setSending(false);
    }
  };

  const includes = [
    pkg?.containHotel === 1 ? "Hotel" : null,
    pkg?.containCab === 1 ? "Cab" : null,
    pkg?.containActivity === 1 ? "Activity" : null,
  ].filter(Boolean);

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4" style={{ overflow: "auto" }}>
          <Container fluid style={{ maxWidth: "1100px" }}>
            <div className="mb-3">
              <button
                style={{ ...BUTTON_STYLE, backgroundColor: "#555" }}
                onClick={() => navigate(-1)}
              >
                <FaArrowLeft className="me-1" /> Back
              </button>
              <span
                style={{
                  marginLeft: "12px",
                  fontWeight: "700",
                  fontSize: "1.1rem",
                  color: "#333",
                }}
              >
                Package Details
              </span>
            </div>

            {loading ? (
              <div className="text-center py-5">
                <Spinner animation="border" style={{ color: "#c0392b" }} />
                <p className="mt-3 text-muted">Loading package details...</p>
              </div>
            ) : !pkg ? (
              <div className="text-center py-5 text-muted">
                Package not found.
              </div>
            ) : (
              <>
                {/* ── Basic Details ──────────────────────────────────── */}
                <div style={card}>
                  <div style={SECTION_HEADER}>Basic Details</div>
                  <div style={{ padding: "12px 16px" }}>
                    <Row>
                      <Col md={6}>
                        <InfoRow label="Package Name" value={pkg.packageName} />
                        <InfoRow label="Package Code" value={pkg.packageCode} />
                        <InfoRow label="Package Type" value={pkg.packageTypeName} />
                        <InfoRow
                          label="Basic Rate"
                          value={
                            pkg.packageBasicRate
                              ? `${pkg.currencyName ? pkg.currencyName + " " : ""}${pkg.packageBasicRate}`
                              : "-"
                          }
                        />
                        <InfoRow label="Currency" value={pkg.currencyName} />
                      </Col>
                      <Col md={6}>
                        <InfoRow label="No. of Nights" value={pkg.noOfNights} />
                        <InfoRow
                          label="Status"
                          value={<StatusBadge status={pkg.liveStatus} />}
                        />
                        <InfoRow
                          label="Includes"
                          value={includes.length > 0 ? includes.join(", ") : "-"}
                        />
                        <InfoRow
                          label="Arrive Country"
                          value={pkg.arriveCountryName}
                        />
                        <InfoRow
                          label="Arrive Places"
                          value={
                            pkg.arrivePlaces && pkg.arrivePlaces.length > 0
                              ? pkg.arrivePlaces
                                  .map((p) => p.name)
                                  .filter(Boolean)
                                  .join(", ") || "-"
                              : "-"
                          }
                        />
                      </Col>
                    </Row>
                    {pkg.packageCategories &&
                      pkg.packageCategories.length > 0 && (
                        <div className="mt-2">
                          <InfoRow
                            label="Categories"
                            value={pkg.packageCategories
                              .map((c) => c.name)
                              .filter(Boolean)
                              .join(", ")}
                          />
                        </div>
                      )}
                    {pkg.packageImage && (
                      <div className="mt-3">
                        <small className="text-muted d-block mb-1">
                          Package Image
                        </small>
                        <img
                          src={getImageUrl(pkg.packageImage)}
                          alt="Package"
                          style={{
                            maxWidth: "260px",
                            maxHeight: "180px",
                            objectFit: "cover",
                            borderRadius: "4px",
                            border: "1px solid #ddd",
                          }}
                          onError={(e) => {
                            e.target.style.display = "none";
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Overview ───────────────────────────────────────── */}
                {pkg.overview && (
                  <div style={card}>
                    <div style={SECTION_HEADER}>Overview</div>
                    <div
                      style={{
                        padding: "12px 16px",
                        fontSize: "0.85rem",
                        color: "#333",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {pkg.overview}
                    </div>
                  </div>
                )}

                {/* ── Itinerary ──────────────────────────────────────── */}
                {pkg.itineraries && pkg.itineraries.length > 0 && (
                  <div style={card}>
                    <div style={SECTION_HEADER}>Itinerary</div>
                    <div style={{ padding: "12px 16px" }}>
                      <Table bordered size="sm" style={{ fontSize: "0.82rem" }}>
                        <thead style={{ backgroundColor: "#f8f8f8" }}>
                          <tr>
                            <th style={{ width: 60 }}>Day</th>
                            <th>Heading</th>
                            <th>Place</th>
                            <th>Activities</th>
                            <th style={{ width: 120 }}>Image</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pkg.itineraries.map((it, idx) => (
                            <tr key={idx}>
                              <td>{it.day}</td>
                              <td>{it.heading || "-"}</td>
                              <td>{it.placeName || "-"}</td>
                              <td style={{ whiteSpace: "pre-wrap" }}>
                                {it.dayActivities || "-"}
                              </td>
                              <td>
                                {it.packageItinearyImage ? (
                                  <img
                                    src={getImageUrl(it.packageItinearyImage)}
                                    alt={`Day ${it.day}`}
                                    style={{
                                      maxWidth: "100px",
                                      maxHeight: "70px",
                                      objectFit: "cover",
                                      borderRadius: "3px",
                                    }}
                                    onError={(e) => {
                                      e.target.style.display = "none";
                                    }}
                                  />
                                ) : (
                                  "-"
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* ── Inclusions ─────────────────────────────────────── */}
                <div style={card}>
                  <div style={SECTION_HEADER}>Inclusions</div>
                  <div
                    style={{
                      padding: "12px 16px",
                      fontSize: "0.85rem",
                      color: "#333",
                    }}
                  >
                    {pkg.inclusions && pkg.inclusions.length > 0 ? (
                      <ul style={{ marginBottom: 0, paddingLeft: "18px" }}>
                        {pkg.inclusions.map((i) => (
                          <li key={i.otherId}>{i.description}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-muted">No inclusions.</span>
                    )}
                  </div>
                </div>

                {/* ── Exclusions ─────────────────────────────────────── */}
                <div style={card}>
                  <div style={SECTION_HEADER}>Exclusions</div>
                  <div
                    style={{
                      padding: "12px 16px",
                      fontSize: "0.85rem",
                      color: "#333",
                    }}
                  >
                    {pkg.exclusions && pkg.exclusions.length > 0 ? (
                      <ul style={{ marginBottom: 0, paddingLeft: "18px" }}>
                        {pkg.exclusions.map((i) => (
                          <li key={i.otherId}>{i.description}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-muted">No exclusions.</span>
                    )}
                  </div>
                </div>

                {/* ── Terms and Conditions ───────────────────────────── */}
                <div style={card}>
                  <div style={SECTION_HEADER}>Terms and Conditions</div>
                  <div
                    style={{
                      padding: "12px 16px",
                      fontSize: "0.85rem",
                      color: "#333",
                    }}
                  >
                    {pkg.termsAndConditions &&
                    pkg.termsAndConditions.length > 0 ? (
                      <ul style={{ marginBottom: 0, paddingLeft: "18px" }}>
                        {pkg.termsAndConditions.map((i) => (
                          <li key={i.otherId}>{i.description}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-muted">
                        No terms and conditions.
                      </span>
                    )}
                  </div>
                </div>

                {/* ── Send by Email ──────────────────────────────────── */}
                <Card style={{ ...card, marginTop: 16 }}>
                  <div style={SECTION_HEADER}>Email Package Details</div>
                  <div style={{ padding: "12px 16px" }}>
                    <Row className="align-items-end g-2">
                      <Col md={8}>
                        <Form.Label
                          style={{ fontSize: "0.82rem", fontWeight: 600 }}
                        >
                          Recipient Email
                        </Form.Label>
                        <Form.Control
                          type="email"
                          placeholder="Enter recipient email"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            if (emailError) setEmailError("");
                          }}
                          isInvalid={!!emailError}
                          disabled={sending}
                          size="sm"
                        />
                        {emailError && (
                          <Form.Control.Feedback type="invalid">
                            {emailError}
                          </Form.Control.Feedback>
                        )}
                        <small className="text-muted">
                          The package details will be sent as a PDF
                          attachment.
                        </small>
                      </Col>
                      <Col md={4}>
                        <Button
                          variant="success"
                          onClick={handleSendEmail}
                          disabled={sending}
                          className="w-100"
                          size="sm"
                        >
                          {sending ? (
                            <>
                              <Spinner
                                animation="border"
                                size="sm"
                                className="me-2"
                              />
                              Sending...
                            </>
                          ) : (
                            <>
                              <FaPaperPlane className="me-2" />
                              Send
                            </>
                          )}
                        </Button>
                      </Col>
                    </Row>
                  </div>
                </Card>
              </>
            )}
          </Container>
        </main>
      </div>
    </div>
  );
}
