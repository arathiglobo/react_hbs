import React, { useEffect, useRef, useState } from "react";
import {
  Card,
  Button,
  Table,
  Modal,
  Form,
  Pagination,
  Badge,
} from "react-bootstrap";
import Sidebar from "../../../components/Sidebar";
import Topbar from "../../../components/TopBar";
import axiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";
import { FaEdit, FaTrash } from "react-icons/fa";
import Select from "react-select";
import BackButton from "../../../components/BackButton";

/**
 * Shared screen behind Manage Masters → Transfer Location Mapping.
 *
 * The Airport / Place / Hotel pages are the same screen with a different
 * `masterType`, so they all mount this component rather than duplicating it.
 *
 * Left side  — our in-house master records (name, code, city, country).
 * Right side — a searchable list of i'way locations, fetched live.
 *
 * This screen only records a translation. It never runs a transfer search and
 * never shows search results.
 */
const PAGE_SIZE = 10;

const API = "/api/transfer-location-mapping";

const customSelectStyles = {
  control: (base) => ({
    ...base,
    minHeight: "42px",
    borderRadius: "0.5rem",
    border: "1px solid #dee2e6",
    boxShadow: "none",
    "&:hover": { borderColor: "#86b7fe" },
  }),
  menu: (base) => ({ ...base, zIndex: 9999 }),
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isFocused ? "#f8f9fa" : "white",
    color: state.isSelected ? "#0d6efd" : "#212529",
    "&:active": { backgroundColor: "#0d6efd", color: "white" },
  }),
};

