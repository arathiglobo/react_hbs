import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Container,
  Table,
  Button,
  Spinner,
  Badge,
  Card,
  Pagination,
  Modal,
  Form,
} from "react-bootstrap";
import { FaArrowLeft, FaPlus, FaEdit, FaTrash } from "react-icons/fa";
import axiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import Sidebar from "../../../components/Sidebar";
import Topbar from "../../../components/TopBar";
import Swal from "sweetalert2";

const Policy = () => {
  const { id } = useParams(); // Hotel ID
  const navigate = useNavigate();

  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showValidityModal, setShowValidityModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // ✅ Fetch hotel policies
  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(
        `/api/hotelPolicy?page=0&limit=20`
      );

      console.log("📦 API Response:", res.data);

      // ✅ Handle array or paginated response
      const allPolicies = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data.data)
        ? res.data.data
        : [];

      // ✅ Filter by current hotelId
      const filteredPolicies = allPolicies.filter(
        (p) => String(p.hotelId) === String(id)
      );

      console.log("🏨 Filtered Policies for Hotel", id, filteredPolicies);
      setPolicies(filteredPolicies);
    } catch (error) {
      console.error("Error fetching policies:", error);
      toast.error("Failed to load hotel policies");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, [id]);

  // ✅ Delete policy
  const handleDelete = (policy) => {
    Swal.fire({
      title: `Are you sure? You want to delete policy ${policy.policyCode}?`,
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
          .delete(`/api/policies/${policy.policyId}`)
          .then(() => {
            toast.success("Policy deleted successfully");
            fetchPolicies();
          })
          .catch((error) => {
            console.error("❌ Delete Error:", error.response || error);
            toast.error("Failed to delete policy");
          });
      }
    });
  };

  // ✅ Handle status toggle
  const handleStatusToggle = (policy) => {
    setSelectedPolicy(policy);
    setShowStatusModal(true);
  };

  // ✅ Update policy status
  const updatePolicyStatus = async () => {
    if (!selectedPolicy) return;

    try {
      const payload = {
        isLive: !selectedPolicy.live,
      };

     const policyStatusRes = await axiosInstance.patch(`/api/hotelPolicy/${id}/statusUpdate/${selectedPolicy.policyId}`, payload);
     console.log("policyStatusRes:::" , policyStatusRes);
          
     if(policyStatusRes.data.live === true){
      toast.success("Policy activated successfully");
     }else{
      toast.success("Policy deactivated successfully");
     }
     
      fetchPolicies();
      setShowStatusModal(false);
    } catch (error) {
      console.error("❌ Status Update Error:", error.response || error);
      toast.error("Failed to update policy status");
    }
  };

  // ✅ Navigate to Create Policy
  const handleCreate = () => {
    navigate(`/hotel-actions/${id}/hotel-policy/create`);
  };

  // ✅ Filter + Pagination
  const filteredPolicies = policies.filter(
    (p) =>
      p.policyCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.policyType?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredPolicies.length / itemsPerPage);
  const currentData = filteredPolicies.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  // ✅ Navigate to Edit
  const handleEdit = (policyId) =>
     navigate(`/hotel-actions/${id}/hotel-policy/${policyId}/edit`);

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Card className="shadow-sm rounded-xl">
            {/* Header */}
            <Card.Header className="d-flex justify-content-between align-items-center py-3">
              <div className="d-flex align-items-center gap-3">
                <Button
                  variant="outline-primary"
                  onClick={() => navigate(`/hotel-details/${id}`)}
                  className="d-flex align-items-center btn-sm gap-2"
                >
                  <FaArrowLeft />
                  Back
                </Button>
                <div className="fw-semibold fs-4 text-dark">
                  Policies
                </div>
              </div>
              <div className="d-flex align-items-center justify-content-between w-100">
                {/* Centered search bar */}
                <div className="d-flex justify-content-center flex-grow-1">
                  <div className="position-relative" style={{ width: "260px" }}>
                    <Form.Control
                      type="text"
                      placeholder="Search policy..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="border-0 bg-light"
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        className="btn btn-link position-absolute top-50 end-0 translate-middle-y"
                        style={{
                          border: "none",
                          background: "none",
                          color: "#6c757d",
                          padding: "0 12px",
                          zIndex: 10,
                        }}
                        onClick={() => {
                          setSearchTerm("");
                          setCurrentPage(1);
                        }}
                        title="Clear search"
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    )}
                  </div>
                </div>

                {/* Create button on the right */}
                <Button
                  className="ms-3"
                  style={{ backgroundColor: "#28a745", borderColor: "#28a745" }}
                  onClick={handleCreate}
                >
                  + Create
                </Button>
              </div>
            </Card.Header>

            {/* Table */}
            <Card.Body className="p-0">
              <Table responsive hover striped className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th style={{ width: 70 }}>S/N</th>
                    <th>POLICY CODE</th>
                    <th>MARKET TYPE</th>
                    <th>STATUS</th>
                    <th style={{ width: 160 }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {currentData.length > 0 ? (
                    currentData.map((policy, index) => (
                      <tr key={policy.policyId}>
                        <td>{(currentPage - 1) * itemsPerPage + index + 1}</td>
                        <td>{policy.policyCode || "—"}</td>
                        <td>
                          {Array.isArray(policy.marketTypeId)
                            ? "All Market"
                            : "—"}
                        </td>
                        <td>
                          <Badge 
                            bg={policy.live ? "success" : "danger"}
                            style={{ cursor: "pointer" }}
                            onClick={() => handleStatusToggle(policy)}
                            title={`Click to ${policy.live ? 'deactivate' : 'activate'} policy`}
                          >
                            {policy.live ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td>
                          <div className="d-flex gap-3 justify-content-center">
                            <FaEdit
                              className="text-warning"
                              style={{ cursor: "pointer", fontSize: "18px" }}
                              onClick={() => handleEdit(policy.policyId)}
                              title="Edit"
                            />

                            <FaTrash
                              className="text-danger"
                              style={{ cursor: "pointer", fontSize: "18px" }}
                              onClick={() => handleDelete(policy)}
                              title="Delete"
                            />
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : loading ? (
                    <tr>
                      <td colSpan={7} className="text-center text-muted py-4">
                        <div
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                        ></div>
                        Loading policies...
                      </td>
                    </tr>
                  ) : (
                    <tr>
                      <td colSpan={7} className="text-center text-muted py-4">
                        No policies found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>

              {/* Pagination */}
              {filteredPolicies.length > itemsPerPage && (
                <div className="d-flex justify-content-between align-items-center p-3 border-top bg-white">
                  <div>
                    <small className="text-muted">
                      Showing{" "}
                      <strong>{(currentPage - 1) * itemsPerPage + 1}</strong> to{" "}
                      <strong>
                        {Math.min(
                          currentPage * itemsPerPage,
                          filteredPolicies.length
                        )}
                      </strong>{" "}
                      of <strong>{filteredPolicies.length}</strong> policies
                    </small>
                  </div>
                  <Pagination className="mb-0">
                    <Pagination.Prev
                      disabled={currentPage === 1}
                      onClick={() => handlePageChange(currentPage - 1)}
                    />
                    {[...Array(totalPages)].map((_, i) => (
                      <Pagination.Item
                        key={i}
                        active={currentPage === i + 1}
                        onClick={() => handlePageChange(i + 1)}
                      >
                        {i + 1}
                      </Pagination.Item>
                    ))}
                    <Pagination.Next
                      disabled={currentPage === totalPages}
                      onClick={() => handlePageChange(currentPage + 1)}
                    />
                  </Pagination>
                </div>
              )}
            </Card.Body>
          </Card>


          {/* ✅ Validity Modal */}
          <Modal
            show={showValidityModal}
            onHide={() => setShowValidityModal(false)}
            centered
            size="lg"
          >
            <Modal.Header className="bg-primary text-white" closeButton>
              <Modal.Title>Policy Details</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              {selectedPolicy ? (
                <div>
                  <h6 className="fw-bold text-primary mb-3">Policy Information</h6>
                  <Table bordered responsive>
                    <tbody>
                      <tr>
                        <td className="fw-semibold">Policy Code:</td>
                        <td>{selectedPolicy.policyCode || "—"}</td>
                      </tr>
                      <tr>
                        <td className="fw-semibold">Policy Type:</td>
                        <td>{selectedPolicy.policyType || "—"}</td>
                      </tr>
                      <tr>
                        <td className="fw-semibold">Market Type:</td>
                        <td>
                          {Array.isArray(selectedPolicy.marketTypeId)
                            ? "All Market"
                            : "—"}
                        </td>
                      </tr>
                      <tr>
                        <td className="fw-semibold">Status:</td>
                        <td>
                          <Badge bg={selectedPolicy.live ? "success" : "secondary"}>
                            {selectedPolicy.live ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                      </tr>
                    </tbody>
                  </Table>

                  {selectedPolicy.policyDescription && (
                    <>
                      <h6 className="fw-bold text-primary mt-4 mb-2">Description</h6>
                      <p className="text-muted">{selectedPolicy.policyDescription}</p>
                    </>
                  )}

                  {selectedPolicy.termsAndConditions && (
                    <>
                      <h6 className="fw-bold text-primary mt-4 mb-2">Terms & Conditions</h6>
                      <p className="text-muted">{selectedPolicy.termsAndConditions}</p>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-muted text-center">
                  No policy details available.
                </p>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="secondary"
                onClick={() => setShowValidityModal(false)}
              >
                Close
              </Button>
            </Modal.Footer>
          </Modal>

          {/* ✅ Status Toggle Modal */}
          <Modal
            show={showStatusModal}
            onHide={() => setShowStatusModal(false)}
            centered
            size="sm"
          >
            <Modal.Header className="bg-warning text-dark">
              <Modal.Title>Update Policy Status</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              {selectedPolicy && (
                <div className="text-center">
                  <p className="mb-3">
                    Are you sure you want to{" "}
                    <strong className={selectedPolicy.live ? "text-danger" : "text-success"}>
                      {selectedPolicy.live ? "deactivate" : "activate"}
                    </strong>{" "}
                    this policy?
                  </p>
                </div>
              )}
            </Modal.Body>
            <Modal.Footer className="justify-content-between">
              <Button 
                variant="secondary" 
                onClick={() => setShowStatusModal(false)}
              >
                Cancel
              </Button>
              <Button 
                variant={selectedPolicy?.live ? "danger" : "success"}
                onClick={updatePolicyStatus}
              >
                {selectedPolicy?.live ? "Deactivate" : "Activate"}
              </Button>
            </Modal.Footer>
          </Modal>
        </main>
      </div>
    </div>
  );
};

export default Policy;



