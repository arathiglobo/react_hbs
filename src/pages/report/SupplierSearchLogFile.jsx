import React, { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, Form, Modal, Spinner, Tab, Table, Tabs } from "react-bootstrap";
import { toast } from "react-hot-toast";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import BackButton from "../../components/BackButton";
import axiosInstance from "../../components/AxiosInstance";
import {
  DOWNLOAD_TIMEOUT_MS,
  HEADER_ORDER,
  LIST_ROUTE,
  fileNameFrom,
  fileRoute,
  fileUrl,
  flagVariant,
  formatBytes,
  outcomeVariant,
  prettyText,
  saveBlob,
} from "./supplierSearchLogShared";

/*
 * Report → Supplier Search Logs → one provider's file (opened in a new tab
 * from the list's providers window). Route: /report/supplier-search-logs/file?name=<file name>.
 *
 * Shows the search details, the hotels the supplier returned and every reply
 * the supplier sent; each reply can be viewed (pretty printed) or downloaded.
 */

/** How much of a reply is loaded for viewing; the download always has all of it. */
const VIEW_BYTES = 1_000_000;
/** Hotel rows drawn at once in the Hotels tab. */
const HOTEL_ROWS_SHOWN = 500;

// ── One reply ──────────────────────────────────────────────────────────────

