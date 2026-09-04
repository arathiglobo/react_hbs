import React, { useEffect, useState } from "react";
import {
  Card,
  Button,
  Table,
  Modal,
  Form,
  Spinner,
  Row,
  Col,
  InputGroup,
  Badge,
} from "react-bootstrap";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import { FaEdit, FaSync, FaSave, FaUndo } from "react-icons/fa";

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

// Global / program-wide settings. ratePerPoint is kept only for backward
// compat with the DB column — it is neither shown in the UI nor read by the
// backend summary any more.
const EMPTY_GLOBAL = {
  id: null,
  globalTargetPoints: 0,
  ratePerPoint: 0,
  claimAmount: 0,
  active: true,
  description: "",
};

const normalizeGlobal = (data) => ({
  id: data?.id ?? null,
  globalTargetPoints: data?.globalTargetPoints ?? 0,
  ratePerPoint: data?.ratePerPoint ?? 0,
  claimAmount: data?.claimAmount ?? 0,
  active: data?.active ?? true,
  description: data?.description ?? "",
});

const fmt = (n) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

export default function IncentiveConfig() {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [globalCfg, setGlobalCfg] = useState(EMPTY_GLOBAL);
  // Snapshot of what the server last confirmed — drives the "unsaved
  // changes" badge and the Reset button.
  const [savedGlobalCfg, setSavedGlobalCfg] = useState(EMPTY_GLOBAL);
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
        const cfg = normalizeGlobal(res.data);
        setGlobalCfg(cfg);
        setSavedGlobalCfg(cfg);
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

  const resetGlobal = () => setGlobalCfg(savedGlobalCfg);

  const saveGlobal = async () => {
    if (
      globalCfg.globalTargetPoints === "" ||
      Number(globalCfg.globalTargetPoints) < 0
    ) {
      toast.error("Points needed must be a non-negative number");
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
      const cfg = normalizeGlobal(res.data || { ...globalCfg, ...payload });
      setGlobalCfg(cfg);
      setSavedGlobalCfg(cfg);
      toast.success("Global incentive settings saved");
    } catch (err) {
      // Server errors here can come back as a full stack trace — only surface
      // it when it is short enough to read in a toast.
      const raw = err?.response?.data?.message;
      const detail = typeof raw === "string" && raw.length <= 160 ? raw : null;
      toast.error(detail || "Failed to save global incentive settings");
    } finally {
      setSavingGlobal(false);
    }
  };

  const targetPts = Number(globalCfg.globalTargetPoints || 0);
  const rewardAed = Number(globalCfg.claimAmount || 0);
  const globalDirty =
    targetPts !== Number(savedGlobalCfg.globalTargetPoints || 0) ||
    rewardAed !== Number(savedGlobalCfg.claimAmount || 0) ||
    !!globalCfg.active !== !!savedGlobalCfg.active ||
    (globalCfg.description || "") !== (savedGlobalCfg.description || "");

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          {/* Global / program-wide settings card */}
          <Card className="shadow-sm rounded-xl mb-3">
            <Card.Header className="bg-white d-flex justify-content-between align-items-start flex-wrap gap-2 py-3">
              <div>
                <div className="fw-semibold">Global Incentive Settings</div>
                <div className="text-muted small">
                  How many points an agent must earn, and what they get paid for
                  reaching them. Applies to every service.
                </div>
              </div>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={triggerSync}
                disabled={syncing}
                title="Recalculate agent points from existing bookings"
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
              <Row className="g-3">
                <Col md={4}>
                  <Form.Group controlId="global-target-points">
                    <Form.Label className="fw-semibold small mb-1">
                      1. Points needed
                    </Form.Label>
                    <InputGroup>
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
                        placeholder="e.g. 5000"
                      />
                      <InputGroup.Text>points</InputGroup.Text>
                    </InputGroup>
                    <Form.Text className="text-muted">
                      1 AED of booking value = 1 point.
                    </Form.Text>
                  </Form.Group>
                </Col>

                <Col md={4}>
                  <Form.Group controlId="global-reward-amount">
                    <Form.Label className="fw-semibold small mb-1">
                      2. Reward paid
                    </Form.Label>
                    <InputGroup>
                      <InputGroup.Text>AED</InputGroup.Text>
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
                    </InputGroup>
                    <Form.Text className="text-muted">
                      Paid every time the target above is reached.
                    </Form.Text>
                  </Form.Group>
                </Col>

                <Col md={4}>
                  <Form.Group>
                    <Form.Label className="fw-semibold small mb-1">
                      3. Programme status
                    </Form.Label>
                    <div
                      className="border rounded-3 px-3 d-flex align-items-center"
                      style={{ minHeight: 38 }}
                    >
                      <Form.Check
                        type="switch"
                        id="global-incentive-active"
                        className="mb-0"
                        checked={!!globalCfg.active}
                        onChange={(e) =>
                          setGlobalCfg({ ...globalCfg, active: e.target.checked })
                        }
                        label={
                          <span
                            className={
                              globalCfg.active
                                ? "text-success fw-semibold"
                                : "text-muted fw-semibold"
                            }
                          >
                            {globalCfg.active ? "Active" : "Paused"}
                          </span>
                        }
                      />
                    </div>
                    <Form.Text className="text-muted">
                      Paused stops new rewards from unlocking.
                    </Form.Text>
                  </Form.Group>
                </Col>

                <Col xs={12}>
                  <Form.Group controlId="global-description">
                    <Form.Label className="fw-semibold small mb-1">
                      Description{" "}
                      <span className="text-muted fw-normal">(optional)</span>
                    </Form.Label>
                    <Form.Control
                      type="text"
                      value={globalCfg.description}
                      onChange={(e) =>
                        setGlobalCfg({ ...globalCfg, description: e.target.value })
                      }
                      placeholder="Internal note, e.g. Q3 2026 agent incentive scheme"
                    />
                  </Form.Group>
                </Col>
              </Row>

              {/* Plain-language preview of the rule about to be saved */}
              <div className="bg-light border rounded-3 p-3 mt-3">
                {targetPts > 0 ? (
                  <>
                    <div>
                      An agent earns <strong>AED {fmt(rewardAed)}</strong> every time
                      they reach <strong>{fmt(targetPts)} points</strong> — that is{" "}
                      AED {fmt(targetPts)} of bookings.
                    </div>
                    <div className="text-muted small mt-1">
                      It repeats for every full block: {fmt(targetPts * 2)} points pays
                      AED {fmt(rewardAed * 2)}, {fmt(targetPts * 3)} points pays AED{" "}
                      {fmt(rewardAed * 3)}. Cancelling a booking voids its points on the
                      next sync.
                    </div>
                  </>
                ) : (
                  <div className="text-muted">
                    Set <strong>Points needed</strong> above 0 to activate the reward
                    rule.
                  </div>
                )}
              </div>
            </Card.Body>

            <Card.Footer className="bg-white d-flex justify-content-between align-items-center flex-wrap gap-2 py-3">
              <div className="small">
                {globalDirty ? (
                  <Badge bg="warning" text="dark">
                    Unsaved changes
                  </Badge>
                ) : (
                  <span className="text-muted">All changes saved</span>
                )}
              </div>
              <div className="d-flex gap-2">
                <Button
                  variant="outline-secondary"
                  onClick={resetGlobal}
                  disabled={savingGlobal || !globalDirty}
                >
                  <FaUndo className="me-2" /> Reset
                </Button>
                <Button
                  className="btn-indigo px-4"
                  onClick={saveGlobal}
                  disabled={savingGlobal}
                >
                  {savingGlobal ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" /> Saving...
                    </>
                  ) : (
                    <>
                      <FaSave className="me-2" /> Save Settings
                    </>
                  )}
                </Button>
              </div>
            </Card.Footer>
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
