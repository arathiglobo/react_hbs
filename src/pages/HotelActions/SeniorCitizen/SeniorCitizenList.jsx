/**
 * SeniorCitizenList.jsx
 *
 * Per-hotel "Senior Citizen Discount" CRUD page (markup-as-discount).
 * Opens from /hotel-details/:id action grid → "Senior Citizen" card.
 *
 * Structure mirrors GovEmployeePromotion exactly — same
 * discountType / discountValue model so the rest of the senior-
 * citizen flow can compute the discounted rate the same way.
 *
 * Endpoints:
 *   GET    /api/hotel-senior-citizen-promotion/hotel/{hotelId}
 *   POST   /api/hotel-senior-citizen-promotion
 *   PUT    /api/hotel-senior-citizen-promotion/{id}
 *   DELETE /api/hotel-senior-citizen-promotion/{id}
 *
 * Note: the older /api/senior-citizen master CRUD is no longer wired
 * to anything in the UI — senior-citizen qualification is now driven
 * purely by the adult ages captured on the search page.
 */

import React, { useEffect, useState } from "react";
import {
  Card, Row, Col, Button, Table, Form, Modal, Spinner, Badge,
} from "react-bootstrap";
import { FaEdit, FaTrash, FaArrowLeft, FaUserClock } from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import Sidebar from "../../../components/Sidebar";
import TopBar from "../../../components/TopBar";
import HotelTitleBadge from "../../../components/HotelTitleBadge";
import axiosInstance from "../../../components/AxiosInstance";

const EMPTY_FORM = {
  discountType: "PERCENTAGE",
  discountValue: "",
  validFrom: "",
  validTo: "",
  description: "",
  active: true,
};

