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
import { FaSearch, FaCalendarAlt, FaUtensils, FaEye, FaTimes } from "react-icons/fa";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";

const PER_PAGE = 10;

const RestaurantBookingList = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);

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
                    <option value="Confirmed">Confirmed</option>
                    <option value="Pending">Pending</option>
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
                      <th style={{ width: 130 }}>Actions</th>
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
                          <Badge bg={statusVariant(b.bookingStatus)}>{b.bookingStatus}</Badge>
                        </td>
                        <td>
                          <Button
                            size="sm"
                            variant="outline-info"
                            className="me-1"
                            onClick={() => setSelected(b)}
                          >
                            <FaEye />
                          </Button>
                          {b.bookingStatus !== "Cancelled" && b.bookingStatus !== "Completed" && (
                            <Button size="sm" variant="outline-danger" onClick={() => handleCancel(b)}>
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
    </div>
  );
};

const statusVariant = (s) => {
  switch (s) {
    case "Confirmed":
      return "success";
    case "Pending":
      return "warning";
    case "Completed":
      return "primary";
    case "Cancelled":
      return "danger";
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
