import React, { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, Col, Form, Modal, Pagination, Row, Spinner, Table } from "react-bootstrap";
import { toast } from "react-hot-toast";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import BackButton from "../../components/BackButton";
import axiosInstance from "../../components/AxiosInstance";
import { API, formatBytes, openFileInNewTab, outcomeVariant } from "./supplierSearchLogShared";

/*
 * Report → Supplier Search Logs (admin).
 *
 * Every hotel search keeps one file per supplier on the server, named
 * <agent>-<date>-<time>-<supplier>.log: the search details, the hotels the
 * supplier returned and every reply the supplier sent (XML / JSON exactly as
 * received). Files are deleted after 2 days.
 *
 * This page lists the searches, one row per user search (filter by agent
 * name, supplier and day). "View" opens the search's providers; choosing a
 * provider opens its file in a new tab (SupplierSearchLogFile.jsx).
 */

const PAGE_SIZES = [25, 50, 100];

const initialFilters = () => ({ agent: "", supplier: "", date: "" });

const localDate = (d) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const openProvider = (fileName) => {
  if (!openFileInNewTab(fileName)) {
    toast.error("The browser blocked the new tab. Please allow pop-ups for this site.");
  }
};

/** "2026-12-20 → 2026-12-22" when there are dates. */
const stayDates = (checkIn, checkOut) => (checkIn || checkOut ? `${checkIn || "?"} → ${checkOut || "?"}` : "");

// ── The providers of one search ────────────────────────────────────────────