const ReplyViewer = ({ fileName, reply, onClose }) => {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pretty, setPretty] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    axiosInstance
      .get(`${fileUrl(fileName)}/replies/${reply.n}`, {
        params: { maxBytes: VIEW_BYTES },
        responseType: "text",
        transformResponse: [(d) => d],
        timeout: DOWNLOAD_TIMEOUT_MS,
      })
      .then((res) => {
        if (!cancelled) setText(typeof res.data === "string" ? res.data : String(res.data ?? ""));
      })
      .catch(() => {
        if (!cancelled) setError("Could not load this reply.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fileName, reply.n]);

  const cut = Number(reply.bytes) > VIEW_BYTES;
  const formatted = useMemo(() => (pretty && !cut ? prettyText(text) : null), [pretty, cut, text]);

  const download = async () => {
    setDownloading(true);
    try {
      const res = await axiosInstance.get(`${fileUrl(fileName)}/replies/${reply.n}`, {
        params: { download: true },
        responseType: "blob",
        timeout: DOWNLOAD_TIMEOUT_MS,
      });
      saveBlob(res.data, fileNameFrom(res.headers?.["content-disposition"], `reply-${reply.n}.txt`));
    } catch (e) {
      toast.error("Could not download the reply. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(formatted || text);
      toast.success("Copied");
    } catch (e) {
      toast.error("Copy is not available in this browser");
    }
  };

  return (
    <Modal show onHide={onClose} size="xl" centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title as="h6" className="mb-0">
          Reply {reply.n} · HTTP {reply.status} · {reply.elapsedMs >= 0 ? `${reply.elapsedMs} ms` : "time unknown"} ·{" "}
          {formatBytes(reply.bytes)}
          <div className="small text-muted text-break fw-normal mt-1">
            {reply.method} {reply.url}
          </div>
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
          <Badge bg={flagVariant(reply.flag)}>{reply.flag}</Badge>
          <small className="text-muted">Received {reply.at}</small>
          <Form.Check
            type="switch"
            id="reply-pretty"
            className="ms-auto small"
            label="Pretty print"
            checked={pretty}
            disabled={cut}
            onChange={(e) => setPretty(e.target.checked)}
          />
          <Button size="sm" variant="outline-secondary" onClick={copy} disabled={loading || !text}>
            Copy
          </Button>
          <Button size="sm" variant="outline-primary" onClick={download} disabled={downloading}>
            {downloading ? "Downloading..." : "⬇ Download reply"}
          </Button>
        </div>
        {cut && (
          <div className="alert alert-info py-2 small">
            Showing the first {formatBytes(VIEW_BYTES)} of {formatBytes(reply.bytes)}. Download the reply to see all of it.
          </div>
        )}
        {loading ? (
          <div className="text-center text-muted py-4">
            <Spinner animation="border" size="sm" className="me-2" />
            Loading reply...
          </div>
        ) : error ? (
          <div className="alert alert-danger py-2">{error}</div>
        ) : !text ? (
          <div className="text-muted">This reply has no body.</div>
        ) : (
          <pre className="bg-light border rounded p-2 small mb-0" style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            {formatted || text}
          </pre>
        )}
      </Modal.Body>
    </Modal>
  );
};

// ── The file ───────────────────────────────────────────────────────────────

const SupplierSearchLogFile = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const fileName = params.get("name") || "";

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(Boolean(fileName));
  const [error, setError] = useState("");
  const [hotelFilter, setHotelFilter] = useState("");
  const [reply, setReply] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!fileName) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    setDetail(null);
    setHotelFilter("");
    setReply(null);
    axiosInstance
      .get(fileUrl(fileName), { timeout: DOWNLOAD_TIMEOUT_MS })
      .then((res) => {
        if (!cancelled) setDetail(res.data || null);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.response?.status === 404
            ? "This file is no longer there (files are kept for 2 days)."
            : "Could not open this file.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fileName]);

  const header = useMemo(() => detail?.header || {}, [detail]);
  const supplier = header.Supplier || "";

  // Several providers are often open side by side: name the tab after this one.
  useEffect(() => {
    const before = document.title;
    if (supplier) {
      document.title = `${supplier} · ${header.Agent || "Search"} · Supplier Search Log`;
    }
    return () => {
      document.title = before;
    };
  }, [supplier, header.Agent]);

  const hotels = useMemo(() => {
    const all = detail?.hotels || [];
    const q = hotelFilter.trim().toLowerCase();
    return q
      ? all.filter((h) => (h.name || "").toLowerCase().includes(q) || (h.code || "").toLowerCase().includes(q))
      : all;
  }, [detail, hotelFilter]);

  const headerRows = [
    ...HEADER_ORDER.filter((k) => header[k] !== undefined && header[k] !== ""),
    ...Object.keys(header).filter((k) => !HEADER_ORDER.includes(k) && header[k] !== ""),
  ];

  const downloadFile = async () => {
    setDownloading(true);
    try {
      const res = await axiosInstance.get(`${fileUrl(fileName)}/download`, {
        responseType: "blob",
        timeout: DOWNLOAD_TIMEOUT_MS,
      });
      saveBlob(res.data, fileNameFrom(res.headers?.["content-disposition"], fileName));
    } catch (e) {
      toast.error("Could not download the file. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const summary = [
    ["Agent", header.Agent],
    ["Searched at", header["Searched at"]],
    ["City", header.City],
    ["Stay", header["Check-in"] || header["Check-out"] ? `${header["Check-in"] || "?"} → ${header["Check-out"] || "?"}` : ""],
    ["Guests", header.Guests],
  ].filter(([, value]) => value);

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4" style={{ minWidth: 0 }}>
          <Card className="shadow-sm rounded-xl">
            <Card.Header className="d-flex flex-column flex-sm-row gap-2 justify-content-between align-items-stretch align-items-sm-center">
              <span className="d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
                <BackButton fallback={LIST_ROUTE} />
                <span style={{ minWidth: 0 }}>
                  <span className="fw-semibold">{supplier ? `${supplier} – Supplier Search Log` : "Supplier Search Log"}</span>
                  {fileName && <div className="small text-muted text-break">{fileName}</div>}
                </span>
              </span>
              {detail && (
                <div className="d-flex flex-wrap gap-2 align-items-center">
                  {header.Outcome && <Badge bg={outcomeVariant(header.Outcome)}>{header.Outcome}</Badge>}
                  <small className="text-muted">{formatBytes(detail.sizeBytes)}</small>
                  <Button size="sm" variant="outline-primary" onClick={downloadFile} disabled={downloading}>
                    {downloading ? "Downloading..." : "⬇ Download whole file"}
                  </Button>
                </div>
              )}
            </Card.Header>

            <Card.Body>
              {!fileName ? (
                <div className="text-muted">
                  No file was chosen. <Link to={LIST_ROUTE}>Back to Supplier Search Logs</Link>
                </div>
              ) : loading ? (
                <div className="text-center text-muted py-4">
                  <Spinner animation="border" size="sm" className="me-2" />
                  Opening file...
                </div>
              ) : error ? (
                <div className="alert alert-danger py-2 mb-0">
                  {error} <Link to={LIST_ROUTE}>Back to Supplier Search Logs</Link>
                </div>
              ) : detail ? (
                <>
                  {summary.length > 0 && (
                    <div className="d-flex flex-wrap gap-4 small mb-3">
                      {summary.map(([label, value]) => (
                        <div key={label}>
                          <div className="text-muted">{label}</div>
                          <div className="fw-semibold">{value}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {detail.sameSearch?.length > 0 && (
                    <div className="mb-3 small">
                      <span className="text-muted me-2">Other providers in this search:</span>
                      {detail.sameSearch.map((f) => (
                        <Button
                          key={f.fileName}
                          size="sm"
                          variant="outline-secondary"
                          className="me-1 mb-1 py-0"
                          onClick={() => navigate(fileRoute(f.fileName))}
                          title={f.fileName}
                        >
                          {f.supplier}
                          {f.hotels ? ` (${f.hotels})` : ""}
                        </Button>
                      ))}
                    </div>
                  )}

                  <Tabs defaultActiveKey="hotels" id="search-log-tabs" className="mb-3" mountOnEnter>
                    <Tab eventKey="hotels" title={`Hotels (${detail.hotelsTotal ?? hotels.length})`}>
                      <Form.Control
                        size="sm"
                        className="mb-2"
                        placeholder="Filter by hotel name or code"
                        value={hotelFilter}
                        onChange={(e) => setHotelFilter(e.target.value)}
                      />
                      {detail.hotelsTotal > (detail.hotels?.length || 0) && (
                        <div className="small text-muted mb-2">
                          The first {detail.hotels.length} of {detail.hotelsTotal} hotels are listed here; the downloaded
                          file has all of them.
                        </div>
                      )}
                      <Table size="sm" responsive striped hover className="mb-0 align-middle">
                        <thead>
                          <tr>
                            <th style={{ width: 60 }}>#</th>
                            <th>Hotel name</th>
                            <th>Hotel code</th>
                            <th>Stars</th>
                            <th className="text-end">Price (AED)</th>
                            <th>City</th>
                          </tr>
                        </thead>
                        <tbody>
                          {hotels.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="text-center text-muted py-3">
                                {detail.hotels?.length ? "No hotel matches the filter." : "The supplier returned no hotels."}
                              </td>
                            </tr>
                          ) : (
                            hotels.slice(0, HOTEL_ROWS_SHOWN).map((h) => (
                              <tr key={`${h.n}-${h.code}`}>
                                <td>{h.n}</td>
                                <td>{h.name || "—"}</td>
                                <td className="text-break">{h.code}</td>
                                <td>{h.stars}</td>
                                <td className="text-end">{h.price}</td>
                                <td>{h.city}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </Table>
                      {hotels.length > HOTEL_ROWS_SHOWN && (
                        <div className="small text-muted mt-2">
                          Showing {HOTEL_ROWS_SHOWN} of {hotels.length}. Type in the filter to narrow the list.
                        </div>
                      )}
                    </Tab>

                    <Tab eventKey="replies" title={`Supplier replies (${detail.replies?.length || 0})`}>
                      {detail.replies?.length ? (
                        <Table size="sm" responsive striped hover className="mb-0 align-middle">
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Received</th>
                              <th>HTTP</th>
                              <th className="text-end">Time</th>
                              <th className="text-end">Size</th>
                              <th>Status</th>
                              <th>Address</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {detail.replies.map((r) => (
                              <tr key={r.n}>
                                <td>{r.n}</td>
                                <td className="text-nowrap">{r.at}</td>
                                <td>{r.status}</td>
                                <td className="text-end text-nowrap">{r.elapsedMs >= 0 ? `${(r.elapsedMs / 1000).toFixed(1)} s` : "—"}</td>
                                <td className="text-end text-nowrap">{formatBytes(r.bytes)}</td>
                                <td><Badge bg={flagVariant(r.flag)}>{r.flag}</Badge></td>
                                <td className="small text-break" style={{ maxWidth: 420 }}>
                                  {r.method} {r.url}
                                </td>
                                <td className="text-nowrap">
                                  <Button size="sm" variant="outline-primary" onClick={() => setReply(r)} disabled={!r.bytes}>
                                    View
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      ) : (
                        <div className="text-muted">{header.Note || "No supplier reply is in this file."}</div>
                      )}
                    </Tab>

                    <Tab eventKey="details" title="Search details">
                      <Table size="sm" bordered className="mb-0">
                        <tbody>
                          {headerRows.map((k) => (
                            <tr key={k}>
                              <th className="text-nowrap" style={{ width: 180 }}>{k}</th>
                              <td className="text-break">{header[k]}</td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </Tab>
                  </Tabs>
                </>
              ) : null}
            </Card.Body>
          </Card>
        </main>
      </div>
      {reply && <ReplyViewer fileName={fileName} reply={reply} onClose={() => setReply(null)} />}
    </div>
  );
};

export default SupplierSearchLogFile;
