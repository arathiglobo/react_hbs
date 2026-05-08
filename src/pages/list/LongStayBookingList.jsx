import React, { useEffect, useState } from "react";
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
} from "react-bootstrap";
import { FaEye, FaTimesCircle, FaFilePdf, FaPrint } from "react-icons/fa";
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

  const fetchBookings = async (p = 0) => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(`/api/longStayBooking?page=${p}&size=10`);
      setBookings(res.data.content || []);
      setTotalPages(res.data.totalPages || 0);
      setPage(res.data.number || 0);
    } catch {
      toast.error("Failed to load Long Stay bookings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings(0);
  }, []);

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
      fetchBookings(page);
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

  const handleVoucher = async (b) => {
    setShowVoucher(true);
    setVoucher(null);
    setVoucherLoading(true);
    try {
      const res = await axiosInstance.get(`/api/longStayBooking/${b.longStayBookingId}/voucher`);
      setVoucher(res.data);
    } catch {
      toast.error("Failed to load voucher");
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
        <div className="p-4">
          <h4 className="mb-3">Long Stay Bookings</h4>
          <Card>
            <Card.Body>
              <Table bordered hover responsive>
                <thead className="table-light">
                  <tr>
                    <th>S/N</th>
                    <th>Booking Code</th>
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
                      <td colSpan={9} className="text-center py-4">
                        <Spinner animation="border" variant="primary" />
                      </td>
                    </tr>
                  ) : bookings.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center text-muted py-4">
                        No Long Stay bookings yet
                      </td>
                    </tr>
                  ) : (
                    bookings.map((b, i) => (
                      <tr key={b.longStayBookingId}>
                        <td>{i + 1 + page * 10}</td>
                        <td>{b.bookingCode}</td>
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
                              <Button
                                size="sm"
                                variant="outline-danger"
                                title="Cancel booking"
                                onClick={() => handleCancel(b)}
                              >
                                <FaTimesCircle />
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
                      onClick={() => fetchBookings(i)}
                    >
                      {i + 1}
                    </Pagination.Item>
                  ))}
                </Pagination>
              )}
            </Card.Body>
          </Card>
        </div>
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
