/**
 * StudentBookingList.jsx
 *
 * Booking-list page for the student flow (reference:
 * HotelBookingList.jsx). Shows columns:
 *   #, Agent, Customer, Student/Institution, Hotel, Booking Code,
 *   Stay, Before/After totals, Method, Verification Status, Refund,
 *   Actions
 *
 * Actions per row:
 *   - View      → /booking-details/student-booking/:id
 *   - Voucher   → GET /api/student-booking/:id/voucher
 *   - Cancel    → DELETE /api/student-booking/:id (refunds credit for
 *                 refundable bookings)
 *   - Approve / Reject / Re-upload (ADMIN ONLY, only when the booking
 *                 is still PENDING_STUDENT_VERIFICATION or
 *                 REQUEST_REUPLOAD) → POST /api/student-booking-admin/{id}/decision
 *
 * The admin actions live on this page so admins don't need to bounce
 * to a separate verification screen.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Card, Table, Button, Spinner, Form, Row, Col, Badge, Modal } from "react-bootstrap";
import {
  FaEye, FaDownload, FaTrash, FaGraduationCap,
  FaCheck, FaTimes, FaRedo,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import toast from "react-hot-toast";

const VERIFICATION_STATUS_COLOR = {
  PENDING_STUDENT_VERIFICATION: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  REQUEST_REUPLOAD: "info",
};

// Short human label + color for the verification-method badge.
const METHOD_META = {
  STUDENT_ID_UPLOAD:     { label: "ID Upload",  color: "primary" },
  MANUAL_ADMIN_APPROVAL: { label: "Manual",     color: "success" },
  INSTITUTIONAL_EMAIL:   { label: "Email OTP",  color: "info" },
};

export default function StudentBookingList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [agentId, setAgentId] = useState("");
  const [verificationStatus, setVerificationStatus] = useState("");
  const [search, setSearch] = useState("");

  // The "Approve / Reject / Re-upload" buttons only render for admins.
  // Agents only see View / Voucher / Cancel.
  const [role, setRole] = useState(
    (localStorage.getItem("currentActiveRole") || "").toLowerCase()
  );
  const isAdmin = role === "admin";

  // Admin-decision modal state — opens when an admin clicks
  // Approve / Reject / Re-upload on a pending row.
  const [decisionRow, setDecisionRow] = useState(null);
  const [decisionType, setDecisionType] = useState("");
  const [decisionNotes, setDecisionNotes] = useState("");
  const [decisionSubmitting, setDecisionSubmitting] = useState(false);

  useEffect(() => {
    const r = (localStorage.getItem("currentActiveRole") || "").toLowerCase();
    setRole(r);
    if (r === "agent") {
      const uid = localStorage.getItem("userId");
      if (uid && uid !== "null") setAgentId(uid);
    }
  }, []);

  const fetchPage = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, size });
      if (agentId) params.append("agentId", agentId);
      if (verificationStatus) params.append("verificationStatus", verificationStatus);
      const { data } = await axiosInstance.get(`/api/student-booking/list?${params.toString()}`);
      setRows(data?.content || []);
      setTotalPages(data?.totalPages || 0);
    } catch (e) {
      toast.error("Failed to load bookings");
    } finally { setLoading(false); }
  };
  useEffect(() => { fetchPage(); /* eslint-disable-next-line */ }, [page, size, agentId, verificationStatus]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) =>
      (r.bookingCode || "").toLowerCase().includes(q) ||
      (r.customerName || "").toLowerCase().includes(q) ||
      (r.hotelName || "").toLowerCase().includes(q) ||
      (r.studentName || "").toLowerCase().includes(q) ||
      (r.institutionName || "").toLowerCase().includes(q) ||
      (r.studentIdNumber || "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  const handleCancel = async (row) => {
    if ((row.refundStatus || "").toLowerCase() === "non-refundable") {
      toast.error("This booking is non-refundable and cannot be cancelled.");
      return;
    }
    if (!window.confirm(`Cancel booking ${row.bookingCode}? Agent credit will be restored.`)) return;
    try {
      await axiosInstance.delete(`/api/student-booking/${row.bookingId}?reason=Cancelled%20by%20user`);
      toast.success("Booking cancelled");
      fetchPage();
    } catch (e) { toast.error("Cancel failed"); }
  };

  const handleVoucher = async (row) => {
    try {
      const res = await axiosInstance.get(`/api/student-booking/${row.bookingId}/voucher`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url; a.download = `student-voucher-${row.bookingId}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { toast.error("Voucher download failed"); }
  };

  // ── Admin decision flow (Approve / Reject / Request Re-upload) ────
  // Opens the confirmation modal — actual POST happens on submit.
  const openDecision = (row, type) => {
    setDecisionRow(row);
    setDecisionType(type);
    setDecisionNotes("");
  };
  const closeDecision = () => {
    setDecisionRow(null);
    setDecisionType("");
    setDecisionNotes("");
  };

  // Whether this booking is still in a state an admin can act on.
  // Already-approved / already-rejected / cancelled rows hide the
  // admin buttons to keep the row readable.
  const isAdminActionable = (row) =>
    isAdmin &&
    !row.cancelled &&
    (row.verificationStatus === "PENDING_STUDENT_VERIFICATION" ||
     row.verificationStatus === "REQUEST_REUPLOAD");

  const submitDecision = async () => {
    if (!decisionRow) return;
    setDecisionSubmitting(true);
    try {
      const verifiedBy =
        localStorage.getItem("userName") ||
        localStorage.getItem("userId") || "admin";
      await axiosInstance.post(
        `/api/student-booking-admin/${decisionRow.bookingId}/decision`,
        { decision: decisionType, notes: decisionNotes, verifiedBy }
      );
      toast.success(`Booking ${decisionRow.bookingCode} → ${decisionType}`);
      closeDecision();
      fetchPage();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Decision failed");
    } finally {
      setDecisionSubmitting(false);
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
              <h5 className="mb-3">
                <FaGraduationCap className="me-2 text-primary" /> Student Bookings
              </h5>
              <Row className="g-2 mb-3 align-items-end">
                <Col md={4}>
                  <Form.Label>Search</Form.Label>
                  <Form.Control placeholder="Booking code / student / institution / hotel"
                                value={search} onChange={(e) => setSearch(e.target.value)} />
                </Col>
                <Col md={3}>
                  <Form.Label>Verification</Form.Label>
                  <Form.Select value={verificationStatus} onChange={(e) => { setVerificationStatus(e.target.value); setPage(0); }}>
                    <option value="">All</option>
                    <option value="PENDING_STUDENT_VERIFICATION">Pending</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                    <option value="REQUEST_REUPLOAD">Request Re-upload</option>
                  </Form.Select>
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
                      <th>Student / Institution</th>
                      <th>Hotel</th>
                      <th>Booking Code</th>
                      <th>Stay</th>
                      <th>Before</th>
                      <th>After</th>
                      <th>Method</th>
                      <th>Verification</th>
                      <th>Refund</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr><td colSpan={13} className="text-center text-muted py-4">No bookings yet.</td></tr>
                    ) : (
                      filtered.map((r, i) => (
                        <tr key={r.bookingId}>
                          <td>{page * size + i + 1}</td>
                          <td>{r.agentName || r.agentId}</td>
                          <td>{r.customerName}</td>
                          <td>
                            <strong>{r.studentName || "-"}</strong>
                            <div className="text-muted small">{r.institutionName} · {r.studentIdNumber}</div>
                          </td>
                          <td>{r.hotelName}</td>
                          <td><strong>{r.bookingCode}</strong></td>
                          <td>
                            <div className="small">{r.checkInDate?.slice(0, 10)}</div>
                            <div className="small text-muted">{r.checkOutDate?.slice(0, 10)}</div>
                          </td>
                          <td className="text-decoration-line-through">{r.totalRateBeforeDiscount ?? "-"}</td>
                          <td><strong className="text-success">{r.totalRate ?? "-"}</strong></td>
                          <td>
                            {(() => {
                              const m = METHOD_META[r.verificationMethod];
                              return m
                                ? <Badge bg={m.color}>{m.label}</Badge>
                                : <Badge bg="secondary">{r.verificationMethod || "-"}</Badge>;
                            })()}
                          </td>
                          <td>
                            <Badge bg={VERIFICATION_STATUS_COLOR[r.verificationStatus] || "secondary"}>
                              {r.verificationStatus || "-"}
                            </Badge>
                          </td>
                          <td>{r.refundStatus || "-"}</td>
                          <td>
                            <div className="d-flex flex-wrap gap-1">
                              <Button size="sm" variant="outline-primary"
                                      onClick={() => navigate(`/booking-details/student-booking/${r.bookingId}`)}
                                      title="View"><FaEye /></Button>
                              <Button size="sm" variant="outline-success"
                                      onClick={() => handleVoucher(r)}
                                      title="Download Voucher"><FaDownload /></Button>
                              <Button size="sm" variant="outline-danger"
                                      onClick={() => handleCancel(r)} title="Cancel"
                                      disabled={r.cancelled}><FaTrash /></Button>

                              {/* Admin verification buttons — only render
                                  for admins and only when the booking is
                                  still in PENDING / REQUEST_REUPLOAD. */}
                              {isAdminActionable(r) && (
                                <>
                                  <Button size="sm" variant="success"
                                          onClick={() => openDecision(r, "APPROVED")}
                                          title="Approve">
                                    <FaCheck />
                                  </Button>
                                  <Button size="sm" variant="danger"
                                          onClick={() => openDecision(r, "REJECTED")}
                                          title="Reject (refunds credit)">
                                    <FaTimes />
                                  </Button>
                                  <Button size="sm" variant="info"
                                          onClick={() => openDecision(r, "REQUEST_REUPLOAD")}
                                          title="Request Re-upload">
                                    <FaRedo />
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </Table>
              )}

              <div className="d-flex justify-content-between align-items-center mt-2">
                <div className="text-muted small">Page {page + 1} of {Math.max(1, totalPages)}</div>
                <div>
                  <Button size="sm" variant="outline-secondary" className="me-1"
                          disabled={page === 0}
                          onClick={() => setPage((p) => Math.max(0, p - 1))}>Prev</Button>
                  <Button size="sm" variant="outline-secondary"
                          disabled={page + 1 >= totalPages}
                          onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              </div>
            </Card.Body>
          </Card>
        </main>
      </div>

      {/* ── Admin decision modal ─────────────────────────────────
          Opens when an admin clicks Approve / Reject / Re-upload on
          a row. The actual POST happens on Confirm. */}
      <Modal show={!!decisionRow} onHide={closeDecision} centered>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Decision: {decisionType}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {decisionRow && (
            <>
              <p className="mb-2">
                <strong>Booking:</strong> {decisionRow.bookingCode}<br />
                <strong>Student:</strong> {decisionRow.studentName} ({decisionRow.studentIdNumber})<br />
                <strong>Institution:</strong> {decisionRow.institutionName}<br />
                <strong>Method:</strong> {decisionRow.verificationMethod}
              </p>
              <Form.Label>Notes / Reason (optional)</Form.Label>
              <Form.Control as="textarea" rows={3} value={decisionNotes}
                            onChange={(e) => setDecisionNotes(e.target.value)} />
              {decisionType === "REJECTED" && (
                <div className="text-danger small mt-2">
                  Rejecting will cancel the booking and refund the agent's
                  credit limit (for refundable bookings).
                </div>
              )}
              {decisionType === "REQUEST_REUPLOAD" && (
                <div className="text-info small mt-2">
                  The student will see this booking marked
                  REQUEST_REUPLOAD. Credit stays on hold.
                </div>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeDecision} disabled={decisionSubmitting}>
            Cancel
          </Button>
          <Button
            variant={decisionType === "REJECTED" ? "danger"
                   : decisionType === "APPROVED" ? "success" : "info"}
            onClick={submitDecision} disabled={decisionSubmitting}>
            {decisionSubmitting ? <Spinner size="sm" className="me-1" /> : null}
            Confirm {decisionType}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
