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

import React, { useEffect, useRef, useState } from "react";
import { Card, Row, Col, Button, Table, Form, Modal, Spinner, Badge } from "react-bootstrap";
import { FaEdit, FaTrash, FaArrowLeft, FaGraduationCap, FaEye } from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
import Sidebar from "../../../components/Sidebar";
import TopBar from "../../../components/TopBar";
import HotelTitleBadge from "../../../components/HotelTitleBadge";
import axiosInstance from "../../../components/AxiosInstance";

/**
 * AutoGrowTextarea — drop-in for `<Form.Control as="textarea">` that
 * resizes itself to fit its current value. Used for the Description
 * field so long saved descriptions render in full on View instead
 * of being clipped behind a 2-row scrollbar. Works the same in
 * create / edit / view modes because it sizes off scrollHeight.
 *
 * Defined at module level so it keeps a stable component identity
 * across the parent's re-renders — that's what lets `useRef` /
 * `useEffect` track the same DOM node over time.
 */
const AutoGrowTextarea = ({ value, style, ...rest }) => {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <Form.Control
      as="textarea"
      ref={ref}
      value={value}
      {...rest}
      style={{ overflow: "hidden", resize: "none", ...(style || {}) }}
    />
  );
};

// Form shape now mirrors SeniorCitizenList — a single Discount Type
// dropdown + single value field. Payload still ships the legacy
// `discountPercent` / `discountAmount` pair the backend reads.
const EMPTY_FORM = {
  discountType: "PERCENTAGE",
  discountValue: "",
  validFrom: "",
  validTo: "",
  description: "",
  active: false,
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

  // View-mode flag — when true the shared create/edit modal is rendered
  // read-only. Mirrors the /occupancy-and-minimumlength pattern.
  const [isViewMode, setIsViewMode] = useState(false);

  // Map a backend row (discountPercent + discountAmount) into the
  // type/value form shape. Used by both openEdit and handleView.
  const formFromRow = (row) => {
    let discountType = "PERCENTAGE";
    let discountValue = "";
    if (row.discountPercent != null && row.discountPercent !== "") {
      discountType = "PERCENTAGE";
      discountValue = row.discountPercent;
    } else if (row.discountAmount != null && row.discountAmount !== "") {
      discountType = "AMOUNT";
      discountValue = row.discountAmount;
    }
    return {
      discountType,
      discountValue,
      validFrom: row.validFrom || "",
      validTo: row.validTo || "",
      description: row.description || "",
      active: row.active !== false,
    };
  };

  // View — backend has no GET-by-id endpoint for this resource
  // (`/api/hotel-student-discount-promotion/{id}` returns 405
  // "Method GET not supported"), so we populate the modal directly
  // from the list row we already have. No round-trip needed.
  const handleView = (row) => {
    setEditingId(row.promotionId);
    setForm(formFromRow(row));
    setIsViewMode(true);
    setShowModal(true);
  };

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

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsViewMode(false);
    setShowModal(true);
  };
  const openEdit = (row) => {
    setEditingId(row.promotionId);
    setForm(formFromRow(row));
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
    // Single Discount Value field with type dropdown — same UX as
    // SeniorCitizen. Backend still stores percent/amount separately,
    // so we map type → the right field at save time.
    if (form.discountValue === "" || form.discountValue == null) {
      toast.error("Enter a discount value");
      return;
    }
    const value = Number(form.discountValue);
    if (Number.isNaN(value) || value < 0) {
      toast.error("Discount value must be a non-negative number");
      return;
    }
    if (form.discountType === "PERCENTAGE" && value > 100) {
      toast.error("Discount percentage cannot exceed 100");
      return;
    }
    try {
      const payload = {
        hotelId: Number(hotelId),
        discountPercent: form.discountType === "PERCENTAGE" ? value : null,
        discountAmount: form.discountType === "AMOUNT" ? value : null,
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

  // Swal confirmation popup — mirrors the meeting-space delete UX
  // so the same dialog style is consistent across hotel-action pages.
  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: "Delete this promotion?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
      confirmButtonColor: "#d33",
    });
    if (!result.isConfirmed) return;
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
              Student 
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
                    {/* <th>Description</th> */}
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
                        {/* <td>{r.description || "-"}</td> */}
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
                              onClick={() => handleView(r)}
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

      {/* Create / Edit / View Modal — view mode disables the inputs,
          retitles to "View" and hides the Save button. Mirrors
          /occupancy-and-minimumlength. */}
      <Modal show={showModal} onHide={closeModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {isViewMode ? "View" : editingId ? "Edit" : "Add"} Student Discount
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {/* Layout mirrors SeniorCitizen — Discount Type dropdown
              + single value field. Active switch removed because
              the list page exposes Active / Inactive via the
              clickable status badge. */}
          <Row className="g-3">
            <Col md={6}>
              <Form.Label>Discount Type *</Form.Label>
              <Form.Select
                value={form.discountType}
                disabled={isViewMode}
                className={isViewMode ? "bg-light" : ""}
                onChange={(e) => handleChange("discountType", e.target.value)}
              >
                <option value="PERCENTAGE">Percentage</option>
                <option value="AMOUNT">Amount</option>
              </Form.Select>
            </Col>
            <Col md={6}>
              <Form.Label>
                {form.discountType === "AMOUNT"
                  ? "Discount Amount"
                  : "Discount %"}
              </Form.Label>
              <Form.Control
                type="number"
                min="0"
                max={form.discountType === "PERCENTAGE" ? "100" : undefined}
                step="0.01"
                value={form.discountValue}
                disabled={isViewMode}
                className={isViewMode ? "bg-light" : ""}
                placeholder={
                  form.discountType === "AMOUNT"
                    ? "Enter flat amount"
                    : "e.g. 15 for 15% off"
                }
                onChange={(e) => handleChange("discountValue", e.target.value)}
              />
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
              <AutoGrowTextarea rows={2} value={form.description}
                            disabled={isViewMode}
                            className={isViewMode ? "bg-light" : ""}
                            onChange={(e) => handleChange("description", e.target.value)} />
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
