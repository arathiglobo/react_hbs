import React, {useEffect, useState, useMemo} from "react";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import BackButton from "../../components/BackButton";
import { Row, Col, Card, Form,Button,Table,Modal, Pagination, Spinner } from "react-bootstrap";
import { toast } from "react-hot-toast";
import axiosInstance from "../../components/AxiosInstance";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import HotelFilter from "../../components/filters/Hotelfilters";
import { escapeHtml } from "../../utils/safeHtml";
import { csvCell } from "../../utils/csvSafe";
// .pagination-modern — the orange rounded pager used on /new-booking/hotel
// and the other report pages. Every rule in this stylesheet is namespaced
// under its own class names, so importing it here changes nothing else on
// this page.
import "../../styles/HotelSearch.css";

export default function Stopsalereport() {
 
   const [stopSale,setStopSale]=useState([])
    const [currentPage,setCurrentPage]=useState(1);
    const [itemsPerPage,setItemsPerPage]=useState(10);
    const [searchQuery,setSearchQuery]=useState("");
    const [showMailModal,setShowMailModal]=useState(false);
    const [emailAddress,setEmailAddress]=useState("");
    const [isSending,setIsSending]=useState(false);
    
    // Temporary filter state (what user sees/edits)
    const [tempFromDate, setTempFromDate] = useState("");
    const [tempToDate, setTempToDate] = useState("");
    const [tempSelectedHotel, setTempSelectedHotel] = useState("");
    
    // Applied filter states (used for actual filtering - backend)
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [selectedHotel, setSelectedHotel] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // Booking date filters (sent to /api/report/stopsale on Search) — a stop
    // sale is listed when its hotel has at least one booking that falls in
    // all the date ranges given. The Validity Date below filters the
    // stop-sale validity, a different dimension than the Service Date.
    const initialBookingFilters = {
      serviceDateFrom: "",
      serviceDateTo: "",
      bookingDateFrom: "",
      bookingDateTo: "",
      deadlineDateFrom: "",
      deadlineDateTo: "",
      reconfirmDateFrom: "",
      reconfirmDateTo: "",
      cancelDateFrom: "",
      cancelDateTo: "",
    };
    const [tempBookingFilters, setTempBookingFilters] = useState(initialBookingFilters);
    // Booking filters behind the rows on screen (set on Search / Reset), so
    // the mailed report matches the table even if the inputs were edited
    // afterwards without searching again.
    const [appliedBookingFilters, setAppliedBookingFilters] = useState(initialBookingFilters);

    // One From/To pair per booking date filter, laid out in a 3-column grid
    const bookingDateRanges = [
      { label: "Service Date", from: "serviceDateFrom", to: "serviceDateTo" },
      { label: "Booking Date", from: "bookingDateFrom", to: "bookingDateTo" },
      // { label: "Cancellation Deadline Date", from: "deadlineDateFrom", to: "deadlineDateTo" },
      // { label: "Reconfirm Date", from: "reconfirmDateFrom", to: "reconfirmDateTo" },
      { label: "Cancel Date", from: "cancelDateFrom", to: "cancelDateTo" },
    ];

    const updateBookingFilter = (field, value) =>
      setTempBookingFilters((prev) => ({ ...prev, [field]: value }));

   // ============================================
   // FILTERING LOGIC - FETCH DATA
   // ============================================
   // All stop sales load as soon as the page opens (no params = no filter);
   // Search re-fetches with the booking-level filters, which are applied
   // server-side. Validity dates and the hotel filter client-side on the
   // loaded rows.
   const fetchsale = async(filters = {})=>{
    setIsLoading(true);
    try{
      const params = {};
      Object.entries(filters).forEach(([key, value]) => {
        const trimmed = typeof value === "string" ? value.trim() : value;
        if (trimmed !== "" && trimmed !== null && trimmed !== undefined) {
          params[key] = trimmed;
        }
      });
      const response = await axiosInstance.get("/api/report/stopsale", { params });
      setStopSale(Array.isArray(response.data) ? response.data : []);
    }catch(error){
      console.error("error while fetching data",error);
      toast.error("Failed to load stop sale data");
      setStopSale([]);
    } finally {
      setIsLoading(false);
    }
   };

    // Initial load: show every stop sale when the page opens
    useEffect(()=>{
      fetchsale();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },[])

    useEffect(()=>{
      setCurrentPage(1);
    },[searchQuery])

  // Function to format validityList array to string
  const formatValidity = (validityList) => {
    if (!validityList || !Array.isArray(validityList) || validityList.length === 0) {
      return "N/A";
    }

    return validityList.map((validity) => {
      const fromDate = validity.validityFrom 
        ? new Date(validity.validityFrom).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : '';
      const toDate = validity.validityTo 
        ? new Date(validity.validityTo).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : '';
      
      if (fromDate && toDate) {
        return `${fromDate} - ${toDate}`;
      } else if (fromDate) {
        return `From ${fromDate}`;
      } else if (toDate) {
        return `Until ${toDate}`;
      }
      return 'N/A';
    }).join(', ');
  };

  const handleSendEmail = async ()=>{
    if (!emailAddress || !/^\S+@\S+\.\S+$/.test(emailAddress)){
        toast.error("Please enter a valid email address");
        return;
      }
  
      setIsSending(true);
      try{
        // The server re-runs the report with the filters behind the table
        const response =await axiosInstance.post('/api/reports/send-email',{
          email: emailAddress,
          reportType:'stopsale',
          filters:{
            ...appliedBookingFilters,
            fromDate,
            toDate,
            hotel: selectedHotel,
            searchQuery,
          },
          recordCount: filteredstopsale.length,
        })
        if (response.data){
          const sentCount = response.data.recordCount ?? filteredstopsale.length;
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
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Stop Sale Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            h1 { text-align: center; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <h1>Stop Sale Report</h1>
          <table>
            <thead>
              <tr>
                <th>Sl.No</th>
                <th>Hotel Name</th>
                <th>Market</th>
                <th>Type</th>
                <th>Room Category</th>
                <th>Validity</th>
              </tr>
            </thead>
            <tbody>

              ${currentStopSale.map((s, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${escapeHtml(s.hotel)}</td>
                  <td>${escapeHtml(s.market)}</td>
                  <td>${escapeHtml(s.type)}</td>
                  <td>${escapeHtml(s.roomCategory)}</td>
                  <td>${escapeHtml(formatValidity(s.validityList))}</td>
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
      doc.text('Stop Sale Report', 20, 20);
      
      // Add table
      autoTable(doc, {
        head: [['Sl.No', 'Hotel Name', 'Market', 'Type', 'Room Category','Validity' ]],
        body: currentStopSale.map((s, index) => [
          index + 1,
          s.hotel,
          s.market,
          s.type,
          s.roomCategory,
          formatValidity(s.validityList),
          ]),
        startY: 30,
      });
      // Download PDF
      doc.save('hotel-wise-report.pdf');
    };

    const handleExcel = () => {
    const headers = ['Sl.No', 'Hotel Name', 'Market', 'Type', 'Room Category', 'Validity'];
     // Create CSV content with proper escaping
    // csvCell neutralises text a spreadsheet would run as a formula.
    const escapeCSV = (value) => csvCell(value);
    
    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...currentStopSale.map((s, index) => [
        index + 1,
        s.hotel,
          s.market,
          s.type,
          s.roomCategory,
          formatValidity(s.validityList),
      ].map(escapeCSV).join(','))
    ].join('\n');

    // Add BOM for UTF-8 to ensure proper Excel encoding
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'hotel-wise-report.csv';
    link.click();
    window.URL.revokeObjectURL(url);
  };

  // ============================================
  // FILTERING LOGIC - TEXT SEARCH FILTER
  // ============================================
  // ✅ This filter is WORKING - filters by text search across multiple fields
  // ⚠️ NOTE: This only does client-side filtering on already loaded data
  //    If you want server-side filtering, need to pass searchQuery to API call
  // ============================================
  // FILTERING LOGIC - CLIENT-SIDE FILTERING
  // ============================================
  const handleSearch = async () => {
    // Update applied filters (validity dates + hotel filter client-side)
    setFromDate(tempFromDate);
    setToDate(tempToDate);
    setSelectedHotel(tempSelectedHotel);
    setCurrentPage(1);
    setAppliedBookingFilters(tempBookingFilters);

    // Fetch data when search is clicked; booking-level filters server-side
    await fetchsale(tempBookingFilters);
  };

  const handleReset = async () => {
    setTempBookingFilters(initialBookingFilters);
    setAppliedBookingFilters(initialBookingFilters);
    setTempFromDate("");
    setTempToDate("");
    setTempSelectedHotel("");
    setFromDate("");
    setToDate("");
    setSelectedHotel("");
    setSearchQuery("");
    setCurrentPage(1);
    await fetchsale();
  };

  const filteredstopsale = useMemo(() => {
    return stopSale.filter(s => {
      // Text search filter
      if (searchQuery && searchQuery.trim()) {
        const search = searchQuery.trim().toLowerCase();
        const matchesSearch =
          String(s.hotel || '').toLowerCase().includes(search) ||
          String(s.market || '').toLowerCase().includes(search) ||
          String(s.type || '').toLowerCase().includes(search) ||
          String(s.roomCategory || '').toLowerCase().includes(search) ||
          formatValidity(s.validityList).toLowerCase().includes(search) ||
          String(s.customerName || '').toLowerCase().includes(search);
        
        if (!matchesSearch) return false;
      }

      // Hotel filter — the API now returns hotelId on every row
      if (selectedHotel) {
        if (!s.hotelId || String(s.hotelId) !== String(selectedHotel)) {
          return false;
        }
      }

      // Date range filter - handle three cases:
      // 1. Only From Date: show records from that date onwards
      // 2. Only To Date: show records before/up to that date
      // 3. Both From and To Date: show records between those dates
      if (fromDate || toDate) {
        if (!s.validityList || s.validityList.length === 0) {
          return false; // No validity means no match
        }

        let hasMatchingValidity = false;
        for (const validity of s.validityList) {
          const validityFrom = validity.validityFrom ? validity.validityFrom.split('T')[0] : '';
          const validityTo = validity.validityTo ? validity.validityTo.split('T')[0] : '';

          if (!validityFrom && !validityTo) continue; // Skip if no dates

          // Case 1: Only From Date selected - show records from that date onwards
          if (fromDate && !toDate) {
            // Record is valid if validityTo is on or after fromDate
            // (validity period starts before or on fromDate and ends on or after fromDate)
            if (validityTo && validityTo >= fromDate) {
              hasMatchingValidity = true;
              break;
            }
          }
          // Case 2: Only To Date selected - show records before/up to that date
          else if (!fromDate && toDate) {
            // Record is valid if validityFrom is on or before toDate
            // (validity period starts on or before toDate)
            if (validityFrom && validityFrom <= toDate) {
              hasMatchingValidity = true;
              break;
            }
          }
          // Case 3: Both From and To Date selected - show records between those dates
          else if (fromDate && toDate) {
            // Record is valid if validity period overlaps with filter range
            // Validity period overlaps if:
            // - validityFrom is on or before toDate AND
            // - validityTo is on or after fromDate
            const overlaps = 
              (!validityFrom || validityFrom <= toDate) &&
              (!validityTo || validityTo >= fromDate);
            
            if (overlaps) {
              hasMatchingValidity = true;
              break;
            }
          }
        }

        if (!hasMatchingValidity) return false;
      }

      return true;
    });
  }, [stopSale, searchQuery, fromDate, toDate, selectedHotel]);

const totalPages =Math.ceil(filteredstopsale.length / itemsPerPage);
const startindex = (currentPage -1) * itemsPerPage;
const endIndex = startindex + itemsPerPage;
const currentStopSale = filteredstopsale.slice(startindex,endIndex);

  // Page buttons, as on the other report pages: always the first 3 and last
  // 3 pages, plus the current page and its neighbours; "…" fills each gap.
  // A gap of a single page shows that page instead — an ellipsis there would
  // hide nothing. 30 pages on page 1 → 1 2 3 … 28 29 30.
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

  // minWidth 0 lets a From/To pair share its column instead of spilling into
  // the next field; the slimmer right padding keeps "dd-mm-yyyy" and the
  // calendar icon visible at that width.
  const dateInputStyle = { minWidth: 0, paddingRight: "0.5rem" };

  return (
    <div className="bg-light d-flex flex-column" style={{ minHeight: "100vh" }}>
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />

        <main className="flex-grow-1 p-4" style={{ overflow: "auto" }}>
          <Card className="shadow-sm rounded-xl">
            <Card.Header className="d-flex align-items-center gap-2">
              <BackButton forceFallback fallback="/adminDashboard" />
              <span className="fw-semibold">Stop Sale Report</span>
            </Card.Header>

            {/* Filters Section */}
            <div className="p-4 bg-light border-bottom">
              {/* Booking Details — the From/To date ranges, 3 per row */}
              <h6 className="fw-bold text-primary mb-3">Booking Details</h6>
              <Row className="align-items-end g-4 mb-4">
                {bookingDateRanges.map(({ label, from, to }) => (
                  <Col md={4} key={from}>
                    <Form.Group className="mb-0">
                      <Form.Label className="small mb-2">{label}</Form.Label>
                      <div className="d-flex gap-2">
                        <Form.Control type="date" size="sm" title="From" style={dateInputStyle}
                          aria-label={`${label} from`}
                          value={tempBookingFilters[from]}
                          onChange={(e) => updateBookingFilter(from, e.target.value)} />
                        <Form.Control type="date" size="sm" title="To" style={dateInputStyle}
                          aria-label={`${label} to`}
                          value={tempBookingFilters[to]}
                          min={tempBookingFilters[from] || undefined}
                          onChange={(e) => updateBookingFilter(to, e.target.value)} />
                      </div>
                    </Form.Group>
                  </Col>
                ))}
              </Row>

              {/* Stop Sale Details — validity range and hotel, on the same
                  3-column grid as the booking dates above */}
              <h6 className="fw-bold text-primary mb-3">Stop Sale Details</h6>
              <Row className="align-items-end g-4">
                <Col md={4}>
                  <Form.Group className="mb-0">
                    <Form.Label className="small mb-2">Validity Date</Form.Label>
                    <div className="d-flex gap-2">
                      <Form.Control
                        type="date"
                        size="sm"
                        title="From"
                        style={dateInputStyle}
                        aria-label="Validity date from"
                        value={tempFromDate}
                        onChange={(e) => setTempFromDate(e.target.value)}
                      />
                      <Form.Control
                        type="date"
                        size="sm"
                        title="To"
                        style={dateInputStyle}
                        aria-label="Validity date to"
                        value={tempToDate}
                        onChange={(e) => setTempToDate(e.target.value)}
                        min={tempFromDate || undefined}
                      />
                    </div>
                  </Form.Group>
                </Col>
                <Col md={4}>
                 <HotelFilter
                   value={tempSelectedHotel}
                   onChange={setTempSelectedHotel}
                 />
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
                  <Button variant="outline-primary" size="sm" onClick={()=>setShowMailModal(true)}>
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
                    <th>Hotel Name</th>
                    <th>Market</th>
                    <th>Type</th>
                    <th>Room Category</th>
                    <th>Validity</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan="6" className="text-center text-muted py-4">
                        <Spinner animation="border" size="sm" className="me-2" />
                        Loading...
                      </td>
                    </tr>
                  ) : currentStopSale.length > 0 ? (
                    currentStopSale.map((s, index) => (
                      <tr key={s.id}>
                        <td>{startindex + index + 1}</td>
                        <td>{s.hotel}</td>
                        <td>{s.market}</td>
                        <td>{s.type}</td>
                        <td>{s.roomCategory}</td>
                        <td>{formatValidity(s.validityList)}</td>
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
                    Showing {filteredstopsale.length > 0 ? startindex + 1 : 0} to {Math.min(endIndex, filteredstopsale.length)} of {filteredstopsale.length} entries
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
                  </>)}
                                    </Button>
          
                                  </Modal.Footer>
                    </Modal>
        </main>
      </div>
    </div>
  );
}
