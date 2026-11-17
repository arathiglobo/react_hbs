import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Badge, Button, Card, Col, Row, Spinner, Table } from "react-bootstrap";
import Swal from "sweetalert2";
import toast from "react-hot-toast";
import axiosInstance from "../../components/AxiosInstance";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import BackButton from "../../components/BackButton";

/**
 * /masters/ratehawk-static-data — RateHawk hotel static data
 * (ratehawk_hotels_dumpdata and its region / image / room-group tables).
 *
 * RateHawk's rule: call /hotel/info/incremental_dump/ every day for the
 * previous day's changes; when a day is missed, refresh fully from
 * /hotel/info/dump/. The backend does this on its own schedule
 * (api.ratehawk.staticdata); this page shows where it stands and lets an
 * admin run either call now.
 *
 *   GET  /api/ratehawk/static-data/status
 *   POST /api/ratehawk/static-data/sync?mode=INCREMENTAL|FULL
 *
 * Polls every 5 s while a run is in progress, every 60 s otherwise.
 */

const STATUS_TONE = {
  SUCCESS: "success",
  PARTIAL: "warning",
  FAILED: "danger",
  RUNNING: "primary",
};

const PHASE_LABEL = {
  DOWNLOADING: "Downloading the dump",
  IMPORTING: "Writing hotels",
  MARKING_DELETED: "Marking hotels no longer listed",
  DONE: "Finished",
};

const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const fmtNum = (n) => (n === null || n === undefined ? "—" : Number(n).toLocaleString());

