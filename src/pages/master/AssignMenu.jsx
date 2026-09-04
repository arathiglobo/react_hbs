import React, { useCallback, useEffect, useState } from "react";
import { Card, Row, Col, Form, Button, Spinner, Badge } from "react-bootstrap";
import { toast } from "react-hot-toast";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import BackButton from "../../components/BackButton";
import axiosInstance from "../../components/AxiosInstance";

/**
 * SUPER_ADMIN-only screen for controlling which sidebar entries each role
 * sees. Subtractive model: entries hidden here are removed from the
 * sidebar for that role, but the hardcoded role list in Sidebar.jsx is
 * still the upper bound of what any role CAN see.
 *
 * Backend:
 *   GET    /api/super-admin/menu-assignment/roles/{role}   → tree with is_visible
 *   PUT    /api/super-admin/menu-assignment/roles/{role}   → bulk upsert
 *   DELETE /api/super-admin/menu-assignment/roles/{role}   → reset to defaults
 *
 * Sidebar consumers read:
 *   GET    /api/sidebar/hidden-menus?role={role}           → Set<String>
 */
const BASE = "/api/super-admin/menu-assignment";

const ROLES = [
  { slug: "admin",               label: "Admin" },
  { slug: "agent",               label: "Agent" },
  { slug: "staff",               label: "Staff" },
  { slug: "extranet",            label: "Extranet (Hotel)" },
  { slug: "restaurant_extranet", label: "Restaurant Extranet" },
  { slug: "super_admin",         label: "Super Admin" },
];

