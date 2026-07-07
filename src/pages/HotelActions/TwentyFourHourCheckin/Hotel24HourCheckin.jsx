import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, Button, Table, Spinner, Badge, Modal, Form } from "react-bootstrap";
import { FaArrowLeft, FaEdit, FaTrash, FaEye } from "react-icons/fa";
import Sidebar from "../../../components/Sidebar";
import Topbar from "../../../components/TopBar";
import HotelTitleBadge from "../../../components/HotelTitleBadge";
import axiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";

/**
 * Hotel24HourCheckin (list page)
 * Route: /hotel-actions/:id/24-hour-checkin
 *
 * Lists all 24-hour check-in configurations for one hotel and lets
 * the user create / edit / delete from here. Talks to /api/24-hour-checkin.
 *
 * UI structure mirrors LastMinuteContractRate.jsx so both
 * hotel-actions list pages share the same look (outline-primary Back +
 * h3 title row, shadow-sm rounded-xl card with header carrying the
 * "+ Create" button, striped/bordered table inside a p-0 body, icon-
 * only action handles). All functionality — endpoints, data columns,
 * navigation paths, delete confirm flow — is unchanged.
 */
export default function Hotel24HourCheckin() {
  const { id: hotelId } = useParams();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [searchTimeout, setSearchTimeout] = useState(null);

  // Status-toggle modal state — mirrors the ContractRate pattern:
  // clicking the Active/Inactive badge opens a small confirmation
  // modal that PATCHes the new value via /status.
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [statusUpdating, setStatusUpdating] = useState(false);

  // View — reuses the existing edit page in read-only mode by passing
  // `?mode=view` in the URL. The form there reads useSearchParams and
  // disables every input. Mirrors the /occupancy-and-minimumlength
  // view pattern (same screen, no inputs editable, no Save button).
  const handleView = (rowId) =>
    navigate(
      `/hotel-actions/hotel/${hotelId}/24-hour-checkin/${rowId}/edit?mode=view`
    );

  // Fetch all configs for this hotel.
  const fetchRows = async (searchTerm = search) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ hotelId });
      if (searchTerm?.trim()) params.append("search", searchTerm.trim());
      const res = await axiosInstance.get(
        `/api/24-hour-checkin?${params}`
      );
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
    if (hotelId) fetchRows("");
  }, [hotelId]);

  // Debounced search
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    const timeout = setTimeout(() => {
      fetchRows(search);
    }, 400);
    setSearchTimeout(timeout);
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [search]);

  const handleCreate = () =>
    navigate(`/hotel-actions/hotel/${hotelId}/24-hour-checkin/create`);

  const handleEdit = (rowId) =>
    navigate(
      `/hotel-actions/hotel/${hotelId}/24-hour-checkin/${rowId}/edit`
    );

  // Open the confirm modal for the row whose badge was clicked.
  const handleStatusToggle = (row) => {
    setSelectedRow(row);
    setShowStatusModal(true);
  };

  // PATCH the flipped active value, refresh the list, close the modal.
  // The backend echoes back the saved DTO so the optimistic state could
  // also be updated from the response — keeping the refetch for parity
  // with the ContractRate flow.
  const updateRowStatus = async () => {
    if (!selectedRow) return;
    try {
      setStatusUpdating(true);
      await axiosInstance.patch(
        `/api/24-hour-checkin/${selectedRow.id}/status`,
        { active: !selectedRow.active }
      );
      toast.success(
        selectedRow.active
          ? "Configuration deactivated"
          : "Configuration activated"
      );
      await fetchRows();
      setShowStatusModal(false);
      setSelectedRow(null);
    } catch (err) {
      console.error("Status toggle failed:", err);
      toast.error(
        err?.response?.data?.message ||
          "Failed to update 24-hour check-in status"
      );
    } finally {
      setStatusUpdating(false);
    }
  };

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
        <main className="flex-grow-1 p-4">
          {/* Header row — matches LastMinuteContractRate's outline-primary
              Back button + h3 title. HotelTitleBadge is kept because it
              shows the hotel context the original page relied on. */}
          <div className="d-flex align-items-center gap-3 mb-3">
            <Button
              variant="outline-primary"
              onClick={() => navigate(`/hotel-details/${hotelId}`)}
              className="d-flex align-items-center btn-sm gap-2"
            >
              <FaArrowLeft />
              Back
            </Button>
            <h3 className="mb-0">24 Hour </h3>
            <HotelTitleBadge hotelId={hotelId} className="ms-2" />
          </div>

          <Card className="shadow-sm rounded-xl mb-3">
            <Card.Header className="d-flex justify-content-between align-items-center text-white">
              <span
                className="fw-semibold cursor-pointer text-primary"
                style={{ padding: "10px" }}
              >
                24 Hour Check-In Configurations
              </span>
              <Form.Group className="hotel-search-bar position-relative">
                <Form.Control
                  type="text"
                  placeholder="Search..."
                  className="form-control-modern-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </Form.Group>
              <Button className="btn-green create-btn" onClick={handleCreate}>
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
                    <th>Validity From</th>
                    <th>Validity To</th>
                    <th>Daily Window</th>
                    <th>Markup %</th>
                    <th>Status</th>
                    {/* <th>Remarks</th> */}
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
                  ) : rows.length > 0 ? (
                    rows.map((r, i) => (
                      <tr key={r.id}>
                        <td>{i + 1}</td>
                        <td>{r.validityFrom}</td>
                        <td>{r.validityTo}</td>
                        <td>
                          {r.checkInStartTime || "00:00"} –{" "}
                          {r.checkInEndTime || "23:59"}
                        </td>
                        <td>
                          <strong>{Number(r.percentage).toFixed(2)}%</strong>
                        </td>
                        <td>
                          {/* Clickable Active/Inactive badge — opens
                              the confirm modal then PATCHes the new
                              value. Mirrors /contract-rate. */}
                          <Badge
                            bg={r.active ? "success" : "danger"}
                            style={{ cursor: "pointer" }}
                            onClick={() => handleStatusToggle(r)}
                            title={`Click to ${
                              r.active ? "deactivate" : "activate"
                            } configuration`}
                          >
                            {r.active ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        {/* <td className="text-muted small">
                          {r.remarks || "—"}
                        </td> */}
                        <td>
                          <div className="d-flex gap-2">
                            <Button
                              size="sm"
                              variant="outline-info"
                              className="d-flex align-items-center gap-1"
                              onClick={() => handleView(r.id)}
                              title="View"
                            >
                              <FaEye /> View
                            </Button>
                            <Button
                              size="sm"
                              variant="outline-primary"
                              className="d-flex align-items-center gap-1"
                              onClick={() => handleEdit(r.id)}
                              title="Edit"
                            >
                              <FaEdit /> Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline-danger"
                              className="d-flex align-items-center gap-1"
                              onClick={() => handleDelete(r.id)}
                              title="Delete"
                            >
                              <FaTrash /> Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={8}
                        className="text-center py-4 text-muted"
                      >
                        No 24-hour check-in configurations yet for this hotel.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </Card.Body>
          </Card>

          {/* Status-toggle confirmation modal — mirrors /contract-rate.
              Asks the operator to confirm, then PATCHes the new active
              value via updateRowStatus(). */}
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
                {selectedRow?.active ? "deactivate" : "activate"} this
                24-hour check-in configuration?
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
        </main>
      </div>
    </div>
  );
}
