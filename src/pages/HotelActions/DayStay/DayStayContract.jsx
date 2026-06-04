import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Card,
  Button,
  Table,
  Spinner,
  Badge,
  Form,
  Pagination,
  Modal,
} from "react-bootstrap";
import { FaArrowLeft, FaEdit, FaTrash, FaEye } from "react-icons/fa";
import axiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import Sidebar from "../../../components/Sidebar";
import Topbar from "../../../components/TopBar";
import HotelTitleBadge from "../../../components/HotelTitleBadge";
import Swal from "sweetalert2";

/**
 * DayStayContract — list page (mirrors /hotel-actions/{id}/contract-rate).
 * Shows rate code, day selection, validity periods modal, daily window,
 * markup %, status toggle, edit / delete. Uses /api/day-stay-contract.
 */
export default function DayStayContract() {
  const { id } = useParams(); // hotelId
  const navigate = useNavigate();
  const [rates, setRates] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(false);

  const [page, setPage] = useState(0);
  const pageSize = 10;
  const [search, setSearch] = useState("");

  const [showValidityModal, setShowValidityModal] = useState(false);
  const [selectedValidityData, setSelectedValidityData] = useState([]);
  const [selectedRateCode, setSelectedRateCode] = useState("");

  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedRate, setSelectedRate] = useState(null);

  const fetchRates = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(`/api/day-stay-contract?hotelId=${id}`);
      const rows = Array.isArray(res.data) ? res.data : [];
      setRates(rows);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load Day Stay contracts");
      setRates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchRates();
  }, [id]);

  useEffect(() => {
    const q = (search || "").trim().toLowerCase();
    const f = !q
      ? rates
      : rates.filter((r) => (r.rateCode || "").toLowerCase().includes(q));
    setFiltered(f);
    setPage(0);
  }, [search, rates]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageData = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const handleCreate = () =>
    navigate(`/hotel-actions/hotel/${id}/day-stay-contract/create`);
  const handleEdit = (rid) =>
    navigate(`/hotel-actions/hotel/${id}/day-stay-contract/${rid}/edit`);

  const handleViewValidity = (rows, rateCode) => {
    setSelectedValidityData(rows || []);
    setSelectedRateCode(rateCode || "");
    setShowValidityModal(true);
  };

  const handleStatusToggle = (rate) => {
    setSelectedRate(rate);
    setShowStatusModal(true);
  };

  const updateContractStatus = async () => {
    if (!selectedRate) return;
    try {
      setLoading(true);
      const res = await axiosInstance.patch(
        `/api/day-stay-contract/${id}/status/${selectedRate.id}`,
        { isLive: !selectedRate.isLive }
      );
      if (res.data?.status === true || res.data?.status === "true") {
        toast.success("Contract activated");
      } else {
        toast.success("Contract deactivated");
      }
      await fetchRates();
      setShowStatusModal(false);
      setSelectedRate(null);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (rid, rateCode) => {
    const ok = await Swal.fire({
      title: "Are you sure?",
      text: `You want to delete Day Stay contract "${rateCode || ""}"?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
    });
    if (!ok.isConfirmed) return;
    try {
      await axiosInstance.delete(`/api/day-stay-contract/${rid}`);
      toast.success("Deleted");
      fetchRates();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Delete failed");
    }
  };

  const dayLabel = (r) =>
    r.allDays ? "All Days" : r.weekDay ? "Weekdays" : r.weekEndDay ? "Weekend" : "-";

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <div className="d-flex align-items-center gap-3 mb-3">
            <Button
              variant="outline-primary"
              onClick={() => navigate(`/hotel-details/${id}`)}
              className="d-flex align-items-center btn-sm gap-2"
            >
              <FaArrowLeft /> Back
            </Button>
            <h3 className="mb-0">Day Stay Contract Rates</h3>
            <HotelTitleBadge hotelId={id} className="ms-2" />
          </div>

          <Card className="shadow-sm rounded-xl mb-3">
            <Card.Header className="d-flex justify-content-between align-items-center text-white">
              <span
                className="fw-semibold cursor-pointer text-primary"
                style={{ padding: "10px" }}
              >
                Day Stay Contract Rates
              </span>
              <Form.Group className="hotel-search-bar position-relative">
                <Form.Control
                  type="text"
                  placeholder="Search day stay contracts..."
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
                    <th style={{ width: 80 }}>S/N</th>
                    <th>Rate Code</th>
                    <th>Days</th>
                    <th>Daily Window</th>
                    <th>Markup %</th>
                    <th>Validity Periods</th>
                    <th>Status</th>
                    <th style={{ width: 140 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="text-center py-4">
                        <Spinner animation="border" variant="primary" />
                      </td>
                    </tr>
                  ) : pageData.length > 0 ? (
                    pageData.map((r, i) => (
                      <tr key={r.id}>
                        <td>{i + 1 + page * pageSize}</td>
                        <td>{r.rateCode || "-"}</td>
                        <td>{dayLabel(r)}</td>
                        <td>
                          {(r.checkInStartTime || "08:00").slice(0, 5)} –{" "}
                          {(r.checkInEndTime || "17:00").slice(0, 5)}
                        </td>
                        <td>
                          {r.percentage != null
                            ? `${Number(r.percentage).toFixed(2)}%`
                            : "—"}
                        </td>
                        <td>
                          {r.validityList?.length ? (
                            <Link
                              onClick={() =>
                                handleViewValidity(r.validityList, r.rateCode)
                              }
                              className="text-secondary fw-medium text-decoration-underline"
                              style={{ cursor: "pointer" }}
                            >
                              View
                            </Link>
                          ) : (
                            <span className="text-muted">No Validity</span>
                          )}
                        </td>
                        <td>
                          <Badge
                            bg={r.isLive ? "success" : "danger"}
                            style={{ cursor: "pointer" }}
                            onClick={() => handleStatusToggle(r)}
                          >
                            {r.isLive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td>
                          <div className="d-flex gap-2">
                            <FaEdit
                              className="text-primary"
                              style={{ cursor: "pointer", fontSize: 18 }}
                              onClick={() => handleEdit(r.id)}
                              title="Edit"
                            />
                            <FaTrash
                              className="text-danger"
                              style={{ cursor: "pointer", fontSize: 18 }}
                              onClick={() => handleDelete(r.id, r.rateCode)}
                              title="Delete"
                            />
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="text-center text-muted py-4">
                        No Day Stay contracts found
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </Card.Body>
          </Card>

          {totalPages > 1 && (
            <div className="d-flex justify-content-center">
              <Pagination className="mb-0">
                <Pagination.Prev
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                />
                {[...Array(totalPages).keys()].map((n) => (
                  <Pagination.Item
                    key={n}
                    active={n === page}
                    onClick={() => setPage(n)}
                  >
                    {n + 1}
                  </Pagination.Item>
                ))}
                <Pagination.Next
                  disabled={page === totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                />
              </Pagination>
            </div>
          )}

          <Modal show={showValidityModal} onHide={() => setShowValidityModal(false)} centered>
            <Modal.Header closeButton>
              <Modal.Title>Validity Periods - {selectedRateCode}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              {selectedValidityData.length > 0 ? (
                <Table striped bordered hover size="sm">
                  <thead className="table-light">
                    <tr>
                      <th>#</th>
                      <th>From</th>
                      <th>To</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedValidityData.map((v, idx) => (
                      <tr key={v.id || idx}>
                        <td>{idx + 1}</td>
                        <td>{v.validityFrom}</td>
                        <td>{v.validityTo}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <div className="text-center text-muted py-3">
                  <FaEye style={{ fontSize: "2rem", opacity: 0.3 }} />
                  <p className="mb-0 mt-2">No validity periods</p>
                </div>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowValidityModal(false)}>
                Close
              </Button>
            </Modal.Footer>
          </Modal>

          <Modal
            show={showStatusModal}
            onHide={() => setShowStatusModal(false)}
            centered
            size="sm"
            backdrop="static"
            keyboard={false}
          >
            <Modal.Header closeButton={!loading}>
              <Modal.Title>Confirm Status Change</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              Are you sure you want to{" "}
              {selectedRate?.isLive ? "deactivate" : "activate"} this Day Stay contract?
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="secondary"
                onClick={() => setShowStatusModal(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button variant="primary" onClick={updateContractStatus} disabled={loading}>
                {loading ? "Processing..." : "Confirm"}
              </Button>
            </Modal.Footer>
          </Modal>
        </main>
      </div>
    </div>
  );
}
