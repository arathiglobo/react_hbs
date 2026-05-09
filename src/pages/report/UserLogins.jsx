import React, { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import { Row, Col, Card, Form,Button,Table,Modal, Pagination } from "react-bootstrap";
import { toast } from "react-hot-toast";
import axiosInstance from "../../components/AxiosInstance";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';


export default function UserLogins() {

  const [currentPage,setCurrentPage]=useState(1);
  const [itemsPerPage,setItemsPerPage]=useState(10);
  const [searchQuery,setSearchQuery]=useState("");
  const[showMailModal,setShowMailModal]=useState(false);
  const[emailAddress,setEmailAddress]=useState("");
  const[isSending,setIsSending]=useState(false);

  useEffect(()=>{
    setCurrentPage(1);
  },[searchQuery]);

  const handleSendEmail=async()=>{
    if(!emailAddress|| !/^\S+@\S+\.\S+$/.test(emailAddress)){
      toast.error("please enter a valid email address");
      return;
    }
    setIsSending(true);
    try{
      const response=await axiosInstance.post('/api/reports/send-email',{
        email : emailAddress,
        reportType:'logins',
         subType:reportType,
         filters:{

         }
      })
      if(response.data){
        toast.success("Report Sent Successfully!")
        setShowMailModal(false);
        setEmailAddress("");
      }
    }
    catch(error){
      toast.error("failed to sent mail")
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
                <th>Hotel Name</th>
                <th>Login</th>
                <th>Logout</th>
              </tr>
            </thead>
            <tbody>
              ${currentLogins.map((l, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${l.code}</td>
                  <td>${l.name}</td>
                  <td>${l.checkIn}</td>
                  <td>${l.checkOut}</td>
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
          head: [['Sl.No', 'Code ', 'Hotel Name', 'Login', 'Logout' ]],
          body: currentLogins.map((l, index) => [
            index + 1,
            l.code,
            l.name,
            l.checkIn,
            l.checkOut,
            ]),
          startY: 30,
        });
         // Download PDF
        doc.save('User-Login-report.pdf');
      };

      const handleExcel = () => {
    const headers = ['Sl.No', 'Code ', 'Hotel Name', 'Login', 'Logout'];
    
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
      ...currentLogins.map((l, index) => [
        index + 1,
            l.code,
            l.name,
            l.checkIn,
            l.checkOut,
      ].map(escapeCSV).join(','))
    ].join('\n');

    // Add BOM for UTF-8 to ensure proper Excel encoding
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'User-Login-report.csv';
    link.click();
    window.URL.revokeObjectURL(url);
  };


  // Dummy data
   const logins = [
  {
    slNo: 1,
    code: "Test Hotel",
    name: "jumeirah",
    checkIn: "14/10/2023",
    checkOut: "20/10/2023"
  },
  {
    slNo: 1,
    code: "Test Hotel",
    name: "direct hotel",
    checkIn: "14/10/2023",
    checkOut: "20/10/2023"
  },
  {
   slNo: 1,
    code: "Test Hotel",
    name: "globo client",
    checkIn: "14/10/2023",
    checkOut: "20/10/2023"},
  {
   slNo: 1,
    code: "Test Hotel",
    name: "07/12/2023",
    checkIn: "14/10/2023",
    checkOut: "20/10/2023"
  }
];

const filteredlogins = logins.filter(l=>{
  const search = searchQuery.toLowerCase();
  return(
    String(l.code).toLowerCase().includes(search)||
    String(l.name).toLowerCase().includes(search)||
    String(l.checkIn).toLowerCase().includes(search)||
    String(l.checkOut).toLowerCase().includes(search)
  )})

  const totalPages = Math.ceil(filteredlogins.length / itemsPerPage);
  const startIndex =(currentPage -1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentLogins = filteredlogins.slice(startIndex,endIndex);

  return (
    <div className="bg-light d-flex flex-column" style={{ minHeight: "100vh" }}>
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />

        <main className="flex-grow-1 p-4" style={{ overflow: "auto" }}>
          <Card className="shadow-sm rounded-xl">
            <Card.Header>
              <span className="fw-semibold">User Logins Report</span>
            </Card.Header>

            {/* Filters Section */}
            <div className="p-4 bg-light border-bottom">
              <Row className="align-items-end g-4">
                <Col md={3}>
                  <Form.Group className="mb-0">
                    <Form.Label className="small mb-2">From Date</Form.Label>
                    <Form.Control type="date" size="sm" />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group className="mb-0">
                    <Form.Label className="small mb-2">To Date</Form.Label>
                    <Form.Control type="date" size="sm" />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group className="mb-0">
                    <Form.Label className="small mb-2">Login Type</Form.Label>
                    <Form.Select size="sm">
                      <option>Select</option>
                      <option>Inhouse</option>
                      <option>Intranet</option>
                      <option>Extranet</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group className="mb-0">
                    <Form.Label className="small mb-2">User</Form.Label>
                    <Form.Select size="sm">
                      <option>Select</option>
                      <option>Super Admin</option>
                      <option>Globo Admin</option>
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
                    <th>Code</th>
                    <th>Name</th>
                    <th>Login</th>
                    <th>Logout</th>
                  </tr>
                </thead>
                <tbody>
                  {currentLogins.length > 0 ? (
                    currentLogins.map((l, index) => (
                      <tr key={l.id}>
                        <td>{startIndex + index + 1}</td>
                        <td>{l.code}</td>
                        <td>{l.name}</td>
                        <td>{l.checkIn}</td>
                        <td>{l.checkOut}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="text-center text-muted py-4">
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
                    Showing {filteredlogins.length > 0 ? startIndex + 1 : 0} to {Math.min(endIndex, filteredlogins.length)} of {filteredlogins.length} entries
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
                        pageNum === currentPage -2 ||
                        pageNum === currentPage +2
                      ){
                        return <Pagination.Ellipsis key={pageNum} />;
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
                           </>
                                               )}
                                             </Button></Modal.Footer></Modal>
        </main>
      </div>
    </div>
  );
}
