import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Badge, Button, Form, InputGroup, OverlayTrigger, Spinner, Table, Tooltip } from "react-bootstrap";
import axiosInstance from "../../../components/AxiosInstance";
import PagerBar from "./PagerBar";
import { fmtDateTime, fmtNumber, fmtPercent, methodLabel } from "./automapFormat";

/**
 * "Mapped Hotels" tab: one row per in-house hotel, one column per supplier,
 * green tick / red cross per cell. Search, filters and paging are all
 * server-side (GET /api/hotel-mapping/auto/mapped). `refreshKey` changes
 * whenever the status poll reports new links, so the list follows the
 * engine without a manual reload.
 */
export default function MappedHotelsTab({ suppliers, active, refreshKey }) {
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [debounced, setDebounced] = useState({ search: "", country: "", city: "" });
  const [supplier, setSupplier] = useState("");
  const [status, setStatus] = useState("MAPPED");
  const [method, setMethod] = useState("ALL");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const requestSeq = useRef(0);

  // Debounce the free-text fields so each keystroke does not hit the server.
  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced({ search: search.trim(), country: country.trim(), city: city.trim() });
      setPage(0);
    }, 400);
    return () => clearTimeout(id);
  }, [search, country, city]);

  const load = useCallback(
    async (silent = false) => {
      const seq = ++requestSeq.current;
      if (!silent) setLoading(true);
      try {
        const res = await axiosInstance.get("/api/hotel-mapping/auto/mapped", {
          params: {
            search: debounced.search || undefined,
            country: debounced.country || undefined,
            city: debounced.city || undefined,
            supplier: supplier || undefined,
            status,
            method,
            page,
            size,
          },
          timeout: 30000,
        });
        if (seq !== requestSeq.current) return;
        setData(res.data);
        setError(null);
      } catch (err) {
        if (seq !== requestSeq.current) return;
        setError(err?.response?.data?.error || err?.response?.data?.message || "The mapped hotel list could not be loaded.");
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    },
    [debounced, supplier, status, method, page, size],
  );

  useEffect(() => {
    if (active) load(false);
  }, [active, load]);

  // Follow the engine: when the status poll reports new links, refresh quietly.
  const lastKey = useRef(refreshKey);
  useEffect(() => {
    if (active && refreshKey !== lastKey.current) {
      lastKey.current = refreshKey;
      load(true);
    }
  }, [active, refreshKey, load]);

  const columns = useMemo(() => suppliers || [], [suppliers]);
  const content = data?.content || [];

  return (
    <div className="d-flex flex-column gap-3">
      {/* ---- filters ---- */}
      <div className="ahm-panel p-3 ahm-filters">
        <div className="row g-2 align-items-end">
          <div className="col-lg-4 col-md-6">
            <Form.Label className="small fw-semibold text-muted mb-1">Search</Form.Label>
            <InputGroup>
              <InputGroup.Text>
                <i className="fas fa-search text-muted" aria-hidden="true"></i>
              </InputGroup.Text>
              <Form.Control
                placeholder="Hotel name, hotel ID, city, country, supplier or supplier hotel ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search mapped hotels"
              />
            </InputGroup>
          </div>
          <div className="col-lg-2 col-md-6">
            <Form.Label className="small fw-semibold text-muted mb-1">Supplier</Form.Label>
            <Form.Select value={supplier} onChange={(e) => { setSupplier(e.target.value); setPage(0); }} aria-label="Filter by supplier">
              <option value="">All suppliers</option>
              {columns.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.displayName || s.code}
                </option>
              ))}
            </Form.Select>
          </div>
          <div className="col-lg-2 col-md-4">
            <Form.Label className="small fw-semibold text-muted mb-1">Mapping status</Form.Label>
            <Form.Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} aria-label="Filter by mapping status">
              <option value="MAPPED">Mapped</option>
              <option value="UNMAPPED">Not mapped</option>
              <option value="ALL">All hotels</option>
            </Form.Select>
          </div>
          <div className="col-lg-2 col-md-4">
            <Form.Label className="small fw-semibold text-muted mb-1">Method</Form.Label>
            <Form.Select value={method} onChange={(e) => { setMethod(e.target.value); setPage(0); }} aria-label="Filter by mapping method">
              <option value="ALL">Automated + manual</option>
              <option value="AUTOMATED">Automated only</option>
              <option value="MANUAL">Manual only</option>
            </Form.Select>
          </div>
          <div className="col-lg-1 col-md-2">
            <Form.Label className="small fw-semibold text-muted mb-1">Country</Form.Label>
            <Form.Control placeholder="AE" value={country} onChange={(e) => setCountry(e.target.value)} aria-label="Filter by country" />
          </div>
          <div className="col-lg-1 col-md-2">
            <Form.Label className="small fw-semibold text-muted mb-1">City</Form.Label>
            <Form.Control placeholder="Dubai" value={city} onChange={(e) => setCity(e.target.value)} aria-label="Filter by city" />
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

      {/* ---- matrix ---- */}
      <div className="ahm-panel">
        <div className="ahm-panel-head">
          <span>
            Hotels {data ? <span className="text-muted fw-normal">({fmtNumber(data.totalElements)})</span> : null}
          </span>
          <span className="small fw-normal text-muted d-flex align-items-center gap-3">
            <span>
              <span className="ahm-mark is-mapped me-1" style={{ width: 20, height: 20, fontSize: ".8rem" }}>
                <i className="fas fa-check" aria-hidden="true"></i>
              </span>
              Mapped
            </span>
            <span>
              <span className="ahm-mark is-unmapped me-1" style={{ width: 20, height: 20, fontSize: ".8rem" }}>
                <i className="fas fa-times" aria-hidden="true"></i>
              </span>
              Not mapped
            </span>
            {loading && <Spinner animation="border" size="sm" role="status" aria-label="Loading" />}
          </span>
        </div>
        <Table responsive hover className="ahm-table">
          <thead>
            <tr>
              <th style={{ width: 44 }}>#</th>
              <th>Our hotel</th>
              <th>City</th>
              <th>Country</th>
              {columns.map((s) => (
                <th key={s.code} className="ahm-supplier-head">
                  <OverlayTrigger
                    placement="top"
                    overlay={
                      <Tooltip id={`ahm-col-${s.code}`}>
                        {s.displayName || s.code}
                        {!s.enabled ? " — not active" : !s.available ? " — temporarily unavailable" : ""}
                      </Tooltip>
                    }
                  >
                    <span className="ahm-sup-code">{s.code}</span>
                  </OverlayTrigger>
                </th>
              ))}
              <th className="text-center">Mapped</th>
              <th>Last processed</th>
            </tr>
          </thead>
          <tbody>
            {content.map((row, idx) => (
              <tr key={row.hotelId}>
                <td className="text-muted">{page * size + idx + 1}</td>
                <td>
                  <div className="ahm-hotel-name">{row.hotelName}</div>
                  <div className="ahm-hotel-id">
                    ID {row.hotelId}
                    {row.masterHotelId ? ` · master #${row.masterHotelId}` : ""}
                  </div>
                </td>
                <td>{row.city || "—"}</td>
                <td>
                  {row.country || "—"}
                  {row.countryCode ? <span className="text-muted small"> ({row.countryCode})</span> : null}
                </td>
                {columns.map((s) => {
                  const cell = (row.suppliers || []).find((c) => c.supplier === s.code);
                  return (
                    <td key={s.code} className="ahm-cell-sup">
                      <SupplierCell cell={cell} supplier={s} hotelName={row.hotelName} />
                    </td>
                  );
                })}
                <td className="text-center">
                  <Badge bg={row.mappedSupplierCount > 0 ? "success" : "secondary"} pill>
                    {row.mappedSupplierCount}/{columns.length}
                  </Badge>
                </td>
                <td className="small text-muted text-nowrap">
                  {fmtDateTime(row.lastProcessedAt)}
                  {row.progressStatus ? <div className="text-uppercase" style={{ fontSize: ".65rem" }}>{row.progressStatus.replace(/_/g, " ")}</div> : null}
                </td>
              </tr>
            ))}
            {!loading && data && content.length === 0 && (
              <tr>
                <td colSpan={5 + columns.length} className="ahm-empty">
                  <div className="ahm-empty-icon">
                    <i className="fas fa-hotel" aria-hidden="true"></i>
                  </div>
                  {status === "MAPPED"
                    ? "No hotel matches these filters yet. Mapped hotels appear here as the engine (or an operator) links them."
                    : "No hotel matches these filters."}
                </td>
              </tr>
            )}
            {loading && !data && (
              <tr>
                <td colSpan={5 + columns.length} className="text-center py-4">
                  <Spinner animation="border" size="sm" className="me-2" /> Loading mapped hotels…
                </td>
              </tr>
            )}
          </tbody>
        </Table>
        <div className="px-3 pb-3">
          <PagerBar
            page={page}
            size={size}
            totalElements={data?.totalElements || 0}
            totalPages={data?.totalPages || 1}
            onPageChange={setPage}
            onSizeChange={(n) => { setSize(n); setPage(0); }}
            disabled={loading}
          />
        </div>
      </div>
    </div>
  );
}

