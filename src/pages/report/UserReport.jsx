import React, {useState,useEffect} from "react";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import { Row, Col, Card, Form,Button,Table,Modal } from "react-bootstrap";
import { toast } from "react-hot-toast";
import axiosInstance from "../../components/AxiosInstance";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';


// --- Static Data ---
const staticPromotionData = [
  { id: 1, code: 'PROMO1', name: 'Special Agent Deal', status: 'Available', contractRate: 120, specialRate: 100, description: 'Promo for agents' },
  { id: 2, code: 'PROMO2', name: 'Holiday Offer', status: 'Unavailable', contractRate: 140, specialRate: 120, description: 'Holiday season discount' },
];

const staticAvailabilityData = [
  { id: 1, room: 'Deluxe', date: '2025-11-01', available: 'Yes', note: 'High demand' },
  { id: 2, room: 'Suite', date: '2025-11-01', available: 'No', note: 'Sold Out' },
];

const staticBookingData = [
  { id: 1, bookingId: 'BK001', guest: 'Alice', date: '2025-11-01', status: 'Confirmed', amount: 250 },
  { id: 2, bookingId: 'BK002', guest: 'Bob', date: '2025-11-02', status: 'Pending', amount: 150 },
];


export default function UserReport() {
  // Dummy data
  const users = [];

  const [reportType, setReportType] = useState("");
  const [contracts, setContracts] = useState([]);
  const [specialRates, setSpecialRates] = useState([]);
  const [agents, setAgents] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showMailModal,setShowMailModal]=useState(false);
  const [emailAddress,setEmailAddress]=useState("");
  const [isSending,setIsSending]=useState(false);


  // ================== ISSUE CHECKPOINT: Email Sending Logic ==================
  // Ensures: valid email, shows spinner, calls API, closes modal on success
  const handleSendEmail = async ()=>{
  if (!emailAddress || !/^\S+@\S+\.\S+$/.test(emailAddress)){
      toast.error("Please enter a valid email address");
      return;
    }

    setIsSending(true);
    try{
      const response =await axiosInstance.post('/api/reports/send-email',{
        email: emailAddress,
        reportType:'User report',
        subType:reportType,
        filters:{
          
        }
      })
      if (response.data){
        toast.success("Report Sent Successfully!")
        setShowMailModal(false);
        setEmailAddress("");
      }
    }
    catch(error){
      toast.error("Failed to send mail")
    }finally{
      setIsSending(false);
    }
};

