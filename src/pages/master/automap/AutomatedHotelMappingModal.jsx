import React, { useMemo, useState } from "react";
import { Alert, Badge, Button, Modal, Spinner, Tab, Tabs } from "react-bootstrap";
import Swal from "sweetalert2";
import toast from "react-hot-toast";
import axiosInstance from "../../../components/AxiosInstance";
import StatusPanel from "./StatusPanel";
import MappedHotelsTab from "./MappedHotelsTab";
import ManualReviewTab from "./ManualReviewTab";
import { fmtNumber, statusMeta } from "./automapFormat";

/**
 * "Automated Mapping" popup on /masters/hotel-mapping.
 *
 * Three tabs backed by /api/hotel-mapping/auto/*:
 *   Status        — live engine state (running / paused + reason / completed /
 *                   error), system load, progress figures, supplier health.
 *   Mapped Hotels — per-hotel supplier matrix with green tick / red cross,
 *                   server-side search + filters + paging.
 *   Manual Review — alphabetical list of hotels below the 100% rule with
 *                   their candidates and Map / Reject actions.
 *
 * `status` comes from useAutoMappingStatus (polled every 5 s while open), so
 * the header pill, the Status tab and the tab counters update without a
 * page reload.
 */
export default function AutomatedHotelMappingModal({ show, onHide, status, error, loading, lastFetchedAt, refresh, canAct }) {
  const [tab, setTab] = useState("status");
  const [rescanning, setRescanning] = useState(false);

  const meta = statusMeta(status?.status || (error ? "ERROR" : "IDLE"));
  const isRunning = status?.status === "RUNNING";
  const suppliers = useMemo(() => status?.suppliers || [], [status]);
  // Changes whenever the engine or an operator writes links / candidates.
  const refreshKey = `${status?.automatedMappingsTotal ?? ""}-${status?.manualMappingsTotal ?? ""}-${status?.manualReviewCount ?? ""}`;

  const rescan = async () => {
    const confirm = await Swal.fire({
      title: "Re-run the full scan?",
      text: "Every in-house hotel is queued again. Existing mappings are kept; only missing supplier links are evaluated.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Queue all hotels",
      cancelButtonText: "Cancel",
    });
    if (!confirm.isConfirmed) return;
    setRescanning(true);
    try {
      const res = await axiosInstance.post("/api/hotel-mapping/auto/requeue", null, { timeout: 30000 });
      toast.success(res.data?.message || "Hotels queued.");
      refresh && refresh();
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || "The rescan could not be queued.");
    } finally {
      setRescanning(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="xl" centered scrollable dialogClassName="ahm-modal" aria-labelledby="ahm-title">
      <Modal.Header closeButton>
        <div className="d-flex flex-wrap align-items-center gap-3 w-100 pe-3">
          <Modal.Title id="ahm-title" className="fs-5 fw-bold mb-0">
            <i className="fas fa-robot me-2 text-muted" aria-hidden="true"></i>
            Automated Hotel Mapping
          </Modal.Title>
          <span className="ahm-pill" style={{ cursor: "default" }} role="status" aria-live="polite">
            <span className={`ahm-dot tone-${meta.tone}${isRunning ? " pulse" : ""}`}></span>
            <span>{meta.label}</span>
            {isRunning && <Spinner animation="border" size="sm" role="presentation" />}
          </span>
          <span className="ms-auto small text-muted d-flex align-items-center gap-2">
            {loading && <Spinner animation="border" size="sm" role="status" aria-label="Refreshing status" />}
            {status?.enabled === false ? "Disabled in configuration" : "Auto-refresh every 5 s"}
            <Button size="sm" variant="outline-secondary" onClick={() => refresh && refresh()} disabled={loading} aria-label="Refresh now">
              <i className="fas fa-sync-alt" aria-hidden="true"></i>
            </Button>
          </span>
        </div>
      </Modal.Header>
      <Modal.Body>
        {error && !status && (
          <Alert variant="danger" className="d-flex justify-content-between align-items-center">
            <span>
              <i className="fas fa-exclamation-triangle me-2" aria-hidden="true"></i>
              {error}
            </span>
            <Button size="sm" variant="outline-danger" onClick={() => refresh && refresh()}>
              Retry
            </Button>
          </Alert>
        )}
        {!error && !status && (
          <div className="text-center py-5 text-muted">
            <Spinner animation="border" className="mb-2" />
            <div>Loading automated mapping status…</div>
          </div>
        )}
        {status && (
          <>
            {error && (
              <Alert variant="warning" className="py-2 small">
                <i className="fas fa-wifi me-2" aria-hidden="true"></i>
                The last status refresh failed ({error}). Showing the previous values.
              </Alert>
            )}
            <Tabs activeKey={tab} onSelect={(k) => setTab(k || "status")} className="mb-3" mountOnEnter>
              <Tab
                eventKey="status"
                title={
                  <span>
                    <i className="fas fa-heartbeat me-1" aria-hidden="true"></i> Status
                  </span>
                }
              >
                <StatusPanel
                  status={status}
                  lastFetchedAt={lastFetchedAt}
                  onRescan={rescan}
                  rescanning={rescanning}
                  canAct={canAct}
                  onRefresh={refresh}
                />
              </Tab>
              <Tab
                eventKey="mapped"
                title={
                  <span>
                    <i className="fas fa-link me-1" aria-hidden="true"></i> Mapped Hotels{" "}
                    <Badge bg="light" text="dark" pill>
                      {fmtNumber(status.autoMappedCount)}
                    </Badge>
                  </span>
                }
              >
                <MappedHotelsTab suppliers={suppliers} active={tab === "mapped"} refreshKey={refreshKey} />
              </Tab>
              <Tab
                eventKey="review"
                title={
                  <span>
                    <i className="fas fa-user-check me-1" aria-hidden="true"></i> Manual Review{" "}
                    <Badge bg={status.manualReviewCount > 0 ? "warning" : "light"} text="dark" pill>
                      {fmtNumber(status.manualReviewCount)}
                    </Badge>
                  </span>
                }
              >
                <ManualReviewTab suppliers={suppliers} active={tab === "review"} canAct={canAct} onChanged={refresh} refreshKey={refreshKey} />
              </Tab>
            </Tabs>
          </>
        )}
      </Modal.Body>
    </Modal>
  );
}
