import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Card,
  Button,
  Table,
  Spinner,
  Badge,
  Form,
  Pagination,
} from "react-bootstrap";
import { FaArrowLeft, FaPlus, FaEdit, FaTrash } from "react-icons/fa";
import axiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";
import Sidebar from "../../../components/Sidebar";
import Topbar from "../../../components/TopBar";
import HotelTitleBadge from "../../../components/HotelTitleBadge";

export default function LongStayContract() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");

  const fetchContracts = async (pageNum = 0) => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(
        `/api/longStayContract?page=${pageNum}&size=10&hotelId=${id}`
      );
      const data = res.data;
      setContracts(data.content || []);
      setTotalPages(data.totalPages || 0);
      setPage(data.number || 0);
    } catch (err) {
      toast.error("Failed to load Long Stay Contracts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContracts(0);
  }, [id]);

  const handleDelete = async (contractId, rateCode) => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: `Delete Long Stay contract "${rateCode}"?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Yes, delete",
    });
    if (!result.isConfirmed) return;
    try {
      await axiosInstance.delete(`/api/longStayContract/${contractId}`);
      toast.success("Long Stay Contract deleted");
      fetchContracts(page);
    } catch {
      toast.error("Failed to delete contract");
    }
  };

  const handleStatusToggle = async (contract) => {
    try {
      await axiosInstance.patch(
        `/api/longStayContract/${contract.longStayContractId}/status?isLive=${!contract.isLive}`
      );
      toast.success("Status updated");
      fetchContracts(page);
    } catch {
      toast.error("Failed to update status");
    }
  };

  const filtered = contracts.filter((c) =>
    (c.rateCode || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-3" style={{ minWidth: 0, overflowX: "hidden" }}>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <Button variant="outline-secondary" onClick={() => navigate(-1)}>
              <FaArrowLeft className="me-2" />
              Back
            </Button>
            <h4 className="m-0">Long Stay Contracts</h4>
            <HotelTitleBadge hotelId={id} className="ms-2" />
            <Button
              variant="success"
              onClick={() =>
                navigate(`/hotel-actions/hotel/${id}/long-stay-contract/create`)
              }
            >
              <FaPlus className="me-2" />
              Create Long Stay
            </Button>
          </div>

          <Card>
            <Card.Body>
              <Form.Control
                type="search"
                placeholder="Search by rate code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mb-3"
              />
              <Table bordered hover responsive>
                <thead className="table-light">
                  <tr>
                    <th style={{ width: 80 }}>S/N</th>
                    <th>Rate Code</th>
                    <th>Cost Type</th>
                    <th>Validity</th>
                    <th>Status</th>
                    <th style={{ width: 160 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-4">
                        <Spinner animation="border" variant="primary" />
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center text-muted py-4">
                        No Long Stay contracts found
                      </td>
                    </tr>
                  ) : (
                    filtered.map((c, idx) => (
                      <tr key={c.longStayContractId}>
                        <td>{idx + 1 + page * 10}</td>
                        <td>{c.rateCode}</td>
                        <td>
                          {/* Cost-type badge — colour-coded so an ops
                              user can scan the list at a glance. */}
                          {(() => {
                            const ct = (c.additionalCostType || "")
                              .toUpperCase();
                            if (ct === "WEEKLY")
                              return <Badge bg="info">Weekly</Badge>;
                            if (ct === "PRO_RATE" || ct === "PRORATE")
                              return <Badge bg="warning" text="dark">Pro-rate</Badge>;
                            return <Badge bg="secondary">Day-wise</Badge>;
                          })()}
                        </td>
                        <td>
                          {c.validityFrom} → {c.validityTo}
                        </td>
                        <td>
                          <Form.Check
                            type="switch"
                            checked={Boolean(c.isLive)}
                            onChange={() => handleStatusToggle(c)}
                            label={c.isLive ? "Active" : "Inactive"}
                          />
                        </td>
                        <td>
                          <Button
                            size="sm"
                            variant="outline-primary"
                            className="me-2"
                            onClick={() =>
                              navigate(
                                `/hotel-actions/hotel/${id}/long-stay-contract/${c.longStayContractId}/edit`
                              )
                            }
                          >
                            <FaEdit />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline-danger"
                            onClick={() =>
                              handleDelete(c.longStayContractId, c.rateCode)
                            }
                          >
                            <FaTrash />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>

              {totalPages > 1 && (
                <Pagination className="justify-content-center">
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <Pagination.Item
                      key={i}
                      active={i === page}
                      onClick={() => fetchContracts(i)}
                    >
                      {i + 1}
                    </Pagination.Item>
                  ))}
                </Pagination>
              )}
            </Card.Body>
          </Card>
        </main>
      </div>
    </div>
  );
}