// removed stray stub; real handlers are defined below
  

  // useEffect Hook: Runs whenever 'reportType' changes
  // Fetches data for Contract Rate and Special Rate when selected
  useEffect(() => {
    // Function to fetch contract rates from API
    const fetchContracts = async () => {
      // Only fetch if "Contract Rate" is selected
      if (reportType === "Contract Rate") {
        setLoading(true); // Show loading spinner
        
        try {
          // Make API call to get contract rate data
          // API endpoint: /api/hotelContractRate
          const response = await axiosInstance.get('/api/hotelContractRate');
          
          // Check if response contains data and it's an array
          if (response.data && Array.isArray(response.data)) {
            // Store the contract data in state
            setContracts(response.data);
          } else {
            // If no valid data, set empty array
            setContracts([]);
          }
        } catch (error) {
          // If API call fails, show error message
          console.error('Error fetching contracts:', error);
          toast.error("Failed to fetch contract rates");
          setContracts([]); // Clear contracts on error
        } finally {
          // Always hide loading spinner when done (success or error)
          setLoading(false);
        }
      } else if (reportType === "Special Rate") {
        // Fetch Special Rate data
        setLoading(true);
        try {
          // API endpoint assumed: /api/hotelSpecialRate
          const response = await axiosInstance.get('/api/hotelSpecialRate');
          if (response.data && Array.isArray(response.data)) {
            setSpecialRates(response.data);
          } else {
            setSpecialRates([]);
          }
        } catch (error) {
          console.error('Error fetching special rates:', error);
          toast.error("Failed to fetch special rates");
          setSpecialRates([]);
        } finally {
          setLoading(false);
        }
      } else if (reportType === "Promotion") {
        // Fetch Promotion data
        setPromotions(staticPromotionData);
          setLoading(false);
      } else if (reportType === "Agent") {
        setLoading(true);
        try {
          const response = await axiosInstance.get('/api/agent?page=0&limit=20');
          setAgents(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
          console.error('Error fetching agents:', error);
          toast.error("Failed to fetch agent data");
          setAgents([]);
        } finally {
          setLoading(false);
        }
      } else if (reportType === "Availability") {
        setPromotions([]); // to clear prior promotions
        setContracts(staticAvailabilityData);
        setLoading(false);
      } else if (reportType === "Booking") {
        setSpecialRates(staticBookingData);
        setLoading(false);
      } else {
        // Clear datasets for other report types
        setContracts([]);
        setSpecialRates([]);
        setPromotions([]);
        setAgents([]);
      }
    };

    // Call the function when reportType changes
    fetchContracts();
  }, [reportType]); // Dependency: runs when reportType changes

  // ================== Print/PDF/Excel Helpers ==================
  const normalizeCell = (value) => {
    if (value === null || value === undefined) return 'N/A';
    const s = String(value).trim();
    if (s === '' || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') return 'N/A';
    return s;
  };
  const getCurrentData = () => {
    if (reportType === "Contract Rate") return contracts || [];
    if (reportType === "Special Rate") return specialRates || [];
    if (reportType === "Agent") return agents || [];
    if (reportType === "Promotion") return promotions || [];
    return users || [];
  };

  const handlePrint = () => {
    const data = getCurrentData();
    if (!data || data.length === 0) {
      toast.error("No data available to print");
      return;
    }

    const w = window.open('', '_blank');
    let html = `
      <html>
        <head>
          <title>User Report - ${reportType || 'All'}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            h1 { text-align: center; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <h1>User Report - ${reportType || 'All'}</h1>
          <table>
            <thead>
              <tr>
                <th>Sl.No</th>
                <th>Code</th>
                <th>Name</th>
                <th>Created By</th>
                <th>Modified By</th>
              </tr>
            </thead>
            <tbody>
    `;

    if (reportType === "Contract Rate") {
      contracts.forEach((c, i) => {
        html += `
          <tr>
            <td>${i + 1}</td>
            <td>${c.rateCode || 'N/A'}</td>
            <td>${c.rateCode || 'N/A'}</td>
            <td>${c.createdBy || 'N/A'}</td>
            <td>${c.modifiedBy || 'N/A'}</td>
          </tr>`;
      });
    } else if (reportType === "Special Rate") {
      specialRates.forEach((s, i) => {
        html += `
          <tr>
            <td>${i + 1}</td>
            <td>${(s.rateCode && String(s.rateCode).toLowerCase() !== 'null') ? s.rateCode : 'N/A'}</td>
            <td>${s.promotype || s.remark || s.rateName || ((s.rateCode && String(s.rateCode).toLowerCase() !== 'null') ? s.rateCode : 'N/A')}</td>
            <td>${s.createdBy || 'N/A'}</td>
            <td>${s.modifiedBy || 'N/A'}</td>
          </tr>`;
      });
    } else if (reportType === "Promotion") {
      promotions.forEach((p, i) => {
        html += `
          <tr>
            <td>${i + 1}</td>
            <td>${normalizeCell(p.promotionCode)}</td>
            <td>${normalizeCell(p.promotionName)}</td>
            <td>${normalizeCell(p.createdBy)}</td>
            <td>${normalizeCell(p.modifiedBy)}</td>
          </tr>`;
      });
    } else if (reportType === "Agent") {
      agents.forEach((a, i) => {
        html += `
          <tr>
            <td>${i + 1}</td>
            <td>${normalizeCell(a.companyName)}</td>
            <td>${normalizeCell(a.firstName)}</td>
            <td>${normalizeCell(a.lastName)}</td>
            <td>${normalizeCell(a.personalEmail)}</td>
           
          </tr>`;
      });
    } else {
      users.forEach((u, i) => {
        html += `
          <tr>
            <td>${i + 1}</td>
            <td>${u.code || 'N/A'}</td>
            <td>${u.name || 'N/A'}</td>
            <td>${u.createdBy || 'N/A'}</td>
            <td>${u.modifiedBy || 'N/A'}</td>
          </tr>`;
      });
    }

    html += `
            </tbody>
          </table>
        </body>
      </html>`;

    w.document.write(html);
    w.document.close();
    w.print();
  };

  const handlePDF = () => {
    const data = getCurrentData();
    if (!data || data.length === 0) {
      toast.error("No data available to export");
      return;
    }

    const doc = new jsPDF();
    doc.text(`User Report - ${reportType || 'All'}`, 20, 20);

    let body = [];
    if (reportType === "Contract Rate") {
      body = contracts.map((c, i) => [
        i + 1,
        normalizeCell(c.rateCode),
        normalizeCell(c.rateCode),
        'N/A',
        'N/A'
      ]);
    } else if (reportType === "Special Rate") {
      body = specialRates.map((s, i) => [
        i + 1,
        normalizeCell(s.rateCode),
        normalizeCell(s.rateName || s.rateCode),
        normalizeCell(s.createdBy),
        normalizeCell(s.modifiedBy)
      ]);
    } else if (reportType === "Promotion") {
      body = promotions.map((p, i) => [
        i + 1,
        normalizeCell(p.promotionCode),
        normalizeCell(p.promotionName),
        normalizeCell(p.createdBy),
        normalizeCell(p.modifiedBy)
      ]);
    } else if (reportType === "Agent") {
      body = agents.map((a, i) => [
        i + 1,
        normalizeCell(a.companyName),
        normalizeCell(a.firstName),
        normalizeCell(a.lastName),
        normalizeCell(a.personalEmail),
       
      ]);
    } else {
      body = users.map((u, i) => [
        i + 1,
        normalizeCell(u.code),
        normalizeCell(u.name),
        normalizeCell(u.createdBy),
        normalizeCell(u.modifiedBy)
      ]);
    }

    autoTable(doc, {
      head: [['Sl.No', 'Code', 'Name', 'Created By', 'Modified By']],
      body,
      startY: 30,
    });

    doc.save(`user-report-${reportType || 'all'}.pdf`);
    toast.success("PDF downloaded successfully");
  };

  const handleExcel = () => {
    const data = getCurrentData();
    if (!data || data.length === 0) {
      toast.error("No data available to export");
      return;
    }

    const escapeCSV = (v) => {
      const s = normalizeCell(v);
      return (s.includes(',') || s.includes('\n') || s.includes('"'))
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const headers = ['Sl.No', 'Code', 'Name', 'Created By', 'Modified By'];
    let rows = [];
    if (reportType === "Contract Rate") {
      rows = contracts.map((c, i) => [
        i + 1,
        normalizeCell(c.rateCode),
        normalizeCell(c.rateCode),
        'N/A',
        'N/A'
      ]);
    } else if (reportType === "Special Rate") {
      rows = specialRates.map((s, i) => [
        i + 1,
        normalizeCell(s.rateCode),
        normalizeCell(s.rateName || s.rateCode),
        normalizeCell(s.createdBy),
        normalizeCell(s.modifiedBy)
      ]);
    } else if (reportType === "Promotion") {
      rows = promotions.map((p, i) => [
        i + 1,
        normalizeCell(p.promotionCode),
        normalizeCell(p.promotionName),
        normalizeCell(p.createdBy),
        normalizeCell(p.modifiedBy)
      ]);
    } else if (reportType === "Agent") {
      rows = agents.map((a, i) => [
        i + 1,
        normalizeCell(a.companyName),
        normalizeCell(a.firstName),
        normalizeCell(a.lastName),
        normalizeCell(a.personalEmail),
       
      ]);
    } else {
      rows = users.map((u, i) => [
        i + 1,
        normalizeCell(u.code),
        normalizeCell(u.name),
        normalizeCell(u.createdBy),
        normalizeCell(u.modifiedBy)
      ]);
    }

    const csv = [
      headers.map(escapeCSV).join(','),
      ...rows.map(r => r.map(escapeCSV).join(','))
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `user-report-${reportType || 'all'}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("Excel file downloaded successfully");
  };

  return (
    <div className="bg-light d-flex flex-column" style={{ minHeight: "100vh" }}>
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />

        <main className="flex-grow-1 p-4" style={{ overflow: "auto" }}>
          <Card className="shadow-sm rounded-xl">
            <Card.Header>
              <span className="fw-semibold">User Report</span>
            </Card.Header>

            {/* Filters Section */}
            <div className="p-4 bg-light border-bottom">
              <Form>
                <Form.Group>
                  <Form.Label className="fw-semibold">* Please select:</Form.Label>
                  <div className="d-flex flex-wrap gap-3 mt-2">
                    <Form.Check
                      inline
                      label="Contract Rate"
                      name="reportType"
                      type="radio"
                      checked={reportType === "Contract Rate"}
                      onChange={() => setReportType("Contract Rate")}
                    />
                    <Form.Check
                      inline
                      label="Special Rate"
                      name="reportType"
                      type="radio"
                      checked={reportType === "Special Rate"}
                      onChange={() => setReportType("Special Rate")}
                    />
                    <Form.Check
                      inline
                      label="Promotion"
                      name="reportType"
                      type="radio"
                      checked={reportType === "Promotion"}
                      onChange={() => setReportType("Promotion")}
                    />
                    <Form.Check
                      inline
                      label="Availability"
                      name="reportType"
                      type="radio"
                      checked={reportType === "Availability"}
                      onChange={() => setReportType("Availability")}
                    />
                    <Form.Check
                      inline
                      label="Booking"
                      name="reportType"
                      type="radio"
                      checked={reportType === "Booking"}
                      onChange={() => setReportType("Booking")}
                    />
                    <Form.Check
                      inline
                      label="Agent"
                      name="reportType"
                      type="radio"
                      checked={reportType === "Agent"}
                      onChange={() => setReportType("Agent")}
                    />
                  </div>
                </Form.Group>
              </Form>

              {/* Action Buttons */}
              <Row className="mt-4">
                <Col md={12} className="d-flex gap-2 justify-content-end">
                  <Button variant="outline-primary" size="sm" onClick={()=>setShowMailModal(true)}>
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

            {/* Table Section */}
            <Card.Body className="p-0 mt-1">
              <Table responsive hover striped className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th style={{ width: 100 }}>S/N</th>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Created By</th>
                    <th>Modified By</th>
                  </tr>
                </thead>
              <tbody>
                {/* Show loading spinner while fetching contract data */}
                {loading ? (
                  <tr>
                    <td colSpan="5" className="text-center">
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Loading contract rates...
                    </td>
                  </tr>
                ) : reportType === "Contract Rate" ? (
                  // Display Contract Rate data when "Contract Rate" is selected
                  contracts.length > 0 ? (
                    contracts.map((contract, index) => (
                      <tr key={contract.contractrateId || index}>
                        {/* Sl.No: Serial number starting from 1 */}
                        <td>{index + 1}</td>
                        
                        {/* Code: Rate code from contract (e.g., "S1", "Week2") */}
                        <td>{contract.rateCode || "N/A"}</td>
                        
                        {/* Name: Using rateCode as name (you can change this to something else if needed) */}
                        <td>{contract.rateCode || "N/A"}</td>
                        
                        {/* Created By: Not available in API response, showing N/A */}
                        <td>N/A</td>
                        
                        {/* Modified By: Not available in API response, showing N/A */}
                        <td>N/A</td>
                      </tr>
                    ))
                  ) : (
                    // Show message when no contracts found
                    <tr>
                      <td colSpan="5" className="text-center text-muted">
                        No contract rates found
                      </td>
                    </tr>
                  )
                ) : reportType === "Special Rate" ? (
                  specialRates.length > 0 ? (
                    specialRates.map((s, index) => (
                      <tr key={s.id || index}>
                        <td>{index + 1}</td>
                        <td>{s.rateCode || "N/A"}</td>
                        <td>{s.rateName || s.rateCode || "N/A"}</td>
                        <td>{s.createdBy || "N/A"}</td>
                        <td>{s.modifiedBy || "N/A"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="text-center text-muted">
                        No special rates found
                      </td>
                    </tr>
                  )
                ) : reportType === "Promotion" ? (
                  (staticPromotionData.length > 0 ? (
                    staticPromotionData.map((p, index) => (
                      <tr key={p.id}>
                        <td>{index + 1}</td>
                        <td>{p.code}</td>
                        <td>{p.name}</td>
                        <td>{p.status}</td>
                        <td>{p.contractRate}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="text-center text-muted">
                        No promotions found
                      </td>
                    </tr>
                  ))
                ) : reportType === "Agent" ? (
                  agents.length > 0 ? (
                    agents.map((a, index) => (
                      <tr key={a.id || index}>
                        <td>{index + 1}</td>
                        <td>{normalizeCell(a.companyName)}</td>
                        <td>{normalizeCell(a.firstName)}</td>
                        <td>{normalizeCell(a.lastName)}</td>
                        <td>{normalizeCell(a.personalEmail)}</td>
                       
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="text-center text-muted">
                        No agents found
                      </td>
                    </tr>
                  )
                ) : reportType === "Availability" ? (
                  staticAvailabilityData.length > 0 ? (
                    staticAvailabilityData.map((a, index) => (
                      <tr key={a.id || index}>
                        <td>{index + 1}</td>
                        <td>{normalizeCell(a.room)}</td>
                        <td>{normalizeCell(a.date)}</td>
                        <td>{normalizeCell(a.available)}</td>
                        <td>{normalizeCell(a.note)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="text-center text-muted">
                        No availability data found
                      </td>
                    </tr>
                  )
                ) : reportType === "Booking" ? (
                  staticBookingData.length > 0 ? (
                    staticBookingData.map((b, index) => (
                      <tr key={b.id || index}>
                        <td>{index + 1}</td>
                        <td>{normalizeCell(b.bookingId)}</td>
                        <td>{normalizeCell(b.guest)}</td>
                        <td>{normalizeCell(b.date)}</td>
                        <td>{normalizeCell(b.status)}</td>
                       
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="text-center text-muted">
                        No booking data found
                      </td>
                    </tr>
                  )
                ) : (
                  // Display other report types data (users array)
                  // This is the original table for non-Contract Rate reports
                  users.length > 0 ? (
                    users.map((u, index) => (
                      <tr key={u.id}>
                        <td>{index + 1}</td>
                        <td>{u.code}</td>
                        <td>{u.name}</td>
                        <td>{u.createdBy}</td>
                        <td>{u.modifiedBy}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="text-center text-muted">
                        No data available in table
                      </td>
                    </tr>
                  )
                )}
              </tbody>
              </Table>
            </Card.Body>
          </Card>

          {/* ISSUE CHECKPOINT: Modal Visibility - must bind to boolean state, not setter */}
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
                            )


                            }
                          </Button>

                        </Modal.Footer>
          </Modal>
          
        </main>
      </div>
    </div>
  );
}
