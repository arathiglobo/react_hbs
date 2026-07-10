import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Card,
  Button,
  Table,
  Spinner,
  Badge,
  Form,
  Modal,
  Pagination,
  Row,
  Col,
} from "react-bootstrap";
import { FaArrowLeft, FaEdit, FaTrash, FaEye } from "react-icons/fa";
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

  // Status-toggle modal state — mirrors the /contract-rate pattern:
  // clicking the Active/Inactive badge opens a small confirmation
  // modal that PATCHes /status only after the operator confirms.
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedContract, setSelectedContract] = useState(null);
  const [statusUpdating, setStatusUpdating] = useState(false);

  // View — reuses the existing edit page in read-only mode. Mirrors the
  // /occupancy-and-minimumlength view pattern.
  const handleView = (contractId) =>
    navigate(`/hotel-actions/hotel/${id}/long-stay-contract/${contractId}/edit?mode=view`);

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

  // Open the confirm modal for the row whose badge was clicked.
  // Same two-step UX as /contract-rate — avoids accidental flips.
  const handleStatusToggle = (contract) => {
    setSelectedContract(contract);
    setShowStatusModal(true);
  };

  // Actually flip the status — fires only after the operator confirms.
  // Backend endpoint is unchanged (PATCH /status?isLive=...).
  const updateContractStatus = async () => {
    if (!selectedContract) return;
    try {
      setStatusUpdating(true);
      await axiosInstance.patch(
        `/api/longStayContract/${selectedContract.longStayContractId}/status?isLive=${!selectedContract.isLive}`
      );
      toast.success(
        selectedContract.isLive
          ? "Long Stay contract deactivated"
          : "Long Stay contract activated"
      );
      await fetchContracts(page);
      setShowStatusModal(false);
      setSelectedContract(null);
    } catch (err) {
      console.error("Status toggle failed:", err);
      toast.error(
        err?.response?.data?.message ||
          "Failed to update Long Stay contract status"
      );
    } finally {
      setStatusUpdating(false);
    }
  };

  const filtered = contracts.filter((c) => {
    const searchTerm = search.trim().toLowerCase();
    if (!searchTerm) return true;

    // Rate Code Match
    const rateCodeMatch = (c.rateCode || "").toLowerCase().includes(searchTerm);

    // Cost Type Match
    const rawCostType = (c.additionalCostType || "").toUpperCase();
    const costTypeStr = rawCostType === "WEEKLY"
      ? "weekly"
      : (rawCostType === "PRO_RATE" || rawCostType === "PRORATE" ? "pro-rate prorate" : "day-wise daywise");
    const costTypeMatch = costTypeStr.includes(searchTerm);

    // Status Match — prevent 'active' from matching 'inactive'
    let statusMatch = false;
    if ("active".includes(searchTerm) && !searchTerm.startsWith("in")) {
      statusMatch = c.isLive;
    } else if ("inactive".includes(searchTerm) && searchTerm.startsWith("in")) {
      statusMatch = !c.isLive;
    }

    return rateCodeMatch || costTypeMatch || statusMatch;
  });

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4" style={{ minWidth: 0, overflowX: "hidden" }}>
          {/* Page header — mirrors LastMinuteContractRate. The Back
              button + h3 title sit above the card; HotelTitleBadge is
              kept so the hotel context the original page surfaced
              isn't lost. */}
          <div className="d-flex align-items-center gap-3 mb-3">
            <Button
              variant="outline-primary"
              onClick={() => navigate(`/hotel-details/${id}`)}
              className="d-flex align-items-center btn-sm gap-2"
            >
              <FaArrowLeft />
              Back
            </Button>
            <h3 className="mb-0">Long Stay</h3>
            <HotelTitleBadge hotelId={id} className="ms-2" />
          </div>

          <Card className="shadow-sm rounded-xl mb-3">
            <Card.Header className="d-flex justify-content-between align-items-center text-white">
              <span
                className="fw-semibold cursor-pointer text-primary"
                style={{ padding: "10px" }}
              >
                Long Stay Contracts
              </span>
              <Form.Group className="hotel-search-bar position-relative">
                <Form.Control
                  type="search"
                  placeholder="Search by rate code, cost type, status..."
                  className="form-control-modern-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </Form.Group>
              <Button
                className="btn-green create-btn"
                onClick={() =>
                  navigate(`/hotel-actions/hotel/${id}/long-stay-contract/create`)
                }
              >
                + Create
              </Button>
            </Card.Header>

            <Card.Body className="p-0">
              <Table
                striped
                bordered
                hover
                responsive
                className="mb-0 align-middle"
              >
                <thead>
                  <tr>
                    <th style={{ width: 100 }}>S/N</th>
                    <th>Rate Code</th>
                    <th>Cost Type</th>
                    <th>Validity</th>
                    <th>Status</th>
                    <th style={{ width: 230 }}>Actions</th>
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
                          {/* Clickable Active/Inactive badge — opens
                              the confirm modal, then PATCHes /status.
                              Mirrors /contract-rate's two-step flow so
                              accidental clicks don't flip the flag. */}
                          <Badge
                            bg={c.isLive ? "success" : "danger"}
                            style={{ cursor: "pointer" }}
                            onClick={() => handleStatusToggle(c)}
                            title={`Click to ${
                              c.isLive ? "deactivate" : "activate"
                            } Long Stay contract`}
                          >
                            {c.isLive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td>
                          <div className="d-flex gap-2">
                            <Button
                              size="sm"
                              variant="outline-info"
                              className="d-flex align-items-center gap-1"
                              onClick={() => handleView(c.longStayContractId)}
                              title="View"
                            >
                              <FaEye /> View
                            </Button>
                            <Button
                              size="sm"
                              variant="outline-primary"
                              className="d-flex align-items-center gap-1"
                              onClick={() =>
                                navigate(
                                  `/hotel-actions/hotel/${id}/long-stay-contract/${c.longStayContractId}/edit`
                                )
                              }
                              title="Edit"
                            >
                              <FaEdit /> Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline-danger"
                              className="d-flex align-items-center gap-1"
                              onClick={() =>
                                handleDelete(c.longStayContractId, c.rateCode)
                              }
                              title="Delete"
                            >
                              <FaTrash /> Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>

              {totalPages > 1 && (
                <Pagination className="justify-content-center m-3">
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

          {/* Status-toggle confirmation modal — mirrors /contract-rate.
              Asks the operator to confirm, then PATCHes the new isLive
              value via updateContractStatus(). */}
          <Modal
            show={showStatusModal}
            onHide={() => setShowStatusModal(false)}
            centered
            size="sm"
            backdrop="static"
            keyboard={false}
          >
            <Modal.Header closeButton={!statusUpdating}>
              <Modal.Title>Confirm Status Change</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <p>
                Are you sure you want to{" "}
                {selectedContract?.isLive ? "deactivate" : "activate"} this
                Long Stay contract?
              </p>
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="secondary"
                onClick={() => setShowStatusModal(false)}
                disabled={statusUpdating}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={updateContractStatus}
                disabled={statusUpdating}
              >
                {statusUpdating ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    ></span>
                    Processing...
                  </>
                ) : (
                  "Confirm"
                )}
              </Button>
            </Modal.Footer>
          </Modal>
        </main>
      </div>
    </div>
  );
}
