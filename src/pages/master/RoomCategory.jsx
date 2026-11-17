import React, { useEffect, useMemo, useState } from "react";
import { Card, Button, Table, Modal, Form, Pagination } from "react-bootstrap";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";
import { FaEdit, FaTrash } from "react-icons/fa";
import BackButton from "../../components/BackButton";
// .pagination-modern (the orange rounded pager used on /new-booking/hotel)
// lives here. Its rules are namespaced, so importing it does not restyle
// anything else on this page — Province.jsx imports it the same way.
import "../../styles/HotelSearch.css";

const PAGE_SIZE = 10;

export default function RoomCategory() {
  const [items, setItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [roomCategory, setRoomCategory] = useState("");
  const [categoryCode, setCategoryCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({});
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  // Real row count for the current search, from the backend's X-Total-Count
  // header on /api/roomCategory. 0 means unknown (older backend build).
  const [totalElements, setTotalElements] = useState(0);
  // Room Category column sort, done on the backend across all pages.
  // "asc" = A→Z (the default), "desc" = Z→A. Clicking the header toggles it.
  const [sortDir, setSortDir] = useState("asc");
  const [search, setSearch] = useState("");
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [searchTerm, setSearchTerm] = useState(null);

  // Validation functions
  const validateForm = () => {
    const newErrors = {};

    // Room Category validation
    if (!roomCategory || roomCategory.trim() === "") {
      newErrors.roomCategory = "Room Category is required";
    } else if (roomCategory.trim().length < 2) {
      newErrors.roomCategory = "Room Category must be at least 2 characters long";
    } else if (roomCategory.trim().length > 100) {
      newErrors.roomCategory = "Room Category must not exceed 100 characters";
    }

    // Category Code validation
    if (!categoryCode || categoryCode.trim() === "") {
      newErrors.categoryCode = "Category Code is required";
    } else if (categoryCode.trim().length < 1) {
      newErrors.categoryCode = "Category Code must be at least 1 character long";
    } else if (categoryCode.trim().length > 20) {
      newErrors.categoryCode = "Category Code must not exceed 20 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const clearError = (fieldName) => {
    if (errors[fieldName]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };

  const nextId = useMemo(
    () => Math.max(0, ...items.map((i) => i.id)) + 1,
    [items]
  );

  const openCreate = () => {
    setEditing(null);
    setRoomCategory("");
    setCategoryCode("");
    setError("");
    setErrors({});
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setRoomCategory(item.roomCategory || "");
    setCategoryCode(item.categoryCode || "");
    setError("");
    setErrors({});
    setShowModal(true);
  };

  const handleEdit = async () => {
    if (!editing) return;

    // Validate form before submitting
    if (!validateForm()) {
      toast.error("Please fix the validation errors");
      return;
    }

    try {
      setIsLoading(true);
      const editRes = await axiosInstance.put(
        `/api/roomCategory/${editing.roomCategoryId}`,
        {
          roomCategory: roomCategory.trim(),
          categoryCode: categoryCode.trim(),
        }
      );

     if (editRes.data) {
        toast.success("Room Category Updated Successfully!");
        // First refresh the list
        await fetchRoomCategoryList(page, search);
        // Then close modal and reset state
        closeModal();
      }
    } catch (error) {
      setError("Failed to update room category");
      toast.error("Failed to update room category");
    } finally {
      setIsLoading(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setRoomCategory("");
    setCategoryCode("");
    setError("");
    setErrors({});
  };

  const fetchRoomCategoryList = async (
    pageNum = 0,
    searchTerm = search,
    dirOverride = sortDir,
  ) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: String(PAGE_SIZE),
        // Sorted by room category name, A→Z or Z→A (the backend applies it
        // across all pages, not just the current one).
        sortBy: "name",
        direction: dirOverride === "desc" ? "desc" : "asc",
      });

      if (searchTerm && searchTerm.trim()) {
        params.append("search", searchTerm.trim());
      }

      const res = await axiosInstance.get(
        `/api/roomCategory?${params.toString()}`
      );
     
     // Check if response has data and pagination info
     if (res.data && Array.isArray(res.data)) {
        setItems(res.data);
        // Size the pager from the real match count (X-Total-Count header),
        // so the last pages can be shown up front. Falls back to the old
        // page-length guess only when the header is missing.
        const rawTotal = Number(res.headers?.["x-total-count"]);
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
      toast.error("Failed to load room categories");
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
  // the search box (searchTerm), so paging through search results stays
  // filtered.
  const goToPage = (idx) => {
    if (idx < 0 || idx >= effectiveTotalPages) return;
    fetchRoomCategoryList(idx, searchTerm || "");
  };

  // Header click: the list starts A→Z, so each click flips the direction.
  // Goes back to page 1 so the new order starts from the top, and keeps
  // the current search.
  const toggleNameSort = () => {
    const nextDir = sortDir === "asc" ? "desc" : "asc";
    setSortDir(nextDir);
    fetchRoomCategoryList(0, searchTerm || "", nextDir);
  };

  const saveRoomCategory = async () => {
    // Validate form before submitting
    if (!validateForm()) {
      toast.error("Please fix the validation errors");
      return;
    }

    try {
      setIsLoading(true);
      const roomCategoryPayload = { 
        roomCategory: roomCategory.trim(),
        categoryCode: categoryCode.trim()
      };
      const roomCategorySaveRes = await axiosInstance.post(
        "/api/roomCategory/save",
        roomCategoryPayload
      );
      if (roomCategorySaveRes.data !== 0) {
        toast.success("Room Category added Successfully!");
        // First refresh the list
        await fetchRoomCategoryList(page, search);
        // Then close modal
        closeModal();
      }
    } catch (error) {
      setError("Sorry! Data not saved to db..");
      toast.error("Failed to save room category data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRoomCategoryList();
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
        fetchRoomCategoryList(0, search);
      }, 500); // 500ms delay
      setSearchTimeout(timeout);
    } else if (search === "") {
      // If search is cleared, fetch all data
      fetchRoomCategoryList(0, "");
    }

    // Cleanup timeout on unmount
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [search]);

  const handleDelete = (item) => {
    console.log("delete item :::" , item);
    Swal.fire({
      titleText: `Are you sure? You want to delete ${item.roomCategory} Room Category`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
      customClass: {
        popup: "swal-small",
        title: "swal-small-title",
        htmlContainer: "swal-small-text",
      },
    }).then((result) => {
      if (result.isConfirmed) {
        axiosInstance
          .delete(`/api/roomCategory/${item.roomCategoryId}`)
          .then(() => {
            toast.success("Room Category deleted successfully");
            fetchRoomCategoryList(page, search);
          })
          .catch(() => {
            toast.error("Sorry!! Room Category not deleted");
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
                <span className="fw-semibold">Room Category</span>
              </span>
              {/* Room Category Search */}
               <Form.Group className="hotel-search-bar flex-grow-1 flex-sm-grow-0">
                  <Form.Control
                    type="text"
                    placeholder="Search room category...."
                    className="form-control-modern-sm"
                    value={searchTerm}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSearchTerm(value);
                      fetchRoomCategoryList(0, value); // pass value to API
                    }}
                  />
                </Form.Group>
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
                        Name on /registration/agent (AgentReg.jsx). */}
                    <th
                      role="button"
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
                        Room Category
                        <span className="text-primary fw-bold" aria-hidden="true">
                          {sortDir === "asc" ? "▲" : "▼"}
                        </span>
                      </span>
                    </th>
                    <th>Category Code</th>
                    <th style={{ width: 160 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.roomCategoryId}>
                      <td>{index + 1 + page * 10}</td>
                      <td>{item.roomCategory}</td>
                      <td>{item.categoryCode}</td>
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
                      <td colSpan={4} className="text-center text-muted py-4">
                        <div
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                        >
                          <span className="visually-hidden">Loading...</span>
                        </div>
                        Loading available room categories...
                      </td>
                    </tr>
                  )}
                  {items.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan={4} className="text-center text-muted py-4">
                        No room categories found.
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
                      room categories
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

          <Modal show={showModal} onHide={() => {}} centered backdrop="static" keyboard={false}>
            <Modal.Header closeButton={!isLoading} onHide={closeModal}>
              <Modal.Title>
                {editing ? "Update Room Category" : "Create Room Category"}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form>
                <Form.Group className="mb-3">
                  <Form.Label>Room Category <span className="text-danger">*</span></Form.Label>
                  <Form.Control
                    value={roomCategory}
                    onChange={(e) => {
                      setRoomCategory(e.target.value);
                      clearError('roomCategory');
                    }}
                    placeholder="Enter room category"
                    autoFocus
                    isInvalid={!!errors.roomCategory}
                    maxLength={100}
                  />
                  <Form.Text className="text-muted">
                    {roomCategory.length}/100 characters
                  </Form.Text>
                  {errors.roomCategory && (
                    <Form.Control.Feedback type="invalid">
                      {errors.roomCategory}
                    </Form.Control.Feedback>
                  )}
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Category Code <span className="text-danger">*</span></Form.Label>
                  <Form.Control
                    value={categoryCode}
                    onChange={(e) => {
                      setCategoryCode(e.target.value);
                      clearError('categoryCode');
                    }}
                    placeholder="Enter category code"
                    isInvalid={!!errors.categoryCode}
                    maxLength={20}
                  />
                  <Form.Text className="text-muted">
                    {categoryCode.length}/20 characters
                  </Form.Text>
                  {errors.categoryCode && (
                    <Form.Control.Feedback type="invalid">
                      {errors.categoryCode}
                    </Form.Control.Feedback>
                  )}
                </Form.Group>
                {error && (
                  <div className="alert alert-danger" role="alert">
                    {error}
                  </div>
                )}
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
                onClick={editing ? handleEdit : saveRoomCategory}
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
