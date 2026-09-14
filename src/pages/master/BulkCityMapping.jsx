import React, { useState, useEffect, useMemo } from "react";
import {
  Card,
  Form,
  Button,
  Row,
  Col,
  Badge,
  Spinner,
  Alert,
  Table,
  Modal,
  Accordion,
} from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import BackButton from "../../components/BackButton";
import axiosInstance from "../../components/AxiosInstance";

/**
 * Bulk (Auto) City Mapping — Manage Masters ▸ Mapping Settings ▸ Bulk Auto Mapping.
 *
 * One-click driver for the automatic api_city_mapping filler already wired
 * behind POST /api/cityMapping/bulk. Runs a dry-run (Preview) first, shows
 * counts + sample unmatched/ambiguous cities, then Applies with a drift
 * check — the BE re-runs a fresh preview and refuses to write if row counts
 * changed since the operator's own Preview, so a concurrent manual edit
 * never gets silently overwritten.
 *
 * Restricted to super_admin at the route (see App.jsx) and Sidebar levels.
 * The BE endpoint itself accepts ADMIN or SUPER_ADMIN so existing curl /
 * JUnit runners still work.
 */

/** Providers the BE bulk engine currently supports (lowercase keys the BE expects). */
const SUPPORTED_PROVIDERS = [
  "atharva",
  "grn",
  "goglobal",
  "iwtx",
  "x3",
  "darina",
  "ratehawk",
];

/**
 * Providers the automatic engine does NOT map today. Rendered as disabled
 * checkboxes so the operator sees WHY they can't tick them, instead of
 * asking every quarter.
 */
const UNSUPPORTED_PROVIDERS = [
  {
    key: "jumeirah",
    reason:
      "Jumeirah uses hotel-level mapping (jumeirah_hotel_list.mapper_id), not city-level rows in api_city_mapping.",
  },
  {
    key: "juniper",
    reason: "Juniper's bulk mapping isn't implemented yet.",
  },
];

const PROVIDER_LABEL = {
  atharva: "Atharva",
  grn: "GRN",
  goglobal: "GoGlobal",
  iwtx: "IWTX",
  x3: "X3",
  darina: "Darina",
  ratehawk: "RateHawk",
  jumeirah: "Jumeirah",
  juniper: "Juniper",
};

/**
 * Capital-first labels the manual /masters/city-mapping screen uses for the
 * apiProvider select — so the "Map Manually" jump can hand it a value the
 * page already understands, no dropdown normalisation needed.
 */
const PROVIDER_MANUAL_LABEL = {
  atharva: "Atharva",
  grn: "Grn",
  goglobal: "Goglobal",
  iwtx: "Iwtx",
  x3: "X3",
  darina: "Darina",
  ratehawk: "Ratehawk",
};