export default function TransferLocationMappingPage({
  masterType,
  title,
  masterLabel,
  showCode = false,
}) {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [mappedFilter, setMappedFilter] = useState(""); // "" | mapped | unmapped

  // Modal state — one row's mapping being created or edited.
  const [showModal, setShowModal] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [selectedIway, setSelectedIway] = useState(null);
  const [iwayOptions, setIwayOptions] = useState([]);
  const [isIwayLoading, setIsIwayLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  /** Mapping id whose status is mid-save — disables just that row's control. */
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);

  const searchDebounceRef = useRef(null);
  const iwayDebounceRef = useRef(null);

  // ─── List ───────────────────────────────────────────────────────────
  const fetchRows = async (pageNum = 0, search = "", mapped = "") => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        masterType,
        page: String(pageNum),
        limit: String(PAGE_SIZE),
      });
      if (search && search.trim()) params.append("search", search.trim());
      if (mapped) params.append("mapped", mapped);

      const res = await axiosInstance.get(`${API}/masters?${params.toString()}`);
      const data = res?.data || {};
      setRows(Array.isArray(data.content) ? data.content : []);
      setTotalPages(Number(data.totalPages) || 0);
      setTotalElements(Number(data.totalElements) || 0);
      setPage(pageNum);
    } catch {
      toast.error(`Failed to load ${masterLabel.toLowerCase()} list`);
      setRows([]);
      setTotalPages(0);
      setTotalElements(0);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRows(0, "", "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masterType]);

  useEffect(() => {
    clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      fetchRows(0, searchTerm, mappedFilter);
    }, 400);
    return () => clearTimeout(searchDebounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, mappedFilter]);

  // ─── i'way lookup (right-hand side) ─────────────────────────────────
  const fetchIwayOptions = async (term) => {
    if (!term || term.trim().length < 2) {
      setIwayOptions([]);
      return;
    }
    setIsIwayLoading(true);
    try {
      const params = new URLSearchParams({
        masterType,
        search: term.trim(),
        limit: "20",
      });
      const res = await axiosInstance.get(
        `${API}/iway-locations?${params.toString()}`,
      );
      const list = Array.isArray(res?.data) ? res.data : [];
      setIwayOptions(
        list.map((o) => ({
          value: o.iwayLocationId,
          label: o.iwayLocationName || o.iwayLocationId,
          description: o.description || "",
          type: o.type || "",
          iwayLocationId: o.iwayLocationId,
          iwayLocationName: o.iwayLocationName,
        })),
      );
    } catch {
      setIwayOptions([]);
    } finally {
      setIsIwayLoading(false);
    }
  };

  const onIwayInputChange = (input, { action }) => {
    if (action !== "input-change") return;
    clearTimeout(iwayDebounceRef.current);
    iwayDebounceRef.current = setTimeout(() => fetchIwayOptions(input), 400);
  };

  const formatIwayOption = (opt) => (
    <div>
      <div className="fw-semibold">{opt.label}</div>
      <small className="text-muted">
        {opt.type ? `${opt.type} · ` : ""}
        ID: {opt.iwayLocationId}
        {opt.description ? ` · ${opt.description}` : ""}
      </small>
    </div>
  );

  // ─── Modal ──────────────────────────────────────────────────────────
  const openMapping = (row) => {
    setEditingRow(row);
    setSelectedIway(
      row.iwayLocationId
        ? {
            value: row.iwayLocationId,
            label: row.iwayLocationName || row.iwayLocationId,
            iwayLocationId: row.iwayLocationId,
            iwayLocationName: row.iwayLocationName,
            description: "",
            type: "",
          }
        : null,
    );
    setIwayOptions([]);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingRow(null);
    setSelectedIway(null);
    setIwayOptions([]);
  };

  const saveMapping = async () => {
    if (!selectedIway?.iwayLocationId) {
      toast.error("Select an i'way location to map to.");
      return;
    }
    setIsSaving(true);
    try {
      // `active` is intentionally omitted: the API defaults a new mapping to
      // active and leaves an existing one's status untouched when the field
      // is absent, so saving here can never overwrite what the Status column
      // set.
      const payload = {
        masterType,
        masterId: editingRow.masterId,
        iwayLocationId: selectedIway.iwayLocationId,
        iwayLocationName: selectedIway.iwayLocationName || selectedIway.label,
      };
      if (editingRow.id) {
        await axiosInstance.put(`${API}/${editingRow.id}`, payload);
        toast.success("Mapping updated");
      } else {
        await axiosInstance.post(API, payload);
        toast.success("Mapping created");
      }
      closeModal();
      fetchRows(page, searchTerm, mappedFilter);
    } catch (err) {
      // The API returns a readable reason for the cases an admin can act on
      // (already mapped, master not found, no i'way location chosen).
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Failed to save mapping";
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Persist a status change straight from the Status column.
   *
   * The row is updated from the value the API echoes back rather than from
   * what we asked for, so the control can never show a state the database
   * doesn't hold. On failure the whole page is re-fetched for the same reason.
   */
  const changeStatus = async (row, nextActive) => {
    if (!row.id || nextActive === !!row.active) return;
    setStatusUpdatingId(row.id);
    try {
      const res = await axiosInstance.patch(
        `${API}/${row.id}/status?active=${nextActive}`,
      );
      const savedActive = res?.data?.active;
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? { ...r, active: savedActive == null ? nextActive : savedActive }
            : r,
        ),
      );
      toast.success(nextActive ? "Mapping activated" : "Mapping deactivated");
    } catch {
      toast.error("Failed to update status");
      fetchRows(page, searchTerm, mappedFilter);
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const deleteMapping = async (row) => {
    if (!row.id) return;
    const confirm = await Swal.fire({
      title: "Delete mapping?",
      text: `${row.masterName} will no longer be translated to an i'way location.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
      confirmButtonColor: "#dc3545",
    });
    if (!confirm.isConfirmed) return;
    try {
      await axiosInstance.delete(`${API}/${row.id}`);
      toast.success("Mapping deleted");
      fetchRows(page, searchTerm, mappedFilter);
    } catch {
      toast.error("Failed to delete mapping");
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────
  const colCount = showCode ? 8 : 7;

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Card className="shadow-sm rounded-xl">
            <Card.Header className="d-flex flex-column flex-sm-row gap-2 justify-content-between align-items-stretch align-items-sm-center">
              <span className="d-flex align-items-center gap-2">
                <BackButton fallback="/adminDashboard" />
                <span className="fw-semibold">{title}</span>
              </span>
              <div className="d-flex gap-2 flex-grow-1 flex-sm-grow-0">
                <Form.Select
                  style={{ maxWidth: 170 }}
                  value={mappedFilter}
                  onChange={(e) => setMappedFilter(e.target.value)}
                >
                  <option value="">All</option>
                  <option value="mapped">Mapped only</option>
                  <option value="unmapped">Unmapped only</option>
                </Form.Select>
                <Form.Control
                  type="text"
                  placeholder={`Search ${masterLabel}...`}
                  className="form-control-modern-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </Card.Header>

            <Card.Body className="p-0">
              <Table responsive hover striped className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th style={{ width: 70 }}>S/N</th>
                    <th>{masterLabel}</th>
                    {showCode && <th style={{ width: 90 }}>Code</th>}
                    <th>City</th>
                    <th>Country</th>
                    <th>IWay Location</th>
                    <th style={{ width: 120 }}>Status</th>
                    <th style={{ width: 140 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && (
                    <tr>
                      <td colSpan={colCount} className="text-center py-4">
                        Loading…
                      </td>
                    </tr>
                  )}
                  {!isLoading && rows.length === 0 && (
                    <tr>
                      <td colSpan={colCount} className="text-center py-4 text-muted">
                        No {masterLabel.toLowerCase()} records found.
                      </td>
                    </tr>
                  )}
                  {!isLoading &&
                    rows.map((row, index) => (
                      <tr key={`${row.masterType}-${row.masterId}`}>
                        <td>{index + 1 + page * PAGE_SIZE}</td>
                        <td>{row.masterName || "—"}</td>
                        {showCode && <td>{row.masterCode || "—"}</td>}
                        <td>{row.city || "—"}</td>
                        <td>{row.country || "—"}</td>
                        <td>
                          {row.iwayLocationId ? (
                            <div>
                              <div>{row.iwayLocationName || "—"}</div>
                              <small className="text-muted">
                                ID: {row.iwayLocationId}
                              </small>
                            </div>
                          ) : (
                            <span className="text-muted">Not mapped</span>
                          )}
                        </td>
                        {/* The Status column is the only place a mapping's
                            status is shown OR changed — selecting here saves
                            immediately, no Edit dialog involved. */}
                        <td>
                          {!row.id ? (
                            <Badge bg="secondary">Unmapped</Badge>
                          ) : (
                            <Form.Select
                              size="sm"
                              value={row.active ? "active" : "inactive"}
                              disabled={statusUpdatingId === row.id}
                              onChange={(e) =>
                                changeStatus(row, e.target.value === "active")
                              }
                              aria-label="Mapping status"
                            >
                              <option value="active">Active</option>
                              <option value="inactive">Inactive</option>
                            </Form.Select>
                          )}
                        </td>
                        <td>
                          <div className="d-flex gap-2 align-items-center">
                            <FaEdit
                              className="text-primary"
                              style={{ cursor: "pointer", fontSize: "18px" }}
                              onClick={() => openMapping(row)}
                              title={row.id ? "Edit mapping" : "Add mapping"}
                            />
                            {row.id && (
                              <FaTrash
                                className="text-danger"
                                style={{ cursor: "pointer", fontSize: "16px" }}
                                onClick={() => deleteMapping(row)}
                                title="Delete mapping"
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </Table>

              <div className="d-flex justify-content-between align-items-center p-3 border-top">
                <small className="text-muted">
                  {totalElements} {masterLabel.toLowerCase()} record
                  {totalElements === 1 ? "" : "s"}
                </small>
                {totalPages > 1 && (
                  <Pagination className="mb-0">
                    <Pagination.Prev
                      disabled={page === 0}
                      onClick={() =>
                        fetchRows(page - 1, searchTerm, mappedFilter)
                      }
                    />
                    <Pagination.Item active>
                      {page + 1} / {totalPages}
                    </Pagination.Item>
                    <Pagination.Next
                      disabled={page + 1 >= totalPages}
                      onClick={() =>
                        fetchRows(page + 1, searchTerm, mappedFilter)
                      }
                    />
                  </Pagination>
                )}
              </div>
            </Card.Body>
          </Card>
        </main>
      </div>

      {/* Add / Edit mapping */}
      <Modal show={showModal} onHide={closeModal} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {editingRow?.id ? "Edit" : "Add"} {masterLabel} Mapping
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {editingRow && (
            <>
              <div className="mb-3 p-3 bg-light rounded">
                <div className="text-muted small mb-1">Our master record</div>
                <div className="fw-semibold">{editingRow.masterName}</div>
                <small className="text-muted">
                  {[
                    showCode && editingRow.masterCode
                      ? `Code: ${editingRow.masterCode}`
                      : null,
                    editingRow.city,
                    editingRow.country,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </small>
              </div>

              <Form.Group className="mb-3">
                <Form.Label className="fw-semibold">
                  IWay Location <span className="text-danger">*</span>
                </Form.Label>
                <Select
                  options={iwayOptions}
                  value={selectedIway}
                  isLoading={isIwayLoading}
                  onChange={(opt) => setSelectedIway(opt)}
                  onInputChange={onIwayInputChange}
                  formatOptionLabel={formatIwayOption}
                  filterOption={() => true}
                  placeholder="Type at least 2 characters to search i'way…"
                  noOptionsMessage={({ inputValue }) =>
                    inputValue
                      ? "No i'way locations found"
                      : "Type to search i'way locations"
                  }
                  isSearchable
                  isClearable
                  menuPortalTarget={document.body}
                  styles={customSelectStyles}
                />
                <Form.Text className="text-muted">
                  The search runs against i'way directly, so only locations
                  i'way can actually serve are offered here.
                </Form.Text>
              </Form.Group>

              {/* Status is deliberately absent here — it is owned by the
                  Status column in the list, so there is only ever one place
                  to read or change it. */}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeModal} disabled={isSaving}>
            Cancel
          </Button>
          <Button className="btn-green" onClick={saveMapping} disabled={isSaving}>
            {isSaving ? "Saving…" : "Save Mapping"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
