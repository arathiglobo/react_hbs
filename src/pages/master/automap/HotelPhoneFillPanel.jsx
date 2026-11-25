import React, { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Form, Spinner, Table } from "react-bootstrap";
import toast from "react-hot-toast";
import axiosInstance from "../../../components/AxiosInstance";
import { fmtDateTime, fmtNumber } from "./automapFormat";

const KIND_LABEL = {
  FETCHED: "Asked by this fill",
  IN_CATALOG: "With its hotel list",
  AT_PRICE_CHECK: "At price check only",
  NOT_PROVIDED: "Not provided",
};

const STATE_TONE = {
  RUNNING: "primary",
  DONE: "success",
  STOPPED: "secondary",
  ERROR: "danger",
  SKIPPED: "warning",
};

const POLL_MS = 5000;

/**
 * "Hotel phone numbers" on Rules & Settings: asks each supplier that can send
 * a hotel phone (IWTX, X3, Atharva, Darina) for the hotels that have none, and
 * saves only what the supplier sends. Suppliers that send no phone are listed
 * with the reason. Automatic runs are off until an admin switches them on.
 */
export default function HotelPhoneFillPanel({ active }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await axiosInstance.get("/api/hotel-mapping/auto/phone-fill", { timeout: 30000 });
      setData(res.data);
      setError(null);
    } catch (err) {
      setError(err?.response?.data?.error || "The hotel phone fill status could not be loaded.");
    }
  }, []);

  useEffect(() => {
    if (active) load();
  }, [active, load]);

  // Follow a running fill; stop polling as soon as it ends or the tab is left.
  const running = data?.running === true;
  useEffect(() => {
    if (!active || !running) return undefined;
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [active, running, load]);

  const post = async (path, body, okMessage) => {
    setBusy(true);
    try {
      const res = await axiosInstance.post(`/api/hotel-mapping/auto/phone-fill${path}`, body ?? null, { timeout: 30000 });
      setData(res.data);
      setError(null);
      if (okMessage) toast.success(okMessage);
    } catch (err) {
      toast.error(err?.response?.data?.error || "The request could not be completed.");
      load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ahm-panel p-3">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
        <h6 className="fw-bold mb-0">Hotel phone numbers</h6>
        <div className="d-flex flex-wrap gap-2">
          {running ? (
            <Button size="sm" variant="outline-danger" disabled={busy || data?.stopRequested} onClick={() => post("/stop", null, "Stopping after the current call.")}>
              {data?.stopRequested ? "Stopping…" : "Stop"}
            </Button>
          ) : (
            <Button size="sm" variant="primary" disabled={busy || !data} onClick={() => post("/run", null, "Phone fill started.")}>
              {busy ? <Spinner animation="border" size="sm" /> : "Fill phone numbers now"}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="danger" className="py-2 small d-flex justify-content-between align-items-center">
          <span>{error}</span>
          <Button size="sm" variant="outline-danger" onClick={load}>
            Retry
          </Button>
        </Alert>
      )}

      <Form.Check
        type="switch"
        id="phone-fill-automatic"
        label="Fill missing phone numbers automatically"
        className="fw-semibold"
        checked={data?.automatic === true}
        disabled={!data || busy}
        onChange={(e) => post("/automatic", { automatic: e.target.checked })}
      />
      <ul className="small text-muted mt-2 mb-2 ps-3">
        <li>Only a phone number the supplier itself sends is saved. Nothing is copied from another supplier or hotel.</li>
        <li>A supplier that does not provide phone numbers is never asked, and the reason is shown under its hotels.</li>
        {data && (
          <li>
            Calls are {fmtNumber(data.delayMs)} ms apart and wait while the server is busy. A hotel the supplier has no phone
            for is asked again after {fmtNumber(data.recheckDays)} days.
          </li>
        )}
      </ul>

      {!data && !error && (
        <div className="small text-muted">
          <Spinner animation="border" size="sm" className="me-2" /> Loading…
        </div>
      )}

      {data && (
        <>
          <div className="small mb-2 d-flex flex-wrap align-items-center gap-2">
            <Badge bg={STATE_TONE[data.state] || "secondary"}>{running ? "Running" : data.state === "IDLE" ? "Idle" : data.state}</Badge>
            {data.paused && <Badge bg="warning" text="dark">Waiting: server busy</Badge>}
            {data.message && <span className="text-muted">{data.message}</span>}
          </div>
          <div className="small text-muted mb-2">
            {data.startedAt && <>Last started {fmtDateTime(data.startedAt)}. </>}
            {data.finishedAt && !running && <>Last finished {fmtDateTime(data.finishedAt)}. </>}
            {data.automatic && data.nextAutomaticRunAt && !running && <>Next automatic run from {fmtDateTime(data.nextAutomaticRunAt)}. </>}
            {data.automaticChangedBy && (
              <>
                Automatic last changed by {data.automaticChangedBy} on {fmtDateTime(data.automaticChangedAt)}.
              </>
            )}
          </div>

          <Table responsive hover className="ahm-table mb-0">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Phone comes</th>
                <th className="text-end">Hotels</th>
                <th className="text-end">With phone</th>
                <th className="text-end">Without phone</th>
                <th className="text-end">Supplier has none</th>
                <th className="text-end">This run</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {(data.suppliers || []).map((s) => (
                <tr key={s.code}>
                  <td className="fw-semibold">
                    {s.name}
                    {!s.enabled && <div className="small text-muted fw-normal">Not enabled on API Access</div>}
                  </td>
                  <td className="small">{KIND_LABEL[s.kind] || s.kind}</td>
                  <td className="text-end">{s.hotels === null || s.hotels === undefined ? "—" : fmtNumber(s.hotels)}</td>
                  <td className="text-end">{s.withPhone === null || s.withPhone === undefined ? "—" : fmtNumber(s.withPhone)}</td>
                  <td className="text-end">{s.withoutPhone === null || s.withoutPhone === undefined ? "—" : fmtNumber(s.withoutPhone)}</td>
                  <td className="text-end">{s.kind === "FETCHED" ? fmtNumber(s.supplierHasNone + s.noPhoneField) : "—"}</td>
                  <td className="text-end small text-nowrap">
                    {s.runState ? (
                      <>
                        <Badge bg={STATE_TONE[s.runState] || "light"} text={STATE_TONE[s.runState] ? undefined : "dark"} className="me-1">
                          {s.runState}
                        </Badge>
                        {fmtNumber(s.addedThisRun)} added / {fmtNumber(s.checkedThisRun)} checked
                        {s.failedThisRun > 0 ? ` / ${fmtNumber(s.failedThisRun)} failed` : ""}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="ahm-hotel-phone-note">
                    {s.note}
                    {s.lastError && <div className="text-danger">{s.lastError}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          {data.countsAt && <div className="small text-muted mt-2">Counts as of {fmtDateTime(data.countsAt)}.</div>}
        </>
      )}
    </div>
  );
}
