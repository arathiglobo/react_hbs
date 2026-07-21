import React, { useCallback, useEffect, useState } from "react";
import {
  Card,
  Table,
  Badge,
  Form,
  Button,
  Modal,
  Row,
  Col,
  Nav,
  Tab,
  Spinner,
} from "react-bootstrap";
import Sidebar from "../../../components/Sidebar";
import Topbar from "../../../components/TopBar";
import BackButton from "../../../components/BackButton";
import axiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import { FaKey } from "react-icons/fa";

/**
 * Admin-side API access screen. Shows the APIs super_admin has enabled
 * for this admin's company, and lets the admin:
 *   1. Turn each API on/off (subtractive — never widens super_admin's set)
 *   2. Pick Test vs Live as the active credential set per API
 *   3. Enter Test AND Live credentials per API (schema differs per API)
 *
 * Every request is JWT-scoped to the caller's company by the backend —
 * this page never sends a companyProfileId over the wire.
 */
const BASE = "/api/admin/api-access";

/**
 * Per-API credential form schema. Keys match the JSON payload the backend
 * stores in {@code company_api_credentials.credentials}. Kept on the FE
 * because rendering is UI-side; the BE never introspects the JSON.
 */
const CREDENTIAL_SCHEMAS = {
  RATEHAWK: [
    { key: "baseurl", label: "Base URL (app.ratehawk.baseurl)", type: "text" },
    { key: "username", label: "Username (app.ratehawk.username)", type: "text" },
    { key: "password", label: "Password (app.ratehawk.password)", type: "password" },
  ],
  DARINA: [
    { key: "secStr", label: "Security String", type: "password" },
    { key: "accountName", label: "Account Name", type: "text" },
    { key: "username", label: "Username", type: "text" },
    { key: "password", label: "Password", type: "password" },
    { key: "agentId", label: "Agent ID", type: "text" },
  ],
  IWTX: [
    { key: "url", label: "Search URL", type: "text" },
    { key: "availabilityUrl", label: "Availability URL", type: "text" },
    { key: "password", label: "Password", type: "password" },
    { key: "code", label: "Code", type: "text" },
    { key: "token", label: "Token", type: "password" },
  ],
  X3: [
    { key: "url", label: "Search URL (x3.api.url)", type: "text" },
    { key: "availabilityUrl", label: "Availability URL (x3.api.availability.url)", type: "text" },
    { key: "code", label: "Client Code (x3.api.code)", type: "text" },
    { key: "password", label: "Password (x3.api.password)", type: "password" },
    { key: "token", label: "Token (x3.api.token)", type: "password" },
  ],
  ATHARVA: [
    { key: "baseUrl", label: "Base URL (atharva.api.baseurl)", type: "text" },
    { key: "username", label: "Username (atharva.api.username)", type: "text" },
    { key: "password", label: "Password (atharva.api.password)", type: "password" },
  ],
  JUMEIRAH: [
    { key: "baseUrl", label: "Base URL", type: "text" },
    { key: "subscriptionKey", label: "Subscription Key (Ocp-Apim-Subscription-Key)", type: "password" },
    { key: "promoCode", label: "Promo Code", type: "text" },
    { key: "apiVersion", label: "API Endpoint Path", type: "text" },
  ],
  JUNIPER: [
    { key: "login", label: "Login (juniper.api.login)", type: "text" },
    { key: "password", label: "Password (juniper.api.password)", type: "password" },
    { key: "language", label: "Language (juniper.api.language)", type: "text" },
  ],
  // INHOUSE reads from the app's own DB — no external credentials to set.
  INHOUSE: [],
};

const MASK = "••••••••";

