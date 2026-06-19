import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Container, Row, Col, Form, Spinner, Table } from "react-bootstrap";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import toast from "react-hot-toast";

const RED_BTN = {
  backgroundColor: "#c0392b",
  color: "#fff",
  border: "none",
  borderRadius: "3px",
  padding: "8px 18px",
  fontSize: "0.82rem",
  fontWeight: "600",
  cursor: "pointer",
};

const GREY_BTN = { ...RED_BTN, backgroundColor: "#666" };

const SECTION_HEADER = {
  backgroundColor: "#f0f0f0",
  padding: "8px 14px",
  fontWeight: "600",
  fontSize: "0.92rem",
  borderBottom: "1px solid #ddd",
};

const card = {
  border: "1px solid #ddd",
  borderRadius: "4px",
  marginBottom: "14px",
  backgroundColor: "#fff",
  overflow: "hidden",
};

const emptyRoom = () => ({
  roomCategory: "",
  mealPlan: "ROOM ONLY",
  adults: 1,
  children: 0,
  rate: "",
  currency: "AED",
  nonRefundable: false,
});

export default function BookingEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [primary, setPrimary] = useState({
    salutation: "",
    firstName: "",
    middleName: "",
    lastName: "",
  });
  const [newRooms, setNewRooms] = useState([]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    axiosInstance
      .get(`/api/hotel-booking/${id}`)
      .then((res) => {
        if (res.data?.success) {
          setBooking(res.data);
          const c = res.data.customer || {};
          setPrimary({
            salutation: c.salutation || "",
            firstName: c.firstName || "",
            middleName: c.middleName || "",
            lastName: c.lastName || "",
          });
        } else {
          toast.error(res.data?.message || "Failed to load booking");
        }
      })
      .catch(() => toast.error("Error loading booking"))
      .finally(() => setLoading(false));
  }, [id]);

  const updateRoom = (idx, field, value) => {
    setNewRooms((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  const addRoomRow = () => setNewRooms((prev) => [...prev, emptyRoom()]);
  const removeRoomRow = (idx) => setNewRooms((prev) => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!primary.firstName.trim() || !primary.lastName.trim()) {
      toast.error("Primary guest first and last name are required");
      return;
    }
    // validate new rooms
    for (const r of newRooms) {
      if (!r.roomCategory.trim()) {
        toast.error("Each new room needs a Room Category");
        return;
      }
    }

    const payload = {
      primarySalutation: primary.salutation,
      primaryFirstName: primary.firstName,
      primaryMiddleName: primary.middleName,
      primaryLastName: primary.lastName,
      newRooms: newRooms.map((r) => ({
        roomCategory: r.roomCategory,
        mealPlan: r.mealPlan,
        adults: Number(r.adults) || 1,
        children: Number(r.children) || 0,
        rate: r.rate ? Number(r.rate) : null,
        currency: r.currency,
        nonRefundable: !!r.nonRefundable,
      })),
    };

    try {
      setSaving(true);
      const res = await axiosInstance.put(`/api/hotel-booking/${id}/edit`, payload);
      if (res.data?.success !== false) {
        toast.success(
          `Booking updated. New code: ${res.data?.bookingCode || ""}`
        );
        navigate(`/booking-details/hotel-booking/${id}`);
      } else {
        toast.error(res.data?.message || "Failed to save");
      }
    } catch (e) {
      toast.error(e.response?.data?.message || "Error saving booking");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4" style={{ overflow: "auto" }}>
          <Container fluid style={{ maxWidth: "1100px" }}>
            <div className="mb-3 d-flex align-items-center" style={{ gap: "12px" }}>
              <button style={GREY_BTN} onClick={() => navigate(-1)}>
                ← Back
              </button>
              <h4 style={{ margin: 0, fontWeight: 700, color: "#333" }}>
                Edit Booking
              </h4>
            </div>

            {loading ? (
              <div className="text-center py-5">
                <Spinner animation="border" style={{ color: "#c0392b" }} />
              </div>
            ) : !booking ? (
              <div className="text-muted text-center py-5">Booking not found.</div>
            ) : (
              <>
                <div style={card}>
                  <div style={SECTION_HEADER}>Booking Reference</div>
                  <div style={{ padding: "12px 16px", fontSize: "0.85rem" }}>
                    <Row>
                      <Col md={4}>
                        <strong>Booking Code:</strong> {booking.bookingCode || "-"}
                      </Col>
                      <Col md={5}>
                        <strong>Reference No.:</strong> {booking.referenceNumber || "-"}
                      </Col>
                      <Col md={3}>
                        <strong>Edits so far:</strong>{" "}
                        {booking.editCount ?? 0} —{" "}
                        <span style={{ color: "#c0392b" }}>
                          next edit will append /
                          {(booking.editCount ?? 0) + 1}
                        </span>
                      </Col>
                    </Row>
                  </div>
                </div>

                <div style={card}>
                  <div style={SECTION_HEADER}>Primary Guest</div>
                  <div style={{ padding: "14px 16px" }}>
                    <Row>
                      <Col md={2}>
                        <Form.Label style={{ fontSize: "0.82rem" }}>Salutation</Form.Label>
                        <Form.Select
                          size="sm"
                          value={primary.salutation}
                          onChange={(e) =>
                            setPrimary({ ...primary, salutation: e.target.value })
                          }
                        >
                          <option value="">-</option>
                          <option value="Mr">Mr</option>
                          <option value="Mrs">Mrs</option>
                          <option value="Ms">Ms</option>
                          <option value="Dr">Dr</option>
                        </Form.Select>
                      </Col>
                      <Col md={3}>
                        <Form.Label style={{ fontSize: "0.82rem" }}>
                          First Name <span style={{ color: "red" }}>*</span>
                        </Form.Label>
                        <Form.Control
                          size="sm"
                          value={primary.firstName}
                          onChange={(e) =>
                            setPrimary({ ...primary, firstName: e.target.value })
                          }
                        />
                      </Col>
                      <Col md={3}>
                        <Form.Label style={{ fontSize: "0.82rem" }}>Middle Name</Form.Label>
                        <Form.Control
                          size="sm"
                          value={primary.middleName}
                          onChange={(e) =>
                            setPrimary({ ...primary, middleName: e.target.value })
                          }
                        />
                      </Col>
                      <Col md={4}>
                        <Form.Label style={{ fontSize: "0.82rem" }}>
                          Last Name <span style={{ color: "red" }}>*</span>
                        </Form.Label>
                        <Form.Control
                          size="sm"
                          value={primary.lastName}
                          onChange={(e) =>
                            setPrimary({ ...primary, lastName: e.target.value })
                          }
                        />
                      </Col>
                    </Row>
                  </div>
                </div>

                <div style={card}>
                  <div
                    style={{
                      ...SECTION_HEADER,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span>Add New Rooms</span>
                    <button style={{ ...RED_BTN, padding: "4px 12px" }} onClick={addRoomRow}>
                      + Add Room
                    </button>
                  </div>
                  <div style={{ padding: "12px 16px" }}>
                    {newRooms.length === 0 ? (
                      <div className="text-muted" style={{ fontSize: "0.85rem" }}>
                        No new rooms. Click "+ Add Room" to add one.
                      </div>
                    ) : (
                      <Table bordered size="sm" style={{ fontSize: "0.82rem" }}>
                        <thead style={{ backgroundColor: "#f8f8f8" }}>
                          <tr>
                            <th>#</th>
                            <th>Room Category *</th>
                            <th>Meal Plan</th>
                            <th>Adults</th>
                            <th>Children</th>
                            <th>Rate</th>
                            <th>Currency</th>
                            <th>Non-Refundable</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {newRooms.map((r, idx) => (
                            <tr key={idx}>
                              <td>{idx + 1}</td>
                              <td>
                                <Form.Control
                                  size="sm"
                                  value={r.roomCategory}
                                  onChange={(e) =>
                                    updateRoom(idx, "roomCategory", e.target.value)
                                  }
                                />
                              </td>
                              <td>
                                <Form.Select
                                  size="sm"
                                  value={r.mealPlan}
                                  onChange={(e) =>
                                    updateRoom(idx, "mealPlan", e.target.value)
                                  }
                                >
                                  <option>ROOM ONLY</option>
                                  <option>BED & BREAKFAST</option>
                                  <option>HALF BOARD</option>
                                  <option>FULL BOARD</option>
                                  <option>ALL INCLUSIVE</option>
                                </Form.Select>
                              </td>
                              <td style={{ width: "70px" }}>
                                <Form.Control
                                  size="sm"
                                  type="number"
                                  min={1}
                                  value={r.adults}
                                  onChange={(e) =>
                                    updateRoom(idx, "adults", e.target.value)
                                  }
                                />
                              </td>
                              <td style={{ width: "70px" }}>
                                <Form.Control
                                  size="sm"
                                  type="number"
                                  min={0}
                                  value={r.children}
                                  onChange={(e) =>
                                    updateRoom(idx, "children", e.target.value)
                                  }
                                />
                              </td>
                              <td style={{ width: "90px" }}>
                                <Form.Control
                                  size="sm"
                                  type="number"
                                  step="0.01"
                                  value={r.rate}
                                  onChange={(e) =>
                                    updateRoom(idx, "rate", e.target.value)
                                  }
                                />
                              </td>
                              <td style={{ width: "70px" }}>
                                <Form.Control
                                  size="sm"
                                  value={r.currency}
                                  onChange={(e) =>
                                    updateRoom(idx, "currency", e.target.value)
                                  }
                                />
                              </td>
                              <td style={{ textAlign: "center" }}>
                                <Form.Check
                                  type="checkbox"
                                  checked={!!r.nonRefundable}
                                  onChange={(e) =>
                                    updateRoom(idx, "nonRefundable", e.target.checked)
                                  }
                                />
                              </td>
                              <td>
                                <button
                                  style={{ ...GREY_BTN, padding: "2px 8px", fontSize: "0.75rem" }}
                                  onClick={() => removeRoomRow(idx)}
                                >
                                  ×
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  <button style={RED_BTN} onClick={handleSave} disabled={saving}>
                    {saving ? "Saving..." : "SAVE"}
                  </button>
                  <button style={GREY_BTN} onClick={() => navigate(-1)} disabled={saving}>
                    CANCEL
                  </button>
                </div>
              </>
            )}
          </Container>
        </main>
      </div>
    </div>
  );
}
