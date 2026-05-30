import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  Table,
  Spinner,
  Badge,
  Button,
  Pagination,
  Modal,
  Row,
  Col,
  Container,
  Form,
  InputGroup,
} from "react-bootstrap";
import { FaEye, FaTrash, FaFilePdf, FaPrint, FaSearch } from "react-icons/fa";
import axiosInstance from "../../components/AxiosInstance";
import { formatDateTime } from "../../utils/dateUtils";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";

export default function LongStayBookingList() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [showDetail, setShowDetail] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [showVoucher, setShowVoucher] = useState(false);
  const [voucher, setVoucher] = useState(null);
  const [voucherLoading, setVoucherLoading] = useState(false);

  // Filters — mirrors /booking-details/24hr-booking-list (which
  // reuses HotelBookingList). All three are applied client-side over
  // the full list returned by /api/longStayBooking.
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all"); // all | upcoming | completed | cancelled
  const [selectedMonth, setSelectedMonth] = useState(""); // "" | 1..12
  const [selectedYear, setSelectedYear] = useState("");

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return [current - 1, current, current + 1, current + 2];
  }, []);

  // Fetch a large page so the three client-side filters (search /
  // status / month+year) can all run together. Backend pagination is
  // bypassed in favour of a single client-side window — same trade-off
  // HotelBookingList makes.
  const PAGE_SIZE = 10;

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(
        `/api/longStayBooking?page=0&size=500`
      );
      setBookings(res.data.content || []);
    } catch {
      toast.error("Failed to load Long Stay bookings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  // Apply search + status + time-period filters in one pass.
  const filteredBookings = useMemo(() => {
    const now = new Date();
    const needle = search.trim().toLowerCase();
    return (bookings || []).filter((b) => {
      // ── Status filter ──────────────────────────────────────────
      const isCancelled =
        b.bookingStatus === "CANCELLED" || b.cancelStatus === true;
      const checkIn = b.checkInDate ? new Date(b.checkInDate) : null;
      const checkOut = b.checkOutDate ? new Date(b.checkOutDate) : null;
      if (status === "cancelled" && !isCancelled) return false;
      if (status === "upcoming") {
        if (isCancelled) return false;
        if (!checkIn || checkIn < now) return false;
      }
      if (status === "completed") {
        if (isCancelled) return false;
        if (!checkOut || checkOut > now) return false;
      }

      // ── Time-period filter (uses check-in date) ────────────────
      if (checkIn && (selectedMonth || selectedYear)) {
        const m = checkIn.getMonth() + 1;
        const y = checkIn.getFullYear();
        if (selectedMonth && Number(selectedMonth) !== m) return false;
        if (selectedYear && Number(selectedYear) !== y) return false;
      }

      // ── Free-text search (booking code, guest, hotel, email) ───
      if (needle) {
        const hay = [
          b.bookingCode,
          b.primaryGuestName,
          b.primaryGuestEmail,
          b.hotelName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [bookings, search, status, selectedMonth, selectedYear]);

  // Reset to page 0 whenever a filter changes.
  useEffect(() => {
    setPage(0);
  }, [search, status, selectedMonth, selectedYear]);

  // Derive pagination from the filtered list (not from backend).
  const filteredTotalPages = Math.max(
    1,
    Math.ceil(filteredBookings.length / PAGE_SIZE)
  );
  const pageBookings = filteredBookings.slice(
    page * PAGE_SIZE,
    (page + 1) * PAGE_SIZE
  );
  // Keep the existing totalPages state in sync (used by the
  // Pagination block below, unchanged).
  useEffect(() => {
    setTotalPages(filteredTotalPages);
  }, [filteredTotalPages]);

  const handleCancel = async (b) => {
    const r = await Swal.fire({
      title: "Cancel booking?",
      text: `Cancel ${b.bookingCode} for ${b.primaryGuestName}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Yes, cancel",
    });
    if (!r.isConfirmed) return;
    try {
      await axiosInstance.post(`/api/longStayBooking/${b.longStayBookingId}/cancel`);
      toast.success("Booking cancelled");
      fetchBookings();
    } catch {
      toast.error("Cancel failed");
    }
  };

  const handleView = async (b) => {
    setShowDetail(true);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await axiosInstance.get(`/api/longStayBooking/${b.longStayBookingId}`);
      setDetail(res.data);
    } catch {
      toast.error("Failed to load booking details");
    } finally {
      setDetailLoading(false);
    }
  };

  // Voucher icon → fetch the generated voucher PDF URL from the
  // backend (LongStayBookingController#getPdf returns a
  // PdfGenerationResponseDTO with {status, message, pdfUrl}) and
  // open it in a new tab. Mirrors HotelBookingList's behaviour, so
  // the long-stay flow shows an actual PDF instead of the old
  // details-style HTML view.
  const handleVoucher = async (b) => {
    try {
      setVoucherLoading(true);
      const res = await axiosInstance.get(
        `/api/longStayBooking/${b.longStayBookingId}/pdf`,
        { params: { type: "VOUCHER" } }
      );
      if (res.data && res.data.status === "SUCCESS" && res.data.pdfUrl) {
        // Open in a new tab — browser will render the PDF inline
        // (and the user can save / print from there).
        window.open(res.data.pdfUrl, "_blank", "noopener,noreferrer");
        toast.success("Voucher opened in a new tab");
      } else {
        toast.error(res.data?.message || "Failed to generate voucher");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to generate voucher");
    } finally {
      setVoucherLoading(false);
    }
  };

  const handlePrintVoucher = () => {
    const node = document.getElementById("ls-voucher-content");
    if (!node) return;
    const w = window.open("", "_blank", "width=900,height=900");
    w.document.write(`
      <html>
        <head>
          <title>Voucher ${voucher?.bookingCode || ""}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #222; }
            h2 { color: #0d6efd; margin-bottom: 4px; }
            h5 { margin-top: 18px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; font-size: 13px; }
            .row-info { display: flex; flex-wrap: wrap; gap: 16px; }
            .row-info > div { flex: 1 1 220px; }
            .label { font-weight: 600; color: #555; font-size: 12px; }
            .value { font-size: 14px; }
            .total-box { background: #198754; color: #fff; padding: 12px; border-radius: 6px; text-align: center; margin-top: 12px; }
          </style>
        </head>
        <body>${node.innerHTML}</body>
      </html>
    `);
    w.document.close();
    w.focus();
    setTimeout(() => {
      w.print();
    }, 300);
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-3" style={{ width: "100%", overflow: "hidden" }}>
          <Container fluid className="px-0">
            {/* Header: Title + Search (left) | Time Period (right) —
                same shape as /booking-details/24hr-booking-list. */}
            <div className="d-flex justify-content-between align-items-end mb-3">
              <div>
                <h3 className="fw-bold text-dark mb-2">Long Stay Bookings</h3>
                <InputGroup style={{ height: "40px", width: "300px" }}>
                  <InputGroup.Text
                    style={{
                      backgroundColor: "#f8f9fa",
                      borderRight: "none",
                      borderColor: "#dee2e6",
                    }}
                  >
                    <FaSearch style={{ color: "#6c757d" }} />
                  </InputGroup.Text>
                  <Form.Control
                    type="text"
                    placeholder="Search here..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                      borderLeft: "none",
                      fontSize: "0.85rem",
                      borderColor: "#dee2e6",
                      height: "40px",
                    }}
                  />
                </InputGroup>
              </div>
              <Card
                className="shadow-sm border-0"
                style={{ borderRadius: "8px", minWidth: "260px" }}
              >
                <Card.Body className="p-3">
                  <h6
                    className="mb-2 fw-bold text-dark"
                    style={{ fontSize: "0.85rem", letterSpacing: "0.4px" }}
                  >
                    Time Period
                  </h6>
                  <Row className="g-2">
                    <Col xs={6}>
                      <Form.Select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        size="sm"
                        style={{ fontSize: "0.82rem", height: "45px" }}
                      >
                        <option value="">Month</option>
                        {months.map((month, index) => (
                          <option key={month} value={index + 1}>
                            {month.slice(0, 3)}
                          </option>
                        ))}
                      </Form.Select>
                    </Col>
                    <Col xs={6}>
                      <Form.Select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                        size="sm"
                        style={{ fontSize: "0.82rem", height: "45px" }}
                      >
                        <option value="">Year</option>
                        {years.map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </Form.Select>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            </div>

            {/* Booking Types radio bar — only the statuses long-stay
                bookings actually move through (CONFIRMED + cancelStatus).
                Mirrors the HotelBookingList layout. */}
            <Row className="mb-2 g-1">
              <Col xs={12}>
                <Card
                  className="shadow-sm border-0 w-100"
                  style={{ borderRadius: "8px" }}
                >
                  <Card.Body className="p-3">
                    <h6
                      className="mb-2 fw-bold text-dark"
                      style={{ fontSize: "0.85rem", letterSpacing: "0.4px" }}
                    >
                      Booking Types
                    </h6>
                    <div className="row g-2">
                      <div className="col-6 col-md-4 col-lg-2">
                        <Form.Check
                          type="radio"
                          label="All"
                          name="lsBookingType"
                          checked={status === "all"}
                          onChange={() => setStatus("all")}
                        />
                      </div>
                      <div className="col-6 col-md-4 col-lg-2">
                        <Form.Check
                          type="radio"
                          label="Upcoming"
                          name="lsBookingType"
                          checked={status === "upcoming"}
                          onChange={() => setStatus("upcoming")}
                        />
                      </div>
                      <div className="col-6 col-md-4 col-lg-2">
                        <Form.Check
                          type="radio"
                          label="Completed"
                          name="lsBookingType"
                          checked={status === "completed"}
                          onChange={() => setStatus("completed")}
                        />
                      </div>
                      <div className="col-6 col-md-4 col-lg-2">
                        <Form.Check
                          type="radio"
                          label="Cancelled"
                          name="lsBookingType"
                          checked={status === "cancelled"}
                          onChange={() => setStatus("cancelled")}
                        />
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            {/* Bookings Table */}
          <Card>
            <Card.Body>
              <Table bordered hover responsive>
                <thead className="table-light">
                  <tr>
                    <th>S/N</th>
                    <th>Booking Code</th>
                    <th>Booking Date</th>
                    <th>Hotel</th>
                    <th>Guest</th>
                    <th>Stay</th>
                    <th>Nights</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="text-center py-4">
                        <Spinner animation="border" variant="primary" />
                      </td>
                    </tr>
                  ) : pageBookings.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center text-muted py-4">
                        No Long Stay bookings found
                      </td>
                    </tr>
                  ) : (
                    pageBookings.map((b, i) => (
                      <tr key={b.longStayBookingId}>
                        <td>{i + 1 + page * PAGE_SIZE}</td>
                        <td>{b.bookingCode}</td>
                        <td>{formatDateTime(b.bookingDateTime)}</td>
                        <td>{b.hotelName}</td>
                        <td>
                          {b.primaryGuestName}
                          <br />
                          <small className="text-muted">{b.primaryGuestEmail}</small>
                        </td>
                        <td>
                          {formatDateTime(b.checkInDate)} → {formatDateTime(b.checkOutDate)}
                        </td>
                        <td>{b.totalNights}</td>
                        <td>{b.totalAmount}</td>
                        <td>
                          <Badge
                            bg={
                              b.bookingStatus === "CONFIRMED"
                                ? "success"
                                : b.bookingStatus === "CANCELLED"
                                ? "danger"
                                : "secondary"
                            }
                          >
                            {b.bookingStatus}
                          </Badge>
                        </td>
                        <td>
                          <div className="d-flex gap-2">
                            <Button
                              size="sm"
                              variant="outline-primary"
                              title="View details"
                              onClick={() => handleView(b)}
                            >
                              <FaEye />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline-success"
                              title="Voucher"
                              onClick={() => handleVoucher(b)}
                            >
                              <FaFilePdf />
                            </Button>
                            {b.bookingStatus !== "CANCELLED" && (
                              // Matches HotelBookingList's delete/cancel
                              // icon — FaTrash in red (#dc3545) with
                              // title "Delete". Same action (handleCancel)
                              // and same conditional visibility, just
                              // the icon style is unified.
                              <Button
                                size="sm"
                                variant="outline-danger"
                                title="Delete"
                                onClick={() => handleCancel(b)}
                              >
                                <FaTrash />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>

              {totalPages > 1 && (
                <Pagination className="justify-content-center">
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <Pagination.Item
                      key={i}
                      active={i === page}
                      onClick={() => setPage(i)}
                    >
                      {i + 1}
                    </Pagination.Item>
                  ))}
                </Pagination>
              )}
            </Card.Body>
          </Card>
          </Container>
        </main>
      </div>

      {/* Detail modal */}
      <Modal show={showDetail} onHide={() => setShowDetail(false)} size="lg" centered>
        <Modal.Header closeButton className="bg-primary text-white">
          <Modal.Title>Booking Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {detailLoading || !detail ? (
            <div className="text-center py-4">
              <Spinner animation="border" />
            </div>
          ) : (
            <>
              <Row className="mb-3">
                <Col md={6}>
                  <InfoRow label="Booking Code" value={detail.bookingCode} />
                  <InfoRow label="Status" value={detail.bookingStatus} />
                  <InfoRow
                    label="Cancel Status"
                    value={detail.cancelStatus ? "Cancelled" : "Active"}
                  />
                  <InfoRow label="Booked On" value={formatDateTime(detail.bookingDateTime)} />
                </Col>
                <Col md={6}>
                  <InfoRow label="Hotel" value={detail.hotelName} />
                  <InfoRow label="Check-In" value={formatDateTime(detail.checkInDate)} />
                  <InfoRow label="Check-Out" value={formatDateTime(detail.checkOutDate)} />
                  <InfoRow label="Total Nights" value={detail.totalNights} />
                </Col>
              </Row>
              <hr />
              <h6 className="fw-bold">Room & Rate Plan</h6>
              <Row className="mb-3">
                <Col md={6}>
                  <InfoRow label="Room Category" value={detail.roomCategoryName} />
                  <InfoRow label="Room Type" value={detail.roomTypeName} />
                  <InfoRow label="Occupancy" value={detail.occupancyTypeName} />
                </Col>
                <Col md={6}>
                  <InfoRow label="Meal Plan" value={detail.mealPlanName} />
                  <InfoRow label="Contract Rate Code" value={detail.contractRateCode} />
                  <InfoRow
                    label="Refundable"
                    value={detail.refundable ? "Flexible" : "Non-Refundable"}
                  />
                </Col>
              </Row>
              <hr />
              <h6 className="fw-bold">Pricing</h6>
              <Row>
                <Col md={6}>
                  <InfoRow label="Monthly Rate" value={detail.monthlyRate} />
                  <InfoRow label="Additional Rate" value={detail.additionalRate} />
                </Col>
                <Col md={6}>
                  <InfoRow label="Cost Type" value={detail.additionalCostType} />
                  <InfoRow label="Total Amount" value={detail.totalAmount} />
                </Col>
              </Row>
              <hr />
              <h6 className="fw-bold">Primary Guest</h6>
              {detail.primaryGuestDetails ? (
                <Row>
                  <Col md={6}>
                    <InfoRow
                      label="Name"
                      value={`${detail.primaryGuestDetails.salutation || ""} ${
                        detail.primaryGuestDetails.firstName || ""
                      } ${detail.primaryGuestDetails.middleName || ""} ${
                        detail.primaryGuestDetails.lastName || ""
                      }`.replace(/\s+/g, " ").trim()}
                    />
                    <InfoRow label="Email" value={detail.primaryGuestDetails.email} />
                    <InfoRow label="Phone" value={detail.primaryGuestDetails.phone} />
                  </Col>
                  <Col md={6}>
                    <InfoRow label="Passport No" value={detail.primaryGuestDetails.passportNo} />
                    <InfoRow label="Nationality" value={detail.primaryGuestDetails.nationality} />
                    <InfoRow label="Gender" value={detail.primaryGuestDetails.gender} />
                  </Col>
                </Row>
              ) : (
                <Row>
                  <Col md={6}>
                    <InfoRow label="Name" value={detail.primaryGuestName} />
                    <InfoRow label="Email" value={detail.primaryGuestEmail} />
                  </Col>
                  <Col md={6}>
                    <InfoRow label="Phone" value={detail.primaryGuestPhone} />
                    <InfoRow label="Nationality" value={detail.nationality} />
                  </Col>
                </Row>
              )}
              {detail.rooms && detail.rooms.length > 0 && (
                <>
                  <hr />
                  <h6 className="fw-bold">Passengers</h6>
                  {detail.rooms.map((room, idx) => (
                    <div key={idx} className="mb-3">
                      <strong>
                        Room {idx + 1} — {room.adults || 0} Adult
                        {(room.adults || 0) > 1 ? "s" : ""}
                        {(room.children || 0) > 0
                          ? `, ${room.children} Child${room.children > 1 ? "ren" : ""}`
                          : ""}
                      </strong>
                      <Table size="sm" bordered className="mt-2">
                        <thead className="table-light">
                          <tr>
                            <th>#</th>
                            <th>Salutation</th>
                            <th>First Name</th>
                            <th>Last Name</th>
                            <th>Gender</th>
                            <th>Type</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(room.guests || []).map((g, gi) => (
                            <tr key={gi}>
                              <td>{gi + 1}</td>
                              <td>{g.salutation || "-"}</td>
                              <td>{g.firstName || "-"}</td>
                              <td>{g.lastName || "-"}</td>
                              <td>{g.gender || "-"}</td>
                              <td>
                                {g.isChild
                                  ? `Child${g.childAge != null ? ` (${g.childAge}y)` : ""}`
                                  : "Adult"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                  ))}
                </>
              )}
              {detail.remarks && (
                <>
                  <hr />
                  <InfoRow label="Remarks" value={detail.remarks} />
                </>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDetail(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Voucher modal */}
      <Modal show={showVoucher} onHide={() => setShowVoucher(false)} size="lg" centered>
        <Modal.Header closeButton className="bg-success text-white">
          <Modal.Title>
            <FaFilePdf className="me-2" />
            Booking Voucher
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {voucherLoading || !voucher ? (
            <div className="text-center py-4">
              <Spinner animation="border" />
            </div>
          ) : (
            <div id="ls-voucher-content">
              <h2>Long Stay Booking Voucher</h2>
              <div className="text-muted small mb-3">
                Booking Code: <strong>{voucher.bookingCode}</strong> · Status:{" "}
                {voucher.bookingStatus}
              </div>
              <h5>Hotel & Stay</h5>
              <div className="row-info" style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                <div style={{ flex: "1 1 220px" }}>
                  <div className="label">Hotel</div>
                  <div className="value">{voucher.hotelName}</div>
                </div>
                <div style={{ flex: "1 1 220px" }}>
                  <div className="label">Check-In</div>
                  <div className="value">{formatDateTime(voucher.checkInDate)}</div>
                </div>
                <div style={{ flex: "1 1 220px" }}>
                  <div className="label">Check-Out</div>
                  <div className="value">{formatDateTime(voucher.checkOutDate)}</div>
                </div>
                <div style={{ flex: "1 1 220px" }}>
                  <div className="label">Total Nights</div>
                  <div className="value">{voucher.totalNights}</div>
                </div>
              </div>
              <h5>Room & Rate Plan</h5>
              <div className="row-info" style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                <div style={{ flex: "1 1 220px" }}>
                  <div className="label">Room Category</div>
                  <div className="value">{voucher.roomCategoryName || "-"}</div>
                </div>
                <div style={{ flex: "1 1 220px" }}>
                  <div className="label">Room Type</div>
                  <div className="value">{voucher.roomTypeName || "-"}</div>
                </div>
                <div style={{ flex: "1 1 220px" }}>
                  <div className="label">Occupancy</div>
                  <div className="value">{voucher.occupancyTypeName || "-"}</div>
                </div>
                <div style={{ flex: "1 1 220px" }}>
                  <div className="label">Meal Plan</div>
                  <div className="value">{voucher.mealPlanName || "-"}</div>
                </div>
                <div style={{ flex: "1 1 220px" }}>
                  <div className="label">Contract Rate Code</div>
                  <div className="value">{voucher.contractRateCode || "-"}</div>
                </div>
                <div style={{ flex: "1 1 220px" }}>
                  <div className="label">Refundable</div>
                  <div className="value">
                    {voucher.refundable ? "Flexible" : "Non-Refundable"}
                  </div>
                </div>
              </div>
              <h5>Primary Guest</h5>
              <div className="row-info" style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                <div style={{ flex: "1 1 220px" }}>
                  <div className="label">Name</div>
                  <div className="value">
                    {voucher.primaryGuestDetails
                      ? `${voucher.primaryGuestDetails.salutation || ""} ${
                          voucher.primaryGuestDetails.firstName || ""
                        } ${voucher.primaryGuestDetails.lastName || ""}`
                          .replace(/\s+/g, " ")
                          .trim()
                      : voucher.primaryGuestName}
                  </div>
                </div>
                <div style={{ flex: "1 1 220px" }}>
                  <div className="label">Email</div>
                  <div className="value">{voucher.primaryGuestEmail}</div>
                </div>
                <div style={{ flex: "1 1 220px" }}>
                  <div className="label">Phone</div>
                  <div className="value">{voucher.primaryGuestPhone}</div>
                </div>
                <div style={{ flex: "1 1 220px" }}>
                  <div className="label">Nationality</div>
                  <div className="value">{voucher.nationality || "-"}</div>
                </div>
              </div>
              {voucher.rooms && voucher.rooms.length > 0 && (
                <>
                  <h5>Guests</h5>
                  {voucher.rooms.map((room, idx) => (
                    <div key={idx} style={{ marginBottom: 12 }}>
                      <strong>
                        Room {idx + 1} — {room.adults || 0} Adult
                        {(room.adults || 0) > 1 ? "s" : ""}
                        {(room.children || 0) > 0
                          ? `, ${room.children} Child${room.children > 1 ? "ren" : ""}`
                          : ""}
                      </strong>
                      <table>
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Salutation</th>
                            <th>Name</th>
                            <th>Type</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(room.guests || []).map((g, gi) => (
                            <tr key={gi}>
                              <td>{gi + 1}</td>
                              <td>{g.salutation || "-"}</td>
                              <td>
                                {g.firstName || ""} {g.lastName || ""}
                              </td>
                              <td>
                                {g.isChild
                                  ? `Child${g.childAge != null ? ` (${g.childAge}y)` : ""}`
                                  : "Adult"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </>
              )}
              <div
                className="total-box"
                style={{
                  background: "#198754",
                  color: "#fff",
                  padding: 12,
                  borderRadius: 6,
                  textAlign: "center",
                  marginTop: 12,
                }}
              >
                <h6 style={{ margin: 0 }}>Total Amount</h6>
                <h4 style={{ margin: 0 }}>
                  {voucher.totalAmount != null ? Number(voucher.totalAmount).toFixed(2) : "—"}
                </h4>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowVoucher(false)}>
            Close
          </Button>
          <Button variant="success" onClick={handlePrintVoucher} disabled={!voucher}>
            <FaPrint className="me-2" /> Print / Save as PDF
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="mb-2">
      <small className="text-muted d-block">{label}</small>
      <span className="fw-semibold">{value || "-"}</span>
    </div>
  );
}