export default function AdminApiAccess() {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [busyRowId, setBusyRowId] = useState(null);

  const [credModal, setCredModal] = useState(null);

  const fetchRows = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await axiosInstance.get(BASE);
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data ||
        "Failed to load API access list";
      toast.error(typeof msg === "string" ? msg : "Failed to load");
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const toggleRow = async (row, nextEnabled) => {
    setBusyRowId(row.externalApiId);
    try {
      await axiosInstance.patch(`${BASE}/${row.externalApiId}/toggle`, {
        enabled: nextEnabled,
      });
      toast.success(
        `${row.apiName || row.apiCode} ${nextEnabled ? "enabled" : "disabled"}`,
      );
      await fetchRows();
    } catch (e) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data ||
        "Toggle failed";
      toast.error(typeof msg === "string" ? msg : "Toggle failed");
    } finally {
      setBusyRowId(null);
    }
  };

  const setActiveEnv = async (row, env) => {
    if (row.activeEnvironment === env) return;
    setBusyRowId(row.externalApiId);
    try {
      await axiosInstance.patch(
        `${BASE}/${row.externalApiId}/active-environment`,
        { environment: env },
      );
      await fetchRows();
    } catch (e) {
      toast.error("Failed to switch environment");
    } finally {
      setBusyRowId(null);
    }
  };

  const openCredModal = (row) => {
    setCredModal({ row, env: row.activeEnvironment || "LIVE" });
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <style>{`
        .adm-aa-card { border: 1px solid #eef0f2; }
        .adm-aa-header {
          background: linear-gradient(180deg,#ffffff 0%,#fafbfc 100%);
          border-bottom: 1px solid #eef0f2;
          padding: 14px 18px;
        }
        .adm-aa-title { font-size: 15px; font-weight: 600; color: #111827; }
        .adm-aa-sub   { font-size: 12px; color: #6b7280; margin-top: 2px; }
        .adm-aa-table thead th {
          text-transform: uppercase; letter-spacing: .04em;
          font-size: 11px; font-weight: 600; color: #6b7280;
          background: #fafbfc; border-top: none;
          padding: 10px 12px !important;
        }
        .adm-aa-table tbody td { padding: 10px 12px !important; vertical-align: middle; }
        .adm-aa-api-name { font-size: 13.5px; font-weight: 600; color: #111827; line-height: 1.2; }
        .adm-aa-api-code {
          display: inline-block; margin-top: 3px;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 11px; color: #6b7280;
          background: #f3f4f6; padding: 1px 6px; border-radius: 4px;
        }
        .adm-aa-seg {
          display: inline-flex; padding: 2px; border-radius: 8px;
          background: #f3f4f6; border: 1px solid #e5e7eb;
        }
        .adm-aa-seg button {
          border: none; background: transparent; padding: 4px 12px;
          font-size: 12px; font-weight: 500; color: #6b7280;
          border-radius: 6px; cursor: pointer; transition: all .12s ease;
        }
        .adm-aa-seg button:disabled { cursor: not-allowed; opacity: .55; }
        .adm-aa-seg button.on {
          background: #ffffff; color: #111827;
          box-shadow: 0 1px 2px rgba(17,24,39,.08);
        }
        .adm-aa-seg button.on.live { color: #059669; }
        .adm-aa-seg button.on.test { color: #d97706; }
        .adm-aa-cred-pair { display: inline-flex; gap: 6px; align-items: center; }
        .adm-aa-cred-pill {
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 11px; font-weight: 500; padding: 2px 8px;
          border-radius: 999px; border: 1px solid transparent;
        }
        .adm-aa-cred-pill.on   { background: #ecfdf5; color: #059669; border-color: #a7f3d0; }
        .adm-aa-cred-pill.off  { background: #f9fafb; color: #9ca3af; border-color: #e5e7eb; }
        .adm-aa-status-switch .form-check-input { margin-top: 0; }
        .adm-aa-status-label {
          font-size: 12px; font-weight: 500; margin-left: 6px;
        }
        .adm-aa-status-label.on  { color: #059669; }
        .adm-aa-status-label.off { color: #9ca3af; }
        .adm-aa-btn-creds {
          font-size: 12px; font-weight: 500; padding: 4px 10px;
          border-radius: 6px;
        }
      `}</style>
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Card className="adm-aa-card shadow-sm rounded-3">
            <div className="adm-aa-header d-flex align-items-center gap-2">
              <BackButton fallback="/adminDashboard" />
              <div className="flex-grow-1">
                <div className="adm-aa-title">API Access</div>
                <div className="adm-aa-sub">
                  Turn suppliers on/off, save Test &amp; Live credentials, and pick which environment is used at booking time.
                </div>
              </div>
            </div>
            <Card.Body className="p-0">
              <Table hover className="adm-aa-table mb-0 align-middle">
                <thead>
                  <tr>
                    <th style={{ width: 44, textAlign: "center" }}>#</th>
                    <th>API</th>
                    <th style={{ width: 140 }}>Status</th>
                    <th style={{ width: 180 }}>Environment</th>
                    <th style={{ width: 200 }}>Credentials</th>
                    <th style={{ width: 130, textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    const schemaEmpty = (CREDENTIAL_SCHEMAS[row.apiCode?.toUpperCase()] || []).length === 0;
                    const busy = busyRowId === row.externalApiId;
                    const envDisabled = busy || !row.enabledByAdmin;
                    return (
                    <tr key={row.externalApiId}>
                      <td className="text-muted" style={{ textAlign: "center" }}>{idx + 1}</td>
                      <td>
                        <div className="adm-aa-api-name">{row.apiName || row.apiCode}</div>
                        <span className="adm-aa-api-code">{row.apiCode}</span>
                      </td>
                      <td>
                        <div className="d-inline-flex align-items-center adm-aa-status-switch">
                          <Form.Check
                            type="switch"
                            id={`toggle-${row.externalApiId}`}
                            checked={!!row.enabledByAdmin}
                            disabled={busy}
                            onChange={(e) => toggleRow(row, e.target.checked)}
                            label=""
                          />
                          <span className={`adm-aa-status-label ${row.enabledByAdmin ? "on" : "off"}`}>
                            {row.enabledByAdmin ? "Enabled" : "Disabled"}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="adm-aa-seg" role="group" aria-label="Active environment">
                          {["TEST", "LIVE"].map((env) => {
                            const on = row.activeEnvironment === env;
                            return (
                              <button
                                key={env}
                                type="button"
                                className={`${on ? "on" : ""} ${env === "LIVE" ? "live" : "test"}`}
                                onClick={() => setActiveEnv(row, env)}
                                disabled={envDisabled}
                                title={envDisabled && !row.enabledByAdmin ? "Enable this API first" : `Use ${env} credentials`}
                              >
                                {env === "TEST" ? "Test" : "Live"}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                      <td>
                        <div className="adm-aa-cred-pair">
                          <span className={`adm-aa-cred-pill ${row.hasTestCredentials ? "on" : "off"}`}>
                            <span style={{ opacity: .6 }}>TEST</span>
                            {row.hasTestCredentials ? "✓" : "—"}
                          </span>
                          <span className={`adm-aa-cred-pill ${row.hasLiveCredentials ? "on" : "off"}`}>
                            <span style={{ opacity: .6 }}>LIVE</span>
                            {row.hasLiveCredentials ? "✓" : "—"}
                          </span>
                        </div>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <Button
                          size="sm"
                          variant="outline-primary"
                          className="adm-aa-btn-creds"
                          onClick={() => openCredModal(row)}
                          disabled={schemaEmpty}
                          title={schemaEmpty ? "This API has no external credentials" : "Manage credentials"}
                        >
                          <FaKey style={{ marginRight: 4 }} />
                          Manage
                        </Button>
                      </td>
                    </tr>
                    );
                  })}
                  {isLoading && (
                    <tr>
                      <td colSpan={6} className="text-center text-muted py-4">
                        <Spinner animation="border" size="sm" className="me-2" />
                        Loading…
                      </td>
                    </tr>
                  )}
                  {!isLoading && rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center text-muted py-4">
                        No APIs enabled by super_admin for your company yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </main>
      </div>

      {credModal && (
        <CredentialsModal
          row={credModal.row}
          initialEnv={credModal.env}
          onClose={() => setCredModal(null)}
          onSaved={async () => {
            setCredModal(null);
            await fetchRows();
          }}
        />
      )}
    </div>
  );
}

/**
 * Test/Live tabs with per-API form fields. On open we fetch the currently
 * stored blob for each env (masked); saving posts back the merged blob —
 * fields left at the mask sentinel are preserved server-side so a user
 * editing only one field doesn't accidentally clear the others.
 */
function CredentialsModal({ row, initialEnv, onClose, onSaved }) {
  const [env, setEnv] = useState(initialEnv);
  const [values, setValues] = useState({ TEST: {}, LIVE: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const schema = CREDENTIAL_SCHEMAS[row.apiCode?.toUpperCase()] || [];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [t, l] = await Promise.all([
          axiosInstance
            .get(`${BASE}/${row.externalApiId}/credentials/TEST`)
            .then((r) => r.data)
            .catch(() => ({ credentials: {} })),
          axiosInstance
            .get(`${BASE}/${row.externalApiId}/credentials/LIVE`)
            .then((r) => r.data)
            .catch(() => ({ credentials: {} })),
        ]);
        if (cancelled) return;
        setValues({
          TEST: t?.credentials || {},
          LIVE: l?.credentials || {},
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [row.externalApiId]);

  const patchField = (currentEnv, key, val) =>
    setValues((prev) => ({
      ...prev,
      [currentEnv]: { ...prev[currentEnv], [key]: val },
    }));

  const save = async () => {
    setSaving(true);
    try {
      await axiosInstance.put(
        `${BASE}/${row.externalApiId}/credentials/${env}`,
        values[env] || {},
      );
      toast.success(`${env} credentials saved`);
      await onSaved();
    } catch (e) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data ||
        "Save failed";
      toast.error(typeof msg === "string" ? msg : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal show onHide={onClose} size="lg" centered backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>
          Credentials — {row.apiName || row.apiCode}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {loading ? (
          <div className="text-center py-4">
            <Spinner animation="border" size="sm" className="me-2" />
            Loading credentials…
          </div>
        ) : schema.length === 0 ? (
          <div className="text-muted py-3">
            No external credentials to configure for this API.
          </div>
        ) : (
          <Tab.Container
            activeKey={env}
            onSelect={(k) => k && setEnv(k)}
          >
            <Nav variant="tabs" className="mb-3">
              <Nav.Item>
                <Nav.Link eventKey="TEST">Test</Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="LIVE">Live</Nav.Link>
              </Nav.Item>
            </Nav>
            <Tab.Content>
              {["TEST", "LIVE"].map((thisEnv) => (
                <Tab.Pane key={thisEnv} eventKey={thisEnv}>
                  <Row className="g-3">
                    {schema.map((field) => (
                      <Col md={6} key={field.key}>
                        <Form.Group>
                          <Form.Label className="fw-semibold small">
                            {field.label}
                          </Form.Label>
                          <Form.Control
                            type={field.type === "password" ? "password" : "text"}
                            value={values[thisEnv]?.[field.key] ?? ""}
                            placeholder={
                              values[thisEnv]?.[field.key] === MASK
                                ? "Leave to keep existing"
                                : ""
                            }
                            onChange={(e) =>
                              patchField(thisEnv, field.key, e.target.value)
                            }
                            disabled={saving}
                          />
                        </Form.Group>
                      </Col>
                    ))}
                  </Row>
                </Tab.Pane>
              ))}
            </Tab.Content>
          </Tab.Container>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        {schema.length > 0 && (
          <Button className="btn-green" onClick={save} disabled={saving || loading}>
            {saving ? "Saving…" : `Save ${env} credentials`}
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
}
