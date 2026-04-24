import React, { useEffect, useState, useCallback } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Form,
  Table,
  InputGroup,
  Spinner,
  Pagination,
  Modal,
} from "react-bootstrap";
import {
  FaSearch,
  FaEye,
  FaFileAlt,
  FaFileInvoice,
  FaPercent,
  FaEnvelope,
  FaPaperPlane,
  FaDownload,
} from "react-icons/fa";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import toast from "react-hot-toast";

const PER_PAGE_OPTIONS = [10, 25, 50, 100];

const OfflineBookingList = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Modals state
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewData, setViewData] = useState([]);
  const [loadingView, setLoadingView] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);

  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfTitle, setPdfTitle] = useState("");
  const [loadingPdf, setLoadingPdf] = useState(false);
  
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [sendingMail, setSendingMail] = useState(false);

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
    //   const response = await axiosInstance.get("api/v1/offline-booking/all-list", {
    //     params: {
    //       page: page - 1,
    //       size: perPage,
    //       search: search,
    //     },
    //   });

    const response = await axiosInstance.get("api/v1/offline-booking/all-list");

      if (response.data) {
        setBookings(response.data);
        setTotalElements(response.data.length);
        setTotalPages(Math.ceil(response.data.length / perPage));
      }
    } catch (error) {
      console.error("Error fetching offline bookings:", error);
      toast.error("Failed to load offline bookings");
    } finally {
      setLoading(false);
    }
  }, [perPage]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleViewClick = async (booking) => {
    setSelectedBooking(booking);
    setShowViewModal(true);
    setLoadingView(true);
    try {
      const response = await axiosInstance.get(
        `api/v1/offline-booking/list/${booking.invoiceNumber}/${booking.supplierMainBasicId}`
      );
      setViewData(response.data || []);
    } catch (error) {
      console.error("Error fetching view data:", error);
      toast.error("Failed to load booking details");
    } finally {
      setLoadingView(false);
    }
  };

  const handlePdfClick = async (booking, type) => {
    setSelectedBooking(booking);
    setPdfTitle(type);
    setShowPdfModal(true);
    setLoadingPdf(true);
    try {
      const response = await axiosInstance.get(
        `api/v1/offline-booking/${booking.supplierMainBasicId}/pdf`,
        { params: { type: type.toUpperCase() } }
      );
      if (response.data && response.data.status === "SUCCESS") {
        setPdfUrl(response.data.pdfUrl);
      } else {
        toast.error(response.data?.message || `Failed to generate ${type}`);
        setShowPdfModal(false);
      }
    } catch (error) {
      console.error(`Error fetching ${type} PDF:`, error);
      toast.error(`Failed to load ${type}`);
      setShowPdfModal(false);
    } finally {
      setLoadingPdf(false);
    }
  };

  const handleSendMail = async () => {
    if (!email.trim()) {
      setEmailError("Email is required");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError("Invalid email format");
      return;
    }
    setEmailError("");

    setSendingMail(true);
    try {
      const response = await axiosInstance.post("api/v1/offline-booking/send-pdf-email", {
        email: email,
        pdfUrl: pdfUrl,
        type: pdfTitle,
        invoiceNumber: selectedBooking?.invoiceNumber,
        bookingId: selectedBooking?.supplierMainBasicId
      });
      if (response.status === 200) {
        toast.success("Email sent successfully");
        setEmail("");
      } else {
        toast.error("Failed to send email");
      }
    } catch (error) {
      console.error("Error sending email:", error);
      toast.error("An error occurred while sending email");
    } finally {
      setSendingMail(false);
    }
  };

  const handlePageChange = (newPage) => setPage(newPage);
  const handlePerPageChange = (e) => {
    setPerPage(parseInt(e.target.value, 10));
    setPage(1);
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4" style={{ overflowX: "hidden" }}>
          <Container fluid>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h3 className="fw-bold text-dark">List of Suppliers</h3>
            </div>

            <Card className="shadow-sm border-0 mb-4" style={{ borderRadius: "12px" }}>
              <Card.Body className="p-3">
                <Row className="align-items-center g-3">
                  <Col md={3}>
                    <div className="d-flex align-items-center gap-2">
                      <span className="text-muted small">Display</span>
                      <Form.Select
                        size="sm"
                        value={perPage}
                        onChange={handlePerPageChange}
                        style={{ width: "80px" }}
                      >
                        {PER_PAGE_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </Form.Select>
                      <span className="text-muted small">records</span>
                    </div>
                  </Col>
                  <Col md={{ span: 4, offset: 5 }}>
                    <InputGroup size="sm">
                      <InputGroup.Text className="bg-white border-end-0">
                        <FaSearch className="text-muted" />
                      </InputGroup.Text>
                      <Form.Control
                        placeholder="Search..."
                        value={search}
                        onChange={(e) => {
                          setSearch(e.target.value);
                          setPage(1);
                        }}
                        className="border-start-0"
                      />
                    </InputGroup>
                  </Col>
                </Row>
              </Card.Body>
            </Card>

            <Card className="shadow-sm border-0" style={{ borderRadius: "12px", overflow: "hidden" }}>
              <div className="table-responsive">
                <Table hover className="mb-0 align-middle">
                  <thead className="bg-primary text-white">
                    <tr>
                      <th className="py-3 px-4 text-center" style={{ width: "60px" }}>S.N</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Invoice Number</th>
                      <th className="py-3 px-4">Agent Name</th>
                      <th className="py-3 px-4">Booking Details</th>
                      <th className="py-3 px-4">Total Amount</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="7" className="text-center py-5">
                          <Spinner animation="border" variant="primary" />
                          <p className="mt-2 text-muted mb-0">Loading bookings...</p>
                        </td>
                      </tr>
                    ) : bookings.length > 0 ? (
                      bookings.map((booking, idx) => (
                        <tr key={booking.id || idx}>
                          <td className="px-4 text-center">{(page - 1) * perPage + idx + 1}</td>
                          <td className="px-4">{booking.bookingDate || booking.createdAt || "N/A"}</td>
                          <td className="px-4 font-monospace fw-bold text-primary">{booking.invoiceNumber}</td>
                          <td className="px-4">{booking.agentName || "Direct Client"}</td>
                          <td className="px-4">
                            <div className="small">
                              <div className="fw-bold text-dark">{booking.customerName}</div>
                              <div className="text-muted">
                                Check-In: {booking.checkIn}<br />
                                Check-Out: {booking.checkOut}<br />
                                Total Pax: {booking.adult || 0} adult(s) and {booking.child || 0} child(ren)
                              </div>
                            </div>
                          </td>
                          <td className="px-4 fw-bold">{booking.totalAmount || booking.grandTotal || "0.00"}</td>
                          <td className="px-4 text-center">
                            <div className="d-flex justify-content-center gap-2">
                              <Button 
                                variant="outline-primary" 
                                size="sm" 
                                className="btn-icon-custom" 
                                title="View"
                                onClick={() => handleViewClick(booking)}
                              >
                                <FaEye />
                              </Button>
                              <Button 
                                variant="outline-success" 
                                size="sm" 
                                className="btn-icon-custom" 
                                title="Voucher"
                                onClick={() => handlePdfClick(booking, "VOUCHER")}
                              >
                                <FaFileAlt />
                              </Button>
                              <Button 
                                variant="outline-info" 
                                size="sm" 
                                className="btn-icon-custom" 
                                title="Invoice"
                                onClick={() => handlePdfClick(booking, "INVOICE")}
                              >
                                <FaFileInvoice />
                              </Button>
                              <Button 
                                variant="outline-secondary" 
                                size="sm" 
                                className="btn-icon-custom" 
                                title="Tax"
                                onClick={() => handlePdfClick(booking, "TAX")}
                              >
                                <FaPercent />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="7" className="text-center py-5 text-muted">
                          No offline bookings found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </div>

              {totalPages > 1 && (
                <Card.Footer className="bg-white border-0 py-3">
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="small text-muted">
                      Showing {(page - 1) * perPage + 1} to {Math.min(page * perPage, totalElements)} of {totalElements} entries
                    </span>
                    <Pagination size="sm" className="mb-0">
                      <Pagination.Prev disabled={page === 1} onClick={() => handlePageChange(page - 1)} />
                      {[...Array(totalPages)].map((_, i) => (
                        <Pagination.Item
                          key={i + 1}
                          active={i + 1 === page}
                          onClick={() => handlePageChange(i + 1)}
                        >
                          {i + 1}
                        </Pagination.Item>
                      ))}
                      <Pagination.Next disabled={page === totalPages} onClick={() => handlePageChange(page + 1)} />
                    </Pagination>
                  </div>
                </Card.Footer>
              )}
            </Card>
          </Container>
        </main>
      </div>

      {/* View Modal */}
      <Modal 
        show={showViewModal} 
        onHide={() => setShowViewModal(false)} 
        size="xl" 
        centered
        backdrop="static"
        keyboard={false}
      >
        <Modal.Header className="bg-light">
          <Modal.Title className="fw-bold">
            <FaEye className="me-2 text-primary" />
            Booking Details - {selectedBooking?.invoiceNumber}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loadingView ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="primary" />
              <p className="mt-2 text-muted">Loading details...</p>
            </div>
          ) : (
            <div className="table-responsive">
              <Table bordered hover size="sm" className="align-middle">
                <thead className="bg-light">
                  <tr>
                    <th>S.N</th>
                    <th>Supplier Type</th>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th>Tax (%)</th>
                    <th>Tax Amount</th>
                    <th>Sub Total</th>
                  </tr>
                </thead>
                <tbody>
                  {viewData.length > 0 ? (
                    viewData.map((item, idx) => (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td className="fw-bold text-primary">{item.supplierType}</td>
                        <td style={{ maxWidth: "300px" }}>{item.description}</td>
                        <td>{item.quantity}</td>
                        <td>{item.unitPrice}</td>
                        <td>{item.tax}%</td>
                        <td>{item.taxAmount}</td>
                        <td className="fw-bold">{item.subTotal}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="8" className="text-center py-3">No details available.</td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowViewModal(false)}>Close</Button>
        </Modal.Footer>
      </Modal>

      {/* PDF Modal */}
      <Modal 
        show={showPdfModal} 
        onHide={() => setShowPdfModal(false)} 
        size="xl" 
        centered 
        scrollable
        backdrop="static"
        keyboard={false}
      >
        <Modal.Header className="bg-light">
          <Modal.Title className="fw-bold">
            {pdfTitle} - {selectedBooking?.invoiceNumber}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0" style={{ height: "70vh" }}>
          {loadingPdf ? (
            <div className="h-100 d-flex flex-column align-items-center justify-content-center">
              <Spinner animation="border" variant="primary" />
              <p className="mt-2 text-muted">Generating {pdfTitle}...</p>
            </div>
          ) : pdfUrl ? (
            <iframe
              src={`${pdfUrl}#toolbar=0`}
              width="100%"
              height="100%"
              title="PDF Viewer"
              style={{ border: "none" }}
            />
          ) : (
            <div className="h-100 d-flex align-items-center justify-content-center">
              <p className="text-danger">Failed to load PDF.</p>
            </div>
          )}
        </Modal.Body>
        <div className="p-3 border-top bg-light">
          <Row className="align-items-center">
            <Col md={8}>
              <Form.Group>
                <InputGroup className={emailError ? "is-invalid" : ""}>
                  <InputGroup.Text className="bg-white">
                    <FaEnvelope className="text-muted" />
                  </InputGroup.Text>
                  <Form.Control
                    type="email"
                    placeholder="Enter email address"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError("");
                    }}
                    className={emailError ? "is-invalid" : ""}
                  />
                  <Button 
                    variant="primary" 
                    onClick={handleSendMail}
                    disabled={sendingMail || !pdfUrl}
                  >
                    {sendingMail ? (
                      <Spinner animation="border" size="sm" />
                    ) : (
                      <>
                        <FaPaperPlane className="me-2" />
                        Send Mail
                      </>
                    )}
                  </Button>
                </InputGroup>
                {emailError && <div className="invalid-feedback d-block">{emailError}</div>}
              </Form.Group>
            </Col>
            <Col md={4} className="text-end">
              <Button variant="outline-primary" size="sm" onClick={() => window.open(pdfUrl, "_blank")} disabled={!pdfUrl}>
                <FaDownload className="me-1" /> Download
              </Button>
            </Col>
          </Row>
        </div>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => {
            setShowPdfModal(false);
            setEmail("");
            setEmailError("");
          }}>Close</Button>
        </Modal.Footer>
      </Modal>
      
      <style>{`
        .bg-primary {
          background-color: #3f51b5 !important;
        }
        .btn-icon-custom {
          width: 32px;
          height: 32px;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          transition: all 0.2s;
        }
        .btn-icon-custom:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
        .table hover tbody tr:hover {
          background-color: rgba(63, 81, 181, 0.05) !important;
        }
      `}</style>
    </div>
  );
};

export default OfflineBookingList;