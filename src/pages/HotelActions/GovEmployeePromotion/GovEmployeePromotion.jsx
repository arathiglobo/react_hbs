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
import { FaPlus, FaEdit, FaTrash, FaArrowLeft } from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import Sidebar from "../../../components/Sidebar";
import TopBar from "../../../components/TopBar";
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
          <Card className="shadow-sm border-0">
          <Card.Body>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <Button variant="link" className="p-0 me-2" onClick={() => navigate(`/hotel-details/${hotelId}`)}>
                  <FaArrowLeft /> Back
                </Button>
                <h5 className="mb-0 d-inline">Government Employee Discount</h5>
                <div className="text-muted small mt-1">Hotel ID: {hotelId}</div>
              </div>
              <Button variant="primary" size="sm" onClick={openCreate}>
                <FaPlus className="me-1" /> Add Discount
              </Button>
            </div>

            {loading ? (
              <div className="text-center py-5"><Spinner animation="border" /></div>
            ) : (
              <Table striped bordered hover responsive size="sm">
                <thead className="table-light">
                  <tr>
                    <th>#</th>
                    <th>Discount %</th>
                    <th>Discount Amount</th>
                    <th>Valid From</th>
                    <th>Valid To</th>
                    <th>Description</th>
                    <th>Active</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={8} className="text-center text-muted py-4">No discount configured yet.</td></tr>
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
                          <Badge bg={r.active ? "success" : "secondary"}>{r.active ? "YES" : "NO"}</Badge>
                        </td>
                        <td>
                          <Button size="sm" variant="outline-primary" className="me-1" onClick={() => openEdit(r)}>
                            <FaEdit />
                          </Button>
                          <Button size="sm" variant="outline-danger" onClick={() => handleDelete(r.promotionId)}>
                            <FaTrash />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            )}
          </Card.Body>
        </Card>
        </main>
      </div>

      {/* Create / Edit Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{editingId ? "Edit" : "Add"} Government Employee Discount</Modal.Title>
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
              <Form.Check type="switch" id="active-switch" label="Active"
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
    </div>
  );
}
