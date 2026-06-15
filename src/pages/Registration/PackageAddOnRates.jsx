import React, { useEffect, useState } from "react";
import { Card, Table, Button, Form, Modal, Row, Col, Badge } from "react-bootstrap";
import { FaPlus, FaEdit, FaTrash, FaBackward } from "react-icons/fa";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";

/**
 * Per-add-on rate manager. Mirrors the Activity rates pattern: a rate carries
 * a code, currency, base / child / infant prices, optional market filter, and
 * one or more validity windows (ISO date strings, same as Activity).
 */
const BLANK_RATE = {
  rateId: null,
  marketTypeId: null,
  rateCode: "",
  currency: "AED",
  basePrice: "",
  childPrice: "",
  infantPrice: "",
  minPax: "",
  maxPax: "",
  isActive: true,
  validities: [{ validityFrom: "", validityTo: "" }],
};

export default function PackageAddOnRates() {
  const navigate = useNavigate();
  const { addonId } = useParams();
  const location = useLocation();
  const passedAddon = location.state?.addon || null;

  const [addon, setAddon] = useState(passedAddon);
  const [rates, setRates] = useState([]);
  const [marketTypes, setMarketTypes] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(BLANK_RATE);

  const loadAddon = async () => {
    try {
      const res = await axiosInstance.get(`/api/package-addon/${addonId}`);
      setAddon(res.data);
    } catch (e) {
      console.error("load addon failed", e);
    }
  };

  const loadRates = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(`/api/package-addon/${addonId}/rates`);
      setRates(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error("load rates failed", e);
    } finally {
      setLoading(false);
    }
  };

  const loadMarketTypes = async () => {
    try {
      const res = await axiosInstance.get("/api/marketType");
      const list = Array.isArray(res.data) ? res.data : res.data?.content || [];
      setMarketTypes(list);
    } catch {
      setMarketTypes([]);
    }
  };

  // Pull the master currency list so the rate modal can offer a dropdown
  // instead of a free-text input. The backend stores `currency` as the ISO
  // code (e.g. "AED"), so we use `currencyCode` as the option value.
  const loadCurrencies = async () => {
    try {
      const res = await axiosInstance.get("/api/currency");
      const list = Array.isArray(res.data) ? res.data : res.data?.content || [];
      setCurrencies(list);
    } catch {
      setCurrencies([]);
    }
  };

  useEffect(() => {
    if (!passedAddon) loadAddon();
    loadRates();
    loadMarketTypes();
    loadCurrencies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addonId]);

  const openCreate = () => {
    setEditing({ ...BLANK_RATE, validities: [{ validityFrom: "", validityTo: "" }] });
    setShowModal(true);
  };

  const openEdit = (row) => {
    setEditing({
      rateId: row.rateId,
      marketTypeId: row.marketTypeId || null,
      rateCode: row.rateCode || "",
      currency: row.currency || "AED",
      basePrice: row.basePrice ?? "",
      childPrice: row.childPrice ?? "",
      infantPrice: row.infantPrice ?? "",
      minPax: row.minPax ?? "",
      maxPax: row.maxPax ?? "",
      isActive: row.isActive !== false,
      validities: (row.validities && row.validities.length > 0)
        ? row.validities.map((v) => ({
            validityId: v.validityId,
            validityFrom: v.validityFrom || "",
            validityTo: v.validityTo || "",
          }))
        : [{ validityFrom: "", validityTo: "" }],
    });
    setShowModal(true);
  };

  const validate = () => {
    if (editing.basePrice === "" || isNaN(Number(editing.basePrice))) {
      toast.error("Base Price is required and must be a number");
      return false;
    }
    return true;
  };

  const save = async () => {
    if (!validate()) return;
    const payload = {
      ...editing,
      addonId: Number(addonId),
      basePrice: editing.basePrice === "" ? null : Number(editing.basePrice),
      childPrice: editing.childPrice === "" ? null : Number(editing.childPrice),
      infantPrice: editing.infantPrice === "" ? null : Number(editing.infantPrice),
      minPax: editing.minPax === "" ? null : Number(editing.minPax),
      maxPax: editing.maxPax === "" ? null : Number(editing.maxPax),
      validities: editing.validities.filter((v) => v.validityFrom || v.validityTo),
    };
    try {
      await axiosInstance.post(`/api/package-addon/${addonId}/rates`, payload);
      toast.success(editing.rateId ? "Rate updated" : "Rate created");
      setShowModal(false);
      loadRates();
    } catch (e) {
      console.error("save rate failed", e);
      toast.error(e?.response?.data?.message || "Save failed");
    }
  };

  const handleDelete = async (row) => {
    const res = await Swal.fire({
      title: "Delete rate?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
      confirmButtonColor: "#dc3545",
    });
    if (!res.isConfirmed) return;
    try {
      await axiosInstance.delete(`/api/package-addon/rates/${row.rateId}`);
      toast.success("Deleted");
      loadRates();
    } catch (e) {
      console.error("delete rate failed", e);
      toast.error("Delete failed");
    }
  };

  const addValidityRow = () => {
    setEditing({ ...editing, validities: [...editing.validities, { validityFrom: "", validityTo: "" }] });
  };
  const removeValidityRow = (idx) => {
    const next = editing.validities.filter((_, i) => i !== idx);
    setEditing({ ...editing, validities: next.length ? next : [{ validityFrom: "", validityTo: "" }] });
  };
  const updateValidity = (idx, field, val) => {
    const next = editing.validities.map((v, i) => (i === idx ? { ...v, [field]: val } : v));
    setEditing({ ...editing, validities: next });
  };

  return (
    <div className="d-flex" style={{ minHeight: "100vh" }}>
      <Sidebar />
      <div className="flex-grow-1" style={{ background: "#f6f8fa" }}>
        <TopBar />
        <div className="container-fluid p-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <Button variant="link" className="p-0 me-2" onClick={() => navigate("/registration/package-addons")}>
                <FaBackward /> Back
              </Button>
              <span className="fw-bold fs-4">Rates — {addon?.name || "Add-On"}</span>
              {addon?.code && <Badge bg="secondary" className="ms-2">{addon.code}</Badge>}
            </div>
            <Button variant="primary" onClick={openCreate}>
              <FaPlus className="me-2" /> New Rate
            </Button>
          </div>

          <Card className="border-0 shadow-sm rounded-4">
            <Card.Body className="p-0">
              <Table responsive hover className="mb-0 align-middle">
                <thead className="table-light">
                  <tr>
                    <th>#</th>
                    <th>Rate Code</th>
                    <th>Market</th>
                    <th>Currency</th>
                    <th>Base</th>
                    <th>Child</th>
                    <th>Infant</th>
                    <th>Pax</th>
                    <th>Validity</th>
                    <th>Active</th>
                    <th className="text-end pe-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={11} className="text-center text-muted py-4">Loading…</td></tr>
                  )}
                  {!loading && rates.length === 0 && (
                    <tr><td colSpan={11} className="text-center text-muted py-4">No rates yet.</td></tr>
                  )}
                  {!loading && rates.map((row, i) => {
                    const mkt = marketTypes.find((m) => m.id === row.marketTypeId);
                    return (
                      <tr key={row.rateId}>
                        <td>{i + 1}</td>
                        <td>{row.rateCode || "—"}</td>
                        <td>{mkt ? (mkt.marketTypeName || mkt.name) : <span className="text-muted">Any</span>}</td>
                        <td>{row.currency || "AED"}</td>
                        <td>{row.basePrice ?? "—"}</td>
                        <td>{row.childPrice ?? "—"}</td>
                        <td>{row.infantPrice ?? "—"}</td>
                        <td>
                          {(row.minPax ?? "—")} – {(row.maxPax ?? "—")}
                        </td>
                        <td>
                          {row.validities && row.validities.length > 0
                            ? row.validities.map((v, k) => (
                                <div key={k} className="small">
                                  {v.validityFrom || "—"} → {v.validityTo || "—"}
                                </div>
                              ))
                            : <span className="text-muted">Always</span>}
                        </td>
                        <td>
                          {row.isActive
                            ? <Badge bg="success">Active</Badge>
                            : <Badge bg="secondary">Inactive</Badge>}
                        </td>
                        <td className="text-end pe-3">
                          <Button size="sm" variant="outline-primary" className="me-2" onClick={() => openEdit(row)}>
                            <FaEdit />
                          </Button>
                          <Button size="sm" variant="outline-danger" onClick={() => handleDelete(row)}>
                            <FaTrash />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </div>
      </div>

      <Modal show={showModal} onHide={() => setShowModal(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{editing.rateId ? "Edit Rate" : "New Rate"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Row className="g-3">
            <Col md={4}>
              <Form.Label>Rate Code</Form.Label>
              <Form.Control value={editing.rateCode}
                onChange={(e) => setEditing({ ...editing, rateCode: e.target.value })}
                placeholder="STD-2026" />
            </Col>
            <Col md={4}>
              <Form.Label>Market <small className="text-muted">(optional)</small></Form.Label>
              <Form.Select value={editing.marketTypeId || ""}
                onChange={(e) => setEditing({ ...editing, marketTypeId: e.target.value ? Number(e.target.value) : null })}>
                <option value="">Any market</option>
                {marketTypes.map((m) => (
                  <option key={m.id} value={m.id}>{m.marketTypeName || m.name}</option>
                ))}
              </Form.Select>
            </Col>
            <Col md={4}>
              <Form.Label>Currency</Form.Label>
              <Form.Select
                value={editing.currency || ""}
                onChange={(e) => setEditing({ ...editing, currency: e.target.value })}
              >
                {/* Defensive: when the saved currency code isn't in the
                    fetched list yet (load still in-flight, or master
                    pruned later), keep it visible so we don't silently
                    blank it out on save. */}
                {editing.currency &&
                  !currencies.some((c) => (c.currencyCode || c.code) === editing.currency) && (
                    <option value={editing.currency}>{editing.currency}</option>
                  )}
                {currencies.length === 0 && (
                  <option value="AED">AED</option>
                )}
                {currencies.map((c) => {
                  const code = c.currencyCode || c.code || "";
                  const label = (c.name || "").trim()
                    ? `${code} — ${(c.name || "").trim()}`
                    : code;
                  return (
                    <option key={c.currencyId || code} value={code}>
                      {label}
                    </option>
                  );
                })}
              </Form.Select>
            </Col>

            <Col md={4}>
              <Form.Label>Base Price<span className="text-danger">*</span></Form.Label>
              <Form.Control type="number" value={editing.basePrice}
                onChange={(e) => setEditing({ ...editing, basePrice: e.target.value })} />
            </Col>
            <Col md={4}>
              <Form.Label>Child Price</Form.Label>
              <Form.Control type="number" value={editing.childPrice}
                onChange={(e) => setEditing({ ...editing, childPrice: e.target.value })} />
            </Col>
            <Col md={4}>
              <Form.Label>Infant Price</Form.Label>
              <Form.Control type="number" value={editing.infantPrice}
                onChange={(e) => setEditing({ ...editing, infantPrice: e.target.value })} />
            </Col>

            <Col md={4}>
              <Form.Label>Min Pax</Form.Label>
              <Form.Control type="number" value={editing.minPax}
                onChange={(e) => setEditing({ ...editing, minPax: e.target.value })} />
            </Col>
            <Col md={4}>
              <Form.Label>Max Pax</Form.Label>
              <Form.Control type="number" value={editing.maxPax}
                onChange={(e) => setEditing({ ...editing, maxPax: e.target.value })} />
            </Col>
            <Col md={4} className="d-flex align-items-end">
              <Form.Check type="switch" id="rate-active" label="Active"
                checked={editing.isActive}
                onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })} />
            </Col>

            <Col md={12}>
              <div className="d-flex justify-content-between align-items-center mt-2">
                <Form.Label className="mb-0">Validity Windows</Form.Label>
                <Button size="sm" variant="outline-primary" onClick={addValidityRow}>
                  <FaPlus className="me-1" /> Add window
                </Button>
              </div>
              <small className="text-muted">Leave blank for "always valid". Use ISO format (YYYY-MM-DD).</small>
              <Table size="sm" className="mt-2 mb-0">
                <thead className="table-light">
                  <tr><th>From</th><th>To</th><th style={{ width: 60 }}></th></tr>
                </thead>
                <tbody>
                  {editing.validities.map((v, idx) => (
                    <tr key={idx}>
                      <td><Form.Control type="date" value={v.validityFrom || ""}
                        onChange={(e) => updateValidity(idx, "validityFrom", e.target.value)} /></td>
                      <td><Form.Control type="date" value={v.validityTo || ""}
                        onChange={(e) => updateValidity(idx, "validityTo", e.target.value)} /></td>
                      <td>
                        <Button size="sm" variant="outline-danger" onClick={() => removeValidityRow(idx)}>
                          <FaTrash />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={save}>Save</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