const fmtBytes = (n) => {
  if (!n) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let v = Number(n);
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

const fmtDuration = (startIso, endIso) => {
  if (!startIso) return "—";
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const s = Math.max(0, Math.round((end - start) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};

const StatusBadge = ({ status }) => {
  const tone = STATUS_TONE[status] || "secondary";
  return (
    <Badge bg={tone} text={tone === "warning" ? "dark" : undefined}>
      {status || "—"}
    </Badge>
  );
};

const InfoRow = ({ label, children }) => (
  <div className="d-flex justify-content-between gap-3 py-1 border-bottom small">
    <span className="text-muted">{label}</span>
    <span className="text-end fw-semibold">{children}</span>
  </div>
);

const RateHawkStaticData = () => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [starting, setStarting] = useState(null);
  const timerRef = useRef(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await axiosInstance.get("/api/ratehawk/static-data/status");
      setStatus(res.data);
      setLoadError(null);
      return res.data;
    } catch (err) {
      setLoadError(err?.response?.data?.message || "The RateHawk static-data status could not be loaded.");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll: fast while a run is in progress, slow otherwise.
  useEffect(() => {
    let cancelled = false;
    const loop = async () => {
      const data = await fetchStatus();
      if (cancelled) return;
      timerRef.current = setTimeout(loop, data?.running ? 5000 : 60000);
    };
    loop();
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [fetchStatus]);

  const startRun = async (mode) => {
    if (mode === "FULL") {
      const answer = await Swal.fire({
        title: "Run a full refresh now?",
        html:
          "This downloads RateHawk's complete hotel dump (several GB) and rewrites every RateHawk hotel. " +
          "Hotels the dump no longer lists are marked deleted. It can take an hour or more.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Start full refresh",
        cancelButtonText: "Cancel",
      });
      if (!answer.isConfirmed) return;
    }
    setStarting(mode);
    try {
      const res = await axiosInstance.post("/api/ratehawk/static-data/sync", null, { params: { mode } });
      toast.success(res.data?.message || "Run started.");
      setTimeout(fetchStatus, 1500);
    } catch (err) {
      toast.error(err?.response?.data?.message || "The run could not be started.");
    } finally {
      setStarting(null);
    }
  };

  const running = !!status?.running;
  const current = status?.currentRun;
  const runs = status?.recentRuns || [];

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Card className="shadow-sm mb-4">
            <Card.Header className="bg-white py-3 d-flex align-items-center gap-2 flex-wrap">
              <BackButton fallback="/adminDashboard" />
              <h5 className="mb-0 fw-bold">RateHawk Static Data</h5>
              <div className="ms-auto d-flex gap-2">
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={fetchStatus}
                  disabled={loading}
                >
                  <i className="fas fa-sync-alt me-1" />
                  Refresh
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => startRun("INCREMENTAL")}
                  disabled={running || !!starting || !status}
                >
                  {starting === "INCREMENTAL" ? <Spinner size="sm" className="me-1" /> : <i className="fas fa-download me-1" />}
                  Run incremental now
                </Button>
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={() => startRun("FULL")}
                  disabled={running || !!starting || !status}
                >
                  {starting === "FULL" ? <Spinner size="sm" className="me-1" /> : <i className="fas fa-database me-1" />}
                  Run full refresh now
                </Button>
              </div>
            </Card.Header>
            <Card.Body>
              <Alert variant="light" className="border small mb-3">
                RateHawk requires the hotel static data to be updated from <code>/hotel/info/incremental_dump/</code>{" "}
                every day (changes of the previous day). If a day is missed, the database is refreshed fully from{" "}
                <code>/hotel/info/dump/</code> as soon as RateHawk&apos;s full dump contains the missed day.
                {status && !status.scheduleEnabled && (
                  <div className="mt-1 text-danger fw-semibold">
                    The daily schedule is switched off (app.ratehawk.static-data.schedule-enabled); only manual runs happen.
                  </div>
                )}
              </Alert>

              {loading && !status && (
                <div className="text-center py-5">
                  <Spinner />
                </div>
              )}
              {loadError && <Alert variant="danger">{loadError}</Alert>}
              {status?.connectionNote && <Alert variant="warning">{status.connectionNote}</Alert>}

              {status && (
                <>
                  {running && (
                    <Alert variant="primary" className="d-flex align-items-start gap-3">
                      <Spinner size="sm" className="mt-1" />
                      <div className="flex-grow-1">
                        <div className="fw-semibold">
                          {current
                            ? `${current.mode === "FULL" ? "Full refresh" : "Incremental update"} #${current.id} — ${
                                PHASE_LABEL[current.phase] || current.phase || "Starting"
                              }`
                            : "Checking RateHawk…"}
                        </div>
                        {current && (
                          <div className="small">
                            Dump of {fmtDate(current.dumpLastUpdate)} · {fmtBytes(current.bytesDownloaded)} ·{" "}
                            {fmtNum(current.recordsRead)} records read · {fmtNum(current.hotelsInserted)} new ·{" "}
                            {fmtNum(current.hotelsUpdated)} updated · {fmtNum(current.hotelsMarkedDeleted)} deleted
                            {current.recordsFailed > 0 ? ` · ${fmtNum(current.recordsFailed)} failed` : ""} · running for{" "}
                            {fmtDuration(current.startedAt, null)}
                          </div>
                        )}
                      </div>
                    </Alert>
                  )}

                  <Row className="g-3 mb-4">
                    <Col lg={4}>
                      <Card className="h-100">
                        <Card.Body>
                          <h6 className="fw-bold mb-2">Daily incremental dump</h6>
                          <InfoRow label="Last file applied">{fmtDate(status.lastIncrementalUpdate)}</InfoRow>
                          <InfoRow label="Next file expected">
                            {status.nextIncrementalDueAt ? fmtDate(status.nextIncrementalDueAt) : "Now"}
                          </InfoRow>
                          <InfoRow label="Database complete up to">{fmtDate(status.coveredUntil)}</InfoRow>
                          <InfoRow label="Checks every">{status.checkIntervalMinutes} min</InfoRow>
                          <InfoRow label="Schedule">
                            {status.scheduleEnabled ? (
                              <Badge bg="success">On</Badge>
                            ) : (
                              <Badge bg="secondary">Off</Badge>
                            )}
                          </InfoRow>
                        </Card.Body>
                      </Card>
                    </Col>
                    <Col lg={4}>
                      <Card className="h-100">
                        <Card.Body>
                          <h6 className="fw-bold mb-2">Full dump refresh</h6>
                          <InfoRow label="Last full refresh">{fmtDate(status.lastFullUpdate)}</InfoRow>
                          <InfoRow label="Full refresh needed">
                            {status.fullRefreshRequired ? (
                              <Badge bg="warning" text="dark">
                                Yes
                              </Badge>
                            ) : (
                              <Badge bg="success">No</Badge>
                            )}
                          </InfoRow>
                          {status.fullRefreshRequired && (
                            <InfoRow label="Needs a dump from">
                              {status.fullRefreshNeededAfter ? fmtDate(status.fullRefreshNeededAfter) : "Any date"}
                            </InfoRow>
                          )}
                          <InfoRow label="Full dump last checked">{fmtDate(status.lastFullCheckAt)}</InfoRow>
                          {status.fullRefreshRequired && status.fullRefreshReason && (
                            <div className="small text-muted mt-2">{status.fullRefreshReason}</div>
                          )}
                        </Card.Body>
                      </Card>
                    </Col>
                    <Col lg={4}>
                      <Card className="h-100">
                        <Card.Body>
                          <h6 className="fw-bold mb-2">RateHawk hotels in our database</h6>
                          <InfoRow label="Active">{fmtNum(status.hotelsActive)}</InfoRow>
                          <InfoRow label="Of which closed">{fmtNum(status.hotelsClosed)}</InfoRow>
                          <InfoRow label="Deleted by RateHawk">{fmtNum(status.hotelsDeleted)}</InfoRow>
                          <InfoRow label="Total rows">{fmtNum(status.hotelsTotal)}</InfoRow>
                          <InfoRow label="Language / inventory">
                            {status.language} / {status.inventory}
                          </InfoRow>
                        </Card.Body>
                      </Card>
                    </Col>
                  </Row>

                  {status.lastCheckMessage && (
                    <Alert variant="secondary" className="small">
                      <span className="fw-semibold">Last check {fmtDate(status.lastCheckAt)}:</span>{" "}
                      {status.lastCheckMessage}
                    </Alert>
                  )}

                  <h6 className="fw-bold mb-2">Recent runs</h6>
                  {runs.length === 0 ? (
                    <div className="text-muted small">No dump has been applied yet.</div>
                  ) : (
                    <div className="table-responsive">
                      <Table size="sm" bordered hover className="align-middle small mb-0">
                        <thead className="table-light">
                          <tr>
                            <th>#</th>
                            <th>Started</th>
                            <th>Type</th>
                            <th>By</th>
                            <th>Dump of</th>
                            <th>Status</th>
                            <th className="text-end">Size</th>
                            <th className="text-end">Read</th>
                            <th className="text-end">New</th>
                            <th className="text-end">Updated</th>
                            <th className="text-end">Deleted</th>
                            <th className="text-end">Failed</th>
                            <th className="text-end">Took</th>
                            <th>Note</th>
                          </tr>
                        </thead>
                        <tbody>
                          {runs.map((r) => (
                            <tr key={r.id}>
                              <td>{r.id}</td>
                              <td className="text-nowrap">{fmtDate(r.startedAt)}</td>
                              <td>{r.mode === "FULL" ? "Full" : "Incremental"}</td>
                              <td>{r.triggerType === "SCHEDULED" ? "Schedule" : r.triggeredBy || "—"}</td>
                              <td className="text-nowrap">{fmtDate(r.dumpLastUpdate)}</td>
                              <td>
                                <StatusBadge status={r.status} />
                              </td>
                              <td className="text-end text-nowrap">{fmtBytes(r.bytesDownloaded)}</td>
                              <td className="text-end">{fmtNum(r.recordsRead)}</td>
                              <td className="text-end">{fmtNum(r.hotelsInserted)}</td>
                              <td className="text-end">{fmtNum(r.hotelsUpdated)}</td>
                              <td className="text-end">{fmtNum(r.hotelsMarkedDeleted)}</td>
                              <td className="text-end">{fmtNum(r.recordsFailed)}</td>
                              <td className="text-end text-nowrap">{fmtDuration(r.startedAt, r.finishedAt)}</td>
                              <td className="text-break">{r.message || ""}</td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                  )}
                </>
              )}
            </Card.Body>
          </Card>
        </main>
      </div>
    </div>
  );
};

export default RateHawkStaticData;
