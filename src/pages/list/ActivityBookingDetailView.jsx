/**
 * ActivityBookingDetailView.jsx
 *
 * Detail view for /booking-details/activity-booking/:id.
 *
 * Data source: fetches the full nested booking shape from the new
 *   GET /api/tour-activity-booking/{id}
 * endpoint (the one TourAndActivityBookingController serves). When
 * that returns 404 (e.g. the URL points at a legacy
 * make-your-own-package booking), we fall back to the snapshot the
 * list page may have passed via location.state.booking so the old
 * rows continue to render.
 *
 * Voucher: a printer/file icon next to the page title hits
 *   GET /api/tour-activity-booking/{id}/voucher
 * which generates a PDF on the server and returns its public URL;
 * we then open a modal with that URL embedded in an iframe.
 */

import React, { useEffect, useState } from "react";
import {
  Container,
  Card,
  Table,
  Badge,
  Spinner,
  Modal,
  Button,
  Alert,
} from "react-bootstrap";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import {
  FaTicketAlt,
  FaTrash,
  FaCalendarAlt,
  FaUserAlt,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaEnvelope,
  FaIdCard,
  FaFilePdf,
  FaCreditCard,
  FaCheckCircle,
} from "react-icons/fa";
import { toast } from "react-hot-toast";
import axiosInstance from "../../components/AxiosInstance";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";

const BUTTON_STYLE = {
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

const formatPrice = (price) =>
  new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
  }).format(price || 0);

const formatDate = (date) => {
  if (!date) return "-";
  try {
    return new Date(date).toLocaleDateString();
  } catch {
    return date;
  }
};

const formatDateTime = (date) => {
  if (!date) return "-";
  try {
    return new Date(date).toLocaleString();
  } catch {
    return date;
  }
};

const PAYMENT_LABELS = {
  CREDIT: "Credit Limit",
  ONLINE: "Online Payment",
  CASH: "Cash",
};

