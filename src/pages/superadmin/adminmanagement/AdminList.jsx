import React, { useEffect, useState } from "react";
import { Card, Table, Badge, Form, Button, Modal, InputGroup } from "react-bootstrap";
import { FaTrash, FaUserPlus, FaEye, FaEyeSlash } from "react-icons/fa";
import Swal from "sweetalert2";
import Sidebar from "../../../components/Sidebar";
import Topbar from "../../../components/TopBar";
import BackButton from "../../../components/BackButton";
import axiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";

/**
 * SUPER_ADMIN-only screen that lists every ADMIN login and lets the
 * super_admin bind each one to a company. The company assignment is
 * inherited by every AGENT the admin creates from that point onward
 * (see UserAccountService.createAgentUser). At hotel-search time
 * HotelApiCallerContext.applyCompanySupplierRestriction resolves the
 * agent → admin → company chain to a per-company API allow-list.
 *
 * Backend endpoints:
 *   GET    /api/super-admin/admins                      list admins
 *   POST   /api/super-admin/admins                      create admin (username + password)
 *   DELETE /api/super-admin/admins/{id}                 delete admin
 *   PATCH  /api/super-admin/admins/{id}/company         assign / clear company
 *   GET    /api/companyProfile                          picker source
 */
const ADMINS_URL = "/api/super-admin/admins";
const COMPANIES_URL = "/api/companyProfile";

// Mirror of the backend password rule in CreateAdminRequestDTO — one upper,
// one lower, one digit, one special (@$!%*?&); min 8 chars. Kept in sync
// with UserDTO.password so admins created here obey the same policy as
// everyone registering via /auth/register.
const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/;
const EMPTY_CREATE_FORM = { username: "", password: "" };

