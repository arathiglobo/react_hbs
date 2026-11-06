import React, { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, ButtonGroup, Form, InputGroup, Spinner, Table } from "react-bootstrap";
import Swal from "sweetalert2";
import toast from "react-hot-toast";
import axiosInstance from "../../../components/AxiosInstance";
import PagerBar from "./PagerBar";
import { fmtDistance, fmtNumber, fmtPercent } from "./automapFormat";

const BUCKETS = [
  { key: "LINK", label: "Ready to link", field: "readyToLink", tone: "success" },
  { key: "REVIEW_NAME_DIFFERS", label: "Names differ", field: "nameDiffers", tone: "warning" },
  { key: "REVIEW_TOO_FAR", label: "Too far apart", field: "tooFar", tone: "warning" },
];

const APPLY_SIZES = [10, 100, 500, 2000];

/**
 * Shows what GRN and GoGlobal's GIATA codes would link, before anything changes.
 * Links are only written when an admin presses Apply, safest pairs first, and the
 * pairs that need a person go to the normal review list.
 */
export default function GiataPreviewTab({ active, onChanged }) {
  const [bucket, setBucket] = useState("LINK");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [applySize, setApplySize] = useState(10);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(search.trim());
      setPage(0);
    }, 400);
    return () => clearTimeout(id);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/api/hotel-mapping/auto/giata/preview", {
        params: { bucket, search: debounced || undefined, page, size },
        timeout: 120000,
      });
      setData(res.data);
      setError(null);
    } catch (err) {
      setError(err?.response?.data?.error || "The GIATA preview could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [bucket, debounced, page, size]);

  useEffect(() => {
    if (active) load();
  }, [active, load]);

  const describe = (r) => {
    const parts = [`${fmtNumber(r.linked)} done`];
    if (r.alreadyLinked) parts.push(`${fmtNumber(r.alreadyLinked)} already linked`);
    if (r.refused) parts.push(`${fmtNumber(r.refused)} refused by the safety check`);
    if (r.failed) parts.push(`${fmtNumber(r.failed)} failed`);
    return parts.join(", ");
  };

  const run = async (path, title, text, confirmText) => {
    const confirm = await Swal.fire({
      title,
      text,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: "Cancel",
    });
    if (!confirm.isConfirmed) return;
    setActing(true);
    try {
      const res = await axiosInstance.post(`/api/hotel-mapping/auto/giata/${path}`, null, {
        params: { limit: applySize },
        timeout: 300000,
      });
      const message = describe(res.data);
      if (res.data.failed > 0) toast.error(message);
      else toast.success(message);
      await load();
      if (onChanged) onChanged();
    } catch (err) {
      toast.error(err?.response?.data?.error || "That could not be completed.");
    } finally {
      setActing(false);
    }
  };

  const items = data?.items?.content || [];

  return (
    <div className="d-flex flex-column gap-3">
      <div className="ahm-panel p-3">
        <p className="mb-2">
          GRN and GoGlobal send a GIATA code with each hotel. Two hotels with the same code should be the same property.{" "}
          <strong>Nothing here changes until you press Apply.</strong>
        </p>
        {data && (
          <p className="small text-muted mb-0">
            A pair is ready to link when the code matches, the hotels are within {fmtDistance(data.maxDistanceMeters)}, and they
            share at least {fmtPercent(data.minWordOverlap * 100)} of their name words. Other pairs need a person, as they may
            be a rebrand or old data. Codes on file: GRN {fmtNumber(data.grnHotelsWithCode)}, GoGlobal{" "}
            {fmtNumber(data.goGlobalHotelsWithCode)}. Already linked: {fmtNumber(data.alreadyLinked)}.
          </p>
        )}
      </div>

      {data && !data.applyAllowed && (
        <Alert variant="warning" className="mb-0">
          {!data.goGlobalEnabled ? "GoGlobal" : "GRN"} is not enabled on API Access, so you can preview these pairs but not apply
          them yet.
        </Alert>
      )}
      {error && (
        <Alert variant="danger" className="mb-0 d-flex justify-content-between align-items-center">
          <span>{error}</span>
          <Button size="sm" variant="outline-danger" onClick={load}>
            Retry
          </Button>
        </Alert>
      )}

      <div className="ahm-panel p-3 d-flex flex-wrap align-items-end gap-3">
        <ButtonGroup aria-label="Choose a list">
          {BUCKETS.map((b) => (
            <Button
              key={b.key}
              variant={bucket === b.key ? "primary" : "outline-secondary"}
              onClick={() => {
                setBucket(b.key);
                setPage(0);
              }}
            >
              {b.label}{" "}
              <Badge bg={bucket === b.key ? "light" : b.tone} text="dark">
                {fmtNumber(data?.[b.field])}
              </Badge>
            </Button>
          ))}
        </ButtonGroup>
        <div className="flex-grow-1" style={{ minWidth: 220 }}>
          <Form.Label className="small fw-semibold text-muted mb-1">Search</Form.Label>
          <InputGroup>
            <InputGroup.Text>
              <i className="fas fa-search text-muted" aria-hidden="true"></i>
            </InputGroup.Text>
            <Form.Control
              placeholder="Hotel, city, country code or GIATA code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search GIATA pairs"
            />
          </InputGroup>
        </div>
        <div>
          <Form.Label className="small fw-semibold text-muted mb-1">How many at once</Form.Label>
          <Form.Select value={applySize} onChange={(e) => setApplySize(Number(e.target.value))} aria-label="How many pairs at once">
            {APPLY_SIZES.map((n) => (
              <option key={n} value={n}>
                {fmtNumber(n)}
              </option>
            ))}
          </Form.Select>
        </div>
        {bucket === "LINK" ? (
          <Button
            variant="success"
            disabled={acting || !data?.applyAllowed || !data?.readyToLink}
            onClick={() =>
              run(
                "apply",
                `Link the ${fmtNumber(Math.min(applySize, data?.readyToLink || 0))} safest pairs?`,
                "Each pair is checked again before it is saved, and your login is recorded.",
                "Yes, link them",
              )
            }
          >
            {acting ? <Spinner animation="border" size="sm" /> : "Apply"}
          </Button>
        ) : (
          <Button
            variant="primary"
            disabled={acting || !data?.applyAllowed || !(data?.nameDiffers + data?.tooFar)}
            onClick={() =>
              run(
                "send-to-review",
                `Send up to ${fmtNumber(applySize)} pairs to Manual Review?`,
                "They are added to the supplier pair list for a person to decide. Nothing is linked.",
                "Yes, send them",
              )
            }
          >
            {acting ? <Spinner animation="border" size="sm" /> : "Send to Manual Review"}
          </Button>
        )}
      </div>

      <div className="ahm-panel">
        <div className="ahm-panel-head">
          <span>
            Hotel pairs {data ? <span className="text-muted fw-normal">({fmtNumber(data.items?.totalElements)})</span> : null}
          </span>
          {loading && <Spinner animation="border" size="sm" role="status" aria-label="Loading" />}
        </div>
        <Table responsive hover className="ahm-table mb-0">
          <thead>
            <tr>
              <th>GRN hotel</th>
              <th>GoGlobal hotel</th>
              <th>City</th>
              <th className="text-end">Distance</th>
              <th className="text-end">Name words shared</th>
              <th>GIATA code</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={`${p.grnHotelId}-${p.goGlobalHotelId}`}>
                <td>
                  <div className="ahm-hotel-name">{p.grnName}</div>
                  <div className="ahm-hotel-id">
                    ID {p.grnHotelId}
                    {p.grnMaster ? ` · master #${p.grnMaster}` : ""}
                  </div>
                </td>
                <td>
                  <div className="ahm-hotel-name">{p.goGlobalName}</div>
                  <div className="ahm-hotel-id">
                    ID {p.goGlobalHotelId}
                    {p.goGlobalMaster ? ` · master #${p.goGlobalMaster}` : ""}
                  </div>
                </td>
                <td className="small">{[p.city, p.country].filter(Boolean).join(", ")}</td>
                <td className="text-end">{fmtDistance(p.distanceMeters)}</td>
                <td className="text-end">{fmtPercent(p.wordOverlap * 100)}</td>
                <td className="small">{p.giataCode}</td>
              </tr>
            ))}
            {!loading && data && items.length === 0 && (
              <tr>
                <td colSpan={6} className="ahm-empty">
                  {debounced ? "No pair matches this search." : "Nothing is in this list."}
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
              totalElements={data.items?.totalElements || 0}
              totalPages={data.items?.totalPages || 1}
              onPageChange={setPage}
              onSizeChange={(n) => {
                setSize(n);
                setPage(0);
              }}
              disabled={loading}
            />
          </div>
        )}
      </div>

      {data?.conflicts?.length > 0 && (
        <div className="ahm-panel">
          <div className="ahm-panel-head">
            <span>Worth checking: existing masters holding GRN hotels with different GIATA codes</span>
          </div>
          <Table responsive className="ahm-table mb-0">
            <thead>
              <tr>
                <th>Master</th>
                <th>Name</th>
                <th className="text-end">GRN hotels</th>
                <th className="text-end">GIATA codes</th>
              </tr>
            </thead>
            <tbody>
              {data.conflicts.map((c) => (
                <tr key={c.masterHotelId}>
                  <td>#{c.masterHotelId}</td>
                  <td>{c.masterName}</td>
                  <td className="text-end">{fmtNumber(c.grnRows)}</td>
                  <td className="text-end">{fmtNumber(c.giataCodes)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  );
}
