/**
 * GovEmployeeBookingList.jsx
 *
 * Booking-list page for the gov-employee flow.
 *
 * Cancel: DELETE /api/gov-employee-booking/{id}   (server refunds credit)
 * View  : navigate to /booking-details/gov-employee-booking/{id}
 * Voucher: GET /api/gov-employee-booking/{id}/voucher (PDF stream)
 */

import React, { useEffect, useState, useMemo } from "react";
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
import { FaEye, FaDownload, FaTrash, FaSearch } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import toast from "react-hot-toast";

const PER_PAGE_OPTIONS = [10, 25, 50, 100];

export default function GovEmployeeBookingList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [agentId, setAgentId] = useState("");
  const [search, setSearch] = useState("");
  const [bookingType, setBookingType] = useState("upcoming");
  const [role, setRole] = useState(
    (localStorage.getItem("currentActiveRole") || "").toLowerCase(),
  );

  // If the current role is an agent, restrict to their own bookings.
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
      const { data } = await axiosInstance.get(
        `/api/gov-employee-booking/list?${params.toString()}`,
      );
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

  // Client-side filter combining Booking Types (Upcoming / Completed /
  // Cancelled) + free-text search against the already-fetched page.
  const filtered = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const needle = search.trim().toLowerCase();
    return (rows || []).filter((r) => {
      const isCancelled =
        r.cancelled === true ||
        String(r.bookingStatus || "").toUpperCase() === "CANCELLED" ||
        String(r.confirmationStatus || "").toUpperCase() === "CANCELLED";

      if (bookingType === "cancelled") {
        if (!isCancelled) return false;
      } else {
        if (isCancelled) return false;
        const ref = r.checkOutDate || r.checkInDate;
        const refDate = ref ? new Date(ref) : null;
        if (refDate && !isNaN(refDate.getTime())) {
          refDate.setHours(0, 0, 0, 0);
          if (bookingType === "completed" && refDate >= today) return false;
          if (bookingType === "upcoming" && refDate < today) return false;
        }
      }

      if (needle) {
        const hay = [
          r.bookingCode,
          r.customerName,
          r.hotelName,
          r.govEmployeeCode,
          r.govEmployeeName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }

      return true;
    });
  }, [rows, search, bookingType]);

  // Reset to page 0 whenever any filter changes.
  useEffect(() => {
    setPage(0);
  }, [search, bookingType]);

  // ── Cancel: same UX as HotelBookingList — gated by refund status.
  const handleCancel = async (row) => {
    if ((row.refundStatus || "").toLowerCase() === "non-refundable") {
      toast.error("This booking is non-refundable and cannot be cancelled.");
      return;
    }
    if (
      !window.confirm(
        `Cancel booking ${row.bookingCode}? Agent credit will be restored.`,
      )
    )
      return;
    try {
      await axiosInstance.delete(
        `/api/gov-employee-booking/${row.bookingId}?reason=Cancelled%20by%20user`,
      );
      toast.success("Booking cancelled");
      fetchPage();
    } catch (e) {
      toast.error("Cancel failed");
    }
  };

  // ── Voucher download (PDF).
  const handleVoucher = async (row) => {
    try {
      const res = await axiosInstance.get(
        `/api/gov-employee-booking/${row.bookingId}/voucher`,
        { responseType: "blob" },
      );
      const url = URL.createObjectURL(
        new Blob([res.data], { type: "application/pdf" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `gov-employee-voucher-${row.bookingId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error("Voucher download failed");
    }
  };

  const totalElements =
    rows.length === 0
      ? 0
      : totalPages > 1
        ? totalPages * size
        : filtered.length;
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
                <h4 className="mb-0 text-dark">Government Employee Booking</h4>
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
                {/* Booking Types radio filter. */}
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
                            <th>Booking Code</th>
                            {role === "admin" && <th>Agent</th>}
                            <th>Customer</th>
                            <th>Govt Emp</th>
                            <th>Hotel</th>
                            <th>Stay</th>
                            <th className="text-end">Before</th>
                            <th className="text-end">After</th>
                            <th>Status</th>
                            <th>Refund</th>
                            <th style={{ width: "120px" }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.length > 0 ? (
                            filtered.map((r, i) => {
                              const statusText = r.cancelled
                                ? "Cancelled"
                                : r.confirmationStatus || "-";
                              return (
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
                                    <div>{r.govEmployeeCode || "-"}</div>
                                    <div className="text-muted small">
                                      {r.govEmployeeName || ""}
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
                                    {r.totalRateBeforeDiscount != null
                                      ? `AED ${r.totalRateBeforeDiscount}`
                                      : "-"}
                                  </td>
                                  <td className="text-end text-dark">
                                    {r.totalRate != null
                                      ? `AED ${r.totalRate}`
                                      : "-"}
                                  </td>
                                  <td>{statusText}</td>
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
                                            `/booking-details/gov-employee-booking/${r.bookingId}`,
                                          )
                                        }
                                        title="View Details"
                                      />
                                      <FaDownload
                                        style={{
                                          cursor: "pointer",
                                          fontSize: "14px",
                                          color: "#198754",
                                        }}
                                        onClick={() => handleVoucher(r)}
                                        title="Download Voucher"
                                      />
                                      {!r.cancelled && (
                                        <FaTrash
                                          style={{
                                            cursor: "pointer",
                                            fontSize: "14px",
                                            color: "#dc3545",
                                          }}
                                          onClick={() => handleCancel(r)}
                                          title="Cancel Booking"
                                        />
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td
                                colSpan={role === "admin" ? 12 : 11}
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
                            onClick={() => setPage((p) => Math.max(0, p - 1))}
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
