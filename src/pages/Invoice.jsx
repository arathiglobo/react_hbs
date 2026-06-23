import React, { useState, useEffect } from "react";
import {
  Card,
  Button,
  Table,
  Form,
  Row,
  Col,
  Modal,
  Pagination,
} from "react-bootstrap";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/TopBar";
import axiosInstance from "../components/AxiosInstance";
import { toast } from "react-hot-toast";
import {
  FaCalendarAlt,
  FaPrint,
  FaFileExcel,
  FaHotel,
  FaUser,
  FaBuilding,
  FaTag,
  FaMoneyBillWave,
  FaSearch,
  FaPlus,
  FaFileInvoice,
  FaFileInvoiceDollar,
  FaInbox,
} from "react-icons/fa";

export default function Invoice() {
  const [invoiceList, setInvoiceList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [agent, setAgent] = useState("");
  const [agents, setAgents] = useState([]);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const itemsPerPage = 10;

  const activeRole = (localStorage.getItem("currentActiveRole") || "")
    .trim()
    .toUpperCase();
  const storedRoles = (localStorage.getItem("userRole") || "").toUpperCase();
  const isAgentRole = activeRole
    ? activeRole === "AGENT"
    : storedRoles.includes("AGENT") && !storedRoles.includes("ADMIN");

  const agentList = async () => {
    try {
      const response = await axiosInstance.get("/api/agent");
      setAgents(response.data || []);
    } catch (error) {
      console.log("error for agent axios list:", error);
      setAgents([]);
    }
  };

  const fetchInvoiceData = async (pageNumber = 0) => {
    setIsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (fromDate) params.append("fromDate", fromDate);
      if (toDate) params.append("toDate", toDate);
      if (agent) params.append("agent", agent);
      params.append("page", String(pageNumber));
      params.append("limit", String(itemsPerPage));

      const response = await axiosInstance.get(
        `/api/bookings/full-list?${params.toString()}`,
      );

      if (response.data && response.data.success) {
        setInvoiceList(response.data.bookings?.content || []);
        setTotalElements(response.data.bookings?.totalElements || 0);
        setTotalPages(response.data.bookings?.totalPages || 0);
        if (response.data.bookings?.content?.length === 0) {
          toast.success("No bookings found for the selected criteria");
        }
      } else {
        setError(response.data?.message || "Failed to fetch bookings");
        setInvoiceList([]);
        setTotalElements(0);
        setTotalPages(0);
      }
    } catch (err) {
      console.error("Error fetching bookings:", err);
      setError(
        err.response?.data?.message ||
          "An error occurred while fetching bookings",
      );
      setInvoiceList([]);
      setTotalElements(0);
      setTotalPages(0);
    } finally {
      setIsLoading(false);
    }
  };

  // Agent logins are auto-scoped by the backend, so load the list on mount
  // (and on page change) without requiring an agent selection. Admins keep
  // the existing behavior of only fetching once a filter is chosen.
  useEffect(() => {
    if (isAgentRole || fromDate || toDate || agent) {
      fetchInvoiceData(currentPage - 1);
    }
  }, [currentPage]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (currentPage === 1) {
      fetchInvoiceData(0);
    } else {
      setCurrentPage(1);
    }
  };

  // Normalize LocalDateTime strings — treats plain "YYYY-MM-DD" as local midnight
  const parseLocal = (str) => {
    if (!str) return null;
    const normalized = String(str).includes("T") ? str : `${str}T00:00:00`;
    const d = new Date(normalized);
    return isNaN(d.getTime()) ? null : d;
  };

  const formatDate = (dateString) => {
    const d = parseLocal(dateString);
    if (!d) return "-";
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatDateTime = (dateTimeString) => {
    const d = parseLocal(dateTimeString);
    if (!d) return "-";
    return (
      d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }) +
      " " +
      d.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    );
  };

  const formatDateShort = (dateString) => {
    const d = parseLocal(dateString);
    if (!d) return "-";
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return "-";
    return `AED ${parseFloat(amount).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Shows the booking amount in the currency it was confirmed in: when the
  // row carries a non-AED display currency + converted amount, render that;
  // otherwise fall back to the AED total.
  const formatBookingAmount = (invoice) => {
    if (!invoice) return "-";
    const code = invoice.displayCurrencyCode;
    const amt = Number(invoice.displayAmount);
    if (code && code !== "AED" && Number.isFinite(amt) && amt > 0) {
      return `${code} ${amt.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }
    return formatCurrency(invoice.totalRate); // existing AED formatter
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExcel = () => {
    // TODO: Implement Excel export functionality
    toast("Excel export functionality coming soon", {
      icon: "ℹ️",
    });
  };

  const handlePlusClick = (index) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const handleInvoiceVoucherClick = async (invoice) => {
    try {
      const invoiceId =
        invoice.bookingId ||
        invoice.hotelId ||
        invoice.id ||
        invoice.bookingCode;

      if (!invoiceId) {
        toast.error("Invoice ID not found");
        return;
      }

      setPdfLoading(true);
      const response = await axiosInstance.post(
        `/api/invoice-generation/generate/${invoiceId}?invoiceType=PROFORMA`,
      );

      if (response.data && response.data.status === "SUCCESS") {
        setPdfUrl(response.data.pdfUrl);
        setShowPdfModal(true);
        toast.success(
          response.data.message || "Invoice generated successfully",
        );
      } else {
        toast.error(response.data?.message || "Failed to generate invoice");
      }
    } catch (err) {
      console.error("Error generating invoice:", err);
      toast.error(err.response?.data?.message || "Failed to generate invoice");
    } finally {
      setPdfLoading(false);
    }
  };

  const handleTaxVoucherClick = async (invoice) => {
    try {
      const invoiceId =
        invoice.bookingId ||
        invoice.hotelId ||
        invoice.id ||
        invoice.bookingCode;

      if (!invoiceId) {
        toast.error("Invoice ID not found");
        return;
      }

      setPdfLoading(true);
      const response = await axiosInstance.post(
        `/api/invoice-generation/generate/${invoiceId}?invoiceType=TAX`,
      );

      if (response.data && response.data.status === "SUCCESS") {
        setPdfUrl(response.data.pdfUrl);
        setShowPdfModal(true);
        toast.success(
          response.data.message || "Tax invoice generated successfully",
        );
      } else {
        toast.error(response.data?.message || "Failed to generate tax invoice");
      }
    } catch (err) {
      console.error("Error generating tax invoice:", err);
      toast.error(
        err.response?.data?.message || "Failed to generate tax invoice",
      );
    } finally {
      setPdfLoading(false);
    }
  };

  const handleClosePdfModal = () => {
    setShowPdfModal(false);
    setPdfUrl("");
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Card className="shadow-sm rounded-xl">
            <Card.Header className="d-flex flex-wrap gap-2 justify-content-between align-items-center">
              <div className="d-flex align-items-center">
                <Button
                  variant="link"
                  className="p-0 me-3"
                  onClick={() => window.history.back()}
                >
                  &lt;&lt; Back
                </Button>
                <h4 className="fw-bold mb-0" style={{ color: "#EC0B43" }}>TAX INVOICE LIST</h4>
                {totalElements > 0 && (
                  <span className="ms-3 text-muted">
                    ({totalElements}{" "}
                    {totalElements === 1 ? "invoice" : "invoices"})
                  </span>
                )}
              </div>
              <div className="d-flex gap-2">
                <Button variant="secondary" onClick={handlePrint}>
                  <FaPrint className="me-2" />
                  Print
                </Button>
                <Button variant="secondary" onClick={handleExcel}>
                  <FaFileExcel className="me-2" />
                  Excel
                </Button>
              </div>
            </Card.Header>
            <Card.Body className="p-3">
              <Card className="mb-3 border-0 bg-light">
                <Card.Body className="p-3">
                  <h6 className="fw-semibold mb-3">Search Criteria</h6>
                  <Form onSubmit={handleSearch}>
                    <Row className="g-3 align-items-end">
                      <Col md={3}>
                        <Form.Group>
                          <Form.Label>From Date</Form.Label>
                          <div className="position-relative">
                            <Form.Control
                              type="date"
                              value={fromDate}
                              onChange={(e) => setFromDate(e.target.value)}
                              className="pe-5"
                            />
                            <FaCalendarAlt
                              className="position-absolute"
                              style={{
                                right: "12px",
                                top: "50%",
                                transform: "translateY(-50%)",
                                color: "#6c757d",
                                pointerEvents: "none",
                              }}
                            />
                          </div>
                        </Form.Group>
                      </Col>
                      <Col md={3}>
                        <Form.Group>
                          <Form.Label>To Date</Form.Label>
                          <div className="position-relative">
                            <Form.Control
                              type="date"
                              value={toDate}
                              onChange={(e) => setToDate(e.target.value)}
                              min={fromDate || undefined}
                              className="pe-5"
                            />
                            <FaCalendarAlt
                              className="position-absolute"
                              style={{
                                right: "12px",
                                top: "50%",
                                transform: "translateY(-50%)",
                                color: "#6c757d",
                                pointerEvents: "none",
                              }}
                            />
                          </div>
                        </Form.Group>
                      </Col>
                      {!isAgentRole && (
                        <Col md={3}>
                          <Form.Group>
                            <Form.Label>Agent</Form.Label>
                            <Form.Select
                              value={agent}
                              onChange={(e) => setAgent(e.target.value)}
                              onFocus={agentList}
                              required
                            >
                              <option value="">Select Agent</option>
                              {agents.map((agentItem) => (
                                <option key={agentItem.id} value={agentItem.id}>
                                  {agentItem.companyName}
                                </option>
                              ))}
                            </Form.Select>
                          </Form.Group>
                        </Col>
                      )}
                      <Col md={3}>
                        <Button
                          type="submit"
                          variant="primary"
                          className="w-100"
                          disabled={isLoading}
                        >
                          <FaSearch className="me-2" />
                          {isLoading ? "Searching..." : "Search"}
                        </Button>
                      </Col>
                    </Row>
                  </Form>
                </Card.Body>
              </Card>

              {isLoading ? (
                <div className="text-center py-5">
                  <div
                    className="spinner-border text-primary"
                    role="status"
                    style={{ width: "3rem", height: "3rem" }}
                  >
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-3 text-muted">Loading invoice data...</p>
                </div>
              ) : error ? (
                <div className="alert alert-danger" role="alert">
                  {error}
                </div>
              ) : invoiceList.length > 0 ? (
                <Card
                  className="shadow-sm border-0"
                  style={{ borderRadius: "8px", overflow: "hidden" }}
                >
                  <Card.Body className="p-0">
                    <div style={{ overflowX: "auto" }}>
                      <Table
                        hover
                        size="sm"
                        className="mb-0 align-middle table-bordered"
                        style={{
                          tableLayout: "auto",
                          width: "100%",
                          fontSize: "0.82rem",
                          borderCollapse: "separate",
                          borderSpacing: 0,
                        }}
                      >
                        <thead
                          style={{
                            backgroundColor: "#f8f9fa",
                            borderBottom: "2px solid #dee2e6",
                            boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
                            fontSize: "0.68rem",
                            letterSpacing: "0.04em",
                          }}
                        >
                          <tr>
                            <th
                              style={{
                                padding: "0.45rem 0.6rem",
                                fontWeight: "600",
                                textTransform: "uppercase",
                                color: "#495057",
                                textAlign: "center",
                                border: "1px solid #dee2e6",
                                whiteSpace: "normal",
                                lineHeight: 1.2,
                                minWidth: "64px",
                              }}
                            >
                              S.N
                            </th>
                            <th
                              style={{
                                padding: "0.45rem 0.6rem",
                                fontWeight: "600",
                                textTransform: "uppercase",
                                color: "#495057",
                                border: "1px solid #dee2e6",
                                whiteSpace: "normal",
                                lineHeight: 1.2,
                                minWidth: "130px",
                              }}
                            >
                              Customer
                            </th>
                            <th
                              style={{
                                padding: "0.45rem 0.6rem",
                                fontWeight: "600",
                                textTransform: "uppercase",
                                color: "#495057",
                                textAlign: "center",
                                border: "1px solid #dee2e6",
                                whiteSpace: "normal",
                                lineHeight: 1.2,
                                minWidth: "50px",
                                width: "50px",
                              }}
                            ></th>
                            <th
                              style={{
                                padding: "0.45rem 0.6rem",
                                fontWeight: "600",
                                textTransform: "uppercase",
                                color: "#495057",
                                border: "1px solid #dee2e6",
                                whiteSpace: "normal",
                                lineHeight: 1.2,
                                minWidth: "100px",
                              }}
                            >
                              Agent
                            </th>
                            <th
                              style={{
                                padding: "0.45rem 0.6rem",
                                fontWeight: "600",
                                textTransform: "uppercase",
                                color: "#495057",
                                border: "1px solid #dee2e6",
                                whiteSpace: "normal",
                                lineHeight: 1.2,
                                minWidth: "100px",
                              }}
                            >
                              Booking Code
                            </th>
                            <th
                              style={{
                                padding: "0.45rem 0.6rem",
                                fontWeight: "600",
                                textTransform: "uppercase",
                                color: "#495057",
                                border: "1px solid #dee2e6",
                                whiteSpace: "normal",
                                lineHeight: 1.2,
                                minWidth: "140px",
                              }}
                            >
                              Booking Date
                            </th>
                            <th
                              style={{
                                padding: "0.45rem 0.6rem",
                                fontWeight: "600",
                                textTransform: "uppercase",
                                color: "#495057",
                                border: "1px solid #dee2e6",
                                whiteSpace: "normal",
                                lineHeight: 1.2,
                                minWidth: "120px",
                              }}
                            >
                              Hotel Name
                            </th>
                            <th
                              style={{
                                padding: "0.45rem 0.6rem",
                                fontWeight: "600",
                                textTransform: "uppercase",
                                color: "#495057",
                                border: "1px solid #dee2e6",
                                whiteSpace: "normal",
                                lineHeight: 1.2,
                                minWidth: "110px",
                              }}
                            >
                              Check-In
                            </th>
                            <th
                              style={{
                                padding: "0.45rem 0.6rem",
                                fontWeight: "600",
                                textTransform: "uppercase",
                                color: "#495057",
                                border: "1px solid #dee2e6",
                                whiteSpace: "normal",
                                lineHeight: 1.2,
                                minWidth: "110px",
                              }}
                            >
                              Check-Out
                            </th>
                            <th
                              style={{
                                padding: "0.45rem 0.6rem",
                                fontWeight: "600",
                                textTransform: "uppercase",
                                color: "#495057",
                                textAlign: "right",
                                border: "1px solid #dee2e6",
                                whiteSpace: "normal",
                                lineHeight: 1.2,
                                minWidth: "120px",
                              }}
                            >
                              Total Amount
                            </th>
                            <th
                              style={{
                                padding: "0.45rem 0.6rem",
                                fontWeight: "600",
                                textTransform: "uppercase",
                                color: "#495057",
                                border: "1px solid #dee2e6",
                                whiteSpace: "normal",
                                lineHeight: 1.2,
                                minWidth: "180px",
                              }}
                            >
                              Reference Number
                            </th>
                            <th
                              style={{
                                padding: "0.45rem 0.6rem",
                                fontWeight: "600",
                                textTransform: "uppercase",
                                color: "#495057",
                                textAlign: "center",
                                border: "1px solid #dee2e6",
                                whiteSpace: "normal",
                                lineHeight: 1.2,
                                minWidth: "120px",
                              }}
                            >
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoiceList.map((invoice, index) => {
                            const baseCellStyle = {
                              padding: "0.45rem 0.6rem",
                              fontSize: "0.82rem",
                              border: "1px solid #dee2e6",
                              verticalAlign: "middle",
                              whiteSpace: "normal",
                              wordBreak: "break-word",
                              lineHeight: 1.35,
                            };
                            const serialNumber =
                              (currentPage - 1) * itemsPerPage + index + 1;

                            return (
                              <React.Fragment key={index}>
                                <tr
                                  style={{
                                    backgroundColor:
                                      index % 2 === 0 ? "#ffffff" : "#f8f9fa",
                                    transition: "background-color 0.2s ease",
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor =
                                      "#e7f3ff";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor =
                                      index % 2 === 0 ? "#ffffff" : "#f8f9fa";
                                  }}
                                >
                                  <td
                                    className="text-muted fw-semibold"
                                    style={{
                                      ...baseCellStyle,
                                      textAlign: "center",
                                      color: "#6c757d",
                                    }}
                                  >
                                    {serialNumber}
                                  </td>
                                  <td style={baseCellStyle}>
                                    <span className="fw-medium text-dark">
                                      {invoice.customerName || "-"}
                                    </span>
                                  </td>
                                  <td
                                    style={{
                                      ...baseCellStyle,
                                      textAlign: "center",
                                    }}
                                  >
                                    <FaPlus
                                      style={{
                                        color: "#28a745",
                                        cursor: "pointer",
                                        fontSize: "0.9rem",
                                      }}
                                      onClick={() => handlePlusClick(index)}
                                    />
                                  </td>
                                  <td style={baseCellStyle}>
                                    <span className="fw-medium text-dark">
                                      {invoice.agentName || "-"}
                                    </span>
                                  </td>
                                  <td style={baseCellStyle}>
                                    <span className="fw-bold text-primary">
                                      {invoice.bookingCode || "-"}
                                    </span>
                                  </td>
                                  <td style={baseCellStyle}>
                                    <span className="text-dark">
                                      {formatDateTime(invoice.bookingDate)}
                                    </span>
                                  </td>
                                  <td style={baseCellStyle}>
                                    <span className="fw-medium text-dark">
                                      {invoice.hotelName || "-"}
                                    </span>
                                  </td>
                                  <td style={baseCellStyle}>
                                    <span className="text-dark">
                                      {formatDateShort(invoice.checkInDate)}
                                    </span>
                                  </td>
                                  <td style={baseCellStyle}>
                                    <span className="text-dark">
                                      {formatDateShort(invoice.checkOutDate)}
                                    </span>
                                  </td>
                                  <td
                                    style={{
                                      ...baseCellStyle,
                                      textAlign: "right",
                                    }}
                                  >
                                  <span className="fw-bold text-dark">{formatBookingAmount(invoice)}</span>
                                  </td>
                                  <td style={baseCellStyle}>
                                    <code
                                      className="bg-light px-2 py-1 rounded"
                                      style={{
                                        fontSize: "0.75rem",
                                        color: "#495057",
                                      }}
                                    >
                                      {invoice.confirmationCode || "-"}
                                    </code>
                                  </td>
                                  <td
                                    style={{
                                      ...baseCellStyle,
                                      textAlign: "center",
                                    }}
                                  >
                                    <div className="d-flex gap-2 justify-content-center align-items-center">
                                      <FaFileInvoice
                                        style={{
                                          color: "#0d6efd",
                                          cursor: "pointer",
                                          fontSize: "1.1rem",
                                        }}
                                        onClick={() =>
                                          handleInvoiceVoucherClick(invoice)
                                        }
                                        title="Invoice Voucher"
                                      />
                                      <FaFileInvoiceDollar
                                        style={{
                                          color: "#ffc107",
                                          cursor: "pointer",
                                          fontSize: "1.1rem",
                                        }}
                                        onClick={() =>
                                          handleTaxVoucherClick(invoice)
                                        }
                                        title="Tax Voucher"
                                      />
                                    </div>
                                  </td>
                                </tr>
                                {expandedRows.has(index) && (
                                  <tr
                                    style={{
                                      backgroundColor:
                                        index % 2 === 0 ? "#f0f8ff" : "#e8f4f8",
                                    }}
                                  >
                                    <td
                                      colSpan={12}
                                      style={{
                                        ...baseCellStyle,
                                        padding: "0.75rem 1rem",
                                        backgroundColor: "#f8f9fa",
                                      }}
                                    >
                                      <div className="ms-4">
                                        <div className="mb-2">
                                          <strong>Hotel name:</strong>{" "}
                                          <span>
                                            {invoice.hotelName || "-"}
                                          </span>
                                        </div>
                                        <div className="mb-2">
                                          <strong>Date:</strong>{" "}
                                          <span>
                                            {formatDateShort(
                                              invoice.checkInDate,
                                            ) || "-"}{" "}
                                            to{" "}
                                            {formatDateShort(
                                              invoice.checkOutDate,
                                            ) || "-"}
                                          </span>
                                        </div>
                                        <div>
                                          <strong>Confirmation code:</strong>{" "}
                                          <code
                                            className="bg-white px-2 py-1 rounded"
                                            style={{
                                              fontSize: "0.75rem",
                                              color: "#495057",
                                            }}
                                          >
                                            {invoice.confirmationCode || "-"}
                                          </code>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </Table>
                    </div>
                    {/* Pagination - Following BookingReport logic pattern */}
                    <div className="d-flex justify-content-between align-items-center p-3 border-top bg-light">
                      <div>
                        <small className="text-muted">
                          Showing{" "}
                          {totalElements > 0
                            ? (currentPage - 1) * itemsPerPage + 1
                            : 0}{" "}
                          to{" "}
                          {Math.min(currentPage * itemsPerPage, totalElements)}{" "}
                          of {totalElements} entries
                        </small>
                      </div>
                      <div>
                        <Pagination className="mb-0">
                          <Pagination.Prev
                            onClick={() =>
                              setCurrentPage((prev) => Math.max(1, prev - 1))
                            }
                            disabled={currentPage === 1 || isLoading}
                          />
                          {Array.from(
                            { length: totalPages },
                            (_, i) => i + 1,
                          ).map((pageNum) => {
                            if (
                              pageNum === 1 ||
                              pageNum === totalPages ||
                              (pageNum >= currentPage - 1 &&
                                pageNum <= currentPage + 1)
                            ) {
                              return (
                                <Pagination.Item
                                  key={pageNum}
                                  active={pageNum === currentPage}
                                  onClick={() => setCurrentPage(pageNum)}
                                  disabled={isLoading}
                                >
                                  {pageNum}
                                </Pagination.Item>
                              );
                            } else if (
                              pageNum === currentPage - 2 ||
                              pageNum === currentPage + 2
                            ) {
                              return <Pagination.Ellipsis key={pageNum} />;
                            }
                            return null;
                          })}
                          <Pagination.Next
                            onClick={() =>
                              setCurrentPage((prev) =>
                                Math.min(totalPages, prev + 1),
                              )
                            }
                            disabled={
                              currentPage === totalPages ||
                              totalPages === 0 ||
                              isLoading
                            }
                          />
                        </Pagination>
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              ) : invoiceList.length === 0 && !error ? (
                <Card
                  className="shadow-sm border-0"
                  style={{ borderRadius: "8px" }}
                >
                  <Card.Body>
                    <div className="text-center py-5 text-muted">
                      <FaInbox
                        style={{
                          fontSize: "2.5rem",
                          marginBottom: "10px",
                          color: "#adb5bd",
                        }}
                      />
                      <p className="mt-2 mb-0 fs-5">
                        Please select an agent and click Search to view invoices
                      </p>
                    </div>
                  </Card.Body>
                </Card>
              ) : (
                <Card
                  className="shadow-sm border-0"
                  style={{ borderRadius: "8px" }}
                >
                  <Card.Body>
                    <div className="text-center py-5 text-muted">
                      <FaInbox
                        style={{
                          fontSize: "2.5rem",
                          marginBottom: "10px",
                          color: "#adb5bd",
                        }}
                      />
                      <p className="mt-2 mb-0 fs-5">
                        No invoice data available
                      </p>
                    </div>
                  </Card.Body>
                </Card>
              )}
            </Card.Body>
          </Card>

          <Modal
            show={showPdfModal}
            onHide={handleClosePdfModal}
            size="xl"
            centered
            fullscreen="lg-down"
          >
            <Modal.Header closeButton>
              <Modal.Title>Invoice PDF</Modal.Title>
            </Modal.Header>
            <Modal.Body style={{ padding: 0, height: "80vh" }}>
              {pdfLoading ? (
                <div
                  className="d-flex justify-content-center align-items-center"
                  style={{ height: "80vh" }}
                >
                  <div className="text-center">
                    <div
                      className="spinner-border text-primary"
                      role="status"
                      style={{ width: "3rem", height: "3rem" }}
                    >
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="mt-3 text-muted">Loading PDF...</p>
                  </div>
                </div>
              ) : pdfUrl ? (
                <iframe
                  src={pdfUrl}
                  style={{
                    width: "100%",
                    height: "100%",
                    border: "none",
                    minHeight: "80vh",
                  }}
                  title="Invoice PDF"
                />
              ) : (
                <div
                  className="d-flex justify-content-center align-items-center"
                  style={{ height: "80vh" }}
                >
                  <p className="text-muted">No PDF available</p>
                </div>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={handleClosePdfModal}>
                Close
              </Button>
              {pdfUrl && (
                <Button
                  variant="primary"
                  onClick={() => window.open(pdfUrl, "_blank")}
                >
                  Open in New Tab
                </Button>
              )}
            </Modal.Footer>
          </Modal>
        </main>
      </div>
    </div>
  );
}
