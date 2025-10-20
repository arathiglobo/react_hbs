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
  FaCalendarAlt,
  FaImage,
  FaTimes,
  FaCheck,
  FaUndo,
} from "react-icons/fa";

export default function OfferZone() {
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

  // Form fields
  const [title, setTitle] = useState("");
  const [bannerImage, setBannerImage] = useState(null);
  const [description, setDescription] = useState("");
  const [validityFrom, setValidityFrom] = useState("");
  const [validityTo, setValidityTo] = useState("");

  const nextId = useMemo(
    () => Math.max(0, ...items.map((i) => i.id)) + 1,
    [items]
  );

  const openCreate = () => {
    setEditing(null);
    setTitle("");
    setBannerImage(null);
    setDescription("");
    setValidityFrom("");
    setValidityTo("");
    setError("");
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setTitle(item.title || "");
    setBannerImage(null); // Reset file input for edit
    setDescription(item.description || "");
    
    // Convert LocalDateTime to date string for date inputs
    let fromDate = "";
    let toDate = "";
    
    if (item.validityFrom) {
      // If it's already a date string, use it; otherwise parse LocalDateTime
      if (typeof item.validityFrom === 'string' && item.validityFrom.includes('T')) {
        fromDate = item.validityFrom.split('T')[0];
      } else if (typeof item.validityFrom === 'string') {
        fromDate = item.validityFrom;
      }
    }
    
    if (item.validityTo) {
      // If it's already a date string, use it; otherwise parse LocalDateTime
      if (typeof item.validityTo === 'string' && item.validityTo.includes('T')) {
        toDate = item.validityTo.split('T')[0];
      } else if (typeof item.validityTo === 'string') {
        toDate = item.validityTo;
      }
    }
    
    setValidityFrom(fromDate);
    setValidityTo(toDate);
    setError("");
    setShowModal(true);
  };

  const handleEdit = async () => {
    if (!editing) return;

    // Validation
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!description.trim()) {
      setError("Description is required");
      return;
    }

    try {
      setIsLoading(true);
      setError("");
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      
      // Convert date strings to LocalDateTime format (YYYY-MM-DDTHH:mm:ss)
      if (validityFrom) {
        formData.append("validityFrom", validityFrom + "T00:00:00");
      }
      if (validityTo) {
        formData.append("validityTo", validityTo + "T23:59:59");
      }

      if (bannerImage) {
        formData.append("bannerImage", bannerImage);
      }

      const editRes = await axiosInstance.put(
        `/api/offerDetails/${editing.offerId}`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      if (editRes.data) {
        toast.success("Offer Updated Successfully!");
        await fetchOfferList(page, search);
        closeModal();
      }
    } catch (error) {
      setError("Failed to update offer");
      toast.error("Failed to update offer");
    } finally {
      setIsLoading(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setTitle("");
    setBannerImage(null);
    setDescription("");
    setValidityFrom("");
    setValidityTo("");
    setError("");
  };

  const fetchOfferList = async (pageNum = 0, searchTerm = search) => {
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
        `/api/offerDetails?${params.toString()}`
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
      toast.error("Failed to load offers");
      setItems([]);
      setTotalPages(0);
      setPage(0);
    } finally {
      setIsLoading(false);
    }
  };

  const saveOffer = async () => {
    // Validation
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!description.trim()) {
      setError("Description is required");
      return;
    }
    if (!bannerImage) {
      setError("Banner image is required");
      return;
    }

    try {
      setIsLoading(true);
      setError("");
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      
      // Convert date strings to LocalDateTime format (YYYY-MM-DDTHH:mm:ss)
      if (validityFrom) {
        formData.append("validityFrom", validityFrom + "T00:00:00");
      }
      if (validityTo) {
        formData.append("validityTo", validityTo + "T23:59:59");
      }

      if (bannerImage) {
        formData.append("bannerImage", bannerImage);
      }

      const saveRes = await axiosInstance.post(
        "/api/offerDetails/save",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      if (saveRes.data !== 0) {
        toast.success("Offer added Successfully!");
        await fetchOfferList(page, search);
        closeModal();
      }
    } catch (error) {
      setError("Sorry! Data not saved to db..");
      toast.error("Failed to save offer data");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setBannerImage(null);
    setDescription("");
    setValidityFrom("");
    setValidityTo("");
    setError("");
  };

  useEffect(() => {
    fetchOfferList();
  }, []);

  // Debounced search effect
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (search !== "") {
      const timeout = setTimeout(() => {
        fetchOfferList(0, search);
      }, 500);
      setSearchTimeout(timeout);
    } else if (search === "") {
      fetchOfferList(0, "");
    }

    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [search]);

  const handleDelete = (item) => {
    Swal.fire({
      title: `Are you sure? You want to delete ${item.title}`,
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
          .delete(`/api/offerDetails/${item.offerId}`)
          .then(() => {
            toast.success("Offer deleted successfully");
            fetchOfferList(page, search);
          })
          .catch(() => {
            toast.error("Sorry!! Offer not deleted");
          });
      }
    });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setBannerImage(file);
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
              <span className="fw-semibold">Offers</span>
              {/* Search Bar */}
              <Form.Group className="hotel-search-bar">
                <Form.Control
                  type="text"
                  placeholder="Search offers by title..."
                  className="form-control-modern-sm"
                  value={searchTerm}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSearchTerm(value);
                    fetchOfferList(0, value);
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
                      <th className="border-0">Offer Name</th>
                      <th className="border-0">Description</th>
                      <th className="border-0">Validity From</th>
                      <th className="border-0">Validity To</th>
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
                            Loading offers...
               </div>
                        </td>
                      </tr>
                    ) : items.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="text-center py-4 text-muted">
                          No offers found
                        </td>
                      </tr>
                    ) : (
                      items.map((item, index) => (
                        <tr key={item.id}>
                          <td>{page * 10 + index + 1}</td>
                          <td>{item.title}</td>
                          <td>{item.description}</td>
                          <td>{item.validityFrom || "-"}</td>
                          <td>{item.validityTo || "-"}</td>

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
                      onClick={() => fetchOfferList(page - 1, search)}
                    />
                    {Array.from({ length: totalPages }, (_, i) => (
                      <Pagination.Item
                        key={i}
                        active={i === page}
                        onClick={() => fetchOfferList(i, search)}
                      >
                        {i + 1}
                      </Pagination.Item>
                    ))}
                    <Pagination.Next
                      disabled={page === totalPages - 1}
                      onClick={() => fetchOfferList(page + 1, search)}
                    />
                  </Pagination>
                             </div>
                         )}
             </Card.Body>
           </Card>

          {/* Create/Edit Offers Modal */}
          <Modal show={showModal} onHide={closeModal} centered size="lg">
            <Modal.Header
              closeButton={!isLoading}
              className="bg-primary text-white"
            >
               <Modal.Title>
                {editing ? "Update Offers" : "Create Offers"}
               </Modal.Title>
             </Modal.Header>
             <Modal.Body>
              <Form>
                <Row>
                  <Col md={12}>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        <span className="text-danger">*</span> Title
                      </Form.Label>
                      <Form.Control
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Enter offer title"
                        autoFocus
                        isInvalid={!!error}
                      />
                      {error && (
                        <Form.Control.Feedback type="invalid">
                          {error}
                        </Form.Control.Feedback>
                      )}
                    </Form.Group>
                     </Col>
                   </Row>

                <Row>
                  <Col md={12}>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        <span className="text-danger">*</span> Banner Image
                      </Form.Label>
                      <div className="d-flex align-items-center">
                        <Form.Control
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="me-2"
                          isInvalid={!!error && !bannerImage && !editing}
                        />
                        <span className="text-muted">
                          {bannerImage ? bannerImage.name : "No file chosen"}
                        </span>
                       </div>
                      {error && !bannerImage && !editing && (
                        <Form.Control.Feedback type="invalid">
                          {error}
                        </Form.Control.Feedback>
                      )}
                    </Form.Group>
                     </Col>
                   </Row>

                <Row>
                     <Col md={12}>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        <span className="text-danger">*</span> Description
                      </Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={4}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Enter offer description"
                        isInvalid={!!error}
                      />
                      {error && (
                        <Form.Control.Feedback type="invalid">
                          {error}
                        </Form.Control.Feedback>
                      )}
                    </Form.Group>
                     </Col>
                   </Row>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Validity From</Form.Label>
                      <Form.Control
                        type="date"
                        value={validityFrom}
                        onChange={(e) => {
                          setValidityFrom(e.target.value);
                          // If validity to is before the new from date, clear it
                          if (validityTo && e.target.value && validityTo < e.target.value) {
                            setValidityTo("");
                          }
                        }}
                        min={new Date().toISOString().split('T')[0]} // Prevent selecting past dates
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Validity To</Form.Label>
                      <Form.Control
                        type="date"
                        value={validityTo}
                        onChange={(e) => setValidityTo(e.target.value)}
                        min={validityFrom || new Date().toISOString().split('T')[0]} // Only allow dates after validity from
                      />
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
                onClick={editing ? handleEdit : saveOffer}
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