function SupplierCell({ cell, supplier, hotelName }) {
  if (!cell || !cell.mapped) {
    const blocked = supplier && !supplier.enabled;
    return (
      <OverlayTrigger
        placement="top"
        overlay={
          <Tooltip id={`ahm-cell-${supplier?.code}-${hotelName}`}>
            {blocked ? `${supplier.displayName || supplier.code} is not active` : "✕ Not mapped"}
          </Tooltip>
        }
      >
        <span className={`ahm-mark ${blocked ? "is-blocked" : "is-unmapped"}`} aria-label={blocked ? "Supplier not active" : "Not mapped"}>
          <i className={blocked ? "fas fa-minus" : "fas fa-times"} aria-hidden="true"></i>
        </span>
      </OverlayTrigger>
    );
  }
  return (
    <OverlayTrigger
      placement="top"
      overlay={
        <Tooltip id={`ahm-cell-${cell.supplier}-${cell.mappingId}`}>
          <div className="text-start">
            <div className="fw-bold">✓ Mapped — {methodLabel(cell.mappingMethod)}</div>
            <div>
              {cell.supplier} hotel ID: <strong>{cell.supplierHotelId}</strong>
            </div>
            {cell.supplierHotelName && <div>{cell.supplierHotelName}</div>}
            <div>Accuracy: {fmtPercent(cell.matchScore, 1)}</div>
            <div>Mapped: {fmtDateTime(cell.mappedAt)}</div>
            {cell.createdBy && <div>By: {cell.createdBy}</div>}
            {cell.matchDetails && <div className="fst-italic">{cell.matchDetails}</div>}
          </div>
        </Tooltip>
      }
    >
      <span className="ahm-mark is-mapped" aria-label={`Mapped (${methodLabel(cell.mappingMethod)})`}>
        <i className="fas fa-check" aria-hidden="true"></i>
      </span>
    </OverlayTrigger>
  );
}
