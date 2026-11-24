import React, { useEffect, useState, useMemo } from "react";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import {
  Row,
  Col,
  Card,
  Form,
  Button,
  Table,
  Modal,
  Pagination,
} from "react-bootstrap";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Agent from "../../components/filters/Agent";
import Staff from "../../components/filters/Staff";
import axiosInstance from "../../components/AxiosInstance";
import chevronStyle from "../../components/filters/dropdownChevron";
import { toast } from "react-hot-toast";
import BackButton from "../../components/BackButton";
import { isAgentLogin } from "../../utils/supplierDisplay";
import { escapeHtml } from "../../utils/safeHtml";
import { csvCell } from "../../utils/csvSafe";
// .pagination-modern — the orange rounded pager used on /new-booking/hotel
// and the other sales reports. Every rule in this stylesheet is namespaced
// under its own class names, so importing it changes nothing else here.
import "../../styles/HotelSearch.css";

// Supplier filter for offline bookings. Offline line items store the id of a
// supplier from the supplier master (/api/supplier — the list the offline
// booking forms pick from), not one of the online API suppliers the shared
// Supplier filter lists, so this report needs its own list. Same look and
// behaviour as the shared filter: type to search, click to pick.
function OfflineSupplierFilter({ value, onChange }) {
  const [suppliers, setSuppliers] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    // The endpoint is paged; one large page loads the whole list.
    axiosInstance
      .get("/api/supplier", { params: { page: 0, limit: 1000 } })
      .then((res) => setSuppliers(Array.isArray(res.data) ? res.data : []))
      .catch((err) => console.error("Failed to fetch suppliers:", err));
  }, []);

  const selectedOption = suppliers.find(
    (s) => String(s.supplierId) === String(value)
  );

  const filteredSuppliers = searchTerm
    ? suppliers.filter((s) =>
        (s.name || "").toLowerCase().includes(searchTerm.toLowerCase())
      )
    : suppliers;

  const close = () => {
    setIsOpen(false);
    setSearchTerm("");
  };

  return (
    <Form.Group>
      <Form.Label>Supplier</Form.Label>
      <div className="position-relative">
        <Form.Control
          size="sm"
          style={chevronStyle}
          value={isOpen ? searchTerm : selectedOption?.name || ""}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Select supplier"
          autoComplete="off"
        />

        {isOpen && (
          <>
            <div
              className="position-absolute w-100 bg-white border shadow-lg"
              style={{ zIndex: 1050, maxHeight: "200px", overflowY: "auto", top: "100%" }}
            >
              {filteredSuppliers.length > 0 ? (
                filteredSuppliers.map((s) => (
                  <div
                    key={s.supplierId}
                    className="px-3 py-2"
                    style={{ cursor: "pointer" }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8f9fa")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "white")}
                    onClick={() => {
                      onChange(s.supplierId);
                      close();
                    }}
                  >
                    {s.name}
                  </div>
                ))
              ) : (
                <div className="px-3 py-2 text-muted">No suppliers found</div>
              )}
            </div>

            {/* Backdrop — a click outside closes the list */}
            <div
              className="position-fixed"
              style={{ top: 0, left: 0, right: 0, bottom: 0, zIndex: 1040 }}
              onClick={close}
            />
          </>
        )}
      </div>
    </Form.Group>
  );
}

