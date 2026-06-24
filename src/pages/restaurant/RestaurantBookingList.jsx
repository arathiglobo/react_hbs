/**
 * RestaurantBookingList.jsx
 *
 * Booking-list page for restaurant bookings. The Action column contains
 * only the View (eye) icon — clicking it navigates to a dedicated detail
 * page (/booking-details/restaurant-booking/:id) where Edit / Remark /
 * Voucher / Cancel live as buttons at the bottom-left, alongside any
 * reconfirm / date-change flow.
 *
 * Visual treatment mirrors HotelBookingList / LongStayBookingList via the
 * shared `hbl-modern` skin so all booking-list pages line up.
 */
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  Table,
  Spinner,
  Pagination,
  Container,
  Row,
  Col,
  Form,
  InputGroup,
} from "react-bootstrap";
import { FaEye, FaSearch, FaInbox } from "react-icons/fa";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import "../../styles/HotelBookingListModern.css";

const PER_PAGE_OPTIONS = [10, 25, 50, 100];

// Column-width hints kept in sync with HotelBookingList so the two pages
// line up visually under the shared hbl-modern skin.
const COLUMN_WIDTHS = {
  sn: "40px",
  booking: "110px",
  restaurant: "180px",
  dateTime: "130px",
  members: "70px",
  customer: "180px",
  status: "120px",
  action: "70px",
};

// Status palette covers every value emitted by the restaurant-booking
// backend; new keys can be added without touching the table cells.
const STATUS_META = {
  Confirmed:               { label: "Confirmed",              bg: "#e7f6ec", color: "#1b7f3a", dot: "#22c55e" },
  "Checked In":            { label: "Checked In",             bg: "#e7f6ec", color: "#1b7f3a", dot: "#22c55e" },
  Reconfirmed:             { label: "Reconfirmed",            bg: "#eff8ff", color: "#175cd3", dot: "#3b82f6" },
  Completed:               { label: "Completed",              bg: "#eff8ff", color: "#175cd3", dot: "#3b82f6" },
  "Pending Approval":      { label: "Pending Approval",       bg: "#fff7e6", color: "#b76e00", dot: "#f59e0b" },
  "Guarantee Pending":     { label: "Guarantee Pending",      bg: "#fff7e6", color: "#b76e00", dot: "#f59e0b" },
  "Date Change Requested": { label: "Date Change Requested",  bg: "#fff7e6", color: "#b76e00", dot: "#f59e0b" },
  Pending:                 { label: "Pending",                bg: "#fff7e6", color: "#b76e00", dot: "#f59e0b" },
  Cancelled:               { label: "Cancelled",              bg: "#fdecec", color: "#b42318", dot: "#ef4444" },
  Rejected:                { label: "Rejected",               bg: "#fdecec", color: "#b42318", dot: "#ef4444" },
  "Auto Cancelled":        { label: "Auto Cancelled",         bg: "#f3f4f6", color: "#475467", dot: "#98a2b3" },
  "No Show":               { label: "No Show",                bg: "#f3f4f6", color: "#475467", dot: "#98a2b3" },
};

const StatusPill = ({ meta, raw }) => {
  if (!meta) return <span className="text-muted">{raw || "-"}</span>;
  return (
    <span
      className="d-inline-flex align-items-center gap-1 px-2 py-1 rounded-pill"
      style={{
        backgroundColor: meta.bg,
        color: meta.color,
        fontSize: "0.7rem",
        fontWeight: 600,
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      {meta.dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            backgroundColor: meta.dot,
            display: "inline-block",
          }}
        />
      )}
      {meta.label}
    </span>
  );
};