const BulkCityMapping = () => {
  const navigate = useNavigate();

  // Providers list from the BE (fallback to SUPPORTED_PROVIDERS on error).
  const [providers, setProviders] = useState(SUPPORTED_PROVIDERS);
  const [selectedProviders, setSelectedProviders] = useState(
    new Set(SUPPORTED_PROVIDERS),
  );
  const [suffixStripping, setSuffixStripping] = useState(true);
  const [sampleLimit, setSampleLimit] = useState(100);

  const [loading, setLoading] = useState(null); // "preview" | "apply" | null
  const [previewResult, setPreviewResult] = useState(null);
  const [applyResult, setApplyResult] = useState(null);
  const [driftResult, setDriftResult] = useState(null); // preview from BE when drift was detected
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Fetch the BE's actual provider list — if a supplier is disabled server-side
  // or a new one is added, we show that instead of the hardcoded fallback.
  useEffect(() => {
    axiosInstance
      .get("/api/cityMapping/bulk/providers")
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : SUPPORTED_PROVIDERS;
        setProviders(list);
        setSelectedProviders(new Set(list));
      })
      .catch(() => {
        // BE might be older or the endpoint gated — fall back silently.
        setProviders(SUPPORTED_PROVIDERS);
        setSelectedProviders(new Set(SUPPORTED_PROVIDERS));
      });
  }, []);

  const toggleProvider = (key) => {
    setSelectedProviders((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = (check) => {
    setSelectedProviders(check ? new Set(providers) : new Set());
  };

  // The result we display: apply wins over preview so a successful write
  // replaces the previous preview panel without the operator having to
  // re-click Preview.
  const displayResult = applyResult || previewResult;

  // Whether Apply should be enabled: preview must have been run this
  // session, at least one supplier selected, at least one supplier has
  // newMappings > 0, and no run is currently in flight.
  const canApply = useMemo(() => {
    if (!previewResult || loading || selectedProviders.size === 0) return false;
    const rows = previewResult.providers || [];
    return rows.some((p) => (p.newMappings || 0) > 0);
  }, [previewResult, loading, selectedProviders]);

  const buildRequest = (dryRun, expectedNewRows = null) => ({
    providers: Array.from(selectedProviders),
    dryRun,
    sampleLimit: Number(sampleLimit) || 100,
    suffixStripping,
    ...(expectedNewRows ? { expectedNewRows } : {}),
  });

  const runPreview = async () => {
    if (selectedProviders.size === 0) {
      toast.error("Pick at least one supplier first.");
      return;
    }
    setLoading("preview");
    setPreviewResult(null);
    setApplyResult(null);
    setDriftResult(null);
    try {
      const res = await axiosInstance.post(
        "/api/cityMapping/bulk",
        buildRequest(true),
      );
      setPreviewResult(res.data || null);
      toast.success("Preview complete.");
    } catch (err) {
      const msg =
        err?.response?.data?.error || err?.message || "Preview failed.";
      toast.error(msg);
    } finally {
      setLoading(null);
    }
  };

  const doApply = async () => {
    if (!previewResult) return;
    setShowConfirmModal(false);
    // Build the expected map from the last preview, restricted to the
    // suppliers still ticked — a supplier the operator un-ticked between
    // preview and confirm must not be counted against the drift check.
    const expected = {};
    (previewResult.providers || []).forEach((p) => {
      if (selectedProviders.has(p.provider)) {
        expected[p.provider] = p.newMappings || 0;
      }
    });

    setLoading("apply");
    setApplyResult(null);
    setDriftResult(null);
    try {
      const res = await axiosInstance.post(
        "/api/cityMapping/bulk",
        buildRequest(false, expected),
      );
      const data = res.data;
      if (data && data.driftDetected) {
        // The BE ran a fresh preview and found the counts have moved —
        // it did NOT write. Surface old-vs-new so the operator decides.
        setDriftResult(data);
        toast.error("Row counts changed since your preview — nothing written.");
      } else {
        setApplyResult(data || null);
        toast.success("Mappings written.");
      }
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || "Apply failed.";
      toast.error(msg);
    } finally {
      setLoading(null);
    }
  };

  const downloadReport = () => {
    const data = displayResult;
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    a.href = url;
    a.download = `bulk-city-mapping-${data.dryRun ? "preview" : "applied"}-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /**
   * Jump to the manual /masters/city-mapping screen prefilled with a (master
   * city, supplier) pair. CityMapping.jsx reads `location.state.prefill` on
   * mount and preselects the row (see the small hook added there).
   */
  const jumpToManual = (masterCityId, providerKey) => {
    navigate("/masters/city-mapping", {
      state: {
        prefill: {
          masterCityId,
          apiProvider: PROVIDER_MANUAL_LABEL[providerKey] || providerKey,
        },
      },
    });
  };

  const providerRowCount = (result, providerKey) => {
    const stats = (result?.providers || []).find(
      (p) => p.provider === providerKey,
    );
    return stats?.newMappings || 0;
  };

  const totalNewRows = (result) =>
    (result?.providers || []).reduce(
      (s, p) => s + (p.newMappings || 0),
      0,
    );

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <div className="d-flex align-items-center mb-3 gap-2">
            <BackButton />
            <h4 className="mb-0">Bulk (Auto) City Mapping</h4>
            <Badge bg="dark" className="ms-2">
              Super Admin
            </Badge>
          </div>

          <Alert variant="info" className="py-2 small">
            Fills gaps in <code>api_city_mapping</code> using each supplier's own
            city catalogue. Existing rows (including soft-deleted) are never
            modified. Preview first, then Apply — the write is refused if row
            counts changed between the two clicks.
          </Alert>

          {/* ── Suppliers ─────────────────────────────────────────── */}
          <Card className="mb-3 shadow-sm">
            <Card.Header className="d-flex align-items-center justify-content-between">
              <strong>Suppliers</strong>
              <div className="d-flex gap-2">
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => toggleAll(true)}
                >
                  Select all
                </Button>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => toggleAll(false)}
                >
                  Clear
                </Button>
              </div>
            </Card.Header>
            <Card.Body>
              <Row xs={1} sm={2} md={3} lg={4} className="g-2">
                {providers.map((key) => (
                  <Col key={key}>
                    <Form.Check
                      type="checkbox"
                      id={`bulk-provider-${key}`}
                      label={PROVIDER_LABEL[key] || key}
                      checked={selectedProviders.has(key)}
                      onChange={() => toggleProvider(key)}
                    />
                  </Col>
                ))}
                {UNSUPPORTED_PROVIDERS.map((up) => (
                  <Col key={up.key}>
                    <Form.Check
                      type="checkbox"
                      id={`bulk-provider-${up.key}`}
                      label={
                        <span
                          className="text-muted"
                          title={up.reason}
                        >
                          {PROVIDER_LABEL[up.key] || up.key}{" "}
                          <small>(not supported)</small>
                        </span>
                      }
                      disabled
                    />
                  </Col>
                ))}
              </Row>
            </Card.Body>
          </Card>

          {/* ── Options ───────────────────────────────────────────── */}
          <Card className="mb-3 shadow-sm">
            <Card.Header>
              <strong>Options</strong>
            </Card.Header>
            <Card.Body>
              <Row>
                <Col md={6}>
                  <Form.Check
                    type="switch"
                    id="bulk-suffix-stripping"
                    checked={suffixStripping}
                    onChange={(e) => setSuffixStripping(e.target.checked)}
                    label={
                      <span>
                        Suffix stripping{" "}
                        <small
                          className="text-muted"
                          title={
                            "Drops trailing US/CA/AU state tokens (\"Abilene, TX\" ↔ \"Abilene\") only when the finer levels found nothing, only for 1:1 groups, and never when the two sides carry different city codes."
                          }
                        >
                          (hover for detail)
                        </small>
                      </span>
                    }
                  />
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label className="small mb-1">
                      Sample size per category
                    </Form.Label>
                    <Form.Control
                      type="number"
                      min={0}
                      max={2000}
                      value={sampleLimit}
                      onChange={(e) => setSampleLimit(e.target.value)}
                      size="sm"
                      style={{ maxWidth: 140 }}
                    />
                    <Form.Text className="text-muted">
                      Example unmatched / ambiguous / conflict rows returned per
                      supplier (max 2000).
                    </Form.Text>
                  </Form.Group>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {/* ── Buttons ───────────────────────────────────────────── */}
          <div className="d-flex gap-2 mb-3">
            <Button
              variant="outline-primary"
              onClick={runPreview}
              disabled={loading !== null || selectedProviders.size === 0}
            >
              {loading === "preview" ? (
                <>
                  <Spinner animation="border" size="sm" className="me-1" />
                  Previewing…
                </>
              ) : (
                "Preview (Dry Run)"
              )}
            </Button>
            <Button
              variant="primary"
              onClick={() => setShowConfirmModal(true)}
              disabled={!canApply || loading !== null}
              title={
                !previewResult
                  ? "Run a Preview first."
                  : !canApply
                    ? "Preview found no new rows to write."
                    : "Write new rows to api_city_mapping."
              }
            >
              {loading === "apply" ? (
                <>
                  <Spinner animation="border" size="sm" className="me-1" />
                  Applying…
                </>
              ) : (
                "Apply"
              )}
            </Button>
            {displayResult && (
              <Button variant="outline-secondary" onClick={downloadReport}>
                Download JSON report
              </Button>
            )}
          </div>

          {/* ── Drift banner ──────────────────────────────────────── */}
          {driftResult && (
            <Alert variant="warning" className="mb-3">
              <strong>Row counts changed since your preview.</strong> Nothing
              was written. Re-run Preview to see the current numbers and
              decide.
              <div className="small mt-2">
                {Object.entries(driftResult.driftBySupplier || {}).map(
                  ([prov, drift]) => (
                    <div key={prov}>
                      <strong>{PROVIDER_LABEL[prov] || prov}</strong>: preview
                      showed {drift.expected} new rows, current is{" "}
                      {drift.actual}.
                    </div>
                  ),
                )}
              </div>
            </Alert>
          )}

          {/* ── Result ────────────────────────────────────────────── */}
          {displayResult && (
            <Card className="shadow-sm">
              <Card.Header className="d-flex justify-content-between align-items-center">
                <strong>
                  {displayResult.dryRun ? "Preview" : "Applied"} — total new
                  rows: {totalNewRows(displayResult).toLocaleString()}
                </strong>
                <small className="text-muted">
                  {displayResult.startedAt} · {displayResult.durationMs}ms ·{" "}
                  {displayResult.actor}
                </small>
              </Card.Header>
              <Card.Body>
                <Accordion alwaysOpen>
                  {(displayResult.providers || []).map((p, idx) => (
                    <Accordion.Item eventKey={String(idx)} key={p.provider}>
                      <Accordion.Header>
                        <div className="d-flex align-items-center flex-wrap gap-2 w-100">
                          <strong>
                            {PROVIDER_LABEL[p.provider] || p.provider}
                          </strong>
                          {p.error ? (
                            <Badge bg="danger">Error</Badge>
                          ) : (
                            <Badge bg="primary">
                              {(p.newMappings || 0).toLocaleString()} new
                            </Badge>
                          )}
                          <Badge bg="success">
                            {(p.matched || 0).toLocaleString()} matched
                          </Badge>
                          <Badge bg="secondary">
                            {(p.alreadyMapped || 0).toLocaleString()} already
                          </Badge>
                          <Badge bg="warning" text="dark">
                            {(p.ambiguous || 0).toLocaleString()} ambiguous
                          </Badge>
                          <Badge bg="danger">
                            {(p.unmatched || 0).toLocaleString()} unmatched
                          </Badge>
                        </div>
                      </Accordion.Header>
                      <Accordion.Body>
                        {p.error && (
                          <Alert variant="danger" className="py-2 small">
                            {p.error}
                          </Alert>
                        )}

                        <Row className="mb-3">
                          <Col md={6}>
                            <div className="small text-muted">
                              Countries resolved:{" "}
                              <strong>
                                {p.countriesResolved}/{p.supplierCountries}
                              </strong>
                              <br />
                              Supplier cities: {(p.supplierCities || 0).toLocaleString()}
                              <br />
                              Inhouse cities checked:{" "}
                              {(p.inhouseCitiesChecked || 0).toLocaleString()}
                              <br />
                              No-hotel skips:{" "}
                              {(p.skippedNoHotels || 0).toLocaleString()}
                              <br />
                              {!displayResult.dryRun && (
                                <>
                                  Inserted:{" "}
                                  <strong>
                                    {(p.inserted || 0).toLocaleString()}
                                  </strong>
                                  {p.insertErrors > 0 && (
                                    <span className="text-danger">
                                      {" "}
                                      · {p.insertErrors} insert errors
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </Col>
                          <Col md={6}>
                            <div className="small">
                              <strong>Match levels</strong>
                              <Table size="sm" borderless className="mb-0">
                                <tbody>
                                  {Object.entries(p.matchedByLevel || {}).map(
                                    ([lvl, n]) => (
                                      <tr key={lvl}>
                                        <td className="py-0">{lvl}</td>
                                        <td className="py-0 text-end">
                                          {Number(n).toLocaleString()}
                                        </td>
                                      </tr>
                                    ),
                                  )}
                                  {p.matchedViaCodeTieBreak > 0 && (
                                    <tr>
                                      <td className="py-0 text-muted">
                                        via code tie-break
                                      </td>
                                      <td className="py-0 text-end">
                                        {p.matchedViaCodeTieBreak}
                                      </td>
                                    </tr>
                                  )}
                                  {p.rejectedCodeConflict > 0 && (
                                    <tr>
                                      <td className="py-0 text-muted">
                                        suffix rejected (code conflict)
                                      </td>
                                      <td className="py-0 text-end">
                                        {p.rejectedCodeConflict}
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </Table>
                            </div>
                          </Col>
                        </Row>

                        <SampleList
                          title="Unmatched cities"
                          samples={p.unmatchedSamples}
                          provider={p.provider}
                          onJumpToManual={jumpToManual}
                        />
                        <SampleList
                          title="Ambiguous cities"
                          samples={p.ambiguousSamples}
                          provider={p.provider}
                          onJumpToManual={jumpToManual}
                        />
                        <SampleList
                          title="Conflicts (supplier city already used)"
                          samples={p.conflictSamples}
                          provider={p.provider}
                          onJumpToManual={jumpToManual}
                        />
                        {p.unresolvedCountrySamples?.length > 0 && (
                          <div className="mt-2 small">
                            <strong>Unresolved countries:</strong>{" "}
                            {p.unresolvedCountrySamples.join(", ")}
                          </div>
                        )}
                      </Accordion.Body>
                    </Accordion.Item>
                  ))}
                </Accordion>
              </Card.Body>
            </Card>
          )}
        </main>
      </div>

      {/* ── Confirm Apply modal ─────────────────────────────────────── */}
      <Modal
        show={showConfirmModal}
        onHide={() => setShowConfirmModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Confirm write</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-2">
            Write{" "}
            <strong>
              {totalNewRows(previewResult).toLocaleString()}
            </strong>{" "}
            new rows to <code>api_city_mapping</code>?
          </p>
          <Table size="sm" borderless>
            <tbody>
              {(previewResult?.providers || [])
                .filter(
                  (p) =>
                    selectedProviders.has(p.provider) &&
                    (p.newMappings || 0) > 0,
                )
                .map((p) => (
                  <tr key={p.provider}>
                    <td className="py-0">{PROVIDER_LABEL[p.provider] || p.provider}</td>
                    <td className="py-0 text-end">
                      <strong>{(p.newMappings || 0).toLocaleString()}</strong> new
                    </td>
                  </tr>
                ))}
            </tbody>
          </Table>
          <div className="small text-muted mt-2">
            The server will re-verify these counts before writing. If another
            operator edits the mapping table between now and the write, the
            request is refused and nothing is inserted.
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-secondary"
            onClick={() => setShowConfirmModal(false)}
          >
            Cancel
          </Button>
          <Button variant="primary" onClick={doApply}>
            Yes, write to database
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

/**
 * Collapsible list of Sample rows. Renders max 20 at a time to keep the DOM
 * lean when the operator ran with a large sampleLimit; the full list is in
 * the downloaded JSON report.
 */
const SampleList = ({ title, samples, provider, onJumpToManual }) => {
  const list = Array.isArray(samples) ? samples : [];
  const [expanded, setExpanded] = useState(false);
  if (list.length === 0) return null;
  const shown = expanded ? list : list.slice(0, 20);
  return (
    <div className="mt-3">
      <div className="d-flex justify-content-between align-items-center">
        <strong className="small">
          {title} ({list.length.toLocaleString()})
        </strong>
        {list.length > 20 && (
          <Button
            variant="link"
            size="sm"
            className="p-0"
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? "Show first 20" : `Show all ${list.length}`}
          </Button>
        )}
      </div>
      <Table size="sm" hover className="mb-0">
        <thead>
          <tr className="small text-muted">
            <th>Master city</th>
            <th>Country</th>
            <th>Detail</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {shown.map((s, i) => (
            <tr key={`${s.masterCityId}-${i}`}>
              <td className="small">{s.masterCity || "—"}</td>
              <td className="small">{s.countryIso || "—"}</td>
              <td className="small">{s.detail || "—"}</td>
              <td className="small text-end">
                {s.masterCityId && (
                  <Button
                    variant="link"
                    size="sm"
                    className="p-0"
                    onClick={() => onJumpToManual(s.masterCityId, provider)}
                  >
                    Map manually
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
};

export default BulkCityMapping;
