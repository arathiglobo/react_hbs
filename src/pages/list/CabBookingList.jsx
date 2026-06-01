import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Form,
  Table,
  Badge,
  InputGroup,
  Spinner,
  Modal,
  Pagination,
} from "react-bootstrap";
import {
  FaSearch,
  FaTrash,
  FaCalendarAlt,
  FaUserAlt,
  FaEye,
  FaCar,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaEnvelope,
  FaIdCard,
  FaFileInvoice,
} from "react-icons/fa";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import toast from "react-hot-toast";

const PER_PAGE_OPTIONS = [10, 25, 50, 100];

const CabBookingList = () => {
  const [role, setRole] = useState(() => {
    return localStorage.getItem("currentActiveRole")?.toLowerCase() || null;
  });
  const [userId, setUserId] = useState(() => {
    const stored = localStorage.getItem("userId");
    return (stored && stored !== "null") ? stored : null;
  });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("upcoming");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [voucherLoading, setVoucherLoading] = useState(false);
  // Booking-details view modal
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsBooking, setDetailsBooking] = useState(null);
  const [apiData, setApiData] = useState({
    upcomingBookings: { content: [] },
    completedBookings: { content: [] },
    cancelledBookings: { content: [] },
  });
  const [pagination, setPagination] = useState({
    upcoming: { page: 1, perPage: 10 },
    completed: { page: 1, perPage: 10 },
    cancelled: { page: 1, perPage: 10 },
  });

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2014 }, (_, i) => 2020 + i);

  // Handle role sync if it's missing from localStorage initially
  useEffect(() => {
    const storedRole = localStorage.getItem("currentActiveRole")?.toLowerCase();
    if (storedRole && storedRole !== role) {
      setRole(storedRole);
    } else if (!storedRole) {
      // Fallback to userRole if currentActiveRole is missing
      const userRoles = (localStorage.getItem("userRole") || "").toLowerCase().split(",");
      if (userRoles.includes("agent")) setRole("agent");
      else if (userRoles.includes("staff")) setRole("staff");
      else if (userRoles.includes("admin")) setRole("admin");
    }
  }, [role]);

  // Fetch userId if missing
  useEffect(() => {
    const fetchUserId = async () => {
      // Don't fetch if we already have a valid userId
      if (userId && userId !== "null") return;
      
      const userName = localStorage.getItem("UserName") || sessionStorage.getItem("UserName");
      if (!userName) return;

      try {
        const response = await axiosInstance.get(`/api/personalProfile/${userName}`);
        if (response.data && response.data.id) {
          const id = String(response.data.id);
          setUserId(id);
          localStorage.setItem("userId", id);
        }
      } catch (error) {
        console.error("Error fetching user profile for ID:", error);
      }
    };

    if (role === "agent" || role === "staff") {
      fetchUserId();
    }
  }, [role, userId]);

  const fetchBookings = useCallback(async () => {
    // SECURITY BLOCK:
    // 1. If role is missing, we don't know what to fetch.
    if (!role) {
      console.log("Blocking fetchBookings: role is missing.");
      return;
    }

    // 2. If we are an agent or staff but don't have the ID yet, do NOT call.
    if ((role === "agent" || role === "staff") && (!userId || userId === "null")) {
      console.log("Blocking fetchBookings: role is " + role + " but userId is missing.");
      return;
    }

    try {
      setLoading(true);
      const params = {
        upcomingPage: Math.max(pagination.upcoming.page - 1, 0),
        upcomingSize: pagination.upcoming.perPage,
        completedPage: Math.max(pagination.completed.page - 1, 0),
        completedSize: pagination.completed.perPage,
        cancelledPage: Math.max(pagination.cancelled.page - 1, 0),
        cancelledSize: pagination.cancelled.perPage,
      };

      if (selectedMonth && selectedYear) {
        params.month = Number(selectedMonth);
        params.year = Number(selectedYear);
      }

      // Role-based filtering
      if (role === "agent" && userId) {
        params.agentId = userId;
      } else if (role === "staff" && userId) {
        params.staffId = userId;
      }

      const response = await axiosInstance.get("/api/cab/grouped-list", { params });
      if (response.data && response.data.success) {
        setApiData({
          upcomingBookings: response.data.upcomingBookings || { content: [] },
          completedBookings: response.data.completedBookings || { content: [] },
          cancelledBookings: response.data.cancelledBookings || { content: [] },
        });
      }
    } catch {
      toast.error("Failed to load cab bookings");
    } finally {
      setLoading(false);
    }
  }, [pagination, selectedMonth, selectedYear, role, userId]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleMonthChange = (value) => {
    setSelectedMonth(value);
    resetAllPages();
  };

  const handleYearChange = (value) => {
    setSelectedYear(value);
    resetAllPages();
  };

  const resetAllPages = () => {
    setPagination((prev) => ({
      upcoming: { ...prev.upcoming, page: 1 },
      completed: { ...prev.completed, page: 1 },
      cancelled: { ...prev.cancelled, page: 1 },
    }));
  };

  const handlePageChange = (nextPage) => {
    setPagination((prev) => ({
      ...prev,
      [status]: { ...prev[status], page: nextPage },
    }));
  };

  const handlePageSizeChange = (nextSize) => {
    setPagination((prev) => ({
      ...prev,
      [status]: { ...prev[status], perPage: nextSize, page: 1 },
    }));
  };

  const getCurrentList = () => {
    if (status === "upcoming") return apiData.upcomingBookings.content || [];
    if (status === "completed") return apiData.completedBookings.content || [];
    if (status === "cancelled") return apiData.cancelledBookings.content || [];
    return [];
  };

  const filteredBookings = useMemo(() => {
    const list = getCurrentList();
    if (!search.trim()) return list;
    return list.filter(
      (b) =>
        b.packageBookCode?.toLowerCase().includes(search.toLowerCase()) ||
        b.cabName?.toLowerCase().includes(search.toLowerCase()) ||
        b.transporter?.toLowerCase().includes(search.toLowerCase()) ||
        b.customer?.firstName?.toLowerCase().includes(search.toLowerCase()) ||
        b.customer?.lastName?.toLowerCase().includes(search.toLowerCase())
    );
  }, [apiData, status, search]);

  const handleCancelClick = (booking) => {
    setSelectedBooking(booking);
    setShowCancelModal(true);
  };

  const handleCancelBooking = async () => {
    if (!selectedBooking) return;
    try {
      setCancelling(true);
      const response = await axiosInstance.delete(
        `/api/cab/delete/${selectedBooking.custombookingId}`
      );
      if (response.data?.status === "success") {
        toast.success("Booking cancelled");
        setShowCancelModal(false);
        fetchBookings();
      } else {
        toast.error("Cancel failed");
      }
    } catch {
      toast.error("Error cancelling booking");
    } finally {
      setCancelling(false);
    }
  };

  // Voucher action → backend (CabBookingController#getCabBookingPdf) returns a
  // PdfGenerationResponseDTO with { status, message, pdfUrl }; open the URL in a
  // new tab so the browser renders the PDF inline. Mirrors LongStayBookingList.
  const handleVoucher = async (b) => {
    const id = b.custombookingId;
    if (!id) return;
    try {
      setVoucherLoading(true);
      const res = await axiosInstance.get(`/api/cab/${id}/pdf`, {
        params: { type: "VOUCHER" },
      });
      if (res.data && res.data.status === "SUCCESS" && res.data.pdfUrl) {
        window.open(res.data.pdfUrl, "_blank", "noopener,noreferrer");
        toast.success("Voucher opened in a new tab");
      } else {
        toast.error(res.data?.message || "Failed to generate voucher");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to generate voucher");
    } finally {
      setVoucherLoading(false);
    }
  };

  const formatPrice = (price) =>
    new Intl.NumberFormat("en-AE", {
      style: "currency",
      currency: "AED",
    }).format(price || 0);

  const formatDate = (date) => {
    if (!date) return "-";
    try {
      return new Date(date).toLocaleDateString();
    } catch {
      return date;
    }
  };

  const currentTabPagination = apiData[`${status}Bookings`] || {};
  const totalPages = currentTabPagination.totalPages || 0;
  const totalElements = currentTabPagination.totalElements || 0;
  const currentPage = pagination[status].page;
  const currentPerPage = pagination[status].perPage;

  return (
    <div className="min-vh-100 d-flex flex-column" style={{ background: "#f8fafc" }}>
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4" style={{ overflow: "hidden" }}>
          <Container fluid>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h4 className="fw-semibold text-dark mb-0">Cab Bookings</h4>
              <Button
                variant="dark"
                size="sm"
                onClick={fetchBookings}
                disabled={loading}
                className="px-3 rounded-pill"
              >
                {loading ? <Spinner size="sm" /> : "Refresh"}
              </Button>
            </div>

            {/* Search and Filters */}
            <Row className="mb-4 g-3">
              <Col md={4}>
                <InputGroup className="shadow-sm rounded-3 overflow-hidden bg-white border">
                  <InputGroup.Text className="bg-white border-0">
                    <FaSearch size={13} className="text-muted" />
                  </InputGroup.Text>
                  <Form.Control
                    placeholder="Search by Booking Code, Cab or Transporter..."
                    className="border-0 shadow-none py-2"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </InputGroup>
              </Col>
            </Row>

            <Row className="mb-4 g-3">
              {/* Type Filter */}
              <Col lg={6}>
                <Card className="border-0 shadow-sm h-100" style={{ borderRadius: "12px" }}>
                  <Card.Body className="p-3">
                    <h6 className="mb-3 fw-bold text-dark small text-uppercase" style={{ letterSpacing: "0.5px" }}>
                      Booking Types
                    </h6>
                    <div className="d-flex gap-4">
                      {["upcoming", "completed", "cancelled"].map((type) => (
                        <Form.Check
                          key={type}
                          type="radio"
                          id={type}
                          name="statusType"
                          label={type.charAt(0).toUpperCase() + type.slice(1)}
                          checked={status === type}
                          onChange={() => setStatus(type)}
                          className="fw-medium text-capitalize"
                        />
                      ))}
                    </div>
                  </Card.Body>
                </Card>
              </Col>

              {/* Date Filter */}
              <Col lg={6}>
                <Card className="border-0 shadow-sm h-100" style={{ borderRadius: "12px" }}>
                  <Card.Body className="p-3">
                    <h6 className="mb-3 fw-bold text-dark small text-uppercase" style={{ letterSpacing: "0.5px" }}>
                      Time Period
                    </h6>
                    <Row className="g-2">
                      <Col xs={6}>
                        <Form.Select
                          size="sm"
                          value={selectedMonth}
                          onChange={(e) => handleMonthChange(e.target.value)}
                          className="border px-3 py-2"
                        >
                          <option value="">Month</option>
                          {months.map((m, idx) => (
                            <option key={m} value={idx + 1}>{m}</option>
                          ))}
                        </Form.Select>
                      </Col>
                      <Col xs={6}>
                        <Form.Select
                          size="sm"
                          value={selectedYear}
                          onChange={(e) => handleYearChange(e.target.value)}
                          className="border px-3 py-2"
                        >
                          <option value="">Year</option>
                          {years.map((y) => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </Form.Select>
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            {/* Table */}
            <Card className="border-0 shadow-sm" style={{ borderRadius: "12px" }}>
              <Card.Body className="p-0">
                <div className="table-responsive">
                  <Table bordered hover className="mb-0 align-middle small">
                    <thead className="bg-light text-muted uppercase small font-weight-bold">
                      <tr>
                        {role === "admin" && <th>Agent Name</th>}
                        <th className="ps-4 py-3">Booking</th>
                        <th>Customer Name</th>
                        <th>Cab Details</th>
                        <th>Travel Info</th>
                        <th>Pax</th>
                        <th>Amount</th>
                        <th className="text-center pe-4">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan="7" className="text-center py-5">
                            <Spinner animation="border" size="sm" variant="primary" className="me-2" />
                            <span className="text-muted">Loading bookings...</span>
                          </td>
                        </tr>
                      ) : filteredBookings.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="text-center py-5 text-muted">No cab bookings found in this category</td>
                        </tr>
                      ) : (
                        filteredBookings.map((b) => (
                          <tr key={b.custombookingId}>
                            {role === "admin" && (
                              <td className="ps-4">
                                <div className="fw-bold text-dark">{b.agentName || "-"}</div>
                              </td>
                            )}
                            <td className="ps-4">
                              <div className="fw-bold text-dark">{b.packageBookCode}</div>
                              <small className="text-muted">{formatDate(b.bookingDate)}</small>
                            </td>
                            <td>
                              <div className="fw-medium text-dark">
                                {b.customer?.salutaion} {b.customer?.firstName} {b.customer?.lastName}
                              </div>
                              <small className="text-muted d-block">{b.customer?.emailId}</small>
                            </td>
                            <td>
                              <div className="fw-bold text-primary">{b.cabName}</div>
                              <small className="text-muted d-block">{b.transporter}</small>
                            </td>
                            <td>
                              <div className="d-flex align-items-center text-muted">
                                <FaCalendarAlt size={10} className="me-2 text-primary" />
                                {b.pickupDate}
                              </div>
                            </td>
                            <td>
                              <div className="d-flex align-items-center text-muted">
                                <FaUserAlt size={10} className="me-2 text-primary" />
                                {b.noOfAdult}A / {b.noOfChild}C
                              </div>
                            </td>
                            <td>
                              <div className="fw-bold text-dark">{formatPrice(b.totalPrice)}</div>
                            </td>
                            <td className="text-center pe-4">
                              <div className="d-inline-flex gap-2">
                                <Button
                                  variant="light"
                                  size="sm"
                                  className="rounded-pill px-3 border"
                                  title="View booking details"
                                  onClick={() => {
                                    setDetailsBooking(b);
                                    setShowDetailsModal(true);
                                  }}
                                >
                                  <FaEye size={12} className="text-primary" />
                                </Button>
                                <Button
                                  variant="light"
                                  size="sm"
                                  className="rounded-pill px-3 border"
                                  title="Voucher"
                                  disabled={voucherLoading}
                                  onClick={() => handleVoucher(b)}
                                >
                                  {voucherLoading ? (
                                    <Spinner size="sm" />
                                  ) : (
                                    <FaFileInvoice size={12} className="text-success" />
                                  )}
                                </Button>
                                {status === "upcoming" && (
                                  <Button
                                    variant="light"
                                    size="sm"
                                    className="rounded-pill px-3 border"
                                    title="Cancel booking"
                                    onClick={() => handleCancelClick(b)}
                                  >
                                    <FaTrash size={12} className="text-danger" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </Table>
                </div>

                {/* Pagination */}
                {!loading && totalElements > 0 && (
                  <div className="px-4 py-3 d-flex justify-content-between align-items-center border-top">
                    <div className="d-flex align-items-center gap-3">
                      <span className="small text-muted">Showing {filteredBookings.length} of {totalElements} entries</span>
                      <Form.Select
                        size="sm"
                        className="w-auto"
                        value={currentPerPage}
                        onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                      >
                        {PER_PAGE_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>{opt} / page</option>
                        ))}
                      </Form.Select>
                    </div>
                    <Pagination size="sm" className="mb-0">
                      <Pagination.Prev 
                        disabled={currentPage === 1}
                        onClick={() => handlePageChange(currentPage - 1)}
                      />
                      {[...Array(totalPages)].map((_, idx) => (
                        <Pagination.Item
                          key={idx + 1}
                          active={idx + 1 === currentPage}
                          onClick={() => handlePageChange(idx + 1)}
                        >
                          {idx + 1}
                        </Pagination.Item>
                      )).slice(Math.max(0, currentPage - 3), Math.min(totalPages, currentPage + 2))}
                      <Pagination.Next 
                        disabled={currentPage === totalPages}
                        onClick={() => handlePageChange(currentPage + 1)}
                      />
                    </Pagination>
                  </div>
                )}
              </Card.Body>
            </Card>

            <Modal show={showCancelModal} onHide={() => !cancelling && setShowCancelModal(false)} centered>
              <Modal.Header closeButton={!cancelling}>
                <Modal.Title>Cancel Cab Booking</Modal.Title>
              </Modal.Header>
              <Modal.Body className="text-center py-4">
                <p className="mb-1 text-muted">Are you sure you want to cancel this booking?</p>
                <h5 className="mb-0">{selectedBooking?.packageBookCode}</h5>
                <p className="text-primary small mt-2">{selectedBooking?.cabName}</p>
              </Modal.Body>
              <Modal.Footer className="justify-content-center border-0 pb-4">
                <Button variant="light" className="px-4" onClick={() => setShowCancelModal(false)} disabled={cancelling}>No, Keep</Button>
                <Button variant="dark" className="px-4" onClick={handleCancelBooking} disabled={cancelling}>
                  {cancelling ? <Spinner size="sm" className="me-2" /> : "Yes, Cancel"}
                </Button>
              </Modal.Footer>
            </Modal>

            {/* ── Booking Details modal ───────────────────────────────── */}
            <Modal
              show={showDetailsModal}
              onHide={() => setShowDetailsModal(false)}
              size="lg"
              centered
              scrollable
            >
              <Modal.Header closeButton className="border-0 pb-0">
                <Modal.Title className="d-flex align-items-center">
                  <FaCar className="me-2 text-primary" />
                  Booking Details
                  {detailsBooking?.packageBookCode && (
                    <Badge bg="primary-subtle" text="primary" className="ms-3">
                      {detailsBooking.packageBookCode}
                    </Badge>
                  )}
                </Modal.Title>
              </Modal.Header>
              <Modal.Body className="py-2">
                {!detailsBooking ? (
                  <div className="text-center py-3 text-muted">
                    No booking selected.
                  </div>
                ) : (
                  <>
                    {/* ── Top strip: meta + cab/route in a single compact
                        table so the modal stays dense and scannable. */}
                    <Table size="sm" borderless className="mb-2">
                      <tbody>
                        <tr>
                          <td className="text-muted small" style={{ width: 130 }}>Code</td>
                          <td className="fw-semibold">
                            {detailsBooking.packageBookCode || "—"}
                          </td>
                          <td className="text-muted small" style={{ width: 100 }}>Booked</td>
                          <td className="fw-semibold">
                            {formatDate(detailsBooking.bookingDate)}
                          </td>
                          <td className="text-muted small" style={{ width: 70 }}>Status</td>
                          <td>
                            <Badge
                              bg={detailsBooking.cancelStatus ? "danger-subtle" : "success-subtle"}
                              text={detailsBooking.cancelStatus ? "danger" : "success"}
                            >
                              {detailsBooking.cancelStatus ? "Cancelled" : "Confirmed"}
                            </Badge>
                          </td>
                        </tr>
                        <tr>
                          <td className="text-muted small">Cab</td>
                          <td className="fw-semibold">
                            {detailsBooking.cabName || "—"}
                          </td>
                          <td className="text-muted small">Pickup</td>
                          <td className="fw-semibold">
                            {detailsBooking.pickupDate || "—"}
                            {detailsBooking.pickupName ? ` · ${detailsBooking.pickupName}` : ""}
                            {detailsBooking.pickupTime ? ` ${detailsBooking.pickupTime}` : ""}
                          </td>
                          <td className="text-muted small">Dropoff</td>
                          <td className="fw-semibold">
                            {detailsBooking.dropOffDate || detailsBooking.dropoffDate || detailsBooking.pickupDate || "—"}
                            {detailsBooking.dropoffName ? ` · ${detailsBooking.dropoffName}` : ""}
                            {detailsBooking.dropoffTime ? ` ${detailsBooking.dropoffTime}` : ""}
                          </td>
                        </tr>
                        {(detailsBooking.transporter || detailsBooking.driverName) && (
                          <tr>
                            <td className="text-muted small">Transporter</td>
                            <td className="fw-semibold">
                              {detailsBooking.transporter || "—"}
                              {detailsBooking.contactNumber ? ` · ${detailsBooking.contactNumber}` : ""}
                            </td>
                            <td className="text-muted small">Driver</td>
                            <td className="fw-semibold" colSpan={3}>
                              {detailsBooking.driverName || "—"}
                              {detailsBooking.driverContact ? ` · ${detailsBooking.driverContact}` : ""}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </Table>

                    {/* ── Passenger manifest — one row per pax from
                        cab_guest. Falls back to the legacy adult/child
                        counts when the backend has no manifest yet. */}
                    <div className="d-flex justify-content-between align-items-center mt-3 mb-1">
                      <h6 className="fw-bold mb-0">
                        <FaUserAlt className="me-2 text-primary" />
                        Passengers
                      </h6>
                      <span className="text-muted small">
                        {detailsBooking.noOfAdult ?? 0} Adult
                        {(detailsBooking.noOfAdult ?? 0) !== 1 ? "s" : ""}
                        {(detailsBooking.noOfChild ?? 0) > 0
                          ? `, ${detailsBooking.noOfChild} Child${detailsBooking.noOfChild !== 1 ? "ren" : ""}`
                          : ""}
                      </span>
                    </div>
                    {Array.isArray(detailsBooking.guests) && detailsBooking.guests.length > 0 ? (
                      <Table size="sm" bordered hover className="mb-3">
                        <thead className="table-light">
                          <tr>
                            <th style={{ width: 50 }}>#</th>
                            <th style={{ width: 80 }}>Type</th>
                            <th>Name</th>
                            <th style={{ width: 80 }}>Age</th>
                            <th>Passport</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailsBooking.guests.map((g, idx) => (
                            <tr key={g.id || idx}>
                              <td>{g.guestIndex || idx + 1}</td>
                              <td>
                                <Badge
                                  bg={g.isChild ? "info-subtle" : "primary-subtle"}
                                  text={g.isChild ? "info" : "primary"}
                                >
                                  {g.isChild ? "Child" : "Adult"}
                                </Badge>
                              </td>
                              <td>
                                {[g.salutation, g.firstName, g.middleName, g.lastName]
                                  .filter(Boolean).join(" ") || "—"}
                              </td>
                              <td>{g.age ?? "—"}</td>
                              <td>{g.passportNo || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    ) : (
                      <div className="small text-muted mb-3">
                        No per-pax manifest captured for this booking.
                        {Array.isArray(detailsBooking.childAgeArray) &&
                          detailsBooking.childAgeArray.length > 0 && (
                            <span> Child ages: {detailsBooking.childAgeArray.join(", ")}.</span>
                          )}
                      </div>
                    )}

                    {/* ── Primary contact + LPO — single compact row. */}
                    <h6 className="fw-bold mb-1">Primary Contact</h6>
                    <Table size="sm" borderless className="mb-3">
                      <tbody>
                        <tr>
                          <td className="text-muted small" style={{ width: 80 }}>Name</td>
                          <td className="fw-semibold">
                            {[
                              detailsBooking.customer?.salutaion,
                              detailsBooking.customer?.firstName,
                              detailsBooking.customer?.lastName,
                            ].filter(Boolean).join(" ") || "—"}
                          </td>
                          <td className="text-muted small" style={{ width: 60 }}>
                            <FaPhoneAlt className="me-1" />Phone
                          </td>
                          <td className="fw-semibold">
                            {detailsBooking.customer?.contactNumber || "—"}
                          </td>
                        </tr>
                        <tr>
                          <td className="text-muted small">
                            <FaEnvelope className="me-1" />Email
                          </td>
                          <td className="fw-semibold">
                            {detailsBooking.customer?.emailId || "—"}
                          </td>
                          <td className="text-muted small">
                            <FaIdCard className="me-1" />Passport
                          </td>
                          <td className="fw-semibold">
                            {detailsBooking.customer?.passportNumber || "—"}
                          </td>
                        </tr>
                        {detailsBooking.lpo && (
                          <tr>
                            <td className="text-muted small">LPO</td>
                            <td className="fw-semibold" colSpan={3}>
                              {detailsBooking.lpo}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </Table>

                    {/* ── Pricing — kept tight (single rounded panel). */}
                    <div className="p-2 px-3 bg-light rounded">
                      {detailsBooking.sellingPrice != null && (
                        <div className="d-flex justify-content-between text-muted small">
                          <span>Selling Price</span>
                          <span className="fw-medium">
                            {formatPrice(detailsBooking.sellingPrice)}
                          </span>
                        </div>
                      )}
                      {detailsBooking.totalRate != null &&
                        Number(detailsBooking.totalRate) !==
                          Number(detailsBooking.totalPrice) && (
                          <div className="d-flex justify-content-between text-muted small">
                            <span>Total Rate</span>
                            <span className="fw-medium">
                              {formatPrice(detailsBooking.totalRate)}
                            </span>
                          </div>
                        )}
                      {detailsBooking.tourismDirham != null &&
                        Number(detailsBooking.tourismDirham) > 0 && (
                          <div className="d-flex justify-content-between text-primary small">
                            <span>Tourism Dirham</span>
                            <span className="fw-medium">
                              + {formatPrice(detailsBooking.tourismDirham)}
                            </span>
                          </div>
                        )}
                      <div className="d-flex justify-content-between align-items-center border-top pt-1 mt-1">
                        <span className="fw-semibold">Total Amount</span>
                        <span className="fs-6 fw-bold text-success">
                          {formatPrice(detailsBooking.totalPrice)}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </Modal.Body>
              <Modal.Footer>
                <Button
                  variant="secondary"
                  onClick={() => setShowDetailsModal(false)}
                >
                  Close
                </Button>
              </Modal.Footer>
            </Modal>
          </Container>
        </main>
      </div>
    </div>
  );
};

export default CabBookingList;