import React, { useCallback, useEffect, useMemo, useState } from "react";
import axiosInstance from "../../components/AxiosInstance";
import {
  Card,
  Row,
  Col,
  Button,
  Spinner,
  Badge,
  Modal,
  Table,
} from "react-bootstrap";
import {
  FaChevronLeft,
  FaChevronRight,
  FaCalendarAlt,
  FaUsers,
  FaClock,
  FaCircle,
} from "react-icons/fa";
import RestaurantExtranetLayout from "./RestaurantExtranetLayout";

/**
 * Monthly calendar showing reservations grouped by date. Each day cell
 * renders the count + a status colour strip; clicking a day opens a
 * modal with that day's reservations. Read-only (use the Reservations
 * page for status actions).
 *
 * Bookings are loaded once for the whole restaurant — the dataset is
 * small enough that filtering by month client-side is faster than a
 * round-trip per arrow click.
 */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function statusVariant(s) {
  switch ((s || "").toLowerCase()) {
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

function statusColor(s) {
  switch ((s || "").toLowerCase()) {
    case "pending approval": return "#D97706";
    case "confirmed":        return "#2563EB";
    case "checked in":       return "#0EA5E9";
    case "completed":        return "#16A34A";
    case "no show":          return "#1F2937";
    case "rejected":         return "#DC2626";
    case "cancelled":        return "#6B7280";
    default:                 return "#9CA3AF";
  }
}

function fmtTime(t) {
  if (!t) return "";
  if (typeof t === "string" && t.length >= 5) return t.substring(0, 5);
  return t;
}

function isSameYmd(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function parseBookingDate(d) {
  if (!d) return null;
  try {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return null;
    return dt;
  } catch {
    return null;
  }
}

const RestaurantExtranetCalendar = () => {
  const [cursor, setCursor] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/api/restaurant-extranet/bookings");
      setBookings(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("extranet calendar fetch failed", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Build a Map<yyyy-mm-dd, Array<booking>> for fast cell lookups.
  const byDay = useMemo(() => {
    const map = new Map();
    bookings.forEach((b) => {
      const dt = parseBookingDate(b.bookingDate);
      if (!dt) return;
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(b);
    });
    return map;
  }, [bookings]);

  // Cells for the visible month. The grid pads the start with the
  // trailing days of the previous month and the end with the leading
  // days of the next so we always render full weeks.
  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startWeekday = firstOfMonth.getDay(); // 0 = Sunday
    const start = new Date(year, month, 1 - startWeekday);

    const result = [];
    for (let i = 0; i < 42; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
      result.push({
        date: day,
        inMonth: day.getMonth() === month,
        bookings: byDay.get(key) || [],
      });
    }
    return result;
  }, [cursor, byDay]);

  const monthTitle = useMemo(
    () => cursor.toLocaleString(undefined, { month: "long", year: "numeric" }),
    [cursor]
  );

  const today = new Date();

  const prevMonth = () =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1));
  const nextMonth = () =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1));
  const goToToday = () => {
    const t = new Date();
    setCursor(new Date(t.getFullYear(), t.getMonth(), 1));
  };

  return (
    <RestaurantExtranetLayout
      title="Calendar"
      subtitle="Monthly view of reservations. Click a day to see details."
    >
      <Card className="shadow-sm border-0 rounded-3 mb-3">
        <Card.Body className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div className="d-flex align-items-center gap-2">
            <Button variant="outline-secondary" size="sm" onClick={prevMonth}>
              <FaChevronLeft />
            </Button>
            <h5 className="fw-bold m-0" style={{ minWidth: 180, textAlign: "center" }}>
              <FaCalendarAlt className="me-2 text-primary" />
              {monthTitle}
            </h5>
            <Button variant="outline-secondary" size="sm" onClick={nextMonth}>
              <FaChevronRight />
            </Button>
            <Button variant="outline-primary" size="sm" className="ms-2" onClick={goToToday}>
              Today
            </Button>
          </div>
          {loading && (
            <div className="d-flex align-items-center gap-2 small text-muted">
              <Spinner animation="border" size="sm" /> Loading…
            </div>
          )}
        </Card.Body>
      </Card>

      <Card className="shadow-sm border-0 rounded-3">
        <Card.Body className="p-0">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 1,
              background: "#e5e7eb",
            }}
          >
            {WEEKDAYS.map((w) => (
              <div
                key={w}
                style={{
                  background: "#f8f9fa",
                  padding: "8px 10px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "#6b7280",
                  textTransform: "uppercase",
                  textAlign: "left",
                }}
              >
                {w}
              </div>
            ))}
            {cells.map((cell, idx) => {
              const todayCell = isSameYmd(cell.date, today);
              const hasBookings = cell.bookings.length > 0;
              return (
                <div
                  key={idx}
                  onClick={() => hasBookings && setSelectedDay(cell)}
                  style={{
                    background: "#fff",
                    minHeight: 110,
                    padding: "8px 10px",
                    cursor: hasBookings ? "pointer" : "default",
                    position: "relative",
                    opacity: cell.inMonth ? 1 : 0.45,
                    borderLeft: todayCell ? "3px solid #6366f1" : "none",
                  }}
                >
                  <div
                    className="d-flex justify-content-between align-items-center"
                    style={{ marginBottom: 6 }}
                  >
                    <span
                      style={{
                        fontWeight: todayCell ? 700 : 500,
                        color: todayCell ? "#6366f1" : "#111827",
                        fontSize: "0.9rem",
                      }}
                    >
                      {cell.date.getDate()}
                    </span>
                    {hasBookings && (
                      <Badge bg="primary" pill style={{ fontSize: "0.7rem" }}>
                        {cell.bookings.length}
                      </Badge>
                    )}
                  </div>
                  <div className="d-flex flex-column gap-1">
                    {cell.bookings.slice(0, 3).map((b) => (
                      <div
                        key={b.id}
                        style={{
                          fontSize: "0.72rem",
                          color: "#374151",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <FaCircle size={6} style={{ color: statusColor(b.bookingStatus) }} />
                        <span>
                          {fmtTime(b.bookingTime)} {b.customerName || "Guest"}
                        </span>
                      </div>
                    ))}
                    {cell.bookings.length > 3 && (
                      <div className="small text-muted">+{cell.bookings.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card.Body>
      </Card>

      {/* Legend */}
      <Card className="shadow-sm border-0 rounded-3 mt-3">
        <Card.Body className="d-flex flex-wrap gap-3 small text-muted">
          {[
            "Pending Approval",
            "Confirmed",
            "Checked In",
            "Completed",
            "No Show",
            "Rejected",
            "Cancelled",
          ].map((s) => (
            <span key={s} className="d-inline-flex align-items-center gap-1">
              <FaCircle size={9} style={{ color: statusColor(s) }} />
              {s}
            </span>
          ))}
        </Card.Body>
      </Card>

      {/* Per-day modal */}
      <Modal
        show={!!selectedDay}
        onHide={() => setSelectedDay(null)}
        centered
        size="lg"
        scrollable
      >
        <Modal.Header closeButton>
          <Modal.Title className="d-flex align-items-center">
            <FaCalendarAlt className="me-2 text-primary" />
            {selectedDay?.date?.toLocaleDateString(undefined, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedDay?.bookings?.length === 0 ? (
            <div className="text-muted small">No reservations on this day.</div>
          ) : (
            <Table hover responsive size="sm" className="mb-0 align-middle" style={{ fontSize: "0.875rem" }}>
              <thead style={{ backgroundColor: "#f8f9fa" }}>
                <tr style={{ textTransform: "uppercase", fontSize: "0.72rem" }}>
                  <th>Booking</th>
                  <th>Guest</th>
                  <th>Time</th>
                  <th>Pax</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(selectedDay?.bookings || []).map((b) => (
                  <tr key={b.id}>
                    <td className="fw-semibold text-primary">{b.bookingNumber}</td>
                    <td>
                      <div className="fw-semibold">{b.customerName || "—"}</div>
                      {b.mobile && (
                        <small className="text-muted">{b.mobile}</small>
                      )}
                    </td>
                    <td>
                      <FaClock className="me-1 text-muted" />
                      {fmtTime(b.bookingTime) || "—"}
                    </td>
                    <td>
                      <FaUsers className="me-1 text-muted" />
                      {b.memberCount || 0}
                    </td>
                    <td>
                      <Badge bg={statusVariant(b.bookingStatus)}>
                        {b.bookingStatus || "—"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setSelectedDay(null)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </RestaurantExtranetLayout>
  );
};

export default RestaurantExtranetCalendar;
