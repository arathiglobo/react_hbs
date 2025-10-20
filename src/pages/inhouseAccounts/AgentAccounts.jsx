import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  Button,
  Table,
  Modal,
  Form,
  Pagination,
} from "react-bootstrap";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";
import { useNavigate } from "react-router-dom";
import {
  FaPlus,
  FaHistory,
  FaDollarSign,
} from "react-icons/fa";

export default function AgentAccounts() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Form fields for Amount Receive modal
  const [dateOfReceive, setDateOfReceive] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentType, setPaymentType] = useState("");
  const [remarks, setRemarks] = useState("");
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [allAgents, setAllAgents] = useState(null);


  const nextId = useMemo(
    () => Math.max(0, ...items.map((i) => i.id)) + 1,
    [items]
  );

  const openCreate = (agent) => {
    setEditing(null);
    setSelectedAgent(agent);
    setDateOfReceive(new Date().toISOString().split('T')[0]);
    setAmount(agent?.used || "");
    setPaymentType("");
    setRemarks("");
    setError("");
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setSelectedAgent(item);
    setDateOfReceive(item.dateOfReceive || new Date().toISOString().split('T')[0]);
    setAmount(item.amount || "");
    setPaymentType(item.paymentType || "");
    setRemarks(item.remarks || "");
    setError("");
    setShowModal(true);
  };

  const handleEdit = async () => {
    if (!editing) return;

    // Validation
    if (!dateOfReceive) {
      setError("Date of receive is required");
      return;
    }
    if (!amount || amount <= 0) {
      setError("Amount must be greater than 0");
      return;
    }
    if (!paymentType) {
      setError("Payment type is required");
      return;
    }

    try {
      setIsLoading(true);
      setError("");
      const payload = {
        dateOfReceive: dateOfReceive + "T00:00:00",
        amount: parseFloat(amount),
        paymentType: paymentType,
        remarks: remarks,
        agentId: selectedAgent.id,
      };

      const editRes = await axiosInstance.put(
        `/api/inhouseAgentAccounts/${editing.id}`,
        payload
      );

      if (editRes.data) {
        toast.success("Amount Receive Updated Successfully!");
        await fetchAgentAccountsList(page, search);
        closeModal();
      }
    } catch (error) {
      setError("Failed to update amount receive");
      toast.error("Failed to update amount receive");
    } finally {
      setIsLoading(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setSelectedAgent(null);
    setDateOfReceive("");
    setAmount("");
    setPaymentType("");
    setRemarks("");
    setError("");
  };

  const fetchAgentAccountsList = async (pageNum = 0, searchTerm = search) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: "10",
      });

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
      toast.error("Failed to load agent accounts");
      setItems([]);
      setTotalPages(0);
      setPage(0);
    } finally {
      setIsLoading(false);
    }
  };

  const saveAmountReceive = async () => {
    // Validation
    if (!dateOfReceive) {
      setError("Date of receive is required");
      return;
    }
    if (!amount || amount <= 0) {
      setError("Amount must be greater than 0");
      return;
    }
    if (!paymentType) {
      setError("Payment type is required");
      return;
    }

    try {
      setIsLoading(true);
      setError("");
      const payload = {
        dateOfReceive: dateOfReceive + "T00:00:00",
        amount: parseFloat(amount),
        paymentType: paymentType,
        remarks: remarks,
        // agentId: selectedAgent.id,
      };

      console.log(" Payload to save:", payload);
      const saveRes = await axiosInstance.post(
        "/api/inhouseAgentAccounts/save",
        payload
      );

      if (saveRes.data !== 0) {
        toast.success("Amount Receive added Successfully!");
        await fetchAgentAccountsList(page, search);
        closeModal();
      }
    } catch (error) {
      setError("Sorry! Data not saved to db..");
      toast.error("Failed to save amount receive data");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setDateOfReceive(new Date().toISOString().split('T')[0]);
    setAmount(selectedAgent?.used || "");
    setPaymentType("");
    setRemarks("");
    setError("");
  };

  // Debounced search effect
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (search !== "") {
      const timeout = setTimeout(() => {
        fetchAgentAccountsList(0, search);
      }, 500);
      setSearchTimeout(timeout);
    } else if (search === "") {
      fetchAgentAccountsList(0, "");
    }

    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [search]);

  const handleDelete = (item) => {
    Swal.fire({
      title: `Are you sure? You want to delete this amount receive record?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
      customClass: {
        popup: "swal-small",
        title: "swal-small-title",
        htmlContainer: "swal-small-text",
      },
    }).then((result) => {
      if (result.isConfirmed) {
        axiosInstance
          .delete(`/api/inhouseAgentAccounts/${item.id}`)
          .then(() => {
            toast.success("Amount receive record deleted successfully");
            fetchAgentAccountsList(page, search);
          })
          .catch(() => {
            toast.error("Sorry!! Amount receive record not deleted");
          });
      }
    });
  };


  const handlePaymentHistory = (agentId) => {
    navigate(`/inhouse-accounts/agent-payment-history/${agentId}`);
  };

  const handleCurrency = (agentId) => {
    navigate(`/inhouse-accounts/agent-auto-generated-invoice/${agentId}`);
  };

  const calculateAvailable = (creditLimit, used) => {
    return (parseFloat(creditLimit) - parseFloat(used)).toFixed(2);
  };

   const getAgentCreditLimitData = async () => {
    // Validate form before submitting
    
    try {
       
      const packageCategorySaveRes = await axiosInstance.get("/api/agent-credit-limit/agents");
      if (packageCategorySaveRes.data !== null) {
        setAllAgents(packageCategorySaveRes.data);
      }
    } catch (error) {
      setError("Sorry! Data not saved to db..");
    //   toast.error("Failed to save package category data");
    } finally {
    //   setIsLoading(false);
    }
  };

 useEffect(() => {
    fetchAgentAccountsList();
    getAgentCreditLimitData();
  }, []);

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Card className="shadow-sm rounded-xl">
            <Card.Header className="d-flex justify-content-between align-items-center">
              <span className="fw-semibold">Agent Accounts</span>
              {/* Search Bar */}
              <Form.Group className="hotel-search-bar">
                <Form.Control
                  type="text"
                  placeholder="Search agents by name..."
                  className="form-control-modern-sm"
                  value={searchTerm}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSearchTerm(value);
                    fetchAgentAccountsList(0, value);
                  }}
                />
              </Form.Group>
            
            </Card.Header>
            <Card.Body className="p-0">
              <Table responsive hover striped className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th style={{ width: 100 }}>S/N</th>
                    <th>Agent Name</th>
                    <th>Credit Limit</th>
                    <th>Used</th>
                    <th>Available</th>
                    <th style={{ width: 160 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allAgents.map((item, index) => (
                    <tr key={item.id}>
                      <td>{index + 1 + page * 10}</td>
                      <td>{item.agentName}</td>
                      <td>{item.totalCreditLimit}</td>
                      <td>{item.usedCreditLimit}</td>
                      <td>{calculateAvailable(item.totalCreditLimit, item.usedCreditLimit)}</td>
                      <td>
                        <div className="d-flex gap-2">
                          <FaPlus
                            className="text-success"
                            style={{ cursor: "pointer", fontSize: "18px" }}
                            onClick={() => openCreate(item)}
                            title="Add Amount Receive"
                          />
                          <FaHistory
                            className="text-info"
                            style={{ cursor: "pointer", fontSize: "18px" }}
                            onClick={() => handlePaymentHistory(item.id)}
                            title="Payment History"
                          />
                          <FaDollarSign
                            className="text-warning"
                            style={{ cursor: "pointer", fontSize: "18px" }}
                            onClick={() => handleCurrency(item.id)}
                            title="Auto Generated Invoice"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {isLoading && (
                    <tr>
                      <td colSpan={6} className="text-center text-muted py-4">
                        <div
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                        >
                          <span className="visually-hidden">Loading...</span>
                        </div>
                        Loading agent accounts...
                      </td>
                    </tr>
                  )}
                  {items.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan={6} className="text-center text-muted py-4">
                        No agent accounts found.
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
                      Showing {items.length} of {totalPages * 10} agents
                    </small>
                  </div>
                  <div>
                    <Pagination className="mb-0">
                      <Pagination.Prev
                        disabled={page === 0}
                        onClick={() => fetchAgentAccountsList(page - 1, search)}
                      />
                      {Array.from({ length: totalPages }, (_, i) => (
                        <Pagination.Item
                          key={i}
                          active={i === page}
                          onClick={() => fetchAgentAccountsList(i, search)}
                        >
                          {i + 1}
                        </Pagination.Item>
                      ))}
                      <Pagination.Next
                        disabled={page === totalPages - 1}
                        onClick={() => fetchAgentAccountsList(page + 1, search)}
                      />
                    </Pagination>
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>

          {/* Amount Receive Modal */}
          <Modal show={showModal} onHide={closeModal} centered>
            <Modal.Header closeButton={!isLoading}>
              <Modal.Title>
                {editing ? "Update Amount Receive" : "Create Amount Receive"}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form>
                <Form.Group className="mb-3">
                  <Form.Label>Date of Receive</Form.Label>
                  <Form.Control
                    type="date"
                    value={dateOfReceive}
                    onChange={(e) => setDateOfReceive(e.target.value)}
                    autoFocus
                    isInvalid={!!error && !dateOfReceive}
                  />
                  {error && !dateOfReceive && (
                    <Form.Control.Feedback type="invalid">
                      {error}
                    </Form.Control.Feedback>
                  )}
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Amount</Form.Label>
                  <Form.Control
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Enter amount"
                    isInvalid={!!error && (!amount || amount <= 0)}
                  />
                  {error && (!amount || amount <= 0) && (
                    <Form.Control.Feedback type="invalid">
                      {error}
                    </Form.Control.Feedback>
                  )}
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Payment Type</Form.Label>
                  <Form.Select
                    value={paymentType}
                    onChange={(e) => setPaymentType(e.target.value)}
                    isInvalid={!!error && !paymentType}
                  >
                    <option value="">SELECT</option>
                    <option value="CASH">Cash</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="CREDIT_CARD">Credit Card</option>
                    <option value="ONLINE">Online Payment</option>
                  </Form.Select>
                  {error && !paymentType && (
                    <Form.Control.Feedback type="invalid">
                      {error}
                    </Form.Control.Feedback>
                  )}
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Remarks</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Enter remarks (optional)"
                  />
                </Form.Group>
              </Form>
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="secondary"
                onClick={closeModal}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                className="btn-indigo"
                onClick={editing ? handleEdit : saveAmountReceive}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    ></span>
                    {editing ? "Updating..." : "Saving..."}
                  </>
                ) : editing ? (
                  "Update"
                ) : (
                  "Save"
                )}
              </Button>
            </Modal.Footer>
          </Modal>
        </main>
      </div>
    </div>
  );
}