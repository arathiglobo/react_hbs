import React, { useEffect, useMemo, useState } from "react";
import { Card, Form, Table, Spinner, Button, Modal, Badge } from "react-bootstrap";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import BackButton from "../../components/BackButton";
import { FaEdit } from "react-icons/fa";

// Backing endpoints — both super_admin-only:
//   GET /api/super-admin/user-accounts       → list users + current role set
//   PUT /api/super-admin/user-accounts/:id/roles  { roleIds: [] } → replace
//   GET /api/userRoles                       → all roles for the multi-select
export default function RoleAssign() {
  const [rows, setRows] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  // Assign modal state
  const [editing, setEditing] = useState(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState([]);
  const [saving, setSaving] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [usersRes, rolesRes] = await Promise.all([
        axiosInstance.get("/api/super-admin/user-accounts"),
        axiosInstance.get("/api/userRoles"),
      ]);
      setRows(Array.isArray(usersRes.data) ? usersRes.data : []);
      setRoles(Array.isArray(rolesRes.data) ? rolesRes.data : []);
    } catch (e) {
      setError(e.response?.data?.message || "Failed to load user accounts");
      toast.error("Failed to load user accounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const filtered = useMemo(() => {
    const q = (searchTerm || "").trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.name, r.userName, r.userType, (r.roleNames || []).join(",")].some((v) =>
        (v || "").toString().toLowerCase().includes(q)
      )
    );
  }, [rows, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const openEdit = (row) => {
    setEditing(row);
    setSelectedRoleIds(Array.isArray(row.roleIds) ? [...row.roleIds] : []);
  };

  const closeEdit = () => {
    setEditing(null);
    setSelectedRoleIds([]);
    setSaving(false);
  };

  const toggleRole = (roleId) => {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((x) => x !== roleId) : [...prev, roleId]
    );
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await axiosInstance.put(
        `/api/super-admin/user-accounts/${editing.id}/roles`,
        { roleIds: selectedRoleIds }
      );
      // Replace the row in-place with the fresh server-side view (correct
      // roleNames + display name) so the table reflects the save immediately.
      setRows((prev) => prev.map((r) => (r.id === editing.id ? res.data : r)));
      toast.success("Roles updated");
      closeEdit();
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to update roles");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4" style={{ overflow: "auto" }}>
          <div className="d-flex align-items-center mb-3">
            <BackButton />
            <h4 className="mb-0 ms-3" style={{ color: "#2b2b73", fontWeight: 700 }}>
              Role Assign
            </h4>
          </div>

          <Card className="shadow-sm">
            <Card.Header
              className="text-white fw-semibold"
              style={{ background: "#2b2b73", fontSize: "1rem" }}
            >
              User Accounts
            </Card.Header>
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center flex-wrap mb-3 gap-2">
                <div className="d-flex align-items-center">
                  <span className="me-2">Display</span>
                  <Form.Select
                    size="sm"
                    style={{ width: 80 }}
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                  >
                    {[10, 25, 50, 100].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </Form.Select>
                  <span className="ms-2">records</span>
                </div>
                <div className="d-flex align-items-center">
                  <span className="me-2">Search:</span>
                  <Form.Control
                    size="sm"
                    style={{ width: 240 }}
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
              </div>

              {error && (
                <div className="alert alert-danger py-2 mb-3" role="alert">{error}</div>
              )}

              <div className="table-responsive">
                <Table bordered hover size="sm" className="mb-0 align-middle">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: 60 }} className="text-center">S.N</th>
                      <th>Name</th>
                      <th>User Name</th>
                      <th>UserType</th>
                      <th>Status</th>
                      <th>Current Roles</th>
                      <th style={{ width: 100 }} className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="text-center py-4">
                          <Spinner animation="border" size="sm" /> Loading…
                        </td>
                      </tr>
                    ) : pageRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center text-muted py-4">
                          No user accounts
                        </td>
                      </tr>
                    ) : (
                      pageRows.map((row, idx) => (
                        <tr key={row.id}>
                          <td className="text-center">
                            {(currentPage - 1) * pageSize + idx + 1}
                          </td>
                          <td>{row.name || "—"}</td>
                          <td>{row.userName || "—"}</td>
                          <td>{row.userType || ""}</td>
                          <td>
                            {row.active === false ? (
                              <Badge bg="secondary">Inactive</Badge>
                            ) : (
                              <Badge bg="success">Active</Badge>
                            )}
                          </td>
                          <td>
                            {(row.roleNames || []).length === 0 ? (
                              <span className="text-muted small">No roles</span>
                            ) : (
                              (row.roleNames || []).map((rn) => (
                                <Badge
                                  key={rn}
                                  bg="light"
                                  text="dark"
                                  className="me-1 mb-1 border"
                                >
                                  {rn}
                                </Badge>
                              ))
                            )}
                          </td>
                          <td className="text-center">
                            <Button
                              variant="outline-primary"
                              size="sm"
                              title="Assign roles"
                              onClick={() => openEdit(row)}
                            >
                              <FaEdit />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </Table>
              </div>

              <div className="d-flex justify-content-between align-items-center mt-3 small">
                <span className="text-muted">
                  Showing {filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                  {" "}to {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}
                </span>
                <div className="d-flex align-items-center gap-2">
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    disabled={currentPage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </button>
                  <span>Page {currentPage} / {totalPages}</span>
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>
            </Card.Body>
          </Card>

          {/* Assign-roles modal — checkboxes over the full roles master.
              Save replaces the user's role set with the checked ids
              (empty = no roles). */}
          <Modal show={!!editing} onHide={closeEdit} centered>
            <Modal.Header closeButton>
              <Modal.Title style={{ fontSize: "1rem" }}>
                Assign roles — {editing?.name || editing?.userName}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              {editing && (
                <>
                  <div className="mb-3 small text-muted">
                    <div><b>User Name:</b> {editing.userName}</div>
                    <div><b>User Type:</b> {editing.userType || "—"}</div>
                  </div>
                  <div className="fw-semibold mb-2 small">Roles</div>
                  <div
                    className="border rounded p-2"
                    style={{ maxHeight: 260, overflowY: "auto" }}
                  >
                    {roles.length === 0 ? (
                      <div className="text-muted small">No roles configured</div>
                    ) : (
                      roles.map((r) => (
                        <Form.Check
                          key={r.id}
                          type="checkbox"
                          id={`role-${r.id}`}
                          label={r.roleName}
                          checked={selectedRoleIds.includes(r.id)}
                          onChange={() => toggleRole(r.id)}
                        />
                      ))
                    )}
                  </div>
                </>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={closeEdit} disabled={saving}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Saving…
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </Modal.Footer>
          </Modal>
        </main>
      </div>
    </div>
  );
}
