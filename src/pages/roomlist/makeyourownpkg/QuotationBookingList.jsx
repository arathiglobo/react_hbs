import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Form,
  Table,
  Badge,
  InputGroup,
  Spinner,
  Pagination,
  Modal,
} from "react-bootstrap";
import {
  FaSearch,
  FaEnvelope,
  FaShare,
} from "react-icons/fa";
import Sidebar from "../../../components/Sidebar";
import TopBar from "../../../components/TopBar";
import axiosInstance from "../../../components/AxiosInstance";
import toast from "react-hot-toast";

const PER_PAGE_OPTIONS = [10, 25, 50, 100];

const QuotationBookingList = () => {
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [allQuotations, setAllQuotations] = useState([]);
  
  // Email modal state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const [emailData, setEmailData] = useState({
    email: "",
    cc: "",
  });
  const [sendingEmail, setSendingEmail] = useState(false);

  // Fetch quotations from API
  const fetchQuotations = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get(
        "/api/makeYourOwnPackage/getQuatationList"
      );

      if (Array.isArray(response.data)) {
        setAllQuotations(response.data || []);
      } else {
        setAllQuotations([]);
      }
    } catch (error) {
      console.error("Error fetching quotations:", error);
      toast.error("Failed to load quotations");
      setAllQuotations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuotations();
  }, [fetchQuotations]);

  // Reset to page 1 when filters or perPage change
  useEffect(() => {
    setPage(1);
  }, [perPage]);

  // Filter and paginate quotations client-side
  const filteredQuotations = useMemo(() => {
    let filtered = allQuotations;

    // Apply search filter
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter((quotation) =>
        String(quotation.quoteCode || "").toLowerCase().includes(searchLower) ||
        String(quotation.markUpTypeName || "").toLowerCase().includes(searchLower) ||
        String(quotation.agent || "").toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [allQuotations, search]);

  // Paginate filtered quotations
  const paginatedQuotations = useMemo(() => {
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    return filteredQuotations.slice(startIndex, endIndex);
  }, [filteredQuotations, page, perPage]);

  // Calculate pagination totals
  const totalElements = filteredQuotations.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / perPage));

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      });
    } catch {
      return dateString;
    }
  };

  const formatMarkup = (markup, markupType, markupTypeName) => {
    if (!markup || markup === 0) return "0%";
    if (markupType === 1 || markupTypeName === "Percent") {
      return `${markup}%`;
    } else {
      return `${markup} amt`;
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  // Handle email icon click
  const handleEmailClick = (quotation) => {
    setSelectedQuotation(quotation);
    setEmailData({
      email: "",
      cc: "",
    });
    setShowEmailModal(true);
  };

  // Handle send PDF email
  const handleSendEmail = async () => {
    if (!emailData.email.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailData.email.trim())) {
      toast.error("Please enter a valid email address");
      return;
    }

    // Validate CC email if provided
    if (emailData.cc.trim() && !emailRegex.test(emailData.cc.trim())) {
      toast.error("Please enter a valid CC email address");
      return;
    }

    try {
      setSendingEmail(true);
      const response = await axiosInstance.post(
        "/api/makeYourOwnPackage/sendQuotationPDF",
        {
          quoteId: selectedQuotation.quoteId,
          email: emailData.email.trim(),
          cc: emailData.cc.trim() || null,
        }
      );

      if (response.data) {
        toast.success("PDF sent successfully!");
        setShowEmailModal(false);
        setEmailData({ email: "", cc: "" });
        setSelectedQuotation(null);
      } else {
        toast.error("Failed to send PDF");
      }
    } catch (error) {
      console.error("Error sending email:", error);
      toast.error(error.response?.data?.message || "Failed to send PDF");
    } finally {
      setSendingEmail(false);
    }
  };

  // Get agent ID helper function (same as TopBar)
  const getCartAgentId = () =>
    sessionStorage.getItem("makeYourOwnPackageAgentId") ||
    localStorage.getItem("makeYourOwnPackageAgentId") ||
    "";

  // Handle convert icon click - convert quotation to booking (same procedure as TopBar handleCartClick -> handleContinueBooking)
  const handleConvertClick = async (quotation) => {
    try {
      // Step 1: Convert quotation to cart format and save to Redis
      // const convertResponse = await axiosInstance.post(
      //   `/api/makeYourOwnPackage/convertQuotationToCart`,
      //   {
      //     quoteId: quotation.quoteId
      //   }
      // );

      // if (!convertResponse.data) {
      //   toast.error("Failed to convert quotation to cart");
      //   return;
      // }

        console.log("quotation::" , quotation);
      // Step 2: Get agent ID (same as TopBar handleContinueBooking)
      const agentId =  getCartAgentId();
      console.log("agentId::" , agentId);

      if (!agentId) {
        toast.error("Select an agent before proceeding to checkout.");
        return;
      }

      // Step 3: Fetch latest cart data from Redis (same as TopBar handleContinueBooking)
      const response = await axiosInstance.post(
        `/api/makeYourOwnPackage/fetchDataFromRedis?userId=${encodeURIComponent(agentId)}`
      );

      if (Array.isArray(response.data) && response.data.length > 0) {
        // Step 4: Store cart data in sessionStorage for the booking page (same as TopBar)
        sessionStorage.setItem("makePkgCartData", JSON.stringify(response.data));
        sessionStorage.setItem("makePkgAgentId", agentId);
        // Store quoteId for booking payload if converting from quotation
        if (quotation.quoteId) {
          sessionStorage.setItem("makePkgQuoteId", String(quotation.quoteId));
        }
        
        // Step 5: Navigate to booking page (same as TopBar handleContinueBooking)
        window.open("/new-booking/make-your-own-package/booking-page");
      } else {
        toast.error("Your cart is empty. Please add items to cart first.");
      }
    } catch (error) {
      console.error("Error converting quotation:", error);
      
      // If convertQuotationToCart doesn't exist, try alternative approach
      if (error.response?.status === 404 || error.response?.status === 400) {
        // Alternative: Try to get quotation details and add to cart manually
        try {
          const response = await axiosInstance.get(
            `/api/makeYourOwnPackage/getQuotationById?quoteId=${quotation.quoteId}`
          );

          if (response.data) {
            const agentId = quotation.agentId || response.data.agentId || getCartAgentId();

            if (!agentId) {
              toast.error("Select an agent before proceeding to checkout.");
              return;
            }

            // If quotation has cart items, use them directly
            if (response.data.cartItems && Array.isArray(response.data.cartItems)) {
              sessionStorage.setItem("makePkgCartData", JSON.stringify(response.data.cartItems));
              sessionStorage.setItem("makePkgAgentId", agentId);
              // Store quoteId for booking payload
              if (quotation.quoteId) {
                sessionStorage.setItem("makePkgQuoteId", String(quotation.quoteId));
              }
              window.open("/new-booking/make-your-own-package/booking-page");
            } else {
              toast.error("Quotation data format not supported for conversion");
            }
          } else {
            toast.error("Failed to load quotation details");
          }
        } catch (altError) {
          console.error("Alternative conversion error:", altError);
          toast.error(altError.response?.data?.message || "Failed to convert quotation to booking");
        }
      } else {
        toast.error(error.response?.data?.message || "Failed to convert quotation to booking. Please try again.");
      }
    }
  };

  const displayStart = paginatedQuotations.length > 0 ? (page - 1) * perPage + 1 : 0;
  const displayEnd = Math.min(page * perPage, totalElements);

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main
          className="flex-grow-1 p-4"
          style={{ width: "100%", overflow: "hidden" }}
        >
          <Container
            fluid
            style={{
              maxWidth: "100%",
              paddingLeft: "1rem",
              paddingRight: "1rem",
            }}
          >
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="mb-0 fw-bold" style={{ color: "#0d6efd" }}>Quotations</h2>
            </div>

            {/* List of Quotations Section */}
            <Card className="shadow-sm border-0 mb-3" style={{ borderRadius: "8px" }}>
              <Card.Header
                className="bg-primary text-white d-flex justify-content-between align-items-center"
                style={{ borderRadius: "8px 8px 0 0" }}
              >
                <h5 className="mb-0 fw-bold">List of Quotations</h5>
              </Card.Header>
              <Card.Body>
                {/* Display and Search */}
                <Row className="mb-3 align-items-center">
                  <Col md={3}>
                    <div className="d-flex align-items-center gap-2">
                      <span className="small text-muted">Display</span>
                      <Form.Select
                        value={perPage}
                        onChange={(e) => setPerPage(Number(e.target.value))}
                        size="sm"
                        style={{ width: "auto" }}
                      >
                        {PER_PAGE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option} records
                          </option>
                        ))}
                      </Form.Select>
                    </div>
                  </Col>
                  <Col md={4} className="ms-auto">
                    <InputGroup>
                      <InputGroup.Text>
                        <FaSearch />
                      </InputGroup.Text>
                      <Form.Control
                        type="text"
                        placeholder="Search:"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </InputGroup>
                  </Col>
                </Row>

                {/* Table */}
                {loading ? (
                  <div className="text-center py-5">
                    <Spinner animation="border" variant="primary" />
                    <p className="mt-3 text-muted">Loading quotations...</p>
                  </div>
                ) : (
                  <>
                    <div className="table-responsive">
                      <Table striped bordered hover className="mb-0">
                        <thead className="table-light">
                          <tr>
                            <th style={{ width: "60px" }}>S.N</th>
                            <th>Quote Code</th>
                            <th>Tour Date</th>
                            <th>Currency</th>
                            <th>Markup</th>
                            <th>Markup Type</th>
                            <th>Total Price</th>
                            <th style={{ width: "120px" }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedQuotations.length > 0 ? (
                            paginatedQuotations.map((quotation, index) => (
                              <tr key={quotation.quoteId || index}>
                                <td>{(page - 1) * perPage + index + 1}</td>
                                <td>{quotation.quoteCode || "-"}</td>
                                <td>{formatDate(quotation.tourDate)}</td>
                                <td>{quotation.currencyCode || "AED"}</td>
                                <td>{formatMarkup(quotation.markUp, quotation.markUpType, quotation.markUpTypeName)}</td>
                                <td>{quotation.markUpTypeName || "-"}</td>
                                <td>{parseFloat(quotation.totalPrice || 0).toFixed(2)}</td>
                                <td>
                                  <div className="d-flex gap-2 align-items-center justify-content-center">
                                    <FaEnvelope
                                      className="text-success"
                                      style={{ cursor: "pointer" }}
                                      onClick={() => handleEmailClick(quotation)}
                                      title="Send PDF via Email"
                                      size={18}
                                    />
                                    <FaShare
                                      className="text-dark"
                                      style={{ cursor: "pointer" }}
                                      onClick={() => handleConvertClick(quotation)}
                                      title="Convert to Booking"
                                      size={18}
                                    />
                                  </div>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="8" className="text-center py-4 text-muted">
                                No data available in table
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </Table>
                    </div>

                    {/* Pagination */}
                    <div className="d-flex justify-content-between align-items-center mt-3">
                      <div className="text-muted small">
                        Showing {displayStart} to {displayEnd} of {totalElements} entries
                      </div>
                      {totalPages > 1 && (
                        <Pagination className="mb-0">
                          <Pagination.Prev
                            disabled={page === 1}
                            onClick={() => handlePageChange(page - 1)}
                          />
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum;
                            if (totalPages <= 5) {
                              pageNum = i + 1;
                            } else if (page <= 3) {
                              pageNum = i + 1;
                            } else if (page >= totalPages - 2) {
                              pageNum = totalPages - 4 + i;
                            } else {
                              pageNum = page - 2 + i;
                            }
                            return (
                              <Pagination.Item
                                key={pageNum}
                                active={pageNum === page}
                                onClick={() => handlePageChange(pageNum)}
                              >
                                {pageNum}
                              </Pagination.Item>
                            );
                          })}
                          <Pagination.Next
                            disabled={page === totalPages}
                            onClick={() => handlePageChange(page + 1)}
                          />
                        </Pagination>
                      )}
                    </div>
                  </>
                )}
              </Card.Body>
            </Card>
          </Container>
        </main>
      </div>

      {/* Email Modal */}
      <Modal
        show={showEmailModal}
        onHide={() => !sendingEmail && setShowEmailModal(false)}
        centered
        backdrop="static"
        keyboard={false}
      >
        <Modal.Header closeButton={!sendingEmail}>
          <Modal.Title>Send Quotation PDF via Email</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>
                Email <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                type="email"
                placeholder="Enter email address"
                value={emailData.email}
                onChange={(e) =>
                  setEmailData({ ...emailData, email: e.target.value })
                }
                disabled={sendingEmail}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>CC (Optional)</Form.Label>
              <Form.Control
                type="email"
                placeholder="Enter CC email address"
                value={emailData.cc}
                onChange={(e) =>
                  setEmailData({ ...emailData, cc: e.target.value })
                }
                disabled={sendingEmail}
              />
            </Form.Group>
            {selectedQuotation && (
              <div className="alert alert-info mb-0">
                <small>
                  <strong>Quote Code:</strong> {selectedQuotation.quoteCode || "-"}
                  <br />
                  <strong>Total Price:</strong> {parseFloat(selectedQuotation.totalPrice || 0).toFixed(2)} {selectedQuotation.currencyCode || "AED"}
                </small>
              </div>
            )}
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowEmailModal(false)}
            disabled={sendingEmail}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSendEmail}
            disabled={sendingEmail || !emailData.email.trim()}
          >
            {sendingEmail ? (
              <>
                <Spinner
                  animation="border"
                  size="sm"
                  className="me-2"
                />
                Sending...
              </>
            ) : (
              "Send PDF"
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default QuotationBookingList;
