/**
 * SeniorCitizenBookingDetailView.jsx
 *
 * Detail view for a single senior-citizen booking. Visual shell
 * mirrors StudentBookingDetailView / BookingDetailedView so the
 * detail pages read identically across the app. Functionality
 * unchanged.
 */

import React, { useEffect, useState } from "react";
import { Container, Row, Col, Spinner, Table } from "react-bootstrap";
import { useNavigate, useParams } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import toast from "react-hot-toast";

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

const parseLocal = (str) => {
  if (!str) return null;
  const normalized = str.includes("T") ? str : `${str}T00:00:00`;
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
};

const formatDate = (dateStr) => {
  const d = parseLocal(dateStr);
  if (!d) return "-";
  const day = String(d.getDate()).padStart(2, "0");
  return `${day} ${d.toLocaleString("default", { month: "short" })} ${d.getFullYear()}`;
};

const formatDateTime = (dateStr) => {
  const d = parseLocal(dateStr);
  if (!d) return "-";
  const hrs = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const sec = String(d.getSeconds()).padStart(2, "0");
  return `${formatDate(dateStr)} ${hrs}:${min}:${sec}`;
};

const StatusBadge = ({ status }) => {
  const s = (status || "").toUpperCase();
  let color = "#888";
  if (s === "CONFIRMED" || s === "RECONFIRMED") color = "#c0392b";
  else if (s === "CANCELLED") color = "#888";
  else if (s === "ON REQUEST") color = "#e67e22";
  return (
    <span style={{ color, fontWeight: "700", fontSize: "0.85rem" }}>
      {status || "-"}
    </span>
  );
};

