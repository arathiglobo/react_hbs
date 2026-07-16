import React, { useEffect, useState } from "react";
import { Card, Button, Table, Modal, Form, Row, Col, Badge, InputGroup } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../../components/Sidebar";
import Topbar from "../../../components/TopBar";
import BackButton from "../../../components/BackButton";
import axiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";
import { FaEdit, FaKey, FaCheck, FaTimes, FaCopy, FaListUl } from "react-icons/fa";

const BASE = "/api/super-admin/api-access/clients";

const emptyCreate = {
  clientCode: "",
  clientName: "",
  contactEmail: "",
  rateLimitPerMinute: "",
  expiresOn: "",
  notes: "",
};

const emptyEdit = {
  clientName: "",
  contactEmail: "",
  rateLimitPerMinute: "",
  expiresOn: "",
  notes: "",
  isActive: true,
};

export default function ApiClientList() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreate);
  const [saving, setSaving] = useState(false);

  const [showEdit, setShowEdit] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyEdit);

  const [keyReveal, setKeyReveal] = useState(null); // { rawApiKey, client, mode: 'create' | 'regenerate' }

  const fetchList = async () => {
    setIsLoading(true);
    try {
      const res = await axiosInstance.get(BASE);
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast.error("Failed to load clients");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchList(); }, []);

  const openCreate = () => {
    setCreateForm(emptyCreate);
    setShowCreate(true);
  };

  const submitCreate = async () => {
    if (!createForm.clientCode.trim() || !createForm.clientName.trim()) {
      return toast.error("Client code and name are required");
    }
    setSaving(true);
    try {
      const payload = {
        ...createForm,
        rateLimitPerMinute: createForm.rateLimitPerMinute
          ? Number(createForm.rateLimitPerMinute) : null,
        expiresOn: createForm.expiresOn || null,
      };
      const res = await axiosInstance.post(BASE, payload);
      setShowCreate(false);
      await fetchList();
      setKeyReveal({
        rawApiKey: res.data?.rawApiKey,
        client: res.data?.client,
        mode: "create",
      });
    } catch (e) {
      const msg = e?.response?.data?.message || e?.response?.data || "Save failed";
      toast.error(typeof msg === "string" ? msg : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setEditForm({
      clientName: row.clientName || "",
      contactEmail: row.contactEmail || "",
      rateLimitPerMinute: row.rateLimitPerMinute ?? "",
      expiresOn: row.expiresOn ? row.expiresOn.substring(0, 16) : "",
      notes: row.notes || "",
      isActive: row.isActive !== false,
    });
    setShowEdit(true);
  };

  const submitEdit = async () => {
    setSaving(true);
    try {
      const payload = {
        ...editForm,
        rateLimitPerMinute: editForm.rateLimitPerMinute === ""
          ? null : Number(editForm.rateLimitPerMinute),
        expiresOn: editForm.expiresOn || null,
      };
      await axiosInstance.put(`${BASE}/${editingId}`, payload);
      toast.success("Client updated");
      setShowEdit(false);
      setEditingId(null);
      await fetchList();
    } catch (e) {
      const msg = e?.response?.data?.message || e?.response?.data || "Update failed";
      toast.error(typeof msg === "string" ? msg : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row) => {
    try {
      if (row.isActive) {
        await axiosInstance.post(`${BASE}/${row.id}/deactivate`);
        toast.success("Client deactivated");
      } else {
        await axiosInstance.post(`${BASE}/${row.id}/activate`);
        toast.success("Client activated");
      }
      await fetchList();
    } catch {
      toast.error("Status change failed");
    }
  };

  const confirmDeactivate = (row) => {
    Swal.fire({
      title: `Deactivate ${row.clientName}?`,
      text: "Their API key will stop working immediately.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#EC0B43",
      cancelButtonColor: "#6c757d",
      confirmButtonText: "Yes, deactivate",
    }).then((r) => { if (r.isConfirmed) toggleActive(row); });
  };

  const confirmRegenerate = (row) => {
    Swal.fire({
      title: `Regenerate key for ${row.clientName}?`,
      html: "The current key becomes invalid <b>immediately</b>. You must share the new key with the client.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#EC0B43",
      cancelButtonColor: "#6c757d",
      confirmButtonText: "Yes, regenerate",
    }).then(async (r) => {
      if (!r.isConfirmed) return;
      try {
        const res = await axiosInstance.post(`${BASE}/${row.id}/regenerate-key`);
        await fetchList();
        setKeyReveal({
          rawApiKey: res.data?.rawApiKey,
          client: res.data?.client,
          mode: "regenerate",
        });
      } catch {
        toast.error("Regenerate failed");
      }
    });
  };

  const copyKey = () => {
    if (!keyReveal?.rawApiKey) return;
    navigator.clipboard.writeText(keyReveal.rawApiKey)
      .then(() => toast.success("Copied to clipboard"))
      .catch(() => toast.error("Copy failed — select and copy manually"));
  };

  const fmtDate = (s) => (s ? new Date(s).toLocaleString() : "—");

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Card className="shadow-sm rounded-xl">
            <Card.Header className="d-flex flex-column flex-sm-row gap-2 justify-content-between align-items-stretch align-items-sm-center">
              <span className="d-flex align-items-center gap-2">
                <BackButton fallback="/adminDashboard" />
                <span className="fw-semibold">API Clients</span>
                <small className="text-muted d-none d-md-inline">
                  External systems consuming your APIs
                </small>
              </span>
              <Button className="btn-green" onClick={openCreate}>
                + Create Client
              </Button>
            </Card.Header>
            <Card.Body className="p-0">
              <Table responsive hover striped className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th style={{ width: 60 }}>S/N</th>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Contact</th>
                    <th>Key</th>
                    <th style={{ width: 100 }}>Status</th>
                    <th>Rate/min</th>
                    <th>Expires</th>
                    <th style={{ width: 210 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row, idx) => (
                    <tr key={row.id}>
                      <td>{idx + 1}</td>
                      <td><code>{row.clientCode}</code></td>
                      <td>{row.clientName}</td>
                      <td><small>{row.contactEmail || "—"}</small></td>
                      <td>
                        <code>{row.apiKeyPrefix}</code>
                        <small className="text-muted">…</small>
                      </td>
                      <td>
                        {row.isActive
                          ? <Badge bg="success">Active</Badge>
                          : <Badge bg="secondary">Inactive</Badge>}
                      </td>
                      <td>{row.rateLimitPerMinute ?? "—"}</td>
                      <td><small>{fmtDate(row.expiresOn)}</small></td>
                      <td>
                        <div className="d-flex gap-3 align-items-center">
                          <FaListUl
                            className="text-primary"
                            style={{ cursor: "pointer", fontSize: 18 }}
                            title="Manage permissions"
                            onClick={() => navigate(`/super-admin/api-access/clients/${row.id}/permissions`)}
                          />
                          <FaEdit
                            className="text-primary"
                            style={{ cursor: "pointer", fontSize: 18 }}
                            title="Edit"
                            onClick={() => openEdit(row)}
                          />
                          <FaKey
                            className="text-warning"
                            style={{ cursor: "pointer", fontSize: 18 }}
                            title="Regenerate key"
                            onClick={() => confirmRegenerate(row)}
                          />
                          {row.isActive
                            ? <FaTimes
                                className="text-danger"
                                style={{ cursor: "pointer", fontSize: 18 }}
                                title="Deactivate"
                                onClick={() => confirmDeactivate(row)}
                              />
                            : <FaCheck
                                className="text-success"
                                style={{ cursor: "pointer", fontSize: 18 }}
                                title="Activate"
                                onClick={() => toggleActive(row)}
                              />}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {isLoading && (
                    <tr>
                      <td colSpan={9} className="text-center text-muted py-4">
                        <div className="spinner-border spinner-border-sm me-2" role="status" />
                        Loading…
                      </td>
                    </tr>
                  )}
                  {!isLoading && items.length === 0 && (
                    <tr>
                      <td colSpan={9} className="text-center text-muted py-4">
                        No clients yet. Click <b>+ Create Client</b> to onboard one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </main>
      </div>

      {/* Create modal */}
      <Modal show={showCreate} onHide={() => !saving && setShowCreate(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Create API Client</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Row className="g-3">
            <Col md={6}>
              <Form.Group>
                <Form.Label>Client Code *</Form.Label>
                <Form.Control
                  placeholder="ACME_TRAVEL"
                  value={createForm.clientCode}
                  onChange={(e) => setCreateForm({ ...createForm, clientCode: e.target.value })}
                  disabled={saving}
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>Client Name *</Form.Label>
                <Form.Control
                  placeholder="Acme Travel Ltd."
                  value={createForm.clientName}
                  onChange={(e) => setCreateForm({ ...createForm, clientName: e.target.value })}
                  disabled={saving}
                />
              </Form.Group>
            </Col>
            <Col md={12}>
              <Form.Group>
                <Form.Label>Contact Email</Form.Label>
                <Form.Control
                  type="email"
                  placeholder="ops@acmetravel.com"
                  value={createForm.contactEmail}
                  onChange={(e) => setCreateForm({ ...createForm, contactEmail: e.target.value })}
                  disabled={saving}
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>Rate Limit (per minute)</Form.Label>
                <Form.Control
                  type="number"
                  min="0"
                  placeholder="Leave blank for no limit"
                  value={createForm.rateLimitPerMinute}
                  onChange={(e) => setCreateForm({ ...createForm, rateLimitPerMinute: e.target.value })}
                  disabled={saving}
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>Expires On</Form.Label>
                <Form.Control
                  type="datetime-local"
                  value={createForm.expiresOn}
                  onChange={(e) => setCreateForm({ ...createForm, expiresOn: e.target.value })}
                  disabled={saving}
                />
              </Form.Group>
            </Col>
            <Col md={12}>
              <Form.Group>
                <Form.Label>Notes</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  value={createForm.notes}
                  onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                  disabled={saving}
                />
              </Form.Group>
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowCreate(false)} disabled={saving}>Cancel</Button>
          <Button className="btn-green" onClick={submitCreate} disabled={saving}>
            {saving ? "Creating…" : "Create & Generate Key"}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Edit modal */}
      <Modal show={showEdit} onHide={() => !saving && setShowEdit(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Edit Client</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Row className="g-3">
            <Col md={12}>
              <Form.Group>
                <Form.Label>Client Name</Form.Label>
                <Form.Control
                  value={editForm.clientName}
                  onChange={(e) => setEditForm({ ...editForm, clientName: e.target.value })}
                  disabled={saving}
                />
              </Form.Group>
            </Col>
            <Col md={12}>
              <Form.Group>
                <Form.Label>Contact Email</Form.Label>
                <Form.Control
                  type="email"
                  value={editForm.contactEmail}
                  onChange={(e) => setEditForm({ ...editForm, contactEmail: e.target.value })}
                  disabled={saving}
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>Rate Limit (per minute)</Form.Label>
                <Form.Control
                  type="number"
                  min="0"
                  value={editForm.rateLimitPerMinute}
                  onChange={(e) => setEditForm({ ...editForm, rateLimitPerMinute: e.target.value })}
                  disabled={saving}
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>Expires On</Form.Label>
                <Form.Control
                  type="datetime-local"
                  value={editForm.expiresOn}
                  onChange={(e) => setEditForm({ ...editForm, expiresOn: e.target.value })}
                  disabled={saving}
                />
              </Form.Group>
            </Col>
            <Col md={12}>
              <Form.Group>
                <Form.Label>Status</Form.Label>
                <Form.Check
                  type="switch"
                  id="edit-active"
                  label={editForm.isActive ? "Active" : "Inactive"}
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                  disabled={saving}
                />
              </Form.Group>
            </Col>
            <Col md={12}>
              <Form.Group>
                <Form.Label>Notes</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  disabled={saving}
                />
              </Form.Group>
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowEdit(false)} disabled={saving}>Cancel</Button>
          <Button className="btn-green" onClick={submitEdit} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* One-time key reveal */}
      <Modal show={!!keyReveal} onHide={() => setKeyReveal(null)} centered backdrop="static" keyboard={false}>
        <Modal.Header>
          <Modal.Title>
            {keyReveal?.mode === "regenerate" ? "New API Key" : "API Client Created"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-2">
            Client: <b>{keyReveal?.client?.clientName}</b>
            {" "}
            (<code>{keyReveal?.client?.clientCode}</code>)
          </p>
          <div className="alert alert-warning py-2 small mb-3">
            This key is shown <b>only once</b>. Copy it now and share it securely with the client.
            If lost, you must regenerate — the old value is unrecoverable.
          </div>
          <Form.Label>API Key</Form.Label>
          <InputGroup>
            <Form.Control
              value={keyReveal?.rawApiKey || ""}
              readOnly
              style={{ fontFamily: "monospace" }}
              onFocus={(e) => e.target.select()}
            />
            <Button variant="outline-primary" onClick={copyKey}>
              <FaCopy /> Copy
            </Button>
          </InputGroup>
          <div className="mt-3 small text-muted">
            Sent by the client on every request as:{" "}
            <code>X-Api-Key: {keyReveal?.rawApiKey?.substring(0, 12)}…</code>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button className="btn-green" onClick={() => setKeyReveal(null)}>Done</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
