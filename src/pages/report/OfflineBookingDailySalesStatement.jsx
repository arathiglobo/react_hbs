import React, { useEffect, useState,useMemo } from "react";
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
import Agent from "../../components/filters/Agent";
import Staff from "../../components/filters/Staff";
import axiosInstance from "../../components/AxiosInstance";
import Supplier from "../../components/filters/Supplier";

export default function OfflineBookingDailySalesStatement() {
 
  const [agentsList,setAgentList] = useState([]);
  const [employeesList,setEmployeesList]=useState([]);
  const [searchQuery,setSearchQuery]=useState("");
  const [currentPage,setCurrentPage]=useState(1);
  const [itemsPerPage,setItemsPerPage]=useState(10);

  const [tempSupplier,setTempSupplier]=useState("");
  const [tempStaff,setTempStaff] =useState("");
  const [tempAgent,setTempAgent] = useState("");
  const [tempFromDate,setTempFromDate]=useState("");
  const [tempToDate,setTempToDate]=useState("");

  const [supplier,setSupplier]=useState("");
  const [staff,setStaff]=useState("");
  const [agent,setAgent] = useState("");
  const [fromDate,setFromDate]=useState("");
  const [toDate,setToDate]=useState("");

  const activeRole = (localStorage.getItem("currentActiveRole") || "").trim().toUpperCase();
  const storedRoles = (localStorage.getItem("userRole") || "").toUpperCase();
  const isAgentRole = activeRole ? activeRole === "AGENT" : (storedRoles.includes("AGENT") && !storedRoles.includes("ADMIN"));


  useEffect(()=>{
    const fetchAgents = async ()=>{
      try{
        const response = await axiosInstance.get("/api/agents")
        setAgentList(response.data ||[])
      }catch(error){
        console.error("error while fetchin",error)
      }
    };fetchAgents();
  },[])

  useEffect(()=>{
    const fetchEmployees = async ()=>{
      try{
        const response = await axiosInstance.get("/api/employee")
        setEmployeesList(response.data || [])
      }catch(error){
        console.error("error while fetching",error)
      }
    }; fetchEmployees();
  },[])

  const handleSearch = () =>{
  setAgent(tempAgent);
  setStaff(tempStaff);
  setSupplier(tempSupplier);
  setFromDate(tempFromDate);
  setToDate(tempToDate);
  setCurrentPage(1);
}

 const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Offline Booking Daily Sales Statement</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            h1 { text-align: center; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <h1>Offline Booking Daily Sales Statement</h1>
          <table>
            <thead>
              <tr>
                <th>Sl.No</th>
                <th>Date</th>
                <th>Invoice No</th>
                <th>Supplier</th>
                <th>Agent</th>
                <th>Booking By</th>
                <th>Reference</th>
                <th>Details</th>
                 <th>Selling Price</th>
                 <th>Net Price</th>
                  <th>Profit</th>
              </tr>
            </thead>
            <tbody>
              ${filteredsales.map((s, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${s.date}</td>
                  <td>${s.invoiceNumber}</td>
                  <td>${s.supplier}</td>
                  <td>${s.agent}</td>
                  <td>${s.bookingBy}</td>
                  <td>${s.reference}</td>
                  <td>${s.details}</td>
                   <td>${s.sellingPrice}</td>
                   <td>${s.netPrice}</td>
                   <td>${s.profit}</td>
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

    const handleExcel = () => {
    const headers = ['Sl.No', 'Date', 'Invoice No', 'Supplier', 'Agent', 'Booking By','Reference','Details','Selling Price','Net Profit','Profit'];
    
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
      ...filteredsales.map((s, index) => [
        index + 1,
        s.date,
        s.invoiceNumber,
        s.supplier,
        s.bookingBy,
        s.reference,
        s.details,
        s.sellingPrice,
        s.netPrice,
        s.profit
      ].map(escapeCSV).join(','))
    ].join('\n');

    // Add BOM for UTF-8 to ensure proper Excel encoding
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Offline Booking Daily Sales Statement.csv';
    link.click();
    window.URL.revokeObjectURL(url);
  };


  // Dummy data
  const sales = [
    {
      id: 1,
      date: "2025-06-12",
      invoiceNumber: "INV-CNF-0106",
      supplier: "Connect World Tours",
      agent: "Direct Client",
      bookingBy: "Rajesh Mathew",
      reference: "RM-CNF-1002",
      details: `SupplierType Name: TEST HOTEL (ONLY FOR TESTING)
Customer Name: TEST TEST
Check-In: 2025-06-17
Check-Out: 2025-06-21
Total Pax: 2 adult(s) and child(ren)`,
      sellingPrice: "1600.0",
      netPrice: "1200.0",
      profit: "400.0",
    },
    {
      id: 2,
      date: "2024-12-11",
      invoiceNumber: "INV-CNF-0105",
      supplier: "Connect World Tours",
      agent: "Direct Client",
      bookingBy: "Twinkle Pahwa",
      reference: "TPCNF0105",
      details: `SupplierType Name: One and Only Royal Mirage
Customer Name: Mr. Musa Sabir`,
      sellingPrice: "68612.0",
      netPrice: "65856.0",
      profit: "756.0",
    },
    {
      id: 1,
      date: "2025-06-12",
      invoiceNumber: "INV-CNF-0106",
      supplier: "Connect World Tours",
      agent: "Direct Client",
      bookingBy: "Rajesh Mathew",
      reference: "RM-CNF-1002",
      details: `SupplierType Name: TEST HOTEL (ONLY FOR TESTING)
Customer Name: TEST TEST
Check-In: 2025-06-17
Check-Out: 2025-06-21
Total Pax: 2 adult(s) and child(ren)`,
      sellingPrice: "1600.0",
      netPrice: "1200.0",
      profit: "400.0",
    },
    {
      id: 1,
      date: "2025-06-12",
      invoiceNumber: "INV-CNF-0106",
      supplier: "Connect World Tours",
      agent: "Direct Client",
      bookingBy: "Rajesh Mathew",
      reference: "RM-CNF-1002",
      details: `SupplierType Name: TEST HOTEL (ONLY FOR TESTING)
Customer Name: TEST TEST
Check-In: 2025-06-17
Check-Out: 2025-06-21
Total Pax: 2 adult(s) and child(ren)`,
      sellingPrice: "1600.0",
      netPrice: "1200.0",
      profit: "400.0",
    }
  ];

  // const filteredsales = sales.filter(s=>{
  //   const search = searchQuery.toLowerCase();
  //   return(
  //     String(s.date).toLowerCase().includes(search)||
  //     String(s.invoiceNumber).toLowerCase().includes(search)||
  //     String(s.supplier).toLowerCase().includes(search)||
  //     String(s.agent).toLowerCase().includes(search)||
  //     String(s.bookingBy).toLowerCase().includes(search)||
  //     String(s.reference).toLowerCase().includes(search)||
  //     String(s.details).toLowerCase().includes(search)||
  //     String(s.sellingPrice).toLowerCase().includes(search)||
  //     String(s.netPrice).toLowerCase().includes(search)||
  //     String(s.profit).toLowerCase().includes(search)
  //   )
  //  })

  const filteredsales = useMemo(()=>{
    return sales.filter(s=>{
      if(searchQuery && searchQuery.trim()){
        const search = searchQuery.trim().toLowerCase();
        const matchesSearch =
      String(s.date).toLowerCase().includes(search)||
      String(s.invoiceNumber).toLowerCase().includes(search)||
      String(s.supplier).toLowerCase().includes(search)||
      String(s.agent).toLowerCase().includes(search)||
      String(s.bookingBy).toLowerCase().includes(search)||
      String(s.reference).toLowerCase().includes(search)||
      String(s.details).toLowerCase().includes(search)||
      String(s.sellingPrice).toLowerCase().includes(search)||
      String(s.netPrice).toLowerCase().includes(search)||
      String(s.profit).toLowerCase().includes(search)
      if(!matchesSearch) return false;
      }

      //SUPPLIER
      if(supplier && supplier.trim()){
        const selectedSupplier = String(supplier).trim();
        const reportSupplier = String(supplier || '').trim();
        if(selectedSupplier.toLowerCase() !== reportSupplier.toLowerCase()){
          return false;
        }
      }
      //agent
      if(agent){
        let matches = false;
        if(agent.agentId && String(agent.agentId)===String(agent)){
          matches = true;
        }else{
           const selectedAgentOption = agentsList.find(opt =>
            String(opt.id || opt.agentId) === String(agent)
           )
           if(selectedAgentOption){
            const selectedAgentName= String(selectedAgentOption.companyName || '').trim();
            const reportAgentName = String(agent.agent || '').trim();
            matches = selectedAgentName.toLowerCase()=== reportAgentName.toLowerCase()||
            reportAgentName.toLowerCase().includes(selectedAgentName.toLowerCase())
           }
        }
        if(!matches) return false;
      }

      if(Staff){
        let matches = false;
        if(s.employeeId && String(s.employeeId)===String(staff)){
          matches = true;
        }else if(s.staffId && String(s.staffId)===String(staff)){
          matches = true;
        }else{
          const selectedEmployeeOption = employeesList.find(opt =>
           String(opt.employeeId) === String(staff)
          );
          if(selectedEmployeeOption){
            const employeeFullName = `${selectedEmployeeOption.firstName || ''} ${selectedEmployeeOption.lastname || ''}`.trim();
            const reportBookingBy = String(s.bookingBy || '').trim();

            matches = employeeFullName.toLowerCase().includes(employeeFullName.toLowerCase())||
                      reportBookingBy.toLowerCase().includes(employeeFullName.toLowerCase())||
                      employeeFullName.toLowerCase().includes(reportBookingBy.toLowerCase())
          }
        }
        if(!matches) return false;
      }
        if(fromDate || toDate){
          const bookingDateStr = s.bookDate
          ? s.bookDate.split("T")[0]
          :"";
          if(fromDate && bookingDateStr <fromDate){
            return false;
          }
          if(toDate && bookingDateStr > toDate){
            return false;
          }
        }
        return true;
    })
  },[sales,searchQuery,fromDate,supplier,toDate,agent,staff,agentsList,employeesList])

         
    const totalPages = useMemo(() => Math.ceil(filteredsales.length / itemsPerPage), [filteredsales.length,itemsPerPage]);
    const startIndex = useMemo(() => (currentPage -1)* itemsPerPage, [currentPage, itemsPerPage]);
    const endIndex = useMemo(() => startIndex + itemsPerPage, [startIndex, itemsPerPage]);
    const currentLogin = useMemo(() => filteredsales.slice(startIndex,endIndex), [filteredsales, startIndex,endIndex]);

  return (
    <div className="bg-light d-flex flex-column" style={{ minHeight: "100vh" }}>
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />

        <main className="flex-grow-1 p-4" style={{ overflow: "auto" }}>
          <Card className="shadow-sm rounded-xl">
            <Card.Header>
              <span className="fw-semibold">Offline Daily Sales Statement Report</span>
            </Card.Header>

            {/* Filters Section */}
            <div className="p-4 bg-light border-bottom">
              <Row className="align-items-end g-4">
                <Col md={2}>
                  <Form.Group className="mb-0">
                    <Form.Label className="small mb-2">From Date</Form.Label>
                    <Form.Control type="date" size="sm" 
                    value={tempFromDate}
                    onChange={(e)=>setTempFromDate(e.target.value)} />
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
                <Col md={2}>
                  <Form.Group className="mb-0">
                    <Form.Label className="small mb-2">Supplier</Form.Label>
                    <Form.Select size="sm"
                    value={tempSupplier}
                    onChange={setTempSupplier}>
                      <option>Select</option>
                      <option>Darina Holidays</option>
                      <option>Connect World Tours</option>
                    </Form.Select>
                  </Form.Group>
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
            </div>

            {/* Table Section */}
            <Card.Body className="p-0 mt-1">
              {/* Display and Search Row */}
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
                  <Col md="auto">
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

              <Table responsive hover striped className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th style={{ width: 100 }}>S/N</th>
                    <th>Date</th>
                    <th>Invoice Number</th>
                    <th>Supplier Name</th>
                    <th>Agent Name</th>
                    <th>Booking Done By</th>
                    <th>Reference Number</th>
                    <th>Booking Details</th>
                    <th>Selling Price</th>
                    <th>Net Price</th>
                    <th>Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {currentLogin.length > 0 ? (
                    currentLogin.map((s, index) => (
                      <tr key={s.id}>
                        <td>{startIndex + index + 1}</td>
                        <td>{s.date}</td>
                        <td>{s.invoiceNumber}</td>
                        <td>{s.supplier}</td>
                        <td>{s.agent}</td>
                        <td>{s.bookingBy}</td>
                        <td>{s.reference}</td>
                        <td style={{ whiteSpace: "pre-line" }}>{s.details}</td>
                        <td>{s.sellingPrice}</td>
                        <td>{s.netPrice}</td>
                        <td>{s.profit}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="11" className="text-center text-muted py-4">
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
                    Showing {filteredsales.length > 0 ? startIndex + 1 : 0} to {Math.min(endIndex, filteredsales.length)} of {filteredsales.length} entries
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

                    <Pagination.Next onClick={() => setCurrentPage(prev=>Math.min(totalPages,prev+1))}
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
