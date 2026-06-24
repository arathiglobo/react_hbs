import React, { useEffect, useState } from "react";
import {
  Card,
  Button,
  Table,
  Form,
  Pagination,
} from "react-bootstrap";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import { useParams, useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";

export default function AgentsPaymentHistory() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // Debug: Log the agentId from URL
  console.log("Agent ID from URL:", id);
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [agentInfo, setAgentInfo] = useState(null);

  const fetchPaymentHistory = async (pageNum = 0, searchTerm = search) => {
    setIsLoading(true);
    try {
      console.log("Fetching payment history for agentId:", id); // Debug log
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: "10"
        // agentId: id,
      });
      
      console.log("API URL:", `/api/inhouseAgentAccounts?${params.toString()}`); // Debug log

      if (searchTerm && searchTerm.trim()) {
        params.append("search", searchTerm.trim());
      }

      const res = await axiosInstance.get(
        `/api/inhouseAgentAccounts?${params.toString()}`
      );

      if (res.data && Array.isArray(res.data)) {
        setItems(res.data);
        if (res.data.length < 10) {
          setTotalPages(pageNum + 1);
        } else {
          setTotalPages(Math.max(totalPages, pageNum + 2));
        }
        setPage(pageNum);
      } else {
        setItems([]);
        setTotalPages(0);
        setPage(0);
      }
    } catch (err) {
      toast.error("Failed to load payment history");
      setItems([]);
      setTotalPages(0);
      setPage(0);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAgentInfo = async () => {
    try {
      const res = await axiosInstance.get(`/api/inhouseAgentAccounts`);
      if (res.data) {
        setAgentInfo(res.data);
      }
    } catch (err) {
      console.error("Failed to load agent info:", err);
    }
  };

  useEffect(() => {
    if (id) {
      console.log("useEffect triggered with agentId:", id); // Debug log
      fetchPaymentHistory();
      fetchAgentInfo();
    } else {
      console.log("No agentId found in URL"); // Debug log
    }
  }, [id]);

  // Debounced search effect
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (search !== "") {
      const timeout = setTimeout(() => {
        fetchPaymentHistory(0, search);
      }, 500);
      setSearchTimeout(timeout);
    } else if (search === "") {
      fetchPaymentHistory(0, "");
    }

    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [search]);

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return "Invalid Date";
    }
  };

  const formatAmount = (amount) => {
    if (!amount) return "0.00";
    return parseFloat(amount).toFixed(2);
  };

  const getPaymentTypeBadge = (paymentType) => {
    const type = paymentType?.toLowerCase() || '';
    const badgeClasses = {
      'cash': 'bg-success',
      'bank_transfer': 'bg-primary',
      'cheque': 'bg-warning',
      'credit_card': 'bg-info',
      'online': 'bg-secondary'
    };
    
    const badgeClass = badgeClasses[type] || 'bg-secondary';
    
    return (
      <span className={`badge ${badgeClass} text-white`}>
        {paymentType || 'Unknown'}
      </span>
    );
  };

  const handleBack = () => {
    navigate('/inhouse-accounts/agent');
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          {/* Back Button */}
          <div className="mb-3">
            <Button 
              variant="link" 
              className="p-0 text-decoration-none d-flex align-items-center"
              onClick={handleBack}
            >
              <FaArrowLeft className="me-2" />
              Back to Agent Accounts
            </Button>
          </div>

          {/* Title */}
          <div className="mb-4">
            <h2 className="fw-bold mb-2">Payment History</h2>
            <p className="text-muted mb-1">
              Agent ID: <strong>{id || 'Not found'}</strong>
            </p>
            {console.log("agentInfo:::" ,  agentInfo)}
            {agentInfo && (
              <p className="text-muted mb-0">
                Agent: <strong>{agentInfo.agentName || agentInfo.name || 'Unknown Agent'}</strong>
              </p>
            )}
          </div>

          <Card className="shadow-sm rounded-xl">
            <Card.Header className="d-flex justify-content-between align-items-center">
              <span className="fw-semibold">Payment History</span>
              {/* Search Bar */}
              <Form.Group className="hotel-search-bar">
                <Form.Control
                  type="text"
                  placeholder="Search by payment type or amount..."
                  className="form-control-modern-sm"
                  value={searchTerm}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSearchTerm(value);
                    fetchPaymentHistory(0, value);
                  }}
                />
              </Form.Group>
            </Card.Header>
            <Card.Body className="p-0">
              <Table responsive hover striped className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th style={{ width: 100 }}>S/N</th>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Payment Type</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.id || index}>
                      <td>{index + 1 + page * 10}</td>
                      <td>{formatDate(item.dateOfReceive || item.date)}</td>
                      <td className="fw-bold text-success">
                        ${formatAmount(item.amount)}
                      </td>
                      <td>{getPaymentTypeBadge(item.paymentType)}</td>
                      <td className="text-muted">
                        {item.remarks || 'No remarks'}
                      </td>
                    </tr>
                  ))}
                  {isLoading && (
                    <tr>
                      <td colSpan={5} className="text-center text-muted py-4">
                        <div
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                        >
                          <span className="visually-hidden">Loading...</span>
                        </div>
                        Loading payment history...
                      </td>
                    </tr>
                  )}
                  {items.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan={5} className="text-center text-muted py-4">
                        No payment history found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="d-flex justify-content-between align-items-center p-3 border-top">
                  <div>
                    <small className="text-muted">
                      Showing {items.length} of {totalPages * 10} payments
                    </small>
                  </div>
                  <div>
                    <Pagination className="mb-0">
                      <Pagination.Prev
                        disabled={page === 0}
                        onClick={() => fetchPaymentHistory(page - 1, search)}
                      />
                      {Array.from({ length: totalPages }, (_, i) => (
                        <Pagination.Item
                          key={i}
                          active={i === page}
                          onClick={() => fetchPaymentHistory(i, search)}
                        >
                          {i + 1}
                        </Pagination.Item>
                      ))}
                      <Pagination.Next
                        disabled={page === totalPages - 1}
                        onClick={() => fetchPaymentHistory(page + 1, search)}
                      />
                    </Pagination>
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>
        </main>
      </div>
    </div>
  );
}