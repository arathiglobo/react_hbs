import React, { useState } from "react";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import {
  Row,
  Col,
  Card,
  Form,
  Button,
  Table,
  Pagination,
} from "react-bootstrap";

export default function TimeLimitOnlineDailySalesReport() {

  const [currentPage,setCurrentPage] =useState(1);
  const [itemsPerPage,setItemsPerPage] =useState(10);
  const [searcQuery,setSearchQuery]=useState("");

const handlePrint =()=>{
  const printWindow = window.open('','_blank');
  printWindow.document.write(`
    <html>
    <head>
    <title>Time Limit Online Sales Report</title>
    <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            h1 { text-align: center; margin-bottom: 20px; }
          </style>
          </head>
          <body>
          <h1>Time Limit Online Sales Report</h1>
          <table>
          <thead>
          <tr>
          <th>SI:No</th>
          <th>Agent</th>
          <th>Supplier</th>
          <th>Customer</th>
          <th>Booking Code</th>
          <th>Reference</th>
          <th>Booking By</th>
          <th>Book Date</th>
          <th>Details</th>
          <th>DeadLine</th>
          </tr>
          </thead>
          <tbody>
          ${currentreports.map((r,index)=>
            `<tr>
            <td>${index+1}</td>
             <td>${r.agent}</td>
             <td>${r.supplier}</td>
             <td>${r.customer}</td>
             <td>${r.bookingCode}</td>
             <td>${r.reference}</td>
             <td>${r.bookingBy}</td>
             <td>${r.bookDate}</td>
             <td>${r.details}</td>
             <td>${r.deadline}</td>
            </tr>
            `
          ).join('')}
          </tbody>
          </table>
          </body>
    </html>
    `)
}

const handleExcel = () => {
  const headers = [
    'SI.No', 'Agent', 'Supplier', 'Customer', 'Booking Code',
    'Reference', 'BookingBy', 'BookDate', 'Details'
  ];

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
    ...currentreports.map((r, index) => [
      index + 1,
      r.agent,
      r.supplier,
      r.customer,
      r.bookingCode,
      r.reference,
      r.bookingBy,
      r.bookDate,
      r.details,
      r.sellingPrice
    ].map(escapeCSV).join(','))
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

// Dummy data
  const reports = [
    {
      id: 1,
      agent: "Direct Client",
      supplier: "Inhouse",
      customer: "Mr. Balaraju Barkam",
      bookingCode: "CNF_BOOK_0236",
      reference: "CNFS2023111414821434",
      bookingBy: "Gautham",
      bookDate: "2023-11-14",
      details: `Hotel Name: 
Check-in: 2023-11-17
Check-Out: 2023-11-26
Total Pax: adult(s) and child(ren)`,
      deadline: "2023-11-14",
    },
    {
      id: 2,
      agent: "Direct Client",
      supplier: "Inhouse",
      customer: "Mr. Sachin ",
      bookingCode: "CNF_BOOK_0237",
      reference: "CNFS2023111411054716",
      bookingBy: "Mubassir Bhatkar",
      bookDate: "2023-11-14",
      details: `Hotel Name: 
Check-in: 2023-11-16
Check-Out: 2023-11-26`,
      deadline: "2023-11-13",
    },
    {
      id: 1,
      agent: "Direct Client",
      supplier: "Inhouse",
      customer: "Mr. Balaraju Barkam",
      bookingCode: "CNF_BOOK_0236",
      reference: "CNFS2023111414821434",
      bookingBy: "Gautham",
      bookDate: "2023-11-14",
      details: `Hotel Name: 
Check-in: 2023-11-17
Check-Out: 2023-11-26
Total Pax: adult(s) and child(ren)`,
      deadline: "2023-11-14",
    },
    {
      id: 2,
      agent: "Direct Client",
      supplier: "Inhouse",
      customer: "Mr. Sachin ",
      bookingCode: "CNF_BOOK_0237",
      reference: "CNFS2023111411054716",
      bookingBy: "Mubassir Bhatkar",
      bookDate: "2023-11-14",
      details: `Hotel Name: 
Check-in: 2023-11-16
Check-Out: 2023-11-26`,
      deadline: "2023-11-13",
    },
    {
      id: 1,
      agent: "Direct Client",
      supplier: "Inhouse",
      customer: "Mr. Balaraju Barkam",
      bookingCode: "CNF_BOOK_0236",
      reference: "CNFS2023111414821434",
      bookingBy: "Gautham",
      bookDate: "2023-11-14",
      details: `Hotel Name: 
Check-in: 2023-11-17
Check-Out: 2023-11-26
Total Pax: adult(s) and child(ren)`,
      deadline: "2023-11-14",
    },
    {
      id: 2,
      agent: "Direct Client",
      supplier: "Inhouse",
      customer: "Mr. Sachin ",
      bookingCode: "CNF_BOOK_0237",
      reference: "CNFS2023111411054716",
      bookingBy: "Mubassir Bhatkar",
      bookDate: "2023-11-14",
      details: `Hotel Name: 
Check-in: 2023-11-16
Check-Out: 2023-11-26`,
      deadline: "2023-11-13",
    },
    {
      id: 1,
      agent: "Direct Client",
      supplier: "Inhouse",
      customer: "Mr. Balaraju Barkam",
      bookingCode: "CNF_BOOK_0236",
      reference: "CNFS2023111414821434",
      bookingBy: "Gautham",
      bookDate: "2023-11-14",
      details: `Hotel Name: 
Check-in: 2023-11-17
Check-Out: 2023-11-26
Total Pax: adult(s) and child(ren)`,
      deadline: "2023-11-14",
    },
    {
      id: 2,
      agent: "Direct Client",
      supplier: "Inhouse",
      customer: "Mr. Sachin ",
      bookingCode: "CNF_BOOK_0237",
      reference: "CNFS2023111411054716",
      bookingBy: "Mubassir Bhatkar",
      bookDate: "2023-11-14",
      details: `Hotel Name: 
Check-in: 2023-11-16
Check-Out: 2023-11-26`,
      deadline: "2023-11-13",
    },
    {
      id: 1,
      agent: "Direct Client",
      supplier: "Inhouse",
      customer: "Mr. Balaraju Barkam",
      bookingCode: "CNF_BOOK_0236",
      reference: "CNFS2023111414821434",
      bookingBy: "Gautham",
      bookDate: "2023-11-14",
      details: `Hotel Name: 
Check-in: 2023-11-17
Check-Out: 2023-11-26
Total Pax: adult(s) and child(ren)`,
      deadline: "2023-11-14",
    },
    {
      id: 2,
      agent: "Direct Client",
      supplier: "Inhouse",
      customer: "Mr. Sachin ",
      bookingCode: "CNF_BOOK_0237",
      reference: "CNFS2023111411054716",
      bookingBy: "Mubassir Bhatkar",
      bookDate: "2023-11-14",
      details: `Hotel Name: 
Check-in: 2023-11-16
Check-Out: 2023-11-26`,
      deadline: "2023-11-13",
    },
    {
      id: 1,
      agent: "Direct Client",
      supplier: "Inhouse",
      customer: "Mr. Balaraju Barkam",
      bookingCode: "CNF_BOOK_0236",
      reference: "CNFS2023111414821434",
      bookingBy: "Gautham",
      bookDate: "2023-11-14",
      details: `Hotel Name: 
Check-in: 2023-11-17
Check-Out: 2023-11-26
Total Pax: adult(s) and child(ren)`,
      deadline: "2023-11-14",
    },
    {
      id: 2,
      agent: "Direct Client",
      supplier: "Inhouse",
      customer: "Mr. Sachin",
      bookingCode: "CNF_BOOK_0237",
      reference: "CNFS2023111411054716",
      bookingBy: "Mubassir Bhatkar",
      bookDate: "2023-11-14",
      details: `Hotel Name: 
Check-in: 2023-11-16
Check-Out: 2023-11-26`,
      deadline: "2023-11-13",
    },
    {
      id: 1,
      agent: "Direct Client",
      supplier: "Inhouse",
      customer: "Mr. Balaraju Barkam",
      bookingCode: "CNF_BOOK_0236",
      reference: "CNFS2023111414821434",
      bookingBy: "Gautham",
      bookDate: "2023-11-14",
      details: `Hotel Name: 
Check-in: 2023-11-17
Check-Out: 2023-11-26
Total Pax: adult(s) and child(ren)`,
      deadline: "2023-11-14",
    },
    {
      id: 2,
      agent: "Direct Client",
      supplier: "Inhouse",
      customer: "Mr. Sachin ",
      bookingCode: "CNF_BOOK_0237",
      reference: "CNFS2023111411054716",
      bookingBy: "Mubassir Bhatkar",
      bookDate: "2023-11-14",
      details: `Hotel Name: 
Check-in: 2023-11-16
Check-Out: 2023-11-26`,
      deadline: "2023-11-13",
    },
    {
      id: 1,
      agent: "Direct Client",
      supplier: "Inhouse",
      customer: "Mr. Balaraju Barkam",
      bookingCode: "CNF_BOOK_0236",
      reference: "CNFS2023111414821434",
      bookingBy: "Gautham",
      bookDate: "2023-11-14",
      details: `Hotel Name: 
Check-in: 2023-11-17
Check-Out: 2023-11-26
Total Pax: adult(s) and child(ren)`,
      deadline: "2023-11-14",
    },
    {
      id: 2,
      agent: "Direct Client",
      supplier: "Inhouse",
      customer: "Mr. Sachin ",
      bookingCode: "CNF_BOOK_0237",
      reference: "CNFS2023111411054716",
      bookingBy: "Mubassir Bhatkar",
      bookDate: "2023-11-14",
      details: `Hotel Name: 
Check-in: 2023-11-16
Check-Out: 2023-11-26`,
      deadline: "2023-11-13",
    }
  ];

  const filteredreports= reports.filter(a=>{
    const search = searcQuery.toLowerCase();
    return(
      String(a.agent).toLowerCase().includes(search)||
      String(a.supplier).toLowerCase().includes(search)||
      String(a.customer).toLowerCase().includes(search)||
      String(a.bookingCode).toLowerCase().includes(search)||
      String(a.reference).toLowerCase().includes(search)||
      String(a.bookingBy).toLowerCase().includes(search)||
      String(a.bookDate).toLowerCase().includes(search)||
      String(a.details).toLowerCase().includes(search)||
      String(a.deadline).toLowerCase().includes(search)
    )
  })

  const totalPages=Math.ceil(filteredreports.length / itemsPerPage);
  const startIndex = (currentPage -1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentreports = filteredreports.slice(startIndex,endIndex);

  return (
    <div className="bg-light d-flex flex-column" style={{ minHeight: "100vh" }}>
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />

        <main className="flex-grow-1 p-4" style={{ overflow: "auto" }}>
          <Card className="shadow-sm rounded-xl">
            <Card.Header>
              <span className="fw-semibold">TimeLimit Online Sales Report</span>
            </Card.Header>

            {/* Filters Section */}
            <div className="p-4 bg-light border-bottom">
              <Row className="align-items-end g-4">
                <Col md={2}>
                  <Form.Group className="mb-0">
                    <Form.Label className="small mb-2">From Date</Form.Label>
                    <Form.Control type="date" size="sm" />
                  </Form.Group>
                </Col>
                <Col md={2}>
                  <Form.Group className="mb-0">
                    <Form.Label className="small mb-2">To Date</Form.Label>
                    <Form.Control type="date" size="sm" />
                  </Form.Group>
                </Col>
                <Col md={2}>
                  <Form.Group className="mb-0">
                    <Form.Label className="small mb-2">Supplier</Form.Label>
                    <Form.Select size="sm">
                      <option>Select</option>
                      <option>Inhouse</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group className="mb-0">
                    <Form.Label className="small mb-2">Search Agent</Form.Label>
                    <Form.Select size="sm">
                      <option>Select</option>
                      <option>Direct Client</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group className="mb-0">
                    <Form.Label className="small mb-2">Staff</Form.Label>
                    <Form.Select size="sm">
                      <option>Select</option>
                      <option>Mubassir Bhatkar</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={12} className="d-flex justify-content-end mt-3">
                  <Button variant="success" size="sm">
                    <i className="fas fa-search me-1"></i>Search
                  </Button>
                </Col>
              </Row>

              {/* Action Buttons */}
              <Row className="mt-4">
                <Col md={12} className="d-flex gap-2 justify-content-end">
                  <Button variant="outline-secondary" size="sm" onClick={handlePrint}>
                    <i className="fas fa-print me-1"></i>Print
                  </Button>
                  <Button variant="outline-success" size="sm" onClick={handleExcel}>
                    <i className="fas fa-file-excel me-1"></i>Excel
                  </Button>
                </Col>
              </Row>

              {/* Search Input */}
              <Row className="mt-3">
                <Col className="d-flex">
                  <input
                    type="text"
                    value={searcQuery}
                    onChange={(e)=>setSearchQuery(e.target.value)}
                    placeholder="search here"
                    className="form-control form-control-sm w-auto"
                  />
                </Col>
              </Row>
            </div>

            {/* Table Section */}
            <Card.Body className="p-0 mt-1">
              {/* Display Dropdown */}
              <div className="p-2 border-bottom">
                <Row className="d-flex justify-content-between align-items-center">
                  <Col md="auto">
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
                  </Col>
                </Row>
              </div>

              <Table responsive hover striped className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th style={{ width: 100 }}>S/N</th>
                    <th>Agent Name</th>
                    <th>Supplier Name</th>
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
                        <td>{r.agent}</td>
                        <td>{r.supplier}</td>
                        <td>{r.customer}</td>
                        <td>{r.bookingCode}</td>
                        <td>{r.reference}</td>
                        <td>{r.bookingBy}</td>
                        <td>{r.bookDate}</td>
                        <td style={{ whiteSpace: "pre-line" }}>{r.details}</td>
                        <td>{r.deadline}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="10" className="text-center text-muted py-4">
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
                    Showing {filteredreports.length > 0 ? startIndex + 1 : 0} to {Math.min(endIndex, filteredreports.length)} of {filteredreports.length} entries
                  </small>
                </div>
                <div>
                  <Pagination className="mb-0">
                    <Pagination.Prev onClick={()=>setCurrentPage(prev=>Math.max(1,prev-1))}
                      disabled={currentPage === 1}/>

                    {Array.from({length:totalPages},(_,i)=>i+1).map((pageNum)=>{
                      if(
                        pageNum === 1||
                        pageNum === totalPages||
                        (pageNum >= currentPage -1 && pageNum <= currentPage+1)
                      ){
                        return(
                          <Pagination.Item
                          key={pageNum}
                          active={pageNum === currentPage}
                          onClick={()=>setCurrentPage(pageNum)}>
                            {pageNum}
                          </Pagination.Item>
                        )
                      }else if(
                        pageNum === currentPage +2||
                        pageNum === currentPage -2
                      ){
                        return <Pagination.Ellipsis key={pageNum}/>
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
        </main>
      </div>
    </div>
  );
}
