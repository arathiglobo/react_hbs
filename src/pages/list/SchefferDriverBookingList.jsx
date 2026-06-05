/**
 * SchefferDriverBookingList.jsx
 *
 * Booking-list page for the Scheffer Driver new-booking flow.
 *
 *   GET /api/scheffer/grouped-list — upcoming / completed / cancelled buckets,
 *   now accepts optional month / year params (Time Period filter).
 *
 * The Action column now contains only the View (eye) icon — clicking it
 * navigates to a dedicated detail page
 * (/booking-details/scheffer-driver-booking/:id) where Voucher / Cancel /
 * Record-Actual-Usage live as buttons at the bottom-left.
 */
import React, { useEffect, useMemo, useState } from "react";
import {
  Container,
  Card,
  Button,
  Form,
  Table,
  InputGroup,
  Spinner,
} from "react-bootstrap";
import { FaSearch, FaEye, FaCar, FaMapMarkerAlt, FaSyncAlt } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import toast from "react-hot-toast";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const fmtDateLong = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d)) return typeof iso === "string" ? iso.slice(0, 10) : "-";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const SchefferDriverBookingList = ({
  apiBase = "/api/scheffer",
  pageTitle = "Chauffeur Driver & Limousine Bookings",
}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("upcoming");
  const [search, setSearch] = useState("");
  const [data, setData] = useState({
    upcoming: [],
    completed: [],
    cancelled: [],
  });
  const [totals, setTotals] = useState({
    upcomingTotal: 0,
    completedTotal: 0,
    cancelledTotal: 0,
  });

  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const currentYear = new Date().getFullYear();
  const years = Array.from(
    { length: currentYear - 2014 },
    (_, i) => 2020 + i,
  );

  const fetchList = async () => {
    setLoading(true);
    try {
      const role = (localStorage.getItem("currentActiveRole") || "")
        .toLowerCase();
      const params = {
        upcomingPage: 0,
        upcomingSize: 50,
        completedPage: 0,
        completedSize: 50,
        cancelledPage: 0,
        cancelledSize: 50,
      };
      if (role === "agent") {
        const agentId = localStorage.getItem("agentId");
        if (agentId && agentId !== "null") params.agentId = agentId;
      }
      if (selectedMonth) params.month = selectedMonth;
      if (selectedYear) params.year = selectedYear;
      const res = await axiosInstance.get(`${apiBase}/grouped-list`, {
        params,
      });
      const d = res.data || {};
      setData({
        upcoming: d.upcoming || [],
        completed: d.completed || [],
        cancelled: d.cancelled || [],
      });
      setTotals({
        upcomingTotal: d.upcomingTotal || 0,
        completedTotal: d.completedTotal || 0,
        cancelledTotal: d.cancelledTotal || 0,
      });
    } catch (e) {
      console.error("Error loading bookings:", e);
      toast.error("Failed to load bookings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line
  }, [apiBase, selectedMonth, selectedYear]);

  const rows = useMemo(() => {
    const arr = data[status] || [];
    if (!search.trim()) return arr;
    const q = search.toLowerCase();
    return arr.filter((b) => {
      const blob = [
        b.bookingCode,
        b.packageBookCode,
        b.cabName,
        b.cabProviderName,
        b.transporter,
        b.custFirstName,
        b.custLastName,
        b.pickupName,
        b.dropoffName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [data, status, search]);

  const clearTimePeriod = () => {
    setSelectedMonth("");
    setSelectedYear("");
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main
          className="flex-grow-1 p-3"
          style={{ width: "100%", overflow: "hidden" }}
        >
          <Container
            fluid
            style={{
              maxWidth: "100%",
              paddingLeft: "0.5rem",
              paddingRight: "0.5rem",
            }}
          >
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h5 className="mb-0 text-dark fw-semibold">
                <FaCar className="me-2 text-muted" />
                {pageTitle}
              </h5>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={fetchList}
                disabled={loading}
                style={{ fontSize: "0.78rem" }}
              >
                <FaSyncAlt className={`me-1 ${loading ? "fa-spin" : ""}`} style={{ fontSize: "0.7rem" }} />
                {loading ? "Refreshing..." : "Refresh"}
              </Button>
            </div>

            <Card
              className="border mb-3 shadow-sm"
              style={{ borderRadius: "6px" }}
            >
              <Card.Header
                className="d-flex justify-content-between align-items-center text-dark border-bottom py-2"
                style={{
                  borderRadius: "6px 6px 0 0",
                  backgroundColor: "#f8f9fa",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                }}
              >
                <span>List of Bookings</span>
              </Card.Header>
              <Card.Body style={{ padding: "1.5rem 1rem 1rem" }}>
                {/* Toolbar row 1: pills with counts + Time Period */}
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                  <div className="d-inline-flex p-1 rounded" style={{ backgroundColor: "#f3f4f6" }}>
                    {[
                      { value: "upcoming",  label: "Upcoming",  count: totals.upcomingTotal },
                      { value: "completed", label: "Completed", count: totals.completedTotal },
                      { value: "cancelled", label: "Cancelled", count: totals.cancelledTotal },
                    ].map((opt) => {
                      const active = status === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setStatus(opt.value)}
                          className="border-0 d-inline-flex align-items-center gap-2 px-3 py-1"
                          style={{
                            backgroundColor: active ? "#ffffff" : "transparent",
                            color: active ? "#101828" : "#667085",
                            fontSize: "0.78rem",
                            fontWeight: active ? 600 : 500,
                            borderRadius: "6px",
                            boxShadow: active ? "0 1px 2px rgba(16,24,40,0.08)" : "none",
                            transition: "all 0.15s",
                          }}
                        >
                          {opt.label}
                          <span
                            style={{
                              backgroundColor: active ? "#eff6ff" : "#e4e7ec",
                              color: active ? "#1d4ed8" : "#667085",
                              fontSize: "0.65rem",
                              fontWeight: 600,
                              padding: "1px 7px",
                              borderRadius: "10px",
                              lineHeight: 1.4,
                            }}
                          >
                            {opt.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="d-flex align-items-center gap-2">
                    <span
                      className="text-uppercase text-muted fw-semibold"
                      style={{ fontSize: "0.68rem", letterSpacing: "0.05em" }}
                    >
                      Time Period
                    </span>
                    <Form.Select
                      size="sm"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      style={{ width: "auto", fontSize: "0.8rem", minWidth: "100px" }}
                    >
                      <option value="">Month</option>
                      {MONTHS.map((m, idx) => (
                        <option key={m} value={idx + 1}>
                          {m.slice(0, 3)}
                        </option>
                      ))}
                    </Form.Select>
                    <Form.Select
                      size="sm"
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                      style={{ width: "auto", fontSize: "0.8rem", minWidth: "90px" }}
                    >
                      <option value="">Year</option>
                      {years.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </Form.Select>
                    {(selectedMonth || selectedYear) && (
                      <button
                        type="button"
                        onClick={clearTimePeriod}
                        className="btn btn-sm border-0"
                        style={{
                          fontSize: "0.72rem",
                          color: "#667085",
                          padding: "0.25rem 0.5rem",
                        }}
                        title="Clear time period"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Toolbar row 2: search */}
                <div
                  className="d-flex flex-wrap justify-content-end align-items-center gap-2"
                  style={{ marginBottom: "1.5rem" }}
                >
                  <InputGroup size="sm" style={{ width: "280px" }}>
                    <InputGroup.Text
                      style={{
                        fontSize: "0.75rem",
                        backgroundColor: "#ffffff",
                        borderRight: "none",
                        color: "#98a2b3",
                      }}
                    >
                      <FaSearch />
                    </InputGroup.Text>
                    <Form.Control
                      placeholder="Search by booking, cab, customer..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      style={{ fontSize: "0.8rem", borderLeft: "none" }}
                    />
                  </InputGroup>
                </div>

                {/* Table */}
                <div className="table-responsive saas-table-wrap">
                  <Table hover className="mb-0 align-middle saas-table">
                    <thead>
                      <tr>
                        <th style={{ width: "48px" }}>#</th>
                        <th>Booking</th>
                        <th>Customer</th>
                        <th>Cab</th>
                        <th>Travel</th>
                        <th className="text-center">Pax</th>
                        <th className="text-end">Amount</th>
                        <th className="text-center" style={{ width: "80px" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={8} className="text-center py-5">
                            <Spinner animation="border" variant="primary" />
                            <p className="mt-2 text-muted mb-0">
                              Loading bookings...
                            </p>
                          </td>
                        </tr>
                      ) : rows.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-5 text-muted">
                            No bookings found
                          </td>
                        </tr>
                      ) : (
                        rows.map((b, i) => (
                          <tr key={b.id || b.custombookingId || i}>
                            <td className="text-muted">{i + 1}</td>
                            <td>
                              <div className="fw-semibold text-dark">
                                {b.bookingCode || b.packageBookCode || "-"}
                              </div>
                              <div className="text-muted" style={{ fontSize: "0.7rem" }}>
                                {b.createdAt ? fmtDateLong(b.createdAt) : ""}
                              </div>
                            </td>
                            <td>
                              <div className="fw-medium text-dark">
                                {[b.custSalutation, b.custFirstName, b.custLastName]
                                  .filter(Boolean)
                                  .join(" ") || "-"}
                              </div>
                              <div className="text-muted" style={{ fontSize: "0.7rem" }}>
                                {b.custEmail || b.custPhone || ""}
                              </div>
                            </td>
                            <td>
                              <div className="fw-medium text-dark">
                                {b.cabName || `Cab #${b.cabId || "-"}`}
                              </div>
                              <div className="text-muted" style={{ fontSize: "0.7rem" }}>
                                {b.cabProviderName || ""}
                              </div>
                            </td>
                            <td style={{ minWidth: "220px" }}>
                              <div className="d-flex align-items-center gap-1">
                                <FaMapMarkerAlt
                                  style={{ color: "#22c55e", fontSize: "0.7rem" }}
                                />
                                <span className="text-dark">
                                  {b.pickupName || "-"}
                                </span>
                                {b.pickupTime && (
                                  <span className="text-muted" style={{ fontSize: "0.7rem" }}>
                                    @ {b.pickupTime}
                                  </span>
                                )}
                              </div>
                              <div className="d-flex align-items-center gap-1">
                                <FaMapMarkerAlt
                                  style={{ color: "#ef4444", fontSize: "0.7rem" }}
                                />
                                <span className="text-dark">
                                  {b.dropoffName || "-"}
                                </span>
                                {b.dropoffTime && (
                                  <span className="text-muted" style={{ fontSize: "0.7rem" }}>
                                    @ {b.dropoffTime}
                                  </span>
                                )}
                              </div>
                              <div className="text-muted" style={{ fontSize: "0.7rem", marginTop: "2px" }}>
                                {fmtDateLong(b.pickupDate)}
                                {b.dropOffDate
                                  ? ` → ${fmtDateLong(b.dropOffDate)}`
                                  : ""}
                              </div>
                            </td>
                            <td className="text-center">
                              <span
                                className="px-2 py-1 rounded"
                                style={{
                                  fontSize: "0.7rem",
                                  fontWeight: 600,
                                }}
                              >
                                {b.noOfAdult || 0} ADT / {b.noOfChild || 0}CHD
                              </span>
                            </td>
                            <td className="text-end" style={{ whiteSpace: "nowrap" }}>
                              <div className="fw-semibold text-dark">
                                AED{" "}
                                {b.finalAmount != null
                                  ? b.finalAmount
                                  : b.totalPrice || b.totalRate || "-"}
                              </div>
                              {b.packageName && (
                                <div className="text-muted" style={{ fontSize: "0.7rem" }}>
                                  {b.packageName}
                                </div>
                              )}
                            </td>
                            <td className="text-center">
                              <button
                                type="button"
                                className="btn btn-sm border-0 p-1"
                                style={{
                                  backgroundColor: "#eff6ff",
                                  color: "#1d4ed8",
                                  borderRadius: "6px",
                                }}
                                onClick={() =>
                                  navigate(
                                    `/booking-details/scheffer-driver-booking/${b.id || b.custombookingId}`,
                                    { state: { booking: b } },
                                  )
                                }
                                title="View details"
                              >
                                <FaEye style={{ fontSize: "12px" }} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </Table>
                </div>

                <style>{`
                  .saas-table-wrap { border: 1px solid #eaecf0; border-radius: 8px; overflow-x: auto; }
                  .saas-table { font-size: 0.8rem; margin-bottom: 0; }
                  .saas-table thead th {
                    background-color: #f9fafb;
                    color: #667085;
                    font-size: 0.68rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    border-bottom: 1px solid #eaecf0;
                    border-top: none;
                    padding: 0.65rem 0.75rem;
                    white-space: nowrap;
                  }
                  .saas-table tbody td {
                    padding: 0.65rem 0.75rem;
                    border-top: 1px solid #f2f4f7;
                    vertical-align: middle;
                    color: #344054;
                  }
                  .saas-table tbody tr:first-child td { border-top: none; }
                  .saas-table tbody tr:hover { background-color: #fafbfc; }
                `}</style>
              </Card.Body>
            </Card>
          </Container>
        </main>
      </div>
    </div>
  );
};

export default SchefferDriverBookingList;
