import React, { useEffect, useState } from "react";
import {
  Card,
  Table,
  Button,
  Badge,
  Spinner,
  Modal,
  Form,
  Row,
  Col,
  Pagination,
  Container,
} from "react-bootstrap";
import { FaEye, FaTimesCircle, FaFileAlt, FaSearch } from "react-icons/fa";
import { toast } from "react-hot-toast";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";

/**
 * DayStayBookingList — mirrors HotelBookingList for the Day Stay flow.
 * Actions per row: View (modal with all details), Cancel (POST .../cancel
 * with reason), Voucher (opens a modal printable card built from the
 * voucher endpoint).
 */
export default function DayStayBookingList() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 10;

  // View
  const [showDetails, setShowDetails] = useState(false);
  const [selected, setSelected] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Cancel
  const [showCancel, setShowCancel] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  // Voucher
  const [showVoucher, setShowVoucher] = useState(false);
  const [voucher, setVoucher] = useState(null);

  const fetchRows = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get("/api/day-stay-booking");
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast.error("Failed to load Day Stay bookings");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, []);

  const filtered = (() => {
    const q = (search || "").trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        (r.bookingCode || "").toLowerCase().includes(q) ||
        (r.hotelName || "").toLowerCase().includes(q) ||
        (r.primaryGuest?.firstName || "").toLowerCase().includes(q) ||
        (r.primaryGuest?.lastName || "").toLowerCase().includes(q)
    );
  })();
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageData = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const handleView = async (row) => {
    setShowDetails(true);
    setDetailsLoading(true);
    try {
      const res = await axiosInstance.get(`/api/day-stay-booking/${row.id}`);
      setSelected(res.data);
    } catch {
      setSelected(row);
    } finally {
      setDetailsLoading(false);
    }
  };

  const openCancel = (row) => {
    setCancellingId(row.id);
    setCancelReason("");
    setShowCancel(true);
  };

  const submitCancel = async () => {
    if (!cancellingId) return;
    setCancelling(true);
    try {
      await axiosInstance.post(
        `/api/day-stay-booking/${cancellingId}/cancel`,
        { reason: cancelReason || null }
      );
      toast.success("Booking cancelled");
      setShowCancel(false);
      setCancellingId(null);
      setCancelReason("");
      fetchRows();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Cancellation failed");
    } finally {
      setCancelling(false);
    }
  };

  const handleVoucher = async (row) => {
    try {
      const res = await axiosInstance.get(
        `/api/day-stay-booking/${row.id}/voucher`
      );
      setVoucher(res.data);
      setShowVoucher(true);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Voucher not available");
    }
  };

  const statusBadge = (r) => {
    if (r.isCancelled) return <Badge bg="danger">Cancelled</Badge>;
    if ((r.status || "").toUpperCase() === "CONFIRMED")
      return <Badge bg="success">Confirmed</Badge>;
    return <Badge bg="secondary">{r.status || "—"}</Badge>;
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Container fluid>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h3 className="mb-0">Day Stay Bookings</h3>
              <div style={{ width: 300 }}>
                <Form.Control
                  type="text"
                  placeholder="Search by code, hotel or guest..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                />
              </div>
            </div>

            <Card className="shadow-sm">
              <Card.Body className="p-0">
                <Table
                  striped
                  bordered
                  hover
                  responsive
                  className="mb-0 align-middle"
                >
                  <thead>
                    <tr>
                      <th style={{ width: 70 }}>S/N</th>
                      <th>Booking Code</th>
                      <th>Hotel</th>
                      <th>Guest</th>
                      <th>Date / Time</th>
                      <th>Rooms</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th style={{ width: 150 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={9} className="text-center py-4">
                          <Spinner animation="border" />
                        </td>
                      </tr>
                    ) : pageData.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center text-muted py-4">
                          <FaSearch className="mb-2 opacity-50" />
                          <div>No Day Stay bookings found.</div>
                        </td>
                      </tr>
                    ) : (
                      pageData.map((r, i) => (
                        <tr key={r.id}>
                          <td>{i + 1 + page * pageSize}</td>
                          <td>{r.bookingCode || "-"}</td>
                          <td>{r.hotelName || "-"}</td>
                          <td>
                            {r.primaryGuest
                              ? `${r.primaryGuest.salutation || ""} ${
                                  r.primaryGuest.firstName || ""
                                } ${r.primaryGuest.lastName || ""}`.trim()
                              : "-"}
                          </td>
                          <td>
                            {r.checkInDate}
                            <br />
                            <small className="text-muted">
                              {(r.checkInTime || "").slice(0, 5)} –{" "}
                              {(r.checkOutTime || "").slice(0, 5)}
                            </small>
                          </td>
                          <td>{r.noOfRooms || 1}</td>
                          <td>
                            {r.totalAmount != null
                              ? `AED ${Number(r.totalAmount).toFixed(2)}`
                              : "—"}
                          </td>
                          <td>{statusBadge(r)}</td>
                          <td>
                            <div className="d-flex gap-2">
                              <FaEye
                                className="text-primary"
                                style={{ cursor: "pointer", fontSize: 18 }}
                                onClick={() => handleView(r)}
                                title="View"
                              />
                              {!r.isCancelled && (
                                <FaTimesCircle
                                  className="text-danger"
                                  style={{ cursor: "pointer", fontSize: 18 }}
                                  onClick={() => openCancel(r)}
                                  title="Cancel"
                                />
                              )}
                              <FaFileAlt
                                className={
                                  r.isCancelled
                                    ? "text-muted"
                                    : "text-success"
                                }
                                style={{
                                  cursor: r.isCancelled
                                    ? "not-allowed"
                                    : "pointer",
                                  fontSize: 18,
                                }}
                                onClick={() => {
                                  if (!r.isCancelled) handleVoucher(r);
                                }}
                                title={
                                  r.isCancelled
                                    ? "Cancelled bookings have no voucher"
                                    : "Voucher"
                                }
                              />
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>

            {totalPages > 1 && (
              <div className="d-flex justify-content-center mt-3">
                <Pagination className="mb-0">
                  <Pagination.Prev
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                  />
                  {[...Array(totalPages).keys()].map((n) => (
                    <Pagination.Item
                      key={n}
                      active={n === page}
                      onClick={() => setPage(n)}
                    >
                      {n + 1}
                    </Pagination.Item>
                  ))}
                  <Pagination.Next
                    disabled={page === totalPages - 1}
                    onClick={() => setPage((p) => p + 1)}
                  />
                </Pagination>
              </div>
            )}
          </Container>
        </main>
      </div>

      {/* View details modal */}
      <Modal
        show={showDetails}
        onHide={() => {
          setShowDetails(false);
          setSelected(null);
        }}
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Booking Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {detailsLoading ? (
            <div className="text-center py-3">
              <Spinner animation="border" />
            </div>
          ) : selected ? (
            <>
              <Row className="g-2 mb-3">
                <Col md={6}>
                  <strong>Booking Code:</strong> {selected.bookingCode}
                </Col>
                <Col md={6}>
                  <strong>Status:</strong> {statusBadge(selected)}
                </Col>
                <Col md={6}>
                  <strong>Hotel:</strong> {selected.hotelName}
                </Col>
                <Col md={6}>
                  <strong>Address:</strong> {selected.address || "—"}
                </Col>
                <Col md={6}>
                  <strong>Date:</strong> {selected.checkInDate}
                </Col>
                <Col md={6}>
                  <strong>Window:</strong>{" "}
                  {(selected.checkInTime || "").slice(0, 5)} –{" "}
                  {(selected.checkOutTime || "").slice(0, 5)}
                </Col>
                <Col md={6}>
                  <strong>Agent:</strong> {selected.agentId || "—"}
                </Col>
                <Col md={6}>
                  <strong>Total:</strong>{" "}
                  {selected.totalAmount != null
                    ? `AED ${Number(selected.totalAmount).toFixed(2)}`
                    : "—"}
                </Col>
              </Row>

              {selected.primaryGuest && (
                <>
                  <h6 className="border-bottom pb-1 mb-2">Primary Guest</h6>
                  <Row className="g-2 mb-3 small">
                    <Col md={6}>
                      {selected.primaryGuest.salutation}{" "}
                      {selected.primaryGuest.firstName}{" "}
                      {selected.primaryGuest.lastName}
                    </Col>
                    <Col md={6}>📧 {selected.primaryGuest.email}</Col>
                    <Col md={6}>📞 {selected.primaryGuest.phone}</Col>
                    <Col md={6}>
                      LPO: {selected.primaryGuest.agentLpo || "—"}
                    </Col>
                  </Row>
                </>
              )}

              <h6 className="border-bottom pb-1 mb-2">Rooms</h6>
              <Table size="sm" bordered>
                <thead className="table-light">
                  <tr>
                    <th>#</th>
                    <th>Category</th>
                    <th>Meal Plan</th>
                    <th>Adults</th>
                    <th>Children</th>
                    <th className="text-end">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {(selected.rooms || []).map((r, i) => (
                    <tr key={i}>
                      <td>{r.roomNo}</td>
                      <td>{r.roomCategory}</td>
                      <td>{r.mealPlan}</td>
                      <td>{r.adults}</td>
                      <td>{r.children}</td>
                      <td className="text-end">
                        AED {Number(r.rate || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              {selected.specialRequests?.length > 0 && (
                <p className="small mb-1">
                  <strong>Special Requests:</strong>{" "}
                  {selected.specialRequests.join(", ")}
                </p>
              )}
              {selected.cancellationPolicy?.length > 0 && (
                <p className="small mb-1">
                  <strong>Cancellation Policy:</strong>{" "}
                  {selected.cancellationPolicy.join(" / ")}
                </p>
              )}
              {selected.isCancelled && (
                <div className="alert alert-danger mt-2 mb-0 py-2 small">
                  <strong>Cancelled at:</strong> {selected.cancelledAt}
                  <br />
                  <strong>Reason:</strong>{" "}
                  {selected.cancellationReason || "—"}
                </div>
              )}
            </>
          ) : (
            <div className="text-muted">No data</div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDetails(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Cancel modal */}
      <Modal
        show={showCancel}
        onHide={() => !cancelling && setShowCancel(false)}
        centered
        backdrop="static"
      >
        <Modal.Header closeButton={!cancelling}>
          <Modal.Title>Cancel Booking</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Are you sure you want to cancel this Day Stay booking?</p>
          <Form.Label>Reason (optional)</Form.Label>
          <Form.Control
            as="textarea"
            rows={2}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            disabled={cancelling}
            onClick={() => setShowCancel(false)}
          >
            Back
          </Button>
          <Button variant="danger" disabled={cancelling} onClick={submitCancel}>
            {cancelling ? "Cancelling..." : "Confirm Cancellation"}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Voucher modal */}
      <Modal
        show={showVoucher}
        onHide={() => setShowVoucher(false)}
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Day Stay Voucher</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {voucher ? (
            <div>
              <h5 className="text-primary">
                {voucher.hotelName}{" "}
                <small className="text-muted">({voucher.bookingCode})</small>
              </h5>
              <p className="mb-1 text-muted small">{voucher.address || "—"}</p>
              <hr />
              <Row className="g-2">
                <Col md={6}>
                  <strong>Date:</strong> {voucher.checkInDate}
                </Col>
                <Col md={6}>
                  <strong>Window:</strong>{" "}
                  {(voucher.checkInTime || "").slice(0, 5)} –{" "}
                  {(voucher.checkOutTime || "").slice(0, 5)}
                </Col>
                <Col md={6}>
                  <strong>Primary Guest:</strong>{" "}
                  {voucher.primaryGuest?.firstName}{" "}
                  {voucher.primaryGuest?.lastName}
                </Col>
                <Col md={6}>
                  <strong>Total Paid:</strong>{" "}
                  {voucher.totalAmount != null
                    ? `AED ${Number(voucher.totalAmount).toFixed(2)}`
                    : "—"}
                </Col>
              </Row>
              <hr />
              <Table size="sm" bordered>
                <thead className="table-light">
                  <tr>
                    <th>Room</th>
                    <th>Category</th>
                    <th>Meal Plan</th>
                    <th>Pax</th>
                  </tr>
                </thead>
                <tbody>
                  {(voucher.rooms || []).map((r, i) => (
                    <tr key={i}>
                      <td>{r.roomNo}</td>
                      <td>{r.roomCategory}</td>
                      <td>{r.mealPlan}</td>
                      <td>
                        {r.adults} Adult{r.adults > 1 ? "s" : ""}
                        {r.children
                          ? `, ${r.children} Child${
                              r.children > 1 ? "ren" : ""
                            }`
                          : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ) : (
            <div className="text-muted">No voucher data</div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="primary" onClick={() => window.print()}>
            Print
          </Button>
          <Button variant="secondary" onClick={() => setShowVoucher(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
