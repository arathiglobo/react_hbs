import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Container, Row, Col, Spinner, Table } from "react-bootstrap";
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
  const mon = String(d.getMonth() + 1).padStart(2, "0");
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

export default function BookingDetailedView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    axiosInstance
      .get(`/api/hotel-booking/${id}`)
      .then((res) => {
        if (res.data?.success) {
          setBooking(res.data);
        } else {
          toast.error(res.data?.message || "Failed to load booking details");
        }
      })
      .catch(() => toast.error("Error loading booking details"))
      .finally(() => setLoading(false));
  }, [id]);

  const totalRooms = booking?.rooms?.length ?? 0;
  const totalAdults = booking?.rooms?.reduce((s, r) => s + (r.adults || 0), 0) ?? 0;
  const totalChildren = booking?.rooms?.reduce((s, r) => s + (r.children || 0), 0) ?? 0;
  const totalGuests = totalAdults + totalChildren;

  const card = {
    border: "1px solid #ddd",
    borderRadius: "4px",
    marginBottom: "14px",
    overflow: "hidden",
    backgroundColor: "#fff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  };

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
            ) : !booking ? (
              <div className="text-center py-5 text-muted">
                Booking not found.
              </div>
            ) : (
              <>
                {/* ── 24-Hour Check-In highlight banner ────────────────
                     Surfaced above Booking Information so the operator
                     spots the special-flow status at a glance, with the
                     chosen times when present. Hidden entirely when the
                     booking is a normal stay. */}
                {booking.is24HourCheckin && (
                  <div
                    style={{
                      backgroundColor: "#fff8e1",
                      border: "1px solid #f5c518",
                      borderLeft: "6px solid #f5c518",
                      borderRadius: 4,
                      padding: "8px 12px",
                      marginBottom: 10,
                      fontSize: "0.85rem",
                      color: "#5b4500",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <span
                      style={{
                        backgroundColor: "#f5c518",
                        color: "#000",
                        fontWeight: 700,
                        fontSize: "0.7rem",
                        padding: "2px 8px",
                        borderRadius: 3,
                        letterSpacing: 0.5,
                      }}
                    >
                      24-HOUR CHECK-IN
                    </span>
                    <span>
                      This booking was made via the 24-hour check-in flow.
                      {booking.checkInTime && (
                        <> Check-In: <strong>{booking.checkInTime}</strong></>
                      )}
                      {booking.checkOutTime && (
                        <> · Check-Out: <strong>{booking.checkOutTime}</strong></>
                      )}
                    </span>
                  </div>
                )}

                {/* ── Booking Info ─────────────────────────────────────── */}
                <div style={card}>
                  <div style={SECTION_HEADER}>
                    Booking Information
                    {booking.is24HourCheckin && (
                      <span
                        style={{
                          marginLeft: 8,
                          backgroundColor: "#f5c518",
                          color: "#000",
                          fontWeight: 700,
                          fontSize: "0.65rem",
                          padding: "2px 6px",
                          borderRadius: 3,
                        }}
                      >
                        24H
                      </span>
                    )}
                  </div>
                  <div style={{ padding: "12px 16px" }}>
                    <Row>
                      <Col md={6}>
                        <InfoRow label="Booking Code" value={booking.bookingCode} />
                        <InfoRow label="Reference No." value={booking.referenceNumber} />
                        <InfoRow label="Hotel Name" value={booking.hotelName} />
                        <InfoRow label="Address" value={booking.address} />
                        <InfoRow label="Star Rating" value={booking.starRating ? `${booking.starRating} Star` : "-"} />
                        <InfoRow label="Check-In" value={formatDateTime(booking.checkInDate)} />
                        <InfoRow label="Check-Out" value={formatDateTime(booking.checkOutDate)} />
                        <InfoRow label="No. of Nights" value={booking.nights ? `${booking.nights} Nights` : "-"} />
                      </Col>
                      <Col md={6}>
                        <InfoRow label="Agent" value={booking.agentName} />
                        <InfoRow label="Source" value={booking.source} />
                        <InfoRow label="Created By" value={booking.createdByRole} />
                        <InfoRow label="Supplier Ref." value={booking.supplierReference} />
                        <InfoRow label="Deadline Date"   value={booking.deadlineDate? booking.deadlineDate.replace("T", " "): "-"} />
                        <InfoRow label="Refund Status" value={booking.refundStatus} />
                        <InfoRow label="Voucher" value={booking.voucherGenerated} />
                        <InfoRow
                          label="Status"
                          value={<StatusBadge status={booking.confirmationStatus} />}
                        />
                      </Col>
                    </Row>
                  </div>
                </div>

                {/* ── Guest / Customer Info ─────────────────────────── */}
                {booking.customer && (
                  <div style={card}>
                    <div style={SECTION_HEADER}>Guest Information</div>
                    <div style={{ padding: "12px 16px" }}>
                      <Row>
                        <Col md={6}>
                          <InfoRow
                            label="Guest Name"
                            value={[
                              booking.customer.salutation,
                              booking.customer.firstName,
                              booking.customer.middleName,
                              booking.customer.lastName,
                            ]
                              .filter(Boolean)
                              .join(" ") || "-"}
                          />
                          <InfoRow label="Email" value={booking.customer.email} />
                          <InfoRow label="Phone" value={booking.customer.phone} />
                        </Col>
                        <Col md={6}>
                          <InfoRow label="Passport No." value={booking.customer.passportNo} />
                          <InfoRow label="Nationality" value={booking.customer.customerNationality} />
                          <InfoRow label="Agent LPO" value={booking.customer.agentLpo} />
                        </Col>
                      </Row>
                    </div>
                  </div>
                )}

                {/* ── Rooms Details ─────────────────────────────────── */}
                <div style={card}>
                  <div style={SECTION_HEADER}>Rooms Details</div>
                  <div style={{ padding: "10px 16px 4px" }}>
                    <span style={{ color: "#c0392b", fontWeight: "600", fontSize: "0.85rem", marginRight: "20px" }}>
                      No of Rooms - {totalRooms} Room{totalRooms !== 1 ? "s" : ""}
                    </span>
                    <span style={{ color: "#c0392b", fontWeight: "600", fontSize: "0.85rem" }}>
                      No of Guests - {totalAdults} Adult{totalAdults !== 1 ? "s" : ""}
                      {totalChildren > 0 ? `, ${totalChildren} Child${totalChildren !== 1 ? "ren" : ""}` : ""}
                    </span>
                  </div>

                  {(booking.rooms || []).map((room, idx) => (
                    <div key={room.roomBookingId || idx} style={{ padding: "8px 16px 12px" }}>
                      <div
                        style={{
                          color: "#c0392b",
                          fontWeight: "700",
                          fontSize: "0.88rem",
                          marginBottom: "6px",
                        }}
                      >
                        Room {room.roomNo ?? idx + 1} -{" "}
                        <StatusBadge status={booking.confirmationStatus} />
                      </div>
                      {/* Per-room Rate cell already shows the room's
                          billable rate. Per spec the Tourism Dirham
                          captured on the booking now flows into Rate and
                          Total Rate so the operator sees the FULL amount
                          the customer pays. TD is shared across the
                          booking, so we distribute it evenly across
                          rooms (rounded to 2 dp) for the per-row Rate
                          column — the totals row below still uses the
                          single, untouched booking-level TD value. */}
                      {(() => {
                        const roomCount = Array.isArray(booking.rooms)
                          ? booking.rooms.length
                          : 1;
                        const td = Number(booking.tourismDirham) || 0;
                        const tdShare = roomCount > 0 ? td / roomCount : 0;
                        const baseRate = Number(room.rate) || 0;
                        const rateWithTd = baseRate + tdShare;
                        return (
                          <Table
                            bordered
                            size="sm"
                            style={{ fontSize: "0.82rem", marginBottom: "6px" }}
                          >
                            <thead style={{ backgroundColor: "#f8f8f8" }}>
                              <tr>
                                <th>Room Category</th>
                                <th>Meal Type</th>
                                <th>Supplier Ref.</th>
                                <th>Hotel Conf No.</th>
                                <th>Adults</th>
                                <th>Children</th>
                                <th>Rate</th>
                                <th>Currency</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td>{room.roomCategory || "-"}</td>
                                <td>{room.mealPlan || "-"}</td>
                                <td>{booking.supplierReference || "-"}</td>
                                <td>{booking.referenceNumber || "-"}</td>
                                <td>{room.adults ?? "-"}</td>
                                <td>{room.children ?? "0"}</td>
                                <td>
                                  {room.rate != null
                                    ? rateWithTd.toFixed(2)
                                    : "-"}
                                  {td > 0 && room.rate != null && (
                                    <div
                                      style={{
                                        fontSize: "0.68rem",
                                        color: "#888",
                                        fontWeight: 500,
                                        marginTop: 2,
                                      }}
                                    >
                                      ({baseRate.toFixed(2)} + TD{" "}
                                      {tdShare.toFixed(2)})
                                    </div>
                                  )}
                                </td>
                                <td>{room.currency || "-"}</td>
                              </tr>
                            </tbody>
                          </Table>
                        );
                      })()}

                      {/* Room guests */}
                      {room.guests && room.guests.length > 0 && (
                        <div style={{ marginTop: "4px", marginBottom: "8px" }}>
                          <div style={{ fontSize: "0.78rem", fontWeight: "600", color: "#555", marginBottom: "4px" }}>
                            Room Guests:
                          </div>
                          <Table bordered size="sm" style={{ fontSize: "0.78rem" }}>
                            <thead style={{ backgroundColor: "#f8f8f8" }}>
                              <tr>
                                <th>#</th>
                                <th>Name</th>
                                <th>Gender</th>
                                <th>Type</th>
                              </tr>
                            </thead>
                            <tbody>
                              {room.guests.map((g, gi) => (
                                <tr key={g.guestId || gi}>
                                  <td>{gi + 1}</td>
                                  <td>
                                    {[g.salutation, g.firstName, g.lastName]
                                      .filter(Boolean)
                                      .join(" ") || "-"}
                                  </td>
                                  <td>{g.gender || "-"}</td>
                                  <td>{g.isChild ? `Child (Age: ${g.childAge ?? "-"})` : "Adult"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Summary row */}
                  <div
                    style={{
                      padding: "8px 16px",
                      borderTop: "1px solid #eee",
                      fontSize: "0.85rem",
                      display: "flex",
                      gap: "24px",
                      color: "#333",
                    }}
                  >
                    {/* Total Rate now includes Tourism Dirham so the
                        amount shown here matches what's billed. The
                        original (pre-TD) total is retained as a small
                        hint underneath whenever TD > 0. */}
                    {(() => {
                      const baseTotal = Number(booking.totalRate) || 0;
                      const td = Number(booking.tourismDirham) || 0;
                      const grand = baseTotal + td;
                      return (
                        <span>
                          <span style={{ fontWeight: "600" }}>Total Rate: </span>
                          {booking.totalRate != null
                            ? grand.toFixed(2)
                            : "-"}
                          {td > 0 && booking.totalRate != null && (
                            <span
                              style={{
                                marginLeft: 6,
                                fontSize: "0.72rem",
                                color: "#888",
                              }}
                            >
                              ({baseTotal.toFixed(2)} + TD {td.toFixed(2)})
                            </span>
                          )}
                        </span>
                      );
                    })()}
                    <span>
                      <span style={{ fontWeight: "600" }}>Refund Type: </span>
                      {booking.refundStatus || "-"}
                    </span>
                  </div>
                </div>

                {/* ── Sub-Bookings (created via Edit) ────────────────── */}
                {booking.subBookings && booking.subBookings.length > 0 && (
                  <div style={card}>
                    <div style={SECTION_HEADER}>
                      Related Sub-Bookings ({booking.subBookings.length})
                    </div>
                    <div style={{ padding: "10px 16px" }}>
                      {booking.subBookings.map((sub) => {
                        const subRooms = sub.rooms?.length ?? 0;
                        const subAdults =
                          sub.rooms?.reduce((s, r) => s + (r.adults || 0), 0) ?? 0;
                        const subChildren =
                          sub.rooms?.reduce((s, r) => s + (r.children || 0), 0) ?? 0;
                        return (
                          <div
                            key={sub.bookingId}
                            style={{
                              borderTop: "1px solid #eee",
                              padding: "10px 0",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: "6px",
                              }}
                            >
                              <span
                                style={{
                                  color: "#c0392b",
                                  fontWeight: "700",
                                  fontSize: "0.9rem",
                                }}
                              >
                                {sub.bookingCode || "-"}
                                {sub.childBookingIndex != null && (
                                  <span
                                    style={{
                                      marginLeft: "8px",
                                      color: "#888",
                                      fontWeight: "500",
                                      fontSize: "0.8rem",
                                    }}
                                  >
                                    (Edit #{sub.childBookingIndex})
                                  </span>
                                )}
                              </span>
                              <button
                                style={{ ...BUTTON_STYLE, backgroundColor: "#555" }}
                                onClick={() =>
                                  navigate(
                                    `/booking-details/hotel-booking/${sub.bookingId}`
                                  )
                                }
                              >
                                View
                              </button>
                            </div>
                            <Row>
                              <Col md={6}>
                                <InfoRow label="Reference No." value={sub.referenceNumber} />
                                <InfoRow label="Hotel" value={sub.hotelName} />
                                <InfoRow
                                  label="Check-In"
                                  value={formatDateTime(sub.checkInDate)}
                                />
                                <InfoRow
                                  label="Check-Out"
                                  value={formatDateTime(sub.checkOutDate)}
                                />
                              </Col>
                              <Col md={6}>
                                <InfoRow
                                  label="Rooms / Guests"
                                  value={`${subRooms} Room${
                                    subRooms !== 1 ? "s" : ""
                                  }, ${subAdults} Adult${
                                    subAdults !== 1 ? "s" : ""
                                  }${
                                    subChildren > 0
                                      ? `, ${subChildren} Child${
                                          subChildren !== 1 ? "ren" : ""
                                        }`
                                      : ""
                                  }`}
                                />
                                <InfoRow
                                  label="Total Rate"
                                  value={
                                    sub.totalRate != null
                                      ? Number(sub.totalRate).toFixed(2)
                                      : "-"
                                  }
                                />
                                <InfoRow
                                  label="Status"
                                  value={
                                    <StatusBadge status={sub.confirmationStatus} />
                                  }
                                />
                                <InfoRow
                                  label="Booking Date"
                                  value={formatDateTime(sub.bookingDate)}
                                />
                              </Col>
                            </Row>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── Cancellation Policy ───────────────────────────── */}
                <div style={card}>
                  <div style={SECTION_HEADER}>
                    Cancellation Policy{" "}
                    <span style={{ fontSize: "1rem", color: "#555" }}>⊟</span>
                  </div>
                  <div style={{ padding: "10px 16px", fontSize: "0.83rem", color: "#333" }}>
                    {booking.cancellationPolicies && booking.cancellationPolicies.length > 0 ? (
                      booking.cancellationPolicies.map((p, i) => (
                        <p key={i} style={{ marginBottom: "4px" }}>
                          {p}
                        </p>
                      ))
                    ) : (
                      <span className="text-muted">No cancellation policy available.</span>
                    )}
                  </div>
                </div>

                {/* ── Remarks ───────────────────────────────────────── */}
                <div style={card}>
                  <div style={SECTION_HEADER}>
                    Remarks{" "}
                    <span style={{ fontSize: "1rem", color: "#555" }}>⊟</span>
                  </div>
                  <div style={{ padding: "10px 16px", fontSize: "0.83rem", color: "#333" }}>
                    {booking.remarks ? (
                      <p style={{ marginBottom: 0 }}>{booking.remarks}</p>
                    ) : (
                      <span className="text-muted">No remarks.</span>
                    )}
                  </div>
                </div>

                {/* ── Special Requests ──────────────────────────────── */}
                <div style={card}>
                  <div style={SECTION_HEADER}>
                    Special Request{" "}
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "18px",
                        height: "18px",
                        borderRadius: "50%",
                        border: "1.5px solid #555",
                        fontSize: "0.75rem",
                        fontWeight: "700",
                        color: "#555",
                      }}
                    >
                      +
                    </span>
                  </div>
                  <div style={{ padding: "10px 16px", fontSize: "0.83rem", color: "#333" }}>
                    {booking.specialRequests && booking.specialRequests.length > 0 ? (
                      <ul style={{ marginBottom: 0, paddingLeft: "18px" }}>
                        {booking.specialRequests.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-muted">No special requests.</span>
                    )}
                  </div>
                </div>

                {/* ── Action Buttons ────────────────────────────────── */}
                <div style={{ marginBottom: "10px", display: "flex", gap: "8px" }}>
                  <button
                    style={BUTTON_STYLE}
                    onClick={() => {
                      const parent = booking.parentBookingCode || booking.bookingCode;
                      navigate(
                        `/new-booking/hotel?parentBookingCode=${encodeURIComponent(parent)}`
                      );
                    }}
                  >
                    ADD NEW ITEM
                  </button>
                  <button
                    style={BUTTON_STYLE}
                    onClick={() => navigate(`/booking-details/hotel-booking/${id}/notes`)}
                  >
                    NOTES
                  </button>
                </div>

                {/* ── Booking Date footer ───────────────────────────── */}
                <div
                  style={{
                    textAlign: "right",
                    fontSize: "0.8rem",
                    color: "#555",
                    paddingBottom: "8px",
                  }}
                >
                  Booking Date : {formatDateTime(booking.bookingDate)}
                </div>
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
    <div style={{ marginBottom: "6px", display: "flex", alignItems: "flex-start" }}>
      <span style={INFO_LABEL}>{label}</span>
      <span style={{ ...INFO_VALUE, marginLeft: "8px" }}>
        {value ?? "-"}
      </span>
    </div>
  );
}
