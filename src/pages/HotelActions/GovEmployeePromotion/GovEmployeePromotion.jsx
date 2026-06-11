/**
 * GovEmployeePromotion.jsx
 *
 * Per-hotel "Government Employee Discount" CRUD page, opened from the
 * hotel-details (/hotel-details/:id) action grid — next to Contract
 * Rate and Promotion.
 *
 *  - GET    /api/hotel-gov-employee-promotion/hotel/{hotelId}
 *  - POST   /api/hotel-gov-employee-promotion
 *  - PUT    /api/hotel-gov-employee-promotion/{id}
 *  - DELETE /api/hotel-gov-employee-promotion/{id}
 *
 * The discount configured here is what the gov-employee search +
 * booking flow applies to that hotel's rates. Either a percentage,
 * a flat per-room amount, or both. Optional validity window.
 */

import React, { useEffect, useState } from "react";
import { Card, Row, Col, Button, Table, Form, Modal, Spinner, Badge } from "react-bootstrap";
import { FaEdit, FaTrash, FaArrowLeft, FaEye } from "react-icons/fa";
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

export default function GovEmployeePromotion() {
  const { id: hotelId } = useParams(); // hotel id from route /hotel-actions/:id/gov-employee-promotion
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  // Status-toggle modal state — mirrors the ContractRate pattern:
  // clicking the Active/Inactive badge opens a small confirmation
  // modal that PATCHes /status only after the operator confirms.
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [statusUpdating, setStatusUpdating] = useState(false);

  // View-mode flag — when true the shared create/edit modal is rendered
  // read-only (disabled inputs, "View" title, no Save button), matching
  // the /occupancy-and-minimumlength pattern.
  const [isViewMode, setIsViewMode] = useState(false);

  // View — fetch full record by id, populate the shared form, open the
  // shared modal in read-only mode.
  const handleView = async (promotionId) => {
    try {
      const res = await axiosInstance.get(
        `/api/hotel-gov-employee-promotion/${promotionId}`
      );
      const data = res.data || {};
      setEditingId(promotionId);
      setForm({
        discountPercent: data.discountPercent ?? "",
        discountAmount: data.discountAmount ?? "",
        validFrom: data.validFrom || "",
        validTo: data.validTo || "",
        description: data.description || "",
        active: data.active !== false,
      });
      setIsViewMode(true);
      setShowModal(true);
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to load details");
    }
  };

  // ── Load all promotions for this hotel ─────────────────────────────
  const fetchAll = async () => {
    setLoading(true);
    try {
      const { data } = await axiosInstance.get(`/api/hotel-gov-employee-promotion/hotel/${hotelId}`);
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

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsViewMode(false);
    setShowModal(true);
  };
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
    setIsViewMode(false);
    setShowModal(true);
  };
  const closeModal = () => {
    setShowModal(false);
    setIsViewMode(false);
    setEditingId(null);
  };
  const handleChange = (f, v) => setForm((s) => ({ ...s, [f]: v }));

  const handleSave = async () => {
    // require at least one discount form
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
        await axiosInstance.put(`/api/hotel-gov-employee-promotion/${editingId}`, payload);
        toast.success("Updated");
      } else {
        await axiosInstance.post(`/api/hotel-gov-employee-promotion`, payload);
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
        `/api/hotel-gov-employee-promotion/${selectedRow.promotionId}/status`,
        { active: !selectedRow.active }
      );
      toast.success(
        selectedRow.active ? "Promotion deactivated" : "Promotion activated"
      );
      await fetchAll();
      setShowStatusModal(false);
      setSelectedRow(null);
    } catch (err) {
      console.error("Status toggle failed:", err);
      toast.error(
        err?.response?.data?.message || "Failed to update promotion status"
      );
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this promotion?")) return;
    try {
      await axiosInstance.delete(`/api/hotel-gov-employee-promotion/${id}`);
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
          {/* Page header — mirrors LastMinuteContractRate. */}
          <div className="d-flex align-items-center gap-3 mb-3">
            <Button
              variant="outline-primary"
              onClick={() => navigate(`/hotel-details/${hotelId}`)}
              className="d-flex align-items-center btn-sm gap-2"
            >
              <FaArrowLeft />
              Back
            </Button>
            <h3 className="mb-0">Government Employee Discount</h3>
            <HotelTitleBadge hotelId={hotelId} className="ms-2" />
          </div>

          <Card className="shadow-sm rounded-xl mb-3">
            <Card.Header className="d-flex justify-content-between align-items-center text-white">
              <span
                className="fw-semibold cursor-pointer text-primary"
                style={{ padding: "10px" }}
              >
                Government Employee Discount
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
                    <th style={{ width: 230 }}>Actions</th>
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
                        No discount configured yet.
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
                              variant="outline-info"
                              className="d-flex align-items-center gap-1"
                              onClick={() => handleView(r.promotionId)}
                              title="View"
                            >
                              <FaEye /> View
                            </Button>
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

      {/* Create / Edit / View Modal — same modal in all three modes.
          When isViewMode is true the inputs are disabled, the title says
          "View", and the Save button is hidden. Mirrors the
          /occupancy-and-minimumlength view-mode pattern. */}
      <Modal show={showModal} onHide={closeModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {isViewMode ? "View" : editingId ? "Edit" : "Add"} Government Employee Discount
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Row className="g-3">
            <Col md={6}>
              <Form.Label>Discount %</Form.Label>
              <Form.Control type="number" min="0" max="100" step="0.01"
                            value={form.discountPercent}
                            disabled={isViewMode}
                            className={isViewMode ? "bg-light" : ""}
                            onChange={(e) => handleChange("discountPercent", e.target.value)} />
            </Col>
            <Col md={6}>
              <Form.Label>Discount Amount (flat)</Form.Label>
              <Form.Control type="number" min="0" step="0.01"
                            value={form.discountAmount}
                            disabled={isViewMode}
                            className={isViewMode ? "bg-light" : ""}
                            onChange={(e) => handleChange("discountAmount", e.target.value)} />
            </Col>
            <Col md={6}>
              <Form.Label>Valid From</Form.Label>
              <Form.Control type="date" value={form.validFrom}
                            disabled={isViewMode}
                            className={isViewMode ? "bg-light" : ""}
                            onChange={(e) => handleChange("validFrom", e.target.value)} />
            </Col>
            <Col md={6}>
              <Form.Label>Valid To</Form.Label>
              <Form.Control type="date" value={form.validTo}
                            disabled={isViewMode}
                            className={isViewMode ? "bg-light" : ""}
                            onChange={(e) => handleChange("validTo", e.target.value)} />
            </Col>
            <Col md={12}>
              <Form.Label>Description</Form.Label>
              <Form.Control as="textarea" rows={2} value={form.description}
                            disabled={isViewMode}
                            className={isViewMode ? "bg-light" : ""}
                            onChange={(e) => handleChange("description", e.target.value)} />
            </Col>
            <Col md={12}>
              <Form.Check type="switch" id="active-switch" label="Active"
                          checked={form.active}
                          disabled={isViewMode}
                          onChange={(e) => handleChange("active", e.target.checked)} />
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeModal}>
            {isViewMode ? "Close" : "Cancel"}
          </Button>
          {!isViewMode && (
            <Button variant="primary" onClick={handleSave}>
              {editingId ? "Update" : "Create"}
            </Button>
          )}
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
            {selectedRow?.active ? "deactivate" : "activate"} this Government
            Employee discount?
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
