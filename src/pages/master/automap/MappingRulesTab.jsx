import React, { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Spinner, Table } from "react-bootstrap";
import axiosInstance from "../../../components/AxiosInstance";
import { fmtNumber } from "./automapFormat";

const STEPS = [
  {
    title: "Collect",
    text: "Each supplier's hotel list is copied into our system and kept up to date.",
  },
  {
    title: "Find the city",
    text: "Each of our cities is linked to the same city at each supplier. Hotel search only asks a supplier about a city that has this link.",
  },
  {
    title: "Compare hotels",
    text: "Each hotel is compared with the other suppliers' hotels using its name, country, distance and city.",
  },
  {
    title: "Link automatically",
    text: "Identical name, same country, within the distance below (or same city when coordinates are missing), and sold by enough suppliers.",
  },
  {
    title: "Send to review",
    text: "A likely match that is not exact, such as a slightly different name, waits for an admin. Nothing here is linked without approval.",
  },
  {
    title: "Reject",
    text: "A different country, or too far apart, means a different hotel. It is not linked or offered for review.",
  },
  {
    title: "Use in search",
    text: "Linked hotels appear once in search at the cheapest rate, and the room page shows every linked supplier's rates.",
  },
  {
    title: "Not mapped",
    text: "Anything still unlinked is listed on the Not Mapped tab, with the reason.",
  },
];

/** Read-only view of how mapping works and every setting in force, for admins to review. */
export default function MappingRulesTab({ active }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/api/hotel-mapping/auto/settings", { timeout: 30000 });
      setData(res.data);
      setError(null);
    } catch (err) {
      setError(err?.response?.data?.error || "The settings could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (active) load();
  }, [active, load]);

  const groups = [...new Set((data?.settings || []).map((s) => s.group))];

  return (
    <div className="d-flex flex-column gap-3">
      <div className="ahm-panel p-3">
        <h6 className="fw-bold">How a hotel gets mapped</h6>
        <ol className="mb-0 ps-3">
          {STEPS.map((s) => (
            <li key={s.title} className="mb-1">
              <strong>{s.title}.</strong> {s.text}
            </li>
          ))}
        </ol>
      </div>

      {error && (
        <Alert variant="danger" className="mb-0 d-flex justify-content-between align-items-center">
          <span>{error}</span>
          <Button size="sm" variant="outline-danger" onClick={load}>
            Retry
          </Button>
        </Alert>
      )}
      {loading && !data && (
        <div className="text-center py-4">
          <Spinner animation="border" size="sm" className="me-2" /> Loading settings…
        </div>
      )}

      {data && (
        <div className="ahm-panel">
          <div className="ahm-panel-head">
            <span>Suppliers in mapping</span>
          </div>
          <Table responsive hover className="ahm-table mb-0">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Status</th>
                <th className="text-end">Hotels</th>
                <th className="text-end">Mapped</th>
                <th className="text-end">Not mapped</th>
                <th className="text-end">Still to check</th>
                <th>GIATA codes</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {data.suppliers.map((s) => (
                <tr key={s.code}>
                  <td className="fw-semibold">{s.name}</td>
                  <td>
                    <Badge bg={s.enabled ? "success" : "secondary"}>{s.enabled ? "In mapping" : "Not in mapping"}</Badge>
                  </td>
                  <td className="text-end">{fmtNumber(s.catalogHotels)}</td>
                  <td className="text-end">{fmtNumber(s.mappedHotels)}</td>
                  <td className="text-end">{fmtNumber(s.notMappedHotels)}</td>
                  <td className="text-end">{fmtNumber(s.waitingHotels)}</td>
                  <td>{s.hasGiataCodes ? "Yes" : "No"}</td>
                  <td className="small text-muted">{s.note}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      {groups.map((group) => (
        <div className="ahm-panel" key={group}>
          <div className="ahm-panel-head">
            <span>{group}</span>
          </div>
          <Table responsive className="ahm-table mb-0">
            <thead>
              <tr>
                <th style={{ width: "32%" }}>Setting</th>
                <th style={{ width: "16%" }}>Current value</th>
                <th>What it means</th>
              </tr>
            </thead>
            <tbody>
              {data.settings
                .filter((s) => s.group === group)
                .map((s) => (
                  <tr key={s.label}>
                    <td>{s.label}</td>
                    <td className="fw-semibold">{s.value}</td>
                    <td className="small text-muted">{s.meaning}</td>
                  </tr>
                ))}
            </tbody>
          </Table>
        </div>
      ))}
      {data && (
        <p className="small text-muted mb-0">
          These values are set in the backend configuration, and changing one needs a restart. This screen shows what is in
          force so it can be reviewed.
        </p>
      )}
    </div>
  );
}
