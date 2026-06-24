import React, { useState, useMemo, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import {Row,Col,Card,Form,Button,Table,Pagination,} from "react-bootstrap";
import Agent from "../../components/filters/Agent";
import Staff from "../../components/filters/Staff";
import axiosInstance from "../../components/AxiosInstance";
import Supplier from "../../components/filters/Supplier";

export default function TimeLimitOnlineDailySalesReport() {

  const [agentsList,setAgentList]=useState([]);
  const [employeesList,setEmployeesList]=useState([]);
  const [timeList,setTimeList]=useState([]);
  const [currentPage,setCurrentPage] =useState(1);
  const [itemsPerPage,setItemsPerPage] =useState(10);
  const [searchQuery,setSearchQuery]=useState("");
 
// Temporary filter states (what user sees/edits)
  const [tempSupplier,setTempSupplier]=useState("");
  const [tempStaff,setTempStaff]= useState("");
  const [tempAgent, setTempAgent] = useState("");
  const [tempFromDate,setTempFromDate]=useState("");
  const [tempToDate,setTempToDate]=useState("");

// Applied filter states (used for actual filtering)
  const [supplier,setSupplier]=useState("");
  const [staff,setStaff] = useState("");
  const [agent,setAgent] =useState("");
  const [fromDate,setFromDate]=useState("");
  const [toDate,setToDate]=useState("");

  const activeRole = (localStorage.getItem("currentActiveRole") || "").trim().toUpperCase();
  const storedRoles = (localStorage.getItem("userRole") || "").toUpperCase();
  const isAgentRole = activeRole ? activeRole === "AGENT" : (storedRoles.includes("AGENT") && !storedRoles.includes("ADMIN"));

  useEffect(()=>{
    const fetchAgents = async () =>{
      try{
        const response = await axiosInstance.get("/api/agent")
        setAgentList(response.data || []);
      }catch(error){
          console.error("Error Fetching Data",error)
      }
    };fetchAgents();
  },[])

  useEffect(()=>{
    const fetchEmployees = async () =>{
      try{
        const response = await axiosInstance.get("/api/employee")
        setEmployeesList(response.data || []);
      }catch(error){
          console.error("Error Fetching Employees",error)
      }
    };fetchEmployees();
  },[])

  useEffect(()=>{
    const fetchEmployeeList = async()=>{
      try{
        const response = await axiosInstance.get("/api/reports/timeLimitSales")
        setTimeList(response.data || []);
      }catch(error){
        console.error("error while fetching data",error)
      }
    };fetchEmployeeList();
  },[])

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
             <td>${r.agentName || ''}</td>
             <td>${r.supplierName || ''}</td>
             <td>${r.customerName || ''}</td>
             <td>${r.bookingCode || ''}</td>
             <td>${r.referenceCode || ''}</td>
             <td>${r.bookingDoneBy || ''}</td>
             <td>${r.bookingDate ? r.bookingDate.split('T')[0]:'_'}</td>
             <td>${r.bookingDetails ? (r.bookingDetails.hotelName || r.bookingDetails.hotelname || 'N/A') + ' - ' + (r.bookingDetails.checkInDate || r.bookingDetails.checkIndate || '') + ' to ' + (r.bookingDetails.checkOutDate || r.bookingDetails.checktodate || '') : (r.details || 'N/A')}</td>
             <td>${r.deadlineDate ? r.deadlineDate.split('T')[0]:'_'}</td>
            </tr>
            `
          ).join('')}
          </tbody>
          </table>
          </body>
    </html>
    `);
  printWindow.document.close();
  printWindow.print();
}

