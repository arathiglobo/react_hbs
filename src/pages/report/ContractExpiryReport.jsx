import React, {useState} from "react";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import { Row, Col, Card, Form,Button,Table,Modal,Pagination } from "react-bootstrap";
import { toast } from "react-hot-toast";
import axiosInstance from "../../components/AxiosInstance";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function ContractExpiryReport() {


const [tableSearch,setTableSearch]=useState("");
const [showMailModal, setShowMailModal] = useState(false);
const [emailAddress, setEmailAddress] = useState("");
const [isSending, setIsSending] = useState(false);
const [showData, setShowData] = useState(false);
const [filteredData, setFilteredData] = useState([]);
const [filters, setFilters] = useState({
  fromDate: '',
  toDate: '',
  hotelType: ''
});

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

// Dummy data (without status field - it will be calculated dynamically)
const contracts = [
  {
    id: 1,
    rateCode: "WINTER CONTRACT",
    day: "All Days",
    hotel: "Test Hotel One",
    hotelType: "Hotel",
    expirationDate: "31/03/2025",
  },
  {
    id: 1,
    rateCode: "December CONTRACT",
    day: "All Days",
    hotel: "Test Hotel One",
    hotelType: "Hotel",
    expirationDate: "31/08/2025",
  },
   {
    id: 2,
    rateCode: "SUMMER CONTRACT",
    day: "Half",
    hotel: "Test Hotel Two",
    hotelType: "Resort",
    expirationDate: "31/03/2024",
  },
  {
    id: 6,
    rateCode: "WINTER RESORT CONTRACT",
    day: "All Days",
    hotel: "Test Resort Hotel",
    hotelType: "Resort",
    expirationDate: "15/11/2024",
  },
   {
    id: 3,
    rateCode: "MONSOON CONTRACT",
    day: "All Days",
    hotel: "Test Hotel Three",
    hotelType: "Hotel",
    expirationDate: "31/03/2026",
  },
  {
    id: 4,
    rateCode: "FALL CONTRACT",
    day: "All Days",
    hotel: "Test Hotel Four",
    hotelType: "Hotel",
    expirationDate: "15/12/2025",
  },
  {
    id: 5,
    rateCode: "SPRING CONTRACT",
    day: "Weekends",
    hotel: "Test Hotel Five",
    hotelType: "Hotel",
    expirationDate: "20/03/2026",
  },
];

// Get unique hotel types from contracts data
const uniqueHotelTypes = [...new Set(contracts.map(contract => contract.hotelType).filter(Boolean))];

// Filter function for Contract data
const filterContractData = () => {
  let filtered = [...contracts];
  
  // Filter by Hotel Type
  if (filters.hotelType) {
    filtered = filtered.filter(item => item.hotelType === filters.hotelType);
  }
  
  // Filter by Date Range (if dates are provided)
  if (filters.fromDate && filters.toDate) {
    filtered = filtered.filter(item => {
      try {
        // Convert expiration date from DD/MM/YYYY to Date object
        const expirationParts = item.expirationDate.split('/');
        if (expirationParts.length !== 3) return false;
        
        const day = parseInt(expirationParts[0], 10);
        const month = parseInt(expirationParts[1], 10);
        const year = parseInt(expirationParts[2], 10);
        
        if (isNaN(day) || isNaN(month) || isNaN(year)) return false;
        
        const itemDate = new Date(year, month - 1, day);
        
        const fromDate = new Date(filters.fromDate);
        const toDate = new Date(filters.toDate);
        
        // Set time to start of day for accurate comparison
        fromDate.setHours(0, 0, 0, 0);
        toDate.setHours(23, 59, 59, 999);
        itemDate.setHours(0, 0, 0, 0);
        
        return itemDate >= fromDate && itemDate <= toDate;
      } catch (error) {
        console.error('Error filtering by date:', error);
        return false;
      }
    });
  }
  
  return filtered;
};

// Handle search button click
const handleSearch = () => {
  const filtered = filterContractData();
  setFilteredData(filtered);
  setShowData(true);
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
        fromDate: filters.fromDate,
        toDate: filters.toDate,
        hotelType: filters.hotelType
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
    const currentData = showData && finalFilteredData.length > 0 ? finalFilteredData : [];
    
    if (currentData.length === 0) {
      toast.error("No data to print. Please search first.");
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
                  <td>${c.hotel}</td>
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
    const currentData = showData && finalFilteredData.length > 0 ? finalFilteredData : [];
    
    if (currentData.length === 0) {
      toast.error("No data to export. Please search first.");
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
        c.hotel,
        getContractStatus(c.expirationDate),
        c.expirationDate
      ]),
      startY: 30,
    });
    
    // Download PDF
    doc.save('contract-expiry-report.pdf');
  };

  const handleExcel = () => {
    const currentData = showData && finalFilteredData.length > 0 ? finalFilteredData : [];
    
    if (currentData.length === 0) {
      toast.error("No data to export. Please search first.");
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
        c.hotel,
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

  const searchLower = tableSearch.toLowerCase();

  const finalFilteredData = filteredData.filter(item=>{
    return(
    String(item.rateCode).toLowerCase().includes(searchLower)||
    String(item.hotelType).toLowerCase().includes(searchLower)||
    String(item.expirationDate).toLowerCase().includes(searchLower)
    )
  }
)

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
                <Col md={3}>
                  <Form.Group className="mb-0">
                    <Form.Label className="small mb-2">From Date</Form.Label>
                    <Form.Control 
                      type="date" 
                      size="sm" 
                      value={filters.fromDate}
                      onChange={(e) => setFilters({...filters, fromDate: e.target.value})}
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
                      onChange={(e) => setFilters({...filters, toDate: e.target.value})}
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group className="mb-0">
                    <Form.Label className="small mb-2">Hotel Type</Form.Label>
                    <Form.Select 
                      size="sm"
                      value={filters.hotelType}
                      onChange={(e) => setFilters({...filters, hotelType: e.target.value})}
                    >
                      <option value="">Select</option>
                      {uniqueHotelTypes.map((type, index) => (
                        <option key={index} value={type}>{type}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Button 
                    variant="success" 
                    size="sm" 
                    className="w-100"
                    onClick={handleSearch}
                  >
                    <i className="fas fa-search me-1"></i>Search
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
                    <Form.Select size="sm" className="d-inline-block ms-2" style={{width: '80px'}}>
                      <option>10</option>
                      <option>25</option>
                      <option>50</option>
                      <option>100</option>
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
                  {showData && finalFilteredData.length > 0 ? (
                    finalFilteredData.map((c, index) => (
                      <tr key={c.id}>
                        <td>{index + 1}</td>
                        <td>{c.rateCode}</td>
                        <td>{c.day}</td>
                        <td>{c.hotel}</td>
                        <td>{getContractStatus(c.expirationDate)}</td>
                        <td>{c.expirationDate}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="text-center text-muted py-4">
                        {showData ? 'No data found matching your criteria.' : 'No data to display.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>

              {/* Pagination */}
              {showData && (
                <div className="d-flex justify-content-between align-items-center p-3 border-top">
                  <div>
                    <small className="text-muted">
                      Showing 1 to {filteredData.length} of {filteredData.length} entries
                    </small>
                  </div>
                  <div>
                    <Pagination className="mb-0">
                      <Pagination.Prev />
                      <Pagination.Item active>{1}</Pagination.Item>
                      <Pagination.Next />
                    </Pagination>
                  </div>
                </div>
              )}
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
