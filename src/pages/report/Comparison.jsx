// ✅ ADDED: Additional imports for table, modal, toast, PDF and Excel functionality
import React, { useState } from "react";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import { Row, Col, Card, Form, Button, Dropdown, Table, Modal } from "react-bootstrap";
import { toast } from "react-hot-toast";
import axiosInstance from "../../components/AxiosInstance";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function Comparison() {
  
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
  // ✅ ADDED: New state variables for showing results and tracking report type
  const [showResults, setShowResults] = useState(false);
  const [reportType, setReportType] = useState("");
  // 🔥 NEW: Date state variables for filtering
  const [selectedFromDate, setSelectedFromDate] = useState("");
  const [selectedToDate, setSelectedToDate] = useState("");
  // 🔥 NEW: State for "Other" comparison selection
  const [selectedOtherEntity, setSelectedOtherEntity] = useState("");

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
        reportType: 'Comparison',
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
    
    const primaryData = (reportType === 'agent' ? agentData : hotelData)
      .filter(item => item.agentname === selectedAgentHotel)
      .filter(item => {
        if (!selectedFromDate || !selectedToDate) return true;
        const itemFromDate = new Date(item.fromDate);
        const itemToDate = new Date(item.toDate);
        const selectedFrom = new Date(selectedFromDate);
        const selectedTo = new Date(selectedToDate);
        return itemFromDate <= selectedTo && itemToDate >= selectedFrom;
      });
    
   
    const otherData = compareOption === "other" && selectedOtherEntity 
      ? otherEntitiesData[selectedOtherEntity] || []
      : [];
    
    
    const allData = [...primaryData, ...otherData];
    
    const columns = ['Sl.No', 'Entity Name', 'No Of Booking', 'Cancelled Booking'];
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Comparison Report - ${reportType === 'agent' ? 'Agent' : 'Hotel'}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            h1 { text-align: center; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <h1>Comparison Report - ${reportType === 'agent' ? 'Agent' : 'Hotel'}</h1>
          <table>
            <thead>
              <tr>
                ${columns.map(col => `<th>${col}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${allData.map((item, index) => (
                `<tr>
                  <td>${index + 1}</td>
                  <td>${item.agentname}</td>
                  <td>${item.noofbooking}</td>
                  <td>${item.cancelledbooking}</td>
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
    
    // 🔥 NEW: Get unified data (primary + other entity data)
    const primaryData = (reportType === 'agent' ? agentData : hotelData)
      .filter(item => item.agentname === selectedAgentHotel) // 🔥 Agent/Hotel filter
      .filter(item => {
        // 🔥 NEW: Date range filter
        if (!selectedFromDate || !selectedToDate) return true;
        const itemFromDate = new Date(item.fromDate);
        const itemToDate = new Date(item.toDate);
        const selectedFrom = new Date(selectedFromDate);
        const selectedTo = new Date(selectedToDate);
        return itemFromDate <= selectedTo && itemToDate >= selectedFrom;
      });
    
    // 🔥 NEW: Get other entity data if "Other" is selected
    const otherData = compareOption === "other" && selectedOtherEntity 
      ? otherEntitiesData[selectedOtherEntity] || []
      : [];
    
    // 🔥 NEW: Combine both datasets for unified table
    const allData = [...primaryData, ...otherData];
    
    doc.text(`Comparison Report - ${reportType === 'agent' ? 'Agent' : 'Hotel'}`, 20, 20);
    
    autoTable(doc, {
      head: [['Sl.No', 'Entity Name', 'No Of Booking', 'Cancelled Booking']],
      body: allData.map((item, index) => [
        index + 1, // 🔥 NEW: Sequential numbering across both datasets
        item.agentname,
        item.noofbooking,
        item.cancelledbooking,
      ]),
      startY: 30,
    });
    
    doc.save(`comparison-${reportType}-report.pdf`);
  };
  
  const handleExcel = () => {
    // 🔥 NEW: Get unified data (primary + other entity data)
    const primaryData = (reportType === 'agent' ? agentData : hotelData)
      .filter(item => item.agentname === selectedAgentHotel) // 🔥 Agent/Hotel filter
      .filter(item => {
        // 🔥 NEW: Date range filter
        if (!selectedFromDate || !selectedToDate) return true;
        const itemFromDate = new Date(item.fromDate);
        const itemToDate = new Date(item.toDate);
        const selectedFrom = new Date(selectedFromDate);
        const selectedTo = new Date(selectedToDate);
        return itemFromDate <= selectedTo && itemToDate >= selectedFrom;
      });
    
    // 🔥 NEW: Get other entity data if "Other" is selected
    const otherData = compareOption === "other" && selectedOtherEntity 
      ? otherEntitiesData[selectedOtherEntity] || []
      : [];
    
    // 🔥 NEW: Combine both datasets for unified table
    const allData = [...primaryData, ...otherData];
    
    const headers = ['Sl.No', 'Entity Name', 'No Of Booking', 'Cancelled Booking'];
    
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
      ...allData.map((item, index) => {
        return [
          index + 1, // 🔥 NEW: Sequential numbering across both datasets
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
  };

  const handleCompareChange = (option) => {
    setCompareOption(option);
    setShowCompareDropdown(option === "other");
    setShowDateInputs(option === "date");
    setShowCompareValidation(false); // Hide validation when user selects an option
  };

  // 🔥 NEW: Updated data structure with date fields for filtering
  // Each record now has fromDate and toDate fields to enable date range filtering
  // This allows filtering by both agent/hotel selection AND date range
  const agentData = [
    {
      slNo: 1,
      agentname: "Globo Agent",
      noofbooking: "5",
      cancelledbooking: "0",
      fromDate: "2025-05-01", // 🔥 FIXED: Only one Globo Agent record for May 1-15
      toDate: "2025-05-15"
    },
    {
      slNo: 2,
      agentname: "Direct Client",
      noofbooking: "3",
      cancelledbooking: "1",
      fromDate: "2025-05-01", // 🔥 FIXED: Only one Direct Client record for May 1-20
      toDate: "2025-05-20"
    },
    {
      slNo: 3,
      agentname: "Globo Agent",
      noofbooking: "8",
      cancelledbooking: "2",
      fromDate: "2025-06-01", // 🔥 CHANGED: Different month to avoid overlap
      toDate: "2025-06-15"
    },
    {
      slNo: 4,
      agentname: "Direct Client",
      noofbooking: "12",
      cancelledbooking: "3",
      fromDate: "2025-06-01", // 🔥 CHANGED: Different month to avoid overlap
      toDate: "2025-06-20"
    }
  ];

  // 🔥 NEW: Hotel data also updated with date fields for consistent filtering
  const hotelData = [
    {
      slNo: 1,
      agentname: "Test One",
      noofbooking: "7",
      cancelledbooking: "1",
      fromDate: "2025-05-01", // 🔥 FIXED: Only one Test One record for May 1-10
      toDate: "2025-05-10"
    },
    {
      slNo: 2,
      agentname: "Test Two",
      noofbooking: "4",
      cancelledbooking: "0",
      fromDate: "2025-05-01", // 🔥 FIXED: Only one Test Two record for May 1-15
      toDate: "2025-05-15"
    },
    {
      slNo: 3,
      agentname: "Test One",
      noofbooking: "9",
      cancelledbooking: "2",
      fromDate: "2025-06-01", // 🔥 CHANGED: Different month to avoid overlap
      toDate: "2025-06-10"
    },
    {
      slNo: 4,
      agentname: "Test Two",
      noofbooking: "6",
      cancelledbooking: "1",
      fromDate: "2025-06-01", // 🔥 CHANGED: Different month to avoid overlap
      toDate: "2025-06-15"
    }
  ];

  // 🔥 NEW: Other entities data for comparison
  const otherEntitiesData = {
    "Direct Hotel": [
      {
        slNo: 1,
        agentname: "Direct Hotel",
        noofbooking: "7",
        cancelledbooking: "1",
        fromDate: "2025-05-01",
        toDate: "2025-05-15"
      }
    ],
    "Test One": [
      {
        slNo: 1,
        agentname: "Test One",
        noofbooking: "9",
        cancelledbooking: "2",
        fromDate: "2025-05-01",
        toDate: "2025-05-15"
      }
    ],
    "Test Two": [
      {
        slNo: 1,
        agentname: "Test Two",
        noofbooking: "6",
        cancelledbooking: "1",
        fromDate: "2025-05-01",
        toDate: "2025-05-15"
      }
    ],
    "Test Three": [
      {
        slNo: 1,
        agentname: "Test Three",
        noofbooking: "4",
        cancelledbooking: "0",
        fromDate: "2025-05-01",
        toDate: "2025-05-15"
      }
    ]
  };

  const agentOptions = [
    "Globo Agent",
    "Direct Client",
  ];

  const hotelOptions = [
    "Test One",
    "Test Two"
  ];

  // 🔥 NEW: Other comparison options for comparing different entities
  const otherOptions = [
    "Direct Hotel",
    "Test One",
    "Test Two", 
    "Test Three"
  ];

  return (
    <div className="bg-light d-flex flex-column" style={{ minHeight: "100vh" }}>
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />

        <main className="flex-grow-1 p-4" style={{ overflow: "auto" }}>
          <Card className="shadow-sm rounded-xl" style={{ overflow: 'visible' }}>
            <Card.Header>
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
                        onChange={() => handleCompareChange("date")} 
                      />
                      <Form.Check 
                        type="radio" 
                        label="Other" 
                        name="compareOption" 
                        onChange={() => handleCompareChange("other")}
                      />
                    </div>
                    
                    {showCompareDropdown && (
                      <div className="mt-3 mb-4">
                        <Dropdown
                          drop="down"
                          flip={false}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Dropdown.Toggle variant="outline-secondary" size="sm">
                            {selectedOtherEntity
                              ? selectedOtherEntity
                              : "Select Comparison Entity"}
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
                            {otherOptions.map((option, index) => (
                              <Dropdown.Item
                                key={index}
                                onClick={() => setSelectedOtherEntity(option)}
                              >
                                {option}
                              </Dropdown.Item>
                            ))}
                          </Dropdown.Menu>
                        </Dropdown>
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
                      onClick={() => {
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
                        if (compareOption === "other" && !selectedOtherEntity) {
                          alert("Please select comparison entity");
                          return;
                        }
                        // Set report type and show results
                        setReportType(selectedOption);
                        setShowResults(true);
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

                {/* Unified Comparison Table */}
                <Table responsive hover striped className="mb-0 align-middle">
                  <thead>
                    <tr>
                      <th style={{ width: 100 }}>S/N</th>
                      <th>Agent Name</th>
                      <th>No.Of Booking</th>
                      <th>Cancelled Booking</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Show primary entity data */}
                    {(reportType === 'agent' ? agentData : hotelData)
                      .filter(item => item.agentname === selectedAgentHotel)
                      .filter(item => {
                        if (!selectedFromDate || !selectedToDate) return true;
                        const itemFromDate = new Date(item.fromDate);
                        const itemToDate = new Date(item.toDate);
                        const selectedFrom = new Date(selectedFromDate);
                        const selectedTo = new Date(selectedToDate);
                        return itemFromDate <= selectedTo && itemToDate >= selectedFrom;
                      })
                      .map((item, index) => (
                        <tr key={`primary-${item.slNo}`}>
                          <td>{index + 1}</td>
                          <td>{item.agentname}</td>
                          <td>{item.noofbooking}</td>
                          <td>{item.cancelledbooking}</td>
                        </tr>
                      ))}
                    
                    {/* Show other entity data in the same table */}
                    {compareOption === "other" && selectedOtherEntity && 
                      otherEntitiesData[selectedOtherEntity]?.map((item, index) => (
                        <tr key={`other-${item.slNo}`}>
                          <td>{(reportType === 'agent' ? agentData : hotelData).filter(item => item.agentname === selectedAgentHotel).length + index + 1}</td>
                          <td>{item.agentname}</td>
                          <td>{item.noofbooking}</td>
                          <td>{item.cancelledbooking}</td>
                        </tr>
                      ))
                    }
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