// "dd/mm/yyyy" — same shape HotelBookingList uses in the table cells so
// dates render identically across both pages.
const formatShortDate = (dateString) => {
  if (!dateString) return "";
  const normalized = String(dateString).includes("T")
    ? dateString
    : `${dateString}T00:00:00`;
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()}`;
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

const normStatus = (v) =>
  String(v ?? "").replace(/[\s_-]+/g, "").toLowerCase();

const RestaurantBookingList = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  // Filters mirror Hotel Booking List: single Booking Type dropdown,
  // search box, and Month + Year time-period card. All client-side.
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");

  // The same seven options Hotel Booking List ships with. Restaurant
  // bookings have no "Invoiced" concept yet — that branch falls through
  // to `return false` so the filter is harmless until the backend ships
  // an invoice flag.
  const statusOptions = useMemo(
    () => [
      { value: "all", label: "All" },
      { value: "upcoming", label: "Upcoming" },
      { value: "completed", label: "Completed" },
      { value: "cancelled", label: "Cancelled" },
      { value: "onrequest", label: "On Request" },
      { value: "reconfirmed", label: "Reconfirmed" },
      { value: "invoiced", label: "Invoiced" },
    ],
    [],
  );

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: current - 2014 }, (_, i) => 2020 + i);
  }, []);

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

  const filteredBookings = useMemo(() => {
    const now = new Date();
    const needle = search.trim().toLowerCase();
    return (items || []).filter((b) => {
      const isCancelled =
        b.bookingStatus === "Cancelled" ||
        b.bookingStatus === "Auto Cancelled" ||
        b.cancelStatus === true;
      const isCompleted = b.bookingStatus === "Completed";
      const bDate = b.bookingDate
        ? new Date(
            String(b.bookingDate).includes("T")
              ? b.bookingDate
              : `${b.bookingDate}T00:00:00`,
          )
        : null;

      if (status === "cancelled" && !isCancelled) return false;
      if (status === "upcoming") {
        if (isCancelled || isCompleted) return false;
        if (!bDate || bDate < now) return false;
      }
      if (status === "completed") {
        if (!isCompleted) return false;
      }
      if (status === "onrequest") {
        if (isCancelled) return false;
        const s = normStatus(b.bookingStatus);
        if (
          s !== "pending" &&
          s !== "pendingapproval" &&
          s !== "guaranteepending" &&
          s !== "onrequest"
        )
          return false;
      }
      if (status === "reconfirmed") {
        if (isCancelled) return false;
        if (normStatus(b.bookingStatus) !== "reconfirmed") return false;
      }
      if (status === "invoiced") {
        // Restaurant bookings don't carry an invoice flag yet.
        const inv =
          normStatus(b.invoiceStatus) === "invoiced" ||
          b.invoiced === true ||
          b.isInvoiced === true;
        if (!inv) return false;
      }

      if (bDate && (selectedMonth || selectedYear)) {
        const m = bDate.getMonth() + 1;
        const y = bDate.getFullYear();
        if (selectedMonth && Number(selectedMonth) !== m) return false;
        if (selectedYear && Number(selectedYear) !== y) return false;
      }

      if (needle) {
        const hay = [
          b.bookingNumber,
          b.restaurantName,
          b.customerName,
          b.mobile,
          b.agentName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [items, search, status, selectedMonth, selectedYear]);

  useEffect(() => {
    setPage(1);
  }, [search, status, selectedMonth, selectedYear, perPage]);

  const totalEntries = filteredBookings.length;
  const safeTotalPages = Math.max(1, Math.ceil(totalEntries / perPage));
  const currentPage = Math.min(page, safeTotalPages);
  const serialNumberBase = (currentPage - 1) * perPage;
  const pageBookings = filteredBookings.slice(
    serialNumberBase,
    serialNumberBase + perPage,
  );
  const hasResults = totalEntries > 0;
  const displayStart = hasResults ? serialNumberBase + 1 : 0;
  const displayEnd = hasResults
    ? Math.min(serialNumberBase + pageBookings.length, totalEntries)
    : 0;

  const baseCellStyle = {
    padding: "0.5rem 0.6rem",
    fontSize: "0.8rem",
    border: "1px solid #dee2e6",
    verticalAlign: "middle",
    whiteSpace: "normal",
    overflow: "visible",
    wordBreak: "break-word",
    lineHeight: 1.4,
  };

  const baseHeaderStyle = {
    padding: "0.45rem 0.6rem",
    fontWeight: 600,
    textTransform: "uppercase",
    color: "#495057",
    border: "1px solid #dee2e6",
    whiteSpace: "normal",
    lineHeight: 1.2,
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column hbl-modern">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main
          className="flex-grow-1 p-3"
          style={{ width: "100%", overflow: "hidden" }}
        >
          <Container fluid className="px-0">
            {/* Header: Title + Search (left) | Time Period (right) */}
            <div className="d-flex justify-content-between align-items-end mb-3">
              <div>
                <h3 className="fw-bold text-dark mb-2">Restaurant Bookings</h3>
                <InputGroup style={{ height: "40px", width: "300px" }}>
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
                    placeholder="Search here..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                      borderLeft: "none",
                      fontSize: "0.85rem",
                      borderColor: "#dee2e6",
                      height: "40px",
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
                        className="form-control"
                        size="sm"
                        style={{ fontSize: "0.82rem", height: "45px" }}
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
                        className="form-control"
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

            {/* Booking Type filter */}
            <Row className="mb-2 g-1">
              <Col xs={12}>
                <Card
                  className="shadow-sm border-0 w-100"
                  style={{ borderRadius: "8px" }}
                >
                  <Card.Body className="p-3">
                    <h6
                      className="mb-2 fw-bold text-dark"
                      style={{ fontSize: "0.85rem", letterSpacing: "0.4px" }}
                    >
                      Booking Type
                    </h6>
                    <Row className="g-2">
                      <Col xs={12} md={6} lg={4} xl={3}>
                        <Form.Select
                          value={status}
                          onChange={(e) => setStatus(e.target.value)}
                          size="sm"
                          aria-label="Booking type filter"
                          style={{ fontSize: "0.85rem", height: "46px" }}
                        >
                          {statusOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </Form.Select>
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            {/* Table */}
            <Card
              className="shadow-sm border-0"
              style={{ borderRadius: "8px", overflow: "hidden", width: "100%" }}
            >
              <Card.Body className="p-0" style={{ width: "100%" }}>
                {loading ? (
                  <div className="text-center p-5">
                    <Spinner animation="border" variant="primary" />
                    <p className="mt-2 text-muted">Loading bookings...</p>
                  </div>
                ) : (
                  <div
                    className="thin-scrollbar"
                    style={{ overflowX: "auto", width: "100%" }}
                  >
                    <Table
                      hover
                      size="sm"
                      className="mb-0 align-middle table-bordered"
                      style={{
                        tableLayout: "auto",
                        width: "100%",
                        fontSize: "0.78rem",
                        borderCollapse: "separate",
                        borderSpacing: 0,
                        wordBreak: "break-word",
                      }}
                    >
                      <thead
                        style={{
                          backgroundColor: "#f8f9fa",
                          borderBottom: "2px solid #dee2e6",
                          boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
                          fontSize: "0.7rem",
                          letterSpacing: "0.03em",
                        }}
                      >
                        <tr>
                          <th
                            style={{
                              ...baseHeaderStyle,
                              textAlign: "center",
                              width: COLUMN_WIDTHS.sn,
                            }}
                          >
                            S.N
                          </th>
                          <th
                            style={{
                              ...baseHeaderStyle,
                              width: COLUMN_WIDTHS.booking,
                            }}
                          >
                            Booking
                          </th>
                          <th
                            style={{
                              ...baseHeaderStyle,
                              width: COLUMN_WIDTHS.restaurant,
                            }}
                          >
                            Restaurant
                          </th>
                          <th
                            style={{
                              ...baseHeaderStyle,
                              textAlign: "center",
                              width: COLUMN_WIDTHS.dateTime,
                            }}
                          >
                            Date / Time
                          </th>
                          <th
                            style={{
                              ...baseHeaderStyle,
                              textAlign: "center",
                              width: COLUMN_WIDTHS.members,
                            }}
                          >
                            Members
                          </th>
                          <th
                            style={{
                              ...baseHeaderStyle,
                              width: COLUMN_WIDTHS.customer,
                            }}
                          >
                            Customer
                          </th>
                          <th
                            style={{
                              ...baseHeaderStyle,
                              textAlign: "center",
                              width: COLUMN_WIDTHS.status,
                            }}
                          >
                            Status
                          </th>
                          <th
                            style={{
                              ...baseHeaderStyle,
                              textAlign: "center",
                              width: COLUMN_WIDTHS.action,
                            }}
                          >
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageBookings.length === 0 ? (
                          <tr>
                            <td
                              colSpan={8}
                              className="text-center py-5 text-muted"
                              style={{
                                border: "1px solid #dee2e6",
                                backgroundColor: "#ffffff",
                              }}
                            >
                              <FaInbox
                                style={{
                                  fontSize: "2.5rem",
                                  marginBottom: "10px",
                                  color: "#adb5bd",
                                }}
                              />
                              <p className="mt-2 mb-0 fs-5">
                                No bookings found.
                              </p>
                            </td>
                          </tr>
                        ) : (
                          pageBookings.map((b, i) => {
                            const sMeta = STATUS_META[b.bookingStatus];
                            return (
                              <tr
                                key={b.id || i}
                                style={{
                                  backgroundColor:
                                    i % 2 === 0 ? "#ffffff" : "#f8f9fa",
                                  transition: "background-color 0.2s ease",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor =
                                    "#e7f3ff";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor =
                                    i % 2 === 0 ? "#ffffff" : "#f8f9fa";
                                }}
                              >
                                <td
                                  className="text-muted fw-semibold"
                                  style={{
                                    ...baseCellStyle,
                                    textAlign: "center",
                                    color: "#6c757d",
                                    width: COLUMN_WIDTHS.sn,
                                  }}
                                >
                                  {serialNumberBase + i + 1}
                                </td>
                                <td
                                  style={{
                                    ...baseCellStyle,
                                    width: COLUMN_WIDTHS.booking,
                                  }}
                                >
                                  <span className="fw-bold text-primary">
                                    {b.bookingNumber || "-"}
                                  </span>
                                </td>
                                <td
                                  style={{
                                    ...baseCellStyle,
                                    width: COLUMN_WIDTHS.restaurant,
                                  }}
                                >
                                  <span className="fw-semibold text-dark">
                                    {b.restaurantName || "-"}
                                  </span>
                                </td>
                                <td
                                  className="text-muted"
                                  style={{
                                    ...baseCellStyle,
                                    textAlign: "center",
                                    width: COLUMN_WIDTHS.dateTime,
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  <div>{formatShortDate(b.bookingDate) || "-"}</div>
                                  {b.bookingTime && (
                                    <div
                                      className="text-muted"
                                      style={{ fontSize: "0.7rem" }}
                                    >
                                      {b.bookingTime}
                                    </div>
                                  )}
                                </td>
                                <td
                                  className="text-muted"
                                  style={{
                                    ...baseCellStyle,
                                    textAlign: "center",
                                    fontFamily: "monospace",
                                    width: COLUMN_WIDTHS.members,
                                  }}
                                >
                                  {b.memberCount ?? "-"}
                                </td>
                                <td
                                  style={{
                                    ...baseCellStyle,
                                    width: COLUMN_WIDTHS.customer,
                                  }}
                                >
                                  <div className="fw-medium text-dark">
                                    {b.customerName || "-"}
                                  </div>
                                  {b.mobile && (
                                    <div
                                      className="text-muted"
                                      style={{ fontSize: "0.7rem" }}
                                    >
                                      {b.mobile}
                                    </div>
                                  )}
                                </td>
                                <td
                                  style={{
                                    ...baseCellStyle,
                                    textAlign: "center",
                                    width: COLUMN_WIDTHS.status,
                                  }}
                                >
                                  <StatusPill
                                    meta={sMeta}
                                    raw={b.bookingStatus}
                                  />
                                </td>
                                <td
                                  style={{
                                    ...baseCellStyle,
                                    textAlign: "center",
                                    width: COLUMN_WIDTHS.action,
                                  }}
                                >
                                  <div className="d-flex justify-content-center align-items-center">
                                    <FaEye
                                      role="button"
                                      tabIndex={0}
                                      title="View full booking details"
                                      style={{
                                        fontSize: "18px",
                                        color: "#007bff",
                                        cursor: "pointer",
                                      }}
                                      onClick={() =>
                                        navigate(
                                          `/booking-details/restaurant-booking/${b.id}`,
                                        )
                                      }
                                      onKeyDown={(e) => {
                                        if (
                                          e.key === "Enter" ||
                                          e.key === " "
                                        ) {
                                          e.preventDefault();
                                          navigate(
                                            `/booking-details/restaurant-booking/${b.id}`,
                                          );
                                        }
                                      }}
                                    />
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </Table>
                  </div>
                )}
              </Card.Body>
            </Card>

            {/* Pagination */}
            {!loading && hasResults && (
              <Card
                className="shadow-sm border-0 mt-3"
                style={{ borderRadius: "8px" }}
              >
                <Card.Body className="py-3">
                  <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                    <div
                      className="text-muted"
                      style={{ fontSize: "0.875rem" }}
                    >
                      Showing{" "}
                      <span className="fw-semibold text-dark">
                        {displayStart}
                      </span>{" "}
                      to{" "}
                      <span className="fw-semibold text-dark">
                        {displayEnd}
                      </span>{" "}
                      of{" "}
                      <span className="fw-semibold text-dark">
                        {totalEntries}
                      </span>{" "}
                      entries
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <span
                        className="text-muted"
                        style={{ fontSize: "0.8rem" }}
                      >
                        Rows per page
                      </span>
                      <Form.Select
                        size="sm"
                        value={perPage}
                        onChange={(e) => setPerPage(Number(e.target.value))}
                        style={{ width: "auto", fontSize: "0.8rem" }}
                      >
                        {PER_PAGE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </Form.Select>
                    </div>
                    <Pagination className="mb-0">
                      <Pagination.Prev
                        disabled={currentPage === 1}
                        onClick={() =>
                          currentPage > 1 && setPage(currentPage - 1)
                        }
                        style={{
                          cursor:
                            currentPage === 1 ? "not-allowed" : "pointer",
                          opacity: currentPage === 1 ? 0.5 : 1,
                        }}
                      />
                      {Array.from(
                        { length: safeTotalPages },
                        (_, i) => i + 1,
                      ).map((pageNumber) => (
                        <Pagination.Item
                          key={pageNumber}
                          active={currentPage === pageNumber}
                          onClick={() => setPage(pageNumber)}
                          style={{
                            cursor: "pointer",
                            minWidth: "38px",
                            textAlign: "center",
                          }}
                        >
                          {pageNumber}
                        </Pagination.Item>
                      ))}
                      <Pagination.Next
                        disabled={currentPage === safeTotalPages}
                        onClick={() =>
                          currentPage < safeTotalPages &&
                          setPage(currentPage + 1)
                        }
                        style={{
                          cursor:
                            currentPage === safeTotalPages
                              ? "not-allowed"
                              : "pointer",
                          opacity:
                            currentPage === safeTotalPages ? 0.5 : 1,
                        }}
                      />
                    </Pagination>
                  </div>
                </Card.Body>
              </Card>
            )}
          </Container>
        </main>
      </div>
    </div>
  );
};

export default RestaurantBookingList;
