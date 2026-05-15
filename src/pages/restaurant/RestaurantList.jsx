import React, { useEffect, useState } from "react";
import {
  Card,
  Button,
  Row,
  Col,
  Container,
  Badge,
  Spinner,
  Alert,
  Pagination,
  Modal,
} from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import {
  FaPlus,
  FaUtensils,
  FaMapMarkerAlt,
  FaClock,
  FaEye,
  FaEdit,
  FaTrash,
  FaSearch,
  FaExclamationTriangle,
  FaPhone,
  FaStar,
  FaRupeeSign,
} from "react-icons/fa";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import "../../styles/HotelList.css";

const PAGE_SIZE = 12;

/**
 * Restaurant list — card-grid layout that mirrors HotelList.jsx so the two
 * registration entry points feel consistent.
 *
 * Each card surfaces image, name, location, contact, open–close hours and
 * cuisine chips with View / Edit / Delete actions. Header has a search box
 * and a "+ New Restaurant" button that opens /restaurant/register.
 */
const RestaurantList = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axiosInstance.get("/api/restaurant/list");
      const data = Array.isArray(res.data) ? res.data : res.data?.content || [];
      setItems(data);
      setFiltered(data);
    } catch (e) {
      console.error(e);
      setError("Failed to load restaurants.");
      setItems([]);
      setFiltered([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Local filter — list is small enough that we filter client-side.
  useEffect(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      setFiltered(items);
    } else {
      setFiltered(
        items.filter(
          (r) =>
            r.restaurantName?.toLowerCase().includes(q) ||
            r.place?.toLowerCase().includes(q) ||
            r.email?.toLowerCase().includes(q) ||
            (r.cuisineTypes || []).join(",").toLowerCase().includes(q)
        )
      );
    }
    setPage(0);
  }, [search, items]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleCreate = () => navigate("/restaurant/register");
  const handleView = (id) => navigate(`/restaurant/view/${id}`);
  const handleEdit = (id) => navigate(`/restaurant/edit/${id}`);

  const confirmDelete = (r) => setToDelete(r);

  const doDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await axiosInstance.delete(`/api/restaurant/${toDelete.id}`);
      toast.success("Restaurant deleted");
      setToDelete(null);
      load();
    } catch (e) {
      toast.error("Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="min-vh-100 bg-gradient-light d-flex flex-column"
      style={{
        background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
      }}
    >
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Container fluid>
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center mb-4">
              <div>
                <h2 className="text-primary mb-1">
                  <FaUtensils className="me-2" />
                  Restaurant Management
                </h2>
                <p className="text-muted mb-0">
                  Manage your restaurant listings and details
                </p>
              </div>
              <div className="d-flex gap-2">
                <Button
                  variant="success"
                  onClick={handleCreate}
                  className="d-flex align-items-center gap-2 px-4 py-2 rounded-pill shadow"
                >
                  <FaPlus />
                  Create New Restaurant
                </Button>
              </div>
            </div>

            {/* Card */}
            <Card className="shadow-lg border-0 rounded-4">
              <Card.Header className="bg-gradient-primary text-white border-0 rounded-top-4">
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                  <h4 className="mb-0 d-flex align-items-center">
                    <FaUtensils className="me-2" />
                    Restaurant List
                  </h4>
                  <div className="d-flex align-items-center gap-3">
                    <Badge bg="light" text="dark" className="fs-6 px-3 py-2">
                      {filtered.length} Restaurant{filtered.length !== 1 ? "s" : ""}
                      {search && (
                        <span className="ms-2 text-muted">
                          (filtered from {items.length})
                        </span>
                      )}
                    </Badge>
                    <div className="search-wrapper">
                      <i className="bi bi-search search-icon"></i>
                      <input
                        type="text"
                        placeholder="Search by name, place, cuisine..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="modern-search-input"
                      />
                    </div>
                  </div>
                </div>
              </Card.Header>

              <Card.Body className="p-4">
                {loading ? (
                  <div className="text-center py-5">
                    <Spinner animation="border" variant="primary" />
                    <p className="mt-3 text-muted">Loading restaurants...</p>
                  </div>
                ) : error ? (
                  <Alert variant="danger" className="text-center">
                    <FaExclamationTriangle className="me-2" />
                    {error}
                    <Button variant="outline-danger" className="ms-3" onClick={load}>
                      Retry
                    </Button>
                  </Alert>
                ) : pageData.length === 0 ? (
                  <div className="text-center py-5">
                    <FaUtensils size={64} className="mb-3 text-muted opacity-50" />
                    <h5 className="mb-2 text-muted">
                      {search ? "No Restaurants Found" : "No Restaurants Yet"}
                    </h5>
                    <p className="text-muted mb-4">
                      {search
                        ? `No restaurants match "${search}". Try a different search.`
                        : "Start by creating your first restaurant."}
                    </p>
                    {search ? (
                      <Button
                        variant="outline-primary"
                        onClick={() => setSearch("")}
                        className="d-flex align-items-center gap-2 mx-auto px-4 py-2 rounded-pill"
                      >
                        <FaSearch /> Clear Search
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        onClick={handleCreate}
                        className="d-flex align-items-center gap-2 mx-auto px-4 py-2 rounded-pill"
                      >
                        <FaPlus /> Create First Restaurant
                      </Button>
                    )}
                  </div>
                ) : (
                  <Row>
                    {pageData.map((r) => (
                      <Col key={r.id} lg={4} md={6} className="mb-4">
                        <Card
                          className="h-100 shadow-sm border-0 rounded-4 hotel-card"
                          style={{ cursor: "pointer" }}
                          onClick={() => handleView(r.id)}
                        >
                          <div className="position-relative">
                            <Card.Img
                              variant="top"
                              src={r.images?.[0] || "/images/not-available.jpg"}
                              alt={r.restaurantName}
                              style={{
                                height: "170px",
                                objectFit: "cover",
                                borderRadius: "1rem 1rem 0 0",
                              }}
                              onError={(e) => {
                                e.target.src = "/images/not-available.jpg";
                              }}
                            />
                            <div className="position-absolute top-0 end-0 m-3">
                              <Badge
                                bg={r.status === "Active" ? "success" : "secondary"}
                                className="px-3 py-2"
                              >
                                {r.status || "Active"}
                              </Badge>
                            </div>
                            {r.rating != null && (
                              <div className="position-absolute top-0 start-0 m-3">
                                <Badge bg="warning" text="dark" className="px-2 py-2">
                                  <FaStar className="me-1" />
                                  {Number(r.rating).toFixed(1)}
                                </Badge>
                              </div>
                            )}
                          </div>

                          <Card.Body className="d-flex flex-column">
                            <div className="mb-2">
                              <h5 className="card-title text-primary mb-2 d-flex align-items-center">
                                <FaUtensils className="me-2" />
                                {r.restaurantName}
                              </h5>
                              <p className="text-muted small mb-1">
                                <FaMapMarkerAlt className="me-1 text-danger" />
                                {r.place}
                                {r.address ? ` · ${truncate(r.address, 40)}` : ""}
                              </p>
                              <p className="text-muted small mb-1">
                                <FaPhone className="me-1 text-success" />
                                {r.contactNumber || "-"}
                              </p>
                              <p className="text-muted small mb-2">
                                <FaClock className="me-1 text-info" />
                                {fmtTime(r.openTime)} - {fmtTime(r.closeTime)}
                              </p>
                              <div className="mb-1 d-flex flex-wrap gap-1">
                                {(r.cuisineTypes || []).slice(0, 3).map((c) => (
                                  <Badge key={c} bg="light" text="dark" className="border">
                                    {c}
                                  </Badge>
                                ))}
                                {r.cuisineTypes?.length > 3 && (
                                  <Badge bg="secondary">+{r.cuisineTypes.length - 3}</Badge>
                                )}
                              </div>
                              {r.averageCostForTwo > 0 && (
                                <small className="text-muted">
                                  <FaRupeeSign className="me-1" />
                                  {r.averageCostForTwo} for two (approx.)
                                </small>
                              )}
                            </div>

                            <div className="mt-auto">
                              <div className="d-flex gap-2">
                                <Button
                                  variant="outline-primary"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleView(r.id);
                                  }}
                                  className="flex-fill rounded-pill"
                                >
                                  <FaEye className="me-1" /> View
                                </Button>
                                <Button
                                  variant="outline-warning"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEdit(r.id);
                                  }}
                                  className="flex-fill rounded-pill"
                                >
                                  <FaEdit className="me-1" /> Edit
                                </Button>
                                <Button
                                  variant="outline-danger"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    confirmDelete(r);
                                  }}
                                  className="flex-fill rounded-pill"
                                >
                                  <FaTrash className="me-1" /> Delete
                                </Button>
                              </div>
                            </div>
                          </Card.Body>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                )}

                {!loading && !error && totalPages > 1 && (
                  <div className="d-flex justify-content-between align-items-center mt-4 pt-3 border-top">
                    <div className="text-muted small">
                      Showing {pageData.length} of {filtered.length}
                    </div>
                    <Pagination className="mb-0 custom-pagination">
                      <Pagination.Prev
                        disabled={page === 0}
                        onClick={() => setPage((p) => p - 1)}
                      />
                      {[...Array(totalPages).keys()].map((n) => (
                        <Pagination.Item
                          key={n}
                          active={n === page}
                          onClick={() => setPage(n)}
                        >
                          {n + 1}
                        </Pagination.Item>
                      ))}
                      <Pagination.Next
                        disabled={page >= totalPages - 1}
                        onClick={() => setPage((p) => p + 1)}
                      />
                    </Pagination>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Container>
        </main>
      </div>

      <Modal show={!!toDelete} onHide={() => !deleting && setToDelete(null)} centered>
        <Modal.Header closeButton={!deleting}>
          <Modal.Title>
            <FaExclamationTriangle className="text-danger me-2" />
            Delete Restaurant
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Are you sure you want to delete <strong>{toDelete?.restaurantName}</strong>?
          <br />
          <small className="text-muted">This action cannot be undone.</small>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-secondary"
            disabled={deleting}
            onClick={() => setToDelete(null)}
          >
            Cancel
          </Button>
          <Button variant="danger" disabled={deleting} onClick={doDelete}>
            {deleting ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" />
                Deleting...
              </>
            ) : (
              "Delete"
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

const fmtTime = (t) => (t ? String(t).slice(0, 5) : "");
const truncate = (s, n) => (s && s.length > n ? s.slice(0, n - 1) + "…" : s || "");

export default RestaurantList;
