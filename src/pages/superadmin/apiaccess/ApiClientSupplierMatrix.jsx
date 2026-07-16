import React, { useEffect, useState } from "react";
import { Table, Form, Badge, Button } from "react-bootstrap";
import axiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";

/**
 * Supplier permission matrix — sibling of ApiClientPermissionMatrix.
 * Controls which upstream APIs (iwtx, atharva, jumeirah, ratehawk,
 * darina, x3, inhouse …) are aggregated when this client hits our
 * external endpoints. Pure allow-list: unticked supplier = never
 * queried for this client.
 *
 * Rendered as a tab inside the client permission page — receives
 * clientId as a prop, has no own header (the parent supplies it).
 */
const BASE = (id) => `/api/super-admin/api-access/clients/${id}/suppliers`;

export default function ApiClientSupplierMatrix({ clientId }) {
  const [matrix, setMatrix] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState({}); // { externalApiId: isEnabled }

  const fetchMatrix = async () => {
    if (!clientId) return;
    setIsLoading(true);
    try {
      const res = await axiosInstance.get(BASE(clientId));
      setMatrix(res.data);
      setDirty({});
    } catch {
      toast.error("Failed to load supplier matrix");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchMatrix(); /* eslint-disable-next-line */ }, [clientId]);

  const rows = matrix?.rows || [];

  const currentEnabled = (row) => {
    if (Object.prototype.hasOwnProperty.call(dirty, row.externalApiId)) {
      return !!dirty[row.externalApiId];
    }
    return !!row.isEnabled;
  };

  const toggle = (row) => {
    const next = !currentEnabled(row);
    setDirty((d) => ({ ...d, [row.externalApiId]: next }));
  };

  const setAll = (target) => {
    const next = { ...dirty };
    for (const row of rows) next[row.externalApiId] = !!target;
    setDirty(next);
  };

  const dirtyCount = Object.keys(dirty).length;

  const save = async () => {
    if (dirtyCount === 0) return;
    setSaving(true);
    try {
      const items = Object.entries(dirty).map(([externalApiId, isEnabled]) => ({
        externalApiId: Number(externalApiId),
        isEnabled: !!isEnabled,
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

  const enabledSummary = () => {
    const total = rows.length;
    let on = 0;
    for (const r of rows) if (currentEnabled(r)) on++;
    return { total, on };
  };
  const { total, on } = enabledSummary();

  const allOn = rows.length > 0 && rows.every((r) => currentEnabled(r));
  const noneOn = rows.length > 0 && rows.every((r) => !currentEnabled(r));

  return (
    <div>
      <div className="d-flex flex-wrap align-items-center justify-content-between mb-3 border-bottom pb-2">
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <h6 className="mb-0 text-uppercase text-muted">
            Upstream Suppliers
            <span className="ms-2 badge bg-light text-dark">{rows.length}</span>
          </h6>
          <Badge bg={on > 0 ? "success" : "secondary"} pill>{on} / {total} enabled</Badge>
          {dirtyCount > 0 && (
            <Badge bg="warning" text="dark" pill>
              {dirtyCount} unsaved change{dirtyCount === 1 ? "" : "s"}
            </Badge>
          )}
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <Button size="sm" variant="outline-success" onClick={() => setAll(true)} disabled={allOn}>
            Enable all
          </Button>
          <Button size="sm" variant="outline-secondary" onClick={() => setAll(false)} disabled={noneOn}>
            Disable all
          </Button>
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
          Loading suppliers…
        </div>
      )}

      {!isLoading && rows.length === 0 && (
        <div className="alert alert-info mb-0">
          No active suppliers found in the <code>external_api</code> catalog. Register
          suppliers there first.
        </div>
      )}

      {!isLoading && rows.length > 0 && (
        <Table responsive hover className="align-middle mb-0">
          <thead>
            <tr>
              <th style={{ width: 100 }}>Access</th>
              <th style={{ width: 140 }}>Code</th>
              <th>Supplier</th>
              <th style={{ width: 130 }}>Type</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isOn = currentEnabled(row);
              const isDirty = Object.prototype.hasOwnProperty.call(dirty, row.externalApiId);
              return (
                <tr key={row.externalApiId} className={isDirty ? "table-warning" : ""}>
                  <td>
                    <Form.Check
                      type="switch"
                      id={`supp-${row.externalApiId}`}
                      checked={isOn}
                      onChange={() => toggle(row)}
                      label={isOn ? "Enabled" : "Disabled"}
                    />
                  </td>
                  <td><code>{row.apiCode}</code></td>
                  <td className="fw-semibold">{row.apiName}</td>
                  <td>
                    {row.supplierIsExternal
                      ? <Badge bg="info">External</Badge>
                      : <Badge bg="secondary">In-house</Badge>}
                  </td>
                  <td><small>{row.description || <span className="text-muted">—</span>}</small></td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}
