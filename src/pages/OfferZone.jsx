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
  // An offer can carry several banners. Files picked in this session and URLs
  // already stored on the offer are tracked separately: the first are uploaded,
  // the second are sent back as "keep these" so the server knows what to retain
  // and what to delete.
  const [newImages, setNewImages] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
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
    setNewImages([]);
    setExistingImages([]);
    setDescription("");
    setValidityFrom("");
    setValidityTo("");
    setError("");
    setShowModal(true);
  };

  const openEdit = (item) => {
    console.log("open edit item::", item);
    setEditing(item);
    setTitle(item.title || "");
    setNewImages([]);
    // Prefer the full list; fall back to the single banner for offers saved
    // before multiple images were supported.
    setExistingImages(
      Array.isArray(item.bannerImagePaths) && item.bannerImagePaths.length > 0
        ? item.bannerImagePaths
        : item.bannerImagePah
        ? [item.bannerImagePah]
        : []
    );
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

    // Images are the only required field — title, description and the
    // validity dates are all optional.
    if (existingImages.length === 0 && newImages.length === 0) {
      setError("At least one banner image is required");
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

      // Always send keepImagePaths — even empty, so the server knows the
      // caller is managing images and removals actually take effect.
      existingImages.forEach((url) => formData.append("keepImagePaths", url));
      newImages.forEach((file) => formData.append("bannerImages", file));

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
    setNewImages([]);
    setExistingImages([]);
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
    // Images are the only required field — title, description and the validity
    // dates are all optional.
    if (newImages.length === 0) {
      setError("At least one banner image is required");
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

      newImages.forEach((file) => formData.append("bannerImages", file));

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
    setNewImages([]);
    setExistingImages([]);
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

  // Appends rather than replaces, so images can be added across several picks.
  // The input is cleared afterwards so choosing the same file again still fires.
  const handleImageChange = (e) => {
    const picked = Array.from(e.target.files || []).filter((f) =>
      f.type.startsWith("image/")
    );
    if (picked.length > 0) {
      setNewImages((prev) => [...prev, ...picked]);
      setError("");
    }
    e.target.value = "";
  };

  const removeNewImage = (index) => {
    setNewImages((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingImage = (url) => {
    setExistingImages((prev) => prev.filter((u) => u !== url));
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
                      <th className="border-0">Banners</th>
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
                        <td colSpan="7" className="text-center py-4">
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
                        <td colSpan="7" className="text-center py-4 text-muted">
                          No offers found
                        </td>
                      </tr>
                    ) : (
                      items.map((item, index) => (
                        <tr key={item.id}>
                          <td>{page * 10 + index + 1}</td>

                          {/* Images are the only required field now, so the
                              banners lead the row. Up to three thumbnails, then
                              a count for the rest. */}
                          <td>
                            {(() => {
                              const urls =
                                Array.isArray(item.bannerImagePaths) &&
                                item.bannerImagePaths.length > 0
                                  ? item.bannerImagePaths
                                  : item.bannerImagePah
                                  ? [item.bannerImagePah]
                                  : [];

                              if (urls.length === 0) {
                                return (
                                  <span className="text-muted small fst-italic">
                                    No image
                                  </span>
                                );
                              }

                              return (
                                <div className="d-flex align-items-center gap-1">
                                  {urls.slice(0, 3).map((url, i) => (
                                    <img
                                      key={`${url}-${i}`}
                                      src={url}
                                      alt=""
                                      className="rounded border"
                                      style={{
                                        width: 46,
                                        height: 32,
                                        objectFit: "cover",
                                      }}
                                    />
                                  ))}
                                  {urls.length > 3 && (
                                    <span
                                      className="badge bg-light text-dark border"
                                      title={`${urls.length} images in total`}
                                    >
                                      +{urls.length - 3}
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </td>

                          {/* Title, description and the validity dates are all
                              optional now, so each falls back to a dash rather
                              than rendering an empty cell. */}
                          <td>
                            {item.title || (
                              <span className="text-muted fst-italic">
                                Untitled
                              </span>
                            )}
                          </td>
                          <td>
                            {item.description ? (
                              <span
                                className="d-inline-block text-truncate"
                                style={{ maxWidth: 260 }}
                                title={item.description}
                              >
                                {item.description}
                              </span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td>{item.validityFrom || <span className="text-muted">—</span>}</td>
                          <td>{item.validityTo || <span className="text-muted">—</span>}</td>

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
          {/* Dismissable only via Cancel or the header X — a stray click on
              the backdrop (or a reflex Escape) used to discard a half-filled
              offer, picked images and all. */}
          <Modal
            show={showModal}
            onHide={closeModal}
            centered
            size="lg"
            backdrop="static"
            keyboard={false}
          >
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
                      <Form.Label>Title</Form.Label>
                      <Form.Control
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Enter offer title (optional)"
                        autoFocus
                      />
                    </Form.Group>
                     </Col>
                   </Row>

                <Row>
                  <Col md={12}>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        <span className="text-danger">*</span> Banner Images
                      </Form.Label>
                      <Form.Control
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageChange}
                        isInvalid={!!error}
                      />
                      {error && (
                        <Form.Control.Feedback type="invalid">
                          {error}
                        </Form.Control.Feedback>
                      )}
                      <Form.Text className="text-muted">
                        Pick several at once, or add more in a second go. Every
                        image here becomes a slide in the login page banner.
                      </Form.Text>

                      {/* Previews · saved images first, then the ones picked in
                          this session. Removing a saved one only takes effect
                          once the offer is saved. */}
                      {(existingImages.length > 0 || newImages.length > 0) && (
                        <div className="mt-3">
                          <div className="d-flex align-items-center mb-2">
                            <FaImage className="me-2 text-primary" />
                            <span className="fw-semibold">
                              {existingImages.length + newImages.length} image
                              {existingImages.length + newImages.length === 1
                                ? ""
                                : "s"}
                            </span>
                          </div>
                          <div className="d-flex flex-wrap gap-2">
                            {existingImages.map((url) => (
                              <div
                                key={url}
                                className="border rounded position-relative"
                                style={{ width: 132, padding: 4 }}
                              >
                                <img
                                  src={url}
                                  alt="Saved banner"
                                  className="rounded"
                                  style={{
                                    width: "100%",
                                    height: 84,
                                    objectFit: "cover",
                                  }}
                                />
                                <Button
                                  size="sm"
                                  variant="danger"
                                  className="position-absolute d-flex align-items-center justify-content-center p-0"
                                  style={{
                                    top: -8,
                                    right: -8,
                                    width: 22,
                                    height: 22,
                                    borderRadius: "50%",
                                  }}
                                  onClick={() => removeExistingImage(url)}
                                  title="Remove this image"
                                >
                                  <FaTimes size={10} />
                                </Button>
                              </div>
                            ))}
                            {newImages.map((file, i) => (
                              <div
                                key={`${file.name}-${i}`}
                                className="border rounded position-relative"
                                style={{ width: 132, padding: 4 }}
                              >
                                <img
                                  src={URL.createObjectURL(file)}
                                  alt={file.name}
                                  className="rounded"
                                  style={{
                                    width: "100%",
                                    height: 84,
                                    objectFit: "cover",
                                  }}
                                />
                                <Button
                                  size="sm"
                                  variant="danger"
                                  className="position-absolute d-flex align-items-center justify-content-center p-0"
                                  style={{
                                    top: -8,
                                    right: -8,
                                    width: 22,
                                    height: 22,
                                    borderRadius: "50%",
                                  }}
                                  onClick={() => removeNewImage(i)}
                                  title="Remove this image"
                                >
                                  <FaTimes size={10} />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </Form.Group>
                     </Col>
                   </Row>

                <Row>
                     <Col md={12}>
                    <Form.Group className="mb-3">
                      <Form.Label>Description</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={4}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Enter offer description (optional)"
                      />
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
