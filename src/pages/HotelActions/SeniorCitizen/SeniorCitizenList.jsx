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

import React, { useEffect, useRef, useState } from "react";
import {
  Card, Row, Col, Button, Table, Form, Modal, Spinner, Badge,
} from "react-bootstrap";
import { FaEdit, FaTrash, FaArrowLeft, FaUserClock, FaEye } from "react-icons/fa";
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

  // View-mode flag — when true the shared create/edit modal is rendered
  // read-only. Mirrors the /occupancy-and-minimumlength pattern.
  const [isViewMode, setIsViewMode] = useState(false);

  // Status-toggle modal state — mirrors the ContractRate pattern:
  // clicking the Active/Inactive badge opens a small confirmation modal
  // that PATCHes /status only after the operator confirms.
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [statusUpdating, setStatusUpdating] = useState(false);

  // Normalise a backend row into the form's discountType/Value shape.
  // Handles both new rows (carry discountType + discountValue) and
  // older rows that only carry discountPercent / discountAmount. Used
  // by both openEdit and the View click handler.
  const formFromRow = (row) => {
    let discountType = row.discountType;
    let discountValue = row.discountValue;
    if (!discountType) {
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
    return {
      discountType,
      discountValue: discountValue ?? "",
      validFrom: row.validFrom || "",
      validTo: row.validTo || "",
      description: row.description || "",
      active: row.active !== false,
    };
  };

  // View — backend has no GET-by-id endpoint for this resource
  // (`/api/hotel-senior-citizen-promotion/{id}` returns 405 "Method
  // GET not supported"), so we populate the modal directly from the
  // list row we already have. No round-trip needed.
  const handleView = (row) => {
    setEditingId(row.promotionId || row.id);
    setForm(formFromRow(row));
    setErrors({});
    setIsViewMode(true);
    setShowModal(true);
  };

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
    setIsViewMode(false);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setIsViewMode(false);
    setEditingId(null);
  };

  const openEdit = (row) => {
    setEditingId(row.promotionId || row.id);
    setForm(formFromRow(row));
    setErrors({});
    setIsViewMode(false);
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
      await axiosInstance.delete(`/api/hotel-senior-citizen-promotion/${id}`);
      toast.success("Deleted");
      fetchAll();
    } catch (e) { toast.error("Delete failed"); }
  };

  // Open the confirm modal for the row whose badge was clicked.
  const handleStatusToggle = (row) => {
    setSelectedRow(row);
    setShowStatusModal(true);
  };

  // PATCH the flipped active value, refresh the list, close the modal.
  const updateRowStatus = async () => {
    if (!selectedRow) return;
    const pid = selectedRow.promotionId || selectedRow.id;
    try {
      setStatusUpdating(true);
      await axiosInstance.patch(
        `/api/hotel-senior-citizen-promotion/${pid}/status`,
        { active: !selectedRow.active }
      );
      toast.success(selectedRow.active ? "Promotion deactivated" : "Promotion activated");
      await fetchAll();
      setShowStatusModal(false);
      setSelectedRow(null);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update promotion status");
    } finally {
      setStatusUpdating(false);
    }
  };

  const getDiscountType = (row) => {
    if (row.discountType) return row.discountType;
    if (row.discountPercent != null) return "PERCENTAGE";
    if (row.discountAmount != null) return "AMOUNT";
    return "-";
  };
  const getDiscountValue = (row) => {
    if (row.discountType === "PERCENTAGE") return `${row.discountValue}%`;
    if (row.discountType === "AMOUNT") return `${row.discountValue}`;
    if (row.discountPercent != null) return `${row.discountPercent}%`;
    if (row.discountAmount != null) return `${row.discountAmount}`;
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
                          {/* <td>{row.description || "-"}</td> */}
                          <td>
                            {/* Clickable Active/Inactive badge — opens the
                                confirm modal then PATCHes /status. Mirrors
                                /contract-rate. */}
                            <Badge
                              bg={row.active ? "success" : "danger"}
                              style={{ cursor: "pointer" }}
                              onClick={() => handleStatusToggle(row)}
                              title={`Click to ${row.active ? "deactivate" : "activate"} promotion`}
                            >
                              {row.active ? "Active" : "Inactive"}
                            </Badge>
                          </td>
                          <td>
                            <div className="d-flex gap-2">
                              <Button
                                size="sm"
                                variant="outline-info"
                                className="d-flex align-items-center gap-1"
                                onClick={() => handleView(row)}
                                title="View"
                              >
                                <FaEye /> View
                              </Button>
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

      {/* Create / Edit / View Modal — view mode disables the inputs,
          retitles to "View" and hides the Save button. Mirrors the
          /occupancy-and-minimumlength pattern. */}
      <Modal show={showModal} onHide={closeModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {isViewMode ? "View" : editingId ? "Edit" : "Add"} Senior Citizen Discount
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Row className="g-3">
            <Col md={6}>
              <Form.Label>Discount Type *</Form.Label>
              <Form.Select value={form.discountType}
                           disabled={isViewMode}
                           className={isViewMode ? "bg-light" : ""}
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
                            disabled={isViewMode}
                            className={isViewMode ? "bg-light" : ""}
                            isInvalid={!!errors.discountValue}
                            onChange={(e) => handleChange("discountValue", e.target.value)}
                            placeholder={form.discountType === "AMOUNT"
                              ? "Enter flat amount" : "e.g. 20 for 20% off"} />
              {errors.discountValue && <small className="text-danger">{errors.discountValue}</small>}
            </Col>
            <Col md={6}>
              <Form.Label>Valid From *</Form.Label>
              <Form.Control type="date" value={form.validFrom}
                            disabled={isViewMode}
                            className={isViewMode ? "bg-light" : ""}
                            isInvalid={!!errors.validFrom}
                            onChange={(e) => handleChange("validFrom", e.target.value)} />
              {errors.validFrom && <small className="text-danger">{errors.validFrom}</small>}
            </Col>
            <Col md={6}>
              <Form.Label>Valid To *</Form.Label>
              <Form.Control type="date" value={form.validTo}
                            disabled={isViewMode}
                            className={isViewMode ? "bg-light" : ""}
                            isInvalid={!!errors.validTo}
                            onChange={(e) => handleChange("validTo", e.target.value)} />
              {errors.validTo && <small className="text-danger">{errors.validTo}</small>}
            </Col>
            <Col md={12}>
              <Form.Label>Description</Form.Label>
              <AutoGrowTextarea rows={2} value={form.description}
                            disabled={isViewMode}
                            className={isViewMode ? "bg-light" : ""}
                            onChange={(e) => handleChange("description", e.target.value)} />
            </Col>
            {/* Active switch removed — the list page shows /
                toggles Active/Inactive via the badge in the Status
                column, so duplicating it here was confusing.
                `form.active` is still seeded from the loaded row
                (defaults true on create) and shipped on save. */}
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
            {selectedRow?.active ? "deactivate" : "activate"} this Senior Citizen discount?
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
          <Button variant="primary" onClick={updateRowStatus} disabled={statusUpdating}>
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
