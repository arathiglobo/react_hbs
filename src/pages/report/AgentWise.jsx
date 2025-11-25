import React, {useState} from "react";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import { Row, Col, Card, Form, Button, Dropdown, Table, Modal } from "react-bootstrap";
import { toast } from "react-hot-toast";
import axiosInstance from "../../components/AxiosInstance";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function AgentWise() {

   const [showMailModal, setShowMailModal] = useState(false);
const [emailAddress, setEmailAddress] = useState("");
const [isSending, setIsSending] = useState(false);

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
      reportType: 'agentwise',
      subType: reportType, // 'inhouse' or 'api'
      filters: {
        fromDate: fromDate,
        toDate: toDate,
        // ... other filters
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
  const printWindow = window.open('', '_blank');
  
  // Get current data based on report type
  const currentData = reportType === 'inhouse' ? filteredData : apiBookings;
  const columns = reportType === 'inhouse' 
    ? ['Sl.No','Agent Name', 'Hotel Name', 'Hotel Type','Hotel Category', 'Room Category', 'No of Booking', 'Cancelled Booking']
    : ['Sl.No', 'Hotel Name', 'Platform', 'Check In', 'Check Out', 'Hotel Type', 'No of Rooms', 'Customer Name'];
  
  printWindow.document.write(`
    <html>
      <head>
        <title>Agent Wise Report - ${reportType === 'inhouse' ? 'Inhouse' : 'API'}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; }
          h1 { text-align: center; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <h1>Agent Wise Report - ${reportType === 'inhouse' ? 'Inhouse' : 'API'}</h1>
        <table>
          <thead>
            <tr>
              ${columns.map(col => `<th>${col}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${currentData.map((booking) => {
              if (reportType === 'inhouse') {
                return `
                  <tr>
                    <td>${booking.slNo}</td>
                    <td>${booking.agentName}</td>
                    <td>${booking.hotelName}</td>
                    <td>${booking.hotelType}</td>
                    <td>${booking.HotelCategory}</td>
                    <td>${booking.roomCategory}</td>
                    <td>${booking.noOfBooking}</td>
                    <td>${booking.cancelledBooking}</td>
                  </tr>
                `;
              } else {
                return `
                  <tr>
                    <td>${booking.slNo}</td>
                    <td>${booking.hotelName}</td>
                    <td>${booking.platform}</td>
                    <td>${booking.checkIn}</td>
                    <td>${booking.checkOut}</td>
                    <td>${booking.hotelType}</td>
                    <td>${booking.noOfRooms}</td>
                    <td>${booking.customerName}</td>
                  </tr>
                `;
              }
            }).join('')}
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
  
  // Get current data
  const currentData = reportType === 'inhouse' ? filteredData : apiBookings;
  
  doc.text(`Agent Wise Report - ${reportType === 'inhouse' ? 'Inhouse' : 'API'}`, 20, 20);
  
  if (reportType === 'inhouse') {
    autoTable(doc, {
      head: [['Sl.No','Agent Name', 'Hotel Name', 'Hotel Type','Hotel Category', 'Room Category', 'No of Booking', 'Cancelled Booking']],
      body: currentData.map((booking) => [
        booking.slNo,
        booking.agentName,
        booking.hotelName,
        booking.hotelType,
        booking.HotelCategory,
        booking.roomCategory,
        booking.noOfBooking,
        booking.cancelledBooking
      ]),
      startY: 30,
    });
  } else {
    autoTable(doc, {
      head: [['Sl.No', 'Hotel Name', 'Platform', 'Check In', 'Check Out', 'Hotel Type', 'No of Rooms', 'Customer Name']],
      body: currentData.map((booking) => [
        booking.slNo,
        booking.hotelName,
        booking.platform,
        booking.checkIn,
        booking.checkOut,
        booking.hotelType,
        booking.noOfRooms,
        booking.customerName
      ]),
      startY: 30,
    });
  }
  
  doc.save(`agent-wise-${reportType}-report.pdf`);
};

const handleExcel = () => {
  // Get current data
  const currentData = reportType === 'inhouse' ? filteredData : apiBookings;
  const headers = reportType === 'inhouse'
    ? ['Sl.No','Agent Name', 'Hotel Name', 'Hotel Type','Hotel Category', 'Room Category', 'No of Booking', 'Cancelled Booking']
    : ['Sl.No', 'Hotel Name', 'Platform', 'Check In', 'Check Out', 'Hotel Type', 'No of Rooms', 'Customer Name'];
  
  // Create CSV content with proper escaping
  const escapeCSV = (value) => {
    if (value === null || value === undefined) return '';
    const stringValue = String(value);
    if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };
  
  const csvContent = [
    headers.map(escapeCSV).join(','),
    ...currentData.map((booking) => {
      if (reportType === 'inhouse') {
        return [
          booking.slNo,
          booking.agentName,
          booking.hotelName,
          booking.hotelType,
          booking.HotelCategory,
          booking.roomCategory,
          booking.noOfBooking,
          booking.cancelledBooking
        ].map(escapeCSV).join(',');
      } else {
        return [
          booking.slNo,
          booking.hotelName,
          booking.platform,
          booking.checkIn,
          booking.checkOut,
          booking.hotelType,
          booking.noOfRooms,
          booking.customerName
        ].map(escapeCSV).join(',');
      }
    })
  ].join('\n');

  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `agent-wise-${reportType}-report.csv`;
  link.click();
  window.URL.revokeObjectURL(url);
};

  const inhouseBookings = [
  {
    slNo: 1,
    agentName: "Globo agent",
    hotelName: "Test Hotel",
    hotelType: "beach hotel",
    HotelCategory: "2",
    roomCategory: "Deluxe Room",
    noOfBooking: 1,
    cancelledBooking: "0",
    checkIn: "07/12/2025",
    checkOut: "12/12/2025"
  },
  {
    slNo: 2,
    agentName: "Direct Client",
    hotelName: "Test Hotel",
    hotelType: "resort",
    HotelCategory: "2",
    roomCategory: "Deluxe Room, Deluxe Room",
    noOfBooking: 1,
    cancelledBooking: "0",
    checkIn: "16/10/2025",
    checkOut: "21/10/2025"
  },
  {
    slNo: 3,
    agentName: "Globo agent",
    hotelName: "Test Hotel Two",
    hotelType: "apartment",
    HotelCategory: "3",
    roomCategory: "Deluxe Room",
    noOfBooking: 1,
    cancelledBooking: "0",
    checkIn: "14/10/2025",
    checkOut: "20/10/2025"
  },
  {
    slNo: 4,
    agentName: "Direct Client",
    hotelName: "Test Hotel Two",
    hotelType: "villas",
    HotelCategory: "3",
    roomCategory: "Deluxe Room, Deluxe Room",
    noOfBooking: 1,
    cancelledBooking: "0",
    checkIn: "01/09/2025",
    checkOut: "02/09/2025"
  }
];

const apiBookings = [
  {
    slNo: 1,
    agentName: "API Agent",
    hotelName: "Jumeirah Beach Hotel",
    platform: "jumeirah",
    checkIn: "15/09/2025",
    checkOut: "16/09/2025",
    hotelType: "HOTEL",
    roomCategory: "Standard Room",
    noOfRooms: 1,
    customerName: "Mr. tester jum tester"
  },
  {
    slNo: 2,
    agentName: "External Agent",
    hotelName: "Jumeirah Beach Hotel",
    platform: "jumeirah",
    checkIn: "15/09/2025",
    checkOut: "16/09/2025",
    hotelType: "HOTEL",
    roomCategory: "Deluxe Room",
    noOfRooms: 1,
    customerName: "Mr. tester jum tester"
  },
  {
    slNo: 3,
    agentName: "API Agent",
    hotelName: "Test Hotel API",
    platform: "booking",
    checkIn: "12/09/2025",
    checkOut: "13/09/2025",
    hotelType: "RESORT",
    roomCategory: "Suite",
    noOfRooms: 1,
    customerName: "Mr. Dhyan testcase1"
  },
  {
    slNo: 4,
    agentName: "External Agent",
    hotelName: "Test Hotel API",
    platform: "expedia",
    checkIn: "20/09/2025",
    checkOut: "21/09/2025",
    hotelType: "VILLA",
    roomCategory: "Standard Room",
    noOfRooms: 1,
    customerName: "Mr. Amala tset case one"
  }
];



const [reportType,setReportType] = useState(null);
const [showData, setShowData] = useState(false); // Control when to show table data
const [filteredData, setFilteredData] = useState([]); // Store filtered results
const [filters, setFilters] = useState({
  agent: '',
  hotel: '',
  hotelType: '',
  hotelCategory: '',
  roomCategory: '',
  fromDate: '',
  toDate: ''
});

const [apiFilters, setApiFilters] = useState({
  agent: '',
  hotel: '',
  platform: '',
  hotelType: '',
  roomCategory: '',
  fromDate: '',
  toDate: ''
});

// Filter function for Inhouse data
const filterInhouseData = () => {
  let filtered = [...inhouseBookings];
  
  // Filter by Agent
  if (filters.agent) {
    filtered = filtered.filter(item => item.agentName === filters.agent);
  }
  
  // Filter by Hotel
  if (filters.hotel) {
    filtered = filtered.filter(item => item.hotelName === filters.hotel);
  }
  
  // Filter by Hotel Type
  if (filters.hotelType) {
    filtered = filtered.filter(item => item.hotelType === filters.hotelType);
  }
  
  // Filter by Hotel Category
  if (filters.hotelCategory) {
    filtered = filtered.filter(item => item.HotelCategory === filters.hotelCategory);
  }
  
  // Filter by Room Category
  if (filters.roomCategory) {
    filtered = filtered.filter(item => item.roomCategory === filters.roomCategory);
  }
  
  // Filter by Date Range (if dates are provided)
  if (filters.fromDate && filters.toDate) {
    filtered = filtered.filter(item => {
      // Convert date strings to Date objects for comparison
      const itemDate = new Date(item.checkIn.split('/').reverse().join('-'));
      const fromDate = new Date(filters.fromDate);
      const toDate = new Date(filters.toDate);
      return itemDate >= fromDate && itemDate <= toDate;
    });
  }
  
  return filtered;
};

// Filter function for API data
const filterApiData = () => {
  let filtered = [...apiBookings];
  
  // Filter by Agent
  if (apiFilters.agent) {
    filtered = filtered.filter(item => item.agentName === apiFilters.agent);
  }
  
  // Filter by Hotel
  if (apiFilters.hotel) {
    filtered = filtered.filter(item => item.hotelName === apiFilters.hotel);
  }
  
  // Filter by Platform
  if (apiFilters.platform) {
    filtered = filtered.filter(item => item.platform === apiFilters.platform);
  }
  
  // Filter by Hotel Type
  if (apiFilters.hotelType) {
    filtered = filtered.filter(item => item.hotelType === apiFilters.hotelType);
  }
  
  // Filter by Room Category
  if (apiFilters.roomCategory) {
    filtered = filtered.filter(item => item.roomCategory === apiFilters.roomCategory);
  }
  
  // Filter by Date Range (if dates are provided)
  if (apiFilters.fromDate && apiFilters.toDate) {
    filtered = filtered.filter(item => {
      // Convert date strings to Date objects for comparison
      const itemDate = new Date(item.checkIn.split('/').reverse().join('-'));
      const fromDate = new Date(apiFilters.fromDate);
      const toDate = new Date(apiFilters.toDate);
      return itemDate >= fromDate && itemDate <= toDate;
    });
  }
  
  return filtered;
};

// Handle search button click
const handleSearch = () => {
  if (reportType === 'inhouse') {
    const filtered = filterInhouseData();
    setFilteredData(filtered);
  } else if (reportType === 'api') {
    const filtered = filterApiData();
    setFilteredData(filtered);
  }
  setShowData(true);
};

  return (
    <div className="bg-light d-flex flex-column" style={{ minHeight: "100vh" }}>
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />

        <main className="flex-grow-1 p-4" style={{ overflow: "auto" }}>
          <Card className="shadow-sm rounded-xl">
            <Card.Header>
              <span className="fw-semibold">Agent Wise Report</span>
            </Card.Header>

            {/* Filters Section */}
            <div className="p-4 bg-light border-bottom">
              <Form>
                <Form.Group>
                  <Form.Label className="fw-semibold">* Please select:</Form.Label>
                  <div className="d-flex gap-3 mt-2">
                    <Form.Check
                      type="radio"
                      label="Inhouse"
                      name="reportType"
                      onChange={() => {
                        setReportType('inhouse');
                        setShowData(false); // Reset data visibility when switching
                        setFilteredData([]); // Clear filtered data
                        setFilters({agent: '', hotel: '', hotelType: '', hotelCategory: '', roomCategory: '', fromDate: '', toDate: ''}); // Reset inhouse filters
                      }}
                    />
                    <Form.Check
                      type="radio"
                      label="API"
                      name="reportType"
                      onChange={() => {
                        setReportType('api');
                        setShowData(false); // Reset data visibility when switching
                        setFilteredData([]); // Clear filtered data
                        setApiFilters({agent: '', hotel: '', platform: '', hotelType: '', roomCategory: '', fromDate: '', toDate: ''}); // Reset API filters
                      }}
                    />
                  </div>
                </Form.Group>

                {/* When reportType is null - show nothing (or a message) */}
                {reportType === null && (
                  <div className="text-center text-muted mt-3">
                    Please select a report type above
                  </div>
                )}
              </Form>

              {/* When reportType is 'inhouse' - show Inhouse filters */}
              {reportType === 'inhouse' && (
                <>
                  <Row className="align-items-end g-4 mt-3">
                    {/* Agent */}
                    <Col md={2}>
                      <Form.Group className="mb-0">
                        <Form.Label className="small mb-2">Agent</Form.Label>
                        <Form.Select 
                          size="sm" 
                          value={filters.agent}
                          onChange={(e) => setFilters({...filters, agent: e.target.value})}
                        >
                          <option value="">Select</option>
                          <option value="Globo agent">Globo Agent</option>
                          <option value="Direct Client">Direct Client</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>

                    {/* Hotel */}
                    <Col md={2}>
                      <Form.Group className="mb-0">
                        <Form.Label className="small mb-2">Hotel</Form.Label>
                        <Form.Select 
                          size="sm"
                          value={filters.hotel}
                          onChange={(e) => setFilters({...filters, hotel: e.target.value})}
                        >
                          <option value="">Select</option>
                          <option value="Test Hotel">Test Hotel</option>
                          <option value="Test Hotel Two">Test Hotel Two</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>

                    {/* Hotel Type */}
                    <Col md={2}>
                      <Form.Group className="mb-0">
                        <Form.Label className="small mb-2">Hotel Type</Form.Label>
                        <Form.Select 
                          size="sm"
                          value={filters.hotelType}
                          onChange={(e) => setFilters({...filters, hotelType: e.target.value})}
                        >
                          <option value="">Select</option>
                          <option value="beach hotel">Beach Hotel</option>
                          <option value="resort">Resort</option>
                          <option value="apartment">Apartment</option>
                          <option value="villas">Villas</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>

                    {/* Hotel Category */}
                    <Col md={2}>
                      <Form.Group className="mb-0">
                        <Form.Label className="small mb-2">Hotel Category</Form.Label>
                        <Form.Select 
                          size="sm"
                          value={filters.hotelCategory}
                          onChange={(e) => setFilters({...filters, hotelCategory: e.target.value})}
                        >
                          <option value="">Select</option>
                          <option value="2">2</option>
                          <option value="3">3</option>
                          <option value="4">4</option>
                          <option value="5">5</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>

                    {/* Room Category */}
                    <Col md={2}>
                      <Form.Group className="mb-0">
                        <Form.Label className="small mb-2">Room Category</Form.Label>
                        <Form.Select 
                          size="sm"
                          value={filters.roomCategory}
                          onChange={(e) => setFilters({...filters, roomCategory: e.target.value})}
                        >
                          <option value="">Select</option>
                          <option value="Deluxe Room">Deluxe Room</option>
                          <option value="Deluxe Room, Deluxe Room">Deluxe Room, Deluxe Room</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>

                    {/* From Date */}
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

                    {/* To Date */}
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

                    {/* Search Button */}
                    <Col md={12} className="d-flex justify-content-end mt-3">
                      <Button variant="success" size="sm" onClick={handleSearch}>
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
                </>
              )}

              {/* When reportType is 'api' - show API filters */}
              {reportType === 'api' && (
                <>
                  <Row className="align-items-end g-4 mt-3">
                    {/* Agent */}
                    <Col md={2}>
                      <Form.Group className="mb-0">
                        <Form.Label className="small mb-2">Agent</Form.Label>
                        <Form.Select 
                          size="sm" 
                          value={apiFilters.agent || ''}
                          onChange={(e) => setApiFilters({...apiFilters, agent: e.target.value})}
                        >
                          <option value="">Select</option>
                          <option value="API Agent">API Agent</option>
                          <option value="External Agent">External Agent</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>

                    {/* Hotel */}
                    <Col md={2}>
                      <Form.Group className="mb-0">
                        <Form.Label className="small mb-2">Hotel</Form.Label>
                        <Form.Select 
                          size="sm"
                          value={apiFilters.hotel || ''}
                          onChange={(e) => setApiFilters({...apiFilters, hotel: e.target.value})}
                        >
                          <option value="">Select</option>
                          <option value="Jumeirah Beach Hotel">Jumeirah Beach Hotel</option>
                          <option value="Test Hotel API">Test Hotel API</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>
                     
                    {/* From Date */}
                    <Col md={3}>
                      <Form.Group className="mb-0">
                        <Form.Label className="small mb-2">From Date</Form.Label>
                        <Form.Control 
                          type="date" 
                          size="sm" 
                          value={apiFilters.fromDate}
                          onChange={(e) => setApiFilters({...apiFilters, fromDate: e.target.value})}
                        />
                      </Form.Group>
                    </Col>

                    {/* To Date */}
                    <Col md={3}>
                      <Form.Group className="mb-0">
                        <Form.Label className="small mb-2">To Date</Form.Label>
                        <Form.Control 
                          type="date" 
                          size="sm" 
                          value={apiFilters.toDate}
                          onChange={(e) => setApiFilters({...apiFilters, toDate: e.target.value})}
                        />
                      </Form.Group>
                    </Col>

                    {/* Search Button */}
                    <Col md={12} className="d-flex justify-content-end mt-3">
                      <Button variant="success" size="sm" onClick={handleSearch}>
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
                </>
              )}
            </div>

            {/* Table Section */}
            <Card.Body className="p-0 mt-1">
              {/* Show table structure with empty data when report type is selected but no search performed */}
              {reportType && !showData && (
                <>
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
                          placeholder="search here"
                          className="form-control form-control-sm w-auto"
                        />
                      </Col>
                    </Row>
                  </div>

                  {/* Empty Table with Headers */}
                  <Table responsive hover striped className="mb-0 align-middle">
                    <thead>
                      <tr>
                        <th style={{ width: 100 }}>S/N</th>
                        <th>Agent Name</th>
                        <th>Hotel Name</th>
                        <th>Hotel Type</th>
                        <th>Hotel Category</th> 
                        <th>Room Category</th> 
                        <th>No of Booking</th>
                        <th>Cancelled Booking</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td colSpan="8" className="text-center text-muted py-4">
                          No data to display.
                        </td>
                      </tr>
                    </tbody>
                  </Table>
                </>
              )}

              {/* INHOUSE TABLE */}
              {reportType === 'inhouse' && showData && (
                <>
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
                          placeholder="search here"
                          className="form-control form-control-sm w-auto"
                        />
                      </Col>
                    </Row>
                  </div>

                  {/* Inhouse Table */}
                  <Table responsive hover striped className="mb-0 align-middle">
                    <thead>
                      <tr>
                        <th style={{ width: 100 }}>S/N</th>
                        <th>Agent Name</th>
                        <th>Hotel Name</th>
                        <th>Hotel Type</th>
                        <th>Hotel Category</th> 
                        <th>Room Category</th> 
                        <th>No of Booking</th>
                        <th>Cancelled Booking</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredData.length > 0 ? (
                        filteredData.map((booking, index) => (
                          <tr key={booking.slNo}>
                            <td>{index + 1}</td>
                            <td>{booking.agentName}</td>
                            <td>{booking.hotelName}</td>
                            <td>{booking.hotelType}</td>
                            <td>{booking.HotelCategory}</td>
                            <td>{booking.roomCategory}</td>
                            <td>{booking.noOfBooking}</td>
                            <td>{booking.cancelledBooking}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="8" className="text-center text-muted py-4">
                            No data found matching your criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </>
              )}

              {/* API TABLE */}
              {reportType === 'api' && showData && (
                <>
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
                          placeholder="search here"
                          className="form-control form-control-sm w-auto"
                        />
                      </Col>
                    </Row>
                  </div>

                  {/* API Table */}
                  <Table responsive hover striped className="mb-0 align-middle">
                    <thead>
                      <tr>
                        <th style={{ width: 100 }}>S/N</th>
                        <th>Hotel Name</th>
                        <th>Platform</th>
                        <th>Check In</th>
                        <th>Check Out</th>
                        <th>Hotel Type</th>
                        <th>No of Rooms</th>
                        <th>Customer Name</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredData.length > 0 ? (
                        filteredData.map((booking, index) => (
                          <tr key={booking.slNo}>
                            <td>{index + 1}</td>
                            <td>{booking.hotelName}</td>
                            <td>{booking.platform}</td>
                            <td>{booking.checkIn}</td>
                            <td>{booking.checkOut}</td>
                            <td>{booking.hotelType}</td>
                            <td>{booking.noOfRooms}</td>
                            <td>{booking.customerName}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="8" className="text-center text-muted py-4">
                            No data found matching your criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </>
              )}
            </Card.Body>
          </Card>

          {/* Mail Modal */}
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

export default AgentWise;
