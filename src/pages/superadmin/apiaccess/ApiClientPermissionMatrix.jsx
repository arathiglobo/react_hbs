import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, Tab, Tabs } from "react-bootstrap";
import Sidebar from "../../../components/Sidebar";
import Topbar from "../../../components/TopBar";
import BackButton from "../../../components/BackButton";
import axiosInstance from "../../../components/AxiosInstance";
import ApiClientEndpointMatrix from "./ApiClientEndpointMatrix";
import ApiClientSupplierMatrix from "./ApiClientSupplierMatrix";

/**
 * "Manage API Access" page — tabbed shell that hosts the two independent
 * permission axes for a single external client:
 *
 *   • Endpoints tab — which /api/v1/external/** verbs the client may call.
 *   • Suppliers tab — which upstream APIs we aggregate for the client
 *                     when they do call a search/booking endpoint.
 *
 * Route: /super-admin/api-access/clients/:clientId/permissions (unchanged).
 * Each tab body is a self-contained component (fetches, saves, tracks its
 * own dirty state) — switching tabs never loses unsaved changes because
 * both components stay mounted (`mountOnEnter={false}`, default).
 */
export default function ApiClientPermissionMatrix() {
  const { clientId } = useParams();
  const [client, setClient] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axiosInstance.get(`/api/super-admin/api-access/clients/${clientId}`);
        if (!cancelled) setClient(res.data);
      } catch {
        if (!cancelled) setClient(null);
      }
    })();
    return () => { cancelled = true; };
  }, [clientId]);

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Card className="shadow-sm rounded-xl">
            <Card.Header className="d-flex flex-column flex-lg-row gap-2 justify-content-between align-items-stretch align-items-lg-center">
              <span className="d-flex align-items-center gap-2 flex-wrap">
                <BackButton fallback="/super-admin/api-access/clients" />
                <span className="fw-semibold">Manage API Access</span>
                {client && (
                  <>
                    <span className="text-muted">·</span>
                    <span>
                      <b>{client.clientName}</b>{" "}
                      <code className="text-muted">({client.clientCode})</code>
                    </span>
                  </>
                )}
              </span>
            </Card.Header>
            <Card.Body>
              <Tabs defaultActiveKey="endpoints" id="api-access-tabs" className="mb-3">
                <Tab eventKey="endpoints" title="Endpoints">
                  <ApiClientEndpointMatrix clientId={clientId} />
                </Tab>
                <Tab eventKey="suppliers" title="Suppliers">
                  <ApiClientSupplierMatrix clientId={clientId} />
                </Tab>
              </Tabs>
            </Card.Body>
          </Card>
        </main>
      </div>
    </div>
  );
}
