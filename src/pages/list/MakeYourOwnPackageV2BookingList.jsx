import React, { useEffect, useState } from "react";
import {
  Container,
  Card,
  Table,
  Badge,
  Spinner,
  Button,
  Modal,
  Form,
  Row,
  Col,
} from "react-bootstrap";
import { FaEye, FaTrash, FaSync } from "react-icons/fa";
import { toast } from "react-hot-toast";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import { ADDON_SERVICES_CATALOG } from "../../components/AddOnServicesPanel";

// Look up the human-readable label + field schema for a service key.
const _catalogByKey = ADDON_SERVICES_CATALOG.reduce((acc, svc) => {
  acc[svc.key] = svc;
  return acc;
}, {});
const _labelForServiceField = (svcKey, fieldName) => {
  const svc = _catalogByKey[svcKey];
  if (!svc) return fieldName;
  const f = (svc.fields || []).find((x) => x.name === fieldName);
  return f ? f.label : fieldName;
};

/**
 * Booking list for the v2 Make-Your-Own-Package flow.
 *
 * Backed by GET /api/makeYourOwnPackageV2/booking/list. Cancel calls
 * DELETE /api/makeYourOwnPackageV2/booking/{id}. View opens a modal that
 * dumps the per-line details (hotels / cabs / activities / guests / addons).
 */
