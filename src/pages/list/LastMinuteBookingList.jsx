import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Card,
  Table,
  Spinner,
  Form,
  InputGroup,
} from "react-bootstrap";

const STATUS_META = {
  CONFIRMED: { label: "Confirmed", bg: "#e7f6ec", color: "#1b7f3a", dot: "#22c55e" },
  Confirmed: { label: "Confirmed", bg: "#e7f6ec", color: "#1b7f3a", dot: "#22c55e" },
  PENDING:   { label: "Pending",   bg: "#fff7e6", color: "#b76e00", dot: "#f59e0b" },
  CANCELLED: { label: "Cancelled", bg: "#fdecec", color: "#b42318", dot: "#ef4444" },
  Cancelled: { label: "Cancelled", bg: "#fdecec", color: "#b42318", dot: "#ef4444" },
};

const StatusPill = ({ meta, raw }) => {
  if (!meta) return <span className="text-muted">{raw || "-"}</span>;
  return (
    <span
      className="d-inline-flex align-items-center gap-1 px-2 py-1 rounded-pill"
      style={{
        backgroundColor: meta.bg,
        color: meta.color,
        fontSize: "0.7rem",
        fontWeight: 600,
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      {meta.dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            backgroundColor: meta.dot,
            display: "inline-block",
          }}
        />
      )}
      {meta.label}
    </span>
  );
};
import {
  FaEye,
  FaSearch,
  FaInbox,
} from "react-icons/fa";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import toast from "react-hot-toast";
import { formatDateTime } from "../../utils/dateUtils";

/**
 * LastMinuteBookingList — mirrors HotelBookingList.jsx structure for the
 * Last Minute flow. Talks to /api/last-minute-booking/list, /api/last-minute-
 * booking/{id} (view), and /api/last-minute-booking/{id}/cancel.
 *
 * Columns: S.N · Customer · Booking Code · Hotel · Supplier · Supplier Ref ·
 * Check-in · Check-out · Total · Payment Method · Status · Actions.
 * Action column is the eye icon only; it navigates to
 * /booking-details/last-minute-booking/:id where Voucher (PDF in new
 * tab), Invoice (/invoice?bookingId=... in new tab), and Cancel
 * (SweetAlert confirm + PATCH .../cancel) live as buttons at the
 * bottom-left of the detail view.
 *
 * Supplier / Supplier Ref / Payment Method may be left blank by the backend
 * and rendered as "-" — they are populated by ops at a later stage.
 */
