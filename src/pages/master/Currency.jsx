import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  Button,
  Table,
  Modal,
  Form,
  Pagination,
  Col,
} from "react-bootstrap";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";
import { FaEdit, FaTrash, FaSearch } from "react-icons/fa";
import "../../styles/Swal.css";
import BackButton from "../../components/BackButton";
// .pagination-modern (the orange rounded pager used on /new-booking/hotel)
// lives here. Its rules are namespaced, so importing it does not restyle
// anything else on this page — Province.jsx imports it the same way.
import "../../styles/HotelSearch.css";

const PAGE_SIZE = 10;

export default function Currency() {
  const [items, setItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [currencyCode, setCurrencyCode] = useState("");
  const [currencyValue, setCurrencyValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  // Real row count for the current search, from the backend's X-Total-Count
  // header on /api/currency. 0 means unknown (older backend build).
  const [totalElements, setTotalElements] = useState(0);
  // Currency column sort, done on the backend across all pages.
  // "asc" = A→Z (the default), "desc" = Z→A. Clicking the header toggles it.
  const [sortDir, setSortDir] = useState("asc");
  const [search, setSearch] = useState("");
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [currencySearchTerm, setCurrencySearchTerm] = useState("");

  const openCreate = () => {
    setEditing(null);
    setName("");
    setError("");
    setCurrencyCode("");
    setCurrencyValue("");
    setShowModal(true);
  };

  const openEdit = (item) => {
    setShowModal(true);
    setEditing(item);
    setName(item.name);
    setCurrencyCode(item.currencyCode);
    setCurrencyValue(item.value);
  };

  const handleEdit = async () => {
    if (!editing) return;

    try {
      setIsLoading(true);
      const editRes = await axiosInstance.put(`/api/currency/${editing.currencyId}`, {
        name: name,
        currencyCode: currencyCode,
        value: currencyValue,
      });

      console.log("editRes::", editRes);

      if (editRes.data) {
        toast.success("Currency Updated Successfully!");
        // First refresh the list
        await fetchCurrencyList(page, search);
        // Then close modal and reset state
        closeModal();
      }
    } catch (error) {
      setError("Failed to update Currency");
      toast.error("Failed to update Currency");
    } finally {
      setIsLoading(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setName("");
    setCurrencyCode("");
    setCurrencyValue("");
    setError("");
  };

  const fetchCurrencyList = async (
    pageNum = 0,
    currencySearchTerm = search,
    dirOverride = sortDir
  ) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: String(PAGE_SIZE),
        // Sorted by currency name, A→Z or Z→A (the backend applies it
        // across all pages, not just the current one).
        sortBy: "name",
        direction: dirOverride === "desc" ? "desc" : "asc",
      });

      console.log("currencySearchTerm::", search);

      if (currencySearchTerm && currencySearchTerm.trim()) {
          params.append("search",currencySearchTerm.trim());
      }

      const res = await axiosInstance.get(`/api/currency?${params.toString()}`);

      // Check if response has data and pagination info
      if (res.data && Array.isArray(res.data)) {
        setItems(res.data);
        // Size the pager from the real match count (X-Total-Count header),
        // so the last pages can be shown up front. Falls back to the old
        // page-length guess only when the header is missing.
        const rawHeader = res.headers?.["x-total-count"];
        const rawTotal = rawHeader == null ? NaN : Number(rawHeader);
        if (Number.isFinite(rawTotal) && rawTotal >= 0) {
          setTotalElements(rawTotal);
          setTotalPages(Math.max(1, Math.ceil(rawTotal / PAGE_SIZE)));
        } else if (res.data.length < PAGE_SIZE) {
          setTotalElements(pageNum * PAGE_SIZE + res.data.length);
          setTotalPages(pageNum + 1);
        } else {
          setTotalElements(0);
          setTotalPages((prev) => Math.max(prev, pageNum + 2));
        }

        setPage(pageNum);
      } else {
        setItems([]);
        setTotalPages(0);
        setTotalElements(0);
        setPage(0);
      }
    } catch (err) {
      toast.error("Failed to load Currency");
      setItems([]);
      setTotalPages(0);
      setTotalElements(0);
      setPage(0);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Pager — same format as /new-booking/hotel (src/pages/HotelSearch.jsx):
  //    always the first 3 and last 3 pages, plus the current page and its
  //    neighbours; "…" fills each gap. A gap of one page shows that page
  //    instead, since an ellipsis there would hide nothing.
  const effectiveTotalPages = Math.max(1, totalPages);

  const pageNumbers = useMemo(() => {
    const EDGE_PAGES = 3;
    const current = page + 1;
    const total = effectiveTotalPages;
    const shown = new Set();
    for (let i = 1; i <= Math.min(EDGE_PAGES, total); i++) shown.add(i);
    for (let i = Math.max(1, total - EDGE_PAGES + 1); i <= total; i++) shown.add(i);
    for (let i = Math.max(1, current - 1); i <= Math.min(total, current + 1); i++) {
      shown.add(i);
    }
    const sorted = Array.from(shown).sort((a, b) => a - b);
    const nums = [];
    sorted.forEach((n, idx) => {
      const prev = sorted[idx - 1];
      if (prev !== undefined && n - prev === 2) nums.push(prev + 1);
      else if (prev !== undefined && n - prev > 2) nums.push(`ellipsis-${prev}`);
      nums.push(n);
    });
    return nums;
  }, [page, effectiveTotalPages]);

  // Jump to a 0-based page; ignores out-of-range requests. Uses the text in
  // the search box (currencySearchTerm), so paging through search results
  // stays filtered.
  const goToPage = (idx) => {
    if (idx < 0 || idx >= effectiveTotalPages) return;
    fetchCurrencyList(idx, currencySearchTerm);
  };

  // Header click: the list starts A→Z, so each click flips the direction.
  // Goes back to page 1 so the new order starts from the top, and keeps
  // the current search.
  const toggleNameSort = () => {
    const nextDir = sortDir === "asc" ? "desc" : "asc";
    setSortDir(nextDir);
    fetchCurrencyList(0, currencySearchTerm, nextDir);
  };

  const saveCurrency = async () => {
    try {
      setIsLoading(true);
      const currenctReq = {
        name: `${name}`,
        value: `${currencyValue}`,
        currencyCode: `${currencyCode}`,
      };

      const saveRes = await axiosInstance.post(
        "/api/currency/saveCurrency",
        currenctReq
      );
      if (saveRes.data !== 0) {
        toast.success("Currency added Successfully!");
        // First refresh the list
        await fetchCurrencyList(page, search);
        // Then close modal
        closeModal();
      }
    } catch (error) {
      setError("Sorry! Data not saved to db..");
      toast.error("Failed to save currency data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrencyList();
  }, []);

  // Debounced search effect
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Set new timeout for search
    if (search !== "") {
      const timeout = setTimeout(() => {
        fetchCurrencyList(0, search);
      }, 500); // 500ms delay
      setSearchTimeout(timeout);
    } else if (search === "") {
      // If search is cleared, fetch all data
      fetchCurrencyList(0, "");
    }

    // Cleanup timeout on unmount
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [search]);

  const handleDelete = (item) => {
    Swal.fire({
      titleText: `Are you sure? You want to delete ${item.name}`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
      customClass: {
        popup: "swal-small",
        title: "swal-small-title titleStyle",
        htmlContainer: "swal-small-text",
      },
    }).then((result) => {
      if (result.isConfirmed) {
        axiosInstance
          .delete(`/api/currency/${item.currencyId}`)
          .then(() => {
            toast.success("Currency deleted successfully");
            fetchCurrencyList(page, search);
          })
          .catch(() => {
            toast.error("Sorry!!Currency not deleted");
          });
      }
    });
  };

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
                <span className="fw-semibold">Currency</span>
              </span>
              {/* Currency Name Search */}
              <Col lg={3} md={6}>
                <Form.Group className="hotel-search-bar flex-grow-1 flex-sm-grow-0">
                  <Form.Control
                    type="text"
                    placeholder="Search currency by name..."
                    className="form-control-modern-sm"
                    value={currencySearchTerm}
                    onChange={(e) => {
                      const value = e.target.value;
                      setCurrencySearchTerm(value);
                      fetchCurrencyList(0, value); // pass value to API
                    }}
                  />
                </Form.Group>
              </Col>
              <Button className="btn-green" onClick={openCreate}>
                + Create
              </Button>
            </Card.Header>
            <Card.Body className="p-0">
              <Table responsive hover striped className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th style={{ width: 100 }}>S/N</th>
                    {/* Sortable header — same look and behaviour as Agent
                        Name on /registration/agent (AgentReg.jsx). A plain
                        <th> keeps its column-header role, which is what
                        aria-sort belongs on; tabIndex + Enter/Space keep it
                        usable from the keyboard. */}
                    <th
                      tabIndex={0}
                      aria-sort={sortDir === "asc" ? "ascending" : "descending"}
                      style={{
                        cursor: "pointer",
                        userSelect: "none",
                        whiteSpace: "nowrap",
                      }}
                      onClick={toggleNameSort}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleNameSort();
                        }
                      }}
                      title={
                        sortDir === "asc"
                          ? "Sorted A to Z — click to sort Z to A"
                          : "Sorted Z to A — click to sort A to Z"
                      }
                    >
                      <span className="d-inline-flex align-items-center gap-1">
                        Currency
                        <span className="text-primary fw-bold" aria-hidden="true">
                          {sortDir === "asc" ? "▲" : "▼"}
                        </span>
                      </span>
                    </th>
                    <th>Currency Code</th>
                    <th>Value</th>
                    <th style={{ width: 160 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.currencyId}>
                      <td>{index + 1 + page * PAGE_SIZE}</td>
                      <td>{item.name}</td>
                      <td>{item.currencyCode}</td>
                      <td>{item.value}</td>
                      <td>
                        <div className="d-flex gap-2">
                          <FaEdit
                            className="text-primary"
                            style={{ cursor: "pointer", fontSize: "18px" }}
                            onClick={() => openEdit(item)}
                            title="Edit"
                          />
                          <FaTrash
                            className="text-danger"
                            style={{ cursor: "pointer", fontSize: "18px" }}
                            onClick={() => handleDelete(item)}
                            title="Delete"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {isLoading && (
                    <tr>
                      <td colSpan={3} className="text-center text-muted py-4">
                        <div
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                        >
                          <span className="visually-hidden">Loading...</span>
                        </div>
                        Loading available currencies...
                      </td>
                    </tr>
                  )}
                  {items.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan={3} className="text-center text-muted py-4">
                        No currencies found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 p-3 border-top">
                  <div>
                    <small className="text-muted">
                      Showing {items.length} of{" "}
                      {totalElements > 0 ? totalElements : totalPages * PAGE_SIZE}{" "}
                      currencies.
                    </small>
                  </div>
                  <div>
                    <Pagination className="mb-0 pagination-modern">
                      <Pagination.Prev
                        disabled={page === 0}
                        onClick={() => goToPage(page - 1)}
                      />
                      {pageNumbers.map((n) =>
                        typeof n === "number" ? (
                          <Pagination.Item
                            key={n}
                            active={n === page + 1}
                            onClick={() => goToPage(n - 1)}
                          >
                            {n}
                          </Pagination.Item>
                        ) : (
                          <Pagination.Ellipsis key={n} disabled />
                        ),
                      )}
                      <Pagination.Next
                        disabled={page >= effectiveTotalPages - 1}
                        onClick={() => goToPage(page + 1)}
                      />
                    </Pagination>
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>

          <Modal show={showModal} onHide={closeModal} centered>
            <Modal.Header closeButton={!isLoading}>
              <Modal.Title>
                {editing ? "Update Currency" : "Create Currency"}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form>
                <Form.Group className="mb-3">
                  <Form.Label>Currency</Form.Label>
                  <Form.Control
                    value={name}
                    placeholder="Enter currency name"
                    onChange={(e) => setName(e.target.value)}
                    isInvalid={!!error}
                  />

                  {error && (
                    <Form.Control.Feedback type="invalid">
                      {error}
                    </Form.Control.Feedback>
                  )}
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Currecncy Code</Form.Label>
                  <Form.Control
                    value={currencyCode}
                    onChange={(e) => setCurrencyCode(e.target.value)}
                    placeholder="Enter Currency Code"
                    autoFocus
                    isInvalid={!!error}
                  />
                  {error && (
                    <Form.Control.Feedback type="invalid">
                      {error}
                    </Form.Control.Feedback>
                  )}
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Value</Form.Label>
                  <Form.Control
                    value={currencyValue}
                    onChange={(e) => setCurrencyValue(e.target.value)}
                    placeholder="Enter Value"
                    autoFocus
                    isInvalid={!!error}
                  />
                  {error && (
                    <Form.Control.Feedback type="invalid">
                      {error}
                    </Form.Control.Feedback>
                  )}
                </Form.Group>
              </Form>
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="secondary"
                onClick={closeModal}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                className="btn-indigo"
                onClick={editing ? handleEdit : saveCurrency}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    ></span>
                    {editing ? "Updating..." : "Saving..."}
                  </>
                ) : editing ? (
                  "Update"
                ) : (
                  "Save"
                )}
              </Button>
            </Modal.Footer>
          </Modal>
        </main>
      </div>
    </div>
  );
}
