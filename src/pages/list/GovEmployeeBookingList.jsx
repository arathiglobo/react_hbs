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
import { Card, Table, Button, Spinner, Form, Row, Col, Badge } from "react-bootstrap";
import { FaEye, FaDownload, FaTrash } from "react-icons/fa";
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

  // ── client-side search filter on already-loaded page rows ──────────
  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) =>
      (r.bookingCode || "").toLowerCase().includes(q) ||
      (r.customerName || "").toLowerCase().includes(q) ||
      (r.hotelName || "").toLowerCase().includes(q) ||
      (r.govEmployeeCode || "").toLowerCase().includes(q)
    );
  }, [rows, search]);

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
            <h5 className="mb-3">Government Employee Bookings</h5>
            <Row className="g-2 mb-3 align-items-end">
              <Col md={4}>
                <Form.Label>Search</Form.Label>
                <Form.Control placeholder="Booking code / customer / hotel / employee code"
                              value={search} onChange={(e) => setSearch(e.target.value)} />
              </Col>
              <Col md={2}>
                <Form.Label>Page Size</Form.Label>
                <Form.Select value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(0); }}>
                  {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                </Form.Select>
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
                          {r.totalRateBeforeDiscount ?? "-"}
                        </td>
                        <td><strong className="text-success">{r.totalRate ?? "-"}</strong></td>
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
