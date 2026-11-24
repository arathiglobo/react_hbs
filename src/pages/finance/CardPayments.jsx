import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Card,
  Button,
  Table,
  Badge,
  Spinner,
  Modal,
  Alert,
  ButtonGroup,
} from "react-bootstrap";
import { useSearchParams } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import { FaSyncAlt } from "react-icons/fa";
import { getCurrentActiveRole } from "../../utils/authSession";
import { orderIdPathSegment } from "../../utils/urlSafety";

/**
 * Finance → Card Payments: CC Avenue card payments a person has to act on.
 *
 *   COMPLETE — paid (and confirmed by CC Avenue), but no booking was made:
 *              the customer closed the tab, or their page gave up while the
 *              payment was "being verified". "Complete booking" (admin)
 *              creates / reconfirms it from the details saved at payment
 *              time, through that flow's own finalize — so CC Avenue is
 *              asked again first and a second click never books twice.
 *   CHECK    — CC Avenue has not confirmed the payment yet. "Check with
 *              CC Avenue" asks again; once paid, the row turns COMPLETE.
 *   REVIEW   — cannot be booked from here (CC Avenue says not paid, amount
 *              mismatch, older payment without a booking link): check the
 *              order in MARS and refund it there if the customer was charged.
 *
 * The "Paid but no booking" and "Payment amount mismatch" alerts open this
 * page with ?order=<order id>, which highlights that row.
 *
 * Backend:
 *   GET  /api/payment/ccavenue/admin/attention?days=7|30|90   (staff)
 *   POST /api/payment/ccavenue/admin/complete/{orderId}       (admin)
 *   GET  /api/payment/ccavenue/status/{orderId}               (staff)
 */

const DAY_TABS = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
];