export default function AdminList() {
  const [admins, setAdmins] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  // Pending picks are held per-row so a single Save click writes them.
  // Undefined = no change yet; anything else (including "") = user picked.
  const [pending, setPending] = useState({});
  const [savingId, setSavingId] = useState(null);
  // Create-admin modal state — independent from the company-assignment flow above.
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [createError, setCreateError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submittingCreate, setSubmittingCreate] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const fetchAdmins = async () => {
    setIsLoading(true);
    try {
      const res = await axiosInstance.get(ADMINS_URL);
      setAdmins(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast.error("Failed to load admins");
      setAdmins([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const res = await axiosInstance.get(COMPANIES_URL, {
        params: { page: 0, size: 200 },
      });
      const rows = Array.isArray(res.data) ? res.data : (res.data?.content || []);
      setCompanies(rows);
    } catch {
      setCompanies([]);
    }
  };

  useEffect(() => {
    fetchAdmins();
    fetchCompanies();
  }, []);

  const companyLabel = (id) => {
    if (id == null) return "";
    const c = companies.find((x) => String(x.companyProfileId) === String(id));
    if (!c) return `#${id}`;
    return c.companyCode ? `${c.companyName} (${c.companyCode})` : c.companyName;
  };

  const pickedFor = (row) =>
    Object.prototype.hasOwnProperty.call(pending, row.id)
      ? pending[row.id]
      : (row.companyProfileId ?? "");

  const isDirty = (row) => {
    const cur = row.companyProfileId ?? "";
    const next = pickedFor(row);
    // Compare as strings — <select> yields strings for numeric ids.
    return String(cur) !== String(next);
  };

  const openCreate = () => {
    setCreateForm(EMPTY_CREATE_FORM);
    setCreateError("");
    setShowPassword(false);
    setShowCreate(true);
  };

  const closeCreate = () => {
    if (submittingCreate) return;
    setShowCreate(false);
  };

  const submitCreate = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const username = (createForm.username || "").trim();
    const password = createForm.password || "";
    if (!USERNAME_REGEX.test(username)) {
      setCreateError("Username may contain only letters, digits, and underscores.");
      return;
    }
    // Case-insensitive uniqueness check against the currently loaded list.
    // The backend also enforces this (existsByUsernameIgnoreCase); this is
    // just a fast client-side bail-out so the user sees the error without
    // a round-trip. Cross-role collisions (e.g. an existing AGENT with the
    // same username) are still caught by the backend.
    const usernameLc = username.toLowerCase();
    if (admins.some((a) => (a.username || "").toLowerCase() === usernameLc)) {
      setCreateError(`Username '${username}' is already taken.`);
      return;
    }
    if (password.length < 8) {
      setCreateError("Password must be at least 8 characters long.");
      return;
    }
    if (!PASSWORD_REGEX.test(password)) {
      // Diagnose exactly which rule failed so the user isn't guessing.
      const missing = [];
      if (!/[A-Z]/.test(password)) missing.push("an uppercase letter");
      if (!/[a-z]/.test(password)) missing.push("a lowercase letter");
      if (!/\d/.test(password)) missing.push("a digit");
      if (!/[@$!%*?&]/.test(password)) missing.push("a special character (@ $ ! % * ? &)");
      const disallowed = password.replace(/[A-Za-z\d@$!%*?&]/g, "");
      if (disallowed.length > 0) {
        const unique = Array.from(new Set(disallowed.split(""))).join(" ");
        setCreateError(
          `Password contains characters that are not allowed: ${unique}. ` +
          "Allowed: letters, digits, and one of @ $ ! % * ? & — no other symbols (e.g. # _ . -)."
        );
      } else if (missing.length > 0) {
        setCreateError(`Password is missing ${missing.join(", ")}.`);
      } else {
        setCreateError("Password does not meet the required policy.");
      }
      return;
    }
    setCreateError("");
    setSubmittingCreate(true);
    try {
      await axiosInstance.post(ADMINS_URL, { username, password });
      toast.success(`Admin '${username}' created`);
      setShowCreate(false);
      setCreateForm(EMPTY_CREATE_FORM);
      await fetchAdmins();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data ||
        "Failed to create admin";
      setCreateError(typeof msg === "string" ? msg : "Failed to create admin");
    } finally {
      setSubmittingCreate(false);
    }
  };

  const confirmDelete = (row) => {
    Swal.fire({
      title: `Delete admin '${row.username}'?`,
      html:
        "This removes the login and its company assignment. " +
        "Any agents this admin already created will keep working.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#EC0B43",
      cancelButtonColor: "#6c757d",
      confirmButtonText: "Yes, delete",
    }).then(async (r) => {
      if (!r.isConfirmed) return;
      setDeletingId(row.id);
      try {
        await axiosInstance.delete(`${ADMINS_URL}/${row.id}`);
        toast.success("Admin deleted");
        // Also drop any pending company pick for this row so state stays clean.
        setPending((p) => {
          const { [row.id]: _drop, ...rest } = p;
          return rest;
        });
        await fetchAdmins();
      } catch (err) {
        const msg =
          err?.response?.data?.message ||
          err?.response?.data ||
          "Delete failed";
        toast.error(typeof msg === "string" ? msg : "Delete failed");
      } finally {
        setDeletingId(null);
      }
    });
  };

  const saveRow = async (row) => {
    const next = pickedFor(row);
    const body = { companyProfileId: next === "" ? null : Number(next) };
    setSavingId(row.id);
    try {
      const res = await axiosInstance.patch(`${ADMINS_URL}/${row.id}/company`, body);
      setAdmins((list) => list.map((r) => (r.id === row.id ? res.data : r)));
      setPending((p) => {
        const { [row.id]: _, ...rest } = p;
        return rest;
      });
      toast.success("Company assignment saved");
    } catch (e) {
      const msg = e?.response?.data?.message || e?.response?.data || "Save failed";
      toast.error(typeof msg === "string" ? msg : "Save failed");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Card className="shadow-sm rounded-xl">
            <Card.Header className="d-flex align-items-center gap-2">
              <BackButton fallback="/superAdminDashboard" />
              <span className="fw-semibold">Admin Management</span>
              <small className="text-muted d-none d-md-inline">
                Bind an ADMIN login to a company — every agent the admin
                creates from now on inherits the company's API restrictions.
              </small>
              <Button
                size="sm"
                variant="primary"
                className="ms-auto d-inline-flex align-items-center gap-1"
                onClick={openCreate}
              >
                <FaUserPlus /> Create Admin
              </Button>
            </Card.Header>
            <Card.Body className="p-0">
              <Table responsive hover striped className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th style={{ width: 60 }}>S/N</th>
                    <th>Username</th>
                    <th style={{ width: 100 }}>Status</th>
                    <th>Current Company</th>
                    <th>Assign Company</th>
                    <th style={{ width: 160 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map((row, idx) => (
                    <tr key={row.id}>
                      <td>{idx + 1}</td>
                      <td>{row.username}</td>
                      <td>
                        {row.active
                          ? <Badge bg="success">Active</Badge>
                          : <Badge bg="secondary">Inactive</Badge>}
                      </td>
                      <td>
                        {row.companyProfileId
                          ? <small>{companyLabel(row.companyProfileId)}</small>
                          : <small className="text-muted">— unassigned (unrestricted)</small>}
                      </td>
                      <td>
                        <Form.Select
                          size="sm"
                          value={pickedFor(row)}
                          onChange={(e) =>
                            setPending((p) => ({ ...p, [row.id]: e.target.value }))
                          }
                          disabled={savingId === row.id}
                        >
                          <option value="">— None (unrestricted) —</option>
                          {companies.map((c) => (
                            <option key={c.companyProfileId} value={c.companyProfileId}>
                              {c.companyName}
                              {c.companyCode ? ` (${c.companyCode})` : ""}
                            </option>
                          ))}
                        </Form.Select>
                      </td>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <Button
                            size="sm"
                            className="btn-green"
                            disabled={!isDirty(row) || savingId === row.id}
                            onClick={() => saveRow(row)}
                          >
                            {savingId === row.id ? "Saving…" : "Save"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline-danger"
                            title="Delete admin"
                            disabled={deletingId === row.id}
                            onClick={() => confirmDelete(row)}
                          >
                            {deletingId === row.id
                              ? <span className="spinner-border spinner-border-sm" role="status" />
                              : <FaTrash />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {isLoading && (
                    <tr>
                      <td colSpan={6} className="text-center text-muted py-4">
                        <div className="spinner-border spinner-border-sm me-2" role="status" />
                        Loading…
                      </td>
                    </tr>
                  )}
                  {!isLoading && admins.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center text-muted py-4">
                        No admin accounts found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </main>
      </div>

      <Modal show={showCreate} onHide={closeCreate} centered backdrop="static">
        <Form onSubmit={submitCreate}>
          <Modal.Header closeButton={!submittingCreate}>
            <Modal.Title>Create Admin</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3" controlId="createAdminUsername">
              <Form.Label>Username</Form.Label>
              <Form.Control
                type="text"
                autoComplete="off"
                autoFocus
                value={createForm.username}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, username: e.target.value }))
                }
                disabled={submittingCreate}
                placeholder="e.g. admin_kochi"
              />
              <Form.Text className="text-muted">
                Letters, digits, and underscores only. No dots.
              </Form.Text>
            </Form.Group>
            <Form.Group className="mb-3" controlId="createAdminPassword">
              <Form.Label>Password</Form.Label>
              <InputGroup>
                <Form.Control
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={createForm.password}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, password: e.target.value }))
                  }
                  disabled={submittingCreate}
                />
                <Button
                  variant="outline-secondary"
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  disabled={submittingCreate}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </Button>
              </InputGroup>
              <Form.Text className="text-muted">
                Min 8 chars. Must include uppercase, lowercase, digit, and
                one of <code>@ $ ! % * ? &amp;</code>. Other symbols
                (e.g. <code>#</code> <code>_</code> <code>.</code>
                {" "}<code>-</code>) are <strong>not allowed</strong>.
              </Form.Text>
            </Form.Group>
            {createError && (
              <div className="alert alert-danger py-2 mb-0" role="alert">
                {createError}
              </div>
            )}
            <small className="text-muted d-block mt-2">
              Company assignment is a separate step — pick one from the row's
              dropdown after the admin is created.
            </small>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="secondary"
              onClick={closeCreate}
              disabled={submittingCreate}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={submittingCreate}
            >
              {submittingCreate ? "Creating…" : "Create Admin"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}
