/**
 * StudentDiscountPromotion.jsx
 *
 * Per-hotel "Student Discount" CRUD page. Opened from the
 * hotel-details (/hotel-details/:id) action grid — next to the
 * Contract Rate / Promotion / Government Employee Discount cards.
 *
 * Endpoints:
 *   GET    /api/hotel-student-discount-promotion/hotel/{hotelId}
 *   POST   /api/hotel-student-discount-promotion
 *   PUT    /api/hotel-student-discount-promotion/{id}
 *   DELETE /api/hotel-student-discount-promotion/{id}
 */

import React, { useEffect, useState } from "react";
import { Card, Row, Col, Button, Table, Form, Modal, Spinner, Badge } from "react-bootstrap";
import { FaEdit, FaTrash, FaArrowLeft, FaGraduationCap } from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import Sidebar from "../../../components/Sidebar";
import TopBar from "../../../components/TopBar";
import HotelTitleBadge from "../../../components/HotelTitleBadge";
import axiosInstance from "../../../components/AxiosInstance";

const EMPTY_FORM = {
  discountPercent: "",
  discountAmount: "",
  validFrom: "",
  validTo: "",
  description: "",
  active: true,
};

export default function StudentDiscountPromotion() {
  const { id: hotelId } = useParams();
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  // Status-toggle modal state — mirrors the ContractRate pattern.
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const { data } = await axiosInstance.get(`/api/hotel-student-discount-promotion/hotel/${hotelId}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error("Failed to load promotions");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (hotelId) fetchAll();
    // eslint-disable-next-line
  }, [hotelId]);

  const openCreate = () => { setEditingId(null); setForm(EMPTY_FORM); setShowModal(true); };
  const openEdit = (row) => {
    setEditingId(row.promotionId);
    setForm({
      discountPercent: row.discountPercent ?? "",
      discountAmount: row.discountAmount ?? "",
      validFrom: row.validFrom || "",
      validTo: row.validTo || "",
      description: row.description || "",
      active: row.active !== false,
    });
    setShowModal(true);
  };
  const handleChange = (f, v) => setForm((s) => ({ ...s, [f]: v }));

  const handleSave = async () => {
    if (!form.discountPercent && !form.discountAmount) {
      toast.error("Specify a discount percent or a flat amount");
      return;
    }
    try {
      const payload = {
        hotelId: Number(hotelId),
        discountPercent: form.discountPercent ? Number(form.discountPercent) : null,
        discountAmount: form.discountAmount ? Number(form.discountAmount) : null,
        validFrom: form.validFrom || null,
        validTo: form.validTo || null,
        description: form.description || null,
        active: !!form.active,
      };
      if (editingId) {
        await axiosInstance.put(`/api/hotel-student-discount-promotion/${editingId}`, payload);
        toast.success("Updated");
      } else {
        await axiosInstance.post(`/api/hotel-student-discount-promotion`, payload);
        toast.success("Created");
      }
      setShowModal(false);
      fetchAll();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Save failed");
    }
  };

  // Open the confirm modal for the row whose badge was clicked.
  const handleStatusToggle = (row) => {
    setSelectedRow(row);
    setShowStatusModal(true);
  };

  // PATCH the flipped active value, refresh the list, close the modal.
  const updateRowStatus = async () => {
    if (!selectedRow) return;
    try {
      setStatusUpdating(true);
      await axiosInstance.patch(
        `/api/hotel-student-discount-promotion/${selectedRow.promotionId}/status`,
        { active: !selectedRow.active }
      );
      toast.success(
        selectedRow.active
          ? "Student discount deactivated"
          : "Student discount activated"
      );
      await fetchAll();
      setShowStatusModal(false);
      setSelectedRow(null);
    } catch (err) {
      console.error("Status toggle failed:", err);
      toast.error(
        err?.response?.data?.message ||
          "Failed to update student-discount status"
      );
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this promotion?")) return;
    try {
      await axiosInstance.delete(`/api/hotel-student-discount-promotion/${id}`);
      toast.success("Deleted");
      fetchAll();
    } catch (e) {
      toast.error("Delete failed");
    }
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          {/* Page header — mirrors LastMinuteContractRate. The
              FaGraduationCap accent is kept beside the h3 to preserve
              the page's visual identity. */}
          <div className="d-flex align-items-center gap-3 mb-3">
            <Button
              variant="outline-primary"
              onClick={() => navigate(`/hotel-details/${hotelId}`)}
              className="d-flex align-items-center btn-sm gap-2"
            >
              <FaArrowLeft />
              Back
            </Button>
            <h3 className="mb-0 d-flex align-items-center">
              <FaGraduationCap className="me-2 text-primary" />
              Student Discount
            </h3>
            <HotelTitleBadge hotelId={hotelId} className="ms-2" />
          </div>

          <Card className="shadow-sm rounded-xl mb-3">
            <Card.Header className="d-flex justify-content-between align-items-center text-white">
              <span
                className="fw-semibold cursor-pointer text-primary"
                style={{ padding: "10px" }}
              >
                Student Discount
              </span>
              <Button className="btn-green create-btn" onClick={openCreate}>
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
                    <th>Discount %</th>
                    <th>Discount Amount</th>
                    <th>Valid From</th>
                    <th>Valid To</th>
                    <th>Description</th>
                    <th>Status</th>
                    <th style={{ width: 160 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="text-center py-4">
                        <Spinner animation="border" />
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="text-center text-muted py-4"
                      >
                        No student discount configured yet.
                      </td>
                    </tr>
                  ) : (
                    rows.map((r, i) => (
                      <tr key={r.promotionId}>
                        <td>{i + 1}</td>
                        <td>{r.discountPercent ?? "-"}</td>
                        <td>{r.discountAmount ?? "-"}</td>
                        <td>{r.validFrom || "-"}</td>
                        <td>{r.validTo || "-"}</td>
                        <td>{r.description || "-"}</td>
                        <td>
                          {/* Clickable Active/Inactive badge — opens
                              the confirm modal then PATCHes /status.
                              Mirrors /contract-rate. */}
                          <Badge
                            bg={r.active ? "success" : "danger"}
                            style={{ cursor: "pointer" }}
                            onClick={() => handleStatusToggle(r)}
                            title={`Click to ${
                              r.active ? "deactivate" : "activate"
                            } promotion`}
                          >
                            {r.active ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td>
                          <div className="d-flex gap-2">
                            <Button
                              size="sm"
                              variant="outline-primary"
                              className="d-flex align-items-center gap-1"
                              onClick={() => openEdit(r)}
                              title="Edit"
                            >
                              <FaEdit /> Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline-danger"
                              className="d-flex align-items-center gap-1"
                              onClick={() => handleDelete(r.promotionId)}
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
            </Card.Body>
          </Card>
        </main>
      </div>

      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{editingId ? "Edit" : "Add"} Student Discount</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Row className="g-3">
            <Col md={6}>
              <Form.Label>Discount %</Form.Label>
              <Form.Control type="number" min="0" max="100" step="0.01"
                            value={form.discountPercent}
                            onChange={(e) => handleChange("discountPercent", e.target.value)} />
            </Col>
            <Col md={6}>
              <Form.Label>Discount Amount (flat)</Form.Label>
              <Form.Control type="number" min="0" step="0.01"
                            value={form.discountAmount}
                            onChange={(e) => handleChange("discountAmount", e.target.value)} />
            </Col>
            <Col md={6}>
              <Form.Label>Valid From</Form.Label>
              <Form.Control type="date" value={form.validFrom}
                            onChange={(e) => handleChange("validFrom", e.target.value)} />
            </Col>
            <Col md={6}>
              <Form.Label>Valid To</Form.Label>
              <Form.Control type="date" value={form.validTo}
                            onChange={(e) => handleChange("validTo", e.target.value)} />
            </Col>
            <Col md={12}>
              <Form.Label>Description</Form.Label>
              <Form.Control as="textarea" rows={2} value={form.description}
                            onChange={(e) => handleChange("description", e.target.value)} />
            </Col>
            <Col md={12}>
              <Form.Check type="switch" id="student-active-switch" label="Active"
                          checked={form.active}
                          onChange={(e) => handleChange("active", e.target.checked)} />
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleSave}>{editingId ? "Update" : "Create"}</Button>
        </Modal.Footer>
      </Modal>

      {/* Status-toggle confirmation modal — mirrors /contract-rate. */}
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
            {selectedRow?.active ? "deactivate" : "activate"} this Student
            Discount?
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
            onClick={updateRowStatus}
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
    </div>
  );
}
