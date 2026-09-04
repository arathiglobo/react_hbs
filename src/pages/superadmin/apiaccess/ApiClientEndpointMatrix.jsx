import React, { useEffect, useMemo, useState } from "react";
import { Table, Form, Badge, Button, Modal } from "react-bootstrap";
import axiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";

/**
 * Endpoint permission matrix — controls which platform endpoints this
 * client is allowed to call at all. Sibling of ApiClientSupplierMatrix.
 *
 * <p>Toggles now auto-save with a confirmation dialog. The old deferred
 * "click Save later" flow was easy to forget — flipping a switch and
 * closing the tab would silently lose the change. Every toggle now opens
 * an "Are you sure?" modal; confirming pushes the change to the backend
 * immediately, so unsaved dirty state cannot exist.</p>
 *
 * Renders as a tab body inside the client permission page — receives
 * clientId as a prop, no page chrome of its own.
 */
const BASE = (id) => `/api/super-admin/api-access/clients/${id}/permissions`;

export default function ApiClientEndpointMatrix({ clientId }) {
  const [matrix, setMatrix] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  // Pending confirmation. Shape:
  //   { kind: 'single'|'bulk', target: boolean, rows: [row], label: string }
  const [pending, setPending] = useState(null);

  const fetchMatrix = async () => {
    if (!clientId) return;
    setIsLoading(true);
    try {
      const res = await axiosInstance.get(BASE(clientId));
      setMatrix(res.data);
    } catch {
      toast.error("Failed to load permission matrix");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchMatrix(); /* eslint-disable-next-line */ }, [clientId]);

  const rows = matrix?.rows || [];

  const grouped = useMemo(() => {
    const g = new Map();
    for (const r of rows) {
      const cat = r.category || "General";
      if (!g.has(cat)) g.set(cat, []);
      g.get(cat).push(r);
    }
    return Array.from(g.entries());
  }, [rows]);

  const currentEnabled = (row) => !!row.isEnabled;

  const requestToggle = (row) => {
    const next = !currentEnabled(row);
    setPending({
      kind: "single",
      target: next,
      rows: [row],
      label: row.endpointName || row.endpointCode,
    });
  };

  const requestCategoryToggle = (category, categoryRows, target) => {
    // Only send rows that actually need to flip.
    const changing = categoryRows.filter((r) => currentEnabled(r) !== target);
    if (changing.length === 0) return;
    setPending({
      kind: "bulk",
      target,
      rows: changing,
      label:
        `${changing.length} endpoint${changing.length === 1 ? "" : "s"} in ` +
        `“${category}”`,
    });
  };

  const cancelPending = () => setPending(null);

  const confirmPending = async () => {
    if (!pending || pending.rows.length === 0) return;
    setSaving(true);
    try {
      const items = pending.rows.map((row) => ({
        endpointId: row.endpointId,
        isEnabled: !!pending.target,
        enabledFrom: row.enabledFrom || null,
        enabledTill: row.enabledTill || null,
      }));
      const res = await axiosInstance.put(BASE(clientId), { items });
      setMatrix(res.data);
      toast.success(
        `${pending.target ? "Enabled" : "Disabled"} ${items.length} ` +
          `endpoint${items.length === 1 ? "" : "s"}`,
      );
      setPending(null);
    } catch (e) {
      const msg = e?.response?.data?.message || "Save failed";
      toast.error(typeof msg === "string" ? msg : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const methodBadge = (m) => {
    const map = { GET: "primary", POST: "success", PUT: "warning", PATCH: "info", DELETE: "danger" };
    return <Badge bg={map[m] || "secondary"}>{m}</Badge>;
  };

  const enabledSummary = () => {
    const total = rows.length;
    let on = 0;
    for (const r of rows) if (currentEnabled(r)) on++;
    return { total, on };
  };
  const { total, on } = enabledSummary();

  return (
    <div>
      <div className="d-flex flex-wrap align-items-center justify-content-between mb-3 border-bottom pb-2">
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <h6 className="mb-0 text-uppercase text-muted">Endpoints</h6>
          <Badge bg={on > 0 ? "success" : "secondary"} pill>{on} / {total} enabled</Badge>
          <span className="text-muted small">
            Changes are saved on confirmation.
          </span>
        </div>
      </div>

      {isLoading && (
        <div className="text-center text-muted py-4">
          <div className="spinner-border spinner-border-sm me-2" role="status" />
          Loading matrix…
        </div>
      )}

      {!isLoading && rows.length === 0 && (
        <div className="alert alert-info mb-0">
          No endpoints are registered in the catalog yet. Add endpoints under{" "}
          <a href="/super-admin/api-access/endpoints">API Endpoint Catalog</a> first.
        </div>
      )}

      {!isLoading && grouped.map(([category, catRows]) => {
        const allOn = catRows.every((r) => currentEnabled(r));
        const noneOn = catRows.every((r) => !currentEnabled(r));
        return (
          <div key={category} className="mb-4">
            <div className="d-flex align-items-center justify-content-between mb-2 border-bottom pb-2">
              <h6 className="mb-0 text-uppercase text-muted">
                {category}
                <span className="ms-2 badge bg-light text-dark">{catRows.length}</span>
              </h6>
              <div className="d-flex gap-2">
                <Button
                  size="sm"
                  variant="outline-success"
                  disabled={saving || allOn}
                  onClick={() => requestCategoryToggle(category, catRows, true)}
                >
                  Enable all
                </Button>
                <Button
                  size="sm"
                  variant="outline-secondary"
                  disabled={saving || noneOn}
                  onClick={() => requestCategoryToggle(category, catRows, false)}
                >
                  Disable all
                </Button>
              </div>
            </div>
            <Table responsive hover className="align-middle mb-0">
              <thead>
                <tr>
                  <th style={{ width: 100 }}>Access</th>
                  <th style={{ width: 90 }}>Method</th>
                  <th>Endpoint</th>
                  <th>URL Pattern</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {catRows.map((row) => {
                  const isOn = currentEnabled(row);
                  return (
                    <tr key={row.endpointId}>
                      <td>
                        <Form.Check
                          type="switch"
                          id={`perm-${row.endpointId}`}
                          checked={isOn}
                          disabled={saving}
                          onChange={() => requestToggle(row)}
                          label={isOn ? "Enabled" : "Disabled"}
                        />
                      </td>
                      <td>{methodBadge(row.httpMethod)}</td>
                      <td>
                        <div className="fw-semibold">{row.endpointName}</div>
                        <code className="text-muted small">{row.endpointCode}</code>
                      </td>
                      <td><small className="text-muted">{row.urlPattern}</small></td>
                      <td><small>{row.description || <span className="text-muted">—</span>}</small></td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        );
      })}

      <Modal
        show={!!pending}
        onHide={cancelPending}
        centered
        backdrop={saving ? "static" : true}
        keyboard={!saving}
      >
        <Modal.Header closeButton={!saving}>
          <Modal.Title>Confirm endpoint change</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {pending?.kind === "single" ? (
            <>
              Are you sure you want to{" "}
              <b>{pending.target ? "enable" : "disable"}</b>{" "}
              <b>{pending.label}</b> for this client?
            </>
          ) : pending?.kind === "bulk" ? (
            <>
              This will <b>{pending.target ? "enable" : "disable"}</b>{" "}
              <b>{pending.label}</b> at once. Continue?
            </>
          ) : null}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={cancelPending} disabled={saving}>
            Cancel
          </Button>
          <Button className="btn-green" onClick={confirmPending} disabled={saving}>
            {saving ? "Saving…" : "OK, Save"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