export default function AssignMenu() {
  const [role, setRole] = useState("admin");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState({}); // {code: nextIsVisible}
  // Expanded parent codes — a Set so lookups are O(1) and swaps don't
  // rebuild every child row. Empty by default → every group renders
  // collapsed (parents only) until the user clicks one open.
  const [expanded, setExpanded] = useState(() => new Set());
  // Optional client-side search across labels/codes — filters what's
  // rendered without touching the underlying rows / dirty state.
  const [query, setQuery] = useState("");

  const fetchRows = useCallback(async (targetRole) => {
    setLoading(true);
    setDirty({});
    try {
      const res = await axiosInstance.get(`${BASE}/roles/${targetRole}`);
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      toast.error(
        e?.response?.data?.message ||
          "Failed to load menu list (super_admin only)",
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRows(role);
    // Collapse everything when the role changes — fresh context per role.
    setExpanded(new Set());
    setQuery("");
  }, [role, fetchRows]);

  const toggleExpand = (parentCode) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(parentCode)) next.delete(parentCode);
      else next.add(parentCode);
      return next;
    });
  };

  // Effective visibility for a row: dirty override wins, else DB value,
  // else "inherit" (treated as VISIBLE in the checkbox UI because the
  // hardcoded config would show it).
  const effectiveVisible = (row) => {
    if (Object.prototype.hasOwnProperty.call(dirty, row.code)) return dirty[row.code];
    if (row.isVisible === false) return false;
    return true;
  };

  const toggle = (row) => {
    const next = !effectiveVisible(row);
    setDirty((d) => ({ ...d, [row.code]: next }));
  };

  const save = async () => {
    const items = Object.entries(dirty).map(([code, isVisible]) => ({
      code,
      // true = write explicit-true row (audit crumb). false = the actual hide.
      // We never send null from this UI — reset uses the DELETE endpoint.
      isVisible,
    }));
    if (items.length === 0) return;
    setSaving(true);
    try {
      await axiosInstance.put(`${BASE}/roles/${role}`, { items });
      toast.success(`Saved ${items.length} change(s) for ${roleLabel(role)}`);
      await fetchRows(role);
    } catch (e) {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const resetRole = async () => {
    if (!window.confirm(`Reset ${roleLabel(role)} to default (delete all overrides)?`)) return;
    setSaving(true);
    try {
      const res = await axiosInstance.delete(`${BASE}/roles/${role}`);
      toast.success(`Reset — removed ${res?.data?.removed ?? 0} override(s)`);
      await fetchRows(role);
    } catch (e) {
      toast.error("Reset failed");
    } finally {
      setSaving(false);
    }
  };

  const dirtyCount = Object.keys(dirty).length;

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <style>{`
        .am-card { border: 1px solid #eef0f2; overflow: hidden; }
        .am-header {
          background: linear-gradient(180deg,#ffffff 0%,#f9fafb 100%);
          border-bottom: 1px solid #eef0f2; padding: 16px 20px;
        }
        .am-title { font-size: 16px; font-weight: 700; color: #0f172a; letter-spacing: -0.01em; }
        .am-sub   { font-size: 12px; color: #6b7280; margin-top: 3px; line-height: 1.5; }

        /* Role picker (left rail) */
        .am-role-rail { background: #fafbfc; }
        .am-role-rail-title {
          font-size: 11px; font-weight: 600; text-transform: uppercase;
          color: #9ca3af; letter-spacing: .06em; padding: 14px 16px 8px;
        }
        .am-role-item {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 16px; margin: 0; cursor: pointer;
          border-left: 3px solid transparent;
          font-size: 13.5px; color: #374151; user-select: none;
          transition: background .12s ease, border-color .12s ease;
        }
        .am-role-item:hover { background: #f3f4f6; }
        .am-role-item.on {
          background: #ffffff; color: #0f172a; font-weight: 600;
          border-left-color: #EC0B43;
        }
        .am-role-item input { display: none; }
        .am-role-count {
          margin-left: auto;
          font-size: 11px; font-weight: 500; color: #9ca3af;
          background: #f3f4f6; padding: 1px 8px; border-radius: 999px;
        }
        .am-role-item.on .am-role-count { background: #FDE7ED; color: #EC0B43; }

        /* Toolbar (search + count above tree) */
        .am-toolbar {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 16px; border-bottom: 1px solid #f1f3f5;
          background: #fbfcfd;
        }
        .am-search {
          flex: 1; position: relative;
        }
        .am-search input {
          width: 100%; padding: 7px 10px 7px 32px;
          border: 1px solid #e5e7eb; border-radius: 8px;
          background: #ffffff; font-size: 13px; color: #111827;
          transition: border-color .12s ease, box-shadow .12s ease;
        }
        .am-search input:focus {
          outline: none;
          border-color: #EC0B43;
          box-shadow: 0 0 0 3px rgba(236, 11, 67,0.10);
        }
        .am-search-icon {
          position: absolute; top: 50%; left: 10px; transform: translateY(-50%);
          color: #9ca3af; font-size: 14px; pointer-events: none;
        }
        .am-expand-all {
          font-size: 12px; font-weight: 500;
          color: #6b7280; background: transparent;
          border: 1px solid #e5e7eb; padding: 6px 10px; border-radius: 6px;
          cursor: pointer;
        }
        .am-expand-all:hover { border-color: #d1d5db; color: #111827; }

        /* Tree */
        .am-tree { padding: 10px 12px 14px; }
        .am-group {
          margin-bottom: 8px;
          border: 1px solid #eef0f2; border-radius: 10px; overflow: hidden;
          background: #ffffff;
          transition: box-shadow .15s ease, border-color .15s ease;
        }
        .am-group.open { box-shadow: 0 1px 3px rgba(15,23,42,.06); border-color: #e5e7eb; }
        .am-parent {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px; cursor: pointer;
          background: #fbfcfd; transition: background .12s ease;
        }
        .am-parent:hover { background: #f5f7fa; }
        .am-group.open .am-parent { background: #f6f8fa; border-bottom: 1px solid #eef0f2; }
        .am-caret {
          display: inline-flex; align-items: center; justify-content: center;
          width: 20px; height: 20px; border-radius: 6px;
          color: #6b7280; transition: transform .15s ease, background .12s ease;
          font-size: 10px;
        }
        .am-group.open .am-caret { transform: rotate(90deg); color: #EC0B43; background: #FDE7ED; }
        .am-parent-label { font-size: 14px; font-weight: 600; color: #0f172a; }
        .am-leaf-count {
          margin-left: 6px; font-size: 11px; font-weight: 500;
          color: #6b7280; background: #f3f4f6;
          padding: 1px 8px; border-radius: 999px;
        }
        .am-parent-check { margin-left: auto; }
        .am-parent .form-check { margin: 0; }
        .am-parent .form-check-input { margin-top: 0; cursor: pointer; }

        .am-leaves {
          padding: 6px 10px 10px 44px;
          animation: amFade .18s ease;
        }
        @keyframes amFade {
          from { opacity: 0; transform: translateY(-3px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .am-leaf {
          display: flex; align-items: center; gap: 10px;
          padding: 7px 10px; border-radius: 6px;
          font-size: 13px; color: #374151;
          transition: background .1s ease;
        }
        .am-leaf:hover { background: #f9fafb; }
        .am-leaf .form-check { margin: 0; }
        .am-leaf .form-check-input { margin-top: 0; cursor: pointer; }

        .am-code {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 10.5px; color: #6b7280;
          background: #f3f4f6; padding: 1px 6px; border-radius: 4px;
          margin-left: 8px;
        }
        .am-inherited { color: #9ca3af; font-size: 11px; margin-left: 6px; }
        .am-dirty-dot {
          display: inline-block; width: 6px; height: 6px; border-radius: 999px;
          background: #EC0B43; margin-left: 6px;
          box-shadow: 0 0 0 3px rgba(236, 11, 67,.15);
        }

        .am-empty {
          text-align: center; color: #9ca3af; padding: 40px 20px;
          font-size: 13px;
        }
        .am-empty svg { display: block; margin: 0 auto 10px; opacity: .5; }
      `}</style>
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Card className="am-card shadow-sm rounded-3">
            <div className="am-header d-flex align-items-center gap-2">
              <BackButton fallback="/superAdminDashboard" />
              <div className="flex-grow-1">
                <div className="am-title">Assign Menu</div>
                <div className="am-sub">
                  Hide sidebar entries per role. Subtractive only — you can't grant a role
                  more than the code allows. Reset returns a role to the default (inherit).
                </div>
              </div>
              <div className="d-flex align-items-center gap-2">
                {dirtyCount > 0 && (
                  <Badge bg="warning" text="dark">
                    {dirtyCount} unsaved
                  </Badge>
                )}
                <Button
                  size="sm"
                  variant="outline-danger"
                  onClick={resetRole}
                  disabled={saving || loading}
                >
                  Reset {roleLabel(role)}
                </Button>
                <Button
                  size="sm"
                  className="btn-green"
                  onClick={save}
                  disabled={saving || loading || dirtyCount === 0}
                >
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
            <Card.Body className="p-0">
              <Row className="g-0">
                <Col md={3} className="am-role-rail border-end p-0" style={{ minHeight: 500 }}>
                  <div className="am-role-rail-title">Select role</div>
                  {ROLES.map((r) => {
                    const isOn = role === r.slug;
                    // Count of visible top-level nodes for this role, from
                    // the currently loaded tree — non-zero only when a role
                    // is already loaded (i.e., the one the picker just chose).
                    const parentCount = isOn
                      ? rows.filter((x) => !x.parentCode).length
                      : null;
                    return (
                      <label
                        key={r.slug}
                        htmlFor={`role-${r.slug}`}
                        className={`am-role-item ${isOn ? "on" : ""}`}
                        title={`Show menu for ${r.label}`}
                      >
                        <input
                          type="radio"
                          id={`role-${r.slug}`}
                          name="am-role"
                          value={r.slug}
                          checked={isOn}
                          onChange={() => setRole(r.slug)}
                          disabled={saving || loading}
                        />
                        <span>{r.label}</span>
                        {parentCount !== null && (
                          <span className="am-role-count">{parentCount}</span>
                        )}
                      </label>
                    );
                  })}
                </Col>
                <Col md={9}>
                  {loading ? (
                    <div className="text-center text-muted py-5">
                      <Spinner animation="border" size="sm" className="me-2" />
                      Loading menu tree…
                    </div>
                  ) : rows.length === 0 ? (
                    <div className="am-empty">
                      No menu items registered yet.
                    </div>
                  ) : (() => {
                    // Group rows into { parent, leaves[] } tuples once per render.
                    const byParent = new Map();
                    rows.forEach((r) => {
                      const key = r.parentCode || "__root__";
                      if (!byParent.has(key)) byParent.set(key, []);
                      byParent.get(key).push(r);
                    });
                    const topLevel = byParent.get("__root__") || [];

                    const q = query.trim().toLowerCase();
                    const matches = (row) =>
                      !q ||
                      (row.label && row.label.toLowerCase().includes(q)) ||
                      (row.code && row.code.toLowerCase().includes(q));

                    // Visible groups after search: keep parent if it matches
                    // itself OR if at least one leaf matches. Also record
                    // which leaves matched so we render only those inside.
                    const groups = topLevel
                      .map((parent) => {
                        const leaves = byParent.get(parent.code) || [];
                        const parentHit = matches(parent);
                        const leafHits = leaves.filter(matches);
                        return {
                          parent,
                          leaves,
                          visibleLeaves: parentHit ? leaves : leafHits,
                          hasMatch: parentHit || leafHits.length > 0,
                        };
                      })
                      .filter((g) => g.hasMatch);

                    const allParents = topLevel.map((p) => p.code);
                    const allOpen = allParents.every((c) => expanded.has(c));
                    const toggleAll = () => {
                      if (allOpen) setExpanded(new Set());
                      else setExpanded(new Set(allParents));
                    };

                    return (
                      <>
                        <div className="am-toolbar">
                          <div className="am-search">
                            <span className="am-search-icon">🔍</span>
                            <input
                              type="text"
                              value={query}
                              onChange={(e) => setQuery(e.target.value)}
                              placeholder={`Search ${rows.length} menu items…`}
                              disabled={saving}
                            />
                          </div>
                          <button
                            type="button"
                            className="am-expand-all"
                            onClick={toggleAll}
                            disabled={saving}
                          >
                            {allOpen ? "Collapse all" : "Expand all"}
                          </button>
                        </div>

                        <div className="am-tree">
                          {groups.length === 0 && (
                            <div className="am-empty">
                              No menu items match “{query}”.
                            </div>
                          )}
                          {groups.map(({ parent, leaves, visibleLeaves }) => {
                            const isOpen = expanded.has(parent.code) || !!q;
                            const parentDirty = Object.prototype.hasOwnProperty.call(dirty, parent.code);
                            const parentVisible = effectiveVisible(parent);
                            return (
                              <div key={parent.code} className={`am-group ${isOpen ? "open" : ""}`}>
                                <div
                                  className="am-parent"
                                  onClick={() => toggleExpand(parent.code)}
                                  role="button"
                                  aria-expanded={isOpen}
                                >
                                  <span className="am-caret">▶</span>
                                  <span className="am-parent-label">{parent.label}</span>
                                  <span className="am-code">{parent.code}</span>
                                  {leaves.length > 0 && (
                                    <span className="am-leaf-count">{leaves.length}</span>
                                  )}
                                  {parent.isVisible == null && !parentDirty && (
                                    <span className="am-inherited">(inherit)</span>
                                  )}
                                  {parentDirty && <span className="am-dirty-dot" title="unsaved change" />}
                                  <span
                                    className="am-parent-check"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Form.Check
                                      type="switch"
                                      id={`node-${parent.code}`}
                                      checked={parentVisible}
                                      disabled={saving}
                                      onChange={() => toggle(parent)}
                                      label=""
                                    />
                                  </span>
                                </div>
                                {isOpen && visibleLeaves.length > 0 && (
                                  <div className="am-leaves">
                                    {visibleLeaves.map((leaf) => {
                                      const leafDirty = Object.prototype.hasOwnProperty.call(dirty, leaf.code);
                                      const leafVisible = effectiveVisible(leaf);
                                      return (
                                        <div className="am-leaf" key={leaf.code}>
                                          <Form.Check
                                            type="checkbox"
                                            id={`node-${leaf.code}`}
                                            checked={leafVisible}
                                            disabled={saving}
                                            onChange={() => toggle(leaf)}
                                            label={
                                              <span>
                                                <span>{leaf.label}</span>
                                                <span className="am-code">{leaf.code}</span>
                                                {leaf.isVisible == null && !leafDirty && (
                                                  <span className="am-inherited">(inherit)</span>
                                                )}
                                                {leafDirty && (
                                                  <span className="am-dirty-dot" title="unsaved change" />
                                                )}
                                              </span>
                                            }
                                          />
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                                {isOpen && visibleLeaves.length === 0 && leaves.length === 0 && (
                                  <div className="am-leaves" style={{ paddingLeft: 44, paddingBottom: 12 }}>
                                    <small className="text-muted">No sub-items registered yet.</small>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()}
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </main>
      </div>
    </div>
  );
}

function roleLabel(slug) {
  const r = ROLES.find((x) => x.slug === slug);
  return r ? r.label : slug;
}
