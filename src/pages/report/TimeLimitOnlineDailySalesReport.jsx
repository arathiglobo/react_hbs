import React, { useState, useMemo, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import { Row, Col, Card, Form, Button, Table, Modal, Pagination } from "react-bootstrap";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Agent from "../../components/filters/Agent";
import Staff from "../../components/filters/Staff";
import axiosInstance from "../../components/AxiosInstance";
import Supplier from "../../components/filters/Supplier";
import { toast } from "react-hot-toast";
import BackButton from "../../components/BackButton";
import { escapeHtml } from "../../utils/safeHtml";
import { csvCell } from "../../utils/csvSafe";
import { isAgentLogin } from "../../utils/supplierDisplay";
// .pagination-modern — the orange rounded pager used on /new-booking/hotel
// and Report → Hotel Booking History. Every rule in this stylesheet is
// namespaced under its own class names, so importing it here changes
// nothing else on this page.
import "../../styles/HotelSearch.css";

// "2026-04-23T00:00:00" → "2026-04-23" (keeps the Booking Details column narrow)
const toDateOnly = (value) => (value ? String(value).split("T")[0] : "");

export default function TimeLimitOnlineDailySalesReport() {

  const [timeList, setTimeList] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");

  // Server-side search filters (sent to /api/reports/timeLimitSales on Search).
  // Only filters that match a column of this report are offered, plus the
  // four booking date ranges. Book Date (fromDate/toDate) filters the booking
  // (sales) date. Supplier reference, city, branch, status and service type
  // were dropped — none of them is shown in this report.
  const initialFilters = {
    // Sales Details
    fromDate: "",       // Book Date from
    toDate: "",         // Book Date to
    agentId: "",        // Agent Name
    employeeId: "",     // Booking Done By (staff)
    supplierId: "",     // Supplier Name
    // Booking Details
    serviceDateFrom: "",
    serviceDateTo: "",
    deadlineDateFrom: "", // Deadline Date
    deadlineDateTo: "",
    reconfirmDateFrom: "",
    reconfirmDateTo: "",
    cancelDateFrom: "",
    cancelDateTo: "",
    bookingReference: "", // Booking Code (also matches the Reference Code)
    guestName: "",        // Customer Name
    serviceName: "",      // Booking Details — hotel name
  };
  const [tempFilters, setTempFilters] = useState(initialFilters);
  // Filters behind the rows on screen (set on Search / Reset), so the mailed
  // report matches the table even if the inputs were edited afterwards
  // without searching again.
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);

  // Mail dialog
  const [showMailModal, setShowMailModal] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [isSending, setIsSending] = useState(false);

  const updateFilter = (field, value) =>
    setTempFilters((prev) => ({ ...prev, [field]: value }));

  const activeRole = (sessionStorage.getItem("currentActiveRole") || "").trim().toUpperCase();
  const storedRoles = (sessionStorage.getItem("userRole") || "").toUpperCase();
  const isAgentRole = activeRole ? activeRole === "AGENT" : (storedRoles.includes("AGENT") && !storedRoles.includes("ADMIN"));
  // isAgentLogin() also covers sub-agents and sub-users (utils/supplierDisplay).
  const agentSide = isAgentLogin();
  // Supplier names are never shown to agents (owner rule).
  const showSupplier = !agentSide;

  const fetchSales = async (filters = {}) => {
    try {
      // Only send filters that actually carry a value
      const params = {};
      Object.entries(filters).forEach(([key, value]) => {
        const trimmed = typeof value === "string" ? value.trim() : value;
        if (trimmed !== "" && trimmed !== null && trimmed !== undefined) {
          params[key] = trimmed;
        }
      });
      const response = await axiosInstance.get("/api/reports/timeLimitSales", { params });
      const data = Array.isArray(response.data) ? response.data : [];
      setTimeList(data);
      return data;
    } catch (error) {
      console.error("error while fetching data", error);
      toast.error("Failed to fetch data");
      setTimeList([]);
      return [];
    }
  };

  useEffect(() => {
    // Initial load — with no dates the backend returns every booking in scope
    fetchSales();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const handleSearch = async () => {
    setCurrentPage(1);
    setAppliedFilters(tempFilters);
    const data = await fetchSales(tempFilters);
    toast.success(`Found ${data.length} record(s)`);
  };

  const handleReset = async () => {
    setTempFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setSearchQuery("");
    setCurrentPage(1);
    await fetchSales();
  };

  const closeMailModal = () => {
    if (isSending) return;
    setShowMailModal(false);
  };

  // The server re-runs the report with the filters behind the table (and the
  // quick search), so the mail holds the same rows as the screen.
  const handleSendEmail = async () => {
    if (!emailAddress || !/^\S+@\S+\.\S+$/.test(emailAddress)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsSending(true);
    try {
      const response = await axiosInstance.post("/api/reports/send-email", {
        email: emailAddress.trim(),
        reportType: "timelimitsales",
        filters: {
          ...appliedFilters,
          searchQuery,
        },
        recordCount: filteredreports.length,
      });
      if (response.data) {
        const sentCount = response.data.recordCount ?? filteredreports.length;
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

  const formatDetails = (r) => {
    if (r.bookingDetails) {
      const d = r.bookingDetails;
      const hotel = d.hotelName || d.hotelname || 'N/A';
      const from = toDateOnly(d.checkInDate || d.checkIndate);
      const to = toDateOnly(d.checkOutDate || d.checktodate);
      return `${hotel}\n${from} - ${to}`;
    }
    return r.details || 'N/A';
  };

  // Columns shared by Print, PDF and Excel, named as on screen (Supplier is
  // left out for agents). All three export every row matching the filters
  // and quick search — the same rows Mail sends — not just the current page.
  const exportHeaders = [
    'S/N', 'Agent Name', ...(showSupplier ? ['Supplier Name'] : []), 'Customer Name', 'Booking Code',
    'Reference Code', 'Booking Done By', 'Book Date', 'Booking Details', 'Deadline Date'
  ];
  const exportRow = (r, index) => [
    index + 1,
    r.agentName || 'N/A',
    ...(showSupplier ? [r.supplierName || 'N/A'] : []),
    r.customerName || 'N/A',
    r.bookingCode || 'N/A',
    r.referenceCode || 'N/A',
    r.bookingDoneBy || 'N/A',
    toDateOnly(r.bookingDate) || 'N/A',
    formatDetails(r),
    toDateOnly(r.deadlineDate) || 'N/A'
  ];

  const handlePrint = () => {
    // Booking Details holds "hotel\ncheck-in - check-out" — keep the break
    const detailsColumn = exportHeaders.indexOf('Booking Details');
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
      <head>
      <title>TimeLimit Online Sales Report</title>
      <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              table { width: 100%; border-collapse: collapse; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; font-weight: bold; }
              h1 { text-align: center; margin-bottom: 20px; }
              td.details { white-space: pre-line; }
            </style>
            </head>
            <body>
            <h1>TimeLimit Online Sales Report</h1>
            <table>
            <thead>
            <tr>${exportHeaders.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr>
            </thead>
            <tbody>
            ${filteredreports.map((r, index) =>
              `<tr>${exportRow(r, index).map((value, i) =>
                `<td${i === detailsColumn ? ' class="details"' : ''}>${escapeHtml(String(value))}</td>`
              ).join('')}</tr>`
            ).join('')}
            </tbody>
            </table>
            </body>
      </html>
      `);
    printWindow.document.close();
    printWindow.print();
  };

  const handlePDF = () => {
    // Landscape — the report has up to 10 columns
    const doc = new jsPDF({ orientation: "landscape" });
    doc.text("TimeLimit Online Sales Report", 14, 15);
    autoTable(doc, {
      head: [exportHeaders],
      body: filteredreports.map((r, index) =>
        exportRow(r, index).map((value) => (value === null || value === undefined ? "" : String(value)))
      ),
      startY: 20,
      styles: { fontSize: 8 },
    });
    doc.save("TimeLimit Online Sales Report.pdf");
  };

  const handleExcel = () => {
    // csvCell neutralises text a spreadsheet would run as a formula.
    const escapeCSV = (value) => csvCell(value);

    const csvContent = [
      exportHeaders.map(escapeCSV).join(','),
      ...filteredreports.map((r, index) => exportRow(r, index).map(escapeCSV).join(','))
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Time Limit Online Daily Sales Report .csv';
    link.click();
    window.URL.revokeObjectURL(url);
  };

  // Structured filters are applied server-side; only the quick text search
  // filters client-side.
  const filteredreports = useMemo(() => {
    return timeList.filter(a => {
      if (!searchQuery || !searchQuery.trim()) return true;
      const search = searchQuery.trim().toLowerCase();
      return (
        String(a.agentName || '').toLowerCase().includes(search) ||
        (showSupplier && String(a.supplierName || '').toLowerCase().includes(search)) ||
        String(a.customerName || '').toLowerCase().includes(search) ||
        String(a.bookingCode || '').toLowerCase().includes(search) ||
        String(a.referenceCode || '').toLowerCase().includes(search) ||
        String(a.bookingDoneBy || '').toLowerCase().includes(search) ||
        String(a.bookingDate || '').toLowerCase().includes(search) ||
        String(a.details || '').toLowerCase().includes(search) ||
        String(a.deadlineDate || '').toLowerCase().includes(search)
      );
    });
  }, [timeList, searchQuery, showSupplier]);


  const totalPages = useMemo(() => Math.ceil(filteredreports.length / itemsPerPage), [filteredreports.length, itemsPerPage]);
  const startIndex = useMemo(() => (currentPage - 1) * itemsPerPage, [currentPage, itemsPerPage]);
  const endIndex = useMemo(() => startIndex + itemsPerPage, [startIndex, itemsPerPage]);
  const currentreports = useMemo(() => filteredreports.slice(startIndex, endIndex), [filteredreports, startIndex, endIndex]);

  // Page buttons, as on Hotel Booking History and /new-booking/hotel: always
  // the first 3 and last 3 pages, plus the current page and its neighbours;
  // "…" fills each gap. A gap of a single page shows that page instead — an
  // ellipsis there would hide nothing. 30 pages on page 1 → 1 2 3 … 28 29 30.
  const pageNumbers = useMemo(() => {
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
  }, [totalPages, currentPage]);

  // From/To date pair. minWidth 0 lets the two inputs share their column
  // instead of spilling into the next field; the slimmer right padding keeps
  // "dd-mm-yyyy" and the calendar icon visible at that width.
  const dateInputStyle = { minWidth: 0, paddingRight: "0.5rem" };
  const dateRange = (label, fromKey, toKey) => (
    <Form.Group className="mb-0">
      <Form.Label className="small mb-2">{label}</Form.Label>
      <div className="d-flex gap-2">
        <Form.Control type="date" size="sm" title="From" style={dateInputStyle}
          value={tempFilters[fromKey]}
          onChange={(e) => updateFilter(fromKey, e.target.value)} />
        <Form.Control type="date" size="sm" title="To" style={dateInputStyle}
          value={tempFilters[toKey]}
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
            <Card.Header className="d-flex align-items-center gap-2">
              <BackButton forceFallback fallback={isAgentRole ? "/agentDashboard" : "/adminDashboard"} />
              <span className="fw-semibold">TimeLimit Online Sales Report</span>
            </Card.Header>
            {/* Filters Section — both sections share one column template on
                wide screens (xxl): date pair 3 | 3, then 2 | 2 | 2, so every
                field sits under the one above. Narrower screens show date
                pairs two per row and the text fields three per row. */}
            <div className="p-4 bg-light border-bottom">
              <h6 className="fw-bold text-primary mb-3">Booking Details</h6>
              <Row className="align-items-end g-4 mb-4">

                {/* Service Date / Cancel Date / Booking Code / Customer Name / Hotel Name */}
                <Col lg={6} xxl={3}>
                  {dateRange("Service Date", "serviceDateFrom", "serviceDateTo")}
                </Col>

              {/*  <Col md={6} xxl={3}>
                  <Form.Group className="mb-0">
                    <Form.Label className="small mb-2">Cancellation Deadline Date</Form.Label>
                    <div className="d-flex gap-2">
                      <Form.Control type="date" size="sm" title="From"
                        value={tempFilters.deadlineDateFrom}
                        onChange={(e) => updateFilter("deadlineDateFrom", e.target.value)} />
                      <Form.Control type="date" size="sm" title="To"
                        value={tempFilters.deadlineDateTo}
                        onChange={(e) => updateFilter("deadlineDateTo", e.target.value)} />
                    </div>
                  </Form.Group>
                </Col>
                <Col md={6} xxl={3}>
                  <Form.Group className="mb-0">
                    <Form.Label className="small mb-2">Reconfirm Date</Form.Label>
                    <div className="d-flex gap-2">
                      <Form.Control type="date" size="sm" title="From"
                        value={tempFilters.reconfirmDateFrom}
                        onChange={(e) => updateFilter("reconfirmDateFrom", e.target.value)} />
                      <Form.Control type="date" size="sm" title="To"
                        value={tempFilters.reconfirmDateTo}
                        onChange={(e) => updateFilter("reconfirmDateTo", e.target.value)} />
                    </div>
                  </Form.Group>
                </Col>*/}

                <Col lg={6} xxl={3}>
                  {dateRange("Cancel Date", "cancelDateFrom", "cancelDateTo")}
                </Col>

                <Col md={4} xxl={2}>
                  <Form.Group className="mb-0">
                    <Form.Label className="small mb-2">Booking Code</Form.Label>
                    <Form.Control size="sm" placeholder="Code or reference"
                      value={tempFilters.bookingReference}
                      onChange={(e) => updateFilter("bookingReference", e.target.value)} />
                  </Form.Group>
                </Col>
                <Col md={4} xxl={2}>
                  <Form.Group className="mb-0">
                    <Form.Label className="small mb-2">Customer Name</Form.Label>
                    <Form.Control size="sm" placeholder="Customer name"
                      value={tempFilters.guestName}
                      onChange={(e) => updateFilter("guestName", e.target.value)} />
                  </Form.Group>
                </Col>
                <Col md={4} xxl={2}>
                  <Form.Group className="mb-0">
                    <Form.Label className="small mb-2">Hotel Name</Form.Label>
                    <Form.Control size="sm" placeholder="Hotel name"
                      value={tempFilters.serviceName}
                      onChange={(e) => updateFilter("serviceName", e.target.value)} />
                  </Form.Group>
                </Col>
              </Row>

              <h6 className="fw-bold text-primary mb-3">Sales Details</h6>
              <Row className="align-items-end g-4">
                {/* Book Date / Supplier / Agent / Staff, in the same columns
                    as the row above */}
                <Col lg={6} xxl={3}>
                  {dateRange("Book Date", "fromDate", "toDate")}
                </Col>

                {/* Supplier and Agent are staff-only filters; agent logins
                    never see supplier names and only get their own sales. */}
                {showSupplier && (
                  <Col md={6} xxl={3}>
                    <Supplier
                      value={tempFilters.supplierId}
                      onChange={(id) => updateFilter("supplierId", String(id))}
                    />
                  </Col>
                )}

                {!agentSide && (
                  <Col md={6} xxl={2}>
                    <Agent
                      value={tempFilters.agentId}
                      onChange={(id) => updateFilter("agentId", String(id))}
                    />
                  </Col>
                )}

                {/* For an agent login Staff moves up next to Book Date, so it
                    takes the second date column's width */}
                <Col md={6} xxl={agentSide ? 3 : 2}>
                  <Staff
                    value={tempFilters.employeeId}
                    onChange={(id) => updateFilter("employeeId", String(id))}
                  />
                </Col>
              </Row>

              {/* One action row — quick search on the left; Search / Reset /
                  Mail / Print / PDF / Excel on the right */}
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e)=>setSearchQuery(e.target.value)}
                  placeholder="search here"
                  className="form-control form-control-sm"
                  style={{ width: 200 }}
                />
                <div className="d-flex flex-wrap justify-content-end align-items-center gap-2">
                  <Button variant="success" size="sm" className="px-4" style={{ backgroundColor: "#676767", borderColor: "#676767" }} onClick={handleSearch}>
                    <i className="fas fa-search me-1"></i>Search
                  </Button>
                  <Button variant="outline-secondary" size="sm" className="px-4" onClick={handleReset}>
                    <i className="fas fa-undo me-1"></i>Reset
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
                    <th>Agent Name</th>
                    {showSupplier && <th>Supplier Name</th>}
                    <th>Customer Name</th>
                    <th>Booking Code</th>
                    <th>Reference Code</th>
                    <th>Booking Done By</th>
                    <th>Book Date</th>
                    <th>Booking Details</th>
                    <th>Deadline Date</th>
                  </tr>
                </thead>
                <tbody>
                  {currentreports.length > 0 ? (
                    currentreports.map((r, index) => (
                      <tr key={index}>
                        <td>{startIndex + index + 1}</td>
                        <td>{r.agentName}</td>
                        {showSupplier && <td>{r.supplierName}</td>}
                        <td>{r.customerName}</td>
                        <td>{r.bookingCode}</td>
                        <td>{r.referenceCode}</td>
                        <td>{r.bookingDoneBy}</td>
                        <td className="text-nowrap">{toDateOnly(r.bookingDate)}</td>
                        <td style={{ whiteSpace: "pre-line" }}>
                          {r.bookingDetails ? (
                            <>
                              {r.bookingDetails.hotelName || r.bookingDetails.hotelname || 'N/A'}<br/>
                              <span className="text-nowrap">
                                {toDateOnly(r.bookingDetails.checkInDate || r.bookingDetails.checkIndate)} - {toDateOnly(r.bookingDetails.checkOutDate || r.bookingDetails.checktodate)}
                              </span>
                            </>
                          ) : r.details ? (
                            r.details
                          ) : (
                            'N/A'
                          )}
                        </td>
                        <td className="text-nowrap">{toDateOnly(r.deadlineDate)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={showSupplier ? 10 : 9} className="text-center text-muted py-4">
                        No data available in table
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>

              {/* Pagination — page size and entry count on the left */}
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 p-3 border-top">
                <div className="d-flex flex-wrap align-items-center gap-3">
                  <div className="d-flex align-items-center">
                    <span className="text-muted">Display</span>
                    <Form.Select size="sm" className="d-inline-block ms-2" style={{width: '80px'}}
                      value={itemsPerPage}
                      onChange={(e)=>{setItemsPerPage(Number(e.target.value))
                        setCurrentPage(1);
                      }}>
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </Form.Select>
                    <span className="text-muted ms-2">records</span>
                  </div>
                  <small className="text-muted">
                    Showing {filteredreports.length > 0 ? startIndex + 1 : 0} to {Math.min(endIndex, filteredreports.length)} of {filteredreports.length} entries
                  </small>
                </div>
                {/* The /new-booking/hotel pager (pagination-modern) */}
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