const MakeYourOwnPackageV2BookingList = () => {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");

  const [showDetails, setShowDetails] = useState(false);
  const [selected, setSelected] = useState(null);

  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [toCancel, setToCancel] = useState(null);

  const fetchList = async () => {
    setLoading(true);
    try {
      const role = (localStorage.getItem("currentActiveRole") || "").toLowerCase();
      const params = {};
      if (role === "agent") {
        const agentId = localStorage.getItem("agentId");
        if (agentId && agentId !== "null") params.agentId = agentId;
      }
      const res = await axiosInstance.get(
        "/api/makeYourOwnPackageV2/booking/list",
        { params }
      );
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error("v2 booking list error", e);
      toast.error("Failed to load bookings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  const filtered = rows.filter((b) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return [
      b.bookingCode,
      b.customerFirstName,
      b.customerLastName,
      b.customerEmail,
      b.customerPhone,
      b.agentName,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(q);
  });

  const onView = (b) => {
    setSelected(b);
    setShowDetails(true);
  };

  const onCancelClick = (b) => {
    setToCancel(b);
    setCancelReason("");
    setShowCancel(true);
  };
  const doCancel = async () => {
    if (!toCancel) return;
    setCancelling(true);
    try {
      await axiosInstance.delete(
        `/api/makeYourOwnPackageV2/booking/${toCancel.id}`,
        { params: { reason: cancelReason || "" } }
      );
      toast.success("Booking cancelled");
      setShowCancel(false);
      setToCancel(null);
      setCancelReason("");
      fetchList();
    } catch (e) {
      console.error("v2 cancel error", e);
      toast.error("Failed to cancel booking");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-3">
          <Container fluid>
            <Card className="shadow-sm">
              <Card.Header className="d-flex justify-content-between align-items-center bg-white">
                <span className="fw-semibold">
                  Make Your Own Package (v2) — Bookings
                </span>
                <div className="d-flex gap-2">
                  <Form.Control
                    size="sm"
                    placeholder="Search by code / customer / agent"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ width: 280 }}
                  />
                  <Button
                    size="sm"
                    variant="outline-primary"
                    onClick={fetchList}
                    disabled={loading}
                  >
                    <FaSync className={loading ? "me-1 fa-spin" : "me-1"} />
                    Refresh
                  </Button>
                </div>
              </Card.Header>
              <Card.Body>
                {loading ? (
                  <div className="text-center py-4">
                    <Spinner animation="border" />
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="text-center text-muted py-4">
                    No bookings yet.
                  </div>
                ) : (
                  <Table bordered hover responsive className="align-middle">
                    <thead className="table-light">
                      <tr>
                        <th>#</th>
                        <th>Booking Code</th>
                        <th>Customer</th>
                        <th>Tour Date</th>
                        <th>Cart Lines</th>
                        <th>Visa</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th style={{ width: 110 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((b, i) => (
                        <tr key={b.id}>
                          <td>{i + 1}</td>
                          <td className="fw-semibold">{b.bookingCode}</td>
                          <td>
                            <div>
                              {[b.salutation, b.customerFirstName, b.customerLastName]
                                .filter(Boolean)
                                .join(" ")}
                            </div>
                            <small className="text-muted">
                              {b.customerEmail || b.customerPhone || ""}
                            </small>
                          </td>
                          <td>{b.tourDate || "—"}</td>
                          <td>
                            <div className="d-flex gap-1 flex-wrap">
                              {b.hotels?.length > 0 && (
                                <Badge bg="primary">
                                  {b.hotels.length} hotel
                                </Badge>
                              )}
                              {b.cabs?.length > 0 && (
                                <Badge bg="info">{b.cabs.length} cab</Badge>
                              )}
                              {b.activities?.length > 0 && (
                                <Badge bg="warning" text="dark">
                                  {b.activities.length} activity
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td>
                            <Badge
                              bg={b.visaRequired === "YES" ? "danger" : "secondary"}
                            >
                              {b.visaRequired || "NO"}
                            </Badge>
                          </td>
                          <td>₹ {Number(b.totalPrice || 0).toLocaleString()}</td>
                          <td>
                            {b.isCancelled ? (
                              <Badge bg="danger">Cancelled</Badge>
                            ) : (
                              <Badge bg="success">
                                {b.bookingStatus || "Confirmed"}
                              </Badge>
                            )}
                          </td>
                          <td>
                            <div className="d-flex gap-2">
                              <Button
                                size="sm"
                                variant="outline-info"
                                onClick={() => onView(b)}
                                title="View"
                              >
                                <FaEye />
                              </Button>
                              {!b.isCancelled && (
                                <Button
                                  size="sm"
                                  variant="outline-danger"
                                  onClick={() => onCancelClick(b)}
                                  title="Cancel"
                                >
                                  <FaTrash />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </Card.Body>
            </Card>
          </Container>
        </main>
      </div>

      {/* Details modal */}
      <Modal
        show={showDetails}
        onHide={() => setShowDetails(false)}
        size="lg"
        scrollable
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>
            Booking Details — {selected?.bookingCode}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selected && (
            <>
              <Row className="g-2 mb-3">
                <Col md={6}>
                  <strong>Customer:</strong>{" "}
                  {[
                    selected.salutation,
                    selected.customerFirstName,
                    selected.customerLastName,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                </Col>
                <Col md={6}>
                  <strong>Phone:</strong> {selected.customerPhone || "—"}
                </Col>
                <Col md={6}>
                  <strong>Email:</strong> {selected.customerEmail || "—"}
                </Col>
                <Col md={6}>
                  <strong>Agent:</strong> {selected.agentName || "—"}
                </Col>
                <Col md={6}>
                  <strong>Tour Date:</strong> {selected.tourDate || "—"}
                </Col>
                <Col md={6}>
                  <strong>Visa Required:</strong>{" "}
                  <Badge
                    bg={selected.visaRequired === "YES" ? "danger" : "secondary"}
                  >
                    {selected.visaRequired || "NO"}
                  </Badge>
                </Col>
                <Col md={6}>
                  <strong>Selling Price:</strong>{" "}
                  ₹ {Number(selected.sellingPrice || 0).toLocaleString()}
                </Col>
                <Col md={6}>
                  <strong>Total Price:</strong>{" "}
                  ₹ {Number(selected.totalPrice || 0).toLocaleString()}
                </Col>
              </Row>

              {selected.hotels?.length > 0 && (
                <>
                  <h6 className="mt-3">Hotels</h6>
                  <Table size="sm" bordered className="mb-3">
                    <thead className="table-light">
                      <tr>
                        <th>#</th>
                        <th>Hotel</th>
                        <th>Room Category</th>
                        <th>Check-In / Out</th>
                        <th>Pax</th>
                        <th>Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.hotels.map((h, i) => (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          <td>{h.hotelName || `#${h.hotelId}`}</td>
                          <td>{h.roomCategory || "—"}</td>
                          <td>
                            {h.checkIn || "—"} → {h.checkOut || "—"}
                          </td>
                          <td>
                            {h.noOfAdults || 0}A / {h.noOfChildren || 0}C
                          </td>
                          <td>
                            ₹ {Number(h.totalRate || 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </>
              )}

              {selected.cabs?.length > 0 && (
                <>
                  <h6>Transfers</h6>
                  <Table size="sm" bordered className="mb-3">
                    <thead className="table-light">
                      <tr>
                        <th>#</th>
                        <th>Cab</th>
                        <th>Pickup → Dropoff</th>
                        <th>Date</th>
                        <th>Pax</th>
                        <th>Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.cabs.map((c, i) => (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          <td>{c.cabName || `#${c.cabId}`}</td>
                          <td>
                            {c.pickupName || "—"}
                            {c.pickupTime ? ` @ ${c.pickupTime}` : ""} →{" "}
                            {c.dropoffName || "—"}
                            {c.dropoffTime ? ` @ ${c.dropoffTime}` : ""}
                          </td>
                          <td>
                            {c.pickupDate || "—"}
                            {c.dropoffDate ? ` → ${c.dropoffDate}` : ""}
                          </td>
                          <td>
                            {c.noOfAdult || 0}A / {c.noOfChild || 0}C
                          </td>
                          <td>
                            ₹ {Number(c.totalRate || 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </>
              )}

              {selected.activities?.length > 0 && (
                <>
                  <h6>Activities</h6>
                  <Table size="sm" bordered className="mb-3">
                    <thead className="table-light">
                      <tr>
                        <th>#</th>
                        <th>Activity</th>
                        <th>Date</th>
                        <th>Pax</th>
                        <th>Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.activities.map((a, i) => (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          <td>{a.activityName || `#${a.activityId}`}</td>
                          <td>{a.tourDate || "—"}</td>
                          <td>
                            {a.noOfAdult || 0}A / {a.noOfChild || 0}C
                          </td>
                          <td>
                            ₹ {Number(a.totalRate || 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </>
              )}

              {selected.addOnServices &&
                Object.keys(selected.addOnServices).length > 0 && (
                  <>
                    <h6>Add-On Services</h6>
                    <Row className="g-2 mb-3">
                      {Object.entries(selected.addOnServices).map(
                        ([svcKey, data]) => {
                          if (!data || data.enabled !== true) return null;
                          const svc = _catalogByKey[svcKey];
                          const label = svc ? svc.label : svcKey;
                          const filled = Object.entries(data || {}).filter(
                            ([k, v]) =>
                              k !== "enabled" &&
                              v !== undefined &&
                              v !== null &&
                              v !== ""
                          );
                          return (
                            <Col md={6} key={svcKey}>
                              <Card className="h-100 border-success-subtle">
                                <Card.Header className="bg-success-subtle py-2">
                                  <strong className="small">{label}</strong>
                                </Card.Header>
                                <Card.Body className="p-2">
                                  {filled.length === 0 ? (
                                    <span className="small text-muted fst-italic">
                                      Enabled (no extra details captured)
                                    </span>
                                  ) : (
                                    <Table size="sm" borderless className="mb-0">
                                      <tbody>
                                        {filled.map(([k, v]) => (
                                          <tr key={k}>
                                            <td
                                              className="small text-muted fw-semibold"
                                              style={{ width: "45%" }}
                                            >
                                              {_labelForServiceField(svcKey, k)}
                                            </td>
                                            <td className="small">
                                              {String(v)}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </Table>
                                  )}
                                </Card.Body>
                              </Card>
                            </Col>
                          );
                        }
                      )}
                    </Row>
                  </>
                )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDetails(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Cancel modal */}
      <Modal show={showCancel} onHide={() => setShowCancel(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Cancel Booking</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Cancel booking{" "}
          <strong>{toCancel?.bookingCode}</strong>?
          <Form.Control
            as="textarea"
            rows={2}
            placeholder="Reason (optional)"
            className="mt-2"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowCancel(false)}
            disabled={cancelling}
          >
            No
          </Button>
          <Button variant="danger" onClick={doCancel} disabled={cancelling}>
            {cancelling ? "Cancelling..." : "Yes, Cancel"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default MakeYourOwnPackageV2BookingList;
