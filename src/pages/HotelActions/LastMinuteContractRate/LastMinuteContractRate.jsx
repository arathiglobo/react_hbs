import React, { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  Card,
  Button,
  Table,
  Spinner,
  Badge,
  Form,
  Modal,
} from "react-bootstrap";
import { FaArrowLeft, FaEdit, FaTrash } from "react-icons/fa";
import axiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import Sidebar from "../../../components/Sidebar";
import Topbar from "../../../components/TopBar";
import HotelTitleBadge from "../../../components/HotelTitleBadge";
import Swal from "sweetalert2";

/**
 * LastMinuteContractRate (list page) — mirrors ContractRate.jsx structure.
 * Talks to /api/last-minute-contract-rate (NOT the normal contract rate API).
 */
export default function LastMinuteContractRate() {
  const { id: hotelId } = useParams();
  const navigate = useNavigate();
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");

  // Validity modal (same as ContractRate.jsx pattern)
  const [showValidityModal, setShowValidityModal] = useState(false);
  const [selectedValidityData, setSelectedValidityData] = useState([]);
  const [selectedRateCode, setSelectedRateCode] = useState("");

  const fetchRates = async (pageNum = 0, searchTerm = search) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: pageNum.toString(), limit: "10" });
      if (searchTerm?.trim()) params.append("search", searchTerm.trim());
      const res = await axiosInstance.get(
        `/api/last-minute-contract-rate?${params}&hotelId=${hotelId}`
      );
      setRates(Array.isArray(res.data) ? res.data : []);
      setPage(pageNum);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load last-minute contract rates");
      setRates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hotelId) fetchRates(0, "");
  }, [hotelId]);

  // Debounced search like the original
  useEffect(() => {
    const t = setTimeout(() => fetchRates(0, search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const handleCreate = () =>
    navigate(`/hotel-actions/hotel/${hotelId}/last-minute-contract-rate/create`);
  const handleEdit = (rateId) =>
    navigate(`/hotel-actions/hotel/${hotelId}/last-minute-contract-rate/${rateId}/edit`);

  const handleDelete = async (rateId, rateCode) => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: `Delete last-minute contract rate "${rateCode}"?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Yes, delete it!",
    });
    if (!result.isConfirmed) return;
    try {
      await axiosInstance.delete(`/api/last-minute-contract-rate/${rateId}`);
      toast.success("Deleted");
      fetchRates(page, search);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to delete");
    }
  };

  const handleViewValidity = (validityData, rateCode) => {
    setSelectedValidityData(validityData || []);
    setSelectedRateCode(rateCode);
    setShowValidityModal(true);
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <div className="d-flex align-items-center gap-3 mb-3">
            <Button
              variant="outline-primary"
              onClick={() => navigate(`/hotel-details/${hotelId}`)}
              className="d-flex align-items-center btn-sm gap-2"
            >
              <FaArrowLeft />
              Back
            </Button>
            <h3 className="mb-0">Last Minute Contract Rates</h3>
            <HotelTitleBadge hotelId={hotelId} className="ms-2" />
          </div>

          <Card className="shadow-sm rounded-xl mb-3">
            <Card.Header className="d-flex justify-content-between align-items-center text-white">
              <span className="fw-semibold cursor-pointer text-primary" style={{ padding: "10px" }}>
                Last Minute Contract Rates
              </span>
              <Form.Group className="hotel-search-bar position-relative">
                <Form.Control
                  type="text"
                  placeholder="Search..."
                  className="form-control-modern-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </Form.Group>
              <Button className="btn-green create-btn" onClick={handleCreate}>
                + Create
              </Button>
            </Card.Header>

            <Card.Body className="p-0">
              <Table striped bordered hover responsive className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th style={{ width: 100 }}>S/N</th>
                    <th>Rate Code</th>
                    <th>Days</th>
                    <th>Validity Periods</th>
                    <th>Status</th>
                    <th style={{ width: 160 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} className="text-center py-4"><Spinner animation="border" /></td></tr>
                  ) : rates.length > 0 ? (
                    rates.map((rate, idx) => (
                      <tr key={rate.lastMinuteContractRateId}>
                        <td>{idx + 1 + page * 10}</td>
                        <td>{rate.rateCode || "-"}</td>
                        <td>
                          {rate.allDays ? <span>All Days</span>
                            : rate.weekDay ? <span>Weekdays</span>
                            : rate.weekEndDay ? <span>Weekend</span>
                            : <span>-</span>}
                        </td>
                        <td>
                          {rate.contractRateValidityDTO?.length ? (
                            <Link
                              onClick={() => handleViewValidity(rate.contractRateValidityDTO, rate.rateCode)}
                              className="text-secondary fw-medium text-decoration-underline"
                            >
                              View
                            </Link>
                          ) : (
                            <span className="text-muted">No Validity</span>
                          )}
                        </td>
                        <td>
                          <Badge bg={rate.isLive ? "success" : "danger"}>
                            {rate.isLive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td>
                          <div className="d-flex gap-2">
                            <Button
                              size="sm"
                              variant="outline-primary"
                              className="d-flex align-items-center gap-1"
                              onClick={() => handleEdit(rate.lastMinuteContractRateId)}
                              title="Edit"
                            >
                              <FaEdit /> Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline-danger"
                              className="d-flex align-items-center gap-1"
                              onClick={() => handleDelete(rate.lastMinuteContractRateId, rate.rateCode)}
                              title="Delete"
                            >
                              <FaTrash /> Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={6} className="text-center py-4 text-muted">No last-minute rates yet.</td></tr>
                  )}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </main>
      </div>

      {/* Validity modal */}
      <Modal show={showValidityModal} onHide={() => setShowValidityModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Validity Periods — {selectedRateCode}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedValidityData?.length ? (
            <Table size="sm" bordered>
              <thead><tr><th>#</th><th>From</th><th>To</th></tr></thead>
              <tbody>
                {selectedValidityData.map((v, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{v.validityFrom ? String(v.validityFrom).split("T")[0] : "-"}</td>
                    <td>{v.validityTo ? String(v.validityTo).split("T")[0] : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : <span className="text-muted">No validity periods.</span>}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowValidityModal(false)}>Close</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
