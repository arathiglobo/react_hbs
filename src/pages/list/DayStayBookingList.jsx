import React, { useEffect, useMemo, useState } from "react";
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
  InputGroup,
} from "react-bootstrap";
import { FaEye, FaTimesCircle, FaFileAlt, FaSearch, FaTrashAlt } from "react-icons/fa";

const PER_PAGE_OPTIONS = [10, 25, 50, 100];
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
  const [size, setSize] = useState(10);
  const [bookingType, setBookingType] = useState("upcoming");

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

  const filtered = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const byType = rows.filter((r) => {
      if (bookingType === "cancelled") return !!r.isCancelled;
      if (r.isCancelled) return false;
      const ref = r.checkInDate;
      const refDate = ref ? new Date(ref) : null;
      if (refDate && !isNaN(refDate.getTime())) {
        refDate.setHours(0, 0, 0, 0);
        if (bookingType === "completed") return refDate < today;
        if (bookingType === "upcoming") return refDate >= today;
      }
      return bookingType === "upcoming";
    });
    const q = (search || "").trim().toLowerCase();
    if (!q) return byType;
    return byType.filter(
      (r) =>
        (r.bookingCode || "").toLowerCase().includes(q) ||
        (r.hotelName || "").toLowerCase().includes(q) ||
        (r.primaryGuest?.firstName || "").toLowerCase().includes(q) ||
        (r.primaryGuest?.lastName || "").toLowerCase().includes(q),
    );
  }, [rows, search, bookingType]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / size));
  const safePage = Math.min(page, totalPages - 1);
  const pageData = filtered.slice(safePage * size, (safePage + 1) * size);
  const displayStart = filtered.length === 0 ? 0 : safePage * size + 1;
  const displayEnd = Math.min(filtered.length, (safePage + 1) * size);

  useEffect(() => {
    setPage(0);
  }, [search, bookingType]);

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
        <main
          className="flex-grow-1 p-4"
          style={{ width: "100%", overflow: "hidden" }}
        >
          <Container
            fluid
            style={{
              maxWidth: "100%",
              paddingLeft: "1rem",
              paddingRight: "1rem",
            }}
          >
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div className="d-flex align-items-center gap-3">
                <h4 className="mb-0 text-dark">Day Stay Booking</h4>
              </div>
            </div>

            {/* List of Bookings Section */}
            <Card className="border mb-3" style={{ borderRadius: "8px" }}>
              <Card.Header
                className="d-flex justify-content-between align-items-center text-dark border-bottom"
                style={{
                  borderRadius: "8px 8px 0 0",
                  backgroundColor: "#f1f3f5",
                }}
              >
                <span>List of Bookings</span>
              </Card.Header>
              <Card.Body>
                {/* Booking Types radio filter */}
                <Row className="mb-4">
                  <Col md={6}>
                    <Card
                      className="border"
                      style={{
                        backgroundColor: "#f8f9fa",
                        borderRadius: "8px",
                      }}
                    >
                      <Card.Body className="p-3">
                        <h6
                          className="mb-3 text-dark"
                          style={{ fontSize: "0.85rem" }}
                        >
                          Booking Types
                        </h6>
                        <div className="d-flex flex-wrap gap-4">
                          {[
                            { value: "upcoming", label: "Upcoming" },
                            { value: "completed", label: "Completed" },
                            { value: "cancelled", label: "Cancelled" },
                          ].map((opt) => (
                            <Form.Check
                              key={opt.value}
                              type="radio"
                              id={`bookingType-${opt.value}`}
                              name="bookingType"
                              label={opt.label}
                              checked={bookingType === opt.value}
                              onChange={() => {
                                setBookingType(opt.value);
                                setPage(0);
                              }}
                              style={{
                                fontSize: "0.85rem",
                                cursor: "pointer",
                              }}
                            />
                          ))}
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>

                {/* Display + Search */}
                <Row className="mb-3 align-items-center">
                  <Col md={3}>
                    <div className="d-flex align-items-center gap-2">
                      <span className="small text-muted">Display</span>
                      <Form.Select
                        value={size}
                        onChange={(e) => {
                          setSize(Number(e.target.value));
                          setPage(0);
                        }}
                        size="sm"
                        style={{ width: "auto" }}
                      >
                        {PER_PAGE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option} records
                          </option>
                        ))}
                      </Form.Select>
                    </div>
                  </Col>
                  <Col md={4} className="ms-auto">
                    <InputGroup>
                      <InputGroup.Text>
                        <FaSearch />
                      </InputGroup.Text>
                      <Form.Control
                        type="text"
                        placeholder="Search:"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </InputGroup>
                  </Col>
                </Row>

                {/* Table */}
                {loading ? (
                  <div className="text-center py-5">
                    <Spinner animation="border" variant="primary" />
                    <p className="mt-3 text-muted">Loading bookings...</p>
                  </div>
                ) : (
                  <>
                    <div className="table-responsive">
                      <Table striped bordered hover className="mb-0 align-middle">
                        <thead className="table-light">
                          <tr>
                            <th style={{ width: "60px" }}>S.N</th>
                            <th>Booking Code</th>
                            <th>Hotel</th>
                            <th>Guest</th>
                            <th>Date / Time</th>
                            <th>Rooms</th>
                            <th className="text-end">Total</th>
                            <th>Status</th>
                            <th style={{ width: "150px" }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pageData.length > 0 ? (
                            pageData.map((r, i) => (
                              <tr key={r.id}>
                                <td>{safePage * size + i + 1}</td>
                                <td className="text-dark">
                                  {r.bookingCode || "-"}
                                </td>
                                <td>{r.hotelName || "-"}</td>
                                <td>
                                  {r.primaryGuest
                                    ? `${r.primaryGuest.salutation || ""} ${
                                        r.primaryGuest.firstName || ""
                                      } ${r.primaryGuest.lastName || ""}`.trim()
                                    : "-"}
                                </td>
                                <td>
                                  {r.checkInDate || "-"}
                                  <div className="small text-muted">
                                    {(r.checkInTime || "").slice(0, 5)} –{" "}
                                    {(r.checkOutTime || "").slice(0, 5)}
                                  </div>
                                </td>
                                <td>{r.noOfRooms || 1}</td>
                                <td className="text-end text-dark">
                                  {r.totalAmount != null
                                    ? `AED ${Number(r.totalAmount).toFixed(2)}`
                                    : "—"}
                                </td>
                                <td>
                                  {r.isCancelled
                                    ? "Cancelled"
                                    : r.status || "—"}
                                </td>
                                <td>
                                  <div className="d-flex gap-3 align-items-center flex-wrap">
                                    <FaEye
                                      style={{
                                        cursor: "pointer",
                                        fontSize: "14px",
                                        color: "#007bff",
                                      }}
                                      onClick={() => handleView(r)}
                                      title="View Details"
                                    />
                                    <FaFileAlt
                                      style={{
                                        cursor: r.isCancelled
                                          ? "not-allowed"
                                          : "pointer",
                                        fontSize: "14px",
                                        color: r.isCancelled
                                          ? "#6c757d"
                                          : "#198754",
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
                                    {!r.isCancelled && (
                                      <FaTrashAlt
                                        style={{
                                          cursor: "pointer",
                                          fontSize: "14px",
                                          color: "#dc3545",
                                        }}
                                        onClick={() => openCancel(r)}
                                        title="Cancel Booking"
                                      />
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td
                                colSpan={9}
                                className="text-center py-4 text-muted"
                              >
                                No data available in table
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </Table>
                    </div>

                    {/* Pagination */}
                    <div className="d-flex justify-content-between align-items-center mt-3">
                      <div className="text-muted small">
                        Showing {displayStart} to {displayEnd} of{" "}
                        {filtered.length} entries
                      </div>
                      {totalPages > 1 && (
                        <Pagination className="mb-0">
                          <Pagination.Prev
                            disabled={safePage === 0}
                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                          />
                          {Array.from(
                            { length: Math.min(5, totalPages) },
                            (_, i) => {
                              let pageNum;
                              if (totalPages <= 5) pageNum = i;
                              else if (safePage <= 2) pageNum = i;
                              else if (safePage >= totalPages - 3)
                                pageNum = totalPages - 5 + i;
                              else pageNum = safePage - 2 + i;
                              return (
                                <Pagination.Item
                                  key={pageNum}
                                  active={pageNum === safePage}
                                  onClick={() => setPage(pageNum)}
                                >
                                  {pageNum + 1}
                                </Pagination.Item>
                              );
                            },
                          )}
                          <Pagination.Next
                            disabled={safePage + 1 >= totalPages}
                            onClick={() => setPage((p) => p + 1)}
                          />
                        </Pagination>
                      )}
                    </div>
                  </>
                )}
              </Card.Body>
            </Card>
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