export default function SeniorCitizenList() {
  const { id: hotelId } = useParams();
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});

  const fetchAll = async () => {
    setLoading(true);
    try {
      const { data } = await axiosInstance.get(
        `/api/hotel-senior-citizen-promotion/hotel/${hotelId}`
      );
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error("Failed to load promotions");
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (hotelId) fetchAll();
    // eslint-disable-next-line
  }, [hotelId]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setShowModal(true);
  };

  const openEdit = (row) => {
    setEditingId(row.promotionId || row.id);
    let discountType = row.discountType;
    let discountValue = row.discountValue;
    if (!discountType) {
      // Backward-compat with older rows that stored discountPercent / discountAmount.
      if (row.discountPercent != null) {
        discountType = "PERCENTAGE";
        discountValue = row.discountPercent;
      } else if (row.discountAmount != null) {
        discountType = "AMOUNT";
        discountValue = row.discountAmount;
      } else {
        discountType = "PERCENTAGE";
        discountValue = "";
      }
    }
    setForm({
      discountType,
      discountValue: discountValue ?? "",
      validFrom: row.validFrom || "",
      validTo: row.validTo || "",
      description: row.description || "",
      active: row.active !== false,
    });
    setErrors({});
    setShowModal(true);
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((e) => { const n = { ...e }; delete n[field]; return n; });
    }
  };

  const validate = () => {
    const e = {};
    if (!form.discountType) e.discountType = "Select discount type";
    if (form.discountValue === "" || form.discountValue == null) {
      e.discountValue = "Enter discount value";
    } else if (Number(form.discountValue) < 0) {
      e.discountValue = "Value must be ≥ 0";
    } else if (form.discountType === "PERCENTAGE" && Number(form.discountValue) > 100) {
      e.discountValue = "Percentage cannot exceed 100";
    }
    if (!form.validFrom) e.validFrom = "Valid From is required";
    if (!form.validTo) e.validTo = "Valid To is required";
    if (form.validFrom && form.validTo && form.validTo < form.validFrom)
      e.validTo = "Valid To must be on/after Valid From";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) { toast.error("Fix the highlighted fields"); return; }
    try {
      const payload = {
        hotelId: Number(hotelId),
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        validFrom: form.validFrom || null,
        validTo: form.validTo || null,
        description: form.description || null,
        active: !!form.active,
        // Back-compat fields — kept in case the backend still reads them.
        discountPercent:
          form.discountType === "PERCENTAGE" ? Number(form.discountValue) : null,
        discountAmount:
          form.discountType === "AMOUNT" ? Number(form.discountValue) : null,
      };

      if (editingId) {
        await axiosInstance.put(
          `/api/hotel-senior-citizen-promotion/${editingId}`, payload
        );
        toast.success("Updated");
      } else {
        await axiosInstance.post(`/api/hotel-senior-citizen-promotion`, payload);
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
      await axiosInstance.delete(`/api/hotel-senior-citizen-promotion/${id}`);
      toast.success("Deleted");
      fetchAll();
    } catch (e) { toast.error("Delete failed"); }
  };

  const getDiscountType = (row) => {
    if (row.discountType) return row.discountType;
    if (row.discountPercent != null) return "PERCENTAGE";
    if (row.discountAmount != null) return "AMOUNT";
    return "-";
  };
  const getDiscountValue = (row) => {
    if (row.discountType === "PERCENTAGE") return `${row.discountValue}%`;
    if (row.discountType === "AMOUNT") return `₹${row.discountValue}`;
    if (row.discountPercent != null) return `${row.discountPercent}%`;
    if (row.discountAmount != null) return `₹${row.discountAmount}`;
    return "-";
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          {/* Page header — mirrors LastMinuteContractRate. The
              FaUserClock accent + age-60 caption are preserved because
              they convey functional info (who the discount applies to). */}
          <div className="d-flex align-items-center gap-3 mb-2">
            <Button
              variant="outline-primary"
              onClick={() => navigate(`/hotel-details/${hotelId}`)}
              className="d-flex align-items-center btn-sm gap-2"
            >
              <FaArrowLeft />
              Back
            </Button>
            <h3 className="mb-0 d-flex align-items-center">
              <FaUserClock className="me-2 text-primary" />
              Senior Citizen Discount
            </h3>
            <HotelTitleBadge hotelId={hotelId} className="ms-2" />
          </div>
          <div className="text-muted small mb-3">
            The configured discount/markup is applied to the contract rate
            for any guest aged 60+ at search time.
          </div>

          <Card className="shadow-sm rounded-xl mb-3">
            <Card.Header className="d-flex justify-content-between align-items-center text-white">
              <span
                className="fw-semibold cursor-pointer text-primary"
                style={{ padding: "10px" }}
              >
                Senior Citizen Discount
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
                    <th>Discount Type</th>
                    <th>Discount Value</th>
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
                        No discount configured yet.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, idx) => {
                      const pid = row.promotionId || row.id;
                      return (
                        <tr key={pid}>
                          <td>{idx + 1}</td>
                          <td>{getDiscountType(row)}</td>
                          <td>{getDiscountValue(row)}</td>
                          <td>{row.validFrom || "-"}</td>
                          <td>{row.validTo || "-"}</td>
                          <td>{row.description || "-"}</td>
                          <td>
                            <Badge bg={row.active ? "success" : "danger"}>
                              {row.active ? "Active" : "Inactive"}
                            </Badge>
                          </td>
                          <td>
                            <div className="d-flex gap-2">
                              <Button
                                size="sm"
                                variant="outline-primary"
                                className="d-flex align-items-center gap-1"
                                onClick={() => openEdit(row)}
                                title="Edit"
                              >
                                <FaEdit /> Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline-danger"
                                className="d-flex align-items-center gap-1"
                                onClick={() => handleDelete(pid)}
                                title="Delete"
                              >
                                <FaTrash /> Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </main>
      </div>

      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {editingId ? "Edit" : "Add"} Senior Citizen Discount
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Row className="g-3">
            <Col md={6}>
              <Form.Label>Discount Type *</Form.Label>
              <Form.Select value={form.discountType}
                           isInvalid={!!errors.discountType}
                           onChange={(e) => handleChange("discountType", e.target.value)}>
                <option value="PERCENTAGE">Percentage</option>
                <option value="AMOUNT">Amount</option>
              </Form.Select>
              {errors.discountType && <small className="text-danger">{errors.discountType}</small>}
            </Col>
            <Col md={6}>
              <Form.Label>
                {form.discountType === "AMOUNT" ? "Discount Amount" : "Discount / Markup %"}
              </Form.Label>
              <Form.Control type="number" min="0"
                            max={form.discountType === "PERCENTAGE" ? "100" : undefined}
                            step="0.01"
                            value={form.discountValue}
                            isInvalid={!!errors.discountValue}
                            onChange={(e) => handleChange("discountValue", e.target.value)}
                            placeholder={form.discountType === "AMOUNT"
                              ? "Enter flat amount" : "e.g. 20 for 20% off"} />
              {errors.discountValue && <small className="text-danger">{errors.discountValue}</small>}
            </Col>
            <Col md={6}>
              <Form.Label>Valid From *</Form.Label>
              <Form.Control type="date" value={form.validFrom}
                            isInvalid={!!errors.validFrom}
                            onChange={(e) => handleChange("validFrom", e.target.value)} />
              {errors.validFrom && <small className="text-danger">{errors.validFrom}</small>}
            </Col>
            <Col md={6}>
              <Form.Label>Valid To *</Form.Label>
              <Form.Control type="date" value={form.validTo}
                            isInvalid={!!errors.validTo}
                            onChange={(e) => handleChange("validTo", e.target.value)} />
              {errors.validTo && <small className="text-danger">{errors.validTo}</small>}
            </Col>
            <Col md={12}>
              <Form.Label>Description</Form.Label>
              <Form.Control as="textarea" rows={2} value={form.description}
                            onChange={(e) => handleChange("description", e.target.value)} />
            </Col>
            <Col md={12}>
              <Form.Check type="switch" id="sc-active-switch" label="Active"
                          checked={form.active}
                          onChange={(e) => handleChange("active", e.target.checked)} />
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleSave}>
            {editingId ? "Update" : "Create"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