export default function OfflineBookingDailySalesStatement() {

  const [sales, setSales] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Server-side search filters (sent to /api/report/offline-daily-sales on
  // Search). Only the filters that fit this report's columns are kept:
  // Sales Date (Date), Agent (Agent Name), Staff (Booking Done By), Supplier
  // (Supplier Name), Booking Reference (Reference Number / Invoice Number),
  // Guest Name (customer in Booking Details), plus the booking date ranges.
  // The supplier reference / service / city / branch / status /
  // service-type filters were removed — no column shows them.
  const initialFilters = {
    // Sales Details
    fromDate: "",
    toDate: "",
    agentId: "",
    staffId: "",
    supplierId: "",
    // Booking Details
    serviceDateFrom: "",
    serviceDateTo: "",
    deadlineDateFrom: "",
    deadlineDateTo: "",
    reconfirmDateFrom: "",
    reconfirmDateTo: "",
    cancelDateFrom: "",
    cancelDateTo: "",
    bookingReference: "", // reference number or invoice number
    guestName: "",        // customer name
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
  // Net Price (our cost) and Profit (our margin) are not shown to agents —
  // the server also leaves them out of the agent's statement data.
  // isAgentLogin() also covers sub-agents and sub-users (utils/supplierDisplay).
  const showCost = !isAgentLogin();
  // Supplier names are never shown to agents (owner rule).
  const showSupplier = !isAgentLogin();

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
      const response = await axiosInstance.get("/api/report/offline-daily-sales", { params });
      setSales(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Offline daily sales fetch error", error);
      toast.error("Failed to load sales data");
      setSales([]);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  useEffect(() => {
    fetchSales();
  }, []);

  const handleSearch = async () => {
    setCurrentPage(1);
    setAppliedFilters(tempFilters);
    await fetchSales(tempFilters);
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

  // The server re-runs the report with the filters behind the table (and
  // the quick search), so the mail holds the same rows as the screen.
  const handleSendEmail = async () => {
    if (!emailAddress || !/^\S+@\S+\.\S+$/.test(emailAddress)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsSending(true);
    try {
      const response = await axiosInstance.post("/api/reports/send-email", {
        email: emailAddress.trim(),
        reportType: "offlinedailysales",
        filters: {
          ...appliedFilters,
          searchQuery,
        },
        recordCount: filteredsales.length,
      });
      if (response.data) {
        const sentCount = response.data.recordCount ?? filteredsales.length;
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

  const formatDate = (value) => (value ? String(value).split("T")[0] : "_");

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Offline Booking Daily Sales Statement</title>
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
          <h1>Offline Booking Daily Sales Statement</h1>
          <table>
            <thead>
              <tr>
                <th>Sl.No</th>
                <th>Date</th>
                <th>Invoice No</th>
                ${showSupplier ? '<th>Supplier</th>' : ''}
                <th>Agent</th>
                <th>Booking By</th>
                <th>Reference</th>
                <th>Details</th>
                 <th>Selling Price</th>
                 ${showCost ? '<th>Net Price</th><th>Profit</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${filteredsales.map((s, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${escapeHtml(formatDate(s.date))}</td>
                  <td>${escapeHtml(s.invoiceNumber || '')}</td>
                  ${showSupplier ? `<td>${escapeHtml(s.supplier || '')}</td>` : ''}
                  <td>${escapeHtml(s.agent || '')}</td>
                  <td>${escapeHtml(s.bookingBy || '')}</td>
                  <td>${escapeHtml(s.reference || '')}</td>
                  <td class="details">${escapeHtml(s.details || '')}</td>
                   <td>${escapeHtml(s.sellingPrice)}</td>
                   ${showCost ? `<td>${escapeHtml(s.netPrice)}</td><td>${escapeHtml(s.profit)}</td>` : ''}
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

  // Columns shared by the Excel and PDF exports (Supplier / Net Price /
  // Profit are left out for agents, as on screen).
  const exportHeaders = ['Sl.No', 'Date', 'Invoice No', ...(showSupplier ? ['Supplier'] : []), 'Agent', 'Booking By', 'Reference', 'Details', 'Selling Price',
    ...(showCost ? ['Net Price', 'Profit'] : [])];
  const exportRow = (s, index) => [
    index + 1,
    formatDate(s.date),
    s.invoiceNumber,
    ...(showSupplier ? [s.supplier] : []),
    s.agent,
    s.bookingBy,
    s.reference,
    s.details,
    s.sellingPrice,
    ...(showCost ? [s.netPrice, s.profit] : [])
  ];

  const handlePDF = () => {
    // Landscape — the statement has up to 11 columns
    const doc = new jsPDF({ orientation: "landscape" });
    doc.text("Offline Booking Daily Sales Statement", 14, 15);
    autoTable(doc, {
      head: [exportHeaders],
      body: filteredsales.map((s, index) =>
        exportRow(s, index).map((value) => (value === null || value === undefined ? "" : String(value)))
      ),
      startY: 20,
      styles: { fontSize: 8 },
    });
    doc.save("Offline Booking Daily Sales Statement.pdf");
  };

  const handleExcel = () => {
    // Create CSV content with proper escaping
    // csvCell neutralises text a spreadsheet would run as a formula.
    const escapeCSV = (value) => csvCell(value);

    const csvContent = [
      exportHeaders.map(escapeCSV).join(','),
      ...filteredsales.map((s, index) => exportRow(s, index).map(escapeCSV).join(','))
    ].join('\n');

    // Add BOM for UTF-8 to ensure proper Excel encoding
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Offline Booking Daily Sales Statement.csv';
    link.click();
    window.URL.revokeObjectURL(url);
  };

  // Structured filters are applied server-side; only the quick text search
  // filters client-side.
  const filteredsales = useMemo(() => {
    return sales.filter(s => {
      if (!searchQuery || !searchQuery.trim()) return true;
      const search = searchQuery.trim().toLowerCase();
      return (
        String(s.date || '').toLowerCase().includes(search) ||
        String(s.invoiceNumber || '').toLowerCase().includes(search) ||
        (showSupplier && String(s.supplier || '').toLowerCase().includes(search)) ||
        String(s.agent || '').toLowerCase().includes(search) ||
        String(s.bookingBy || '').toLowerCase().includes(search) ||
        String(s.reference || '').toLowerCase().includes(search) ||
        String(s.details || '').toLowerCase().includes(search) ||
        String(s.sellingPrice || '').toLowerCase().includes(search) ||
        String(s.netPrice || '').toLowerCase().includes(search) ||
        String(s.profit || '').toLowerCase().includes(search)
      );
    });
  }, [sales, searchQuery]);

  const totalPages = useMemo(() => Math.ceil(filteredsales.length / itemsPerPage), [filteredsales.length, itemsPerPage]);
  const startIndex = useMemo(() => (currentPage - 1) * itemsPerPage, [currentPage, itemsPerPage]);
  const endIndex = useMemo(() => startIndex + itemsPerPage, [startIndex, itemsPerPage]);
  const currentSales = useMemo(() => filteredsales.slice(startIndex, endIndex), [filteredsales, startIndex, endIndex]);

  // Page buttons, as on the other sales reports: always the first 3 and
  // last 3 pages, plus the current page and its neighbours; "…" fills each
  // gap. A gap of a single page shows that page instead — an ellipsis there
  // would hide nothing. 30 pages on page 1 → 1 2 3 … 28 29 30.
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

  // Columns in the results table (Supplier / Net Price / Profit are hidden
  // from agents) — keeps the "No data" row spanning the full width.
  const columnCount = 8 + (showSupplier ? 1 : 0) + (showCost ? 2 : 0);

  // One labelled From / To date pair. Every filter column uses the same
  // width, so the Booking Details and Sales Details rows line up.
  // minWidth 0 lets the two inputs share their column instead of spilling
  // into the next field (global CSS makes them wide); the slimmer right
  // padding keeps "dd-mm-yyyy" and the calendar icon visible at that width.
  const dateInputStyle = { minWidth: 0, paddingRight: "0.5rem" };
  const renderDateRange = (label, fromKey, toKey) => (
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
  const filterCol = { xs: 12, md: 6, xxl: 3 };

  return (
    <div className="bg-light d-flex flex-column" style={{ minHeight: "100vh" }}>
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />

        <main className="flex-grow-1 p-4" style={{ overflow: "auto" }}>
          <Card className="shadow-sm rounded-xl">
            <Card.Header className="d-flex align-items-center gap-2">
              <BackButton forceFallback fallback={isAgentRole ? "/agentDashboard" : "/adminDashboard"} />
              <span className="fw-semibold">Offline Daily Sales Statement Report</span>
            </Card.Header>

            {/* Filters Section — Booking Details and Sales Details share one
                4-column grid (2 per row below xxl), so the fields line up. */}
            <div className="p-4 bg-light border-bottom">
              <h6 className="fw-bold text-primary mb-3">Booking Details</h6>
              <Row className="align-items-end g-4 mb-4">
                <Col {...filterCol}>
                  {renderDateRange("Service Date", "serviceDateFrom", "serviceDateTo")}
                </Col>
                {/* <Col {...filterCol}>
                  {renderDateRange("Cancellation Deadline Date", "deadlineDateFrom", "deadlineDateTo")}
                </Col> */}
                <Col {...filterCol}>
                  {renderDateRange("Reconfirm Date", "reconfirmDateFrom", "reconfirmDateTo")}
                </Col>
                {/* <Col {...filterCol}>
                  {renderDateRange("Cancel Date", "cancelDateFrom", "cancelDateTo")}
                </Col> */}
                <Col {...filterCol}>
                  <Form.Group className="mb-0">
                    <Form.Label className="small mb-2">Booking Reference</Form.Label>
                    <Form.Control size="sm" placeholder="Reference or invoice no."
                      value={tempFilters.bookingReference}
                      onChange={(e) => updateFilter("bookingReference", e.target.value)} />
                  </Form.Group>
                </Col>
                <Col {...filterCol}>
                  <Form.Group className="mb-0">
                    <Form.Label className="small mb-2">Guest Name</Form.Label>
                    <Form.Control size="sm" placeholder="Guest name"
                      value={tempFilters.guestName}
                      onChange={(e) => updateFilter("guestName", e.target.value)} />
                  </Form.Group>
                </Col>
              </Row>

              <h6 className="fw-bold text-primary mb-3">Sales Details</h6>
              <Row className="align-items-end g-4">
                <Col {...filterCol}>
                  {renderDateRange("Sales Date", "fromDate", "toDate")}
                </Col>
                {!isAgentRole && (
                  <Col {...filterCol}>
                    <Agent
                      value={tempFilters.agentId}
                      onChange={(id) => updateFilter("agentId", String(id))} />
                  </Col>
                )}
                <Col {...filterCol}>
                  <Staff
                    value={tempFilters.staffId}
                    onChange={(id) => updateFilter("staffId", String(id))} />
                </Col>
                {/* Supplier names are never shown to agents, so the
                    filter (and its column) is left out for them. */}
                {showSupplier && (
                  <Col {...filterCol}>
                    <OfflineSupplierFilter
                      value={tempFilters.supplierId}
                      onChange={(id) => updateFilter("supplierId", String(id))} />
                  </Col>
                )}
              </Row>

              {/* One line: quick search on the left; Search / Reset / Mail /
                  Print / PDF / Excel on the right. Search and Reset are
                  wider than the export buttons. */}
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
                    <th>Date</th>
                    <th>Invoice Number</th>
                    {showSupplier && <th>Supplier Name</th>}
                    <th>Agent Name</th>
                    <th>Booking Done By</th>
                    <th>Reference Number</th>
                    <th>Booking Details</th>
                    <th>Selling Price</th>
                    {showCost && <th>Net Price</th>}
                    {showCost && <th>Profit</th>}
                  </tr>
                </thead>
                <tbody>
                  {currentSales.length > 0 ? (
                    currentSales.map((s, index) => (
                      <tr key={s.bookingId}>
                        <td>{startIndex + index + 1}</td>
                        <td>{formatDate(s.date)}</td>
                        <td>{s.invoiceNumber}</td>
                        {showSupplier && <td>{s.supplier}</td>}
                        <td>{s.agent}</td>
                        <td>{s.bookingBy}</td>
                        <td>{s.reference}</td>
                        <td style={{ whiteSpace: "pre-line" }}>{s.details}</td>
                        <td>{s.sellingPrice}</td>
                        {showCost && <td>{s.netPrice}</td>}
                        {showCost && <td>{s.profit}</td>}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={columnCount} className="text-center text-muted py-4">
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
                    Showing {filteredsales.length > 0 ? startIndex + 1 : 0} to {Math.min(endIndex, filteredsales.length)} of {filteredsales.length} entries
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
