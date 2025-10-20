import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  Button,
  Table,
  Modal,
  Form,
  Pagination,
  Row,
  Col,
} from "react-bootstrap";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/TopBar";
import axiosInstance from "../components/AxiosInstance";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";
import {
  FaEdit,
  FaTrash,
  FaTimes,
  FaCheck,
  FaUndo,
  FaImage,
} from "react-icons/fa";

export default function OfferImageUpload() {
  const [items, setItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Form fields for two images
  const [image1, setImage1] = useState(null);
  const [image2, setImage2] = useState(null);
  const [image1Preview, setImage1Preview] = useState("");
  const [image2Preview, setImage2Preview] = useState("");

  const nextId = useMemo(
    () => Math.max(0, ...items.map((i) => i.id)) + 1,
    [items]
  );

  const openCreate = () => {
    setEditing(null);
    setImage1(null);
    setImage2(null);
    setImage1Preview("");
    setImage2Preview("");
    setError("");
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setImage1(null); // Reset file input for edit
    setImage2(null); // Reset file input for edit
    setImage1Preview(item.image1Path || "");
    setImage2Preview(item.image2Path || "");
    setError("");
    setShowModal(true);
  };

  const handleEdit = async () => {
    if (!editing) return;

    // Validation - at least one image should be provided
    if (!image1 && !image2 && !image1Preview && !image2Preview) {
      setError("At least one image is required");
      return;
    }

    try {
      setIsLoading(true);
      setError("");
      const formData = new FormData();

      if (image1) {
        formData.append("image1", image1);
      }
      if (image2) {
        formData.append("image2", image2);
      }

      const editRes = await axiosInstance.put(
        `/api/offerImageUpload/${editing.id}`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      if (editRes.data) {
        toast.success("Offer Images Updated Successfully!");
        await fetchOfferImageList(page, search);
        closeModal();
      }
    } catch (error) {
      setError("Failed to update offer images");
      toast.error("Failed to update offer images");
    } finally {
      setIsLoading(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setImage1(null);
    setImage2(null);
    setImage1Preview("");
    setImage2Preview("");
    setError("");
  };

  const fetchOfferImageList = async (pageNum = 0, searchTerm = search) => {
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
        `/api/offerImageUpload?${params.toString()}`
      );

      if (res.data && Array.isArray(res.data)) {
        setItems(res.data);
        if (res.data.length < 10) {
          setTotalPages(pageNum + 1);
        } else {
          setTotalPages(Math.max(totalPages, pageNum + 2));
        }
        setPage(pageNum);
      } else {
        setItems([]);
        setTotalPages(0);
        setPage(0);
      }
    } catch (err) {
      toast.error("Failed to load offer images");
      setItems([]);
      setTotalPages(0);
      setPage(0);
    } finally {
      setIsLoading(false);
    }
  };

  const saveOfferImages = async () => {
    // Validation - at least one image should be provided
    if (!image1 && !image2) {
      setError("At least one image is required");
      return;
    }

    try {
      setIsLoading(true);
      setError("");
      const formData = new FormData();

      if (image1) {
        formData.append("image1", image1);
      }
      if (image2) {
        formData.append("image2", image2);
      }

      const saveRes = await axiosInstance.post(
        "/api/offerImageUpload/save",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      if (saveRes.data !== 0) {
        toast.success("Offer Images added Successfully!");
        await fetchOfferImageList(page, search);
        closeModal();
      }
    } catch (error) {
      setError("Sorry! Data not saved to db..");
      toast.error("Failed to save offer images data");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setImage1(null);
    setImage2(null);
    setImage1Preview("");
    setImage2Preview("");
    setError("");
  };

  useEffect(() => {
    fetchOfferImageList();
  }, []);

  // Debounced search effect
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (search !== "") {
      const timeout = setTimeout(() => {
        fetchOfferImageList(0, search);
      }, 500);
      setSearchTimeout(timeout);
    } else if (search === "") {
      fetchOfferImageList(0, "");
    }

    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [search]);

  const handleDelete = (item) => {
    Swal.fire({
      title: `Are you sure? You want to delete this offer image set?`,
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
          .delete(`/api/offerImageUpload/${item.id}`)
          .then(() => {
            toast.success("Offer Images deleted successfully");
            fetchOfferImageList(page, search);
          })
          .catch(() => {
            toast.error("Sorry!! Offer Images not deleted");
          });
      }
    });
  };

  const handleImage1Change = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage1(file);
      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        setImage1Preview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImage2Change = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage2(file);
      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        setImage2Preview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Card className="shadow-sm rounded-xl">
            <Card.Header className="d-flex justify-content-between align-items-center">
              <span className="fw-semibold">Offer Images</span>
              {/* Search Bar */}
              <Form.Group className="hotel-search-bar">
                <Form.Control
                  type="text"
                  placeholder="Search offer images..."
                  className="form-control-modern-sm"
                  value={searchTerm}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSearchTerm(value);
                    fetchOfferImageList(0, value);
                  }}
                />
              </Form.Group>
              <Button className="btn-green" onClick={openCreate}>
                + Create
              </Button>
            </Card.Header>
            <Card.Body className="p-0">
              <div className="table-responsive">
                <Table className="table-hover mb-0">
                  <thead className="table-light">
                    <tr>
                      <th className="border-0">S.N</th>
                      <th className="border-0">Image 1</th>
                      <th className="border-0">Image 2</th>
                      <th className="border-0">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan="4" className="text-center py-4">
                          <div className="d-flex justify-content-center align-items-center">
                            <div
                              className="spinner-border text-primary me-2"
                              role="status"
                            >
                              <span className="visually-hidden">
                                Loading...
                              </span>
                            </div>
                            Loading offer images...
                          </div>
                        </td>
                      </tr>
                    ) : items.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="text-center py-4 text-muted">
                          No offer images found
                        </td>
                      </tr>
                    ) : (
                      items.map((item, index) => (
                        <tr key={item.id}>
                          <td>{page * 10 + index + 1}</td>
                          <td>
                            {item.image1Path ? (
                              <img
                                src={item.image1Path}
                                alt="Image 1"
                                style={{
                                  width: "50px",
                                  height: "50px",
                                  objectFit: "cover",
                                  borderRadius: "4px",
                                }}
                              />
                            ) : (
                              <span className="text-muted">No image</span>
                            )}
                          </td>
                          <td>
                            {item.image2Path ? (
                              <img
                                src={item.image2Path}
                                alt="Image 2"
                                style={{
                                  width: "50px",
                                  height: "50px",
                                  objectFit: "cover",
                                  borderRadius: "4px",
                                }}
                              />
                            ) : (
                              <span className="text-muted">No image</span>
                            )}
                          </td>
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
                      ))
                    )}
                  </tbody>
                </Table>
              </div>
              {totalPages > 1 && (
                <div className="d-flex justify-content-end p-3">
                  <Pagination>
                    <Pagination.Prev
                      disabled={page === 0}
                      onClick={() => fetchOfferImageList(page - 1, search)}
                    />
                    {Array.from({ length: totalPages }, (_, i) => (
                      <Pagination.Item
                        key={i}
                        active={i === page}
                        onClick={() => fetchOfferImageList(i, search)}
                      >
                        {i + 1}
                      </Pagination.Item>
                    ))}
                    <Pagination.Next
                      disabled={page === totalPages - 1}
                      onClick={() => fetchOfferImageList(page + 1, search)}
                    />
                  </Pagination>
                </div>
              )}
            </Card.Body>
          </Card>

          {/* Create/Edit Offer Images Modal */}
          <Modal show={showModal} onHide={closeModal} centered size="lg">
            <Modal.Header
              closeButton={!isLoading}
              className="bg-primary text-white"
            >
              <Modal.Title>
                {editing ? "Edit Offer Images" : "Create Offer Images"}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form>
                <Row>
                  {/* Offer Image 1 Section */}
                  <Col md={6}>
                    <Form.Group className="mb-4">
                      <Form.Label className="fw-bold mb-3">Offer Image 1</Form.Label>
                      <div className="mb-3">
                        <Form.Control
                          type="file"
                          accept="image/*"
                          onChange={handleImage1Change}
                          className="mb-2"
                          isInvalid={!!error && !image1 && !image1Preview}
                        />
                        <div className="text-muted small">
                          {image1 ? image1.name : "No file chosen"}
                        </div>
                      </div>
                      {image1Preview && (
                        <div className="image-preview-container">
                          <img
                            src={image1Preview}
                            alt="Image 1 Preview"
                            style={{
                              width: "100%",
                              maxHeight: "200px",
                              objectFit: "cover",
                              borderRadius: "8px",
                              border: "1px solid #dee2e6",
                            }}
                          />
                        </div>
                      )}
                      {error && !image1 && !image1Preview && (
                        <Form.Control.Feedback type="invalid">
                          {error}
                        </Form.Control.Feedback>
                      )}
                    </Form.Group>
                  </Col>

                  {/* Offer Image 2 Section */}
                  <Col md={6}>
                    <Form.Group className="mb-4">
                      <Form.Label className="fw-bold mb-3">Offer Image 2</Form.Label>
                      <div className="mb-3">
                        <Form.Control
                          type="file"
                          accept="image/*"
                          onChange={handleImage2Change}
                          className="mb-2"
                          isInvalid={!!error && !image2 && !image2Preview}
                        />
                        <div className="text-muted small">
                          {image2 ? image2.name : "No file chosen"}
                        </div>
                      </div>
                      {image2Preview && (
                        <div className="image-preview-container">
                          <img
                            src={image2Preview}
                            alt="Image 2 Preview"
                            style={{
                              width: "100%",
                              maxHeight: "200px",
                              objectFit: "cover",
                              borderRadius: "8px",
                              border: "1px solid #dee2e6",
                            }}
                          />
                        </div>
                      )}
                      {error && !image2 && !image2Preview && (
                        <Form.Control.Feedback type="invalid">
                          {error}
                        </Form.Control.Feedback>
                      )}
                    </Form.Group>
                  </Col>
                </Row>
              </Form>
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="danger"
                onClick={closeModal}
                disabled={isLoading}
                className="d-flex align-items-center"
              >
                <FaTimes className="me-2" />
                Cancel
              </Button>
              <Button
                className="btn-success d-flex align-items-center"
                onClick={editing ? handleEdit : saveOfferImages}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    ></span>
                    {editing ? "Updating..." : "Creating..."}
                  </>
                ) : (
                  <>
                    <FaCheck className="me-2" />
                    {editing ? "Update" : "Create"}
                  </>
                )}
              </Button>
              <Button
                variant="info"
                onClick={resetForm}
                disabled={isLoading}
                className="d-flex align-items-center"
              >
                <FaUndo className="me-2" />
                Reset
              </Button>
            </Modal.Footer>
          </Modal>
        </main>
      </div>
    </div>
  );
}