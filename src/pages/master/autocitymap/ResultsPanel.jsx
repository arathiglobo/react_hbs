import React, { useEffect, useState } from "react";
import { Alert, Button, Spinner, Table } from "react-bootstrap";
import { fmtDate, fmtNumber, providerLabel, useDebounced, usePagedList } from "./acmShared";
import { FilterBar, Pager, SortTh, StatusTag } from "./AcmParts";

/**
 * Paged list of city_auto_mapping_result rows (review queue, duplicates and
 * conflicts, rejected / removed, automatic mappings). Filtering, sorting and
 * paging happen on the server.
 */
export default function ResultsPanel({
  active, reloadKey, statuses, statusOptions, providers, onOpen, hint, emptyText,
  defaultSort = "hotels", actionLabel = "Review", showReason = true,
}) {
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 350);
  const [provider, setProvider] = useState("");
  const [country, setCountry] = useState(null);
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState(statusOptions ? statusOptions[0][0] : statuses);
  const [sort, setSort] = useState(defaultSort);
  const [dir, setDir] = useState("desc");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);

  useEffect(() => setPage(0), [dq, provider, country, reason, status, size]);

  const { page: data, loading, error } = usePagedList(
    "/results",
    { status, provider, countryId: country?.value, reason, q: dq, sort, dir, page, size },
    active,
    reloadKey,
  );

  const onSort = (field, d) => {
    setSort(field);
    setDir(d);
  };

  return (
    <div>
      {hint && <p className="acm-hint">{hint}</p>}
      <FilterBar q={q} onQ={setQ} provider={provider} onProvider={setProvider} providers={providers}
        country={country} onCountry={setCountry}
        reason={showReason ? reason : undefined} onReason={showReason ? setReason : undefined}
        status={status} onStatus={statusOptions ? setStatus : undefined} statusOptions={statusOptions}>
        {loading && <Spinner animation="border" size="sm" className="ms-1" />}
      </FilterBar>
      {error && <Alert variant="danger" className="small py-2">{error}</Alert>}
      <div className="acm-table-wrap">
        <Table hover size="sm" className="acm-table mb-0">
          <thead>
            <tr>
              <SortTh label="Inhouse city" field="city" sort={sort} dir={dir} onSort={onSort} />
              <SortTh label="Country" field="country" sort={sort} dir={dir} onSort={onSort} />
              <SortTh label="Supplier" field="provider" sort={sort} dir={dir} onSort={onSort} />
              <SortTh label="Status / reason" field="reason" sort={sort} dir={dir} onSort={onSort} />
              <th>Supplier city</th>
              <SortTh label="Hotels" field="hotels" sort={sort} dir={dir} onSort={onSort} className="text-end" />
              <SortTh label="Score" field="score" sort={sort} dir={dir} onSort={onSort} className="text-end" />
              <SortTh label="Updated" field="updated" sort={sort} dir={dir} onSort={onSort} />
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data && data.content.length === 0 && (
              <tr><td colSpan={9} className="acm-empty">{emptyText || "Nothing here."}</td></tr>
            )}
            {(data?.content || []).map((r) => (
              <tr key={r.id}>
                <td>
                  <div className="fw-semibold">{r.cityName}</div>
                  <div className="acm-muted small">#{r.cityId}</div>
                </td>
                <td>{r.countryIso}</td>
                <td><span className="acm-supplier">{providerLabel(r.provider)}</span></td>
                <td className="acm-reason">
                  <StatusTag status={r.status} />
                  <div className="small mt-1">{r.reasonText}</div>
                </td>
                <td>
                  {r.supplierCityName ? (
                    <>
                      <div>{r.supplierCityName}</div>
                      <div className="acm-muted small">
                        #{r.supplierCityId}
                        {r.supplierCityCode ? ` · ${r.supplierCityCode}` : ""}
                        {r.candidates && r.candidates.length > 1 ? ` · +${r.candidates.length - 1} more` : ""}
                      </div>
                    </>
                  ) : (
                    <span className="acm-muted">—</span>
                  )}
                </td>
                <td className="text-end">{r.supplierHotels !== null && r.supplierHotels !== undefined ? fmtNumber(r.supplierHotels) : "—"}</td>
                <td className="text-end">{r.score ?? "—"}</td>
                <td className="small acm-muted">{fmtDate(r.updatedAt)}</td>
                <td className="text-end">
                  <Button size="sm" variant="outline-primary" onClick={() => onOpen(r)}>{actionLabel}</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
      <Pager data={data} page={page} size={size} onPage={setPage} onSize={setSize} disabled={loading} />
    </div>
  );
}
