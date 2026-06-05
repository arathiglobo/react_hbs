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
import {
  Card,
  Table,
  Spinner,
  Form,
  Row,
  Col,
  Container,
  InputGroup,
  Pagination,
} from "react-bootstrap";
import { FaEye, FaSearch } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import toast from "react-hot-toast";

const PER_PAGE_OPTIONS = [10, 25, 50, 100];

// Short human label for the verification-method column.
const METHOD_META = {
  STUDENT_ID_UPLOAD:     { label: "ID Upload" },
  MANUAL_ADMIN_APPROVAL: { label: "Manual" },
  INSTITUTIONAL_EMAIL:   { label: "Email OTP" },
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

  const [role, setRole] = useState(
    (localStorage.getItem("currentActiveRole") || "").toLowerCase()
  );

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

  const totalElements = rows.length === 0 ? 0 : (totalPages > 1 ? totalPages * size : filtered.length);
  const displayStart = filtered.length === 0 ? 0 : page * size + 1;
  const displayEnd = page * size + filtered.length;

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
                <h4 className="mb-0 text-dark">Student Booking</h4>
              </div>
            </div>

            {/* List of Bookings Section */}
            <Card
              className="border mb-3"
              style={{ borderRadius: "8px" }}
            >
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
                {/* Verification Filter Section */}
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
                          Verification Status
                        </h6>
                        <div className="d-flex flex-wrap gap-4">
                          {[
                            { value: "", label: "All" },
                            { value: "PENDING_STUDENT_VERIFICATION", label: "Pending" },
                            { value: "APPROVED", label: "Approved" },
                            { value: "REJECTED", label: "Rejected" },
                            { value: "REQUEST_REUPLOAD", label: "Re-upload" },
                          ].map((opt) => (
                            <Form.Check
                              key={opt.value || "all"}
                              type="radio"
                              id={`verification-${opt.value || "all"}`}
                              name="verificationStatus"
                              label={opt.label}
                              checked={verificationStatus === opt.value}
                              onChange={() => {
                                setVerificationStatus(opt.value);
                                setPage(0);
                              }}
                              style={{ fontSize: "0.85rem", cursor: "pointer" }}
                            />
                          ))}
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>

                {/* Display and Search */}
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
                            <th>Booking Code</th>
                            {role === "admin" && <th>Agent</th>}
                            <th>Customer</th>
                            <th>Student / Institution</th>
                            <th>Hotel</th>
                            <th>Stay</th>
                            <th className="text-end">Before</th>
                            <th className="text-end">After</th>
                            <th>Method</th>
                            <th>Verification</th>
                            <th>Refund</th>
                            <th style={{ width: "160px" }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.length > 0 ? (
                            filtered.map((r, i) => (
                              <tr key={r.bookingId}>
                                <td>{page * size + i + 1}</td>
                                <td className="text-dark">
                                  {r.bookingCode || "-"}
                                </td>
                                {role === "admin" && (
                                  <td>{r.agentName || r.agentId || "-"}</td>
                                )}
                                <td>{r.customerName || "-"}</td>
                                <td>
                                  <div>{r.studentName || "-"}</div>
                                  <div className="text-muted small">
                                    {r.institutionName}
                                    {r.studentIdNumber
                                      ? ` · ${r.studentIdNumber}`
                                      : ""}
                                  </div>
                                </td>
                                <td>{r.hotelName || "-"}</td>
                                <td>
                                  <div className="small">
                                    {r.checkInDate?.slice(0, 10) || "-"}
                                  </div>
                                  <div className="small text-muted">
                                    {r.checkOutDate?.slice(0, 10) || "-"}
                                  </div>
                                </td>
                                <td className="text-end text-decoration-line-through">
                                  {r.totalRateBeforeDiscount ?? "-"}
                                </td>
                                <td className="text-end text-dark">
                                  {r.totalRate ?? "-"}
                                </td>
                                <td>
                                  {(() => {
                                    const m = METHOD_META[r.verificationMethod];
                                    return m
                                      ? m.label
                                      : r.verificationMethod || "-";
                                  })()}
                                </td>
                                <td>{r.verificationStatus || "-"}</td>
                                <td>{r.refundStatus || "-"}</td>
                                <td>
                                  <div className="d-flex gap-3 align-items-center flex-wrap">
                                    <FaEye
                                      style={{
                                        cursor: "pointer",
                                        fontSize: "14px",
                                        color: "#007bff",
                                      }}
                                      onClick={() =>
                                        navigate(
                                          `/booking-details/student-booking/${r.bookingId}`,
                                        )
                                      }
                                      title="View Details"
                                    />
                                  </div>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td
                                colSpan={role === "admin" ? 13 : 12}
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
                        Showing {displayStart} to {displayEnd} of {totalElements}{" "}
                        entries
                      </div>
                      {totalPages > 1 && (
                        <Pagination className="mb-0">
                          <Pagination.Prev
                            disabled={page === 0}
                            onClick={() =>
                              setPage((p) => Math.max(0, p - 1))
                            }
                          />
                          {Array.from(
                            { length: Math.min(5, totalPages) },
                            (_, i) => {
                              let pageNum;
                              if (totalPages <= 5) {
                                pageNum = i;
                              } else if (page <= 2) {
                                pageNum = i;
                              } else if (page >= totalPages - 3) {
                                pageNum = totalPages - 5 + i;
                              } else {
                                pageNum = page - 2 + i;
                              }
                              return (
                                <Pagination.Item
                                  key={pageNum}
                                  active={pageNum === page}
                                  onClick={() => setPage(pageNum)}
                                >
                                  {pageNum + 1}
                                </Pagination.Item>
                              );
                            },
                          )}
                          <Pagination.Next
                            disabled={page + 1 >= totalPages}
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
    </div>
  );
}
