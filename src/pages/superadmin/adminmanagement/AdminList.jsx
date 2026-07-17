import React, { useEffect, useState } from "react";
import { Card, Table, Badge, Form, Button } from "react-bootstrap";
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
 *   GET   /api/super-admin/admins                       list admins
 *   PATCH /api/super-admin/admins/{id}/company          assign / clear
 *   GET   /api/companyProfile                           picker source
 */
const ADMINS_URL = "/api/super-admin/admins";
const COMPANIES_URL = "/api/companyProfile";

export default function AdminList() {
  const [admins, setAdmins] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  // Pending picks are held per-row so a single Save click writes them.
  // Undefined = no change yet; anything else (including "") = user picked.
  const [pending, setPending] = useState({});
  const [savingId, setSavingId] = useState(null);

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
                    <th style={{ width: 120 }}>Actions</th>
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
                        <Button
                          size="sm"
                          className="btn-green"
                          disabled={!isDirty(row) || savingId === row.id}
                          onClick={() => saveRow(row)}
                        >
                          {savingId === row.id ? "Saving…" : "Save"}
                        </Button>
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
    </div>
  );
}