const SearchProvidersModal = ({ search, onClose }) => {
  const details = [
    ["Agent", search.agent],
    ["Searched by", search.searchedBy],
    ["Searched at", search.searchedAt],
    ["City", search.city],
    ["Stay", stayDates(search.checkIn, search.checkOut)],
    ["Guests", search.guests],
    ["Search id", search.searchId],
  ].filter(([, value]) => value);

  return (
    <Modal show onHide={onClose} size="lg" centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title as="h6" className="mb-0">
          Search by {search.agent || "unknown agent"}
          <div className="small text-muted fw-normal mt-1">{search.searchedAt}</div>
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Table size="sm" borderless className="mb-3 small">
          <tbody>
            {details.map(([label, value]) => (
              <tr key={label}>
                <th className="text-nowrap text-muted fw-normal ps-0" style={{ width: 120 }}>{label}</th>
                <td className="text-break">{value}</td>
              </tr>
            ))}
          </tbody>
        </Table>

        <div className="fw-semibold mb-2">Providers ({search.files.length})</div>
        <Table size="sm" responsive hover className="mb-2 align-middle">
          <thead>
            <tr>
              <th>Provider</th>
              <th>Outcome</th>
              <th className="text-end">Hotels</th>
              <th className="text-end">Replies</th>
              <th className="text-end">Size</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {search.files.map((f) => (
              <tr
                key={f.fileName}
                role="button"
                title={`Open ${f.supplier} in a new tab`}
                onClick={() => openProvider(f.fileName)}
              >
                <td className="fw-semibold">{f.supplier}</td>
                <td>{f.outcome ? <Badge bg={outcomeVariant(f.outcome)}>{f.outcome}</Badge> : "—"}</td>
                <td className="text-end">{f.hotels ?? "—"}</td>
                <td className="text-end">{f.replies ?? "—"}</td>
                <td className="text-end text-nowrap">{formatBytes(f.sizeBytes)}</td>
                <td className="text-end text-nowrap">
                  <Button
                    size="sm"
                    variant="outline-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      openProvider(f.fileName);
                    }}
                  >
                    Open ↗
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
        <small className="text-muted">Choose a provider to open its hotels and supplier replies in a new tab.</small>
      </Modal.Body>
    </Modal>
  );
};

// ── The list ───────────────────────────────────────────────────────────────

const SupplierSearchLogs = () => {
  const [tempFilters, setTempFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [suppliers, setSuppliers] = useState([]);
  const [info, setInfo] = useState({ retentionHours: 48, enabled: true, folderReady: true });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openSearch, setOpenSearch] = useState(null);

  const today = new Date();
  const oldestDay = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);

  const updateFilter = (key, value) => setTempFilters((prev) => ({ ...prev, [key]: value }));

  const fetchSearches = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page: page - 1, size: pageSize };
      Object.entries(appliedFilters).forEach(([k, v]) => {
        if (v !== "" && v !== null && v !== undefined) params[k] = typeof v === "string" ? v.trim() : v;
      });
      const res = await axiosInstance.get(API, { params });
      const data = res.data || {};
      setRows(Array.isArray(data.searches) ? data.searches : []);
      setTotal(Number(data.total) || 0);
      setSuppliers(Array.isArray(data.suppliers) ? data.suppliers : []);
      setInfo({
        retentionHours: Number(data.retentionHours) || 48,
        enabled: data.enabled !== false,
        folderReady: data.folderReady !== false,
      });
    } catch (e) {
      setError(e.response?.data?.error || "Failed to load the supplier search logs");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, page, pageSize]);

  useEffect(() => {
    fetchSearches();
  }, [fetchSearches]);

  const handleSearch = () => {
    setPage(1);
    setAppliedFilters({ ...tempFilters });
  };

  const handleReset = () => {
    const fresh = initialFilters();
    setTempFilters(fresh);
    setPage(1);
    setAppliedFilters(fresh);
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const firstRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, total);
  const keptFor = info.retentionHours % 24 === 0
    ? `${info.retentionHours / 24} day${info.retentionHours === 24 ? "" : "s"}`
    : `${info.retentionHours} hours`;

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4" style={{ minWidth: 0 }}>
          <Card className="shadow-sm rounded-xl">
            <Card.Header className="d-flex flex-column flex-sm-row gap-2 justify-content-between align-items-stretch align-items-sm-center">
              <span className="d-flex align-items-center gap-2">
                <BackButton fallback="/adminDashboard" />
                <span className="fw-semibold">Supplier Search Logs</span>
              </span>
              <div className="d-flex flex-wrap gap-2 align-items-center">
                <small className="text-muted">Every hotel search with each supplier's reply, kept for {keptFor}.</small>
                <Button className="btn-green" onClick={fetchSearches} disabled={loading}>
                  {loading ? "Refreshing..." : "↻ Refresh"}
                </Button>
              </div>
            </Card.Header>

            <Card.Body className="p-0">
              <div className="p-3 border-bottom">
                <Row className="g-3 align-items-end">
                  <Col md={4} lg={3}>
                    <Form.Group className="mb-0">
                      <Form.Label className="small mb-2">Agent name</Form.Label>
                      <Form.Control
                        size="sm"
                        placeholder="Type part of the agent name"
                        value={tempFilters.agent}
                        onChange={(e) => updateFilter("agent", e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4} lg={3}>
                    <Form.Group className="mb-0">
                      <Form.Label className="small mb-2">Supplier</Form.Label>
                      <Form.Select size="sm" value={tempFilters.supplier} onChange={(e) => updateFilter("supplier", e.target.value)}>
                        <option value="">All suppliers</option>
                        {suppliers.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={4} lg={2}>
                    <Form.Group className="mb-0">
                      <Form.Label className="small mb-2">Day</Form.Label>
                      <Form.Control
                        type="date"
                        size="sm"
                        value={tempFilters.date}
                        min={localDate(oldestDay)}
                        max={localDate(today)}
                        onChange={(e) => updateFilter("date", e.target.value)}
                      />
                    </Form.Group>
                  </Col>
                  <Col md="auto" className="d-flex gap-2">
                    <Button size="sm" variant="primary" onClick={handleSearch} disabled={loading}>
                      Search
                    </Button>
                    <Button size="sm" variant="outline-secondary" onClick={handleReset} disabled={loading}>
                      Reset
                    </Button>
                  </Col>
                </Row>
              </div>

              {!info.enabled && (
                <div className="alert alert-warning py-2 m-3 mb-0">
                  Saving new search logs is switched off on the server (hbs.search-response-log.enabled).
                </div>
              )}
              {!info.folderReady && (
                <div className="alert alert-warning py-2 m-3 mb-0">
                  The server cannot write its search log folder, so no files are being kept. Please check the server log.
                </div>
              )}
              {error && (
                <div className="alert alert-danger py-2 m-3 mb-0" role="alert">
                  {error}
                </div>
              )}

              <Table responsive hover striped className="mb-0 align-middle mt-2">
                <thead>
                  <tr>
                    <th style={{ width: 60 }} className="text-center">S/N</th>
                    <th>Searched at</th>
                    <th>Agent</th>
                    <th>Search</th>
                    <th>Suppliers</th>
                    <th className="text-end" title="Hotels returned, added up over the suppliers">Hotel results</th>
                    <th className="text-end">Size</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="text-center text-muted py-4">
                        <Spinner animation="border" size="sm" className="me-2" />
                        Loading searches...
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center text-muted py-4">
                        No searches found for the selected filters.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, idx) => (
                      <tr key={row.key}>
                        <td className="text-center">{firstRow + idx}</td>
                        <td className="text-nowrap">{row.searchedAt}</td>
                        <td>
                          <div>{row.agent}</div>
                          {row.searchedBy && <small className="text-muted">by {row.searchedBy}</small>}
                        </td>
                        <td className="small">
                          {row.city && <div>{row.city}</div>}
                          {stayDates(row.checkIn, row.checkOut) && (
                            <div className="text-muted text-nowrap">{stayDates(row.checkIn, row.checkOut)}</div>
                          )}
                          {row.guests && <div className="text-muted">{row.guests}</div>}
                        </td>
                        <td style={{ maxWidth: 320 }}>
                          {(row.files || []).map((f) => (
                            <Badge
                              key={f.fileName}
                              bg={outcomeVariant(f.outcome)}
                              className="me-1 mb-1 fw-normal"
                              title={`${f.supplier}: ${f.outcome || "no outcome"}, ${f.hotels ?? 0} hotels`}
                            >
                              {f.supplier}
                            </Badge>
                          ))}
                        </td>
                        <td className="text-end">{row.hotelResults ?? "—"}</td>
                        <td className="text-end text-nowrap">{formatBytes(row.sizeBytes)}</td>
                        <td className="text-nowrap">
                          <Button size="sm" variant="outline-primary" onClick={() => setOpenSearch(row)}>
                            View
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>

              <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center p-3 border-top">
                <small className="text-muted">
                  {total === 0 ? "No searches" : `Showing ${firstRow}–${lastRow} of ${total} searches`}
                </small>
                <div className="d-flex gap-2 align-items-center">
                  <Form.Select
                    size="sm"
                    style={{ width: "auto" }}
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                  >
                    {PAGE_SIZES.map((s) => (
                      <option key={s} value={s}>{s} / page</option>
                    ))}
                  </Form.Select>
                  <Pagination size="sm" className="mb-0">
                    <Pagination.Prev disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))} />
                    <Pagination.Item active>{page} / {totalPages}</Pagination.Item>
                    <Pagination.Next disabled={page >= totalPages || loading} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} />
                  </Pagination>
                </div>
              </div>
            </Card.Body>
          </Card>
        </main>
      </div>
      {openSearch && <SearchProvidersModal search={openSearch} onClose={() => setOpenSearch(null)} />}
    </div>
  );
};

export default SupplierSearchLogs;
