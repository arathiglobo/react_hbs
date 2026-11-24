// ✅ ADDED: Additional imports for table, modal, toast, PDF and Excel functionality
import React, { useEffect, useState,useMemo } from "react";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import BackButton from "../../components/BackButton";
import { Row, Col, Card, Form, Button, Dropdown, Table, Modal } from "react-bootstrap";
import { toast } from "react-hot-toast";
import axiosInstance from "../../components/AxiosInstance";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { escapeHtml } from "../../utils/safeHtml";
import { csvCell } from "../../utils/csvSafe";
import { compactFilters, emailSentMessage, emailErrorMessage } from "../../utils/reportEmail";


// Case- and whitespace-insensitive name comparison
const sameName = (a, b) =>
  String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

function Comparison() {
  
  const [comparison,setComparison] = useState([]);
  const [agentsList, setAgentsList] = useState([]);
  const [hotelsList, setHotelsList] = useState([]);
  const [searchQuery,setSearchQuery]=useState("");
  const [selectedOption, setSelectedOption] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [compareOption, setCompareOption] = useState("");
  const [showCompareDropdown, setShowCompareDropdown] = useState(false);
  const [showDateInputs, setShowDateInputs] = useState(false);
  const [selectedAgentHotel, setSelectedAgentHotel] = useState("");
  const [selectedComparePeriod, setSelectedComparePeriod] = useState("");
  const [showCompareValidation, setShowCompareValidation] = useState(false);
   const [showMailModal, setShowMailModal] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [reportType, setReportType] = useState("");
  const [selectedFromDate, setSelectedFromDate] = useState("");
  const [selectedToDate, setSelectedToDate] = useState("");
  const [selectedOtherEntity, setSelectedOtherEntity] = useState("");

  // Fetch agents list
  useEffect(()=>{
    const fetchAgents = async ()=>{
      try{
        const response = await axiosInstance.get("/api/agent")
        setAgentsList(response.data || [])
      }catch(error){
        console.error("Error while fetching agents",error)
      }
    };fetchAgents();
  },[])

  // Fetch hotels list
  useEffect(()=>{
    const fetchHotels = async ()=>{
      try{
        const response = await axiosInstance.get("/api/hotels")
        setHotelsList(response.data || [])
      }catch(error){
        console.error("Error while fetching hotels",error)
      }
    };fetchHotels();
  },[])

  // Agent search -> one row per agent, Hotel search -> one row per hotel.
  // Returns false when the request failed.
  const fetchcomparison = async (type, fromDate = null, toDate = null) => {
    try{
      const params = {};
      if(fromDate && toDate){
        params.fromDate = fromDate;
        params.toDate = toDate;
      }
      const url = type === "agent" ? "/api/reports/agent-summary" : "/api/reports/hotel-summary";
      const response = await axiosInstance.get(url, {params});
      setComparison(Array.isArray(response.data) ? response.data : []);
      return true;
    }catch(error){
      console.error("Error while fetching data",error)
      toast.error("Failed to load comparison data")
      return false;
    }
  }

  // Reset "Compare With" section when switching between Agent and Hotel
 
  useEffect(() => {
    // Clear comparison-related states when selectedOption changes
    setCompareOption("");
    setSelectedOtherEntity("");
    setSelectedFromDate("");
    setSelectedToDate("");
    setShowCompareDropdown(false);
    setShowDateInputs(false);
  }, [selectedOption]);

  // Options for Agent/Hotel dropdown
  const agentOptions = useMemo(() => {
    if (!agentsList || !Array.isArray(agentsList)) return [];
    // Same naming as the report rows: company name, else first + last name
    return [...new Set(agentsList
      .map(agent => String(
        agent.companyName?.trim() || agent.agentName || agent.name ||
        [agent.firstName, agent.lastName].filter(Boolean).join(" ")
      ).trim())
      .filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
  }, [agentsList]);

  const hotelOptions = useMemo(() => {
    if (!hotelsList || !Array.isArray(hotelsList)) return [];
    return [...new Set(hotelsList
      .map(hotel => String(hotel.hotelName || hotel.name || '').trim())
      .filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
  }, [hotelsList]);

  // Extract agent booking data from comparison API response
  const agentData = useMemo(() => {
    if (!comparison || !Array.isArray(comparison)) return [];
    return comparison
      .filter(item => item.agentId || item.agentName || item.agentname)
      .map(item => {
        const agentName = item.agentName || item.agentname || '';
        return {
          slNo: item.slNo || item.id,
          agentname: agentName,
          noofbooking: item.noOfBooking || item.noofbooking || item.noOfBookings || 0,
          cancelledbooking: item.cancelledBooking || item.cancelledbooking || item.cancelledBookings || 0,
          fromDate: item.fromDate || item.checkIn || item.bookingDate || item.date,
          toDate: item.toDate || item.checkOut || item.bookingDate || item.date
        };
      });
  }, [comparison]);

  // Extract hotel booking data from comparison API response
  const hotelData = useMemo(() => {
    if (!comparison || !Array.isArray(comparison)) return [];
    return comparison
      .filter(item => item.hotelId || item.hotelName || item.hotelname)
      .map(item => {
        const hotelName = item.hotelName || item.hotelname || '';
        return {
          slNo: item.slNo || item.id,
          agentname: hotelName,
          noofbooking: item.noOfBooking || item.noofbooking || item.noOfBookings || 0,
          cancelledbooking: item.cancelledBooking || item.cancelledbooking || item.cancelledBookings || 0,
          fromDate: item.fromDate || item.checkIn || item.bookingDate || item.date,
          toDate: item.toDate || item.checkOut || item.bookingDate || item.date
        };
      });
  }, [comparison]);

  // Other entities for comparison (exclude the selected one)
  const otherOptions = useMemo(() => {
    if (selectedOption === "agent") {
      if (!selectedAgentHotel) {
        return agentOptions.filter(opt => opt && opt.trim() !== '');
      }
      const selectedTrimmed = String(selectedAgentHotel).trim().toLowerCase();
      return agentOptions.filter(opt => {
        if (!opt || opt.trim() === '') return false;
        const optTrimmed = String(opt).trim().toLowerCase();
        return optTrimmed !== selectedTrimmed;
      });
    } else if (selectedOption === "hotel") {
      if (!selectedAgentHotel) {
        return hotelOptions.filter(opt => opt && opt.trim() !== '');
      }
      const selectedTrimmed = String(selectedAgentHotel).trim().toLowerCase();
      return hotelOptions.filter(opt => {
        if (!opt || opt.trim() === '') return false;
        const optTrimmed = String(opt).trim().toLowerCase();
        return optTrimmed !== selectedTrimmed;
      });
    }
    return [];
  }, [selectedOption, selectedAgentHotel, agentOptions, hotelOptions]);

  // Rows shown in the table and in Print / PDF / Excel: the selected
  // agent/hotel, then the one it is compared with. The server already applied
  // the date range. A name without bookings still gets a row with zeros.
  const resultRows = useMemo(() => {
    const data = reportType === "agent" ? agentData : hotelData;
    const rowsFor = (name) => {
      const found = data.filter(item => sameName(item.agentname, name));
      return found.length > 0 ? found : [{ agentname: name, noofbooking: 0, cancelledbooking: 0 }];
    };
    if (!selectedAgentHotel) return [];
    const rows = rowsFor(selectedAgentHotel);
    if (compareOption === "other" && selectedOtherEntity) {
      rows.push(...rowsFor(selectedOtherEntity));
    }
    return rows;
  }, [reportType, agentData, hotelData, selectedAgentHotel, compareOption, selectedOtherEntity]);

  const handleSendEmail = async () => {
    if (!emailAddress || !emailAddress.includes('@')) {
      toast.error("Please enter a valid email address");
      return;
    }
  
    setIsSending(true);
    try {
      // The rows on screen: the searched Agent / Hotel summary for the selected
      // name, and either the one compared with or the date range
      const response = await axiosInstance.post('/api/reports/send-email', {
        email: emailAddress.trim(),
        reportType: 'comparison',
        subType: reportType || selectedOption, // 'agent' or 'hotel'
        filters: compactFilters({
          selectedOption,
          selectedAgentHotel,
          compareOption,
          selectedOtherEntity: compareOption === "other" ? selectedOtherEntity : undefined,
          fromDate: compareOption === "date" ? selectedFromDate : undefined,
          toDate: compareOption === "date" ? selectedToDate : undefined,
        }),
      });

      if (response.data) {
        toast.success(emailSentMessage(response.data));
        setShowMailModal(false);
        setEmailAddress("");
      }
    } catch (error) {
      toast.error(emailErrorMessage(error));
    } finally {
      setIsSending(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const allData = resultRows;
  const columns = ['Sl.No', 'Entity Name', 'No Of Booking', 'Cancelled Booking'];
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Comparison Report - ${escapeHtml(reportType === 'agent' ? 'Agent' : 'Hotel')}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            h1 { text-align: center; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <h1>Comparison Report - ${escapeHtml(reportType === 'agent' ? 'Agent' : 'Hotel')}</h1>
          <table>
            <thead>
              <tr>
                ${columns.map(col => `<th>${escapeHtml(col)}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${allData.map((item, index) => (
                `<tr>
                  <td>${index + 1}</td>
                  <td>${escapeHtml(item.agentname)}</td>
                  <td>${escapeHtml(item.noofbooking)}</td>
                  <td>${escapeHtml(item.cancelledbooking)}</td>
                </tr>`
              )).join('')}
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
    const allData = resultRows;
    
    doc.text(`Comparison Report - ${reportType === 'agent' ? 'Agent' : 'Hotel'}`, 20, 20);
    
    autoTable(doc, {
      head: [['Sl.No', 'Entity Name', 'No Of Booking', 'Cancelled Booking']],
      body: allData.map((item, index) => [
        index + 1,
        item.agentname,
        item.noofbooking,
        item.cancelledbooking,
      ]),
      startY: 30,
    });
    
    doc.save(`comparison-${reportType}-report.pdf`);
  };
  
  const handleExcel = () => {
    const allData = resultRows;
    
    const headers = ['Sl.No', 'Entity Name', 'No Of Booking', 'Cancelled Booking'];
    
    // csvCell neutralises text a spreadsheet would run as a formula.
    const escapeCSV = (value) => csvCell(value);
    
    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...allData.map((item, index) => {
        return [
          index + 1, 
          item.agentname,
          item.noofbooking,
          item.cancelledbooking,
        ].map(escapeCSV).join(',');
      })
    ].join('\n');
  
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `comparison-${reportType}-report.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const handleOptionChange = (option) => {
    setSelectedOption(option);
    setShowDropdown(true);
    // Clear selected agent/hotel when switching between Agent and Hotel
    setSelectedAgentHotel("");
    // Also clear related comparison states
    setCompareOption("");
    setSelectedOtherEntity("");
    setSelectedFromDate("");
    setSelectedToDate("");
    setShowCompareDropdown(false);
    setShowDateInputs(false);
    setShowResults(false);
  };

  const handleCompareChange = (option) => {
    setCompareOption(option);
    setShowCompareDropdown(option === "other");
    setShowDateInputs(option === "date");
    setShowCompareValidation(false); 
  };
  

  return (
    <div className="bg-light d-flex flex-column" style={{ minHeight: "100vh" }}>
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />

        <main className="flex-grow-1 p-4" style={{ overflow: "auto" }}>
          <Card className="shadow-sm rounded-xl" style={{ overflow: 'visible' }}>
            <Card.Header className="d-flex align-items-center gap-2">
              <BackButton forceFallback fallback="/adminDashboard" />
              <span className="fw-semibold">Comparison Report</span>
            </Card.Header>

            {/* Filters Section */}
            <div className="p-4 bg-light border-bottom">
              <Form>
                <Row className="align-items-center">
                  <Col md={6}>
                    <Form.Label className="fw-semibold">* Please select:</Form.Label>
                    <div className="d-flex gap-3 mt-2">
                      <Form.Check 
                        type="radio" 
                        label="Agent" 
                        name="selectOption" 
                        onChange={() => handleOptionChange("agent")}
                      />
                      <Form.Check 
                        type="radio" 
                        label="Hotel" 
                        name="selectOption" 
                        onChange={() => handleOptionChange("hotel")}
                      />
                    </div>
                    
                    {showDropdown && (
                      <div className="mt-3 mb-4" style={{ position: 'relative' }}>
                        <Dropdown
                          drop="down"
                          flip={false}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Dropdown.Toggle variant="outline-secondary" size="sm">
                            {selectedAgentHotel
                              ? selectedAgentHotel
                              : `Select ${selectedOption === "agent" ? "Agent" : "Hotel"} Criteria`}
                          </Dropdown.Toggle>

                          <Dropdown.Menu
                            container={document.body}
                            style={{
                              zIndex: 2000,
                              minWidth: "200px",
                              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                              border: "1px solid #dee2e6",
                            }}
                          >
                            {(selectedOption === "agent" ? agentOptions : hotelOptions).map(
                              (option, index) => (
                                <Dropdown.Item
                                  key={index}
                                  onClick={() => setSelectedAgentHotel(option)}
                                >
                                  {option}
                                </Dropdown.Item>
                              )
                            )}
                          </Dropdown.Menu>
                        </Dropdown>
                      </div>
                    )}
                  </Col>
                  
                  <Col md={6}>
                    <Form.Label className="fw-semibold">* Compare With:</Form.Label>
                    <div className="d-flex gap-3 mt-2">
                      <Form.Check 
                        type="radio" 
                        label="Date" 
                        name="compareOption" 
                        checked={compareOption === "date"}
                        onChange={() => handleCompareChange("date")} 
                      />
                      <Form.Check 
                        type="radio" 
                        label="Other" 
                        name="compareOption" 
                        checked={compareOption === "other"}
                        onChange={() => handleCompareChange("other")}
                      />
                    </div>
                    
                    {showCompareDropdown && (
                      <div className="mt-3 mb-4">
                        {!selectedOption ? (
                          <div className="text-muted small">
                            Please select Agent or Hotel first
                          </div>
                        ) : !selectedAgentHotel ? (
                          <div className="text-muted small">
                            Please select a {selectedOption === "agent" ? "agent" : "hotel"} first
                          </div>
                        ) : (
                          <Dropdown
                            drop="down"
                            flip={false}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Dropdown.Toggle variant="outline-secondary" size="sm">
                              {selectedOtherEntity
                                ? selectedOtherEntity
                                : `Select ${selectedOption === "agent" ? "Agent" : "Hotel"} to Compare`}
                            </Dropdown.Toggle>

                            <Dropdown.Menu
                              container={document.body}
                              style={{
                                position: 'fixed !important',
                                zIndex: "9999",
                                minWidth: "200px",
                                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                                border: "1px solid #dee2e6",
                                top: 'auto !important',
                                left: 'auto !important',
                                transform: 'none !important'
                              }}
                            >
                              {(() => {
                                // Everything except the agent/hotel already selected
                                const availableOptions = otherOptions;

                                if (availableOptions.length === 0) {
                                  return (
                                    <Dropdown.Item disabled className="text-muted">
                                      No {selectedOption === "agent" ? "agents" : "hotels"} available
                                    </Dropdown.Item>
                                  );
                                }
                                
                                // Show all options normally
                                return availableOptions.map((option, index) => (
                                  <Dropdown.Item
                                    key={index}
                                    onClick={() => setSelectedOtherEntity(option)}
                                  >
                                    {option}
                                  </Dropdown.Item>
                                ));
                              })()}
                            </Dropdown.Menu>
                          </Dropdown>
                        )}
                      </div>
                    )}

                    {/* Date input fields */}
                    {showDateInputs && (
                      <div className="mt-3">
                        <Row>
                          <Col md={6}>
                            <Form.Label className="small mb-2">From Date</Form.Label>
                            <Form.Control 
                              type="date" 
                              size="sm"
                              value={selectedFromDate}
                              onChange={(e) => setSelectedFromDate(e.target.value)}
                            />
                          </Col>
                          <Col md={6}>
                            <Form.Label className="small mb-2">To Date</Form.Label>
                            <Form.Control 
                              type="date" 
                              size="sm"
                              value={selectedToDate}
                              onChange={(e) => setSelectedToDate(e.target.value)}
                            />
                          </Col>
                        </Row>
                      </div>
                    )}
                    
                    {/* Validation message for Compare With */}
                    {showCompareValidation && !compareOption && (
                      <div className="mt-2">
                        <small className="text-danger"> Choose an option</small>
                      </div>
                    )}
                  </Col>
                </Row>

                {/* Search Button */}
                <Row className="mt-4">
                  <Col className="d-flex justify-content-end">
                    <Button 
                      variant="success" 
                      size="sm"
                      disabled={!selectedAgentHotel}
                      onClick={async() => {
                        if (!selectedAgentHotel) {
                          alert("Please select Agent or Hotel criteria first");
                          return;
                        }
                        if (!compareOption) {
                          setShowCompareValidation(true);
                          return;
                        }
                        if (compareOption === "date" && (!selectedFromDate || !selectedToDate)) {
                          alert("Please select date range");
                          return;
                        }
                        if (compareOption === "date" && selectedFromDate > selectedToDate) {
                          alert("From Date must be on or before To Date");
                          return;
                        }
                        if (compareOption === "other" && !selectedOtherEntity) {
                          alert("Please select comparison entity");
                          return;
                        }
                        const ok = compareOption === "date"
                          ? await fetchcomparison(selectedOption, selectedFromDate, selectedToDate)
                          : await fetchcomparison(selectedOption);
                        setReportType(selectedOption);
                        setShowResults(ok);
                      }}
                    >
                      <i className="fas fa-search me-1"></i>Search
                    </Button>
                  </Col>
                </Row>
              </Form>
            </div>

            {/* Results Section */}
            {showResults && (
              <Card.Body className="p-0 mt-1">
                {/* Action Buttons */}
                <div className="p-3 border-bottom">
                  <Row>
                    {/* <Col md="auto">
                      <input
                        type="text"
                        style={{background: 'white'}}
                        value={searchQuery}
                        onChange={(e)=>setSearchQuery(e.target.value)}
                        placeholder="search here"
                        className="form-control form-control-sm w-auto"
                      />
                    </Col> */}
                    <Col className="d-flex justify-content-end gap-2">
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
                    
                  </Row>
                </div>

                {/* Unified Comparison Table */}
                <Table responsive hover striped className="mb-0 align-middle">
                  <thead>
                    <tr>
                      <th style={{ width: 100 }}>S/N</th>
                      <th>{reportType === 'agent' ? 'Agent Name' : 'Hotel Name'}</th>
                      <th>No.Of Booking</th>
                      <th>Cancelled Booking</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultRows.map((item, index) => (
                      <tr key={`${index}-${item.agentname}`}>
                        <td>{index + 1}</td>
                        <td>{item.agentname}</td>
                        <td>{item.noofbooking}</td>
                        <td>{item.cancelledbooking}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card.Body>
            )}
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

export default Comparison;