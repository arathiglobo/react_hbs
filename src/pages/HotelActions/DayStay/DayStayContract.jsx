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
 * DayStayContract — list page for /hotel-actions/:id/day-stay-contract
 *
 * Day Stay differs from 24-hour check-in: the hotel only allows day-stay
 * check-ins inside a daily time window (e.g. 8AM-5PM). A guest checking in
 * inside the window is allowed only until the window's end time.
 */
export default function DayStayContract() {
  const { id: hotelId } = useParams();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchRows = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(
        `/api/day-stay-contract?hotelId=${hotelId}`
      );
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load Day Stay contracts");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hotelId) fetchRows();
  }, [hotelId]);

  const handleDelete = async (id) => {
    const ok = await Swal.fire({
      title: "Delete this Day Stay contract?",
      text: "This cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#c0392b",
      confirmButtonText: "Yes, delete",
    });
    if (!ok.isConfirmed) return;
    try {
      await axiosInstance.delete(`/api/day-stay-contract/${id}`);
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
              <h5 className="mb-0">Day Stay Contract Rates</h5>
            </div>
            <Button
              style={{ backgroundColor: "#0d6efd", border: "none" }}
              onClick={() =>
                navigate(`/hotel-actions/hotel/${hotelId}/day-stay-contract/create`)
              }
            >
              <FaPlus className="me-2" />
              Add Day Stay Contract
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
                  No Day Stay contracts yet for this hotel.
                </div>
              ) : (
                <Table bordered hover responsive size="sm">
                  <thead style={{ backgroundColor: "#f8f8f8" }}>
                    <tr>
                      <th>#</th>
                      <th>Rate Code</th>
                      <th>Validity From</th>
                      <th>Validity To</th>
                      <th>Daily Window</th>
                      <th>Day Stay Rate</th>
                      <th>Markup %</th>
                      <th>Status</th>
                      <th style={{ width: 110 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.id}>
                        <td>{i + 1}</td>
                        <td>{r.rateCode || "—"}</td>
                        <td>{r.validityFrom}</td>
                        <td>{r.validityTo}</td>
                        <td>
                          {r.checkInStartTime || "08:00"} – {r.checkInEndTime || "17:00"}
                        </td>
                        <td>
                          {r.dayStayRate != null
                            ? Number(r.dayStayRate).toFixed(2)
                            : "—"}
                        </td>
                        <td>
                          {r.percentage != null
                            ? `${Number(r.percentage).toFixed(2)}%`
                            : "—"}
                        </td>
                        <td>
                          {r.active ? (
                            <Badge bg="success">Active</Badge>
                          ) : (
                            <Badge bg="secondary">Inactive</Badge>
                          )}
                        </td>
                        <td>
                          <Button
                            size="sm"
                            variant="outline-primary"
                            className="me-2"
                            onClick={() =>
                              navigate(
                                `/hotel-actions/hotel/${hotelId}/day-stay-contract/${r.id}/edit`
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
