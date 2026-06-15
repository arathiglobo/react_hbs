import React, { useCallback, useEffect, useMemo, useState } from "react";
import axiosInstance from "../../components/AxiosInstance";
import {
  Card,
  Row,
  Col,
  Table,
  Badge,
  Button,
  Spinner,
  Form,
  Modal,
  InputGroup,
} from "react-bootstrap";
import { toast } from "react-hot-toast";
import {
  FaCheckCircle,
  FaTimesCircle,
  FaUserCheck,
  FaUserSlash,
  FaFlagCheckered,
  FaCommentDots,
  FaSync,
  FaSearch,
  FaCalendarAlt,
  FaUsers,
  FaClock,
  FaCreditCard,
  FaCalendarPlus,
  FaShieldAlt,
} from "react-icons/fa";
import RestaurantExtranetLayout from "./RestaurantExtranetLayout";

/**
 * Reservation management page — extracted from the previous monolithic
 * extranet dashboard. The layout chrome (header + side nav + /me
 * resolution) lives in {@code RestaurantExtranetLayout}.
 *
 * Functionality preserved from the previous version:
 *   • 8 status tabs with live counts.
 *   • Free-text search across booking number / guest / agent.
 *   • Per-row action buttons gated by the state machine.
 *   • Remark / reject / no-show modal with reason input.
 *
 * Everything calls /api/restaurant-extranet/* with the standard
 * authToken auto-attached by axiosInstance.
 */
const STATUS_TABS = [
  { key: "all",      label: "All",              match: () => true },
  { key: "pending",  label: "Pending Approval", match: (b) => statusOf(b) === "Pending Approval" },
  { key: "guarantee",label: "Guarantee Pending",match: (b) => statusOf(b) === "Guarantee Pending" },
  { key: "confirmed",label: "Confirmed",        match: (b) => statusOf(b) === "Confirmed" },
  { key: "reconfirmed", label: "Reconfirmed",   match: (b) => statusOf(b) === "Reconfirmed" },
  { key: "datechange", label: "Date Change Requested", match: (b) => statusOf(b) === "Date Change Requested" },
  { key: "checked",  label: "Checked In",       match: (b) => statusOf(b) === "Checked In" },
  { key: "done",     label: "Completed",        match: (b) => statusOf(b) === "Completed" },
  { key: "noshow",   label: "No Show",          match: (b) => statusOf(b) === "No Show" },
  { key: "rejected", label: "Rejected",         match: (b) => statusOf(b) === "Rejected" },
  { key: "cancel",   label: "Cancelled",        match: (b) => statusOf(b) === "Cancelled" },
  { key: "autocancel", label: "Auto Cancelled", match: (b) => statusOf(b) === "Auto Cancelled" },
];

function statusOf(b) {
  return (b?.bookingStatus || "").trim();
}

function statusBadgeVariant(status) {
  switch ((status || "").toLowerCase()) {
    case "pending approval":       return "warning";
    case "guarantee pending":      return "warning";
    case "confirmed":              return "primary";
    case "reconfirmed":            return "info";
    case "date change requested":  return "warning";
    case "checked in":             return "info";
    case "completed":              return "success";
    case "no show":                return "dark";
    case "rejected":               return "danger";
    case "cancelled":              return "secondary";
    case "auto cancelled":         return "danger";
    default:                       return "secondary";
  }
}

function fmtDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return d;
  }
}

function fmtTime(t) {
  if (!t) return "—";
  if (typeof t === "string" && t.length >= 5) return t.substring(0, 5);
  return t;
}

