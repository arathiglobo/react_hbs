/**
 * MeetAndSpaceBookingList.jsx
 *
 * Booking-list page for the new Meet & Space feature. Visual shell
 * mirrors SeniorCitizenBookingList. View opens a booking-details modal
 * (cab-list style — sectioned, light-shade header). Voucher opens a
 * preview modal with a PDF iframe + email-to-recipient form.
 */
import React, { useEffect, useMemo, useState } from "react";
import {
  Container,
  Card,
  Table,
  Button,
  Spinner,
  Form,
  Modal,
  Row,
  Col,
  InputGroup,
  Pagination,
  Badge,
} from "react-bootstrap";
import {
  FaEye,
  FaTimesCircle,
  FaEdit,
  FaEnvelope,
  FaSearch,
  FaFileInvoice,
  FaTrashAlt,
} from "react-icons/fa";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../../components/AxiosInstance";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";

const PER_PAGE_OPTIONS = [10, 25, 50, 100];

// Map the local "bookingType" radio value to the backend's
// bookingStatus column so the filter row stays in sync with what the
// data actually holds.
const BOOKING_TYPE_TO_STATUS = {
  upcoming: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default function MeetAndSpaceBookingList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookingType, setBookingType] = useState("upcoming");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);

  // View modal (booking details — sectioned, cab-list style)
  const [viewing, setViewing] = useState(null);

  // Cancel modal
  const [showCancel, setShowCancel] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelSaving, setCancelSaving] = useState(false);

  // Voucher modal — iframe preview + email-to-recipient form
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [selectedVoucherBooking, setSelectedVoucherBooking] = useState(null);
  const [voucherPdfUrl, setVoucherPdfUrl] = useState("");
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherEmail, setVoucherEmail] = useState("");
  const [voucherEmailError, setVoucherEmailError] = useState("");
  const [voucherSending, setVoucherSending] = useState(false);

  const fetchVoucherPdf = async (bookingId) => {
    setVoucherLoading(true);
    setVoucherPdfUrl("");
    try {
      const res = await axiosInstance.get(
        `/api/meet-and-space/booking/${bookingId}/voucher`,
      );
      if (res.data && res.data.status === "SUCCESS" && res.data.pdfUrl) {
        setVoucherPdfUrl(res.data.pdfUrl);
      } else {
        toast.error(res.data?.message || "Failed to generate voucher PDF");
      }
    } catch (e) {
      console.error("Voucher fetch failed", e);
      toast.error(e?.response?.data?.message || "Failed to load voucher PDF");
    } finally {
      setVoucherLoading(false);
    }
  };

  const openVoucher = (row) => {
    setSelectedVoucherBooking(row);
    setShowVoucherModal(true);
    setVoucherEmail(row?.customer?.email || "");
    setVoucherEmailError("");
    fetchVoucherPdf(row.id);
  };

  const closeVoucher = () => {
    if (voucherSending) return;
    setShowVoucherModal(false);
    setSelectedVoucherBooking(null);
    setVoucherPdfUrl("");
    setVoucherEmail("");
    setVoucherEmailError("");
  };

  // Send the voucher PDF to the email typed into the modal. Backend
  // is expected to attach the PDF and send via SMTP. Mirrors the
  // restaurant / cab voucher-send pattern.
  const sendVoucherEmail = async () => {
    if (!selectedVoucherBooking) return;
    const email = (voucherEmail || "").trim();
    if (!email) {
      setVoucherEmailError("Email is required");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setVoucherEmailError("Please enter a valid email address");
      return;
    }
    setVoucherEmailError("");
    try {
      setVoucherSending(true);
      await axiosInstance.post(
        `/api/meet-and-space/booking/${selectedVoucherBooking.id}/voucher/send`,
        { email },
      );
      toast.success(`Voucher sent to ${email}`);
    } catch (e) {
      toast.error(
        e?.response?.data?.message || "Failed to send voucher email",
      );
    } finally {
      setVoucherSending(false);
    }
  };

  const fetchList = async () => {
    setLoading(true);
    try {
      const mapped = BOOKING_TYPE_TO_STATUS[bookingType];
      const url = mapped
        ? `/api/meet-and-space/booking/list?status=${encodeURIComponent(mapped)}`
        : "/api/meet-and-space/booking/list";
      const res = await axiosInstance.get(url);
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error("Load bookings failed", e);
      toast.error("Failed to load bookings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line
  }, [bookingType]);

  // Free-text search over the already-fetched page.
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => {
      const hay = [
        r.bookingNumber,
        r.meetingSpaceName,
        r.hotelName,
        r.customer
          ? `${r.customer.firstName || ""} ${r.customer.lastName || ""}`.trim()
          : "",
        r.customer?.mobile,
        r.customer?.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, search]);

  // Reset paging when filters change.
  useEffect(() => {
    setPage(0);
  }, [search, bookingType]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / size));
  const safePage = Math.min(page, totalPages - 1);
  const displayStart = filtered.length === 0 ? 0 : safePage * size + 1;
  const displayEnd = Math.min(filtered.length, (safePage + 1) * size);
  const paginated = filtered.slice(safePage * size, (safePage + 1) * size);

  const openView = async (row) => {
    // Refresh detail for the latest customer/payment/addons snapshot.
    try {
      const res = await axiosInstance.get(
        `/api/meet-and-space/booking/${row.id}`,
      );
      setViewing(res.data);
    } catch (e) {
      console.error("Load booking detail failed", e);
      toast.error("Failed to load booking");
    }
  };

  const handleCancelSubmit = async () => {
    if (!showCancel) return;
    setCancelSaving(true);
    try {
      await axiosInstance.put(
        `/api/meet-and-space/booking/${showCancel.id}/cancel`,
        { reason: cancelReason || "Cancelled by user" },
      );
      toast.success("Booking cancelled");
      setShowCancel(null);
      setCancelReason("");
      fetchList();
    } catch (e) {
      console.error("Cancel failed", e);
      toast.error("Failed to cancel booking");
    } finally {
      setCancelSaving(false);
    }
  };

  const statusBadge = (s) => {
    const v = (s || "").toLowerCase();
    if (v === "cancelled") return <Badge bg="danger">Cancelled</Badge>;
    if (v === "completed") return <Badge bg="info">Completed</Badge>;
    return <Badge bg="success">Confirmed</Badge>;
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
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
                <h4 className="mb-0 text-dark">Meet &amp; Space Bookings</h4>
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
                      <Table striped bordered hover className="mb-0">
                        <thead className="table-light">
                          <tr>
                            <th style={{ width: "60px" }}>S.N</th>
                            <th>Booking #</th>
                            <th>Space / Hotel</th>
                            <th>Customer</th>
                            <th>Date</th>
                            <th>Time</th>
                            <th>Attendees</th>
                            <th className="text-end">Total</th>
                            <th>Status</th>
                            <th style={{ width: "140px" }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginated.length > 0 ? (
                            paginated.map((r, i) => (
                              <tr key={r.id}>
                                <td>{safePage * size + i + 1}</td>
                                <td className="text-dark">
                                  {r.bookingNumber || "-"}
                                </td>
                                <td>
                                  <div>{r.meetingSpaceName || "-"}</div>
                                  <small className="text-muted">
                                    {r.hotelName || ""}
                                  </small>
                                </td>
                                <td>
                                  {r.customer
                                    ? `${r.customer.firstName || ""} ${r.customer.lastName || ""}`.trim() ||
                                      "—"
                                    : "—"}
                                  <div className="small text-muted">
                                    {r.customer?.mobile || ""}
                                  </div>
                                </td>
                                <td>{r.bookingDate || "-"}</td>
                                <td>
                                  {r.startTime} - {r.endTime}
                                  <div className="small text-muted">
                                    {r.durationHours}h
                                  </div>
                                </td>
                                <td>{r.attendees ?? "—"}</td>
                                <td className="text-end text-dark">
                                  {r.currency || "INR"}{" "}
                                  {Number(r.totalAmount || 0).toFixed(2)}
                                </td>
                                <td>{r.bookingStatus || "-"}</td>
                                <td>
                                  <div className="d-flex gap-3 align-items-center flex-wrap">
                                    <FaEye
                                      style={{
                                        cursor: "pointer",
                                        fontSize: "14px",
                                        color: "#007bff",
                                      }}
                                      onClick={() => openView(r)}
                                      title="View Details"
                                    />
                                    {r.bookingStatus !== "Cancelled" && (
                                      <FaEdit
                                        style={{
                                          cursor: "pointer",
                                          fontSize: "14px",
                                          color: "#f39c12",
                                        }}
                                        onClick={() =>
                                          navigate(
                                            `/booking-details/meet-and-space-booking-list/${r.id}/edit`,
                                          )
                                        }
                                        title="Edit Booking"
                                      />
                                    )}
                                    <FaEnvelope
                                      style={{
                                        cursor: "pointer",
                                        fontSize: "14px",
                                        color: "#198754",
                                      }}
                                      onClick={() => openVoucher(r)}
                                      title="Voucher / Confirmation"
                                    />
                                    {r.bookingStatus !== "Cancelled" && (
                                      <FaTrashAlt
                                        style={{
                                          cursor: "pointer",
                                          fontSize: "14px",
                                          color: "#dc3545",
                                        }}
                                        onClick={() => {
                                          setShowCancel(r);
                                          setCancelReason("");
                                        }}
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
                                colSpan={10}
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
                            onClick={() =>
                              setPage((p) => Math.max(0, p - 1))
                            }
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

      {/* ── Booking Details modal (cab-list style — sectioned, light shade) */}
      <Modal
        show={!!viewing}
        onHide={() => setViewing(null)}
        size="lg"
        centered
        scrollable
        backdrop="static"
        keyboard={false}
      >
        <Modal.Header
          closeButton
          className="border-bottom"
          style={{ backgroundColor: "#f1f3f5" }}
        >
          <Modal.Title className="d-flex align-items-center text-dark fw-semibold">
            <FaFileInvoice className="me-2 text-secondary" />
            Booking Details
            {viewing?.bookingNumber && (
              <Badge bg="light" text="dark" className="ms-3 fw-semibold border">
                {viewing.bookingNumber}
              </Badge>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="py-3 bg-white">
          {!viewing ? (
            <div className="text-center py-3 text-muted">
              No booking selected.
            </div>
          ) : (
            (() => {
              const KV = ({ label, value }) => (
                <Row className="g-0 py-2 border-bottom border-light-subtle">
                  <Col xs={5} md={4} className="text-muted">
                    {label}
                  </Col>
                  <Col xs={7} md={8} className="fw-semibold text-dark">
                    {value || "—"}
                  </Col>
                </Row>
              );
              const SectionHeader = ({ children }) => (
                <div
                  className="px-3 py-2 fw-semibold text-dark border rounded-top"
                  style={{ backgroundColor: "#f1f3f5" }}
                >
                  {children}
                </div>
              );
              const SectionBody = ({ children }) => (
                <div className="border border-top-0 rounded-bottom px-3 py-2 mb-3 bg-white">
                  {children}
                </div>
              );

              return (
                <>
                  {/* Booking & Event */}
                  <SectionHeader>Booking &amp; Event</SectionHeader>
                  <SectionBody>
                    <Row className="g-3">
                      <Col md={6}>
                        <KV label="Booking #" value={viewing.bookingNumber} />
                        <KV label="Space" value={viewing.meetingSpaceName} />
                        <KV label="Hotel" value={viewing.hotelName} />
                        <KV label="Date" value={viewing.bookingDate} />
                        <KV
                          label="Time"
                          value={
                            viewing.startTime
                              ? `${viewing.startTime} – ${viewing.endTime} (${viewing.durationHours}h)`
                              : "—"
                          }
                        />
                      </Col>
                      <Col md={6}>
                        <KV label="Event Type" value={viewing.eventType} />
                        <KV label="Layout" value={viewing.layout} />
                        <KV label="Attendees" value={viewing.attendees} />
                        <KV
                          label="Rate Plan"
                          value={
                            viewing.ratePlan
                              ? `${viewing.ratePlan} (${viewing.rateType})`
                              : "—"
                          }
                        />
                        <KV
                          label="Unit Rate"
                          value={
                            viewing.unitRate != null
                              ? `${viewing.currency || ""} ${Number(viewing.unitRate).toFixed(2)}`
                              : "—"
                          }
                        />
                        <KV
                          label="Status"
                          value={
                            <span
                              className={
                                viewing.bookingStatus === "Cancelled"
                                  ? "text-danger fw-bold"
                                  : "text-success fw-bold"
                              }
                            >
                              {viewing.bookingStatus || "-"}
                            </span>
                          }
                        />
                      </Col>
                      {viewing.requestedAmenities && (
                        <Col md={12}>
                          <KV
                            label="Requested Amenities"
                            value={viewing.requestedAmenities}
                          />
                        </Col>
                      )}
                      {viewing.additionalRequirements && (
                        <Col md={12}>
                          <KV
                            label="Notes"
                            value={viewing.additionalRequirements}
                          />
                        </Col>
                      )}
                    </Row>
                  </SectionBody>

                  {/* Customer */}
                  <SectionHeader>Customer</SectionHeader>
                  <SectionBody>
                    {viewing.customer ? (
                      <Row className="g-3">
                        <Col md={6}>
                          <KV
                            label="Name"
                            value={[
                              viewing.customer.salutation,
                              viewing.customer.firstName,
                              viewing.customer.lastName,
                            ]
                              .filter(Boolean)
                              .join(" ")}
                          />
                          <KV label="Mobile" value={viewing.customer.mobile} />
                          <KV label="Email" value={viewing.customer.email} />
                          <KV
                            label="Company"
                            value={
                              viewing.customer.companyName
                                ? `${viewing.customer.companyName}${viewing.customer.designation ? ` (${viewing.customer.designation})` : ""}`
                                : "—"
                            }
                          />
                          <KV label="GSTIN" value={viewing.customer.gstNumber} />
                        </Col>
                        <Col md={6}>
                          <KV
                            label="Address"
                            value={
                              [
                                viewing.customer.address,
                                viewing.customer.city,
                                viewing.customer.state,
                                viewing.customer.country,
                                viewing.customer.pincode,
                              ]
                                .filter(Boolean)
                                .join(", ") || "—"
                            }
                          />
                          <KV
                            label="ID"
                            value={
                              [
                                viewing.customer.idType,
                                viewing.customer.idNumber,
                              ]
                                .filter(Boolean)
                                .join(" ") || "—"
                            }
                          />
                          <KV label="Remarks" value={viewing.customer.remarks} />
                        </Col>
                      </Row>
                    ) : (
                      <em className="small text-muted">No customer record.</em>
                    )}
                  </SectionBody>

                  {/* Payment */}
                  <SectionHeader>Payment</SectionHeader>
                  <SectionBody>
                    {viewing.payment ? (
                      <Row className="g-3">
                        <Col md={6}>
                          <KV
                            label="Mode"
                            value={viewing.payment.paymentMode}
                          />
                          <KV
                            label="Status"
                            value={viewing.payment.paymentStatus}
                          />
                          <KV
                            label="Reference"
                            value={viewing.payment.transactionReference}
                          />
                        </Col>
                        <Col md={6}>
                          <KV
                            label="Amount Paid"
                            value={
                              viewing.payment.amountPaid != null
                                ? `${viewing.currency || ""} ${Number(viewing.payment.amountPaid).toFixed(2)}`
                                : "—"
                            }
                          />
                          <KV
                            label="Balance Due"
                            value={
                              viewing.payment.balanceDue != null
                                ? `${viewing.currency || ""} ${Number(viewing.payment.balanceDue).toFixed(2)}`
                                : "—"
                            }
                          />
                          <KV label="Notes" value={viewing.payment.notes} />
                        </Col>
                      </Row>
                    ) : (
                      <em className="small text-muted">No payment record.</em>
                    )}
                  </SectionBody>

                  {/* Add-ons */}
                  {viewing.addons && viewing.addons.length > 0 && (
                    <>
                      <SectionHeader>Add-ons</SectionHeader>
                      <div className="border border-top-0 rounded-bottom mb-3 bg-white">
                        <Table
                          size="sm"
                          hover
                          className="mb-0 align-middle"
                        >
                          <thead style={{ backgroundColor: "#f8f9fa" }}>
                            <tr>
                              <th>Item</th>
                              <th style={{ width: 80 }}>Qty</th>
                              <th style={{ width: 100 }}>Unit</th>
                              <th style={{ width: 100 }}>Total</th>
                              <th>Remarks</th>
                            </tr>
                          </thead>
                          <tbody>
                            {viewing.addons.map((a) => (
                              <tr key={a.id}>
                                <td>{a.addonName}</td>
                                <td>{a.quantity}</td>
                                <td>{Number(a.unitPrice || 0).toFixed(2)}</td>
                                <td>{Number(a.totalPrice || 0).toFixed(2)}</td>
                                <td>{a.remarks}</td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </div>
                    </>
                  )}

                  {/* Price Summary */}
                  <SectionHeader>Price Summary</SectionHeader>
                  <SectionBody>
                    <KV
                      label="Sub Total"
                      value={Number(viewing.subTotal || 0).toFixed(2)}
                    />
                    <KV
                      label="Add-ons"
                      value={Number(viewing.addonTotal || 0).toFixed(2)}
                    />
                    <KV
                      label={`Tax (${viewing.taxPercent || 0}%)`}
                      value={Number(viewing.taxAmount || 0).toFixed(2)}
                    />
                    <KV
                      label="Discount"
                      value={Number(viewing.discountAmount || 0).toFixed(2)}
                    />
                    <Row className="g-0 pt-2">
                      <Col xs={5} md={4} className="fw-semibold text-dark">
                        Total
                      </Col>
                      <Col
                        xs={7}
                        md={8}
                        className="fw-bold text-success fs-6"
                      >
                        {viewing.currency}{" "}
                        {Number(viewing.totalAmount || 0).toFixed(2)}
                      </Col>
                    </Row>
                  </SectionBody>

                  {/* Cancellation */}
                  {viewing.bookingStatus === "Cancelled" && (
                    <>
                      <SectionHeader>Cancellation</SectionHeader>
                      <SectionBody>
                        <KV
                          label="Reason"
                          value={viewing.cancellationReason}
                        />
                        <KV
                          label="Cancelled At"
                          value={viewing.cancelledAt}
                        />
                      </SectionBody>
                    </>
                  )}
                </>
              );
            })()
          )}
        </Modal.Body>
        <Modal.Footer style={{ backgroundColor: "#f8f9fa" }}>
          <Button variant="secondary" onClick={() => setViewing(null)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ── Voucher modal — iframe preview + email-send form ───── */}
      <Modal
        show={showVoucherModal}
        onHide={closeVoucher}
        size="xl"
        centered
        backdrop="static"
        keyboard={false}
      >
        <Modal.Header
          closeButton={!voucherSending}
          className="border-bottom"
          style={{ backgroundColor: "#f1f3f5" }}
        >
          <Modal.Title className="d-flex align-items-center text-dark fw-semibold">
            <FaFileInvoice className="me-2 text-secondary" />
            Voucher
            {selectedVoucherBooking?.bookingNumber && (
              <Badge
                bg="light"
                text="dark"
                className="ms-3 fw-semibold border"
              >
                {selectedVoucherBooking.bookingNumber}
              </Badge>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3 bg-white">
          {/* Email Voucher panel — sits above the PDF preview. */}
          <Card className="border shadow-none rounded-3 mb-3">
            <Card.Header
              className="py-2 fw-semibold text-dark d-flex align-items-center"
              style={{ backgroundColor: "#f1f3f5" }}
            >
              <FaEnvelope className="me-2 text-secondary" /> Email Voucher
            </Card.Header>
            <Card.Body className="p-3">
              <Row className="g-2 align-items-start">
                <Col md={8}>
                  <Form.Label className="small fw-semibold mb-1">
                    Recipient Email{" "}
                    <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    type="email"
                    placeholder="name@example.com"
                    value={voucherEmail}
                    onChange={(e) => {
                      setVoucherEmail(e.target.value);
                      if (voucherEmailError) setVoucherEmailError("");
                    }}
                    isInvalid={!!voucherEmailError}
                    disabled={voucherSending}
                  />
                  {voucherEmailError ? (
                    <div className="invalid-feedback d-block">
                      {voucherEmailError}
                    </div>
                  ) : (
                    <Form.Text className="text-muted">
                      The voucher PDF will be attached and sent to this address.
                    </Form.Text>
                  )}
                </Col>
                <Col md={4} className="d-flex flex-column gap-2 mt-md-4">
                  <Button
                    variant="dark"
                    onClick={sendVoucherEmail}
                    disabled={voucherSending || !voucherPdfUrl}
                  >
                    {voucherSending ? (
                      <>
                        <Spinner size="sm" className="me-2" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <FaEnvelope className="me-2" /> Send
                      </>
                    )}
                  </Button>
                  {voucherPdfUrl && (
                    <Button
                      variant="outline-secondary"
                      href={voucherPdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      disabled={voucherSending}
                    >
                      Open in New Tab
                    </Button>
                  )}
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {/* PDF preview below the email form. */}
          <Card className="border shadow-none rounded-3 overflow-hidden">
            <Card.Body className="p-0">
              {voucherLoading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" />
                  <div className="mt-2 small text-muted">
                    Generating voucher PDF…
                  </div>
                </div>
              ) : voucherPdfUrl ? (
                <iframe
                  title="Voucher PDF"
                  src={voucherPdfUrl}
                  style={{
                    width: "100%",
                    height: "65vh",
                    border: "none",
                    display: "block",
                  }}
                />
              ) : (
                <div className="text-muted text-center py-5">
                  No voucher available for this booking.
                </div>
              )}
            </Card.Body>
          </Card>
        </Modal.Body>
        <Modal.Footer
          className="border-top"
          style={{ backgroundColor: "#f8f9fa" }}
        >
          <Button
            variant="secondary"
            onClick={closeVoucher}
            disabled={voucherSending}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Cancel modal (unchanged behaviour, lightly trimmed) */}
      <Modal show={!!showCancel} onHide={() => setShowCancel(null)}>
        <Modal.Header closeButton>
          <Modal.Title>Cancel Booking</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Cancel booking <strong>{showCancel?.bookingNumber}</strong>?
          </p>
          <Form.Label>Reason</Form.Label>
          <Form.Control
            as="textarea"
            rows={3}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Optional reason for cancellation"
          />
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowCancel(null)}
            disabled={cancelSaving}
          >
            Keep Booking
          </Button>
          <Button
            variant="danger"
            onClick={handleCancelSubmit}
            disabled={cancelSaving}
          >
            {cancelSaving ? (
              <>
                <Spinner size="sm" animation="border" /> Cancelling...
              </>
            ) : (
              "Confirm Cancellation"
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
