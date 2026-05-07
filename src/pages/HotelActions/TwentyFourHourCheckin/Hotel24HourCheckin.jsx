import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, Button, Table, Spinner, Badge } from "react-bootstrap";
import { FaArrowLeft, FaPlus, FaEdit, FaTrash } from "react-icons/fa";
import Sidebar from "../../../components/Sidebar";
import Topbar from "../../../components/TopBar";
import axiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";

/**
 * Hotel24HourCheckin (list page)
 * Route: /hotel-actions/:id/24-hour-checkin
 *
 * Lists all 24-hour check-in configurations for one hotel and lets
 * the user create / edit / delete from here. Talks to /api/24-hour-checkin.
 */
export default function Hotel24HourCheckin() {
  const { id: hotelId } = useParams();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch all configs for this hotel.
  const fetchRows = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(`/api/24-hour-checkin?hotelId=${hotelId}`);
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load 24-hour check-in configurations");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hotelId) fetchRows();
  }, [hotelId]);

  // Confirm + delete a row.
  const handleDelete = async (id) => {
    const ok = await Swal.fire({
      title: "Delete this configuration?",
      text: "This cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#c0392b",
      confirmButtonText: "Yes, delete",
    });
    if (!ok.isConfirmed) return;

    try {
      await axiosInstance.delete(`/api/24-hour-checkin/${id}`);
      toast.success("Deleted");
      fetchRows();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Delete failed");
    }
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4" style={{ overflow: "auto" }}>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div className="d-flex align-items-center gap-2">
              <Button
                variant="light"
                onClick={() => navigate(-1)}
                className="d-flex align-items-center gap-2"
              >
                <FaArrowLeft /> Back
              </Button>
              <h5 className="mb-0">24 Hour Check-In Configurations</h5>
            </div>
            <Button
              style={{ backgroundColor: "#0d6efd", border: "none" }}
              onClick={() =>
                navigate(`/hotel-actions/hotel/${hotelId}/24-hour-checkin/create`)
              }
            >
              <FaPlus className="me-2" />
              Add Configuration
            </Button>
          </div>

          <Card className="shadow-sm">
            <Card.Body>
              {loading ? (
                <div className="text-center py-4">
                  <Spinner animation="border" />
                </div>
              ) : rows.length === 0 ? (
                <div className="text-center text-muted py-4">
                  No 24-hour check-in configurations yet for this hotel.
                </div>
              ) : (
                <Table bordered hover responsive size="sm">
                  <thead style={{ backgroundColor: "#f8f8f8" }}>
                    <tr>
                      <th>#</th>
                      <th>Validity From</th>
                      <th>Validity To</th>
                      <th>Daily Window</th>
                      <th>Markup %</th>
                      <th>Status</th>
                      <th>Remarks</th>
                      <th style={{ width: 110 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.id}>
                        <td>{i + 1}</td>
                        <td>{r.validityFrom}</td>
                        <td>{r.validityTo}</td>
                        <td>
                          {r.checkInStartTime || "00:00"} – {r.checkInEndTime || "23:59"}
                        </td>
                        <td>
                          <strong>{Number(r.percentage).toFixed(2)}%</strong>
                        </td>
                        <td>
                          {r.active ? (
                            <Badge bg="success">Active</Badge>
                          ) : (
                            <Badge bg="secondary">Inactive</Badge>
                          )}
                        </td>
                        <td className="text-muted small">{r.remarks || "—"}</td>
                        <td>
                          <Button
                            size="sm"
                            variant="outline-primary"
                            className="me-2"
                            onClick={() =>
                              navigate(
                                `/hotel-actions/hotel/${hotelId}/24-hour-checkin/${r.id}/edit`
                              )
                            }
                            title="Edit"
                          >
                            <FaEdit />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline-danger"
                            onClick={() => handleDelete(r.id)}
                            title="Delete"
                          >
                            <FaTrash />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </main>
      </div>
    </div>
  );
}
