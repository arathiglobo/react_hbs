import React, { useEffect, useMemo, useState } from "react";
import { Card, Form, Table, Spinner, Button, Modal, Badge } from "react-bootstrap";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import BackButton from "../../components/BackButton";
import { FaEdit } from "react-icons/fa";
import { Pagination } from "react-bootstrap";

// Windowed page list — first, last, current ± 1, with "…" gaps — so the
// pagination bar doesn't render one button per page and blow out the card
// width once the user-account list gets large.
function getPageWindow(page, totalPages, siblingCount = 1) {
  const totalNumbers = siblingCount * 2 + 5;
  if (totalPages <= totalNumbers) {
    return [...Array(totalPages).keys()].map((n) => n + 1);
  }
  const left = Math.max(page - siblingCount, 2);
  const right = Math.min(page + siblingCount, totalPages - 1);
  const pages = [1];
  if (left > 2) pages.push("…");
  for (let p = left; p <= right; p++) pages.push(p);
  if (right < totalPages - 1) pages.push("…");
  pages.push(totalPages);
  return pages;
}

// Pink pill pagination — "‹  1  2  …  126  ›" with pink page numbers on a
// white bordered pill, solid pink fill on the active page, and a muted gray
// pill for the "…" gap — same component/style used on LoginLogs.
function PillPagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;
  const pages = getPageWindow(page, totalPages);

  return (
    <div className="d-flex align-items-center gap-2 flex-shrink-0">
      <button
        type="button"
        className="pill-nav-btn"
        disabled={page === 1}
        onClick={() => onPageChange(page - 1)}
        aria-label="Previous page"
      >
        ‹
      </button>
      {pages.map((p, idx) =>
        p === "…" ? (
          <span key={`ellipsis-${idx}`} className="pill-ellipsis" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            className={`pill-page-btn${p === page ? " active" : ""}`}
            onClick={() => onPageChange(p)}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        className="pill-nav-btn"
        disabled={page === totalPages}
        onClick={() => onPageChange(page + 1)}
        aria-label="Next page"
      >
        ›
      </button>

      <style>{`
        .pill-page-btn, .pill-nav-btn {
          min-width: 36px;
          height: 36px;
          padding: 0 10px;
          border-radius: 8px;
          border: 1px solid #eef0f3;
          background: #fff;
          font-size: 0.9rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
        }
        .pill-page-btn {
          color: #e91e63;
          font-weight: 600;
        }
        .pill-nav-btn {
          color: #9aa0ab;
        }
        .pill-page-btn:hover:not(.active),
        .pill-nav-btn:hover:not(:disabled) {
          border-color: #d1d5db;
          background: #f9fafb;
        }
        .pill-nav-btn:disabled {
          color: #d1d5db;
          background: #f9fafb;
          cursor: not-allowed;
        }
        .pill-page-btn.active {
          background: #e91e63;
          border-color: #e91e63;
          color: #fff;
        }
        .pill-ellipsis {
          min-width: 36px;
          height: 36px;
          border-radius: 8px;
          background: #f0f1f4;
          color: #9aa0ab;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
      `}</style>
    </div>
  );
}

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
        <main className="flex-grow-1 p-4">
          <Card className="shadow-sm rounded-xl">
            {/* Header mirrors UserRoles/LoginLogs: BackButton + title on the
                left, search in the middle, primary action on the right. */}
            <Card.Header className="d-flex flex-column flex-sm-row gap-2 justify-content-between align-items-stretch align-items-sm-center">
              <span className="d-flex align-items-center gap-2">
                <BackButton fallback="/adminDashboard" />
                <span className="fw-semibold">Role Assign</span>
              </span>
              <Form.Group className="hotel-search-bar flex-grow-1 flex-sm-grow-0">
                <Form.Control
                  type="text"
                  placeholder="Search by name, username, type or role..."
                  className="form-control-modern-sm"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                />
              </Form.Group>
              {/* <Button className="btn-green" onClick={loadAll} disabled={loading}>
                {loading ? "Refreshing..." : "↻ Refresh"}
              </Button> */}
            </Card.Header>

            <Card.Body className="p-0">
              {error && (
                <div className="alert alert-danger py-2 m-3 mb-0" role="alert">
                  {error}
                </div>
              )}

              {/* <div className="d-flex justify-content-end align-items-center px-3 pt-3">
                <span className="me-2 small text-muted">Show</span>
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
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Form.Select>
                <span className="ms-2 small text-muted">records</span>
              </div> */}

              <Table responsive hover striped className="mb-0 align-middle mt-2">
                <thead>
                  <tr>
                    <th style={{ width: 60 }} className="text-center">
                      S/N
                    </th>
                    <th>Name</th>
                    <th>User Name</th>
                    <th>User Type</th>
                    <th>Status</th>
                    <th>Current Roles</th>
                    <th style={{ width: 100 }} className="text-center">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="text-center text-muted py-4">
                        <Spinner animation="border" size="sm" className="me-2" />
                        Loading user accounts...
                      </td>
                    </tr>
                  ) : pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center text-muted py-4">
                        No user accounts found.
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
                        <td>{row.userType || "—"}</td>
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
                          <FaEdit
                            className="text-primary"
                            style={{ cursor: "pointer", fontSize: "18px" }}
                            onClick={() => openEdit(row)}
                            title="Assign roles"
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>

              <div
                className="d-flex justify-content-between align-items-center p-3 border-top flex-nowrap"
                style={{ overflowX: "auto" }}
              >
                <small className="text-muted text-nowrap me-3">
                  Showing {pageRows.length} of {filtered.length} accounts
                </small>
               <Pagination className="mb-0 flex-nowrap">
  <Pagination.Prev
    disabled={currentPage === 1}
    onClick={() => setPage((p) => Math.max(1, p - 1))}
  />

  {getPageWindow(currentPage, totalPages).map((p, idx) =>
    p === "…" ? (
      <Pagination.Ellipsis key={`ellipsis-${idx}`} disabled />
    ) : (
      <Pagination.Item
        key={p}
        active={p === currentPage}
        onClick={() => setPage(p)}
      >
        {p}
      </Pagination.Item>
    )
  )}

  <Pagination.Next
    disabled={currentPage === totalPages}
    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
  />
</Pagination>
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
              <Button className="btn-indigo" onClick={handleSave} disabled={saving}>
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