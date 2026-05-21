import React, { useEffect, useMemo, useState } from "react";
import { Card, Button, Table, ProgressBar, Spinner, Form, Modal } from "react-bootstrap";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import RegionalClock from "../../components/RegionalClock";
import axiosInstance from "../../components/AxiosInstance";
import { toast } from "react-hot-toast";

const SERVICE_LABEL = {
  HOTEL: "Hotel",
  CAB: "Cab / Transfer",
  ACTIVITY: "Activity",
  PACKAGE: "Package",
  RESTAURANT: "Restaurant",
};

export default function AgentIncentiveDashboard() {
  const role = (localStorage.getItem("currentActiveRole") || "").toLowerCase();
  const storedId = localStorage.getItem("userId");
  const defaultAgentId = storedId && /^\d+$/.test(storedId) ? storedId : "";

  const [agentId, setAgentId] = useState(defaultAgentId);
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimRemarks, setClaimRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [syncingSelf, setSyncingSelf] = useState(false);

  const fetchAll = async (id) => {
    if (!id) return;
    setLoading(true);
    try {
      const [s, h] = await Promise.all([
        axiosInstance.get(`/api/incentive/agent/${id}/summary`),
        axiosInstance.get(`/api/incentive/agent/${id}`),
      ]);
      setSummary(s.data);
      setRows(Array.isArray(h.data) ? h.data : []);
    } catch (err) {
      toast.error("Failed to load incentive details");
      setSummary(null);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  // Resolve agentId from username if it's not yet cached in localStorage.
  // Login only stores UserName / role / token — userId is populated by some
  // booking list pages. This component fetches it directly so the dashboard
  // works even on a fresh login.
  useEffect(() => {
    const resolveAndLoad = async () => {
      if (defaultAgentId) {
        fetchAll(defaultAgentId);
        return;
      }
      // Admins see a manual search box — don't auto-resolve.
      if (role === "admin") return;

      const userName =
        localStorage.getItem("UserName") || sessionStorage.getItem("UserName");
      if (!userName) return;

      setResolvingId(true);
      try {
        const res = await axiosInstance.get(`/api/personalProfile/${userName}`);
        if (res.data && res.data.id) {
          const id = String(res.data.id);
          localStorage.setItem("userId", id);
          setAgentId(id);
          fetchAll(id);
        }
      } catch (err) {
        // silent — UI shows the empty state
      } finally {
        setResolvingId(false);
      }
    };
    resolveAndLoad();
  }, []);

  // Manual "Refresh" reruns the sync (if user has permission) and reloads.
  // Useful for the common case of "I just made a booking — show me points".
  const refreshFromBookings = async () => {
    if (!agentId) return;
    setSyncingSelf(true);
    try {
      try {
        await axiosInstance.post("/api/incentive/sync");
      } catch (e) {
        // Sync may be admin-only in some setups — fall through to a plain reload.
      }
      await fetchAll(agentId);
      toast.success("Refreshed");
    } finally {
      setSyncingSelf(false);
    }
  };

  const progressPct = useMemo(() => {
    if (!summary || !summary.targetPoints) return 0;
    const p = (Number(summary.totalPointsEarned || 0) / Number(summary.targetPoints)) * 100;
    return Math.min(100, Math.max(0, Math.round(p)));
  }, [summary]);

  const submitClaim = async () => {
    if (!summary || !summary.agentId) return;
    if (!summary.eligibleToClaim) {
      toast.error("Not eligible yet — target not reached");
      return;
    }
    setSubmitting(true);
    try {
      await axiosInstance.post("/api/incentive/claim", {
        agentId: summary.agentId,
        agentRemarks: claimRemarks || null,
      });
      toast.success("Claim submitted for review");
      setClaimOpen(false);
      setClaimRemarks("");
      await fetchAll(summary.agentId);
    } catch (err) {
      const msg = err?.response?.data?.message || "Failed to submit claim";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          {/* Regional date+time chip — uses the logged-in user's
              registered country's timezone. */}
          <div className="d-flex justify-content-end mb-3">
            <RegionalClock />
          </div>
          <Card className="shadow-sm rounded-xl mb-3">
            <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <span className="fw-semibold">My Incentives</span>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                {role === "admin" && (
                  <Form className="d-flex align-items-center gap-2">
                    <Form.Label className="mb-0">Agent ID</Form.Label>
                    <Form.Control
                      type="number"
                      style={{ width: 140 }}
                      value={agentId}
                      onChange={(e) => setAgentId(e.target.value)}
                    />
                    <Button size="sm" onClick={() => fetchAll(agentId)} disabled={!agentId}>
                      Load
                    </Button>
                  </Form>
                )}
                <Button
                  size="sm"
                  variant="outline-secondary"
                  onClick={refreshFromBookings}
                  disabled={!agentId || syncingSelf}
                  title="Re-scan recent bookings and reload"
                >
                  {syncingSelf ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" /> Refreshing...
                    </>
                  ) : (
                    "Refresh & Sync"
                  )}
                </Button>
              </div>
            </Card.Header>
            <Card.Body>
              {(loading || resolvingId) && (
                <div className="text-center text-muted py-4">
                  <Spinner animation="border" size="sm" className="me-2" />
                  {resolvingId ? "Resolving agent profile..." : "Loading..."}
                </div>
              )}
              {!loading && !resolvingId && !agentId && (
                <div className="alert alert-warning mb-0">
                  Could not determine your agent ID automatically. Please log out and back in,
                  or contact an administrator if the problem persists.
                </div>
              )}
              {!loading && !resolvingId && agentId && !summary && (
                <div className="text-muted">No incentive summary available.</div>
              )}
              {!loading && summary && (
                <>
                  <div className="row g-3 mb-3">
                    <div className="col-md-3">
                      <Card className="h-100 border-0 shadow-sm">
                        <Card.Body>
                          <div className="text-muted small">Claimable Points</div>
                          <div className="display-6 fw-semibold">
                            {summary.totalPointsEarned || 0}
                          </div>
                        </Card.Body>
                      </Card>
                    </div>
                    <div className="col-md-3">
                      <Card className="h-100 border-0 shadow-sm">
                        <Card.Body>
                          <div className="text-muted small">Lifetime Points</div>
                          <div className="display-6 fw-semibold">
                            {summary.totalLifetimePoints || 0}
                          </div>
                        </Card.Body>
                      </Card>
                    </div>
                    <div className="col-md-3">
                      <Card className="h-100 border-0 shadow-sm">
                        <Card.Body>
                          <div className="text-muted small">Target</div>
                          <div className="display-6 fw-semibold">
                            {summary.targetPoints || 0}
                          </div>
                        </Card.Body>
                      </Card>
                    </div>
                    <div className="col-md-3">
                      <Card className="h-100 border-0 shadow-sm">
                        <Card.Body>
                          <div className="text-muted small">Reward on Claim</div>
                          <div className="display-6 fw-semibold">
                            {summary.rewardAmount ?? "-"}
                          </div>
                        </Card.Body>
                      </Card>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="d-flex justify-content-between small mb-1">
                      <span className="text-muted">
                        Progress to next reward ({summary.totalPointsEarned || 0} / {summary.targetPoints || 0})
                      </span>
                      <span className="fw-semibold">{progressPct}%</span>
                    </div>
                    <ProgressBar now={progressPct} variant={summary.eligibleToClaim ? "success" : "info"} />
                  </div>

                  <div className="d-flex justify-content-end mb-3">
                    <Button
                      className="btn-green"
                      disabled={!summary.eligibleToClaim}
                      onClick={() => setClaimOpen(true)}
                    >
                      {summary.eligibleToClaim ? "Claim Reward" : "Claim — target not reached"}
                    </Button>
                  </div>

                  <h6 className="mb-2">Breakdown by Service</h6>
                  <Table responsive bordered hover size="sm" className="mb-4 align-middle">
                    <thead>
                      <tr>
                        <th>Service</th>
                        <th className="text-end">Bookings</th>
                        <th className="text-end">Points</th>
                        <th className="text-end">Per-Booking Rule</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(!summary.breakdown || summary.breakdown.length === 0) && (
                        <tr>
                          <td colSpan={4} className="text-center text-muted py-3">
                            No bookings counted yet.
                          </td>
                        </tr>
                      )}
                      {summary.breakdown?.map((b) => (
                        <tr key={b.serviceType}>
                          <td>{SERVICE_LABEL[b.serviceType] || b.serviceType}</td>
                          <td className="text-end">{b.bookingCount}</td>
                          <td className="text-end">{b.points}</td>
                          <td className="text-end">{b.configuredPointsPerBooking ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>

                  <h6 className="mb-2">Recent Entries</h6>
                  <Table responsive striped hover size="sm" className="mb-0 align-middle">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Service</th>
                        <th>Booking Ref</th>
                        <th className="text-end">Amount</th>
                        <th className="text-end">Points</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center text-muted py-3">
                            No incentive entries.
                          </td>
                        </tr>
                      )}
                      {rows.slice(0, 50).map((r) => (
                        <tr key={r.id}>
                          <td>{r.earnedDate ? new Date(r.earnedDate).toLocaleString() : "-"}</td>
                          <td>{SERVICE_LABEL[r.serviceType] || r.serviceType}</td>
                          <td className="text-muted small">{r.bookingRef}</td>
                          <td className="text-end">{r.bookingAmount ?? "-"}</td>
                          <td className="text-end fw-semibold">{r.pointsEarned}</td>
                          <td>
                            {r.status === "EARNED" && (
                              <span className="badge bg-info text-dark">Earned</span>
                            )}
                            {r.status === "CLAIMED" && (
                              <span className="badge bg-success">Claimed</span>
                            )}
                            {r.status === "VOID" && (
                              <span className="badge bg-secondary">Void</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </>
              )}
            </Card.Body>
          </Card>

          <Modal show={claimOpen} onHide={() => setClaimOpen(false)} centered>
            <Modal.Header closeButton={!submitting}>
              <Modal.Title>Submit Claim</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <p>
                You are about to claim{" "}
                <strong>{summary?.totalPointsEarned || 0}</strong> points for a reward of{" "}
                <strong>{summary?.rewardAmount ?? "-"}</strong>. An admin will review your claim.
              </p>
              <Form.Group>
                <Form.Label>Remarks (optional)</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={claimRemarks}
                  onChange={(e) => setClaimRemarks(e.target.value)}
                  placeholder="Anything you'd like the admin to know"
                />
              </Form.Group>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setClaimOpen(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button className="btn-indigo" onClick={submitClaim} disabled={submitting}>
                {submitting ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" /> Submitting...
                  </>
                ) : (
                  "Submit Claim"
                )}
              </Button>
            </Modal.Footer>
          </Modal>
        </main>
      </div>
    </div>
  );
}
