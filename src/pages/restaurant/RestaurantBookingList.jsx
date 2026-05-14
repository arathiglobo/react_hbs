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
  // The booking that's having its status edited via the modal.
  const [statusEditing, setStatusEditing] = useState(null);
  const [statusForm, setStatusForm] = useState({
    bookingStatus: "",
    paymentStatus: "",
    note: "",
  });
  const [statusSaving, setStatusSaving] = useState(false);

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

  /** Voucher → backend stub returns metadata for now. We just hit the
   *  endpoint and show a toast / preview blob. When the PDF endpoint
   *  lands, swap the toast for a window.open of the returned URL. */
  const handleVoucher = async (b) => {
    try {
      const res = await axiosInstance.get(
        `/api/restaurant/booking/${b.id}/voucher`
      );
      // If/when the backend starts returning a binary PDF, swap to a
      // window.open(res.data.url) here.
      Swal.fire({
        icon: "info",
        title: `Voucher — ${b.bookingNumber}`,
        html:
          `<div class="text-start">` +
          `Booking: <strong>${res.data?.bookingNumber || b.bookingNumber}</strong><br/>` +
          `Restaurant: ${res.data?.restaurantName || b.restaurantName}<br/>` +
          `Customer: ${res.data?.customerName || b.customerName}<br/>` +
          `Total: ₹ ${Number(res.data?.totalAmount || b.totalAmount || 0).toFixed(2)}<br/><br/>` +
          `<em>${res.data?.message || "Voucher PDF is being generated…"}</em>` +
          `</div>`,
        confirmButtonText: "OK",
      });
    } catch (e) {
      toast.error("Failed to fetch voucher details");
    }
  };

  /** Open the status edit modal with the booking's current values. */
  const openStatusEdit = (b) => {
    setStatusEditing(b);
    setStatusForm({
      bookingStatus: b.bookingStatus || "Pending Approval",
      paymentStatus: b.paymentStatus || "Not Paid",
      note: "",
    });
  };

  /** PUT /api/restaurant/booking/{id}/status with the new values. */
  const submitStatus = async () => {
    if (!statusEditing) return;
    setStatusSaving(true);
    try {
      await axiosInstance.put(
        `/api/restaurant/booking/${statusEditing.id}/status`,
        statusForm
      );
      toast.success("Status updated");
      setStatusEditing(null);
      fetchList();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to update status");
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
    <div className="d-flex">
      <Sidebar />
      <div className="flex-grow-1">
        <TopBar />
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
                      <th>Total</th>
                      <th>Status</th>
                      <th>Payment</th>
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
                        <td>₹ {Number(b.totalAmount || 0).toFixed(2)}</td>
                        <td>
                          {/* Status badge doubles as a "click-to-edit" button
                              — operators commonly need to flip Pending →
                              Confirmed after the restaurant approves. */}
                          <Badge
                            bg={statusVariant(b.bookingStatus)}
                            style={{ cursor: "pointer" }}
                            onClick={() => openStatusEdit(b)}
                            title="Click to update status"
                          >
                            {b.bookingStatus}
                          </Badge>
                        </td>
                        <td>
                          <Badge bg={paymentVariant(b.paymentStatus)}>
                            {b.paymentStatus || "Not Paid"}
                          </Badge>
                        </td>
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
                          {/* Status update — quick way to flip approval /
                              payment state without a full edit. */}
                          <Button
                            size="sm"
                            variant="outline-warning"
                            className="me-1"
                            onClick={() => openStatusEdit(b)}
                            title="Update Status"
                          >
                            <FaSyncAlt />
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
                <strong>Grand Total: ₹ {Number(selected.totalAmount || 0).toFixed(2)}</strong>
              </div>
            </>
          )}
        </Modal.Body>
      </Modal>

      {/* Status update modal — booking + payment status with a free-form note */}
      <Modal
        show={!!statusEditing}
        onHide={() => setStatusEditing(null)}
        centered
        backdrop="static"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            Update Status — {statusEditing?.bookingNumber}
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
            {statusSaving ? "Saving..." : "Save Status"}
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