const handleExcel = () => {
  const headers = [
    'SI.No', 'Agent', 'Supplier', 'Customer', 'Booking Code',
    'Reference', 'BookingBy', 'BookDate', 'Details', 'Deadline Date'
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
      r.agentName || '',
      r.supplierName || '',
      r.customerName || '',
      r.bookingCode || '',
      r.referenceCode || '',
      r.bookingDoneBy || '',
      r.bookingDate ? r.bookingDate.split('T')[0]:'_',
      r.bookingDetails ? (r.bookingDetails.hotelName || r.bookingDetails.hotelname || 'N/A') + ' - ' + (r.bookingDetails.checkInDate || r.bookingDetails.checkIndate || '') + ' to ' + (r.bookingDetails.checkOutDate || r.bookingDetails.checktodate || '') : (r.details || 'N/A'),
      r.deadlineDate ? r.deadlineDate.split('T')[0]:'_'
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



const handleSearch = () => {
 //  setSearchQuery(searchQuery);
 setAgent(tempAgent);
 setStaff(tempStaff);
 setSupplier(tempSupplier);
 setFromDate(tempFromDate);
 setToDate(tempToDate);
 setCurrentPage(1);
 };


 const filteredreports = useMemo(() => {
   return timeList.filter(a => {
 
     if (searchQuery && searchQuery.trim()) {
       const search = searchQuery.trim().toLowerCase();
 
       const matchesSearch =
       String(a.agentName).toLowerCase().includes(search)||
      String(a.supplierName).toLowerCase().includes(search)||
      String(a.customerName).toLowerCase().includes(search)||
      String(a.bookingCode).toLowerCase().includes(search)||
      String(a.referenceCode).toLowerCase().includes(search)||
      String(a.bookingDoneBy).toLowerCase().includes(search)||
      String(a.bookingDate).toLowerCase().includes(search)||
      String(a.details).toLowerCase().includes(search)||
      String(a.deadlineDate).toLowerCase().includes(search)

      if (!matchesSearch) return false;
    }

// supplier
if(supplier && supplier.trim()){
  const selectedSupplier = String(supplier).trim();
  const reportSupplier = String(a.supplierName || '').trim();
  if(selectedSupplier.toLowerCase() !== reportSupplier.toLowerCase()){
    return false;
  }
}

//agent
if(agent) {
  let matches = false;
if(a.agentId && String (a.agentId) === String(agent)){
    matches = true;
  } else{
    const selectedAgentOption = agentsList.find(opt =>
      String(opt.id ||opt.agentId)=== String(agent)
    );
   if(selectedAgentOption){
    const selectedAgentName = String(selectedAgentOption.companyName || '').trim();
    const reportAgentName   = String(a.agentName || '').trim();
    matches= selectedAgentName.toLowerCase()=== reportAgentName.toLowerCase()||
     reportAgentName.toLowerCase().includes(selectedAgentName.toLowerCase());
   }
  }
if (!matches) return false;
}

//Staff
if(staff) {
  let matches = false;
  
  if (a.employeeId && String(a.employeeId) === String(staff)) {
    matches = true;
  } else if (a.staffId && String(a.staffId) === String(staff)) {
    matches = true;
  } else {
    const selectedEmployeeOption = employeesList.find(opt => 
      String(opt.employeeId) === String(staff)
    );
    
    if (selectedEmployeeOption) {
      const employeeFullName = `${selectedEmployeeOption.firstName || ""} ${selectedEmployeeOption.lastName || ""}`.trim();
      const reportBookingBy = String(a.bookingDoneBy || '').trim();
      
      // Match exact or partial match
      matches = employeeFullName.toLowerCase() === reportBookingBy.toLowerCase() ||
                reportBookingBy.toLowerCase().includes(employeeFullName.toLowerCase()) ||
                employeeFullName.toLowerCase().includes(reportBookingBy.toLowerCase());
    }
  }
  
  if (!matches) return false;
}

   
     if (fromDate || toDate) {
       const bookingDateStr = a.bookingDate
         ? a.bookingDate.split("T")[0]
         : "";
 
       if (fromDate && bookingDateStr < fromDate) {
         return false;
       }
 
       if (toDate && bookingDateStr > toDate) {
         return false;
       }
     }
     return true; // keep booking
   });
 }, [timeList, searchQuery, fromDate, supplier, toDate, agent, staff, agentsList, employeesList]);

  
    const totalPages = useMemo(() => Math.ceil(filteredreports.length / itemsPerPage), [filteredreports.length,itemsPerPage]);
    const startIndex = useMemo(() => (currentPage -1)* itemsPerPage, [currentPage, itemsPerPage]);
    const endIndex = useMemo(() => startIndex + itemsPerPage, [startIndex, itemsPerPage]);
    const currentreports = useMemo(() => filteredreports.slice(startIndex,endIndex), [filteredreports, startIndex,endIndex]);
  

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
                    <Form.Control type="date" size="sm" 
                    value={tempFromDate}
                    onChange={(e)=>setTempFromDate(e.target.value)}/>
                  </Form.Group>
                </Col>
                <Col md={2}>
                  <Form.Group className="mb-0">
                    <Form.Label className="small mb-2">To Date</Form.Label>
                    <Form.Control type="date" size="sm" 
                    value={tempToDate}
                    onChange={(e)=>setTempToDate(e.target.value)}/>
                  </Form.Group>
                </Col>
                <Col md={2}>
                  <Supplier
                    value={tempSupplier}
                    onChange={setTempSupplier}/>
                </Col>
                {!isAgentRole && (
                <Col md={3}>
                  <Agent
                  value={tempAgent}
                  onChange={setTempAgent}/>
                </Col>
                )}
                <Col md={3}>
                 <Staff
                 value={tempStaff}
                 onChange={setTempStaff}/>
                </Col>
                <Col md={12} className="d-flex justify-content-end mt-3">
                  <Button variant="success" size="sm" style={{ backgroundColor: "#676767", borderColor: "#676767" }} onClick={handleSearch}>
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
                        <td>{r.agentName}</td>
                        <td>{r.supplierName}</td>
                        <td>{r.customerName}</td>
                        <td>{r.bookingCode}</td>
                        <td>{r.referenceCode}</td>
                        <td>{r.bookingDoneBy}</td>
                        <td>{r.bookingDate?.split('T')[0]}</td>
                        <td style={{ whiteSpace: "pre-line" }}>
                          {r.bookingDetails ? (
                            <>
                              {r.bookingDetails.hotelName || r.bookingDetails.hotelname || 'N/A'}<br/>
                              {r.bookingDetails.checkInDate || r.bookingDetails.checkIndate || ''} - {r.bookingDetails.checkOutDate || r.bookingDetails.checktodate || ''}
                            </>
                          ) : r.details ? (
                            r.details
                          ) : (
                            'N/A'
                          )}
                        </td>
                        <td>{r.deadlineDate?.split('T')[0]}</td>
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