export default function ActivityBookingDetailView() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();

  // Status flag still drives the Cancel button visibility — carried
  // over from the list page like before.
  const status = location.state?.status || "upcoming";

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // ── Voucher modal state ─────────────────────────────────────────
  // We don't pre-fetch the voucher URL — it's only computed when
  // the user clicks the icon, since PDF generation is cheap but not
  // free. The modal stays open with the iframe until the user
  // dismisses it; subsequent clicks regenerate (server overwrites
  // the same file path).
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [voucherUrl, setVoucherUrl] = useState(null);
  const [voucherLoading, setVoucherLoading] = useState(false);

  // Fetch the booking from the new endpoint. Fall back to the
  // location.state snapshot if the GET fails — keeps legacy rows
  // (which live in CustomBookPackageActivity, not the new tables)
  // viewable until the list page migrates over.
  useEffect(() => {
    if (!id) {
      setLoadError("Missing booking id in URL");
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    axiosInstance
      .get(`/api/tour-activity-booking/${id}`)
      .then((res) => {
        if (cancelled) return;
        setBooking(res.data || null);
      })
      .catch((err) => {
        if (cancelled) return;
        // Fallback for legacy rows that aren't in the new tables.
        const fallback = location.state?.booking;
        if (fallback) {
          setBooking({ __legacy: true, ...fallback });
        } else {
          setLoadError(
            err.response?.data?.message ||
              "Booking not found in the new tour-and-activity tables.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, location.state]);

  const handleCancelBooking = async () => {
    if (!booking) return;
    try {
      setCancelling(true);
      const response = await axiosInstance.delete(
        `/api/activity/delete/${booking.bookingId || booking.customBookingId}`,
      );
      if (response.data?.status === "success") {
        toast.success("Booking cancelled");
        setShowCancelModal(false);
        navigate(-1);
      } else {
        toast.error("Cancel failed");
      }
    } catch {
      toast.error("Error cancelling booking");
    } finally {
      setCancelling(false);
    }
  };

  const handleOpenVoucher = async () => {
    if (!id) return;
    setVoucherLoading(true);
    setVoucherUrl(null);
    setShowVoucherModal(true);
    try {
      const res = await axiosInstance.get(
        `/api/tour-activity-booking/${id}/voucher`,
      );
      if (res.data?.url) {
        setVoucherUrl(res.data.url);
      } else {
        toast.error("Voucher URL missing in response");
      }
    } catch (err) {
      toast.error(
        err.response?.data?.error || "Failed to generate voucher PDF",
      );
    } finally {
      setVoucherLoading(false);
    }
  };

  // Loading / error short-circuits
  if (loading) {
    return (
      <PageShell>
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <p className="mt-3 text-muted">Loading booking…</p>
        </div>
      </PageShell>
    );
  }
  if (loadError || !booking) {
    return (
      <PageShell>
        <Alert variant="warning" className="text-center">
          {loadError || "Booking not found."}
          <div className="mt-3">
            <button
              style={{ ...BUTTON_STYLE, backgroundColor: "#555" }}
              onClick={() => navigate("/booking-details/activity-booking-list")}
            >
              ← Back to list
            </button>
          </div>
        </Alert>
      </PageShell>
    );
  }

  // ── Normalise field access so the page renders for both the new
  // shape AND legacy snapshot rows without branching everywhere. ──
  const isLegacy = booking.__legacy === true;
  const code = booking.bookingCode || booking.packageBookCode || "—";
  const createdAt = booking.createdAt || booking.bookingDate || null;
  const customer = booking.customer || {
    salutation: booking.salutation,
    firstName: booking.firstName,
    lastName: booking.lastName,
    contactNumber: booking.contactNumber,
    emailId: booking.emailId,
    passportNumber: booking.passportNumber,
    lpo: booking.agentLpo,
  };
  const guests = Array.isArray(booking.guests) ? booking.guests : [];
  const childAges = Array.isArray(booking.childAges)
    ? booking.childAges
    : Array.isArray(booking.childAgeArray)
    ? booking.childAgeArray
    : [];

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4" style={{ overflow: "auto" }}>
          <Container fluid style={{ maxWidth: "1100px" }}>
            {/* Header — Back, title, voucher icon */}
            <div className="mb-3 d-flex align-items-center flex-wrap gap-2">
              <button
                style={{ ...BUTTON_STYLE, backgroundColor: "#555" }}
                onClick={() => navigate(-1)}
              >
                ← Back
              </button>
              <span
                className="d-flex align-items-center"
                style={{
                  marginLeft: "12px",
                  fontWeight: "700",
                  fontSize: "1.1rem",
                  color: "#333",
                }}
              >
                <FaTicketAlt className="me-2 text-primary" />
                Booking Details
                <Badge bg="primary-subtle" text="primary" className="ms-3">
                  {code}
                </Badge>
              </span>

           
            </div>

            {/* Top meta strip */}
            <Card className="mb-3">
              <Card.Body className="py-2">
                <Table size="sm" borderless className="mb-0">
                  <tbody>
                    <tr>
                      <td className="text-muted small" style={{ width: 110 }}>
                        Code
                      </td>
                      <td className="fw-semibold">{code}</td>
                      <td className="text-muted small" style={{ width: 90 }}>
                        Booked
                      </td>
                      <td className="fw-semibold">{formatDateTime(createdAt)}</td>
                      <td className="text-muted small" style={{ width: 70 }}>
                        Status
                      </td>
                      <td>
                        <Badge
                          bg={
                            booking.status === "CANCELLED" || booking.cancelStatus
                              ? "danger-subtle"
                              : "success-subtle"
                          }
                          text={
                            booking.status === "CANCELLED" || booking.cancelStatus
                              ? "danger"
                              : "success"
                          }
                        >
                          {booking.status ||
                            (booking.cancelStatus ? "Cancelled" : "Confirmed")}
                        </Badge>
                      </td>
                    </tr>
                    <tr>
                      <td className="text-muted small">Agent</td>
                      <td className="fw-semibold">
                        {/* Prefer the resolved agentName from the
                            enriched endpoint; fall back to the raw
                            agentId for legacy snapshot rows that
                            don't carry a name. */}
                        {booking.agentName ||
                          (booking.agentId ? `ID: ${booking.agentId}` : "—")}
                      </td>
                      <td className="text-muted small">User ID</td>
                      <td className="fw-semibold">{booking.userId || "—"}</td>
                      <td className="text-muted small">
                        <FaCreditCard className="me-1" />
                        Pay Mode
                      </td>
                      <td className="fw-semibold">
                        {PAYMENT_LABELS[booking.paymentMode] ||
                          booking.paymentMode ||
                          "—"}
                      </td>
                    </tr>
                  </tbody>
                </Table>
              </Card.Body>
            </Card>

            {/* Activity */}
            <Card className="mb-3">
              <Card.Header
                className="fw-semibold d-flex align-items-center"
                style={{ backgroundColor: "#f1f3f5" }}
              >
                <FaTicketAlt className="me-2 text-primary" />
                Activity
              </Card.Header>
              <Card.Body>
                <Table size="sm" borderless className="mb-0">
                  <tbody>
                    <tr>
                      <td className="text-muted small" style={{ width: 110 }}>
                        Activity ID
                      </td>
                      <td className="fw-semibold">
                        {booking.activityId || booking.activityName || "—"}
                      </td>
                    </tr>
                    <tr>
                      <td className="text-muted small">
                        <FaCalendarAlt className="me-1" />
                        Tour Date
                      </td>
                      <td className="fw-semibold">
                        {formatDate(booking.tourDate)}
                      </td>
                    </tr>
                    {booking.reportingPoint && (
                      <tr>
                        <td className="text-muted small">Reporting</td>
                        <td className="fw-semibold">{booking.reportingPoint}</td>
                      </tr>
                    )}
                    {(booking.cityName || booking.destination) && (
                      <tr>
                        <td className="text-muted small">
                          <FaMapMarkerAlt className="me-1" />
                          City
                        </td>
                        <td className="fw-semibold">
                          {booking.cityName || booking.destination}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>

            {/* Pax counts */}
            <Card className="mb-3">
              <Card.Header
                className="fw-semibold d-flex align-items-center"
                style={{ backgroundColor: "#f1f3f5" }}
              >
                <FaUserAlt className="me-2 text-primary" />
                Pax Counts
              </Card.Header>
              <Card.Body>
                <Table size="sm" borderless className="mb-0">
                  <tbody>
                    <tr>
                      <td className="text-muted small" style={{ width: 110 }}>
                        Adults
                      </td>
                      <td className="fw-semibold">{booking.noOfAdult ?? 0}</td>
                      <td className="text-muted small" style={{ width: 90 }}>
                        Children
                      </td>
                      <td className="fw-semibold">{booking.noOfChild ?? 0}</td>
                      {childAges.length > 0 && (
                        <>
                          <td className="text-muted small">Child ages</td>
                          <td className="fw-semibold">{childAges.join(", ")}</td>
                        </>
                      )}
                    </tr>
                  </tbody>
                </Table>
              </Card.Body>
            </Card>

            {/* Guests table — only when we have per-guest rows
                (new bookings always do; legacy snapshots may not). */}
            {guests.length > 0 && (
              <Card className="mb-3">
                <Card.Header
                  className="fw-semibold d-flex align-items-center"
                  style={{ backgroundColor: "#f1f3f5" }}
                >
                  <FaUserAlt className="me-2 text-primary" />
                  Passengers
                </Card.Header>
                <Card.Body className="p-0">
                  <Table size="sm" hover className="mb-0 align-middle">
                    <thead style={{ backgroundColor: "#f8f9fa" }}>
                      <tr>
                        <th style={{ width: 50 }} className="text-center">#</th>
                        <th>Title</th>
                        <th>Name</th>
                        <th>Gender</th>
                        <th>Type</th>
                        <th>Passport</th>
                        <th className="text-center">Lead</th>
                      </tr>
                    </thead>
                    <tbody>
                      {guests.map((g, idx) => (
                        <tr key={g.id ?? idx}>
                          <td className="text-center">
                            {g.guestIndex ?? idx + 1}
                          </td>
                          <td>{g.salutation || "—"}</td>
                          <td>
                            {[g.firstName, g.middleName, g.lastName]
                              .filter(Boolean)
                              .join(" ") || "—"}
                          </td>
                          <td>{g.gender || "—"}</td>
                          <td>
                            {g.isChild
                              ? `Child${g.age != null ? ` (${g.age})` : ""}`
                              : "Adult"}
                          </td>
                          <td>{g.passportNo || "—"}</td>
                          <td className="text-center">
                            {g.isLead ? (
                              <FaCheckCircle className="text-success" />
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            )}

            {/* Customer contact (snapshot) */}
            {/* <Card className="mb-3">
              <Card.Header
                className="fw-semibold"
                style={{ backgroundColor: "#f1f3f5" }}
              >
                Customer
              </Card.Header>
              <Card.Body>
                <Table size="sm" borderless className="mb-0">
                  <tbody>
                    <tr>
                      <td className="text-muted small" style={{ width: 80 }}>
                        Name
                      </td>
                      <td className="fw-semibold">
                        {[customer.salutation, customer.firstName, customer.lastName]
                          .filter(Boolean)
                          .join(" ") || "—"}
                      </td>
                      <td className="text-muted small" style={{ width: 70 }}>
                        <FaPhoneAlt className="me-1" />
                        Phone
                      </td>
                      <td className="fw-semibold">
                        {customer.contactNumber || "—"}
                      </td>
                    </tr>
                    <tr>
                      <td className="text-muted small">
                        <FaEnvelope className="me-1" />
                        Email
                      </td>
                      <td className="fw-semibold">{customer.emailId || "—"}</td>
                      <td className="text-muted small">
                        <FaIdCard className="me-1" />
                        Passport
                      </td>
                      <td className="fw-semibold">
                        {customer.passportNumber || "—"}
                      </td>
                    </tr>
                    {customer.lpo && (
                      <tr>
                        <td className="text-muted small">LPO</td>
                        <td className="fw-semibold" colSpan={3}>
                          {customer.lpo}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </Card.Body>
            </Card> */}

            {/* Itineraries — backend now overlays each row with the
                master heading via MasterItenaryDetails, so we render
                the heading prominently and keep the id as a small
                muted tag. Falls back to itineraryIds[] when the
                enriched array isn't present (legacy snapshot rows). */}
            {(() => {
              const list =
                Array.isArray(booking.itineraries) &&
                booking.itineraries.length > 0
                  ? booking.itineraries
                  : Array.isArray(booking.itineraryIds)
                  ? booking.itineraryIds.map((iid) => ({
                      itineraryId: iid,
                      heading: null,
                    }))
                  : [];
              if (list.length === 0) return null;
              return (
                <Card className="mb-3">
                  <Card.Header
                    className="fw-semibold"
                    style={{ backgroundColor: "#f1f3f5" }}
                  >
                    Selected Itineraries
                    <span className="text-muted small ms-2 fw-normal">
                      ({list.length})
                    </span>
                  </Card.Header>
                  <Card.Body>
                    <ol
                      className="ps-3 mb-0 small text-secondary"
                      style={{ lineHeight: 1.6 }}
                    >
                      {list.map((it, idx) => (
                        <li key={idx} className="mb-1">
                          <span className="text-dark">
                            {it.heading ||
                              (it.itineraryId
                                ? `Itinerary ${it.itineraryId}`
                                : "Itinerary")}
                          </span>
                          {/* {it.itineraryId != null && (
                            <span
                              className="text-muted ms-2"
                              style={{ fontSize: "0.7rem" }}
                            >
                              · ID {it.itineraryId}
                            </span>
                          )} */}
                          {it.days && it.days > 1 && (
                            <Badge
                              bg="light"
                              text="dark"
                              className="ms-2"
                              style={{ fontSize: "0.65rem" }}
                            >
                              {it.days} days
                            </Badge>
                          )}
                        </li>
                      ))}
                    </ol>
                  </Card.Body>
                </Card>
              );
            })()}

            {/* Policies — three buckets, each only shown when non-empty. */}
            <PolicyCard
              title="Inclusions"
              items={booking.inclusions}
              accepted={booking.acceptedInclusions}
            />
            <PolicyCard
              title="Terms & Conditions"
              items={booking.termsAndConditions}
              accepted={booking.acceptedTermsAndConditions}
            />
            <PolicyCard
              title="Cancellation Policy"
              items={booking.cancellationPolicies}
              accepted={booking.acceptedCancellationPolicies}
            />

            {/* Pricing */}
            <Card className="mb-3">
              <Card.Header
                className="fw-semibold"
                style={{ backgroundColor: "#f1f3f5" }}
              >
                Pricing
              </Card.Header>
              <Card.Body>
                <div className="p-2 px-3 bg-light rounded">
                  {booking.sellingPrice != null && (
                    <div className="d-flex justify-content-between text-muted small">
                      <span>Selling Price</span>
                      <span className="fw-medium">
                        {formatPrice(booking.sellingPrice)}
                      </span>
                    </div>
                  )}
                  <div className="d-flex justify-content-between align-items-center border-top pt-1 mt-1">
                    <span className="fw-semibold">Total Amount</span>
                    <span className="fs-6 fw-bold text-success">
                      {formatPrice(booking.totalPrice)}
                    </span>
                  </div>
                </div>
              </Card.Body>
            </Card>

            {/* Bottom action buttons */}
            <div
              className="d-flex gap-2 justify-content-start flex-wrap"
              style={{ marginTop: "16px", marginBottom: "20px" }}
            >
              {status === "upcoming" &&
                booking.status !== "CANCELLED" &&
                !booking.cancelStatus && (
                  <button
                    style={{ ...BUTTON_STYLE, backgroundColor: "#dc3545" }}
                    onClick={() => setShowCancelModal(true)}
                    title="Cancel booking"
                  >
                    <FaTrash style={{ marginRight: "6px" }} />
                    Cancel
                  </button>
                )}

         
              {!isLegacy && (
                <button
                  style={{
                    ...BUTTON_STYLE,
                    backgroundColor: "#dc2626",
                  }}
                  onClick={handleOpenVoucher}
                  title="Preview voucher PDF"
                >
                  <FaFilePdf style={{ marginRight: 6 }} />
                  Voucher
                </button>
              )}
            </div>
         </Container>
        </main>
      </div>

      {/* Cancel confirmation */}
      <Modal
        show={showCancelModal}
        onHide={() => !cancelling && setShowCancelModal(false)}
        centered
      >
        <Modal.Header closeButton={!cancelling}>
          <Modal.Title>Cancel Activity Booking</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center py-4">
          <p className="mb-1 text-muted">
            Are you sure you want to cancel this booking?
          </p>
          <h5 className="mb-0">{code}</h5>
        </Modal.Body>
        <Modal.Footer className="justify-content-center border-0 pb-4">
          <Button
            variant="light"
            className="px-4"
            onClick={() => setShowCancelModal(false)}
            disabled={cancelling}
          >
            No, Keep
          </Button>
          <Button
            variant="dark"
            className="px-4"
            onClick={handleCancelBooking}
            disabled={cancelling}
          >
            {cancelling ? <Spinner size="sm" className="me-2" /> : "Yes, Cancel"}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Voucher modal — iframe-embedded PDF preview. The iframe
          src is set from the server's public URL response, so the
          preview reflects the same file a Download would yield. */}
      <Modal
        show={showVoucherModal}
        onHide={() => setShowVoucherModal(false)}
        size="xl"
        centered
        backdrop="static"
        scrollable
      >
        <Modal.Header closeButton>
          <Modal.Title className="d-flex align-items-center">
            <FaFilePdf className="me-2 text-danger" />
            Voucher Preview
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: 0, height: "75vh" }}>
          {voucherLoading ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="primary" />
              <p className="mt-3 text-muted">Generating voucher…</p>
            </div>
          ) : voucherUrl ? (
            <iframe
              title="Voucher PDF"
              src={voucherUrl}
              style={{ width: "100%", height: "100%", border: 0 }}
            />
          ) : (
            <div className="text-center py-5 text-muted">
              Voucher URL unavailable.
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          {voucherUrl && (
            <a
              className="btn btn-outline-primary"
              href={voucherUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open in new tab
            </a>
          )}
          <Button
            variant="secondary"
            onClick={() => setShowVoucherModal(false)}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

// Reusable section card for inclusions / T&C / cancellation. Kept
// inline because it isn't used anywhere else.
function PolicyCard({ title, items, accepted }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <Card className="mb-3">
      <Card.Header
        className="fw-semibold d-flex justify-content-between align-items-center"
        style={{ backgroundColor: "#f1f3f5" }}
      >
        <span>{title}</span>
        {accepted === true && (
          <Badge bg="success-subtle" text="success">
            <FaCheckCircle className="me-1" />
            Accepted
          </Badge>
        )}
      </Card.Header>
      <Card.Body>
        <ul className="ps-3 mb-0 small text-secondary">
          {items.map((line, idx) => (
            <li key={idx} className="mb-1">
              {line}
            </li>
          ))}
        </ul>
      </Card.Body>
    </Card>
  );
}

// Page chrome (TopBar + Sidebar) shared by the loading / error
// states so they line up with the loaded view.
function PageShell({ children }) {
  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Container fluid style={{ maxWidth: "1100px" }}>
            {children}
          </Container>
        </main>
      </div>
    </div>
  );
}
