/**
 * GovEmployeeBookingList.jsx
 *
 * Booking-list page for the gov-employee flow.
 *
 * Reference: HotelBookingList.jsx — same columns and actions
 * (View, Voucher, Cancel) but reading from the dedicated
 * /api/gov-employee-booking/list endpoint and writing to the
 * gov-employee-only tables.
 *
 * Cancel: DELETE /api/gov-employee-booking/{id}   (server refunds credit)
 * View  : navigate to /booking-details/gov-employee-booking/{id}
 * Voucher: GET /api/gov-employee-booking/{id}/voucher (PDF stream)
 */

import React, { useEffect, useState, useMemo } from "react";
import {
  Card,
  Table,
  Button,
  Spinner,
  Form,
  Row,
  Col,
  Badge,
  InputGroup,
} from "react-bootstrap";
import { FaEye, FaDownload, FaTrash, FaSearch } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import toast from "react-hot-toast";

export default function GovEmployeeBookingList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [agentId, setAgentId] = useState("");
  const [search, setSearch] = useState("");

  // ── Booking Types + Time Period filters (mirrors
  //    /booking-details/long-stay-booking-list). Applied client-side
  //    over the already-fetched page so the backend pagination and
  //    cancel / voucher endpoints keep working unchanged.
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

  // If the current role is an agent, restrict to their own bookings.
  useEffect(() => {
    const role = (localStorage.getItem("currentActiveRole") || "").toLowerCase();
    if (role === "agent") {
      const uid = localStorage.getItem("userId");
      if (uid && uid !== "null") setAgentId(uid);
    }
  }, []);

  const fetchPage = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, size });
      if (agentId) params.append("agentId", agentId);
      const { data } = await axiosInstance.get(`/api/gov-employee-booking/list?${params.toString()}`);
      setRows(data?.content || []);
      setTotalPages(data?.totalPages || 0);
    } catch (e) {
      toast.error("Failed to load bookings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPage();
    // eslint-disable-next-line
  }, [page, size, agentId]);

  // ── client-side filter on already-loaded page rows. Combines
  //    free-text search + Booking Types + Time Period in one pass
  //    (same shape as LongStayBookingList.filteredBookings).
  const filtered = useMemo(() => {
    const now = new Date();
    const needle = search.trim().toLowerCase();
    return (rows || []).filter((r) => {
      // ── Booking-Types filter ────────────────────────────────────
      const isCancelled =
        r.cancelled === true ||
        String(r.bookingStatus || "").toUpperCase() === "CANCELLED";
      const checkIn = r.checkInDate ? new Date(r.checkInDate) : null;
      const checkOut = r.checkOutDate ? new Date(r.checkOutDate) : null;

      if (status === "cancelled" && !isCancelled) return false;
      if (status === "upcoming") {
        if (isCancelled) return false;
        if (!checkIn || checkIn < now) return false;
      }
      if (status === "completed") {
        if (isCancelled) return false;
        if (!checkOut || checkOut > now) return false;
      }
      // "all" → no status restriction

      // ── Time-Period filter (month / year of check-in date) ─────
      if (checkIn && (selectedMonth || selectedYear)) {
        const m = checkIn.getMonth() + 1;
        const y = checkIn.getFullYear();
        if (selectedMonth && Number(selectedMonth) !== m) return false;
        if (selectedYear && Number(selectedYear) !== y) return false;
      }

      // ── Free-text search ───────────────────────────────────────
      if (needle) {
        const hay = [
          r.bookingCode,
          r.customerName,
          r.hotelName,
          r.govEmployeeCode,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }

      return true;
    });
  }, [rows, search, status, selectedMonth, selectedYear]);

  // Reset to page 0 whenever any filter changes — keeps the
  // pagination footer in step with the visible row set.
  useEffect(() => {
    setPage(0);
  }, [search, status, selectedMonth, selectedYear]);

  // ── Cancel: same UX as HotelBookingList — gated by refund status ──
  const handleCancel = async (row) => {
    if ((row.refundStatus || "").toLowerCase() === "non-refundable") {
      toast.error("This booking is non-refundable and cannot be cancelled.");
      return;
    }
    if (!window.confirm(`Cancel booking ${row.bookingCode}? Agent credit will be restored.`)) return;
    try {
      await axiosInstance.delete(`/api/gov-employee-booking/${row.bookingId}?reason=Cancelled%20by%20user`);
      toast.success("Booking cancelled");
      fetchPage();
    } catch (e) {
      toast.error("Cancel failed");
    }
  };

  // ── Voucher download (PDF) ─────────────────────────────────────────
  const handleVoucher = async (row) => {
    try {
      const res = await axiosInstance.get(`/api/gov-employee-booking/${row.bookingId}/voucher`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `gov-employee-voucher-${row.bookingId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error("Voucher download failed");
    }
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Card className="shadow-sm border-0">
          <Card.Body>
            {/* Header: Title + Search (left) | Time Period (right) —
                same shape as /booking-details/long-stay-booking-list. */}
            <div className="d-flex justify-content-between align-items-end mb-3 flex-wrap gap-2">
              <div>
                <h5 className="fw-bold text-dark mb-2">
                  Government Employee Bookings
                </h5>
                <InputGroup style={{ height: "45px", width: "320px" }}>
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
                    placeholder="Booking code / customer / hotel / employee code"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                      borderLeft: "none",
                      fontSize: "0.85rem",
                      borderColor: "#dee2e6",
                      height: "45px",
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
                        style={{ fontSize: "0.82rem", height: "40px" }}
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

            {/* Booking Types radio bar (mirrors long-stay list). */}
            <Row className="mb-3 g-1">
              <Col xs={12}>
                <Card
                  className="shadow-sm border-0 w-100"
                  style={{ borderRadius: "8px" }}
                >
                  <Card.Body className="p-3">
                    <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
                      <h6
                        className="mb-0 fw-bold text-dark"
                        style={{ fontSize: "0.85rem", letterSpacing: "0.4px" }}
                      >
                        Booking Types
                      </h6>
                      {/* Page-size selector preserved from the previous
                          layout — moved here so the row above can host
                          the Time Period card without crowding. */}
                      <div className="d-flex align-items-center gap-2">
                        <span className="text-muted small">Page Size</span>
                        <Form.Select
                          size="sm"
                          value={size}
                          onChange={(e) => {
                            setSize(Number(e.target.value));
                            setPage(0);
                          }}
                          style={{ width: "90px" }}
                        >
                          {[10, 25, 50, 100].map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </Form.Select>
                      </div>
                    </div>
                    <div className="row g-2">
                      <div className="col-6 col-md-4 col-lg-2">
                        <Form.Check
                          type="radio"
                          label="All"
                          name="geBookingType"
                          checked={status === "all"}
                          onChange={() => setStatus("all")}
                        />
                      </div>
                      <div className="col-6 col-md-4 col-lg-2">
                        <Form.Check
                          type="radio"
                          label="Upcoming"
                          name="geBookingType"
                          checked={status === "upcoming"}
                          onChange={() => setStatus("upcoming")}
                        />
                      </div>
                      <div className="col-6 col-md-4 col-lg-2">
                        <Form.Check
                          type="radio"
                          label="Completed"
                          name="geBookingType"
                          checked={status === "completed"}
                          onChange={() => setStatus("completed")}
                        />
                      </div>
                      <div className="col-6 col-md-4 col-lg-2">
                        <Form.Check
                          type="radio"
                          label="Cancelled"
                          name="geBookingType"
                          checked={status === "cancelled"}
                          onChange={() => setStatus("cancelled")}
                        />
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            {loading ? (
              <div className="text-center py-5"><Spinner animation="border" /></div>
            ) : (
              <Table striped bordered hover responsive size="sm">
                <thead className="table-light">
                  <tr>
                    <th>#</th>
                    <th>Agent</th>
                    <th>Customer</th>
                    <th>Govt Emp</th>
                    <th>Hotel</th>
                    <th>Booking Code</th>
                    <th>Stay</th>
                    <th>Before</th>
                    <th>After</th>
                    <th>Status</th>
                    <th>Refund</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={12} className="text-center text-muted py-4">No bookings yet.</td></tr>
                  ) : (
                    filtered.map((r, i) => (
                      <tr key={r.bookingId}>
                        <td>{page * size + i + 1}</td>
                        <td>{r.agentName || r.agentId}</td>
                        <td>{r.customerName}</td>
                        <td>
                          <strong>{r.govEmployeeCode}</strong>
                          <div className="text-muted small">{r.govEmployeeName}</div>
                        </td>
                        <td>{r.hotelName}</td>
                        <td><strong>{r.bookingCode}</strong></td>
                        <td>
                          <div className="small">{r.checkInDate?.slice(0, 10)}</div>
                          <div className="small text-muted">{r.checkOutDate?.slice(0, 10)}</div>
                        </td>
                        <td className="text-decoration-line-through">
                          AED {r.totalRateBeforeDiscount ?? "-"}
                        </td>
                        <td><strong className="text-success">AED {r.totalRate ?? "-"}</strong></td>
                        <td>
                          {r.cancelled ? (
                            <Badge bg="danger">Cancelled</Badge>
                          ) : (
                            <Badge bg="info">{r.confirmationStatus || "-"}</Badge>
                          )}
                        </td>
                        <td>{r.refundStatus || "-"}</td>
                        <td>
                          <Button size="sm" variant="outline-primary" className="me-1"
                                  onClick={() => navigate(`/booking-details/gov-employee-booking/${r.bookingId}`)}
                                  title="View">
                            <FaEye />
                          </Button>
                          <Button size="sm" variant="outline-success" className="me-1"
                                  onClick={() => handleVoucher(r)} title="Download Voucher">
                            <FaDownload />
                          </Button>
                          <Button size="sm" variant="outline-danger"
                                  onClick={() => handleCancel(r)} title="Cancel"
                                  disabled={r.cancelled}>
                            <FaTrash />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            )}

            {/* Pagination */}
            <div className="d-flex justify-content-between align-items-center mt-2">
              <div className="text-muted small">
                Page {page + 1} of {Math.max(1, totalPages)}
              </div>
              <div>
                <Button size="sm" variant="outline-secondary" className="me-1"
                        disabled={page === 0}
                        onClick={() => setPage((p) => Math.max(0, p - 1))}>
                  Prev
                </Button>
                <Button size="sm" variant="outline-secondary"
                        disabled={page + 1 >= totalPages}
                        onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          </Card.Body>
        </Card>
        </main>
      </div>
    </div>
  );
}
