import React, { useEffect, useState } from "react";
import { Card, Button, Table, Modal, Form, Spinner, Row, Col } from "react-bootstrap";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import { FaEdit, FaSync, FaSave } from "react-icons/fa";

const SERVICE_TYPES = ["HOTEL", "CAB", "ACTIVITY", "PACKAGE", "RESTAURANT"];

// Amount-based accrual (1 AED of booking = 1 point) — pointsPerBooking /
// bonusThreshold / bonusPoints are no longer read by the backend but still
// sent as 0/null so existing NOT-NULL columns stay happy. Only Active,
// Min Booking Amount, and Description are editable in the modal now.
const emptyForm = {
  id: null,
  serviceType: "HOTEL",
  pointsPerBooking: 0,
  minBookingAmount: "",
  bonusAmountThreshold: "",
  bonusPoints: 0,
  rewardAmount: "",
  active: true,
  description: "",
};

export default function IncentiveConfig() {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Global config (program-wide target points + fixed claim amount).
  // ratePerPoint is kept in state for backward compat with the DB column
  // but no longer shown in the UI or used by the backend summary.
  const [globalCfg, setGlobalCfg] = useState({
    id: null,
    globalTargetPoints: 0,
    ratePerPoint: 0,
    claimAmount: 0,
    active: true,
    description: "",
  });
  const [savingGlobal, setSavingGlobal] = useState(false);

  const fetchAll = async () => {
    setIsLoading(true);
    try {
      const res = await axiosInstance.get("/api/incentive/config");
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error("Failed to load incentive configuration");
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchGlobal = async () => {
    try {
      const res = await axiosInstance.get("/api/incentive/config/global");
      if (res.data) {
        setGlobalCfg({
          id: res.data.id ?? null,
          globalTargetPoints: res.data.globalTargetPoints ?? 0,
          ratePerPoint: res.data.ratePerPoint ?? 0,
          claimAmount: res.data.claimAmount ?? 0,
          active: res.data.active ?? true,
          description: res.data.description ?? "",
        });
      }
    } catch (err) {
      // Non-fatal — show a sensible default and let admin save the first time.
    }
  };

  useEffect(() => {
    fetchAll();
    fetchGlobal();
  }, []);

  const openEdit = (item) => {
    setForm({
      id: item.id,
      serviceType: item.serviceType,
      pointsPerBooking: item.pointsPerBooking ?? 0,
      minBookingAmount: item.minBookingAmount ?? "",
      bonusAmountThreshold: item.bonusAmountThreshold ?? "",
      bonusPoints: item.bonusPoints ?? 0,
      rewardAmount: item.rewardAmount ?? "",
      active: item.active ?? true,
      description: item.description ?? "",
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setForm(emptyForm);
  };

  const save = async () => {
    // Amount-based accrual — no per-service points/bonus validation.
    setSaving(true);
    try {
      const payload = {
        serviceType: form.serviceType,
        // Legacy fields — kept in the payload as 0/null so the existing
        // NOT-NULL columns accept the row. The backend no longer reads
        // them (accrual is now bookingAmount → points).
        pointsPerBooking: 0,
        minBookingAmount: form.minBookingAmount === "" ? null : Number(form.minBookingAmount),
        bonusAmountThreshold: null,
        bonusPoints: 0,
        rewardAmount: null,
        active: !!form.active,
        description: form.description || null,
      };
      if (form.id) {
        await axiosInstance.put(`/api/incentive/config/${form.id}`, payload);
      } else {
        await axiosInstance.post("/api/incentive/config", payload);
      }
      toast.success("Saved");
      await fetchAll();
      closeModal();
    } catch (err) {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const triggerSync = async () => {
    setSyncing(true);
    try {
      const res = await axiosInstance.post("/api/incentive/sync");
      const r = res.data || {};
      toast.success(
        `Sync done — scanned ${r.totalScanned || 0}, accrued ${r.totalAccrued || 0}`
      );
    } catch (err) {
      toast.error("Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const saveGlobal = async () => {
    if (
      globalCfg.globalTargetPoints === "" ||
      Number(globalCfg.globalTargetPoints) < 0
    ) {
      toast.error("Global target points must be a non-negative number");
      return;
    }
    if (globalCfg.claimAmount === "" || Number(globalCfg.claimAmount) < 0) {
      toast.error("Reward amount must be a non-negative number");
      return;
    }
    setSavingGlobal(true);
    try {
      const payload = {
        globalTargetPoints: Number(globalCfg.globalTargetPoints),
        // ratePerPoint retained for backward-compat with the DB column
        // but no longer read by the backend summary.
        ratePerPoint: Number(globalCfg.ratePerPoint || 0),
        claimAmount: Number(globalCfg.claimAmount),
        active: !!globalCfg.active,
        description: globalCfg.description || null,
      };
      const res = await axiosInstance.put("/api/incentive/config/global", payload);
      if (res.data) {
        setGlobalCfg({
          id: res.data.id ?? null,
          globalTargetPoints: res.data.globalTargetPoints ?? 0,
          ratePerPoint: res.data.ratePerPoint ?? 0,
          claimAmount: res.data.claimAmount ?? 0,
          active: res.data.active ?? true,
          description: res.data.description ?? "",
        });
      }
      toast.success("Global config saved");
    } catch (err) {
      toast.error("Failed to save global config");
    } finally {
      setSavingGlobal(false);
    }
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          {/* Global / program-wide settings card */}
          <Card className="shadow-sm rounded-xl mb-3">
            <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <span className="fw-semibold">Global Incentive Settings</span>
              <Button
                variant="outline-secondary"
                onClick={triggerSync}
                disabled={syncing}
              >
                {syncing ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" /> Syncing...
                  </>
                ) : (
                  <>
                    <FaSync className="me-2" /> Run Sync
                  </>
                )}
              </Button>
            </Card.Header>
            <Card.Body>
              <Row className="g-3 align-items-end">
                <Col md={3}>
                  <Form.Group>
                    <Form.Label>Global Target Points</Form.Label>
                    <Form.Control
                      type="number"
                      min={0}
                      value={globalCfg.globalTargetPoints}
                      onChange={(e) =>
                        setGlobalCfg({
                          ...globalCfg,
                          globalTargetPoints: e.target.value,
                        })
                      }
                      placeholder="e.g. 100"
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group>
                    <Form.Label>Reward Amount</Form.Label>
                    <Form.Control
                      type="number"
                      min={0}
                      step="0.01"
                      value={globalCfg.claimAmount}
                      onChange={(e) =>
                        setGlobalCfg({ ...globalCfg, claimAmount: e.target.value })
                      }
                      placeholder="e.g. 150"
                    />
                  </Form.Group>
                </Col>
                <Col md={2}>
                  <Form.Group>
                    <Form.Label>Active</Form.Label>
                    <Form.Check
                      type="switch"
                      checked={!!globalCfg.active}
                      onChange={(e) =>
                        setGlobalCfg({ ...globalCfg, active: e.target.checked })
                      }
                      label={globalCfg.active ? "Yes" : "No"}
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group>
                    <Form.Label>Description</Form.Label>
                    <Form.Control
                      type="text"
                      value={globalCfg.description}
                      onChange={(e) =>
                        setGlobalCfg({ ...globalCfg, description: e.target.value })
                      }
                      placeholder="Optional notes"
                    />
                  </Form.Group>
                </Col>
                <Col md={1} className="d-grid">
                  <Button
                    className="btn-indigo"
                    onClick={saveGlobal}
                    disabled={savingGlobal}
                    title="Save global settings"
                  >
                    {savingGlobal ? (
                      <Spinner animation="border" size="sm" />
                    ) : (
                      <>
                        <FaSave />
                      </>
                    )}
                  </Button>
                </Col>
              </Row>
              <div className="text-muted small mt-2">
                Every 1 AED of booking value earns the agent 1 point across all
                services. Reward scales in whole target-cycles: every complete{" "}
                <strong>Global Target Points</strong> block of earned points
                unlocks one <strong>Reward Amount</strong> (e.g. target 1000 +
                reward 150 → 2000 pts pays 300, 3000 pts pays 450). Cancelling
                a booking voids its points on the next sync.
              </div>
            </Card.Body>
          </Card>

          {/* Service-wise rules */}
          <Card className="shadow-sm rounded-xl">
            <Card.Header className="d-flex justify-content-between align-items-center">
              <span className="fw-semibold">Service-wise Incentive Rules</span>
            </Card.Header>
            <Card.Body className="p-0">
              <Table responsive hover striped className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Min Booking Amt</th>
                    <th>Active</th>
                    <th>Description</th>
                    <th style={{ width: 80 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && (
                    <tr>
                      <td colSpan={5} className="text-center text-muted py-4">
                        <Spinner animation="border" size="sm" className="me-2" /> Loading...
                      </td>
                    </tr>
                  )}
                  {!isLoading && items.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-muted py-4">
                        No configurations yet.
                      </td>
                    </tr>
                  )}
                  {items
                    .sort((a, b) =>
                      SERVICE_TYPES.indexOf(a.serviceType) - SERVICE_TYPES.indexOf(b.serviceType)
                    )
                    .map((item) => (
                      <tr key={item.id}>
                        <td className="fw-semibold">{item.serviceType}</td>
                        <td>{item.minBookingAmount ?? "-"}</td>
                        <td>
                          {item.active ? (
                            <span className="badge bg-success">Active</span>
                          ) : (
                            <span className="badge bg-secondary">Inactive</span>
                          )}
                        </td>
                        <td className="text-muted small">{item.description || "-"}</td>
                        <td>
                          <FaEdit
                            className="text-primary"
                            style={{ cursor: "pointer", fontSize: 18 }}
                            onClick={() => openEdit(item)}
                            title="Edit"
                          />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>

          <Modal show={showModal} onHide={closeModal} centered size="lg">
            <Modal.Header closeButton={!saving}>
              <Modal.Title>
                {form.id ? `Update — ${form.serviceType}` : "Create Incentive Rule"}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form>
                <div className="row">
                  <Form.Group className="mb-3 col-md-6">
                    <Form.Label>Service Type</Form.Label>
                    <Form.Select
                      value={form.serviceType}
                      disabled={!!form.id}
                      onChange={(e) => setForm({ ...form, serviceType: e.target.value })}
                    >
                      {SERVICE_TYPES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                  <Form.Group className="mb-3 col-md-6">
                    <Form.Label>Active</Form.Label>
                    <Form.Check
                      type="switch"
                      checked={!!form.active}
                      onChange={(e) => setForm({ ...form, active: e.target.checked })}
                      label={form.active ? "Enabled" : "Disabled"}
                    />
                  </Form.Group>
                  <Form.Group className="mb-3 col-md-6">
                    <Form.Label>Minimum Booking Amount (optional)</Form.Label>
                    <Form.Control
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.minBookingAmount}
                      onChange={(e) => setForm({ ...form, minBookingAmount: e.target.value })}
                      placeholder="No minimum"
                    />
                    <Form.Text className="text-muted">
                      Bookings below this AED value do not accrue points.
                    </Form.Text>
                  </Form.Group>
                  <Form.Group className="mb-3 col-12">
                    <Form.Label>Description</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={2}
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Optional notes for admins"
                    />
                  </Form.Group>
                </div>
              </Form>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={closeModal} disabled={saving}>
                Cancel
              </Button>
              <Button className="btn-indigo" onClick={save} disabled={saving}>
                {saving ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" /> Saving...
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </Modal.Footer>
          </Modal>
        </main>
      </div>
    </div>
  );
}
