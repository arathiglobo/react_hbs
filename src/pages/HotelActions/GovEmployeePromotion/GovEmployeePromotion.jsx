import React, { useEffect, useState } from "react";
import {
  Card,
  Row,
  Col,
  Button,
  Table,
  Form,
  Modal,
  Spinner,
  Badge,
} from "react-bootstrap";
import { FaPlus, FaEdit, FaTrash, FaArrowLeft } from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import Sidebar from "../../../components/Sidebar";
import TopBar from "../../../components/TopBar";
import axiosInstance from "../../../components/AxiosInstance";

const EMPTY_FORM = {
  discountType: "PERCENTAGE",
  discountValue: "",
  validFrom: "",
  validTo: "",
  description: "",
  active: true,
};

export default function GovEmployeePromotion() {
  const { id: hotelId } = useParams();
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const { data } = await axiosInstance.get(
        `/api/hotel-gov-employee-promotion/hotel/${hotelId}`
      );
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
    setShowModal(true);
  };

  const openEdit = (row) => {
    setEditingId(row.promotionId);

    let discountType = row.discountType;
    let discountValue = row.discountValue;

    // fallback for old backend response
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

    setForm({
      discountType,
      discountValue: discountValue ?? "",
      validFrom: row.validFrom || "",
      validTo: row.validTo || "",
      description: row.description || "",
      active: row.active !== false,
    });

    setShowModal(true);
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    if (!form.discountType) {
      toast.error("Select discount type");
      return;
    }

    if (!form.discountValue) {
      toast.error("Enter discount value");
      return;
    }

    if (
      form.discountType === "PERCENTAGE" &&
      Number(form.discountValue) > 100
    ) {
      toast.error("Percentage cannot be greater than 100");
      return;
    }

    try {
      const payload = {
        hotelId: Number(hotelId),
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        validFrom: form.validFrom || null,
        validTo: form.validTo || null,
        description: form.description || null,
        active: !!form.active,

        // keep these only if backend still expects old fields
        discountPercent:
          form.discountType === "PERCENTAGE"
            ? Number(form.discountValue)
            : null,
        discountAmount:
          form.discountType === "AMOUNT"
            ? Number(form.discountValue)
            : null,
      };

      if (editingId) {
        await axiosInstance.put(
          `/api/hotel-gov-employee-promotion/${editingId}`,
          payload
        );
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

  const getDiscountType = (row) => {
    if (row.discountType) return row.discountType;
    if (row.discountPercent != null) return "PERCENTAGE";
    if (row.discountAmount != null) return "AMOUNT";
    return "-";
  };

  const getDiscountValue = (row) => {
    if (row.discountType === "PERCENTAGE") return `${row.discountValue}%`;
    if (row.discountType === "AMOUNT") return `₹${row.discountValue}`;

    // fallback for old backend response
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
          <Card className="shadow-sm border-0">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <Button
                    variant="link"
                    className="p-0 me-2"
                    onClick={() => navigate(`/hotel-details/${hotelId}`)}
                  >
                    <FaArrowLeft /> Back
                  </Button>

                  <h5 className="mb-0 d-inline">
                    Government Employee Discount
                  </h5>

                  <div className="text-muted small mt-1">
                    Hotel ID: {hotelId}
                  </div>
                </div>

                <Button variant="primary" size="sm" onClick={openCreate}>
                  <FaPlus className="me-1" /> Add Discount
                </Button>
              </div>

              {loading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" />
                </div>
              ) : (
                <Table striped bordered hover responsive size="sm">
                  <thead className="table-light">
                    <tr>
                      <th>#</th>
                      <th>Discount Type</th>
                      <th>Discount Value</th>
                      <th>Valid From</th>
                      <th>Valid To</th>
                      <th>Description</th>
                      <th>Active</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="text-center text-muted py-4"
                        >
                          No discount configured yet.
                        </td>
                      </tr>
                    ) : (
                      rows.map((row, index) => (
                        <tr key={row.promotionId}>
                          <td>{index + 1}</td>
                          <td>{getDiscountType(row)}</td>
                          <td>{getDiscountValue(row)}</td>
                          <td>{row.validFrom || "-"}</td>
                          <td>{row.validTo || "-"}</td>
                          <td>{row.description || "-"}</td>
                          <td>
                            <Badge bg={row.active ? "success" : "secondary"}>
                              {row.active ? "YES" : "NO"}
                            </Badge>
                          </td>
                          <td>
                            <Button
                              size="sm"
                              variant="outline-primary"
                              className="me-1"
                              onClick={() => openEdit(row)}
                            >
                              <FaEdit />
                            </Button>

                            <Button
                              size="sm"
                              variant="outline-danger"
                              onClick={() => handleDelete(row.promotionId)}
                            >
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

      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {editingId ? "Edit" : "Add"} Government Employee Discount
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <Row className="g-3">
            <Col md={6}>
              <Form.Label>Discount Type</Form.Label>
              <Form.Select
                value={form.discountType}
                onChange={(e) =>
                  handleChange("discountType", e.target.value)
                }
              >
                <option value="PERCENTAGE">Percentage</option>
                <option value="AMOUNT">Amount</option>
              </Form.Select>
            </Col>

            <Col md={6}>
              <Form.Label>
                {form.discountType === "AMOUNT"
                  ? "Discount Amount"
                  : "Discount Percentage"}
              </Form.Label>

              <Form.Control
                type="number"
                min="0"
                max={form.discountType === "PERCENTAGE" ? "100" : undefined}
                step="0.01"
                value={form.discountValue}
                onChange={(e) =>
                  handleChange("discountValue", e.target.value)
                }
                placeholder={
                  form.discountType === "AMOUNT"
                    ? "Enter amount"
                    : "Enter percentage"
                }
              />
            </Col>

            <Col md={6}>
              <Form.Label>Valid From</Form.Label>
              <Form.Control
                type="date"
                value={form.validFrom}
                onChange={(e) => handleChange("validFrom", e.target.value)}
              />
            </Col>

            <Col md={6}>
              <Form.Label>Valid To</Form.Label>
              <Form.Control
                type="date"
                value={form.validTo}
                onChange={(e) => handleChange("validTo", e.target.value)}
              />
            </Col>

            <Col md={12}>
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={form.description}
                onChange={(e) => handleChange("description", e.target.value)}
              />
            </Col>

            <Col md={12}>
              <Form.Check
                type="switch"
                id="active-switch"
                label="Active"
                checked={form.active}
                onChange={(e) => handleChange("active", e.target.checked)}
              />
            </Col>
          </Row>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Cancel
          </Button>

          <Button variant="primary" onClick={handleSave}>
            {editingId ? "Update" : "Create"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}