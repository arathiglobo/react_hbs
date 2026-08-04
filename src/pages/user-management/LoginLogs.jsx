import React, { useEffect, useMemo, useState } from "react";
import { Card, Form, Table, Spinner } from "react-bootstrap";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import BackButton from "../../components/BackButton";

// Formatter for the audit table: "2026-Jul-29 - 09:55:21 AM" matches the
// reference screenshot. Null (open sessions) render as "0000:00:00" so an
// unclosed session is visually distinct from a closed one.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n) => String(n).padStart(2, "0");
const formatAudit = (iso) => {
  if (!iso) return "0000:00:00";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  let hh = d.getHours();
  const ampm = hh >= 12 ? "PM" : "AM";
  hh = hh % 12 || 12;
  return `${d.getFullYear()}-${MONTHS[d.getMonth()]}-${pad(d.getDate())} - ${pad(hh)}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${ampm}`;
};

// Sort-state: which column + ascending/descending. Nulls sort to the bottom
// regardless of direction so "still logged in" rows don't jump around
// when the admin flips the arrow.
const compareValues = (a, b, dir) => {
  const aNull = a === null || a === undefined || a === "";
  const bNull = b === null || b === undefined || b === "";
  if (aNull && bNull) return 0;
  if (aNull) return 1;
  if (bNull) return -1;
  if (a === b) return 0;
  return (a < b ? -1 : 1) * (dir === "asc" ? 1 : -1);
};

export default function LoginLogs() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState("loginDateTime");
  const [sortDir, setSortDir] = useState("desc");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await axiosInstance.get("/api/super-admin/login-audit");
        if (!cancelled) setRows(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        if (!cancelled) {
          setError(e.response?.data?.message || "Failed to load login logs");
          toast.error("Failed to load login logs");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = (searchTerm || "").trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.name, r.userName, r.userType].some((v) => (v || "").toString().toLowerCase().includes(q))
    );
  }, [rows, searchTerm]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => compareValues(a[sortKey], b[sortKey], sortDir));
    return copy;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortHeader = ({ label, k }) => (
    <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort(k)}>
      {label}
      <span className="ms-2 text-muted" style={{ fontSize: "0.75rem" }}>
        {sortKey === k ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
      </span>
    </th>
  );

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4" style={{ overflow: "auto" }}>
          <div className="d-flex align-items-center mb-3">
            <BackButton />
            <h4 className="mb-0 ms-3" style={{ color: "#2b2b73", fontWeight: 700 }}>Logs</h4>
          </div>

          <Card className="shadow-sm">
            <Card.Header
              className="text-white fw-semibold"
              style={{ background: "#2b2b73", fontSize: "1rem" }}
            >
              List of Logins
            </Card.Header>
            <Card.Body>
              {/* Toolbar — records-per-page + search, same shape as the
                  reference screenshot. */}
              <div className="d-flex justify-content-between align-items-center flex-wrap mb-3 gap-2">
                <div className="d-flex align-items-center">
                  <span className="me-2">Display</span>
                  <Form.Select
                    size="sm"
                    style={{ width: 80 }}
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                  >
                    {[10, 25, 50, 100].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </Form.Select>
                  <span className="ms-2">records</span>
                </div>
                <div className="d-flex align-items-center">
                  <span className="me-2">Search:</span>
                  <Form.Control
                    size="sm"
                    style={{ width: 240 }}
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
              </div>

              {error && (
                <div className="alert alert-danger py-2 mb-3" role="alert">{error}</div>
              )}

              <div className="table-responsive">
                <Table bordered hover size="sm" className="mb-0 align-middle">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: 60 }} className="text-center">S.N</th>
                      <SortHeader label="Name" k="name" />
                      <SortHeader label="User Name" k="userName" />
                      <SortHeader label="UserType" k="userType" />
                      <SortHeader label="Login" k="loginDateTime" />
                      <SortHeader label="Logout" k="logoutDateTime" />
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="text-center py-4">
                          <Spinner animation="border" size="sm" /> Loading…
                        </td>
                      </tr>
                    ) : pageRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center text-muted py-4">
                          No login records
                        </td>
                      </tr>
                    ) : (
                      pageRows.map((row, idx) => (
                        <tr key={row.id}>
                          <td className="text-center">
                            {(currentPage - 1) * pageSize + idx + 1}
                          </td>
                          <td>{row.name || "—"}</td>
                          <td>{row.userName || "—"}</td>
                          <td>{row.userType || ""}</td>
                          <td>{formatAudit(row.loginDateTime)}</td>
                          <td>{formatAudit(row.logoutDateTime)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </Table>
              </div>

              {/* Pager — plain prev/next; the record-count dropdown above
                  handles chunking. Kept minimal to match the reference. */}
              <div className="d-flex justify-content-between align-items-center mt-3 small">
                <span className="text-muted">
                  Showing {sorted.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                  {" "}to {Math.min(currentPage * pageSize, sorted.length)} of {sorted.length}
                </span>
                <div className="d-flex align-items-center gap-2">
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    disabled={currentPage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </button>
                  <span>Page {currentPage} / {totalPages}</span>
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>
            </Card.Body>
          </Card>
        </main>
      </div>
    </div>
  );
}
