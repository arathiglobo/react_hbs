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
  { key: "confirmed",label: "Confirmed",        match: (b) => statusOf(b) === "Confirmed" },
  { key: "checked",  label: "Checked In",       match: (b) => statusOf(b) === "Checked In" },
  { key: "done",     label: "Completed",        match: (b) => statusOf(b) === "Completed" },
  { key: "noshow",   label: "No Show",          match: (b) => statusOf(b) === "No Show" },
  { key: "rejected", label: "Rejected",         match: (b) => statusOf(b) === "Rejected" },
  { key: "cancel",   label: "Cancelled",        match: (b) => statusOf(b) === "Cancelled" },
];

function statusOf(b) {
  return (b?.bookingStatus || "").trim();
}

function statusBadgeVariant(status) {
  switch ((status || "").toLowerCase()) {
    case "pending approval": return "warning";
    case "confirmed":        return "primary";
    case "checked in":       return "info";
    case "completed":        return "success";
    case "no show":          return "dark";
    case "rejected":         return "danger";
    case "cancelled":        return "secondary";
    default:                 return "secondary";
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

  const runAction = async (booking, action, remark) => {
    setActingId(booking.id);
    try {
      const res = await axiosInstance.post(
        `/api/restaurant-extranet/bookings/${booking.id}/${action}`,
        remark ? { remark } : {}
      );
      const data = res?.data || {};
      if (data.status === "SUCCESS") {
        toast.success("Booking updated.");
        setRows((prev) =>
          prev.map((r) => (r.id === booking.id && data.booking ? data.booking : r))
        );
      } else {
        toast.error(data.message || "Action failed.");
      }
    } catch (err) {
      const msg = err?.response?.data?.message || "Action failed.";
      toast.error(msg);
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
          <FaCheckCircle className="me-1" /> Confirm
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
    </RestaurantExtranetLayout>
  );
};

export default RestaurantExtranetReservations;
