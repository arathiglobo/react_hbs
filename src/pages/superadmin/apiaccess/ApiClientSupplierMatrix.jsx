import React, { useEffect, useState } from "react";
import { Table, Form, Badge, Button, Modal } from "react-bootstrap";
import axiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";

/**
 * Supplier permission matrix — sibling of ApiClientPermissionMatrix.
 * Controls which upstream APIs (iwtx, atharva, jumeirah, ratehawk,
 * darina, x3, inhouse, goglobal, grn …) are aggregated when this client
 * hits our external endpoints. Pure allow-list: unticked supplier = never
 * queried for this client.
 *
 * <p>Toggles now auto-save with a confirmation dialog. The old deferred
 * "click Save later" flow was easy to forget — flipping a switch and
 * closing the tab would silently lose the change. Every toggle now opens
 * an "Are you sure?" modal; confirming pushes the change to the backend
 * immediately, so unsaved dirty state cannot exist.</p>
 *
 * Rendered as a tab inside the client permission page — receives
 * clientId as a prop, has no own header (the parent supplies it).
 */
const BASE = (id) => `/api/super-admin/api-access/clients/${id}/suppliers`;

export default function ApiClientSupplierMatrix({ clientId }) {
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
      toast.error("Failed to load supplier matrix");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchMatrix(); /* eslint-disable-next-line */ }, [clientId]);

  const rows = matrix?.rows || [];

  const currentEnabled = (row) => !!row.isEnabled;

  const requestToggle = (row) => {
    const next = !currentEnabled(row);
    setPending({
      kind: "single",
      target: next,
      rows: [row],
      label: row.apiName || row.apiCode,
    });
  };

  const requestBulkToggle = (target) => {
    // Only send rows that actually need to flip — no-op rows create noise
    // on the server and clutter the "N changes" message.
    const changing = rows.filter((r) => currentEnabled(r) !== target);
    if (changing.length === 0) return;
    setPending({
      kind: "bulk",
      target,
      rows: changing,
      label: `${changing.length} supplier${changing.length === 1 ? "" : "s"}`,
    });
  };

  const cancelPending = () => setPending(null);

  const confirmPending = async () => {
    if (!pending || pending.rows.length === 0) return;
    setSaving(true);
    try {
      const items = pending.rows.map((row) => ({
        externalApiId: row.externalApiId,
        isEnabled: !!pending.target,
      }));
      const res = await axiosInstance.put(BASE(clientId), { items });
      setMatrix(res.data);
      toast.success(
        `${pending.target ? "Enabled" : "Disabled"} ${items.length} ` +
          `supplier${items.length === 1 ? "" : "s"}`,
      );
      setPending(null);
    } catch (e) {
      const msg = e?.response?.data?.message || "Save failed";
      toast.error(typeof msg === "string" ? msg : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const enabledSummary = () => {
    const total = rows.length;
    let on = 0;
    for (const r of rows) if (currentEnabled(r)) on++;
    return { total, on };
  };
  const { total, on } = enabledSummary();

  const allOn  = rows.length > 0 && rows.every((r) => currentEnabled(r));
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
          <span className="text-muted small">
            Changes are saved on confirmation.
          </span>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline-success"
            onClick={() => requestBulkToggle(true)}
            disabled={saving || allOn}
          >
            Enable all
          </Button>
          <Button
            size="sm"
            variant="outline-secondary"
            onClick={() => requestBulkToggle(false)}
            disabled={saving || noneOn}
          >
            Disable all
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
              return (
                <tr key={row.externalApiId}>
                  <td>
                    <Form.Check
                      type="switch"
                      id={`supp-${row.externalApiId}`}
                      checked={isOn}
                      disabled={saving}
                      onChange={() => requestToggle(row)}
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

      <Modal
        show={!!pending}
        onHide={cancelPending}
        centered
        backdrop={saving ? "static" : true}
        keyboard={!saving}
      >
        <Modal.Header closeButton={!saving}>
          <Modal.Title>Confirm supplier change</Modal.Title>
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
