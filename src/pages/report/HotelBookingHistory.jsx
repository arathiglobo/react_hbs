import React, { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import BackButton from "../../components/BackButton";
import { Row, Col, Card, Form, Button, Table, Pagination, Modal } from "react-bootstrap";
import { toast } from "react-hot-toast";
import axiosInstance from "../../components/AxiosInstance";
import Agent from "../../components/filters/Agent";
import DestinationCity from "../../components/filters/DestinationCity";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { escapeHtml } from "../../utils/safeHtml";
import { csvCell } from "../../utils/csvSafe";
// .pagination-modern — the orange rounded pager used on /new-booking/hotel.
// Every rule in this stylesheet is namespaced under its own class names,
// so importing it here changes nothing else on this page.
import "../../styles/HotelSearch.css";

/**
 * Report → Hotel Booking History (admin only).
 *
 * Lists the search snapshots the booking page saves to
 * /api/search-history/save the moment an agent lands on it — i.e. hotels
 * that were selected from a New Booking search but whose booking tab was
 * closed before the booking was created. Confirmed bookings are flagged
 * server-side and drop off this list automatically.
 */
export default function HotelBookingHistory() {

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filters, applied on this page to the rows already loaded. Only filters
  // that match a column of this report are offered:
  //   Service Date   → Check-In column
  //   Hotel Name     → Hotel Name column
  //   City           → Destination / City column
  //   Booking Date   → Booking Date and Time column (when the snapshot was saved)
  //   Agent          → Agent column
  // A search snapshot has no cancellation deadline, reconfirm or cancel date,
  // so those three ranges are not offered here. Booking reference, supplier
  // reference, guest name, branch, status and service type are not offered
  // either — none of them is a column here.
  const initialFilters = {
    // Booking Details
    serviceDateFrom: "",
    serviceDateTo: "",
    hotelName: "",
    city: "",
    // Search Details
    bookingDateFrom: "",
    bookingDateTo: "",
    agentId: "",
  };
  const [filters, setFilters] = useState(initialFilters);

  // Mail dialog
  const [showMailModal, setShowMailModal] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [isSending, setIsSending] = useState(false);

  const updateFilter = (field, value) =>
    setFilters((prev) => ({ ...prev, [field]: value }));

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filters, itemsPerPage]);

  const handleReset = () => {
    setFilters(initialFilters);
    setSearchQuery("");
    setCurrentPage(1);
  };

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const response = await axiosInstance.get("/api/search-history");
      setHistory(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Failed to load hotel booking history:", error);
      toast.error("Failed to load hotel booking history");
      setHistory([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const closeMailModal = () => {
    if (isSending) return;
    setShowMailModal(false);
  };

  // The server re-reads the history and applies the same filters and quick
  // search as this page, so the mail holds the same rows as the screen.
  // Filters here apply as they are typed, so the current values are sent.
  const handleSendEmail = async () => {
    if (!emailAddress || !/^\S+@\S+\.\S+$/.test(emailAddress)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsSending(true);
    try {
      const response = await axiosInstance.post("/api/reports/send-email", {
        email: emailAddress.trim(),
        reportType: "hotelbookinghistory",
        filters: {
          ...filters,
          searchQuery,
        },
        recordCount: filteredRows.length,
      });
      if (response.data) {
        const sentCount = response.data.recordCount ?? filteredRows.length;
        toast.success(`Report with ${sentCount} record(s) sent successfully!`);
        setShowMailModal(false);
        setEmailAddress("");
      }
    } catch (error) {
      console.error("Email send error:", error);
      toast.error(error.response?.data?.message || "Failed to send mail");
    } finally {
      setIsSending(false);
    }
  };

  // "2026-07-15" / "2026-07-15T00:00" → "15/07/2026"; anything unparseable
  // is shown as-is so bad data is visible rather than hidden.
  const formatDate = (value) => {
    if (!value) return "—";
    const datePart = String(value).slice(0, 10);
    const parts = datePart.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return String(value);
  };

  // Whole-stay selling price of the rate picked on the room list,
  // e.g. "AED 107.00".
  const formatRate = (h) =>
    h.sellingPrice != null && !isNaN(Number(h.sellingPrice))
      ? `${h.currency || "AED"} ${Number(h.sellingPrice).toFixed(2)}`
      : "—";

  // ISO "2026-07-06T17:23:45" → "06/07/2026 05:23 PM" — the moment the
  // agent reached the booking page (when the snapshot row was recorded).
  const formatDateTime = (value) => {
    if (!value) return "—";
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const hours12 = String(d.getHours() % 12 || 12).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const ampm = d.getHours() >= 12 ? "PM" : "AM";
    return `${dd}/${mm}/${d.getFullYear()} ${hours12}:${minutes} ${ampm}`;
  };

  // Shared by Print / PDF / Excel so all three exports stay in sync with
  // the on-screen table.
  const exportHeaders = [
    'Sl.No',
    'Agent',
    'Hotel Name',
    'Destination / City',
    'Nationality',
    'Check-In',
    'Nights',
    'Check-Out',
    'Rooms & Guests',
    'Room Rate',
    'Booking Date and Time',
  ];

  const exportRow = (h, index) => [
    startIndex + index + 1,
    h.agentName || '—',
    h.hotelName || '—',
    h.destination || '—',
    h.nationality || '—',
    formatDate(h.checkIn),
    h.nights ?? '—',
    formatDate(h.checkOut),
    h.roomsGuests || '—',
    formatRate(h),
    formatDateTime(h.createdAt),
  ];

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Hotel Booking History Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            h1 { text-align: center; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <h1>Hotel Booking History Report</h1>
          <table>
            <thead>
              <tr>
                ${exportHeaders.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${currentRows.map((h, index) => `
                <tr>
                  ${exportRow(h, index).map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handlePDF = () => {
    const doc = new jsPDF('landscape');

    // Add title
    doc.text('Hotel Booking History Report', 20, 20);

    // Add table
    autoTable(doc, {
      head: [exportHeaders],
      body: currentRows.map((h, index) => exportRow(h, index)),
      startY: 30,
    });
    // Download PDF
    doc.save('Hotel-Booking-History-report.pdf');
  };

  const handleExcel = () => {
    // Create CSV content with proper escaping
    // csvCell neutralises text a spreadsheet would run as a formula.
    const escapeCSV = (value) => csvCell(value);

    const csvContent = [
      exportHeaders.map(escapeCSV).join(','),
      ...currentRows.map((h, index) =>
        exportRow(h, index).map(escapeCSV).join(','))
    ].join('\n');

    // Add BOM for UTF-8 to ensure proper Excel encoding
    const BOM = '﻿';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Hotel-Booking-History-report.csv';
    link.click();
    window.URL.revokeObjectURL(url);
  };

  // "yyyy-mm-dd" day of a date / date-time value ("" when missing).
  const dayOf = (value) => (value ? String(value).slice(0, 10) : "");

  // A row with no date is excluded only while that range is being filtered.
  const inRange = (day, from, to) =>
    (!from || (day && day >= from)) && (!to || (day && day <= to));

  const filteredRows = history.filter((h) => {
    // Service Date → check-in date of the stay.
    if (!inRange(dayOf(h.checkIn), filters.serviceDateFrom, filters.serviceDateTo)) {
      return false;
    }

    // Booking Date → createdAt, when the agent reached the booking page.
    if (!inRange(dayOf(h.createdAt), filters.bookingDateFrom, filters.bookingDateTo)) {
      return false;
    }

    // Agent — each row belongs to exactly one agent id.
    if (filters.agentId && String(h.agentId ?? "") !== String(filters.agentId)) {
      return false;
    }

    // Hotel Name
    if (filters.hotelName.trim()) {
      const needle = filters.hotelName.trim().toLowerCase();
      if (!String(h.hotelName || "").toLowerCase().includes(needle)) return false;
    }

    // City → destination, e.g. "Dubai" matches "Dubai, United Arab Emirates"
    if (filters.city.trim()) {
      const needle = filters.city.trim().toLowerCase();
      if (!String(h.destination || "").toLowerCase().includes(needle)) return false;
    }

    const search = searchQuery.toLowerCase();
    if (!search) return true;
    return (
      String(h.agentName || "").toLowerCase().includes(search) ||
      String(h.destination || "").toLowerCase().includes(search) ||
      String(h.nationality || "").toLowerCase().includes(search) ||
      String(h.hotelName || "").toLowerCase().includes(search) ||
      String(h.roomsGuests || "").toLowerCase().includes(search)
    );
  });

  const totalPages = Math.ceil(filteredRows.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentRows = filteredRows.slice(startIndex, endIndex);

  // Page buttons, as on /new-booking/hotel: always the first 3 and last 3
  // pages, plus the current page and its neighbours; "…" fills each gap.
  // A gap of a single page shows that page instead — an ellipsis there
  // would hide nothing. 30 pages on page 1 → 1 2 3 … 28 29 30.
  const pageNumbers = (() => {
    const EDGE_PAGES = 3;
    const shown = new Set();
    for (let i = 1; i <= Math.min(EDGE_PAGES, totalPages); i++) shown.add(i);
    for (let i = Math.max(1, totalPages - EDGE_PAGES + 1); i <= totalPages; i++) shown.add(i);
    for (let i = Math.max(1, currentPage - 1); i <= Math.min(totalPages, currentPage + 1); i++) {
      shown.add(i);
    }
    const sorted = Array.from(shown).sort((a, b) => a - b);
    const nums = [];
    sorted.forEach((n, idx) => {
      const prev = sorted[idx - 1];
      if (prev !== undefined && n - prev === 2) nums.push(prev + 1);
      else if (prev !== undefined && n - prev > 2) nums.push(`ellipsis-${prev}`);
      nums.push(n);
    });
    return nums;
  })();

  // From/To date pair laid out like every other report's date filters.
  const dateRange = (label, fromKey, toKey) => (
    <Form.Group className="mb-0">
      <Form.Label className="small mb-2">{label}</Form.Label>
      <div className="d-flex gap-2">
        <Form.Control type="date" size="sm" title="From"
          value={filters[fromKey]}
          onChange={(e) => updateFilter(fromKey, e.target.value)} />
        <Form.Control type="date" size="sm" title="To"
          value={filters[toKey]}
          onChange={(e) => updateFilter(toKey, e.target.value)} />
      </div>
    </Form.Group>
  );

  return (
    <div className="bg-light d-flex flex-column" style={{ minHeight: "100vh" }}>
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />

        <main className="flex-grow-1 p-4" style={{ overflow: "auto" }}>
          <Card className="shadow-sm rounded-xl">
            <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2 py-3">
              <div className="d-flex align-items-center gap-2">
                <BackButton forceFallback fallback="/adminDashboard" />
                <div>
                  <span className="fw-semibold">
                    <i className="fas fa-history me-2"></i>
                    Hotel Booking History
                  </span>
                  <div className="text-muted small mt-1">
                    Hotel searches that reached the booking page but were not
                    completed — entries are kept for one month
                  </div>
                </div>
              </div>
              <span className="badge rounded-pill bg-light text-muted border fw-normal">
                {filteredRows.length}{" "}
                {filteredRows.length === 1 ? "entry" : "entries"}
              </span>
            </Card.Header>

            {/* Filters Section */}
            <div className="p-4 bg-light border-bottom">
              <h6 className="fw-bold text-primary mb-3">Booking Details</h6>
              {/* One row — Service Date (check-in) / Hotel Name / Destination City */}
              <Row className="align-items-end g-4 mb-4">
                <Col md={4}>
                  {dateRange("Service Date", "serviceDateFrom", "serviceDateTo")}
                </Col>
                <Col md={4}>
                  <Form.Group className="mb-0">
                    <Form.Label className="small mb-2">Hotel Name</Form.Label>
                    <Form.Control size="sm" placeholder="Hotel name"
                      value={filters.hotelName}
                      onChange={(e) => updateFilter("hotelName", e.target.value)} />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className="mb-0">
                    <Form.Label className="small mb-2">Destination / City</Form.Label>
                    <DestinationCity
                      value={filters.city}
                      onChange={(cityName) => updateFilter("city", cityName)}
                    />
                  </Form.Group>
                </Col>
              </Row>

              <h6 className="fw-bold text-primary mb-3">Search Details</h6>
              {/* One row — Booking Date (when the agent reached the booking
                  page) / Agent, in the same columns as the row above */}
              <Row className="align-items-end g-4">
                <Col md={4}>
                  {dateRange("Booking Date", "bookingDateFrom", "bookingDateTo")}
                </Col>
                <Col md={4}>
                  <Agent
                    value={filters.agentId}
                    onChange={(id) => updateFilter("agentId", String(id))}
                  />
                </Col>
              </Row>

              {/* One line: "search here" box on the left;
                  Search / Reset / Mail / Print / PDF / Excel on the right.
                  Search and Reset share one width, wider than the exports. */}
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="search here"
                  className="form-control form-control-sm"
                  style={{ width: "200px" }}
                />

                <div className="d-flex gap-2 flex-wrap">
                  <Button
                    variant="success"
                    size="sm"
                    style={{ backgroundColor: "#676767", borderColor: "#676767", minWidth: "100px" }}
                    onClick={fetchHistory}
                    disabled={isLoading}
                  >
                    <i className="fas fa-search me-1"></i>Search
                  </Button>
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    style={{ minWidth: "100px" }}
                    onClick={handleReset}
                    disabled={isLoading}
                  >
                    <i className="fas fa-redo me-1"></i>Reset
                  </Button>
                  <Button variant="outline-primary" size="sm" onClick={() => setShowMailModal(true)}>
                    <i className="fas fa-envelope me-1"></i>Mail
                  </Button>
                  <Button variant="outline-secondary" size="sm" onClick={handlePrint}>
                    <i className="fas fa-print me-1"></i>Print
                  </Button>
                  <Button variant="outline-danger" size="sm" onClick={handlePDF}>
                    <i className="fas fa-file-pdf me-1"></i>PDF
                  </Button>
                  <Button variant="outline-success" size="sm" onClick={handleExcel}>
                    <i className="fas fa-file-excel me-1"></i>Excel
                  </Button>
                </div>
              </div>
            </div>

            {/* Table Section */}
            <Card.Body className="p-0 mt-1">
              <Table responsive hover striped className="mb-0 align-middle">
                <thead className="align-middle">
                  <tr>
                    <th style={{ width: 60 }}>S/N</th>
                    <th>Agent</th>
                    <th>Hotel Name</th>
                    <th>Destination / City</th>
                    <th>Nationality</th>
                    <th>Check-In</th>
                    <th>Nights</th>
                    <th>Check-Out</th>
                    <th>Rooms & Guests</th>
                    <th>Room Rate</th>
                    <th>Booking Date and Time</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan="11" className="text-center text-muted py-4">
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Loading...
                      </td>
                    </tr>
                  ) : currentRows.length > 0 ? (
                    currentRows.map((h, index) => (
                      <tr key={h.id || index}>
                        <td>{startIndex + index + 1}</td>
                        <td className="fw-semibold">{h.agentName || "—"}</td>
                        <td>{h.hotelName || "—"}</td>
                        <td>{h.destination || "—"}</td>
                        <td>{h.nationality || "—"}</td>
                        <td className="text-nowrap">{formatDate(h.checkIn)}</td>
                        <td>{h.nights ?? "—"}</td>
                        <td className="text-nowrap">{formatDate(h.checkOut)}</td>
                        <td>
                          {h.roomsGuests ? (
                            <span
                              className="badge rounded-pill bg-light text-dark border fw-normal"
                              style={{ fontSize: "inherit" }}
                            >
                              {h.roomsGuests}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="text-nowrap fw-semibold">
                          {formatRate(h)}
                        </td>
                        <td className="text-nowrap">
                          {formatDateTime(h.createdAt)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="11" className="text-center text-muted py-5">
                        <i
                          className="fas fa-inbox d-block mb-2"
                          style={{ fontSize: "1.5rem", opacity: 0.35 }}
                        ></i>
                        No data available in table
                        <div className="small mt-1">
                          Entries appear here when a hotel is selected from a
                          New Booking search but the booking page is closed
                          before the booking is confirmed.
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>

              {/* Pagination — page size and entry count on the left; the
                  /new-booking/hotel pager (pagination-modern) on the right */}
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 p-3 border-top">
                <div className="d-flex flex-wrap align-items-center gap-3">
                  <div className="d-flex align-items-center">
                    <span className="text-muted">Display</span>
                    <Form.Select size="sm" className="d-inline-block ms-2" style={{ width: "80px" }}
                      value={itemsPerPage}
                      onChange={(e) => setItemsPerPage(Number(e.target.value))}>
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </Form.Select>
                    <span className="text-muted ms-2">records</span>
                  </div>
                  <small className="text-muted">
                    Showing {filteredRows.length > 0 ? startIndex + 1 : 0} to {Math.min(endIndex, filteredRows.length)} of {filteredRows.length} entries
                  </small>
                </div>
                <Pagination className="mb-0 pagination-modern">
                  <Pagination.Prev
                    disabled={currentPage === 1 || totalPages === 0}
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  />
                  {pageNumbers.map((n) =>
                    typeof n === "number" ? (
                      <Pagination.Item
                        key={n}
                        active={n === currentPage}
                        onClick={() => setCurrentPage(n)}
                      >
                        {n}
                      </Pagination.Item>
                    ) : (
                      <Pagination.Ellipsis key={n} disabled />
                    ),
                  )}
                  <Pagination.Next
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  />
                </Pagination>
              </div>
            </Card.Body>
          </Card>

          {/* Mail — sends the rows behind the table to one address */}
          <Modal show={showMailModal} onHide={closeMailModal} centered>
            <Modal.Header closeButton={!isSending}>
              <Modal.Title>Send Report via Email</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form onSubmit={(e) => { e.preventDefault(); handleSendEmail(); }}>
                <Form.Group className="mb-3">
                  <Form.Label>Email Address<span className="text-danger">*</span></Form.Label>
                  <Form.Control
                    type="email"
                    placeholder="enter recipient email address"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    disabled={isSending}
                  />
                </Form.Group>
              </Form>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" type="button" onClick={closeMailModal} disabled={isSending}>
                Cancel
              </Button>
              <Button variant="success" type="button" onClick={handleSendEmail} disabled={isSending || !emailAddress}>
                {isSending ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Sending...
                  </>
                ) : (
                  <>
                    <i className="fas fa-paper-plane me-1"></i>Send Email
                  </>
                )}
              </Button>
            </Modal.Footer>
          </Modal>

        </main>
      </div>
    </div>
  );
}
