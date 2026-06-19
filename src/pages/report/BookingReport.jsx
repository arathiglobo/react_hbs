import React,{useState,useEffect, useMemo} from "react";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import { toast } from "react-hot-toast";
import axiosInstance from "../../components/AxiosInstance";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Row,
  Col,
  Card,
  Form,
  Button,
  Table,
  Pagination,
  Modal,
} from "react-bootstrap";
import Country from "../../components/filters/Country";

export default function BookingReport() {

  const [bookings,setBookings] = useState([]);

  // Store country options to map IDs to names/codes
  const [countryOptions, setCountryOptions] = useState([]);

  const [currentPage,setCurrentPage]=useState(1);
  const [itemsPerPage,setItemsPerPage]=useState(10);
  const [searchQuery,setSearchQuery]= useState("");
  const [showMailModal, setShowMailModal] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Temporary filter state (what user sees/edits)
const [tempCountry, setTempCountry] = useState("");
const [tempFromDate, setTempFromDate] = useState("");
const [tempToDate, setTempToDate] = useState("");

// Applied filter states (used for actual filtering)
const [country, setCountry] = useState("");
const [fromDate, setFromDate] = useState("");
const [toDate, setToDate] = useState("");



  useEffect(()=>{
  setCurrentPage(1);
  },[searchQuery]);

  useEffect(()=>{
   const fetchBookings = async ()=>{
    try{
      const response = await axiosInstance.get("/api/report/bookings");
      setBookings(response.data);
    }catch(error){
      console.error("Booking Report fetch error",error)
      toast.error("failed to load booking data")
    }
   };
   fetchBookings();
  },[])

  useEffect(() => {
  const fetchCountryOptions = async () => {
    try {
      const response = await axiosInstance.get("/api/country").catch(() => ({ data: [] }));
      setCountryOptions(Array.isArray(response.data) ? response.data.map(c => ({ id: c.id || c.Id, name: c.name })) : []);
    } catch (error) {
      console.error("Error fetching country options:", error);
    }
  };
  fetchCountryOptions();
}, []);


const handleSearch = () => {
  setCountry(tempCountry);
  setFromDate(tempFromDate);
  setToDate(tempToDate);
  setCurrentPage(1);
};


  const handleSendEmail = async () => {
    // Validate email
    if (!emailAddress || !emailAddress.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    setIsSending(true);
    try {
      // API call to send email
      const response = await axiosInstance.post("/api/reports/send-email", {
        email: emailAddress,
        reportType: "booking",
        filters: {
          // add your filter data here
        },
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
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
    <html>
      <head>
        <title>Booking Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; }
          h1 { text-align: center; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <h1>Booking Report</h1>
        <table>
          <thead>
            <tr>
              <th>S/N</th>
              <th>Booking Code</th>
              <th>Booking Date</th>
              <th>Customer Name</th>
              <th>Done By</th>
              <th>Selling Price</th>
              <th>Net Price</th>
              <th>Profit</th>
              <th>Native Country</th>
            </tr>
          </thead>
          <tbody>
            ${currentBookings.map((b, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${b.bookingCode}</td>
                <td>${b.bookingDate ? b.bookingDate.split('T')[0]:'_'}</td>
                <td>${b.customerName}</td>
                <td>${b.bookingDoneBy}</td>
                <td>${b.sellingPrice}</td>
                <td>${b.netPrice}</td>
                <td>${b.profit}</td>
                <td>${b.nativeCountry}</td>
              </tr>
            `
              )
              .join("")}
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
    doc.text("Booking Report", 20, 20);

    // Add table
    autoTable(doc, {
      head: [
        [
          "S/N",
          "Booking Code",
          "Booking Date",
          "Customer Name",
          "Done By",
          "Selling Price",
          "Net Price",
          "Profit",
          "Native Country",
        ],
      ],
      body:currentBookings.map((b, index) => [
        index + 1,
        b.bookingCode,
        b.bookingDate ? b.bookingDate.split('T')[0] : '_',
        b.customerName,
        b.bookingDoneBy,
        b.sellingPrice,
        b.netPrice,
        b.profit,
        b.nativeCountry,
      ]),
      startY: 30,
    });

    // Download PDF
    doc.save("booking-report.pdf");
  };

  const handleExcel = () => {
    const headers = [
      "S/N",
      "Booking Code",
      "Booking Date",
      "Customer Name",
      "Done By",
      "Selling Price",
      "Net Price",
      "Profit",
      "Native Country",
    ];

    // Create CSV content with proper escaping
    const escapeCSV = (value) => {
      if (value === null || value === undefined) return "";
      const stringValue = String(value);
      // If value contains comma, newline, or quote, wrap it in quotes and escape quotes
      if (
        stringValue.includes(",") ||
        stringValue.includes("\n") ||
        stringValue.includes('"')
      ) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    const csvContent = [
      headers.map(escapeCSV).join(","),
      ...currentBookings.map((b, index) =>
        [
          index + 1,
          b.bookingCode,
           b.bookingDate ? b.bookingDate.split('T')[0] : '_',
          b.customerName,
          b.bookingDoneBy,
          b.sellingPrice,
          b.netPrice,
          b.profit,
          b.nativeCountry,
        ]
          .map(escapeCSV)
          .join(",")
      ),
    ].join("\n");

    // Add BOM for UTF-8 to ensure proper Excel encoding
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "booking-report.csv";
    link.click();
    window.URL.revokeObjectURL(url);
  };

 
 
 const filteredbookings = useMemo(() => {
  return bookings.filter(b => {

    if (searchQuery && searchQuery.trim()) {
      const search = searchQuery.trim().toLowerCase();

      const matchesSearch =
        String(b.bookingCode || '').toLowerCase().includes(search) ||
        String(b.bookingDate || '').toLowerCase().includes(search) ||
        String(b.customerName || '').toLowerCase().includes(search) ||
        String(b.bookingDoneBy || '').toLowerCase().includes(search) ||
        String(b.sellingPrice || '').toLowerCase().includes(search) ||
        String(b.netPrice || '').toLowerCase().includes(search) ||
        String(b.profit || '').toLowerCase().includes(search) ||
        String(b.nativeCountry || '').toLowerCase().includes(search);

      if (!matchesSearch) return false;
    }

    if (country) {
      let matches = false;

      const selectedCountryOption = countryOptions.find(
        opt => String(opt.id) === String(country)
      );
      const selectedCountryName = selectedCountryOption?.name;

      if (selectedCountryName) {
        const bookingCountryCode = String(b.nativeCountry || '').trim();
        const selectedCode = String(selectedCountryName || '').trim();

        // Match country code (e.g. IN, US)
        matches = bookingCountryCode === selectedCode;
      }

      // Fallback: match using countryId
      if (!matches && b.countryId && String(b.countryId) === String(country)) {
        matches = true;
      }

      if (!matches) return false;
    }
    if (fromDate || toDate) {
      const bookingDateStr = b.bookingDate
        ? b.bookingDate.split("T")[0]
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
}, [bookings, searchQuery, country, fromDate, toDate, countryOptions]);


const totalPages = useMemo(() => Math.ceil(filteredbookings.length / itemsPerPage), [filteredbookings.length, itemsPerPage]);
const startIndex = useMemo(() => (currentPage - 1) * itemsPerPage, [currentPage, itemsPerPage]);
const endIndex = useMemo(() => startIndex + itemsPerPage, [startIndex, itemsPerPage]);
const currentBookings = useMemo(() => filteredbookings.slice(startIndex, endIndex), [filteredbookings, startIndex, endIndex]);
  
  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Card className="shadow-sm rounded-xl">
            <Card.Header>
              <span className="fw-medium"> Booking Report</span>
            </Card.Header>

            {/* Filters Section */}
            <div className="p-4 bg-light border-bottom">
              <Row className="align-items-end g-4">
              


               
                <Col md={3}>
                  <Form.Group className="mb-0">
                    <Form.Label className="small mb-2">From Date</Form.Label>
                    <Form.Control type="date" size="sm"
                    value={tempFromDate}  
                    onChange={(e)=>setTempFromDate(e.target.value)} />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group className="mb-0">
                    <Form.Label className="small mb-2">To Date</Form.Label>
                    <Form.Control type="date" size="sm" 
                    value={tempToDate}
                    onChange={(e)=>setTempToDate(e.target.value)}/>
                  </Form.Group>
                </Col>


                <Col md={3}>
                 <Country
                 value={tempCountry}
                 onChange={setTempCountry}
                 />
                </Col>
                <Col md={3}>
                  <Button variant="success" className="w-100" size="sm" style={{ backgroundColor: "#676767", borderColor: "#676767" }} onClick={handleSearch}>
                    <i className="fas fa-search me-1"></i>Search
                  </Button>
                </Col>

                <Col md={12} className="mb-0">
  <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">

    {/* LEFT SIDE - SEARCH */}
    <div>
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search here"
        className="form-control form-control-sm"
        style={{ width: "200px" }}
      />
    </div>

    {/* RIGHT SIDE - BUTTONS */}
    <div className="d-flex gap-2">
      <Button
        variant="outline-primary"
        size="sm"
        onClick={() => setShowMailModal(true)}
      >
        <i className="fas fa-envelope me-1"></i>Mail
      </Button>

      <Button
        variant="outline-secondary"
        size="sm"
        onClick={handlePrint}
      >
        <i className="fas fa-print me-1"></i>Print
      </Button>

      <Button
        variant="outline-danger"
        size="sm"
        onClick={handlePDF}
      >
        <i className="fas fa-file-pdf me-1"></i>PDF
      </Button>

      <Button
        variant="outline-success"
        size="sm"
        onClick={handleExcel}
      >
        <i className="fas fa-file-excel me-1"></i>Excel
      </Button>
    </div>

  </div>
</Col>
               
              </Row>
            </div>

            <Card.Body className="p-0 mt-1">
              <Table responsive hover striped className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th style={{ width: 100 }}>S/N</th>
                    <th>Booking Code</th>
                    <th>Booking Date</th>
                    <th>Customer Name</th>
                    <th>Done By</th>
                    <th>Selling Price</th>
                    <th>Net Price</th>
                    <th>Profit</th>
                    <th>Native Country</th>
                  </tr>
                </thead>
                <tbody>
                  {currentBookings.map((b, index) => (
                    <tr key={b.id}>
                      <td>{startIndex+index + 1}</td>
                      <td>{b.bookingCode}</td>
                     <td>{b.bookingDate ? b.bookingDate.split('T')[0]:'_'}</td>
                      <td>{b.customerName}</td>
                      <td>{b.bookingDoneBy}</td>
                      <td>{b.sellingPrice}</td>
                      <td>{b.netPrice}</td>
                      <td>{b.profit}</td>
                      <td>{b.nativeCountry}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              {/* Pagination */}
              <div className="d-flex justify-content-between align-items-center p-3 border-top">
                <div>
                  <small className="text-muted">
                    {/* Showing 1 to {bookings.length} of 708 entries */}
Showing {filteredbookings.length>0 ? startIndex +1:0} to {Math.min(endIndex, filteredbookings.length)} of {filteredbookings.length} entries
                  </small>
                </div>
                <div>
                  <Pagination className="mb-0">
                    <Pagination.Prev onClick={()=> setCurrentPage(prev => Math.max(1, prev -1))}
                      disabled={currentPage === 1}/>
                    {Array.from({length:totalPages},(_,i)=>i+1).map((pageNum)=>{
                      if(
                        pageNum ===1||
                        pageNum ===totalPages||
                        (pageNum >= currentPage -1&&pageNum<=currentPage+1)
                      ){
                        return(
                               <Pagination.Item
                               key={pageNum}
                               active={pageNum===currentPage}
                               onClick={()=>setCurrentPage(pageNum)} >
                                {pageNum}
                                </Pagination.Item>
                        )
                      }else if(
                          pageNum === currentPage -2 ||
                          pageNum === currentPage +2 
                      )
                      {
                        return <Pagination.Ellipsis key={pageNum} />;
                      }
                      return null;
                    })}
                    
                    <Pagination.Next onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages || totalPages === 0}/>

                  </Pagination>
                  </div>
              </div>
            </Card.Body>
          </Card>

          <Modal
            show={showMailModal}
            onHide={() => setShowMailModal(false)}
            centered
          >
            <Modal.Header closeButton={!isSending}>
              <Modal.Title>Send Report via Email</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form>
                <Form.Group className="mb-3">
                  <Form.Label>
                    Email Address <span className="text-danger">*</span>
                  </Form.Label>
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
              <Button
                variant="secondary"
                onClick={() => setShowMailModal(false)}
                disabled={isSending}
              >
                Cancel
              </Button>
              <Button
                variant="success"
                onClick={handleSendEmail}
                disabled={isSending || !emailAddress}
              >
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
