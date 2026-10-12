import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Badge, Button, Form, InputGroup, OverlayTrigger, Spinner, Table, Tooltip } from "react-bootstrap";
import Swal from "sweetalert2";
import toast from "react-hot-toast";
import axiosInstance from "../../../components/AxiosInstance";
import PagerBar from "./PagerBar";
import { confidenceTone, escapeHtml, fmtDistance, fmtNumber, fmtPercent, reasonLabel } from "./automapFormat";

/**
 * "Supplier ↔ supplier" half of the Manual Review tab: pairs of hotels from
 * two different suppliers that the supplier-to-supplier pass thinks may be
 * the same property but did not map automatically (similar but not
 * identical names, too far apart, a tie, or a master that already holds that
 * supplier). "Map" puts both into one master hotel after the server re-checks
 * them; "Reject" closes the pair for good. Best matches first.
 */
export default function SupplierPairReview({ suppliers, active, canAct, onChanged, refreshKey }) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [supplier, setSupplier] = useState("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [acting, setActing] = useState(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(search.trim());
      setPage(0);
    }, 400);
    return () => clearTimeout(id);
  }, [search]);

  const load = useCallback(
    async (silent = false) => {
      const seq = ++requestSeq.current;
      if (!silent) setLoading(true);
      try {
        const res = await axiosInstance.get("/api/hotel-mapping/auto/supplier-pairs", {
          params: { search: debounced || undefined, supplier: supplier || undefined, page, size },
          timeout: 30000,
        });
        if (seq !== requestSeq.current) return;
        setData(res.data);
        setError(null);
      } catch (err) {
        if (seq !== requestSeq.current) return;
        setError(err?.response?.data?.error || err?.response?.data?.message || "The supplier pair list could not be loaded.");
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    },
    [debounced, supplier, page, size],
  );

  useEffect(() => {
    if (active) load(false);
  }, [active, load]);

  const lastKey = useRef(refreshKey);
  useEffect(() => {
    if (active && refreshKey !== lastKey.current) {
      lastKey.current = refreshKey;
      load(true);
    }
  }, [active, refreshKey, load]);

  const sideLine = (s) =>
    `<div><strong>${escapeHtml(s.supplierName || s.supplier)}:</strong> ${escapeHtml(s.name || "")} (ID ${escapeHtml(s.supplierHotelId)})` +
    `${s.masterHotelId ? ` · master #${s.masterHotelId}` : ""}</div>`;

  const approve = async (p) => {
    const confirm = await Swal.fire({
      title: "Map these two hotels as one?",
      html:
        `<div class="text-start small">` +
        sideLine(p.a) +
        sideLine(p.b) +
        `<div><strong>Accuracy:</strong> ${fmtPercent(p.confidence, 1)} · ${escapeHtml(reasonLabel(p.reason))}</div>` +
        `<div class="text-muted mt-2">The server re-checks both supplier hotels before saving. If either already belongs to a ` +
        `master hotel, the other joins it (or the two are merged). This decision is recorded under your login.</div>` +
        `</div>`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, map them",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#198754",
    });
    if (!confirm.isConfirmed) return;
    setActing(p.id);
    try {
      const res = await axiosInstance.post(`/api/hotel-mapping/auto/supplier-pairs/${p.id}/approve`, null, { timeout: 30000 });
      toast.success(res.data?.message || "Hotels mapped.");
      await load(true);
      if (onChanged) onChanged();
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || "The mapping could not be saved.");
    } finally {
      setActing(null);
    }
  };

  const reject = async (p) => {
    const confirm = await Swal.fire({
      title: "Reject this pair?",
      text: `"${p.a.name || p.a.supplierHotelId}" and "${p.b.name || p.b.supplierHotelId}" will not be proposed as the same hotel again.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Reject",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#dc3545",
    });
    if (!confirm.isConfirmed) return;
    setActing(p.id);
    try {
      const res = await axiosInstance.post(`/api/hotel-mapping/auto/supplier-pairs/${p.id}/reject`, null, { timeout: 30000 });
      toast.success(res.data?.message || "Pair rejected.");
      await load(true);
      if (onChanged) onChanged();
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || "The pair could not be rejected.");
    } finally {
      setActing(null);
    }
  };

  const content = data?.content || [];

  return (
    <div className="d-flex flex-column gap-3">
      <div className="ahm-panel p-3 ahm-filters">
        <div className="row g-2 align-items-end">
          <div className="col-lg-6 col-md-8">
            <Form.Label className="small fw-semibold text-muted mb-1">Search</Form.Label>
            <InputGroup>
              <InputGroup.Text>
                <i className="fas fa-search text-muted" aria-hidden="true"></i>
              </InputGroup.Text>
              <Form.Control
                placeholder="Hotel name, city, country code or supplier hotel ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search supplier pairs"
              />
            </InputGroup>
          </div>
          <div className="col-lg-3 col-md-4">
            <Form.Label className="small fw-semibold text-muted mb-1">Supplier</Form.Label>
            <Form.Select value={supplier} onChange={(e) => { setSupplier(e.target.value); setPage(0); }} aria-label="Filter pairs by supplier">
              <option value="">All suppliers</option>
              {(suppliers || []).map((s) => (
                <option key={s.code} value={s.code}>
                  {s.displayName || s.code}
                </option>
              ))}
            </Form.Select>
          </div>
          <div className="col-lg-3 col-md-12 small text-muted">
            Best matches first. Nothing here is ever mapped without your approval.
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="danger" className="mb-0 d-flex justify-content-between align-items-center">
          <span>
            <i className="fas fa-exclamation-circle me-2" aria-hidden="true"></i>
            {error}
          </span>
          <Button size="sm" variant="outline-danger" onClick={() => load(false)}>
            Retry
          </Button>
        </Alert>
      )}

      <div className="ahm-panel">
        <div className="ahm-panel-head">
          <span>
            Supplier hotel pairs to review{" "}
            {data ? <span className="text-muted fw-normal">({fmtNumber(data.totalElements)})</span> : null}
          </span>
          {loading && <Spinner animation="border" size="sm" role="status" aria-label="Loading" />}
        </div>
        <Table responsive hover className="ahm-table">
          <thead>
            <tr>
              <th style={{ width: 44 }}>#</th>
              <th>Hotel A</th>
              <th>Hotel B</th>
              <th className="text-end">Match</th>
              <th>Why not automatic</th>
              {canAct && <th className="text-end">Action</th>}
            </tr>
          </thead>
          <tbody>
            {content.map((p, idx) => (
              <tr key={p.id}>
                <td className="text-muted">{page * size + idx + 1}</td>
                <td>
                  <PairSide side={p.a} />
                </td>
                <td>
                  <PairSide side={p.b} />
                </td>
                <td className="text-end">
                  <Badge bg={confidenceTone(p.confidence)} pill>
                    {fmtPercent(p.confidence, 1)}
                  </Badge>
                </td>
                <td className="small">
                  <OverlayTrigger
                    placement="top"
                    overlay={
                      <Tooltip id={`ahm-pair-reason-${p.id}`}>
                        <div className="text-start">
                          <div>{p.detail || reasonLabel(p.reason)}</div>
                          <div>Name similarity: {fmtPercent(p.nameScore, 1)}</div>
                          <div>Distance: {fmtDistance(p.distanceMeters)}</div>
                        </div>
                      </Tooltip>
                    }
                  >
                    <span style={{ cursor: "help" }}>
                      {reasonLabel(p.reason)}
                      <i className="fas fa-info-circle ms-1 text-muted" aria-hidden="true"></i>
                    </span>
                  </OverlayTrigger>
                </td>
                {canAct && (
                  <td className="text-end text-nowrap">
                    <Button
                      size="sm"
                      variant="success"
                      className="rounded-pill px-3 me-1"
                      disabled={acting !== null}
                      onClick={() => approve(p)}
                      aria-label={`Map ${p.a.supplier} hotel ${p.a.supplierHotelId} and ${p.b.supplier} hotel ${p.b.supplierHotelId} as one`}
                    >
                      {acting === p.id ? <Spinner animation="border" size="sm" /> : "Map"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-danger"
                      className="rounded-pill px-3"
                      disabled={acting !== null}
                      onClick={() => reject(p)}
                      aria-label={`Reject pair ${p.id}`}
                    >
                      Reject
                    </Button>
                  </td>
                )}
              </tr>
            ))}
            {!loading && data && content.length === 0 && (
              <tr>
                <td colSpan={canAct ? 6 : 5} className="ahm-empty">
                  <div className="ahm-empty-icon">
                    <i className="fas fa-clipboard-check" aria-hidden="true"></i>
                  </div>
                  {debounced || supplier
                    ? "No pair matches these filters."
                    : "Nothing is waiting for review. Pairs appear here when two suppliers' hotels look alike but are not a 100% match."}
                </td>
              </tr>
            )}
            {loading && !data && (
              <tr>
                <td colSpan={canAct ? 6 : 5} className="text-center py-4">
                  <Spinner animation="border" size="sm" className="me-2" /> Loading pairs…
                </td>
              </tr>
            )}
          </tbody>
        </Table>
        {data && (
          <div className="px-3 pb-3">
            <PagerBar
              page={page}
              size={size}
              totalElements={data.totalElements || 0}
              totalPages={data.totalPages || 1}
              onPageChange={setPage}
              onSizeChange={(n) => { setSize(n); setPage(0); }}
              disabled={loading}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function PairSide({ side }) {
  if (!side) return <span className="text-muted">—</span>;
  return (
    <div>
      <div className="d-flex align-items-center gap-1 flex-wrap">
        <span className="ahm-chip">{side.supplier}</span>
        <span className="ahm-hotel-name">{side.name || <span className="text-muted">(unnamed)</span>}</span>
      </div>
      <div className="ahm-hotel-id">
        ID {side.supplierHotelId}
        {[side.city, side.country].filter(Boolean).length ? ` · ${[side.city, side.country].filter(Boolean).join(", ")}` : ""}
        {side.masterHotelId ? ` · master #${side.masterHotelId}` : ""}
      </div>
    </div>
  );
}
