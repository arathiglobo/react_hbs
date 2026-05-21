import React, { useEffect, useState } from "react";
import { Card, Button, Table, Modal, Form, Spinner } from "react-bootstrap";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import { toast } from "react-hot-toast";

export default function IncentiveClaims() {
  const role = (localStorage.getItem("currentActiveRole") || "").toLowerCase();
  const isAdmin = role === "admin";
  const storedId = localStorage.getItem("userId");
  const myAgentId = storedId && /^\d+$/.test(storedId) ? Number(storedId) : null;

  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewClaim, setReviewClaim] = useState(null);
  const [reviewAction, setReviewAction] = useState("approve");
  const [adminRemarks, setAdminRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const reviewer = localStorage.getItem("UserName") || "admin";

  const fetchAll = async () => {
    setLoading(true);
    try {
      const url = isAdmin
        ? "/api/incentive/claim/all"
        : myAgentId
        ? `/api/incentive/claim/agent/${myAgentId}`
        : null;
      if (!url) {
        setClaims([]);
        return;
      }
      const res = await axiosInstance.get(url);
      setClaims(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error("Failed to load claims");
      setClaims([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const openReview = (claim, action) => {
    setReviewClaim(claim);
    setReviewAction(action);
    setAdminRemarks(claim.adminRemarks || "");
    setReviewOpen(true);
  };

  const closeReview = () => {
    setReviewOpen(false);
    setReviewClaim(null);
    setAdminRemarks("");
  };

  const submitReview = async () => {
    if (!reviewClaim) return;
    setSubmitting(true);
    try {
      const body = { adminRemarks: adminRemarks || null, reviewedBy: reviewer };
      await axiosInstance.post(
        `/api/incentive/claim/${reviewClaim.id}/${reviewAction}`,
        body
      );
      toast.success(`Claim ${reviewAction}d`);
      closeReview();
      await fetchAll();
    } catch (err) {
      const msg = err?.response?.data?.message || "Failed to update claim";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadge = (s) => {
    if (s === "PENDING") return <span className="badge bg-warning text-dark">Pending</span>;
    if (s === "APPROVED") return <span className="badge bg-info text-dark">Approved</span>;
    if (s === "PAID") return <span className="badge bg-success">Paid</span>;
    if (s === "REJECTED") return <span className="badge bg-danger">Rejected</span>;
    return <span className="badge bg-secondary">{s}</span>;
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Card className="shadow-sm rounded-xl">
            <Card.Header className="d-flex justify-content-between align-items-center">
              <span className="fw-semibold">
                {isAdmin ? "All Incentive Claims" : "My Incentive Claims"}
              </span>
              <Button variant="outline-secondary" size="sm" onClick={fetchAll}>
                Refresh
              </Button>
            </Card.Header>
            <Card.Body className="p-0">
              <Table responsive striped hover className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th>#</th>
                    {isAdmin && <th>Agent</th>}
                    <th>Points</th>
                    <th>Reward</th>
                    <th>Claim Date</th>
                    <th>Status</th>
                    <th>Reviewed By</th>
                    <th>Agent Remarks</th>
                    <th>Admin Remarks</th>
                    {isAdmin && <th style={{ width: 220 }}>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={isAdmin ? 10 : 8} className="text-center text-muted py-4">
                        <Spinner animation="border" size="sm" className="me-2" /> Loading...
                      </td>
                    </tr>
                  )}
                  {!loading && claims.length === 0 && (
                    <tr>
                      <td colSpan={isAdmin ? 10 : 8} className="text-center text-muted py-4">
                        No claims found.
                      </td>
                    </tr>
                  )}
                  {claims.map((c) => (
                    <tr key={c.id}>
                      <td>{c.id}</td>
                      {isAdmin && <td>{c.agentId}</td>}
                      <td className="fw-semibold">{c.pointsClaimed}</td>
                      <td>{c.rewardAmount ?? "-"}</td>
                      <td>{c.claimDate ? new Date(c.claimDate).toLocaleString() : "-"}</td>
                      <td>{statusBadge(c.status)}</td>
                      <td>{c.reviewedBy || "-"}</td>
                      <td className="text-muted small">{c.agentRemarks || "-"}</td>
                      <td className="text-muted small">{c.adminRemarks || "-"}</td>
                      {isAdmin && (
                        <td>
                          {c.status === "PENDING" && (
                            <div className="d-flex gap-2">
                              <Button
                                size="sm"
                                variant="success"
                                onClick={() => openReview(c, "approve")}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline-danger"
                                onClick={() => openReview(c, "reject")}
                              >
                                Reject
                              </Button>
                            </div>
                          )}
                          {c.status === "APPROVED" && (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => openReview(c, "paid")}
                            >
                              Mark Paid
                            </Button>
                          )}
                          {(c.status === "PAID" || c.status === "REJECTED") && (
                            <span className="text-muted small">Closed</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>

          <Modal show={reviewOpen} onHide={closeReview} centered>
            <Modal.Header closeButton={!submitting}>
              <Modal.Title>
                {reviewAction === "approve" && "Approve Claim"}
                {reviewAction === "reject" && "Reject Claim"}
                {reviewAction === "paid" && "Mark Claim Paid"}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              {reviewClaim && (
                <>
                  <div className="mb-2">
                    <strong>Claim #{reviewClaim.id}</strong> — Agent {reviewClaim.agentId} — Points{" "}
                    {reviewClaim.pointsClaimed} — Reward {reviewClaim.rewardAmount ?? "-"}
                  </div>
                  <Form.Group>
                    <Form.Label>Admin Remarks</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      value={adminRemarks}
                      onChange={(e) => setAdminRemarks(e.target.value)}
                      placeholder="Reason / notes (optional)"
                    />
                  </Form.Group>
                </>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={closeReview} disabled={submitting}>
                Cancel
              </Button>
              <Button
                variant={
                  reviewAction === "reject"
                    ? "danger"
                    : reviewAction === "paid"
                    ? "primary"
                    : "success"
                }
                onClick={submitReview}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" /> Submitting...
                  </>
                ) : reviewAction === "approve" ? (
                  "Approve"
                ) : reviewAction === "reject" ? (
                  "Reject"
                ) : (
                  "Mark Paid"
                )}
              </Button>
            </Modal.Footer>
          </Modal>
        </main>
      </div>
    </div>
  );
}
