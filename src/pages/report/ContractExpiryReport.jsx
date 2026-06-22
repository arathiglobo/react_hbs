import React, {useEffect, useState, useMemo} from "react";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import { Row, Col, Card, Form,Button,Table,Modal,Pagination } from "react-bootstrap";
import { toast } from "react-hot-toast";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import HotelFilter from "../../components/filters/Hotelfilters";
import axiosInstance from "../../components/AxiosInstance";

export default function ContractExpiryReport() {

const [contractList,setContractList]=useState([]);
const [currentPage,setCurrentPage]=useState(1);
const [itemsPerPage,setItemsPerPage]=useState(10);
const [tableSearch,setTableSearch]=useState("");
const [showMailModal, setShowMailModal] = useState(false);
const [emailAddress, setEmailAddress] = useState("");
const [isSending, setIsSending] = useState(false);

// Temporary filter states (what user sees/edits)
const [tempFromDate,setTempFromDate]=useState("");
const [tempToDate,setTempToDate]=useState("");
const [tempSelectedHotel,setTempSelectedHotel]=useState("");

// Applied filter states (used for actual filtering)
const [fromDate,setFromDate]=useState("");
const [toDate,setToDate]=useState("");
const [selectedHotel,setSelectedHotel]=useState("");

// Store filter options to map IDs to names
const [hotelOptions,setHotelOptions]=useState([]);


useEffect(()=>{
  setCurrentPage(1);
},[tableSearch]);

useEffect(()=>{
  const fetchcontract = async ()=>{
    try{
      const response = await axiosInstance.get("/api/report/contractrates")
      setContractList(response.data || [])
    }catch(error){
      console.error("error fetching data",error)
      toast.error("Failed to load contract data");
    }};
  fetchcontract();
},[])

useEffect(()=>{
  const fetchFilterOptions = async ()=>{
    try{
      const hotelRes = await axiosInstance.get("/api/hotels").catch(()=>({data:[]}));
      setHotelOptions(Array.isArray(hotelRes.data) ? hotelRes.data.map(h=>({id:h.id,name:h.hotelName})):[]);
    }catch(error){
      console.error("failed to fetch filter options",error);
    }
  };
  fetchFilterOptions();
},[])

// Function to calculate status based on expiration date
const getContractStatus = (expirationDate) => {
  try {
    const expirationParts = expirationDate.split('/');
    if (expirationParts.length !== 3) return "Inactive";
    
    const day = parseInt(expirationParts[0], 10);
    const month = parseInt(expirationParts[1], 10);
    const year = parseInt(expirationParts[2], 10);
    
    if (isNaN(day) || isNaN(month) || isNaN(year)) return "Inactive";
    
    const expiryDate = new Date(year, month - 1, day);
    const today = new Date();
    
    // Set time to start of day for accurate comparison
    expiryDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    return expiryDate >= today ? "Live" : "Inactive";
  } catch (error) {
    return "Inactive";
  }
};



const filteredContracts = useMemo(() => {
  return contractList.filter(item => {
    if (!item) return false;

    // Filter 1: Hotel Filter
    if (selectedHotel && selectedHotel.toString().trim()) {
      let matches = false;
      
      // First try to match by ID
      if (item.hotelId && String(item.hotelId) === String(selectedHotel)) {
        matches = true;
      } else {
        // If ID doesn't match, try matching by name
        const selectedHotelName = hotelOptions.find(opt => String(opt.id) === String(selectedHotel))?.name;
        if (selectedHotelName) {
          const hotelNameStr = String(item.hotelName || item.hotel || '').trim();
          const selectedHotelNameStr = String(selectedHotelName || '').trim();
          matches = hotelNameStr === selectedHotelNameStr;
        }
      }
      
      if (!matches) return false;
    }

    // Filter 2: Date Range Filter
    if ((fromDate && fromDate.trim()) || (toDate && toDate.trim())) {
      try {
        // Check if item has expiration date
        if (!item.expirationDate) {
          return false;
        }
        
        // Convert expiration date from DD/MM/YYYY to Date object
        const expirationParts = item.expirationDate.split('/');
        if (!expirationParts || expirationParts.length !== 3) {
          return false;
        }
        
        const day = parseInt(expirationParts[0], 10);
        const month = parseInt(expirationParts[1], 10);
        const year = parseInt(expirationParts[2], 10);
        
        if (isNaN(day) || isNaN(month) || isNaN(year)) {
          return false;
        }
        
        const itemDate = new Date(year, month - 1, day);
        if (isNaN(itemDate.getTime())) {
          return false; // Invalid date
        }
        itemDate.setHours(0, 0, 0, 0);
        
        // Filter by fromDate if provided
        if (fromDate && fromDate.trim()) {
          const fromDateObj = new Date(fromDate);
          if (isNaN(fromDateObj.getTime())) {
            return false; // Invalid date
          }
          fromDateObj.setHours(0, 0, 0, 0);
          if (itemDate < fromDateObj) {
            return false;
          }
        }
        
        // Filter by toDate if provided
        if (toDate && toDate.trim()) {
          const toDateObj = new Date(toDate);
          if (isNaN(toDateObj.getTime())) {
            return false; // Invalid date
          }
          toDateObj.setHours(23, 59, 59, 999);
          if (itemDate > toDateObj) {
            return false;
          }
        }
      } catch (error) {
        console.error('Error filtering by date:', error, item);
        return false;
      }
    }

    return true; // If all filters pass, include this contract
  });
}, [contractList, selectedHotel, fromDate, toDate, hotelOptions]);

// Filter by search query
const finalFilteredData = useMemo(() => {
  if (!tableSearch || !tableSearch.trim()) {
    return filteredContracts;
  }
  
  const searchLower = tableSearch.trim().toLowerCase();
  return filteredContracts.filter(item => {
    return (
      String(item.rateCode || '').toLowerCase().includes(searchLower) ||
      String(item.hotelType || '').toLowerCase().includes(searchLower) ||
      String(item.hotelName || '').toLowerCase().includes(searchLower) ||
      String(item.expirationDate || '').toLowerCase().includes(searchLower)
    );
  });
}, [filteredContracts, tableSearch]);

// Pagination calculations
const totalPages = useMemo(() => Math.ceil(finalFilteredData.length / itemsPerPage), [finalFilteredData.length, itemsPerPage]);
const startIndex = useMemo(() => (currentPage - 1) * itemsPerPage, [currentPage, itemsPerPage]);
const endIndex = useMemo(() => startIndex + itemsPerPage, [startIndex, itemsPerPage]);
const currentContracts = useMemo(() => finalFilteredData.slice(startIndex, endIndex), [finalFilteredData, startIndex, endIndex]);

// Handle search button click
const handleSearch = () => {
  // Apply temporary filter values to actual filter values
  console.log('Applying filters:', { fromDate: tempFromDate, toDate: tempToDate, hotel: tempSelectedHotel });
  setFromDate(tempFromDate || "");
  setToDate(tempToDate || "");
  setSelectedHotel(tempSelectedHotel || "");
  setTableSearch("");
  setCurrentPage(1);
};

// Handle reset/clear filters
const handleReset = () => {
  setTempFromDate("");
  setTempToDate("");
  setTempSelectedHotel("");
  setFromDate("");
  setToDate("");
  setSelectedHotel("");
  setTableSearch("");
  setCurrentPage(1);
};

const handleSendEmail = async () => {
  // Validate email
  if (!emailAddress || !emailAddress.includes('@')) {
    toast.error("Please enter a valid email address");
    return;
  }

  setIsSending(true);
  try {
    // API call to send email
    const response = await axiosInstance.post('/api/reports/send-email', {
      email: emailAddress,
      reportType: 'contractexpiry',
      filters: {
        fromDate: fromDate,
        toDate: toDate,
        hotelId: selectedHotel
      }
    });

    if (response.data) {
      toast.success("Report sent successfully!");
      setShowMailModal(false);
      setEmailAddress("");
    }
  } catch (error) {
    toast.error("Failed to send email");
  } finally {
    setIsSending(false);
  }
};

 const handlePrint = () => {
    const currentData = finalFilteredData;
    
    if (currentData.length === 0) {
      toast.error("No data to print.");
      return;
    }
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Contract Expiry Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            h1 { text-align: center; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <h1>Contract Expiry Report</h1>
          <table>
            <thead>
              <tr>
                <th>Sl.No</th>
                <th>Rate Code</th>
                <th>Day</th>
                <th>Hotel</th>
                <th>Status</th>
                <th>Expiration Date</th>
              </tr>
            </thead>
            <tbody>
              ${currentData.map((c, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${c.rateCode}</td>
                  <td>${c.day}</td>
                  <td>${c.hotelName}</td>
                  <td>${getContractStatus(c.expirationDate)}</td>
                  <td>${c.expirationDate}</td>
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
    const currentData = finalFilteredData;
    
    if (currentData.length === 0) {
      toast.error("No data to export.");
      return;
    }
    
    const doc = new jsPDF();
    
    // Add title
    doc.text('Contract Expiry Report', 20, 20);
    
    // Add table
    autoTable(doc, {
      head: [['Sl.No', 'Rate Code', 'Day', 'Hotel', 'Status', 'Expiration Date']],
      body: currentData.map((c, index) => [
        index + 1,
        c.rateCode,
        c.day,
        c.hotelName,
        getContractStatus(c.expirationDate),
        c.expirationDate
      ]),
      startY: 30,
    });
    
    // Download PDF
    doc.save('contract-expiry-report.pdf');
  };

  const handleExcel = () => {
    const currentData = finalFilteredData;
    
    if (currentData.length === 0) {
      toast.error("No data to export.");
      return;
    }
    
    const headers = ['Sl.No', 'Rate Code', 'Day', 'Hotel', 'Status', 'Expiration Date'];
    
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
      ...currentData.map((c, index) => [
        index + 1,
        c.rateCode,
        c.day,
        c.hotelName,
        getContractStatus(c.expirationDate),
        c.expirationDate
      ].map(escapeCSV).join(','))
    ].join('\n');

    // Add BOM for UTF-8 to ensure proper Excel encoding
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'contract-expiry-report.csv';
    link.click();
    window.URL.revokeObjectURL(url);
  };


  return (
    <div className="bg-light d-flex flex-column" style={{ minHeight: "100vh" }}>
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />

        <main className="flex-grow-1 p-4" style={{ overflow: "auto" }}>
          <Card className="shadow-sm rounded-xl">
            <Card.Header>
              <span className="fw-semibold">Contract Expiry Report</span>
            </Card.Header>

            {/* Filters Section */}
            <div className="p-4 bg-light border-bottom">
              <Row className="align-items-end g-4">
                <Col md={2}>
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
                <Col md={2}>
                  <Form.Group className="mb-0">
                    <Form.Label className="small mb-2">To Date</Form.Label>
                    <Form.Control 
                      type="date" 
                      size="sm" 
                      value={tempToDate}
                      onChange={(e) => setTempToDate(e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={2}>
                  <HotelFilter
                    value={tempSelectedHotel}
                    onChange={setTempSelectedHotel}
                  />
                </Col>
                <Col md={2}>
                  <Button 
                    variant="success" 
                    size="sm" 
                    className="w-100"
                    style={{ backgroundColor: "#676767", borderColor: "#676767" }} onClick={handleSearch}
                  >
                    <i className="fas fa-search me-1"></i>Search
                  </Button>
                </Col>
                <Col md={2}>
                  <Button 
                    variant="outline-secondary" 
                    size="sm" 
                    className="w-100"
                    onClick={handleReset}
                  >
                    <i className="fas fa-redo me-1"></i>Reset
                  </Button>
                </Col>
              </Row>

              {/* Action Buttons */}
              <Row className="mt-4">
                <Col md={12} className="d-flex gap-2 justify-content-end">
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
                </Col>
              </Row>
            </div>

            {/* Table Section */}
            <Card.Body className="p-0 mt-1">
              {/* Display and Search Row */}
              <div className="p-2 border-bottom">
                <Row className="d-flex justify-content-between align-items-center">
                  <Col md="auto">
                    <span className="text-muted">Display</span>
                    <Form.Select 
                      size="sm" 
                      className="d-inline-block ms-2" 
                      style={{width: '80px'}}
                      value={itemsPerPage}
                      onChange={(e)=>{
                        setItemsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </Form.Select>
                    <span className="text-muted ms-2">records</span>
                  </Col>
                  <Col md="auto">
                    <input
                      type="text"
                      value={tableSearch}
                      onChange={(e)=>setTableSearch(e.target.value)}
                      placeholder="search here"
                      className="form-control form-control-sm w-auto"
                    />
                  </Col>
                </Row>
              </div>

              <Table responsive hover striped className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th style={{ width: 100 }}>S/N</th>
                    <th>Rate Code</th>
                    <th>Day</th>
                    <th>Hotel</th>
                    <th>Status</th>
                    <th>Expiration Date</th>
                  </tr>
                </thead>
                <tbody>
                  {currentContracts.length > 0 ? (
                    currentContracts.map((c, index) => (
                      <tr key={c.id || index}>
                        <td>{startIndex + index + 1}</td>
                        <td>{c.rateCode}</td>
                        <td>{c.day}</td>
                        <td>{c.hotelName}</td>
                        <td>{getContractStatus(c.expirationDate)}</td>
                        <td>{c.expirationDate}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="text-center text-muted py-4">
                        No data found matching your criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>

              {/* Pagination */}
              <div className="d-flex justify-content-between align-items-center p-3 border-top">
                <div>
                  <small className="text-muted">
                    Showing {finalFilteredData.length > 0 ? startIndex + 1 : 0} to {Math.min(endIndex, finalFilteredData.length)} of {finalFilteredData.length} entries
                  </small>
                </div>
                <div>
                  <Pagination className="mb-0">
                    <Pagination.Prev 
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    />
                    
                    {Array.from({length: totalPages}, (_, i) => i + 1).map((pageNum) => {
                      if (
                        pageNum === 1 ||
                        pageNum === totalPages ||
                        (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                      ) {
                        return (
                          <Pagination.Item
                            key={pageNum}
                            active={pageNum === currentPage}
                            onClick={() => setCurrentPage(pageNum)}
                          >
                            {pageNum}
                          </Pagination.Item>
                        );
                      } else if (
                        pageNum === currentPage - 2 ||
                        pageNum === currentPage + 2
                      ) {
                        return <Pagination.Ellipsis key={pageNum} />;
                      }
                      return null;
                    })}

                    <Pagination.Next 
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages || totalPages === 0}
                    />
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
                  <Form.Label>Email Address <span className="text-danger">*</span></Form.Label>
                  <Form.Control
                    type="email"
                    placeholder="Enter recipient email address"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    disabled={isSending}
                  />
                </Form.Group>
              </Form>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowMailModal(false)} disabled={isSending}>
                Cancel
              </Button>
              <Button variant="success" onClick={handleSendEmail} disabled={isSending || !emailAddress}>
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
