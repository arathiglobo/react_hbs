import React, { useEffect, useMemo, useState } from "react";
import { Card, Button, Table, Modal, Form, Pagination } from "react-bootstrap";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";
import { FaEdit, FaTrash } from "react-icons/fa";

export default function DayActivities() {
  const [items, setItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({});
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [searchTerm, setSearchTerm] = useState(null);

  // Validation functions
  const validateForm = () => {
    const newErrors = {};

    // Name validation (matches @NotBlank annotation)
    if (!name || name.trim() === "") {
      newErrors.name = "Name is required";
    } else if (name.trim().length < 2) {
      newErrors.name = "Name must be at least 2 characters long";
    } else if (name.trim().length > 100) {
      newErrors.name = "Name must not exceed 100 characters";
    }

    // Code validation (matches @NotBlank and @Size annotations)
    if (!code || code.trim() === "") {
      newErrors.code = "Code is required";
    } else if (code.trim().length < 2) {
      newErrors.code = "Code must be at least 2 characters long";
    } else if (code.trim().length > 10) {
      newErrors.code = "Code must not exceed 10 characters";
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
    setName("");
    setCode("");
    setError("");
    setErrors({});
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setName(item.name || "");
    setCode(item.code || "");
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
        `/api/dayActivities/${editing.dayActivitiesId}`,
        {
          name: name.trim(),
          code: code.trim(),
        }
      );

     if (editRes.data) {
        toast.success("DayActivities Updated Successfully!");
        // First refresh the list
        await fetchDayActivitiesList(page, search);
        // Then close modal and reset state
        closeModal();
      }
    } catch (error) {
      setError("Failed to update day activities");
      toast.error("Failed to update day activities");
    } finally {
      setIsLoading(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setName("");
    setCode("");
    setError("");
    setErrors({});
  };

  const fetchDayActivitiesList = async (pageNum = 0, searchTerm = search) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: "10",
      });

      if (searchTerm && searchTerm.trim()) {
        params.append("search", searchTerm.trim());
      }

      const res = await axiosInstance.get(
        `/api/dayActivities?${params.toString()}`
      );
     
     // Check if response has data and pagination info
     if (res.data && Array.isArray(res.data)) {
        setItems(res.data);
        // Since backend doesn't return totalPages, we'll calculate it based on data length
        // If we get less than 10 items, it's likely the last page
        if (res.data.length < 10) {
          setTotalPages(pageNum + 1);
        } else {
          // If we get exactly 10 items, there might be more pages
          // We'll set a reasonable total or keep the current totalPages
          setTotalPages(Math.max(totalPages, pageNum + 2));
        }

        setPage(pageNum);
      } else {
        setItems([]);
        setTotalPages(0);
        setPage(0);
      }
    } catch (err) {
      toast.error("Failed to load day activitiess");
      setItems([]);
      setTotalPages(0);
      setPage(0);
    } finally {
      setIsLoading(false);
    }
  };

  const saveDayActivities = async () => {
    // Validate form before submitting
    if (!validateForm()) {
      toast.error("Please fix the validation errors");
      return;
    }

    try {
      setIsLoading(true);
      const dayActivitiesPayload = { 
        name: name.trim(),
        code: code.trim()
      };
      const dayActivitiesSaveRes = await axiosInstance.post(
        "/api/dayActivities/save",
        dayActivitiesPayload
      );
      if (dayActivitiesSaveRes.data !== 0) {
        toast.success("DayActivities added Successfully!");
        // First refresh the list
        await fetchDayActivitiesList(page, search);
        // Then close modal
        closeModal();
      }
    } catch (error) {
      setError("Sorry! Data not saved to db..");
      toast.error("Failed to save day activities data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDayActivitiesList();
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
        fetchDayActivitiesList(0, search);
      }, 500); // 500ms delay
      setSearchTimeout(timeout);
    } else if (search === "") {
      // If search is cleared, fetch all data
      fetchDayActivitiesList(0, "");
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
      title: `Are you sure? You want to delete ${item.name} DayActivities`,
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
          .delete(`/api/dayActivities/${item.dayActivitiesId}`)
          .then(() => {
            toast.success("DayActivities deleted successfully");
            fetchDayActivitiesList(page, search);
          })
          .catch(() => {
            toast.error("Sorry!! DayActivities not deleted");
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
            <Card.Header className="d-flex justify-content-between align-items-center">
              <span className="fw-semibold">DayActivities</span>
              {/* DayActivities Search */}
               <Form.Group className="hotel-search-bar">
                  <Form.Control
                    type="text"
                    placeholder="Search day activities...."
                    className="form-control-modern-sm"
                    value={searchTerm}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSearchTerm(value);
                      fetchDayActivitiesList(0, value); // pass value to API
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
                    <th>Day Activities Name</th>
                    <th>Code</th>
                    <th style={{ width: 160 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.dayActivitiesId}>
                      <td>{index + 1 + page * 10}</td>
                      <td>{item.name}</td>
                      <td>{item.code}</td>
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
                        Loading available day activitiess...
                      </td>
                    </tr>
                  )}
                  {items.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan={4} className="text-center text-muted py-4">
                        No day activitiess found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="d-flex justify-content-between align-items-center p-3 border-top">
                  <div>
                    <small className="text-muted">
                      Showing {items.length} of {totalPages * 10} day activitiess
                    </small>
                  </div>
                  <div>
                    <Pagination className="mb-0">
                      <Pagination.Prev
                        disabled={page === 0}
                        onClick={() => fetchDayActivitiesList(page - 1, search)}
                      />
                      {[...Array(totalPages).keys()].map((num) => (
                        <Pagination.Item
                          key={num}
                          active={num === page}
                          onClick={() => fetchDayActivitiesList(num, search)}
                        >
                          {num + 1}
                        </Pagination.Item>
                      ))}
                      <Pagination.Next
                        disabled={page === totalPages - 1}
                        onClick={() => fetchDayActivitiesList(page + 1, search)}
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
                {editing ? "Update DayActivities" : "Create DayActivities"}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form>
                <Form.Group className="mb-3">
                  <Form.Label>Day Activities Name <span className="text-danger">*</span></Form.Label>
                  <Form.Control
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      clearError('name');
                    }}
                    placeholder="Enter day activities name"
                    autoFocus
                    isInvalid={!!errors.name}
                    maxLength={100}
                  />
                  {errors.name && (
                    <Form.Control.Feedback type="invalid">
                      {errors.name}
                    </Form.Control.Feedback>
                  )}
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Day Activities Code <span className="text-danger">*</span></Form.Label>
                  <Form.Control
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value);
                      clearError('code');
                    }}
                    placeholder="Enter day activities code (2-10 characters)"
                    isInvalid={!!errors.code}
                    maxLength={10}
                  />
                  {errors.code && (
                    <Form.Control.Feedback type="invalid">
                      {errors.code}
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
                onClick={editing ? handleEdit : saveDayActivities}
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