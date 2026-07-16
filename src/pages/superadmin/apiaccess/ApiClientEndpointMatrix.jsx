import React, { useEffect, useMemo, useState } from "react";
import { Table, Form, Badge, Button } from "react-bootstrap";
import axiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";

/**
 * Endpoint permission matrix — controls which platform endpoints this
 * client is allowed to call at all. Sibling of ApiClientSupplierMatrix.
 *
 * Renders as a tab body inside the client permission page — receives
 * clientId as a prop, no page chrome of its own.
 */
const BASE = (id) => `/api/super-admin/api-access/clients/${id}/permissions`;

export default function ApiClientEndpointMatrix({ clientId }) {
  const [matrix, setMatrix] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState({}); // { endpointId: {isEnabled, enabledFrom, enabledTill} }

  const fetchMatrix = async () => {
    if (!clientId) return;
    setIsLoading(true);
    try {
      const res = await axiosInstance.get(BASE(clientId));
      setMatrix(res.data);
      setDirty({});
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

  const currentEnabled = (row) => {
    if (dirty[row.endpointId]) return !!dirty[row.endpointId].isEnabled;
    return !!row.isEnabled;
  };

  const toggle = (row) => {
    const next = !currentEnabled(row);
    setDirty((d) => ({
      ...d,
      [row.endpointId]: {
        isEnabled: next,
        enabledFrom: row.enabledFrom || null,
        enabledTill: row.enabledTill || null,
      },
    }));
  };

  const toggleCategoryAll = (categoryRows, targetEnabled) => {
    const next = { ...dirty };
    for (const row of categoryRows) {
      next[row.endpointId] = {
        isEnabled: !!targetEnabled,
        enabledFrom: row.enabledFrom || null,
        enabledTill: row.enabledTill || null,
      };
    }
    setDirty(next);
  };

  const dirtyCount = Object.keys(dirty).length;

  const save = async () => {
    if (dirtyCount === 0) return;
    setSaving(true);
    try {
      const items = Object.entries(dirty).map(([endpointId, v]) => ({
        endpointId: Number(endpointId),
        isEnabled: !!v.isEnabled,
        enabledFrom: v.enabledFrom || null,
        enabledTill: v.enabledTill || null,
      }));
      const res = await axiosInstance.put(BASE(clientId), { items });
      setMatrix(res.data);
      setDirty({});
      toast.success(`Saved ${items.length} change${items.length === 1 ? "" : "s"}`);
    } catch (e) {
      const msg = e?.response?.data?.message || "Save failed";
      toast.error(typeof msg === "string" ? msg : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const revert = () => setDirty({});

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
          {dirtyCount > 0 && (
            <Badge bg="warning" text="dark" pill>
              {dirtyCount} unsaved change{dirtyCount === 1 ? "" : "s"}
            </Badge>
          )}
        </div>
        <div className="d-flex gap-2">
          <Button size="sm" variant="outline-secondary" onClick={revert} disabled={saving || dirtyCount === 0}>
            Revert
          </Button>
          <Button size="sm" className="btn-green" onClick={save} disabled={saving || dirtyCount === 0}>
            {saving ? "Saving…" : "Save"}
          </Button>
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
                <Button size="sm" variant="outline-success" disabled={allOn}
                  onClick={() => toggleCategoryAll(catRows, true)}>Enable all</Button>
                <Button size="sm" variant="outline-secondary" disabled={noneOn}
                  onClick={() => toggleCategoryAll(catRows, false)}>Disable all</Button>
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
                  const isDirty = !!dirty[row.endpointId];
                  return (
                    <tr key={row.endpointId} className={isDirty ? "table-warning" : ""}>
                      <td>
                        <Form.Check
                          type="switch"
                          id={`perm-${row.endpointId}`}
                          checked={isOn}
                          onChange={() => toggle(row)}
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
    </div>
  );
}
