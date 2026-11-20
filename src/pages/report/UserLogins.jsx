import React, { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import BackButton from "../../components/BackButton";
import { Row, Col, Card, Form,Button,Table,Modal, Pagination, Spinner } from "react-bootstrap";
import { toast } from "react-hot-toast";
import axiosInstance from "../../components/AxiosInstance";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { escapeHtml } from "../../utils/safeHtml";
import { csvCell } from "../../utils/csvSafe";
// pagination-modern (orange pager), as on the other report pages
import "../../styles/HotelSearch.css";

// Same "2026-Jul-29 - 09:55:21 AM" formatter the User Management → Login Logs
// page uses, so a login prints identically on both screens. Null (an open
// session with no logout yet) renders as "0000:00:00" so an unclosed session
// is visually distinct from a closed one.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n) => String(n).padStart(2, "0");

const formatAudit = (iso) => {
  if (!iso) return "0000:00:00";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  let hh = d.getHours();
  const ampm = hh >= 12 ? "PM" : "AM";
  hh = hh % 12 || 12;
  return `${d.getFullYear()}-${MONTHS[d.getMonth()]}-${pad(d.getDate())} - ${pad(hh)}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${ampm}`;
};

// user_types.type_name → label: "SUPER_ADMIN" → "Super Admin".
const prettyType = (t) =>
  String(t || "")
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");

const EMPTY_FILTERS = { fromDate: "", toDate: "", loginType: "", user: "" };

export default function UserLogins() {

  const [currentPage,setCurrentPage]=useState(1);
  const [itemsPerPage,setItemsPerPage]=useState(10);
  const [searchQuery,setSearchQuery]=useState("");
  const[showMailModal,setShowMailModal]=useState(false);
  const[emailAddress,setEmailAddress]=useState("");
  const[isSending,setIsSending]=useState(false);

  // Rows currently on screen (whatever the last Search returned).
  const [logins, setLogins] = useState([]);
  // The unfiltered page-load set. Feeds the Login Type / User dropdowns so
  // they list exactly the types and users that actually appear in the log,
  // and stay complete while a narrower result set is being shown.
  const [allLogins, setAllLogins] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  // Filters behind the rows on screen (set on Search / Reset), so the mailed
  // report matches the table even if the inputs were edited afterwards
  // without searching again.
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);

  useEffect(()=>{
    setCurrentPage(1);
  },[searchQuery]);

  // Filters are applied server-side (/api/report/user-logins); only
  // non-empty values are sent so an untouched control adds no constraint.
  const fetchLogins = async (applied = {}) => {
    setIsLoading(true);
    try {
      const params = {};
      Object.entries(applied).forEach(([key, value]) => {
        const trimmed = typeof value === "string" ? value.trim() : value;
        if (trimmed !== "" && trimmed !== null && trimmed !== undefined) {
          params[key] = trimmed;
        }
      });
      const response = await axiosInstance.get("/api/report/user-logins", { params });
      const rows = Array.isArray(response.data) ? response.data : [];
      setLogins(rows);
      return rows;
    } catch (error) {
      console.error("error while fetching user logins", error);
      toast.error(error.response?.data?.message || "Failed to load user logins");
      setLogins([]);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  // Page load: every login, newest first.
  useEffect(() => {
    fetchLogins().then((rows) => setAllLogins(rows));
  }, []);

  const loginTypeOptions = useMemo(
    () =>
      Array.from(new Set(allLogins.map((r) => r.loginType).filter(Boolean))).sort(),
    [allLogins],
  );

  // Users narrowed to the chosen Login Type (all users when none is chosen).
  const userOptions = useMemo(() => {
    const byUser = new Map();
    allLogins.forEach((r) => {
      if (!r.code) return;
      if (filters.loginType && r.loginType !== filters.loginType) return;
      if (!byUser.has(r.code)) byUser.set(r.code, r.name || r.code);
    });
    return Array.from(byUser, ([username, name]) => ({ username, name })).sort((a, b) =>
      a.username.localeCompare(b.username, undefined, { sensitivity: "base" }),
    );
  }, [allLogins, filters.loginType]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      // Changing the type drops a picked user that no longer belongs to it.
      if (key === "loginType" && prev.user) {
        const stillValid = allLogins.some(
          (r) => r.code === prev.user && (!value || r.loginType === value),
        );
        if (!stillValid) next.user = "";
      }
      return next;
    });
  };

  const handleSearch = async () => {
    // yyyy-MM-dd strings compare correctly as plain strings.
    if (filters.fromDate && filters.toDate && filters.toDate < filters.fromDate) {
      toast.error("To Date must be on or after From Date");
      return;
    }
    setCurrentPage(1);
    setAppliedFilters(filters);
    await fetchLogins(filters);
  };

  const handleReset = async () => {
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setSearchQuery("");
    setCurrentPage(1);
    await fetchLogins();
  };

  const handleSendEmail=async()=>{
    if(!emailAddress|| !/^\S+@\S+\.\S+$/.test(emailAddress)){
      toast.error("please enter a valid email address");
      return;
    }
    setIsSending(true);
    try{
      // The server re-runs the report with the filters behind the table
      const response=await axiosInstance.post('/api/reports/send-email',{
        email : emailAddress,
        reportType:'logins',
         filters:{
           ...appliedFilters,
           searchQuery,
         },
         recordCount: filteredlogins.length,
      })
      if(response.data){
        const sentCount = response.data.recordCount ?? filteredlogins.length;
        toast.success(`Report with ${sentCount} record(s) sent successfully!`)
        setShowMailModal(false);
        setEmailAddress("");
      }
    }
    catch(error){
      console.error("Email send error:", error);
      toast.error(error.response?.data?.message || "Failed to send mail")
    }finally{
      setIsSending(false);
    }

  }

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>User Login Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            h1 { text-align: center; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <h1>User Login Report</h1>
          <table>
            <thead>
              <tr>
                <th>Sl.No</th>
                <th>Code</th>
                <th>Name</th>
                <th>Login Type</th>
                <th>Login</th>
                <th>Logout</th>
              </tr>
            </thead>
            <tbody>
              ${currentLogins.map((l, index) => `
                <tr>
                  <td>${escapeHtml(startIndex + index + 1)}</td>
                  <td>${escapeHtml(l.code || "")}</td>
                  <td>${escapeHtml(l.name || "")}</td>
                  <td>${escapeHtml(prettyType(l.loginType))}</td>
                  <td>${escapeHtml(formatAudit(l.login))}</td>
                  <td>${escapeHtml(formatAudit(l.logout))}</td>
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
        const doc = new jsPDF();

        // Add title
        doc.text('User Login Report', 20, 20);

        // Add table
        autoTable(doc, {
          head: [['Sl.No', 'Code', 'Name', 'Login Type', 'Login', 'Logout' ]],
          body: currentLogins.map((l, index) => [
            startIndex + index + 1,
            l.code || "",
            l.name || "",
            prettyType(l.loginType),
            formatAudit(l.login),
            formatAudit(l.logout),
            ]),
          startY: 30,
        });
         // Download PDF
        doc.save('User-Login-report.pdf');
      };

      const handleExcel = () => {
    const headers = ['Sl.No', 'Code', 'Name', 'Login Type', 'Login', 'Logout'];

    // Create CSV content with proper escaping
    // csvCell neutralises text a spreadsheet would run as a formula.
    const escapeCSV = (value) => csvCell(value);

    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...currentLogins.map((l, index) => [
        startIndex + index + 1,
            l.code || "",
            l.name || "",
            prettyType(l.loginType),
            formatAudit(l.login),
            formatAudit(l.logout),
      ].map(escapeCSV).join(','))
    ].join('\n');

    // Add BOM for UTF-8 to ensure proper Excel encoding
    const BOM = '﻿';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'User-Login-report.csv';
    link.click();
    window.URL.revokeObjectURL(url);
  };


// Quick in-memory search over the visible columns (dates are matched on
// the formatted text the user actually sees).
const filteredlogins = logins.filter(l=>{
  const search = searchQuery.toLowerCase();
  if (!search) return true;
  return(
    String(l.code || "").toLowerCase().includes(search)||
    String(l.name || "").toLowerCase().includes(search)||
    prettyType(l.loginType).toLowerCase().includes(search)||
    formatAudit(l.login).toLowerCase().includes(search)||
    formatAudit(l.logout).toLowerCase().includes(search)
  )})

  const totalPages = Math.ceil(filteredlogins.length / itemsPerPage);
  const startIndex =(currentPage -1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentLogins = filteredlogins.slice(startIndex,endIndex);

  // Page buttons, as on Online Daily Sales and Time Limit: always the first 3
  // and last 3 pages, plus the current page and its neighbours; "…" fills
  // each gap. A gap of a single page shows that page instead — an ellipsis
  // there would hide nothing. 30 pages on page 1 → 1 2 3 … 28 29 30.
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

  return (
    <div className="bg-light d-flex flex-column" style={{ minHeight: "100vh" }}>
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />

        <main className="flex-grow-1 p-4" style={{ overflow: "auto" }}>
          <Card className="shadow-sm rounded-xl">
            <Card.Header className="d-flex align-items-center gap-2">
              <BackButton forceFallback fallback="/adminDashboard" />
              <span className="fw-semibold">User Logins Report</span>
            </Card.Header>

            {/* Filters Section */}
            <div className="p-4 bg-light border-bottom">
              <Row className="align-items-end g-4">
                <Col md={3}>
                  <Form.Group className="mb-0">
                    <Form.Label className="small mb-2">From Date</Form.Label>
                    <Form.Control
                      type="date"
                      size="sm"
                      value={filters.fromDate}
                      max={filters.toDate || undefined}
                      onChange={(e) => handleFilterChange("fromDate", e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group className="mb-0">
                    <Form.Label className="small mb-2">To Date</Form.Label>
                    <Form.Control
                      type="date"
                      size="sm"
                      value={filters.toDate}
                      min={filters.fromDate || undefined}
                      onChange={(e) => handleFilterChange("toDate", e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group className="mb-0">
                    <Form.Label className="small mb-2">Login Type</Form.Label>
                    <Form.Select
                      size="sm"
                      value={filters.loginType}
                      onChange={(e) => handleFilterChange("loginType", e.target.value)}
                    >
                      <option value="">Select</option>
                      {loginTypeOptions.map((t) => (
                        <option key={t} value={t}>{prettyType(t)}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group className="mb-0">
                    <Form.Label className="small mb-2">User</Form.Label>
                    <Form.Select
                      size="sm"
                      value={filters.user}
                      onChange={(e) => handleFilterChange("user", e.target.value)}
                    >
                      <option value="">Select</option>
                      {userOptions.map((u) => (
                        <option key={u.username} value={u.username}>
                          {u.name && u.name !== u.username ? `${u.username} – ${u.name}` : u.username}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>

              {/* One action row — quick search on the left; Search / Reset /
                  Mail / Print / PDF / Excel on the right (as on Online Daily Sales) */}
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
                  <Button variant="success" size="sm" className="px-4" style={{ backgroundColor: "#676767", borderColor: "#676767" }} onClick={handleSearch} disabled={isLoading}>
                    <i className="fas fa-search me-1"></i>Search
                  </Button>
                  <Button variant="outline-secondary" size="sm" className="px-4" onClick={handleReset} disabled={isLoading}>
                    <i className="fas fa-undo me-1"></i>Reset
                  </Button>
                  <Button variant="outline-primary" size="sm" onClick={()=>(setShowMailModal(true))}>
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
                <thead>
                  <tr>
                    <th style={{ width: 100 }}>S/N</th>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Login Type</th>
                    <th>Login</th>
                    <th>Logout</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan="6" className="text-center text-muted py-4">
                        <Spinner animation="border" size="sm" className="me-2" />
                        Loading user logins...
                      </td>
                    </tr>
                  ) : currentLogins.length > 0 ? (
                    currentLogins.map((l, index) => (
                      <tr key={l.id}>
                        <td>{startIndex + index + 1}</td>
                        <td>{l.code || "—"}</td>
                        <td>{l.name || "—"}</td>
                        <td>{prettyType(l.loginType) || "—"}</td>
                        <td>{formatAudit(l.login)}</td>
                        <td>{formatAudit(l.logout)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="text-center text-muted py-4">
                        No data available in table
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>

              {/* Pagination */}
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 p-3 border-top">
                <div>
                  <small className="text-muted">
                    Showing {filteredlogins.length > 0 ? startIndex + 1 : 0} to {Math.min(endIndex, filteredlogins.length)} of {filteredlogins.length} entries
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

          <Modal show={showMailModal} onHide={() => setShowMailModal(false)} centered>
                               <Modal.Header closeButton={!isSending}>
                                 <Modal.Title>Send Report via Email</Modal.Title>
                                  </Modal.Header>
                                   <Modal.Body>
                                     <Form>
                                       <Form.Group className="mb-3">
                                         <Form.Label>Email Address<span className="text-danger">*</span></Form.Label>
                                          <Form.Control
                                          type="email"
                                          placeholder="enter recepient email address"
                                          value={emailAddress}
                                          onChange={(e)=>setEmailAddress(e.target.value)}
                                          disabled={isSending}
                                           />
                                           </Form.Group>
                                           </Form>
                                           </Modal.Body>
                                           <Modal.Footer>
                                             <Button variant="secondary" type="button" onClick={()=>setShowMailModal(false)} disabled={isSending}>
                                             Cancel
                                             </Button>
                                             <Button variant="success" type="button" onClick={handleSendEmail} disabled={isSending || !emailAddress}>
                                               {isSending ?(
                                                 <>
                                                 <span className="spinner-border spinner-border-sm me-2"></span>
                                                   Sending...
                                                  </>
                                               ):
                                               (
                                                  <>
                             <i className="fas fa-paper-plane me-1"></i>Send Email
                           </>
                                               )}
                                             </Button></Modal.Footer></Modal>
        </main>
      </div>
    </div>
  );
}
