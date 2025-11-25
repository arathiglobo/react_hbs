import React, {useEffect, useState} from "react";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import { Row, Col, Card, Form,Button,Table,Modal, Pagination } from "react-bootstrap";
import { toast } from "react-hot-toast";
import axiosInstance from "../../components/AxiosInstance";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function MonthlyWise() {

const [inhousecurrentPage,setInhouseCurrentPage]=useState(1);
const [inhouseitemsPerPage,setInhouseItemsPerPage]=useState(10);
const [apicurrentPage,setApiCurrentPage]=useState(1);
const [apiitemsPerPage,setApiItemsPerPage]=useState(10);  
const [searchInhouseQuery,setSearchInhouseQuery]=useState("");
const [searchApiQuery,setSearchApiQuery]=useState("");
const [showMailModal, setShowMailModal] = useState(false);
const [emailAddress, setEmailAddress] = useState("");
const [isSending, setIsSending] = useState(false);
const [reportType,setReportType] = useState(null);

useEffect(()=>{
setInhouseCurrentPage(1);
},[searchInhouseQuery]);

useEffect(()=>{
setApiCurrentPage(1);
},[searchApiQuery]);

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
      reportType: 'Monthlywise',
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
  const currentData = reportType === 'inhouse' ? inhouseBookings : apiBookings;
  const columns = reportType === 'inhouse' 
    ? ['Sl.No', 'Hotel Name', 'Hotel Type', 'Hotel Category', 'No of Bookings', 'No Of Cancelling']
    : ['Sl.No', 'Hotel Name', 'Platform', 'No Of Booking',"No Of Cancelled Booking"];
  
  printWindow.document.write(`
    <html>
      <head>
        <title>Monthly Wise Report - ${reportType === 'inhouse' ? 'Inhouse' : 'API'}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; }
          h1 { text-align: center; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <h1>Monthly Wise Report - ${reportType === 'inhouse' ? 'Inhouse' : 'API'}</h1>
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
              <td>${booking.hotelName}</td>
              <td>${booking.hotelType}</td>
              <td>${booking.hotelCategory}</td>
              <td>${booking.noofbooking}</td>
              <td>${booking.noofcancelledbooking}</td>
                  </tr>
                `;
              } else {
                return `
                  <tr>
                    <td>${booking.slNo}</td>
              <td>${booking.hotelName}</td>
              <td>${booking.platform}</td>
              <td>${booking.noofbooking}</td>
              <td>${booking.noofCancelledbooking}</td>
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
  const currentData = reportType === 'inhouse' ? inhouseBookings : apiBookings;
  
  doc.text(`Monthly Wise Report - ${reportType === 'inhouse' ? 'Inhouse' : 'API'}`, 20, 20);
  
  if (reportType === 'inhouse') {
    autoTable(doc, {
      head: [['Sl.No', 'Hotel Name', 'Hotel Type', 'Hotel Category', 'No of Bookings', 'No Of Cancelling']],
      body: currentData.map((booking) => [
        booking.slNo,
        booking.hotelName,
        booking.hotelType,
        booking.hotelCategory,
        booking.noofbooking,
        booking.noofcancelledbooking,
      ]),
      startY: 30,
    });
  } else {
    autoTable(doc, {
      head: [['Sl.No', 'Hotel Name', 'Platform', 'No Of Booking',"No Of Cancelled Booking"]],
      body: currentData.map((booking) => [
        booking.slNo,
        booking.hotelName,
        booking.platform,
        booking.noofbooking,
        booking.noofCancelledbooking,
      ]),
      startY: 30,
    });
  }
  
  doc.save(`Monthly-wise-${reportType}-report.pdf`);
};

const handleExcel = () => {
  // Get current data
  const currentData = reportType === 'inhouse' ? inhouseBookings : apiBookings;
  const headers = reportType === 'inhouse'
    ? ['Sl.No', 'Hotel Name', 'Hotel Type', 'Hotel Category', 'No of Bookings', 'No Of Cancelling']
    : ['Sl.No', 'Hotel Name', 'Platform', 'No Of Booking',"No Of Cancelled Booking"];
  
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
        booking.hotelName,
        booking.hotelType,
        booking.hotelCategory,
        booking.noofbooking,
        booking.noofcancelledbooking,
        ].map(escapeCSV).join(',');
      } else {
        return [
          booking.slNo,
        booking.hotelName,
        booking.platform,
        booking.noofbooking,
        booking.noofCancelledbooking,
        ].map(escapeCSV).join(',');
      }
    })
  ].join('\n');

  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Monthly-wise-${reportType}-report.csv`;
  link.click();
  window.URL.revokeObjectURL(url);
};

 const inhouseBookings = [
  {
    slNo: 1,
    hotelName: "Test Hotel",
    hotelType: "07/12/2023",
    hotelCategory: "6 star",
    noofbooking: "11",
    noofcancelledbooking: "5",
  },
  {
   slNo: 2,
    hotelName: "Jumeirah Hotel",
    hotelType: "villa",
    hotelCategory: "5 star",
    noofbooking: "4",
    noofcancelledbooking: "10",
  },
  {
    slNo: 3,
    hotelName: "Direct Hotel",
    hotelType: "beach",
    hotelCategory: "4 star",
    noofbooking: "1",
    noofcancelledbooking: "2",
  },
  {
    slNo: 4,
    hotelName: "Test Hotel",
    hotelType: "resort",
    hotelCategory: "3 star",
    noofbooking: "9",
    noofcancelledbooking: "7",
  },
   {
    slNo: 1,
    hotelName: "Test Hotel",
    hotelType: "07/12/2023",
    hotelCategory: "6 star",
    noofbooking: "11",
    noofcancelledbooking: "5",
  },
  {
   slNo: 2,
    hotelName: "Jumeirah Hotel",
    hotelType: "villa",
    hotelCategory: "5 star",
    noofbooking: "4",
    noofcancelledbooking: "10",
  },
  {
    slNo: 3,
    hotelName: "Direct Hotel",
    hotelType: "beach",
    hotelCategory: "4 star",
    noofbooking: "1",
    noofcancelledbooking: "2",
  },
  {
    slNo: 4,
    hotelName: "Test Hotel",
    hotelType: "resort",
    hotelCategory: "3 star",
    noofbooking: "9",
    noofcancelledbooking: "7",
  },
  {
    slNo: 1,
    hotelName: "Test Hotel",
    hotelType: "07/12/2023",
    hotelCategory: "6 star",
    noofbooking: "11",
    noofcancelledbooking: "5",
  },
  {
   slNo: 2,
    hotelName: "Jumeirah Hotel",
    hotelType: "villa",
    hotelCategory: "5 star",
    noofbooking: "4",
    noofcancelledbooking: "10",
  },
  {
    slNo: 3,
    hotelName: "Direct Hotel",
    hotelType: "beach",
    hotelCategory: "4 star",
    noofbooking: "1",
    noofcancelledbooking: "2",
  },
  {
    slNo: 4,
    hotelName: "Test Hotel",
    hotelType: "resort",
    hotelCategory: "3 star",
    noofbooking: "9",
    noofcancelledbooking: "7",
  }
];

const apiBookings = [
  {
    slNo: 1,
    hotelName: "Jumeirah Beach Hotel",
    platform: "jumeirah",
    noofbooking: "20",
    noofCancelledbooking: 12,
  },
  {
    slNo: 2,
    hotelName: "Jumeirah Beach Hotel",
    platform: "Direct Client",
    noofbooking: "24",
    noofCancelledbooking: 1,
  },
  {
   slNo: 3,
    hotelName: "Jumeirah Beach Hotel",
    platform: "Globo",
    noofbooking: "24",
    noofCancelledbooking: 8,
  },
  {
    slNo: 4,
    hotelName: "Jumeirah Beach Hotel",
    platform: "jumeirah",
    noofbooking: "14",
    noofCancelledbooking: 5,
  },
  {
    slNo: 1,
    hotelName: "Jumeirah Beach Hotel",
    platform: "jumeirah",
    noofbooking: "20",
    noofCancelledbooking: 12,
  },
  {
    slNo: 2,
    hotelName: "Jumeirah Beach Hotel",
    platform: "Direct Client",
    noofbooking: "24",
    noofCancelledbooking: 1,
  },
  {
   slNo: 3,
    hotelName: "Jumeirah Beach Hotel",
    platform: "Globo",
    noofbooking: "24",
    noofCancelledbooking: 8,
  },
  {
    slNo: 4,
    hotelName: "Jumeirah Beach Hotel",
    platform: "jumeirah",
    noofbooking: "14",
    noofCancelledbooking: 5,
  },
  {
    slNo: 1,
    hotelName: "Jumeirah Beach Hotel",
    platform: "jumeirah",
    noofbooking: "20",
    noofCancelledbooking: 12,
  },
  {
    slNo: 2,
    hotelName: "Jumeirah Beach Hotel",
    platform: "Direct Client",
    noofbooking: "24",
    noofCancelledbooking: 1,
  },
  {
   slNo: 3,
    hotelName: "Jumeirah Beach Hotel",
    platform: "Globo",
    noofbooking: "24",
    noofCancelledbooking: 8,
  },
  {
    slNo: 4,
    hotelName: "Jumeirah Beach Hotel",
    platform: "jumeirah",
    noofbooking: "14",
    noofCancelledbooking: 5,
  }
];

const filteredapiBookings = apiBookings.filter(a=>{
  const search=searchApiQuery.toLowerCase();
  return(
    a.hotelName.toLowerCase().includes(search)||
    a.platform.toLowerCase().includes(search)||
    String(a.noofbooking).toLowerCase().includes(search)||
    String(a.noofCancelledbooking).toLowerCase().includes(search)
  )

})

const filteredinhousebookings=inhouseBookings.filter(a=>{
  const search=searchInhouseQuery.toLowerCase();
  return(
    a.hotelName.toLowerCase().includes(search)||
    a.hotelType.toLowerCase().includes(search)||
    String(a.hotelCategory).toLowerCase().includes(search)||
    String(a.noofbooking).toLowerCase().includes(search)||
    String(a.noofcancelledbooking).toLowerCase().includes(search)
  )
})

const Inhousetotalpages = Math.ceil(filteredinhousebookings.length / inhouseitemsPerPage);
const inhouseStartIndex =(inhousecurrentPage -1) * inhouseitemsPerPage;
const inhouseEndIndex = inhouseStartIndex + inhouseitemsPerPage;
const currentInhousebooking = filteredinhousebookings.slice(inhouseStartIndex,inhouseEndIndex);


const Apitotalpages = Math.ceil(filteredapiBookings.length / apiitemsPerPage);
const apiStartIndex =(apicurrentPage -1) * apiitemsPerPage;
const apiEndIndex = apiStartIndex + apiitemsPerPage;
const currentApibooking = filteredapiBookings.slice(apiStartIndex,apiEndIndex);

  return (
    <div className="bg-light d-flex flex-column" style={{ minHeight: "100vh" }}>
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />

        <main className="flex-grow-1 p-4" style={{ overflow: "auto" }}>
          <Card className="shadow-sm rounded-xl">
            <Card.Header>
              <span className="fw-semibold">Monthly Wise Report</span>
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
                      onChange={() => setReportType('inhouse')}
                    />
                    <Form.Check
                      type="radio"
                      label="API"
                      name="reportType"
                      onChange={() => setReportType('api')}
                    />
                  </div>
                </Form.Group>
              </Form>

              {/* When reportType is null - show nothing (or a message) */}
              {reportType === null && (
                <div className="text-center text-muted mt-3">
                  Please select a report type above
                </div>
              )}

              {/* When reportType is 'inhouse' - show Inhouse filters */}
              {reportType === 'inhouse' && (
                <>
                  <Row className="align-items-end g-4 mt-3">
                    {/* Month */}
                    <Col md={3}>
                      <Form.Group className="mb-0">
                        <Form.Label className="small mb-2">Month</Form.Label>
                        <Form.Select size="sm">
                          <option>Select</option>
                          <option>January</option>
                          <option>February</option>
                          <option>March</option>
                          <option>April</option>
                          <option>May</option>
                          <option>June</option>
                          <option>July</option>
                          <option>August</option>
                          <option>September</option>
                          <option>October</option>
                          <option>November</option>
                          <option>December</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>

                    {/* Hotel */}
                    <Col md={2}>
                      <Form.Group className="mb-0">
                        <Form.Label className="small mb-2">Hotel</Form.Label>
                        <Form.Select size="sm">
                          <option>Select</option>
                          <option>Test Hotel</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>

                    {/* Hotel Type */}
                    <Col md={2}>
                      <Form.Group className="mb-0">
                        <Form.Label className="small mb-2">Hotel Type</Form.Label>
                        <Form.Select size="sm">
                          <option>Select</option>
                          <option>Deluxe Room</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>

                    {/* Hotel Category */}
                    <Col md={2}>
                      <Form.Group className="mb-0">
                        <Form.Label className="small mb-2">Hotel Category</Form.Label>
                        <Form.Select size="sm">
                          <option>Select</option>
                          <option>Hotel</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>

                    {/* Search Button */}
                    <Col md={3}>
                      <Button variant="success" className="w-100" size="sm">
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

                  {/* Search Input */}
                  <Row className="mt-3">
                    <Col className="d-flex justify-content-end">
                      <input
                        type="text"
                        value={searchInhouseQuery}
                        onChange={(e)=>setSearchInhouseQuery(e.target.value)}
                        placeholder="search here"
                        className="form-control form-control-sm w-auto"
                      />
                    </Col>
                  </Row>
                </>
              )}

              {/* When reportType is 'api' - show API filters */}
              {reportType === 'api' && (
                <>
                  <Row className="align-items-end g-4 mt-3">
                    {/* Month */}
                    <Col md={4}>
                      <Form.Group className="mb-0">
                        <Form.Label className="small mb-2">Month</Form.Label>
                        <Form.Select size="sm">
                          <option>Select</option>
                          <option>January</option>
                          <option>February</option>
                          <option>March</option>
                          <option>April</option>
                          <option>May</option>
                          <option>June</option>
                          <option>July</option>
                          <option>August</option>
                          <option>September</option>
                          <option>October</option>
                          <option>November</option>
                          <option>December</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>

                    {/* Search Button */}
                    <Col md={4}>
                      <Button variant="success" className="w-100" size="sm">
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

                  {/* Search Input */}
                  <Row className="mt-3">
                    <Col className="d-flex justify-content-end">
                      <input
                        type="text"
                        value={searchApiQuery}
                        onChange={(e)=>setSearchApiQuery(e.target.value)}
                        placeholder="search here"
                        className="form-control form-control-sm w-auto"
                      />
                    </Col>
                  </Row>
                </>
              )}
            </div>

            {/* Table Section */}
            <Card.Body className="p-0 mt-1">
              {/* Display Dropdown - Only for Inhouse */}
              {reportType === 'inhouse' && (
                <div className="p-2 border-bottom">
                  <Row className="d-flex justify-content-between align-items-center">
                    <Col md="auto">
                      <span className="text-muted">Display</span>
                      <Form.Select size="sm" className="d-inline-block ms-2" style={{width: '80px'}}
                        value={inhouseitemsPerPage}
                        onChange={(e)=>{setInhouseItemsPerPage(Number(e.target.value))
                          setInhouseCurrentPage(1);
                        }}>
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </Form.Select>
                      <span className="text-muted ms-2">records</span>
                    </Col>
                  </Row>
                </div>
              )}

              {/* Display Dropdown - Only for API */}
              {reportType === 'api' && (
                <div className="p-2 border-bottom">
                  <Row className="d-flex justify-content-between align-items-center">
                    <Col md="auto">
                      <span className="text-muted">Display</span>
                      <Form.Select size="sm" className="d-inline-block ms-2" style={{width: '80px'}}
                        value={apiitemsPerPage}
                        onChange={(e)=>{setApiItemsPerPage(Number(e.target.value))
                          setApiCurrentPage(1);
                        }}>
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </Form.Select>
                      <span className="text-muted ms-2">records</span>
                    </Col>
                  </Row>
                </div>
              )}

              {/* INHOUSE TABLE */}
              {reportType === 'inhouse' && (
                <>
                  <Table responsive hover striped className="mb-0 align-middle">
                    <thead>
                      <tr>
                        <th style={{ width: 100 }}>S/N</th>
                        <th>Hotel Name</th>
                        <th>Hotel Type</th>
                        <th>Hotel Category</th>
                        <th>No of Booking</th>
                        <th>No of Cancelling</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentInhousebooking.map((booking,index) => (
                        <tr key={index}>
                          <td>{inhouseStartIndex + index + 1}</td>
                          <td>{booking.hotelName}</td>
                          <td>{booking.hotelType}</td>
                          <td>{booking.hotelCategory}</td>
                          <td>{booking.noofbooking}</td>
                          <td>{booking.noofcancelledbooking}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                  
                  {/* Pagination */}
                  <div className="d-flex justify-content-between align-items-center p-3 border-top">
                    <div>
                      <small className="text-muted">
                        Showing {filteredinhousebookings.length > 0 ? inhouseStartIndex + 1 : 0} to {Math.min(inhouseEndIndex, filteredinhousebookings.length)} of {filteredinhousebookings.length} entries
                      </small>
                    </div>
                    <div>
                      <Pagination className="mb-0">
                        <Pagination.Prev onClick={()=> setInhouseCurrentPage(prev=> Math.max(1,prev-1))}
                          disabled={inhousecurrentPage === 1}/>

                        {Array.from({length:Inhousetotalpages},(_,i)=>i+1).map((pageNum)=>{
                          if(
                            pageNum === 1||
                            pageNum === Inhousetotalpages ||
                            (pageNum >= inhousecurrentPage -1 && pageNum <=inhousecurrentPage+1)
                          ){
                            return(
                              <Pagination.Item
                              key={pageNum}
                              active={pageNum === inhousecurrentPage}
                              onClick={()=>setInhouseCurrentPage(pageNum)}>
                                {pageNum}
                              </Pagination.Item>
                            )
                          }else if(
                            pageNum === inhousecurrentPage -2||
                            pageNum === inhousecurrentPage +2
                          ){
                            return <Pagination.Ellipsis key={pageNum}/>
                          }
                          return null;
                        })}

                        <Pagination.Next onClick={()=> setInhouseCurrentPage(prev=>Math.min(Inhousetotalpages,prev+1))}
                          disabled={inhousecurrentPage === Inhousetotalpages || Inhousetotalpages === 0}/>

                      </Pagination>
                    </div>
                  </div>
                </>
              )}

              {/* API TABLE */}
              {reportType === 'api' && (
                <>
                  <Table responsive hover striped className="mb-0 align-middle">
                    <thead>
                      <tr>
                        <th style={{ width: 100 }}>S/N</th>
                        <th>Hotel Name</th>
                        <th>Platform</th>
                        <th>No Of Booking</th>
                        <th>No Of Cancelled Booking</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentApibooking.map((booking,index) => (
                        <tr key={index}>
                          <td>{apiStartIndex + index + 1}</td>
                          <td>{booking.hotelName}</td>
                          <td>{booking.platform}</td>
                          <td>{booking.noofbooking}</td>
                          <td>{booking.noofCancelledbooking}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>

                  {/* Pagination */}
                  <div className="d-flex justify-content-between align-items-center p-3 border-top">
                    <div>
                      <small className="text-muted">
                        Showing {filteredapiBookings.length > 0 ? apiStartIndex + 1 : 0} to {Math.min(apiEndIndex, filteredapiBookings.length)} of {filteredapiBookings.length} entries
                      </small>
                    </div>
                    <div>
                      <Pagination className="mb-0">
                        <Pagination.Prev onClick={()=>setApiCurrentPage(prev =>Math.max(1,prev-1))}
                          disabled={apicurrentPage === 1}/>

                        {Array.from({length:Apitotalpages},(_,i)=>i+1).map((pageNum)=>{
                          if(
                            pageNum === 1||
                            pageNum === Apitotalpages||
                            (pageNum >= apicurrentPage -1 && pageNum <=apicurrentPage+1)
                          ){
                            return(
                              <Pagination.Item
                              key={pageNum}
                              active={pageNum===apicurrentPage}
                              onClick={()=>setApiCurrentPage(pageNum)}>
                                {pageNum}
                              </Pagination.Item>
                            )
                          }else if(
                            pageNum === apicurrentPage -2||
                            pageNum === apicurrentPage +2
                          ){
                            return <Pagination.Ellipsis key={pageNum}/>
                          }
                          return null;
                        })}

                        <Pagination.Next onClick={()=>setApiCurrentPage(prev =>Math.min(Apitotalpages,prev+1))}
                          disabled={apicurrentPage === Apitotalpages || Apitotalpages === 0}/>

                      </Pagination>
                    </div>
                  </div>
                </>
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

export default MonthlyWise;
