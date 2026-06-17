import React, {useEffect, useState, useMemo} from "react";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import { Row, Col, Card, Form,Button,Table,Modal, Pagination, Spinner } from "react-bootstrap";
import { toast } from "react-hot-toast";
import axiosInstance from "../../components/AxiosInstance";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import HotelFilter from "../../components/filters/Hotelfilters";

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

   // ============================================
   // FILTERING LOGIC - FETCH DATA (ONLY ON SEARCH)
   // ============================================
   // Removed initial fetch - data will only load when user clicks Search
   const fetchsale = async()=>{
    setIsLoading(true);
    try{
      // Fetch all data without filters (frontend filtering)
      const response = await axiosInstance.get("/api/report/stopsale?page=0&limit=1000");
      setStopSale(response.data || []);
    }catch(error){
      console.error("error while fetching data",error);
      toast.error("Failed to load stop sale data");
      setStopSale([]);
    } finally {
      setIsLoading(false);
    }
   };

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
        const response =await axiosInstance.post('/api/reports/send-email',{
          email: emailAddress,
          reportType:'User report',
          filters:{
            
          }
        })
        if (response.data){
          toast.success("Report Sent Successfully!")
          setShowMailModal(false);
          setEmailAddress("");
        }
      }
      catch(error){
        toast.error("Failed to send mail")
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
                  <td>${s.hotel}</td>
                  <td>${s.market}</td>
                  <td>${s.type}</td>
                  <td>${s.roomCategory}</td>
                  <td>${formatValidity(s.validityList)}</td>
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
    const escapeCSV = (value) => {
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      // If value contains comma, newline, or quote, wrap it in quotes and escape quotes
      if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };
    
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
    // Update applied filters
    setFromDate(tempFromDate);
    setToDate(tempToDate);
    setSelectedHotel(tempSelectedHotel);
    setCurrentPage(1);
    
    // Fetch data when search is clicked
    setIsLoading(true);
    try{
      const response = await axiosInstance.get("/api/report/stopsale?page=0&limit=1000");
      setStopSale(response.data || []);
    }catch(error){
      console.error("error while fetching data",error);
      toast.error("Failed to load stop sale data");
      setStopSale([]);
    } finally {
      setIsLoading(false);
    }
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

      // Hotel filter
      if (selectedHotel) {
        // Assuming hotelId is in the data, adjust field name as needed
        if (s.hotelId && String(s.hotelId) !== String(selectedHotel)) {
          return false;
        }
        // If hotelId not available, try matching by hotel name
        // You may need to adjust this based on your data structure
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


  return (
    <div className="bg-light d-flex flex-column" style={{ minHeight: "100vh" }}>
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />

        <main className="flex-grow-1 p-4" style={{ overflow: "auto" }}>
          <Card className="shadow-sm rounded-xl">
            <Card.Header>
              <span className="fw-semibold">Stop Sale Report</span>
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
                      value={tempFromDate}
                      onChange={(e) => setTempFromDate(e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group className="mb-0">
                    <Form.Label className="small mb-2">To Date</Form.Label>
                    <Form.Control 
                      type="date" 
                      size="sm" 
                      value={tempToDate}
                      onChange={(e) => setTempToDate(e.target.value)}
                      min={tempFromDate || undefined}
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                 <HotelFilter 
                   value={tempSelectedHotel} 
                   onChange={setTempSelectedHotel} 
                 />
                </Col>
                <Col md={3}>
                  <Button 
                    variant="success" 
                    className="w-100" 
                    size="sm"
                    onClick={handleSearch}
                  >
                    <i className="fas fa-search me-1"></i>Search
                  </Button>
                </Col>
              </Row>

              {/* Action Buttons */}
              <Row className="mt-4">
                <Col md={12} className="d-flex gap-2 justify-content-end">
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
                </Col>
              </Row>

              {/* Search Input */}
              <Row className="mt-3">
                <Col className="d-flex justify-content-end">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e)=>setSearchQuery(e.target.value)}
                    placeholder="search here"
                    className="form-control form-control-sm w-auto"
                  />
                </Col>
              </Row>
            </div>

            {/* Table Section */}
            <Card.Body className="p-0 mt-1">
              <Table responsive hover striped className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th style={{ width: 100 }}>S/N</th>
                    <th>Hotel Name</th>
                    <th>Market</th>
                    <th>Type</th>
                    <th>Room Category</th>
                    <th>Validity</th>
                  </tr>
                </thead>
                <tbody>
                  {currentStopSale.length > 0 ? (
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

              {/* Pagination */}
              <div className="d-flex justify-content-between align-items-center p-3 border-top">
                <div>
                  <small className="text-muted">
                    Showing {filteredstopsale.length > 0 ? startindex + 1 : 0} to {Math.min(endIndex, filteredstopsale.length)} of {filteredstopsale.length} entries
                  </small>
                </div>
                <div>
                  <Pagination className="mb-0">
                    <Pagination.Prev onClick={()=>setCurrentPage(prev=>Math.max(1,prev-1))}
                      disabled={currentPage === 1}/>

                    {Array.from({length:totalPages},(_,i)=>i+1).map((pageNum)=>{
                      if(
                        pageNum === 1||
                        pageNum === totalPages ||
                        (pageNum >= currentPage -1 && pageNum <=currentPage+1)
                      ){
                        return(
                          <Pagination.Item
                          key={pageNum}
                          active={pageNum===currentPage}
                          onClick={()=>setCurrentPage(pageNum)}>
                            {pageNum}
                          </Pagination.Item>
                        )
                      }else if(
                        pageNum === currentPage -2||
                        pageNum === currentPage +2
                      ){
                        return <Pagination.Ellipsis key={pageNum}/>;
                      }
                      return null;
                    })}

                    <Pagination.Next onClick={()=>setCurrentPage(prev=>Math.min(totalPages,prev+1))}
                      disabled={currentPage === totalPages || totalPages === 0}/>

                  </Pagination>
                </div>
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
