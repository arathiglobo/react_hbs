import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Container,
  Table,
  Button,
  Spinner,
  Badge,
  Card,
} from "react-bootstrap";
import { FaArrowLeft, FaPlus, FaEdit, FaTrash } from "react-icons/fa";
import axiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import Sidebar from "../../../components/Sidebar";
import Topbar from "../../../components/TopBar";

const Policy = () => {
  const { id } = useParams(); // Hotel ID
  const navigate = useNavigate();

  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(false);

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
  const handleDelete = async (policyId) => {
    if (!window.confirm("Are you sure you want to delete this policy?")) return;
    try {
      await axiosInstance.delete(`/api/policies/${policyId}`);
      toast.success("Deleted successfully");
      fetchPolicies();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete");
    }
  };

  // ✅ Navigate to Create or Edit
  const handleCreate = () => navigate(`/hotel-actions/${id}/hotel-policy/create`); 
  const handleEdit = (policyId) =>
     navigate(`/hotel-actions/${id}/hotel-policy/${policyId}/edit`);

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Container fluid>
            {/* Header Section */}
            <div className="d-flex justify-content-between align-items-center mb-4">
              <Button
                variant="link"
                className="text-decoration-none"
                onClick={() => navigate(-1)}
              >
                <FaArrowLeft /> Back
              </Button>
              <h4 className="fw-semibold mb-0 text-primary">Hotel Policy</h4>
              <Button variant="primary" onClick={handleCreate}>
                <FaPlus /> Create
              </Button>
            </div>

            {/* Table */}
            <Card className="shadow-sm border-0">
              <Card.Header className="bg-primary text-white fw-semibold">
                List of policies
              </Card.Header>

              <Card.Body>
                {loading ? (
                  <div className="text-center py-5">
                    <Spinner animation="border" variant="primary" />
                    <p className="mt-2 text-muted">Loading policies...</p>
                  </div>
                ) : (
                  <Table responsive bordered hover className="align-middle">
                    <thead className="table-light">
                      <tr>
                        <th style={{ width: "60px" }}>S.N</th>
                        <th>Policy Code</th>
                        <th>Market Type</th>
                        <th>Status</th>
                        <th style={{ width: "150px" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {policies.length > 0 ? (
                        policies.map((policy, index) => (
                          <tr key={policy.policyId}>
                            <td>{index + 1}</td>
                            <td>{policy.policyCode || "—"}</td>
                            <td>
                              {Array.isArray(policy.marketTypeId)
                                ? "All Market"
                                : "—"}
                            </td>
                            <td>
                              <Badge
                                bg={policy.live ? "success" : "secondary"}
                                className="px-3 py-2"
                              >
                                {policy.live ? "Active" : "Inactive"}
                              </Badge>
                            </td>
                            <td>
                              <Button
                                size="sm"
                                variant="outline-warning"
                                className="me-2"
                                onClick={() => handleEdit(policy.policyId)}
                              >
                                <FaEdit />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline-danger"
                                onClick={() => handleDelete(policy.policyId)}
                              >
                                <FaTrash />
                              </Button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="text-center text-muted py-4">
                            No policies found for this hotel
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                )}
              </Card.Body>
            </Card>
          </Container>
        </main>
      </div>
    </div>
  );
};

export default Policy;