export default function SeniorCitizenBookingDetailView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: payload } = await axiosInstance.get(
          `/api/senior-citizen-booking/${id}`,
        );
        if (payload?.success === false) {
          toast.error(payload?.message || "Not found");
          setData(null);
        } else {
          setData(payload);
        }
      } catch (e) {
        toast.error("Failed to load booking");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const card = {
    border: "1px solid #ddd",
    borderRadius: "4px",
    marginBottom: "14px",
    overflow: "hidden",
    backgroundColor: "#fff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  };

  // Build a compact discount summary in either backend shape.
  const discountSummary = (() => {
    if (!data) return "";
    if (data.discountType === "PERCENTAGE" && data.discountValue)
      return `${data.discountValue}%`;
    if (data.discountType === "AMOUNT" && data.discountValue)
      return `flat ${data.discountValue}`;
    const out = [];
    if (data.discountPercent) out.push(`${data.discountPercent}%`);
    if (data.discountAmount) out.push(`flat ${data.discountAmount}`);
    return out.join(" + ");
  })();

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4" style={{ overflow: "auto" }}>
          <Container fluid style={{ maxWidth: "1100px" }}>
            {/* Back button */}
            <div className="mb-3">
              <button
                style={{ ...BUTTON_STYLE, backgroundColor: "#555" }}
                onClick={() => navigate(-1)}
              >
                ← Back
              </button>
              <span
                style={{
                  marginLeft: "12px",
                  fontWeight: "700",
                  fontSize: "1.1rem",
                  color: "#333",
                }}
              >
                Booking Details
              </span>
            </div>

            {loading ? (
              <div className="text-center py-5">
                <Spinner animation="border" style={{ color: "#c0392b" }} />
                <p className="mt-3 text-muted">Loading booking details...</p>
              </div>
            ) : !data ? (
              <div className="text-center py-5 text-muted">
                Booking not found.
              </div>
            ) : (
              <>
                {/* ── Booking Information ───────────────────────────── */}
                <div style={card}>
                  <div style={SECTION_HEADER}>Booking Information</div>
                  <div style={{ padding: "12px 16px" }}>
                    <Row>
                      <Col md={6}>
                        <InfoRow label="Booking Code" value={data.bookingCode} />
                        <InfoRow label="Reference No." value={data.referenceNumber} />
                        <InfoRow label="Hotel Name" value={data.hotelName} />
                        <InfoRow label="Address" value={data.address} />
                        <InfoRow
                          label="Star Rating"
                          value={data.starRating ? `${data.starRating} Star` : "-"}
                        />
                        <InfoRow label="Check-In" value={formatDateTime(data.checkInDate)} />
                        <InfoRow label="Check-Out" value={formatDateTime(data.checkOutDate)} />
                        <InfoRow
                          label="No. of Nights"
                          value={data.nights ? `${data.nights} Nights` : "-"}
                        />
                      </Col>
                      <Col md={6}>
                        <InfoRow label="Agent" value={data.agentName} />
                        <InfoRow label="Source" value={data.source} />
                        <InfoRow label="Created By" value={data.createdByRole} />
                        <InfoRow label="Supplier Ref." value={data.supplierReference} />
                        <InfoRow
                          label="Deadline Date"
                          value={
                            data.deadlineDate
                              ? data.deadlineDate.replace("T", " ")
                              : "-"
                          }
                        />
                        <InfoRow label="Refund Status" value={data.refundStatus} />
                        <InfoRow label="Voucher" value={data.voucherGenerated} />
                        <InfoRow
                          label="Status"
                          value={
                            data.cancelled ? (
                              <StatusBadge status="CANCELLED" />
                            ) : (
                              <StatusBadge
                                status={
                                  data.confirmationStatus ||
                                  data.roomStatus ||
                                  "CONFIRMED"
                                }
                              />
                            )
                          }
                        />
                      </Col>
                    </Row>
                  </div>
                </div>

                {/* ── Guest Information ─────────────────────────────── */}
                {data.customer && (
                  <div style={card}>
                    <div style={SECTION_HEADER}>Guest Information</div>
                    <div style={{ padding: "12px 16px" }}>
                      <Row>
                        <Col md={6}>
                          <InfoRow
                            label="Guest Name"
                            value={
                              [
                                data.customer.salutation,
                                data.customer.firstName,
                                data.customer.middleName,
                                data.customer.lastName,
                              ]
                                .filter(Boolean)
                                .join(" ") || "-"
                            }
                          />
                          <InfoRow label="Email" value={data.customer.email} />
                          <InfoRow label="Phone" value={data.customer.phone} />
                        </Col>
                        <Col md={6}>
                          <InfoRow label="Passport No." value={data.customer.passportNo} />
                          <InfoRow
                            label="Nationality"
                            value={data.customer.customerNationality}
                          />
                          <InfoRow label="Agent LPO" value={data.customer.agentLpo} />
                        </Col>
                      </Row>
                    </div>
                  </div>
                )}

                {/* ── Senior Citizen Qualification ──────────────────── */}
                <div style={card}>
                  <div style={SECTION_HEADER}>Senior Citizen Qualification</div>
                  <div style={{ padding: "12px 16px" }}>
                    <Row>
                      <Col md={12}>
                        <div
                          style={{
                            fontSize: "0.82rem",
                            color: "#555",
                            marginBottom: "10px",
                          }}
                        >
                          Qualified by age — markup applied to rooms where at
                          least one adult is 60+.
                          {discountSummary && (
                            <>
                              {" "}
                              Configured discount:{" "}
                              <strong style={{ color: "#198754" }}>
                                {discountSummary}
                              </strong>
                            </>
                          )}
                        </div>
                      </Col>
                      {(data.rooms || []).map((r) => (
                        <Col md={4} key={r.roomBookingId || r.roomNo}>
                          <InfoRow
                            label={`Room ${r.roomNo} adult ages`}
                            value={
                              Array.isArray(r.adultAges) && r.adultAges.length
                                ? r.adultAges.join(", ")
                                : "-"
                            }
                          />
                        </Col>
                      ))}
                    </Row>
                  </div>
                </div>

                {/* ── Rooms Details ─────────────────────────────────── */}
                <div style={card}>
                  <div style={SECTION_HEADER}>Rooms Details</div>
                  <div style={{ padding: "10px 16px 4px" }}>
                    <span
                      style={{
                        color: "#c0392b",
                        fontWeight: "600",
                        fontSize: "0.85rem",
                        marginRight: "20px",
                      }}
                    >
                      No of Rooms - {(data.rooms || []).length} Room
                      {(data.rooms || []).length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {(data.rooms || []).map((room, idx) => (
                    <div
                      key={room.roomBookingId || idx}
                      style={{ padding: "8px 16px 12px" }}
                    >
                      <div
                        style={{
                          color: "#c0392b",
                          fontWeight: "700",
                          fontSize: "0.88rem",
                          marginBottom: "6px",
                        }}
                      >
                        Room {room.roomNo ?? idx + 1} -{" "}
                        <StatusBadge
                          status={
                            data.confirmationStatus ||
                            data.roomStatus ||
                            "CONFIRMED"
                          }
                        />
                      </div>
                      <Table
                        bordered
                        size="sm"
                        style={{ fontSize: "0.82rem", marginBottom: "6px" }}
                      >
                        <thead style={{ backgroundColor: "#f8f8f8" }}>
                          <tr>
                            <th>Room Category</th>
                            <th>Meal Type</th>
                            <th>Adults</th>
                            <th>Children</th>
                            <th>Before</th>
                            <th>After</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>{room.roomCategory || "-"}</td>
                            <td>{room.mealPlan || "-"}</td>
                            <td>{room.adults ?? "-"}</td>
                            <td>{room.children ?? "0"}</td>
                            <td className="text-decoration-line-through">
                              {room.rateBeforeDiscount ?? "-"}
                            </td>
                            <td>{room.rate ?? "-"}</td>
                          </tr>
                        </tbody>
                      </Table>
                    </div>
                  ))}
                </div>

                {/* ── Price Summary ─────────────────────────────────── */}
                <div style={card}>
                  <div style={SECTION_HEADER}>Price Summary</div>
                  <div style={{ padding: "12px 16px" }}>
                    <Row>
                      <Col md={4}>
                        <InfoRow
                          label="Total Before Discount"
                          value={
                            data.totalRateBeforeDiscount != null ? (
                              <span className="text-decoration-line-through">
                                {data.totalRateBeforeDiscount}
                              </span>
                            ) : (
                              "-"
                            )
                          }
                        />
                      </Col>
                      <Col md={4}>
                        <InfoRow
                          label="Discount Applied"
                          value={
                            [
                              data.discountPercent
                                ? `${data.discountPercent}%`
                                : "",
                              data.discountAmount
                                ? `flat ${data.discountAmount}`
                                : "",
                            ]
                              .filter(Boolean)
                              .join(" + ") || "-"
                          }
                        />
                      </Col>
                      <Col md={4}>
                        <InfoRow
                          label="Total Payable"
                          value={
                            <span
                              style={{
                                color: "#198754",
                                fontWeight: "700",
                                fontSize: "0.95rem",
                              }}
                            >
                              {data.totalRate ?? "-"}
                            </span>
                          }
                        />
                      </Col>
                    </Row>
                  </div>
                </div>

                {/* ── Cancellation block (only when cancelled) ─────── */}
                {data.cancelled && (
                  <div style={card}>
                    <div style={SECTION_HEADER}>Cancellation</div>
                    <div style={{ padding: "12px 16px" }}>
                      <InfoRow label="Cancelled At" value={data.cancelledAt} />
                      <InfoRow
                        label="Cancellation Reason"
                        value={data.cancellationReason}
                      />
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

function InfoRow({ label, value }) {
  return (
    <div
      style={{ marginBottom: "6px", display: "flex", alignItems: "flex-start" }}
    >
      <span style={INFO_LABEL}>{label}</span>
      <span style={{ ...INFO_VALUE, marginLeft: "8px" }}>{value ?? "-"}</span>
    </div>
  );
}
