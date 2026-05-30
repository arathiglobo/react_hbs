import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  Form,
  Row,
  Col,
  Table,
  Badge,
  InputGroup,
  Spinner,
  Pagination,
  Button,
  Modal,
} from "react-bootstrap";
import {
  FaSearch,
  FaCalendarAlt,
  FaUtensils,
  FaEye,
  FaTimes,
  FaEdit,
  FaFileInvoice,
  FaSyncAlt,
  FaRupeeSign,
  FaDownload,
  FaEnvelope,
  FaPrint,
  FaCommentDots,
} from "react-icons/fa";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";

/** Status options surfaced in the update-status modal. */
const BOOKING_STATUS_OPTIONS = [
  "Pending Approval",
  "Confirmed",
  "Completed",
  "Cancelled",
];
const PAYMENT_STATUS_OPTIONS = [
  "Not Paid",
  "Partially Paid",
  "Paid",
  "Refunded",
];

const PER_PAGE = 10;

const RestaurantBookingList = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  // The booking that's having its status / rate edited via the modal.
  // We keep a single modal so the operator can flip status + set price
  // in one round-trip. Opening with `focus: "rate"` jumps the price
  // field into view when launched from the Edit Price button.
  const [statusEditing, setStatusEditing] = useState(null);
  const [statusForm, setStatusForm] = useState({
    bookingStatus: "",
    paymentStatus: "",
    totalAmount: "",
    note: "",
  });
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusFocus, setStatusFocus] = useState("status"); // "status" | "rate"

  // Remark-viewer modal — opens when the operator clicks the new
  // comment icon on a row. Read-only; the restaurant-extranet user
  // controls the remark text from their dashboard's Reservations
  // page, and the admin list just surfaces whatever was saved.
  const [remarkBooking, setRemarkBooking] = useState(null);

  // Voucher modal — opened from the FaFileInvoice action button.
  // `voucherBooking` is the booking the modal is showing; null = closed.
  // `voucherEmail` pre-fills the send-email input from the customer record.
  // `voucherSending` blocks the buttons while the email API call runs.
  const [voucherBooking, setVoucherBooking] = useState(null);
  const [voucherEmail, setVoucherEmail] = useState("");
  const [voucherSending, setVoucherSending] = useState(false);
  const [voucherDownloading, setVoucherDownloading] = useState(false);

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/api/restaurant/booking/list");
      const data = Array.isArray(res.data) ? res.data : res.data?.content || [];
      setItems(data);
    } catch (e) {
      console.error(e);
      setItems(demoBookings);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  const filtered = useMemo(() => {
    return items.filter((b) => {
      const q = search.toLowerCase();
      const matchQ =
        !q ||
        b.bookingNumber?.toLowerCase().includes(q) ||
        b.restaurantName?.toLowerCase().includes(q) ||
        b.customerName?.toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || b.bookingStatus === statusFilter;
      return matchQ && matchStatus;
    });
  }, [items, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const pageData = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  /** Edit → reopen the booking page with the saved fields pre-loaded.
   *  Useful for fixing customer details / menu before approval. */
  const handleEdit = (b) => {
    // The booking page already restores from `incoming.restaurant` + the
    // bookingDate/time/members it gets via location.state — pass the same
    // shape so the UI rehydrates correctly.
    navigate("/new-booking/restaurant/booking", {
      state: {
        restaurant: {
          id: b.restaurantId,
          restaurantName: b.restaurantName,
          taxPercent: b.taxPercent,
          bookingModes: "Both",
          advanceBookingMinHours: 0,
          images: [],
        },
        bookingDate: b.bookingDate,
        bookingTime: b.bookingTime,
        memberCount: b.memberCount,
        agentId: b.agentId,
        agentName: b.agentName,
        editingBookingId: b.id,
      },
    });
  };

  /** Voucher button → open the voucher modal with the booking pre-loaded.
   *  The modal renders a preview, plus Download (PDF) and Send (email)
   *  actions wired to the backend voucher endpoints. */
  const handleVoucher = (b) => {
    setVoucherBooking(b);
    setVoucherEmail(b.customerEmail || b.email || "");
  };

  /** Download voucher as PDF. Hits the backend voucher endpoint with
   *  `responseType: blob` so the browser saves the binary instead of
   *  parsing it as JSON. Falls back to a JSON-derived blob if the
   *  endpoint returns metadata only (stub backend). */
  const downloadVoucher = async () => {
    if (!voucherBooking) return;
    setVoucherDownloading(true);
    try {
      const res = await axiosInstance.get(
        `/api/restaurant/booking/${voucherBooking.id}/voucher`,
        { responseType: "blob" }
      );
      // Detect whether the server returned a real PDF or a JSON stub.
      const ct = res.headers?.["content-type"] || "";
      const filename = `voucher-${voucherBooking.bookingNumber || voucherBooking.id}.${
        ct.includes("pdf") ? "pdf" : "json"
      }`;
      const blob = new Blob([res.data], {
        type: ct || "application/octet-stream",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Voucher downloaded");
    } catch (e) {
      toast.error(
        e?.response?.data?.message || "Failed to download voucher"
      );
    } finally {
      setVoucherDownloading(false);
    }
  };

  /** Send voucher via email. Backend is expected to email the PDF to the
   *  given address; we pass the booking id + recipient. */
  const sendVoucherEmail = async () => {
    if (!voucherBooking) return;
    if (!voucherEmail || !/\S+@\S+\.\S+/.test(voucherEmail)) {
      toast.error("Enter a valid email address");
      return;
    }
    setVoucherSending(true);
    try {
      await axiosInstance.post(
        `/api/restaurant/booking/${voucherBooking.id}/voucher/send`,
        { email: voucherEmail }
      );
      toast.success(`Voucher sent to ${voucherEmail}`);
    } catch (e) {
      toast.error(
        e?.response?.data?.message || "Failed to send voucher email"
      );
    } finally {
      setVoucherSending(false);
    }
  };

  /** Print the voucher preview (browser-native — opens the print dialog
   *  scoped to the voucher card). */
  const printVoucher = () => {
    const node = document.getElementById("voucher-print-area");
    if (!node) return;
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) return;
    w.document.write(`
      <html><head><title>Voucher</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 24px; color: #1f2937; }
        h2 { margin-top: 0; }
        .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #e5e7eb; }
        .label { color: #6b7280; }
        .total { font-size: 1.2rem; font-weight: 700; margin-top: 12px; }
        .muted { color: #6b7280; font-style: italic; }
        .header { border-bottom: 2px solid #6366f1; padding-bottom: 8px; margin-bottom: 16px; }
      </style></head>
      <body>${node.innerHTML}</body></html>
    `);
    w.document.close();
    w.focus();
    w.print();
  };

  /** Open the status edit modal with the booking's current values.
   *  `focus` controls which subsection auto-scrolls in: "status" for
   *  the status badge / FaSyncAlt button, "rate" for the FaRupeeSign
   *  "Edit Price" button. */
  const openStatusEdit = (b, focus = "status") => {
    setStatusEditing(b);
    setStatusForm({
      bookingStatus: b.bookingStatus || "Pending Approval",
      paymentStatus: b.paymentStatus || "Not Paid",
      // Price set later by the operator (the booking page no longer
      // collects it). Existing bookings might already have one — load it.
      totalAmount:
        b.totalAmount != null && b.totalAmount !== ""
          ? String(b.totalAmount)
          : "",
      note: "",
    });
    setStatusFocus(focus);
  };

  /** PUT /api/restaurant/booking/{id}/status with the new values.
   *  Includes `totalAmount` so the same call updates the rate too.
   *  If the backend has a dedicated rate endpoint we fall back to it. */
  const submitStatus = async () => {
    if (!statusEditing) return;
    // Validate rate if provided.
    if (
      statusForm.totalAmount !== "" &&
      (isNaN(Number(statusForm.totalAmount)) || Number(statusForm.totalAmount) < 0)
    ) {
      toast.error("Price must be a positive number");
      return;
    }
    setStatusSaving(true);
    try {
      const payload = {
        ...statusForm,
        totalAmount:
          statusForm.totalAmount === "" ? null : Number(statusForm.totalAmount),
      };
      try {
        await axiosInstance.put(
          `/api/restaurant/booking/${statusEditing.id}/status`,
          payload
        );
      } catch (firstErr) {
        // Best-effort fallback: if the server doesn't accept the rate on
        // the status endpoint, push the rate separately.
        if (payload.totalAmount != null) {
          await axiosInstance.put(
            `/api/restaurant/booking/${statusEditing.id}/rate`,
            { totalAmount: payload.totalAmount }
          );
          // re-try the status update without the rate
          const { totalAmount, ...rest } = payload;
          await axiosInstance.put(
            `/api/restaurant/booking/${statusEditing.id}/status`,
            rest
          );
        } else {
          throw firstErr;
        }
      }
      toast.success("Booking updated");
      setStatusEditing(null);
      fetchList();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to update booking");
    } finally {
      setStatusSaving(false);
    }
  };

  const handleCancel = async (b) => {
    const conf = await Swal.fire({
      icon: "warning",
      title: "Cancel this booking?",
      text: `Booking ${b.bookingNumber}`,
      showCancelButton: true,
      confirmButtonColor: "#d33",
    });
    if (!conf.isConfirmed) return;
    try {
      await axiosInstance.put(`/api/restaurant/booking/${b.id}/cancel`);
      toast.success("Booking cancelled");
      fetchList();
    } catch (e) {
      toast.error("Failed to cancel");
    }
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1" style={{ minWidth: 0, overflowX: "hidden" }}>
        <div className="p-3 p-md-4" style={{ background: "#f5f7fb", minHeight: "calc(100vh - 60px)" }}>
          <Card className="shadow-sm">
            <Card.Header className="bg-white">
              <h5 className="mb-0">
                <FaUtensils className="me-2 text-warning" />
                Restaurant Bookings
              </h5>
            </Card.Header>
            <Card.Body>
              <Row className="mb-3 g-2">
                <Col md={4}>
                  <InputGroup>
                    <InputGroup.Text>
                      <FaSearch />
                    </InputGroup.Text>
                    <Form.Control
                      placeholder="Search by booking #, restaurant, customer"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                      }}
                    />
                  </InputGroup>
                </Col>
                <Col md={3}>
                  <Form.Select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="all">All Statuses</option>
                    <option value="Pending Approval">Pending Approval</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </Form.Select>
                </Col>
              </Row>

              {loading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" />
                </div>
              ) : pageData.length === 0 ? (
                <div className="text-center py-5 text-muted">No bookings found.</div>
              ) : (
                <Table responsive hover bordered className="align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>#</th>
                      <th>Booking #</th>
                      <th>Restaurant</th>
                      <th>
                        <FaCalendarAlt className="me-1" />
                        Date / Time
                      </th>
                      <th>Members</th>
                      <th>Customer</th>
                      <th>Mobile</th>
                      {/* "Total" + "Payment" columns hidden for now — code
                          preserved here in case ops re-introduces the
                          cash-flow workflow later. */}
                      {/* <th>Total</th> */}
                      <th>Status</th>
                      {/* <th>Payment</th> */}
                      <th style={{ width: 200 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageData.map((b, i) => (
                      <tr key={b.id || i}>
                        <td>{(page - 1) * PER_PAGE + i + 1}</td>
                        <td className="fw-semibold">{b.bookingNumber}</td>
                        <td>{b.restaurantName}</td>
                        <td>
                          {b.bookingDate} <br />
                          <small className="text-muted">{b.bookingTime}</small>
                        </td>
                        <td>{b.memberCount}</td>
                        <td>{b.customerName}</td>
                        <td>{b.mobile}</td>
                        {/* Total + Payment cells hidden for now — see the
                            matching header comment block above. */}
                        {/*
                        <td>
                          {b.totalAmount != null && Number(b.totalAmount) > 0 ? (
                            <span className="fw-semibold">
                              ₹ {Number(b.totalAmount).toFixed(2)}
                            </span>
                          ) : (
                            <Badge
                              bg="light"
                              text="warning"
                              className="border border-warning"
                              style={{ cursor: "pointer" }}
                              onClick={() => openStatusEdit(b, "rate")}
                              title="Click to add price"
                            >
                              + Add price
                            </Badge>
                          )}
                        </td>
                        */}
                        <td>
                          {/* Status badge is now read-only — restaurant
                              managers control booking status from the
                              extranet dashboard. The admin booking-list
                              just surfaces the latest value. */}
                          <Badge bg={statusVariant(b.bookingStatus)}>
                            {b.bookingStatus}
                          </Badge>
                        </td>
                        {/*
                        <td>
                          <Badge bg={paymentVariant(b.paymentStatus)}>
                            {b.paymentStatus || "Not Paid"}
                          </Badge>
                        </td>
                        */}
                        <td>
                          {/* View */}
                          <Button
                            size="sm"
                            variant="outline-info"
                            className="me-1"
                            onClick={() => setSelected(b)}
                            title="View"
                          >
                            <FaEye />
                          </Button>
                          {/* Edit — only sensible before the restaurant
                              confirms / completes. */}
                          {b.bookingStatus !== "Cancelled" && b.bookingStatus !== "Completed" && (
                            <Button
                              size="sm"
                              variant="outline-primary"
                              className="me-1"
                              onClick={() => handleEdit(b)}
                              title="Edit"
                            >
                              <FaEdit />
                            </Button>
                          )}
                          {/* Update-Status + Add-Price actions hidden
                              for now — restaurant managers drive status
                              changes from the extranet portal, and pricing
                              is on hold. Code preserved for re-enablement
                              when the cash-flow workflow returns. */}
                          {/*
                          <Button
                            size="sm"
                            variant="outline-warning"
                            className="me-1"
                            onClick={() => openStatusEdit(b, "status")}
                            title="Update Status"
                          >
                            <FaSyncAlt />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline-secondary"
                            className="me-1"
                            onClick={() => openStatusEdit(b, "rate")}
                            title={b.totalAmount ? "Update Price" : "Add Price"}
                          >
                            <FaRupeeSign />
                          </Button>
                          */}
                          {/* Remark viewer — shows whatever note the
                              restaurant manager left on the booking from
                              their extranet dashboard, plus the cancellation
                              reason if any. Read-only here. */}
                          <Button
                            size="sm"
                            variant="outline-info"
                            className="me-1"
                            onClick={() => setRemarkBooking(b)}
                            title={
                              b.restaurantRemark || b.cancellationReason
                                ? "View remark"
                                : "No remark yet"
                            }
                            style={{
                              opacity:
                                b.restaurantRemark || b.cancellationReason ? 1 : 0.55,
                            }}
                          >
                            <FaCommentDots />
                          </Button>
                          {/* Voucher */}
                          <Button
                            size="sm"
                            variant="outline-success"
                            className="me-1"
                            onClick={() => handleVoucher(b)}
                            title="Voucher"
                          >
                            <FaFileInvoice />
                          </Button>
                          {/* Cancel */}
                          {b.bookingStatus !== "Cancelled" && b.bookingStatus !== "Completed" && (
                            <Button
                              size="sm"
                              variant="outline-danger"
                              onClick={() => handleCancel(b)}
                              title="Cancel"
                            >
                              <FaTimes />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}

              {totalPages > 1 && (
                <div className="d-flex justify-content-end">
                  <Pagination size="sm" className="mb-0">
                    <Pagination.Prev disabled={page === 1} onClick={() => setPage(page - 1)} />
                    {Array.from({ length: totalPages }).map((_, i) => (
                      <Pagination.Item key={i} active={page === i + 1} onClick={() => setPage(i + 1)}>
                        {i + 1}
                      </Pagination.Item>
                    ))}
                    <Pagination.Next
                      disabled={page === totalPages}
                      onClick={() => setPage(page + 1)}
                    />
                  </Pagination>
                </div>
              )}
            </Card.Body>
          </Card>
        </div>
        </main>
      </div>

      <Modal show={!!selected} onHide={() => setSelected(null)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Booking Details - {selected?.bookingNumber}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selected && (
            <>
              <Row className="g-2">
                <Col md={6}>
                  <strong>Restaurant:</strong> {selected.restaurantName}
                </Col>
                <Col md={6}>
                  <strong>Date / Time:</strong> {selected.bookingDate} {selected.bookingTime}
                </Col>
                <Col md={6}>
                  <strong>Members:</strong> {selected.memberCount}
                </Col>
                <Col md={6}>
                  <strong>Customer:</strong> {selected.customerName} ({selected.mobile})
                </Col>
                <Col md={6}>
                  <strong>Agent:</strong> {selected.agentName || "-"}
                </Col>
                <Col md={6}>
                  <strong>Status:</strong>{" "}
                  <Badge bg={statusVariant(selected.bookingStatus)}>{selected.bookingStatus}</Badge>
                </Col>
                <Col md={12}>
                  <strong>Special Request:</strong> {selected.specialRequest || "-"}
                </Col>
              </Row>
              {Array.isArray(selected.items) && selected.items.length > 0 && (
                <Table className="mt-3" size="sm" bordered>
                  <thead className="table-light">
                    <tr>
                      <th>Item</th>
                      <th>Qty</th>
                      <th>Price</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.items.map((it, i) => (
                      <tr key={i}>
                        <td>{it.menuName}</td>
                        <td>{it.qty}</td>
                        <td>₹ {Number(it.price).toFixed(2)}</td>
                        <td>₹ {Number(it.total).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
              <div className="text-end mt-2">
                {selected.totalAmount != null && Number(selected.totalAmount) > 0 ? (
                  <strong>
                    Grand Total: ₹ {Number(selected.totalAmount).toFixed(2)}
                  </strong>
                ) : (
                  <span className="text-muted fst-italic">
                    Price not set yet — add it from the bookings list.
                  </span>
                )}
              </div>
            </>
          )}
        </Modal.Body>
      </Modal>

      {/* Status + Rate update modal — booking + payment status, total
          amount, and a free-form note. One submit pushes all three. */}
      <Modal
        show={!!statusEditing}
        onHide={() => setStatusEditing(null)}
        centered
        backdrop="static"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {statusFocus === "rate" ? "Update Price" : "Update Booking"}
            {" — "}
            {statusEditing?.bookingNumber}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Row className="g-3">
            <Col md={6}>
              <Form.Label>Booking Status</Form.Label>
              <Form.Select
                value={statusForm.bookingStatus}
                onChange={(e) =>
                  setStatusForm((p) => ({ ...p, bookingStatus: e.target.value }))
                }
              >
                {BOOKING_STATUS_OPTIONS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Form.Select>
            </Col>
            <Col md={6}>
              <Form.Label>Payment Status</Form.Label>
              <Form.Select
                value={statusForm.paymentStatus}
                onChange={(e) =>
                  setStatusForm((p) => ({ ...p, paymentStatus: e.target.value }))
                }
              >
                {PAYMENT_STATUS_OPTIONS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Form.Select>
            </Col>
            <Col md={12}>
              <Form.Label className="d-flex align-items-center">
                <FaRupeeSign className="me-1 text-success" />
                Total Amount (Price)
                {statusFocus === "rate" && (
                  <Badge bg="warning" text="dark" className="ms-2">
                    Focus
                  </Badge>
                )}
              </Form.Label>
              <InputGroup>
                <InputGroup.Text>₹</InputGroup.Text>
                <Form.Control
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="e.g. 1500.00"
                  autoFocus={statusFocus === "rate"}
                  value={statusForm.totalAmount}
                  onChange={(e) =>
                    setStatusForm((p) => ({ ...p, totalAmount: e.target.value }))
                  }
                />
              </InputGroup>
              <Form.Text muted>
                Booking page no longer collects a price — add or update
                it here once the restaurant confirms.
              </Form.Text>
            </Col>
            <Col md={12}>
              <Form.Label>Note (optional)</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={statusForm.note}
                onChange={(e) =>
                  setStatusForm((p) => ({ ...p, note: e.target.value }))
                }
                placeholder="e.g. Restaurant confirmed slot at 8 PM"
              />
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setStatusEditing(null)}
            disabled={statusSaving}
          >
            Close
          </Button>
          <Button variant="primary" onClick={submitStatus} disabled={statusSaving}>
            {statusSaving ? "Saving..." : "Save"}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ── Voucher view modal ──
          Shows a printable voucher preview for the selected booking,
          plus three actions:
            • Download — pulls the PDF from the backend voucher endpoint.
            • Print    — opens the browser print dialog scoped to the
                         preview card (great for in-house copies).
            • Send     — emails the voucher to the typed recipient. */}
      <Modal
        show={!!voucherBooking}
        onHide={() => !voucherSending && setVoucherBooking(null)}
        size="lg"
        centered
      >
        <Modal.Header closeButton={!voucherSending}>
          <Modal.Title>
            <FaFileInvoice className="me-2 text-success" />
            Voucher — {voucherBooking?.bookingNumber}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {voucherBooking && (
            <div
              id="voucher-print-area"
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 20,
                background: "#fff",
              }}
            >
              <div className="header d-flex justify-content-between align-items-start">
                <div>
                  <h2 className="m-0" style={{ fontSize: "1.4rem" }}>
                    Restaurant Booking Voucher
                  </h2>
                  <div className="text-muted small">
                    Booking #{voucherBooking.bookingNumber}
                  </div>
                </div>
                <Badge
                  bg={statusVariant(voucherBooking.bookingStatus)}
                  className="px-3 py-2"
                >
                  {voucherBooking.bookingStatus || "Pending Approval"}
                </Badge>
              </div>

              <div className="mt-3">
                <div className="row">
                  <span className="label">Restaurant</span>
                  <span className="fw-semibold">{voucherBooking.restaurantName}</span>
                </div>
                <div className="row">
                  <span className="label">Date / Time</span>
                  <span className="fw-semibold">
                    {voucherBooking.bookingDate}
                    {voucherBooking.bookingTime ? ` · ${voucherBooking.bookingTime}` : ""}
                  </span>
                </div>
                <div className="row">
                  <span className="label">Members</span>
                  <span className="fw-semibold">{voucherBooking.memberCount}</span>
                </div>
                <div className="row">
                  <span className="label">Customer</span>
                  <span className="fw-semibold">
                    {voucherBooking.customerName}
                    {voucherBooking.mobile ? ` · ${voucherBooking.mobile}` : ""}
                  </span>
                </div>
                <div className="row">
                  <span className="label">Agent</span>
                  <span className="fw-semibold">{voucherBooking.agentName || "—"}</span>
                </div>
                <div className="row">
                  <span className="label">Meal / Seating</span>
                  <span className="fw-semibold">
                    {voucherBooking.mealType || "—"} ·{" "}
                    {voucherBooking.seatingPreference || "—"}
                  </span>
                </div>
                {voucherBooking.specialRequest && (
                  <div className="row">
                    <span className="label">Special Request</span>
                    <span className="fw-semibold">{voucherBooking.specialRequest}</span>
                  </div>
                )}
              </div>

              <div className="total text-end mt-3">
                {voucherBooking.totalAmount != null &&
                Number(voucherBooking.totalAmount) > 0 ? (
                  <>Total: ₹ {Number(voucherBooking.totalAmount).toFixed(2)}</>
                ) : (
                  <span className="muted" style={{ fontSize: "0.9rem" }}>
                    Price not set yet — add it from the bookings list.
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Send-voucher email input */}
          <div className="mt-3">
            <Form.Label className="fw-semibold">
              <FaEnvelope className="me-1 text-primary" />
              Send voucher to
            </Form.Label>
            <InputGroup>
              <Form.Control
                type="email"
                placeholder="customer@example.com"
                value={voucherEmail}
                onChange={(e) => setVoucherEmail(e.target.value)}
                disabled={voucherSending}
              />
              <Button
                variant="primary"
                onClick={sendVoucherEmail}
                disabled={voucherSending || !voucherEmail}
              >
                {voucherSending ? (
                  <>
                    <Spinner size="sm" animation="border" className="me-1" />
                    Sending…
                  </>
                ) : (
                  <>
                    <FaEnvelope className="me-1" />
                    Send
                  </>
                )}
              </Button>
            </InputGroup>
            <Form.Text muted>
              Sends the voucher PDF to this email address.
            </Form.Text>
          </div>
        </Modal.Body>
        <Modal.Footer className="d-flex justify-content-between">
          <Button
            variant="outline-secondary"
            onClick={printVoucher}
            disabled={voucherSending || voucherDownloading}
          >
            <FaPrint className="me-1" /> Print
          </Button>
          <div className="d-flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setVoucherBooking(null)}
              disabled={voucherSending || voucherDownloading}
            >
              Close
            </Button>
            <Button
              variant="success"
              onClick={downloadVoucher}
              disabled={voucherSending || voucherDownloading}
            >
              {voucherDownloading ? (
                <>
                  <Spinner size="sm" animation="border" className="me-1" />
                  Downloading…
                </>
              ) : (
                <>
                  <FaDownload className="me-1" /> Download PDF
                </>
              )}
            </Button>
          </div>
        </Modal.Footer>
      </Modal>

      {/* ──────────────────────────────────────────────────────────
          Restaurant-remark viewer modal
          ────────────────────────────────────────────────────────────
          Read-only display of whatever the restaurant manager left
          on this booking from the extranet portal. We surface BOTH
          the restaurantRemark (free-form notes / appended history)
          and the cancellationReason (used when rejecting / cancelling)
          since either field can carry context the operator wants to see.
          ────────────────────────────────────────────────────────── */}
      <Modal
        show={!!remarkBooking}
        onHide={() => setRemarkBooking(null)}
        centered
        size="md"
      >
        <Modal.Header closeButton>
          <Modal.Title className="d-flex align-items-center">
            <FaCommentDots className="me-2 text-info" />
            Restaurant Remark
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {remarkBooking && (
            <>
              <div className="small text-muted mb-3">
                <strong>{remarkBooking.bookingNumber}</strong> ·{" "}
                {remarkBooking.restaurantName || "Restaurant"} ·{" "}
                {remarkBooking.bookingDate || "—"}{" "}
                {remarkBooking.bookingTime || ""}
              </div>

              <div className="mb-3">
                <div className="fw-semibold small text-muted mb-1">
                  Remarks (from restaurant manager)
                </div>
                {remarkBooking.restaurantRemark ? (
                  <div
                    style={{
                      whiteSpace: "pre-wrap",
                      background: "#f8f9fa",
                      padding: "10px 12px",
                      borderRadius: 6,
                      borderLeft: "3px solid #0d6efd",
                      fontSize: "0.9rem",
                    }}
                  >
                    {remarkBooking.restaurantRemark}
                  </div>
                ) : (
                  <div className="text-muted small fst-italic">
                    No remark added by the restaurant yet.
                  </div>
                )}
              </div>

              {remarkBooking.cancellationReason && (
                <div>
                  <div className="fw-semibold small text-muted mb-1">
                    Cancellation / Rejection Reason
                  </div>
                  <div
                    style={{
                      whiteSpace: "pre-wrap",
                      background: "#fff5f5",
                      padding: "10px 12px",
                      borderRadius: 6,
                      borderLeft: "3px solid #dc3545",
                      fontSize: "0.9rem",
                    }}
                  >
                    {remarkBooking.cancellationReason}
                  </div>
                </div>
              )}

              {remarkBooking.restaurantActionedAt && (
                <div className="small text-muted mt-3">
                  Last updated by restaurant:{" "}
                  {new Date(remarkBooking.restaurantActionedAt).toLocaleString()}
                </div>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-secondary"
            onClick={() => setRemarkBooking(null)}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

const statusVariant = (s) => {
  switch (s) {
    case "Confirmed":
      return "success";
    case "Pending":
    case "Pending Approval":
      return "warning";
    case "Completed":
      return "primary";
    case "Cancelled":
      return "danger";
    default:
      return "secondary";
  }
};

/** Colour code for the payment-status badge in the new Payment column. */
const paymentVariant = (s) => {
  switch (s) {
    case "Paid":
      return "success";
    case "Partially Paid":
      return "warning";
    case "Refunded":
      return "info";
    case "Not Paid":
    default:
      return "secondary";
  }
};

const demoBookings = [
  {
    id: 101,
    bookingNumber: "RB-2026-0001",
    restaurantName: "Spice Garden",
    bookingDate: "2026-05-15",
    bookingTime: "20:00",
    memberCount: 4,
    customerName: "John Doe",
    mobile: "9876543210",
    agentName: "Travel Plus",
    totalAmount: 1450,
    bookingStatus: "Confirmed",
    specialRequest: "Window seat preferred",
    items: [
      { menuName: "Chicken Biriyani", qty: 2, price: 250, total: 500 },
      { menuName: "Shawarma", qty: 5, price: 180, total: 900 },
    ],
  },
];

export default RestaurantBookingList;