const money = (v, currency) => {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  const text = n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${currency} ${text}` : text;
};

const formatDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const isReconfirm = (item) =>
  item?.flowType === "RECONFIRM" ||
  String(item?.flowType || "").endsWith("_RECONFIRM");

const canComplete = () => {
  const role = String(getCurrentActiveRole() || "").toLowerCase();
  return role === "admin" || role === "super_admin";
};

// A short "what happened" line from a finalize answer (shapes differ per flow).
const answerMessage = (data) => {
  if (!data || typeof data !== "object") return "";
  return String(data.message || data.statusMessage || "").trim();
};

const errorMessage = (e, fallback) =>
  e?.response?.data?.message || e?.message || fallback;

const ACTION_BADGE = {
  COMPLETE: { bg: "danger", label: "Paid, not booked" },
  CHECK: { bg: "warning", text: "dark", label: "Being verified" },
  REVIEW: { bg: "secondary", label: "Review in MARS" },
};

export default function CardPayments() {
  const [searchParams] = useSearchParams();
  const highlightOrder = searchParams.get("order") || "";
  const [days, setDays] = useState(30);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [busyOrder, setBusyOrder] = useState("");
  const [target, setTarget] = useState(null);
  const highlightRef = useRef(null);
  const adminLogin = canComplete();

  const load = useCallback(async (range) => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await axiosInstance.get(
        "/api/payment/ccavenue/admin/attention",
        { params: { days: range } },
      );
      const list = Array.isArray(res?.data?.items) ? res.data.items : [];
      setItems(list);
      return list;
    } catch (e) {
      setLoadError(errorMessage(e, "Could not load the card payments."));
      setItems([]);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(days);
  }, [days, load]);

  // Bring the order an alert linked to into view once it is on screen.
  useEffect(() => {
    if (highlightOrder && highlightRef.current) {
      highlightRef.current.scrollIntoView({ block: "center" });
    }
  }, [items, highlightOrder]);

  const checkWithCCAvenue = async (item) => {
    setBusyOrder(item.orderId);
    try {
      const res = await axiosInstance.get(
        `/api/payment/ccavenue/status/${orderIdPathSegment(item.orderId)}`,
      );
      const data = res?.data || {};
      if (data.status === "SUCCESS") {
        toast.success(
          "CC Avenue confirms this payment. You can complete the booking now.",
        );
      } else {
        toast(
          data.statusMessage ||
            `CC Avenue has not confirmed it yet (status ${data.status || "unknown"}).`,
          { duration: 6000 },
        );
      }
      await load(days);
    } catch (e) {
      toast.error(errorMessage(e, "Could not ask CC Avenue about this payment."));
    } finally {
      setBusyOrder("");
    }
  };

  const completeBooking = async () => {
    const item = target;
    if (!item) return;
    setBusyOrder(item.orderId);
    try {
      const res = await axiosInstance.post(
        `/api/payment/ccavenue/admin/complete/${orderIdPathSegment(item.orderId)}`,
      );
      const message = answerMessage(res?.data);
      setTarget(null);
      // The list is the truth: a soft failure answers 200 but leaves the
      // payment unbooked, so it is still listed as "Paid, not booked".
      const fresh = await load(days);
      const stillOpen =
        Array.isArray(fresh) &&
        fresh.some((i) => i.orderId === item.orderId && i.action === "COMPLETE");
      if (stillOpen) {
        toast.error(
          message
            ? `Not booked: ${message}`
            : "The booking was not created. Check the order and try again, or refund it in MARS.",
          { duration: 8000 },
        );
      } else {
        toast.success(message || "Booking completed for this payment.", {
          duration: 5000,
        });
      }
    } catch (e) {
      toast.error(errorMessage(e, "The booking could not be completed."), {
        duration: 8000,
      });
      await load(days);
    } finally {
      setBusyOrder("");
    }
  };

  const counts = items.reduce(
    (acc, i) => ({ ...acc, [i.action]: (acc[i.action] || 0) + 1 }),
    {},
  );

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-2 p-md-4" style={{ minWidth: 0 }}>
          <Card className="shadow-sm rounded-xl mb-3">
            <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div>
                <span className="fw-semibold">Card Payments (CC Avenue)</span>
                <span className="text-muted ms-2 small">
                  {counts.COMPLETE || 0} paid, not booked
                  {" · "}
                  {counts.CHECK || 0} being verified
                  {" · "}
                  {counts.REVIEW || 0} to review
                </span>
              </div>
              <div className="d-flex gap-2 flex-wrap">
                <ButtonGroup size="sm">
                  {DAY_TABS.map((t) => (
                    <Button
                      key={t.value}
                      variant={days === t.value ? "primary" : "outline-primary"}
                      onClick={() => setDays(t.value)}
                      disabled={loading}
                    >
                      {t.label}
                    </Button>
                  ))}
                </ButtonGroup>
                <Button
                  size="sm"
                  variant="outline-secondary"
                  onClick={() => load(days)}
                  disabled={loading}
                >
                  <FaSyncAlt className="me-1" /> Refresh
                </Button>
              </div>
            </Card.Header>
            <Card.Body>
              <p className="text-muted small mb-3">
                Card payments that need a person: paid but never booked,
                still being verified with CC Avenue, or held for review.
                {!adminLogin &&
                  " Completing a booking needs an admin login."}
              </p>

              {loadError && <Alert variant="danger">{loadError}</Alert>}

              {loading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" size="sm" className="me-2" />
                  Loading…
                </div>
              ) : items.length === 0 ? (
                <div className="text-center text-muted py-5">
                  No card payments need action in the last {days} days.
                </div>
              ) : (
                <div className="table-responsive">
                  <Table hover size="sm" className="align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Order</th>
                        <th>Type</th>
                        <th>Agent</th>
                        <th className="text-end">Amount</th>
                        <th>Started</th>
                        <th>CC Avenue</th>
                        <th>What to do</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => {
                        const badge = ACTION_BADGE[item.action] || ACTION_BADGE.REVIEW;
                        const highlighted = item.orderId === highlightOrder;
                        const busy = busyOrder === item.orderId;
                        return (
                          <tr
                            key={item.orderId}
                            ref={highlighted ? highlightRef : undefined}
                            className={highlighted ? "table-info" : undefined}
                          >
                            <td className="text-nowrap fw-semibold">
                              {item.orderId}
                              <div>
                                <Badge
                                  bg={badge.bg}
                                  text={badge.text}
                                  pill
                                >
                                  {badge.label}
                                </Badge>
                              </div>
                            </td>
                            <td className="text-nowrap small">
                              {item.flowLabel || item.flowType || "—"}
                              {isReconfirm(item) && item.existingBookingId && (
                                <div className="text-muted">
                                  booking #{item.existingBookingId}
                                </div>
                              )}
                            </td>
                            <td className="small">
                              {item.agentName ||
                                (item.agentId ? `Agent ${item.agentId}` : "—")}
                            </td>
                            <td className="text-end text-nowrap">
                              {money(item.amount, item.currency)}
                            </td>
                            <td className="text-nowrap small">
                              {formatDateTime(item.createdAt)}
                            </td>
                            <td className="small" style={{ minWidth: 150 }}>
                              <div className="fw-semibold">
                                {item.verificationPending
                                  ? "Being verified"
                                  : item.status || "—"}
                              </div>
                              {item.verifiedAt && (
                                <div className="text-muted">
                                  confirmed {formatDateTime(item.verifiedAt)}
                                </div>
                              )}
                              {item.trackingId && (
                                <div className="text-muted">
                                  tracking {item.trackingId}
                                </div>
                              )}
                            </td>
                            <td className="small" style={{ minWidth: 260 }}>
                              {item.actionHint || "—"}
                            </td>
                            <td className="text-nowrap">
                              {item.action === "COMPLETE" && (
                                <Button
                                  size="sm"
                                  variant="primary"
                                  onClick={() => setTarget(item)}
                                  disabled={busy || !adminLogin}
                                  title={
                                    adminLogin
                                      ? "Create the booking from the details saved at payment time"
                                      : "Needs an admin login"
                                  }
                                >
                                  {busy && (
                                    <Spinner
                                      animation="border"
                                      size="sm"
                                      className="me-1"
                                    />
                                  )}
                                  {isReconfirm(item)
                                    ? "Complete reconfirm"
                                    : "Complete booking"}
                                </Button>
                              )}
                              {item.action === "CHECK" && (
                                <Button
                                  size="sm"
                                  variant="outline-primary"
                                  onClick={() => checkWithCCAvenue(item)}
                                  disabled={busy}
                                >
                                  {busy && (
                                    <Spinner
                                      animation="border"
                                      size="sm"
                                      className="me-1"
                                    />
                                  )}
                                  Check with CC Avenue
                                </Button>
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
        </main>
      </div>

      <Modal
        show={!!target}
        onHide={() => !busyOrder && setTarget(null)}
        centered
      >
        <Modal.Header closeButton={!busyOrder}>
          <Modal.Title className="fs-6">
            {isReconfirm(target) ? "Complete reconfirm" : "Complete booking"} —
            order {target?.orderId}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {target && (
            <>
              <div className="small text-muted mb-2">
                {target.flowLabel || target.flowType}
                {" · "}
                {target.agentName ||
                  (target.agentId ? `Agent ${target.agentId}` : "")}
                {" · "}
                {money(target.amount, target.currency)}
              </div>
              <Alert variant="warning" className="py-2 small mb-0">
                {isReconfirm(target)
                  ? `This reconfirms booking #${target.existingBookingId || "—"} as paid online now.`
                  : "This creates the booking now from the details saved when the customer paid, under the agent above."}{" "}
                CC Avenue is asked to confirm the payment first. If the room
                is no longer available the booking fails — then refund the
                payment in MARS instead.
              </Alert>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-secondary"
            onClick={() => setTarget(null)}
            disabled={!!busyOrder}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={completeBooking}
            disabled={!!busyOrder}
          >
            {busyOrder && (
              <Spinner animation="border" size="sm" className="me-1" />
            )}
            {isReconfirm(target) ? "Reconfirm now" : "Create booking now"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
