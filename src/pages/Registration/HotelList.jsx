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
  Form,
  Pagination,
  Modal,
} from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import {
  FaPlus,
  FaHotel,
  FaMapMarkerAlt,
  FaStar,
  FaEye,
  FaEdit,
  FaTrash,
  FaSearch,
  FaExclamationTriangle,
} from "react-icons/fa";
import "../../styles/HotelList.css";

const HotelList = () => {
  const [filteredHotels, setFilteredHotels] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [hotelToDelete, setHotelToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [pageSize] = useState(20);
  const [totalElements, setTotalElements] = useState(0);

  const navigate = useNavigate();

  // Load hotels from API with pagination
  const loadHotels = async (page = 0, search = searchTerm) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
      });

      if (search.trim()) {
        params.append("search", search.trim());
      }

      const response = await axiosInstance.get(
        `/api/hotels?${params.toString()}`,
        {
          timeout: 0,
        },
      );

      console.log("Hotels response:", response.data);

      // Handle both array response and paginated object response
      if (Array.isArray(response.data)) {
        setFilteredHotels(response.data);
        // Fallback pagination logic if backend doesn't provide totalElements
        if (response.data.length < pageSize) {
          setTotalPages(page + 1);
        } else {
          setTotalPages(Math.max(totalPages, page + 2));
        }
      } else if (response.data && response.data.content) {
        setFilteredHotels(response.data.content);
        setTotalPages(response.data.totalPages || 0);
        setTotalElements(response.data.totalElements || 0);
      }

      setCurrentPage(page);
      setError(null);
    } catch (error) {
      console.error("Error loading hotels:", error);
      setError("Failed to load hotels");
      toast.error("Failed to load hotels");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle search input change
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    // Reset to first page on search
    loadHotels(0, value);
  };

  // Load hotels on component mount
  useEffect(() => {
    loadHotels();
  }, []);

  // Handle create new hotel
  const handleCreateHotel = () => {
    navigate("/registration/hotel/create");
  };

  // Handle view hotel details
  const handleViewHotel = (hotelId) => {
    navigate(`/hotel-details/${hotelId}`);
  };

  // Handle edit hotel
  const handleEditHotel = (hotelId) => {
    navigate(`/registration/hotel/create/${hotelId}`);
  };

  // Trigger delete confirmation modal
  const confirmDelete = (hotelId) => {
    setHotelToDelete(hotelId);
    setShowDeleteModal(true);
  };

  // Handle delete hotel
  const handleDeleteHotel = async () => {
    if (!hotelToDelete) return;

    try {
      setIsDeleting(true);
      const response = await axiosInstance.delete(`/api/hotels/${hotelToDelete}`);

      console.log("Hotel deleted:", response.data);

      // ✅ Show success toast (use backend message)
      toast.success(response.data || "Hotel deleted successfully");

      // ✅ Remove deleted hotel from UI instantly
      setFilteredHotels((prevHotels) =>
        prevHotels.filter((hotel) => hotel.id !== hotelToDelete),
      );

      // ✅ Optional: update totalElements (if pagination used)
      setTotalElements((prev) => prev - 1);
      setShowDeleteModal(false);
      setHotelToDelete(null);
    } catch (error) {
      console.error("Error while deleting hotel:", error);
      toast.error("Failed to delete hotel");
    } finally {
      setIsDeleting(false);
    }
  };

  // Get star rating display
  const getStarRating = (hotelCategoryId) => {
    // This would typically come from your hotel categories API
    // For now, showing a placeholder
    return "⭐⭐⭐⭐⭐";
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
            {/* Header Section */}
            <div className="d-flex justify-content-between align-items-center mb-4">
              <div>
                <h2 className="text-primary mb-1">
                  <FaHotel className="me-2" />
                  Hotel Management
                </h2>
                <p className="text-muted mb-0">
                  Manage your hotel listings and details
                </p>
              </div>
              <div className="d-flex gap-2">
                <Button
                  variant="success"
                  onClick={handleCreateHotel}
                  className="d-flex align-items-center gap-2 px-4 py-2 rounded-pill shadow"
                >
                  <FaPlus />
                  Create New Hotel
                </Button>
              </div>
            </div>

            {/* Content Section */}
            <Card className="shadow-lg border-0 rounded-4">
              <Card.Header className="bg-gradient-primary text-white border-0 rounded-top-4">
                <div className="d-flex align-items-center justify-content-between">
                  {/* LEFT: Title */}
                  <h4 className="mb-0 d-flex align-items-center">
                    <FaHotel className="me-2" />
                    Hotel List
                  </h4>

                  {/* RIGHT: Search + Badge */}
                  <div className="d-flex align-items-center gap-3">
                    {/* <Badge bg="light" text="dark" className="fs-6 px-3 py-2">
        {filteredHotels.length} Hotel{filteredHotels.length !== 1 ? "s" : ""}
        {searchTerm && (
          <span className="ms-2 text-muted">
            (filtered from {hotels.length})
          </span>
        )}
      </Badge> */}

                    <div className="search-wrapper">
                      <i className="bi bi-search search-icon"></i>
                      <input
                        type="text"
                        placeholder="Search hotel names..."
                        value={searchTerm}
                        onChange={handleSearchChange}
                        className="modern-search-input"
                      />
                    </div>
                  </div>
                </div>
              </Card.Header>
              <Card.Body className="p-4">
                {isLoading ? (
                  <div className="text-center py-5">
                    <Spinner animation="border" variant="primary" size="lg" />
                    <p className="mt-3 text-muted">Loading hotels...</p>
                  </div>
                ) : error ? (
                  <Alert variant="danger" className="text-center">
                    <FaHotel className="me-2" />
                    {error}
                    <Button
                      variant="outline-danger"
                      className="ms-3"
                      onClick={loadHotels}
                    >
                      Retry
                    </Button>
                  </Alert>
                ) : filteredHotels.length === 0 ? (
                  <div className="text-center py-5">
                    <FaHotel size={64} className="mb-3 text-muted opacity-50" />
                    <h5 className="mb-2 text-muted">
                      {searchTerm ? "No Hotels Found" : "No Hotels Found"}
                    </h5>
                    <p className="text-muted mb-4">
                      {searchTerm
                        ? `No hotels found matching "${searchTerm}". Try a different search term.`
                        : "Start by creating your first hotel."}
                    </p>
                    {searchTerm ? (
                      <Button
                        variant="outline-primary"
                        onClick={() => {
                          setSearchTerm("");
                          loadHotels(0, "");
                        }}
                        className="d-flex align-items-center gap-2 mx-auto px-4 py-2 rounded-pill"
                      >
                        <FaSearch />
                        Clear Search
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        onClick={handleCreateHotel}
                        className="d-flex align-items-center gap-2 mx-auto px-4 py-2 rounded-pill"
                      >
                        <FaPlus />
                        Create First Hotel
                      </Button>
                    )}
                  </div>
                ) : (
                  <Row>
                    {filteredHotels.map((hotel) => (
                      <Col key={hotel.id} lg={4} md={6} className="mb-4">
                        <Card
                          className="h-100 shadow-sm border-0 rounded-4 hotel-card"
                          style={{ cursor: "pointer" }}
                          onClick={() => handleViewHotel(hotel.id)}
                        >
                          <div className="position-relative">
                            <Card.Img
                              variant="top"
                              src={
                                hotel.image360 || "/images/not-available.jpg"
                              }
                              alt={hotel.hotelName}
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
                              <Badge bg="success" className="px-3 py-2">
                                {getStarRating(hotel.hotelCategoryId)}
                              </Badge>
                            </div>
                          </div>

                          <Card.Body className="d-flex flex-column">
                            <div className="mb-0">
                              <h5 className="card-title text-primary mb-2">
                                <FaHotel className="me-2" />
                                {hotel.hotelName}
                              </h5>
                              <p className="text-muted small mb-2">
                                <FaMapMarkerAlt className="me-1" />
                                {hotel.address}
                              </p>
                              <p className="text-muted small mb-0">
                                ZIP: {hotel.zipcode}
                              </p>
                            </div>

                            <div className="mt-1">
                              <div className="d-flex gap-2">
                                <Button
                                  variant="outline-primary"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewHotel(hotel.id);
                                  }}
                                  className="flex-fill rounded-pill"
                                >
                                  <FaEye className="me-1" />
                                  View
                                </Button>
                                <Button
                                  variant="outline-warning"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditHotel(hotel.id);
                                  }}
                                  className="flex-fill rounded-pill"
                                >
                                  <FaEdit className="me-1" />
                                  Edit
                                </Button>
                                <Button
                                  variant="outline-danger"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    confirmDelete(hotel.id);
                                  }}
                                  className="flex-fill rounded-pill"
                                >
                                  <FaTrash className="me-1" />
                                  Delete
                                </Button>
                              </div>
                            </div>
                          </Card.Body>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                )}

                {/* Pagination Controls */}
                {!isLoading &&
                  !error &&
                  (totalPages > 1 || totalElements > pageSize) && (
                    <div className="d-flex justify-content-between align-items-center mt-4 pt-3 border-top">
                      <div className="text-muted small">
                        Showing {filteredHotels.length} hotels
                        {totalElements > 0 && ` of ${totalElements}`}
                      </div>
                      <Pagination className="mb-0 custom-pagination">
                        <Pagination.Prev
                          disabled={currentPage === 0}
                          onClick={() => loadHotels(currentPage - 1)}
                        />
                        {[...Array(totalPages).keys()].map((num) => (
                          <Pagination.Item
                            key={num}
                            active={num === currentPage}
                            onClick={() => loadHotels(num)}
                          >
                            {num + 1}
                          </Pagination.Item>
                        ))}
                        <Pagination.Next
                          disabled={currentPage >= totalPages - 1}
                          onClick={() => loadHotels(currentPage + 1)}
                        />
                      </Pagination>
                    </div>
                  )}
              </Card.Body>
            </Card>
          </Container>
        </main>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        show={showDeleteModal}
        onHide={() => !isDeleting && setShowDeleteModal(false)}
        centered
      >
        <Modal.Header closeButton className="border-0">
          <Modal.Title className="text-danger h5 d-flex align-items-center">
            <FaExclamationTriangle className="me-2" /> Confirm Deletion
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="py-0">
          <p className="mb-0">Are u sure u want delete this hotel</p>
        </Modal.Body>
        <Modal.Footer className="border-0">
          <Button
            variant="light"
            onClick={() => setShowDeleteModal(false)}
            disabled={isDeleting}
            className="rounded-pill px-4"
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDeleteHotel}
            disabled={isDeleting}
            className="rounded-pill px-4"
          >
            {isDeleting ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Deleting...
              </>
            ) : (
              "Yes"
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default HotelList;
