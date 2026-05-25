import React, { useEffect, useState } from "react";
import { Card, Button, Table, Modal, Form, Spinner, Row, Col } from "react-bootstrap";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import { FaEdit, FaSync, FaSave } from "react-icons/fa";

const SERVICE_TYPES = ["HOTEL", "CAB", "ACTIVITY", "PACKAGE", "RESTAURANT"];

const emptyForm = {
  id: null,
  serviceType: "HOTEL",
  pointsPerBooking: 10,
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

  // Global config (program-wide target points + rate per point)
  const [globalCfg, setGlobalCfg] = useState({
    id: null,
    globalTargetPoints: 0,
    ratePerPoint: 0,
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
    if (form.pointsPerBooking === "" || Number(form.pointsPerBooking) < 0) {
      toast.error("Points per booking must be a non-negative number");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        serviceType: form.serviceType,
        pointsPerBooking: Number(form.pointsPerBooking),
        minBookingAmount: form.minBookingAmount === "" ? null : Number(form.minBookingAmount),
        bonusAmountThreshold:
          form.bonusAmountThreshold === "" ? null : Number(form.bonusAmountThreshold),
        bonusPoints: Number(form.bonusPoints || 0),
        rewardAmount: form.rewardAmount === "" ? null : Number(form.rewardAmount),
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
    if (globalCfg.ratePerPoint === "" || Number(globalCfg.ratePerPoint) < 0) {
      toast.error("Rate per point must be a non-negative number");
      return;
    }
    setSavingGlobal(true);
    try {
      const payload = {
        globalTargetPoints: Number(globalCfg.globalTargetPoints),
        ratePerPoint: Number(globalCfg.ratePerPoint),
        active: !!globalCfg.active,
        description: globalCfg.description || null,
      };
      const res = await axiosInstance.put("/api/incentive/config/global", payload);
      if (res.data) {
        setGlobalCfg({
          id: res.data.id ?? null,
          globalTargetPoints: res.data.globalTargetPoints ?? 0,
          ratePerPoint: res.data.ratePerPoint ?? 0,
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
                    <Form.Label>Rate Per Point</Form.Label>
                    <Form.Control
                      type="number"
                      min={0}
                      step="0.01"
                      value={globalCfg.ratePerPoint}
                      onChange={(e) =>
                        setGlobalCfg({ ...globalCfg, ratePerPoint: e.target.value })
                      }
                      placeholder="e.g. 20"
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
                Claim amount = <strong>Total Earned Points × Rate Per Point</strong>.
                Agents become eligible to claim once their lifetime points reach the
                global target.
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
                    <th>Points / Booking</th>
                    <th>Min Booking Amt</th>
                    <th>Bonus Threshold</th>
                    <th>Bonus Points</th>
                    <th>Active</th>
                    <th>Description</th>
                    <th style={{ width: 80 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && (
                    <tr>
                      <td colSpan={8} className="text-center text-muted py-4">
                        <Spinner animation="border" size="sm" className="me-2" /> Loading...
                      </td>
                    </tr>
                  )}
                  {!isLoading && items.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center text-muted py-4">
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
                        <td>{item.pointsPerBooking}</td>
                        <td>{item.minBookingAmount ?? "-"}</td>
                        <td>{item.bonusAmountThreshold ?? "-"}</td>
                        <td>{item.bonusPoints ?? 0}</td>
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
                    <Form.Label>Points per Booking</Form.Label>
                    <Form.Control
                      type="number"
                      min={0}
                      value={form.pointsPerBooking}
                      onChange={(e) => setForm({ ...form, pointsPerBooking: e.target.value })}
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
                  </Form.Group>
                  <Form.Group className="mb-3 col-md-6">
                    <Form.Label>Bonus Threshold (optional)</Form.Label>
                    <Form.Control
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.bonusAmountThreshold}
                      onChange={(e) => setForm({ ...form, bonusAmountThreshold: e.target.value })}
                      placeholder="Booking > this earns bonus points"
                    />
                  </Form.Group>
                  <Form.Group className="mb-3 col-md-6">
                    <Form.Label>Bonus Points</Form.Label>
                    <Form.Control
                      type="number"
                      min={0}
                      value={form.bonusPoints}
                      onChange={(e) => setForm({ ...form, bonusPoints: e.target.value })}
                    />
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