export default function LastMinuteBookingList() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get("/api/last-minute-booking/list");
      setBookings(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load last-minute bookings");
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  // Client-side filter by search term (booking code / customer / hotel name).
  const filtered = bookings.filter((b) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      (b.bookingCode || "").toLowerCase().includes(q) ||
      (b.customerName || "").toLowerCase().includes(q) ||
      (b.hotelName || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main
          className="flex-grow-1 p-3"
          style={{ width: "100%", overflow: "hidden" }}
        >
          <Container
            fluid
            style={{
              maxWidth: "100%",
              paddingLeft: "0.5rem",
              paddingRight: "0.5rem",
            }}
          >
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h5 className="mb-0 text-dark fw-semibold">Last Minute Bookings</h5>
            </div>

            <Card
              className="border mb-3 shadow-sm"
              style={{ borderRadius: "6px" }}
            >
              <Card.Header
                className="d-flex justify-content-between align-items-center text-dark border-bottom py-2"
                style={{
                  borderRadius: "6px 6px 0 0",
                  backgroundColor: "#f8f9fa",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                }}
              >
                <span>List of Bookings</span>
              </Card.Header>
              <Card.Body style={{ padding: "1.5rem 1rem 1rem" }}>
                <div
                  className="d-flex flex-wrap justify-content-end align-items-center gap-2"
                  style={{ marginBottom: "1.5rem" }}
                >
                  <InputGroup size="sm" style={{ width: "300px" }}>
                    <InputGroup.Text
                      style={{
                        fontSize: "0.75rem",
                        backgroundColor: "#ffffff",
                        borderRight: "none",
                        color: "#98a2b3",
                      }}
                    >
                      <FaSearch />
                    </InputGroup.Text>
                    <Form.Control
                      type="text"
                      placeholder="Search by code / customer / hotel"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      style={{ fontSize: "0.8rem", borderLeft: "none" }}
                    />
                  </InputGroup>
                </div>

                {loading ? (
                  <div className="text-center py-5">
                    <Spinner animation="border" variant="primary" />
                    <p className="mt-3 text-muted">Loading bookings...</p>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-5 text-muted">
                    <FaInbox className="display-4 mb-3" style={{ opacity: 0.4 }} />
                    <h6 className="fw-semibold">No last-minute bookings yet</h6>
                    <p className="mb-0 small">
                      They'll appear here once you create one via{" "}
                      <em>New Booking → Last Minute Booking</em>.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="table-responsive saas-table-wrap">
                      <Table hover className="mb-0 align-middle saas-table">
                        <thead>
                          <tr>
                            <th style={{ width: "48px" }}>#</th>
                            <th>Customer</th>
                            <th>Booking</th>
                            <th>Hotel</th>
                            <th>Supplier</th>
                            <th>Supplier Ref</th>
                            <th>Stay</th>
                            <th className="text-end">Total</th>
                            <th>Payment</th>
                            <th>Status</th>
                            <th className="text-center" style={{ width: "70px" }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((b, idx) => {
                            const statusText = b.isCancelled
                              ? "Cancelled"
                              : b.confirmationStatus || "Confirmed";
                            const sMeta = STATUS_META[statusText];
                            return (
                              <tr key={b.bookingId}>
                                <td className="text-muted">{idx + 1}</td>
                                <td>
                                  <span className="fw-medium text-dark">
                                    {b.customerName || "-"}
                                  </span>
                                </td>
                                <td>
                                  <span
                                    className="fw-semibold"
                                    style={{ color: "#1d4ed8" }}
                                  >
                                    {b.bookingCode || "-"}
                                  </span>
                                </td>
                                <td>{b.hotelName || "-"}</td>
                                <td>
                                  {b.supplierName && b.supplierName !== "Inhouse"
                                    ? b.supplierName
                                    : "-"}
                                </td>
                                <td>
                                  {b.supplierReference && b.supplierReference !== "0"
                                    ? b.supplierReference
                                    : "-"}
                                </td>
                                <td style={{ whiteSpace: "nowrap" }}>
                                  <div>{formatDateTime(b.checkInDate)}</div>
                                  <div className="text-muted" style={{ fontSize: "0.7rem" }}>
                                    → {formatDateTime(b.checkOutDate)}
                                  </div>
                                </td>
                                <td className="text-end" style={{ whiteSpace: "nowrap" }}>
                                  <span className="fw-semibold text-dark">
                                    {b.totalRate != null
                                      ? `AED ${Number(b.totalRate).toFixed(2)}`
                                      : "-"}
                                  </span>
                                </td>
                                <td>{b.paymentMethod || "-"}</td>
                                <td>
                                  <StatusPill meta={sMeta} raw={statusText} />
                                </td>
                                <td className="text-center">
                                  <button
                                    type="button"
                                    className="btn btn-sm border-0 p-1"
                                    style={{
                                      backgroundColor: "#eff6ff",
                                      color: "#1d4ed8",
                                      borderRadius: "6px",
                                    }}
                                    onClick={() =>
                                      navigate(
                                        `/booking-details/last-minute-booking/${b.bookingId}`,
                                        { state: { booking: b } },
                                      )
                                    }
                                    title="View details"
                                  >
                                    <FaEye style={{ fontSize: "12px" }} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </Table>
                    </div>

                    <style>{`
                      .saas-table-wrap { border: 1px solid #eaecf0; border-radius: 8px; overflow-x: auto; }
                      .saas-table { font-size: 0.8rem; margin-bottom: 0; }
                      .saas-table thead th {
                        background-color: #f9fafb;
                        color: #667085;
                        font-size: 0.68rem;
                        font-weight: 600;
                        text-transform: uppercase;
                        letter-spacing: 0.04em;
                        border-bottom: 1px solid #eaecf0;
                        border-top: none;
                        padding: 0.65rem 0.75rem;
                        white-space: nowrap;
                      }
                      .saas-table tbody td {
                        padding: 0.65rem 0.75rem;
                        border-top: 1px solid #f2f4f7;
                        vertical-align: middle;
                        color: #344054;
                      }
                      .saas-table tbody tr:first-child td { border-top: none; }
                      .saas-table tbody tr:hover { background-color: #fafbfc; }
                    `}</style>
                  </>
                )}
              </Card.Body>
            </Card>
          </Container>
        </main>
      </div>

    </div>
  );
}
