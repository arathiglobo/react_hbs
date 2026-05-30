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
import { toast } from "react-hot-toast";
import Supplier from "../../components/filters/Supplier";

export default function OnlineDailySalesReport() {

 const [onlineDaily,setOnlineDaily]=useState([]);
 const [ agentList, setAgentList] = useState([]);
 const [employeeList,setEmployeesList]=useState([]);
 const [suppliers, setSuppliers] = useState([]);
 const [searchQuery,setSearchQuery]=useState("");
 const [currentPage,setCurrentPage]=useState(1);
 const [itemsPerPage,setItemsPerPage]=useState(10);

 const [tempAgent,setTempAgent] = useState("");
 const [tempStaff,setTempStaff] = useState("");
 const [tempSupplier,setTempSupplier]=useState("");
 const [tempFromDate,setTempFromDate]=useState("");
 const [tempToDate,setTempToDate] =useState("");
 
 const [agent,setAgent] = useState("");
 const [staff,setStaff] = useState("");
 const [supplier,setSupplier]=useState("");
 const [fromDate,setFromDate]=useState("");
 const [toDate,setToDate]=useState("");

 const activeRole = (localStorage.getItem("currentActiveRole") || "").trim().toUpperCase();
 const storedRoles = (localStorage.getItem("userRole") || "").toUpperCase();
 const isAgentRole = activeRole ? activeRole === "AGENT" : (storedRoles.includes("AGENT") && !storedRoles.includes("ADMIN"));


 useEffect(()=>{
  const fetchdata = async()=>{
    try{
      // Initial load - can be empty or with default values
      const response = await axiosInstance.get("/api/reports/onlineSales")
      setOnlineDaily(response.data||[])
    }catch(error){
      console.error("error while fetching data",error)
    }
  };fetchdata();
 },[])

 useEffect(()=>{
  const fetchAgents = async ()=>{
    try{
          const response = await axiosInstance.get("/api/agent")
          setAgentList(response.data || []);
    }catch(error){
       console.error("error while fetching data",error)
    }
  };fetchAgents();
 },[])

 useEffect(()=>{
  const fetchEmployees = async ()=>{
    try{
      const response = await axiosInstance.get("/api/employee")
      setEmployeesList(response.data || [])
    }catch(error){
        console.error("error while fetching data",error)
    }
  };fetchEmployees();
 },[])

 useEffect(()=>{
  const fetchSuppliers = async ()=>{
    try{
      const response = await axiosInstance.get("/api/external-apis/list")
      setSuppliers(response.data || [])
    }catch(error){
        console.error("error while fetching suppliers",error)
    }
  };fetchSuppliers();
 },[])


 useEffect(()=>{
  setCurrentPage(1);
 },[searchQuery])


const handleSearch = async () =>{
  // Validate dates
  if (!tempFromDate || !tempToDate) {
    toast.error("Please select both From Date and To Date");
    return;
  }

  // Update states first
  setAgent(tempAgent);
  setStaff(tempStaff);
  setSupplier(tempSupplier);
  setFromDate(tempFromDate);
  setToDate(tempToDate);
  setCurrentPage(1);

  // Build API query parameters according to API format
  const params = new URLSearchParams();
  params.append('fromDate', tempFromDate);
  params.append('toDate', tempToDate);
  if (tempAgent) params.append('agentId', tempAgent);
  if (tempStaff) params.append('employeeId', tempStaff);
  if (tempSupplier) {
    params.append('supplierId', tempSupplier);
  } else {
    params.append('supplierId', '0'); // Default to 0 if not selected
  }

  try {
    const queryString = params.toString();
    const url = `/api/reports/onlineSales?${queryString}`;
    console.log("Fetching from URL:", url);
    const response = await axiosInstance.get(url);
    setOnlineDaily(response.data || []);
    toast.success(`Found ${response.data?.length || 0} record(s)`);
  } catch (error) {
    console.error("error while fetching data", error);
    toast.error("Failed to fetch data");
    setOnlineDaily([]);
  }
}


  const handlePrint =()=>{
   const printWindow = window.open("","_blank");
   printWindow.document.write(`
    <html>
    <head>
    <title>Online Daily Sales Report</title>
    <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            h1 { text-align: center; margin-bottom: 20px; }
          </style>
    </head>
    <body>
    <h1>Online Daily Sales Report</h1>
    <table>
    <thead>
    <tr>
    <th>SI.No</th>
    <th>Agent Name</th>
    <th>Supplier Name</th>
    <th>Customer Name</th>
    <th>Booking Code</th>
    <th>Booking Done By</th>
    <th>Book Date</th>
    <th>Native Country</th>
    <th>Selling Price</th>
    <th>Net Price</th>
    <th>Profit</th>
     </tr>
    </thead>
    <tbody>
    ${currentfilter.map((r,index)=>`
      <tr>
      <td>${index+1}</td>
      <td>${r.agentName || 'N/A'}</td>
      <td>${r.supplierName || 'N/A'}</td>
      <td>${r.customerName || 'N/A'}</td>
      <td>${r.bookingCode || 'N/A'}</td>
      <td>${r.bookingDoneBy || 'N/A'}</td>
      <td>${r.bookingDate ? r.bookingDate.split("T")[0] : 'N/A'}</td>
      <td>${r.nativeCountry || 'N/A'}</td>
      <td>${r.sellingPrice || '0.00'}</td>
      <td>${r.netPrice || '0.00'}</td>
      <td>${r.profit || '0.00'}</td>
      </tr>
      `).join('')}
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
    'SI.No', 'Agent Name', 'Supplier Name', 'Customer Name', 'Booking Code',
    'Booking Done By', 'Book Date', 'Native Country', 'Selling Price', 'Net Price', 'Profit'
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
    ...currentfilter.map((r, index) => [
      index + 1,
      r.agentName || 'N/A',
      r.supplierName || 'N/A',
      r.customerName || 'N/A',
      r.bookingCode || 'N/A',
      r.bookingDoneBy || 'N/A',
      r.bookingDate ? r.bookingDate.split("T")[0] : 'N/A',
      r.nativeCountry || 'N/A',
      r.sellingPrice || '0.00',
      r.netPrice || '0.00',
      r.profit || '0.00'
    ].map(escapeCSV).join(','))
  ].join('\n');

  
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'Online Daily Sales Report.csv';
  link.click();
  window.URL.revokeObjectURL(url);
};


const filteredreports = useMemo(()=>{
   return onlineDaily.filter(a=>{
if (searchQuery && searchQuery.trim()){
        const search = searchQuery.trim().toLowerCase();
        const matchesSearch = 
         String(a.agentName || '').toLowerCase().includes(search)||
        String(a.supplierName || '').toLowerCase().includes(search)||
        String(a.customerName || '').toLowerCase().includes(search)||
        String(a.bookingCode || '').toLowerCase().includes(search)||
        String(a.bookingDoneBy || '').toLowerCase().includes(search)||
        String(a.bookingDate || '').toLowerCase().includes(search)||
        String(a.sellingPrice || '').toLowerCase().includes(search)||
        String(a.netPrice || '').toLowerCase().includes(search)||
        String(a.profit || '').toLowerCase().includes(search)
 if(!matchesSearch) return false;
      }

      //supplier - client-side filter
// if(supplier && supplier.trim()){
//         const selectedSupplier = String(supplier).trim();
//         const reportSupplier = String(a.supplierName || '').trim();
//         if(selectedSupplier.toLowerCase() !== reportSupplier.toLowerCase()){
//           return false;
//         }
//       }

      //supplier - client-side filter (FIXED VERSION)
if (supplier){
  let matches = false;
  // Find supplier by ID from suppliers list
  const selectedSupplierOption = suppliers.find(opt =>
    String(opt.id) === String(supplier)
  );
  
  if(selectedSupplierOption){
    // Get the supplier name/code (apiCode is what's shown in Supplier component)
    const selectedSupplierName = String(selectedSupplierOption.apiCode || selectedSupplierOption.name || '').trim().toLowerCase();
    const reportSupplierName = String(a.supplierName || '').trim().toLowerCase();
    // Compare names (exact match or contains)
    matches = selectedSupplierName === reportSupplierName ||
              reportSupplierName.includes(selectedSupplierName);
  }
  
  if(!matches) return false;
}

  //agent - match by agentName (client-side filter, but API already filters by agentId)
  if(agent){
    let matches = false;
    const selectedAgentOption = agentList.find(opt=>
          String(opt.id || opt.agentId) === String(agent)
      )
      if(selectedAgentOption){
      const selectedAgentName = String(selectedAgentOption.companyName || selectedAgentOption.agentName || '').trim();
      const reportAgentName = String(a.agentName || '').trim();
      matches= selectedAgentName.toLowerCase() === reportAgentName.toLowerCase() ||
      reportAgentName.toLowerCase().includes(selectedAgentName.toLowerCase()) 
      }
    if(!matches) return false;
  }

  //staff - match by bookingDoneBy (employeeId)
  if(staff){
    let matches = false;
    // bookingDoneBy is the employeeId in the API response
    if(String(a.bookingDoneBy || '') === String(staff)){
      matches = true;
    }
    if(!matches) return false;
  }

  // Date filtering
  if(fromDate || toDate){
    const bookingDateStr = a.bookingDate
     ? a.bookingDate.split("T")[0]
     : "";
      if (fromDate && bookingDateStr < fromDate) {
         return false;
       }
        if (toDate && bookingDateStr > toDate) {
         return false;
       }}
  return true;
})
},[ onlineDaily, searchQuery, fromDate, supplier, toDate, agent, staff, agentList, employeeList,suppliers])

   const totalPages = useMemo(()=> Math.ceil(filteredreports.length / itemsPerPage),[filteredreports.length,itemsPerPage]);
   const startIndex = useMemo(()=>(currentPage -1)* itemsPerPage, [currentPage,itemsPerPage]);
   const endIndex = useMemo(() => startIndex +itemsPerPage, [startIndex,itemsPerPage]);
   const currentfilter = useMemo(()=> filteredreports.slice(startIndex,endIndex),[filteredreports,startIndex,endIndex])
 
   return (
    <div className="bg-light d-flex flex-column" style={{ minHeight: "100vh" }}>
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />

        <main className="flex-grow-1 p-4" style={{ overflow: "auto" }}>
          <Card className="shadow-sm rounded-xl">
            <Card.Header>
              <span className="fw-semibold">Online Daily Sales Report</span>
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
                   onChange={setTempSupplier}
                  />
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
                  <Button variant="success" size="sm" onClick={handleSearch}>
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
                    <th>Agent Name</th>
                    <th>Supplier Name</th>
                    <th>Customer Name</th>
                    <th>Booking Code</th>
                    <th>Booking Done By</th>
                    <th>Book Date</th>
                    <th>Native Country</th>
                    <th>Selling Price</th>
                    <th>Net Price</th>
                    <th>Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {currentfilter.length > 0 ? (
                    currentfilter.map((r, index) => (
                      <tr key={r.bookingId || index}>
                        <td>{startIndex + index + 1}</td>
                        <td>{r.agentName || 'N/A'}</td>
                        <td>{r.supplierName || 'N/A'}</td>
                        <td>{r.customerName || 'N/A'}</td>
                        <td>{r.bookingCode || 'N/A'}</td>
                        <td>{r.bookingDoneBy || 'N/A'}</td>
                        <td>{r.bookingDate ? r.bookingDate.split("T")[0] : 'N/A'}</td>
                        <td>{r.nativeCountry || 'N/A'}</td>
                        <td>{r.sellingPrice || '0.00'}</td>
                        <td>{r.netPrice || '0.00'}</td>
                        <td>{r.profit || '0.00'}</td>
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
          </main>
      </div>
    </div>
  );
}