const RestaurantExtranetReservations = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [actingId, setActingId] = useState(null);

  // Remark modal state
  const [remarkBooking, setRemarkBooking] = useState(null);
  const [remarkText, setRemarkText] = useState("");
  const [remarkAction, setRemarkAction] = useState("remark");
  const [remarkSubmitting, setRemarkSubmitting] = useState(false);

  // Guarantee details modal state
  const [guaranteeBooking, setGuaranteeBooking] = useState(null);
  const [guaranteeForm, setGuaranteeForm] = useState({
    cardHolder: "",
    cardNumber: "",
    expiry: "",
    cardType: "Visa",
  });
  const [guaranteeSubmitting, setGuaranteeSubmitting] = useState(false);

  // Date-change request modal state
  const [dateChangeBooking, setDateChangeBooking] = useState(null);
  const [dateChangeForm, setDateChangeForm] = useState({
    proposedDate: "",
    proposedTime: "",
    proposedDateAlt: "",
    proposedTimeAlt: "",
    reason: "",
  });
  const [dateChangeSubmitting, setDateChangeSubmitting] = useState(false);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/api/restaurant-extranet/bookings");
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        // Layout handles redirect; just surface to user.
        return;
      }
      console.error("extranet bookings fetch failed", err);
      toast.error("Failed to load bookings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const filtered = useMemo(() => {
    const t = STATUS_TABS.find((s) => s.key === tab) || STATUS_TABS[0];
    const q = (search || "").trim().toLowerCase();
    return rows.filter((b) => {
      if (!t.match(b)) return false;
      if (!q) return true;
      const blob = [
        b.bookingNumber,
        b.customerName,
        b.mobile,
        b.customerEmail,
        b.agentName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [rows, tab, search]);

  const tabCounts = useMemo(() => {
    const out = {};
    STATUS_TABS.forEach((t) => {
      out[t.key] = rows.filter((b) => t.match(b)).length;
    });
    return out;
  }, [rows]);

  const runAction = async (booking, action, remarkOrBody) => {
    setActingId(booking.id);
    try {
      // remarkOrBody may be: null/undefined, a string (legacy remark),
      // or an object (full request body for newer endpoints).
      let body = {};
      if (remarkOrBody && typeof remarkOrBody === "object") {
        body = remarkOrBody;
      } else if (remarkOrBody) {
        body = { remark: remarkOrBody };
      }
      const res = await axiosInstance.post(
        `/api/restaurant-extranet/bookings/${booking.id}/${action}`,
        body
      );
      const data = res?.data || {};
      if (data.status === "SUCCESS") {
        toast.success("Booking updated.");
        if (data.booking) {
          setRows((prev) =>
            prev.map((r) => (r.id === booking.id ? data.booking : r))
          );
        } else {
          // No booking returned — refresh to be safe.
          fetchBookings();
        }
        return true;
      } else {
        toast.error(data.message || "Action failed.");
        return false;
      }
    } catch (err) {
      const msg = err?.response?.data?.message || "Action failed.";
      toast.error(msg);
      return false;
    } finally {
      setActingId(null);
    }
  };

  const openRemark = (booking, action) => {
    setRemarkBooking(booking);
    setRemarkAction(action || "remark");
    setRemarkText("");
  };
  const closeRemark = () => {
    if (remarkSubmitting) return;
    setRemarkBooking(null);
    setRemarkText("");
  };
  const submitRemark = async () => {
    if (!remarkBooking) return;
    if (remarkAction === "remark" && !remarkText.trim()) {
      toast.error("Please enter a remark.");
      return;
    }
    setRemarkSubmitting(true);
    try {
      await runAction(remarkBooking, remarkAction, remarkText.trim() || null);
    } finally {
      setRemarkSubmitting(false);
      setRemarkBooking(null);
      setRemarkText("");
    }
  };

  // ---------- Confirm With Guarantee (require-guarantee) ----------
  const requireGuarantee = (b) => {
    runAction(b, "require-guarantee", {});
  };

  // ---------- Provide Guarantee Details ----------
  const openGuarantee = (booking) => {
    setGuaranteeBooking(booking);
    setGuaranteeForm({
      cardHolder: "",
      cardNumber: "",
      expiry: "",
      cardType: "Visa",
    });
  };
  const closeGuarantee = () => {
    if (guaranteeSubmitting) return;
    setGuaranteeBooking(null);
  };
  const submitGuarantee = async () => {
    if (!guaranteeBooking) return;
    const { cardHolder, cardNumber, expiry, cardType } = guaranteeForm;
    if (!cardHolder.trim() || !cardNumber.trim() || !expiry.trim() || !cardType) {
      toast.error("Please fill in all card details.");
      return;
    }
    // Light validation — backend will do the real checks
    if (!/^\d{2}\/\d{2}$/.test(expiry.trim())) {
      toast.error("Expiry must be in MM/YY format.");
      return;
    }
    setGuaranteeSubmitting(true);
    try {
      const ok = await runAction(guaranteeBooking, "provide-guarantee", {
        cardHolder: cardHolder.trim(),
        cardNumber: cardNumber.trim(),
        expiry: expiry.trim(),
        cardType,
      });
      if (ok) {
        setGuaranteeBooking(null);
      }
    } finally {
      setGuaranteeSubmitting(false);
    }
  };

  // ---------- Request Date / Time Change ----------
  const openDateChange = (booking) => {
    setDateChangeBooking(booking);
    setDateChangeForm({
      proposedDate: "",
      proposedTime: "",
      proposedDateAlt: "",
      proposedTimeAlt: "",
      reason: "",
    });
  };
  const closeDateChange = () => {
    if (dateChangeSubmitting) return;
    setDateChangeBooking(null);
  };
  const submitDateChange = async () => {
    if (!dateChangeBooking) return;
    const { proposedDate, proposedTime, proposedDateAlt, proposedTimeAlt, reason } =
      dateChangeForm;
    if (!proposedDate || !proposedTime) {
      toast.error("Please pick a proposed date and time.");
      return;
    }
    setDateChangeSubmitting(true);
    try {
      const body = {
        proposedDate,
        proposedTime,
      };
      if (proposedDateAlt) body.proposedDateAlt = proposedDateAlt;
      if (proposedTimeAlt) body.proposedTimeAlt = proposedTimeAlt;
      if (reason && reason.trim()) body.reason = reason.trim();
      const ok = await runAction(dateChangeBooking, "request-date-change", body);
      if (ok) {
        setDateChangeBooking(null);
      }
    } finally {
      setDateChangeSubmitting(false);
    }
  };

  const renderActions = (b) => {
    const s = statusOf(b);
    const isActing = actingId === b.id;
    const btns = [];
    if (s === "Pending Approval") {
      btns.push(
        <Button
          key="confirm"
          variant="success"
          size="sm"
          disabled={isActing}
          onClick={() => runAction(b, "confirm", null)}
        >
          <FaCheckCircle className="me-1" /> Confirm Without Guarantee
        </Button>
      );
      btns.push(
        <Button
          key="confirm-guarantee"
          variant="warning"
          size="sm"
          disabled={isActing}
          onClick={() => requireGuarantee(b)}
        >
          <FaShieldAlt className="me-1" /> Confirm With Guarantee
        </Button>
      );
      btns.push(
        <Button
          key="reject"
          variant="outline-danger"
          size="sm"
          disabled={isActing}
          onClick={() => openRemark(b, "reject")}
        >
          <FaTimesCircle className="me-1" /> Reject
        </Button>
      );
    }
    if (s === "Guarantee Pending") {
      if (b.agentReconfirmedAt) {
        btns.push(
          <Button
            key="provide-guarantee"
            variant="primary"
            size="sm"
            disabled={isActing}
            onClick={() => openGuarantee(b)}
          >
            <FaCreditCard className="me-1" /> Provide Guarantee Details
          </Button>
        );
      } else {
        btns.push(
          <Badge
            key="awaiting-reconfirm"
            bg="secondary"
            className="px-2 py-2"
            style={{ fontWeight: 500 }}
          >
            Awaiting agent reconfirmation
          </Badge>
        );
      }
    }
    if (s === "Confirmed") {
      btns.push(
        <Button
          key="checkin"
          variant="info"
          size="sm"
          disabled={isActing}
          onClick={() => runAction(b, "check-in", null)}
        >
          <FaUserCheck className="me-1" /> Check In
        </Button>
      );
      btns.push(
        <Button
          key="noshow"
          variant="outline-dark"
          size="sm"
          disabled={isActing}
          onClick={() => openRemark(b, "no-show")}
        >
          <FaUserSlash className="me-1" /> No Show
        </Button>
      );
    }
    if (s === "Checked In") {
      btns.push(
        <Button
          key="done"
          variant="success"
          size="sm"
          disabled={isActing}
          onClick={() => runAction(b, "complete", null)}
        >
          <FaFlagCheckered className="me-1" /> Complete
        </Button>
      );
    }
    if (s === "Pending Approval" || s === "Confirmed" || s === "Reconfirmed") {
      btns.push(
        <Button
          key="date-change"
          variant="outline-warning"
          size="sm"
          disabled={isActing}
          onClick={() => openDateChange(b)}
        >
          <FaCalendarPlus className="me-1" /> Request Date/Time Change
        </Button>
      );
    }
    btns.push(
      <Button
        key="remark"
        variant="outline-secondary"
        size="sm"
        disabled={isActing}
        onClick={() => openRemark(b, "remark")}
      >
        <FaCommentDots className="me-1" /> Remark
      </Button>
    );
    return (
      <div className="d-flex flex-wrap gap-1">
        {btns}
        {isActing && <Spinner animation="border" size="sm" className="ms-2" />}
      </div>
    );
  };

  return (
    <RestaurantExtranetLayout title="Reservations" subtitle="Confirm, reject and manage incoming bookings.">
      {/* Search + refresh */}
      <Card className="shadow-sm border-0 mb-3 rounded-3">
        <Card.Body className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <InputGroup style={{ width: 280 }}>
              <InputGroup.Text className="bg-white">
                <FaSearch className="text-muted" />
              </InputGroup.Text>
              <Form.Control
                placeholder="Search guest, agent, booking #…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </InputGroup>
            <Button
              variant="outline-primary"
              onClick={fetchBookings}
              disabled={loading}
              className="d-flex align-items-center gap-2"
            >
              <FaSync className={loading ? "fa-spin" : ""} />
              Refresh
            </Button>
          </div>
        </Card.Body>
      </Card>

      {/* Status filter — compact dropdown (replaced the multi-radio
          tab strip; lots of statuses + the rest of the page is already
          dense). Counts per status stay visible inside each option so
          the manager still gets the at-a-glance summary. */}
      <Card className="shadow-sm border-0 mb-3 rounded-3">
        <Card.Body className="d-flex align-items-center flex-wrap gap-2">
          <Form.Label
            className="fw-semibold mb-0 me-2"
            style={{ minWidth: 90 }}
            htmlFor="extranet-status-filter"
          >
            Status
          </Form.Label>
          <Form.Select
            id="extranet-status-filter"
            value={tab}
            onChange={(e) => setTab(e.target.value)}
            style={{ maxWidth: 320 }}
          >
            {STATUS_TABS.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label} ({tabCounts[t.key] || 0})
              </option>
            ))}
          </Form.Select>
        </Card.Body>
      </Card>

      {/* Table */}
      <Card className="shadow-sm border-0 rounded-3" style={{ overflow: "hidden" }}>
        <Card.Body className="p-0">
          <Table hover responsive size="sm" className="mb-0 align-middle" style={{ fontSize: "0.875rem" }}>
            <thead style={{ backgroundColor: "#f8f9fa" }}>
              <tr style={{ textTransform: "uppercase", fontSize: "0.72rem" }}>
                <th style={{ width: 50 }}>#</th>
                <th>Booking</th>
                <th>Guest</th>
                <th>Date / Time</th>
                <th style={{ width: 70 }}>Pax</th>
                <th>Agent</th>
                <th style={{ width: 130 }}>Status</th>
                <th style={{ minWidth: 280 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="text-center py-4">
                    <Spinner animation="border" size="sm" /> Loading reservations…
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-muted py-4">
                    No reservations in this tab.
                  </td>
                </tr>
              )}
              {!loading &&
                filtered.map((b, i) => (
                  <tr key={b.id}>
                    <td>{i + 1}</td>
                    <td className="fw-semibold text-primary">
                      {b.bookingNumber}
                      {b.specialRequest && (
                        <div
                          className="text-muted small mt-1"
                          style={{ whiteSpace: "normal", maxWidth: 220 }}
                          title={b.specialRequest}
                        >
                          <em>"{b.specialRequest}"</em>
                        </div>
                      )}
                      {b.restaurantRemark && (
                        <div
                          className="text-secondary small mt-1"
                          style={{
                            whiteSpace: "pre-wrap",
                            maxWidth: 280,
                            background: "#f8f9fa",
                            padding: "4px 6px",
                            borderRadius: 4,
                            borderLeft: "3px solid #6366f1",
                          }}
                        >
                          {b.restaurantRemark}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="fw-semibold">{b.customerName || "—"}</div>
                      {b.mobile && (
                        <small className="text-muted d-block">{b.mobile}</small>
                      )}
                      {b.customerEmail && (
                        <small className="text-muted d-block">{b.customerEmail}</small>
                      )}
                    </td>
                    <td>
                      <FaCalendarAlt className="me-1 text-muted" />
                      {fmtDate(b.bookingDate)}
                      {b.bookingTime && (
                        <div className="small text-muted">
                          <FaClock className="me-1" />
                          {fmtTime(b.bookingTime)}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="d-inline-flex align-items-center">
                        <FaUsers className="me-1 text-muted" />
                        {b.memberCount || 0}
                      </span>
                    </td>
                    <td>{b.agentName || "—"}</td>
                    <td>
                      <Badge bg={statusBadgeVariant(b.bookingStatus)}>
                        {b.bookingStatus || "—"}
                      </Badge>
                    </td>
                    <td>{renderActions(b)}</td>
                  </tr>
                ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
      <Card className="shadow-sm border-0 rounded-3 mt-3">
        <Card.Body className="d-flex justify-content-between align-items-center small text-muted">
          <span>
            Showing {filtered.length} of {rows.length} reservations
          </span>
        </Card.Body>
      </Card>

      {/* Remark / reject / no-show modal */}
      <Modal
        show={!!remarkBooking}
        onHide={closeRemark}
        centered
        backdrop="static"
        keyboard={!remarkSubmitting}
      >
        <Modal.Header closeButton={!remarkSubmitting}>
          <Modal.Title className="d-flex align-items-center">
            <FaCommentDots className="me-2 text-primary" />
            {remarkAction === "reject"
              ? "Reject Reservation"
              : remarkAction === "no-show"
              ? "Mark as No Show"
              : "Add Remark"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {remarkBooking && (
            <div className="small text-muted mb-2">
              <strong>{remarkBooking.bookingNumber}</strong> ·{" "}
              {remarkBooking.customerName || "Guest"} ·{" "}
              {fmtDate(remarkBooking.bookingDate)}{" "}
              {fmtTime(remarkBooking.bookingTime)}
            </div>
          )}
          <Form.Group>
            <Form.Label className="fw-semibold">
              {remarkAction === "reject"
                ? "Reason for rejection"
                : remarkAction === "no-show"
                ? "No-show note (optional)"
                : "Remark"}
              {remarkAction === "remark" && (
                <span className="text-danger ms-1">*</span>
              )}
            </Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={remarkText}
              onChange={(e) => setRemarkText(e.target.value)}
              placeholder={
                remarkAction === "reject"
                  ? "e.g. Fully booked at the requested time"
                  : remarkAction === "no-show"
                  ? "Optional details for the operations team"
                  : "Add any internal note for this reservation"
              }
              disabled={remarkSubmitting}
              autoFocus
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={closeRemark} disabled={remarkSubmitting}>
            Cancel
          </Button>
          <Button
            variant={
              remarkAction === "reject" ? "danger"
                : remarkAction === "no-show" ? "dark"
                : "primary"
            }
            onClick={submitRemark}
            disabled={remarkSubmitting}
          >
            {remarkSubmitting ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Saving…
              </>
            ) : remarkAction === "reject" ? "Reject Reservation"
              : remarkAction === "no-show" ? "Mark No Show"
              : "Save Remark"}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Provide Guarantee Details modal */}
      <Modal
        show={!!guaranteeBooking}
        onHide={closeGuarantee}
        centered
        backdrop="static"
        keyboard={!guaranteeSubmitting}
      >
        <Modal.Header closeButton={!guaranteeSubmitting}>
          <Modal.Title className="d-flex align-items-center">
            <FaCreditCard className="me-2 text-primary" />
            Provide Guarantee Details
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {guaranteeBooking && (
            <div className="small text-muted mb-3">
              <strong>{guaranteeBooking.bookingNumber}</strong> ·{" "}
              {guaranteeBooking.customerName || "Guest"} ·{" "}
              {fmtDate(guaranteeBooking.bookingDate)}{" "}
              {fmtTime(guaranteeBooking.bookingTime)}
            </div>
          )}
          <Form.Group className="mb-2">
            <Form.Label className="fw-semibold">
              Card Holder Name <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              type="text"
              value={guaranteeForm.cardHolder}
              onChange={(e) =>
                setGuaranteeForm((f) => ({ ...f, cardHolder: e.target.value }))
              }
              placeholder="Name on card"
              disabled={guaranteeSubmitting}
              autoFocus
            />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label className="fw-semibold">
              Card Number <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              type="text"
              inputMode="numeric"
              value={guaranteeForm.cardNumber}
              onChange={(e) =>
                setGuaranteeForm((f) => ({ ...f, cardNumber: e.target.value }))
              }
              placeholder="1234 5678 9012 3456"
              disabled={guaranteeSubmitting}
            />
          </Form.Group>
          <Row>
            <Col xs={6}>
              <Form.Group className="mb-2">
                <Form.Label className="fw-semibold">
                  Expiry (MM/YY) <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  type="text"
                  value={guaranteeForm.expiry}
                  onChange={(e) =>
                    setGuaranteeForm((f) => ({ ...f, expiry: e.target.value }))
                  }
                  placeholder="MM/YY"
                  maxLength={5}
                  disabled={guaranteeSubmitting}
                />
              </Form.Group>
            </Col>
            <Col xs={6}>
              <Form.Group className="mb-2">
                <Form.Label className="fw-semibold">
                  Card Type <span className="text-danger">*</span>
                </Form.Label>
                <Form.Select
                  value={guaranteeForm.cardType}
                  onChange={(e) =>
                    setGuaranteeForm((f) => ({ ...f, cardType: e.target.value }))
                  }
                  disabled={guaranteeSubmitting}
                >
                  <option value="Visa">Visa</option>
                  <option value="Mastercard">Mastercard</option>
                  <option value="Amex">Amex</option>
                  <option value="Other">Other</option>
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-secondary"
            onClick={closeGuarantee}
            disabled={guaranteeSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={submitGuarantee}
            disabled={guaranteeSubmitting}
          >
            {guaranteeSubmitting ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Submitting…
              </>
            ) : (
              "Submit Guarantee"
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Request Date / Time Change modal */}
      <Modal
        show={!!dateChangeBooking}
        onHide={closeDateChange}
        centered
        backdrop="static"
        keyboard={!dateChangeSubmitting}
      >
        <Modal.Header closeButton={!dateChangeSubmitting}>
          <Modal.Title className="d-flex align-items-center">
            <FaCalendarPlus className="me-2 text-warning" />
            Request Date / Time Change
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {dateChangeBooking && (
            <div className="small text-muted mb-3">
              <strong>{dateChangeBooking.bookingNumber}</strong> ·{" "}
              {dateChangeBooking.customerName || "Guest"} · current{" "}
              {fmtDate(dateChangeBooking.bookingDate)}{" "}
              {fmtTime(dateChangeBooking.bookingTime)}
            </div>
          )}
          <Row>
            <Col xs={6}>
              <Form.Group className="mb-2">
                <Form.Label className="fw-semibold">
                  Proposed Date <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  type="date"
                  value={dateChangeForm.proposedDate}
                  onChange={(e) =>
                    setDateChangeForm((f) => ({
                      ...f,
                      proposedDate: e.target.value,
                    }))
                  }
                  disabled={dateChangeSubmitting}
                  autoFocus
                />
              </Form.Group>
            </Col>
            <Col xs={6}>
              <Form.Group className="mb-2">
                <Form.Label className="fw-semibold">
                  Proposed Time <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  type="time"
                  value={dateChangeForm.proposedTime}
                  onChange={(e) =>
                    setDateChangeForm((f) => ({
                      ...f,
                      proposedTime: e.target.value,
                    }))
                  }
                  disabled={dateChangeSubmitting}
                />
              </Form.Group>
            </Col>
          </Row>
          <Row>
            <Col xs={6}>
              <Form.Group className="mb-2">
                <Form.Label className="fw-semibold">
                  Alternate Date <span className="text-muted small">(optional)</span>
                </Form.Label>
                <Form.Control
                  type="date"
                  value={dateChangeForm.proposedDateAlt}
                  onChange={(e) =>
                    setDateChangeForm((f) => ({
                      ...f,
                      proposedDateAlt: e.target.value,
                    }))
                  }
                  disabled={dateChangeSubmitting}
                />
              </Form.Group>
            </Col>
            <Col xs={6}>
              <Form.Group className="mb-2">
                <Form.Label className="fw-semibold">
                  Alternate Time <span className="text-muted small">(optional)</span>
                </Form.Label>
                <Form.Control
                  type="time"
                  value={dateChangeForm.proposedTimeAlt}
                  onChange={(e) =>
                    setDateChangeForm((f) => ({
                      ...f,
                      proposedTimeAlt: e.target.value,
                    }))
                  }
                  disabled={dateChangeSubmitting}
                />
              </Form.Group>
            </Col>
          </Row>
          <Form.Group className="mb-2">
            <Form.Label className="fw-semibold">Reason (optional)</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={dateChangeForm.reason}
              onChange={(e) =>
                setDateChangeForm((f) => ({ ...f, reason: e.target.value }))
              }
              placeholder="Why is a date/time change needed?"
              disabled={dateChangeSubmitting}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-secondary"
            onClick={closeDateChange}
            disabled={dateChangeSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant="warning"
            onClick={submitDateChange}
            disabled={dateChangeSubmitting}
          >
            {dateChangeSubmitting ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Submitting…
              </>
            ) : (
              "Submit Request"
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </RestaurantExtranetLayout>
  );
};

export default RestaurantExtranetReservations;
