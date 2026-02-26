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
  FaSearch
} from "react-icons/fa";
import "../../styles/HotelList.css"

const HotelList = () => {
  const [hotels, setHotels] = useState([]);
  const [filteredHotels, setFilteredHotels] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  // Load hotels from API
  const loadHotels = async () => {
    try {
      setIsLoading(true);
      const response = await axiosInstance.get("/api/hotels");
      console.log("Hotels response:", response.data);
      const hotelsData = response.data || [];
      setHotels(hotelsData);
      setFilteredHotels(hotelsData);
      setError(null);
    } catch (error) {
      console.error("Error loading hotels:", error);
      setError("Failed to load hotels");
      toast.error("Failed to load hotels");
    } finally {
      setIsLoading(false);
    }
  };

  // Filter hotels based on search term
  const filterHotels = (searchValue) => {
    if (!searchValue.trim()) {
      setFilteredHotels(hotels);
    } else {
      const filtered = hotels.filter(hotel =>
        hotel.hotelName.toLowerCase().includes(searchValue.toLowerCase())
      );
      setFilteredHotels(filtered);
    }
  };

  // Handle search input change
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    filterHotels(value);
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

  // Handle delete hotel
  const handleDeleteHotel = (hotelId) => {
    // You can implement delete functionality here
    console.log("Delete hotel:", hotelId);
  };

  // Get star rating display
  const getStarRating = (hotelCategoryId) => {
    // This would typically come from your hotel categories API
    // For now, showing a placeholder
    return "⭐⭐⭐⭐⭐";
  };

  return (
    <div className="min-vh-100 bg-gradient-light d-flex flex-column" style={{
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
    }}>
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
                <p className="text-muted mb-0">Manage your hotel listings and details</p>
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
                        : "Start by creating your first hotel."
                      }
                    </p>
                    {searchTerm ? (
                      <Button
                        variant="outline-primary"
                        onClick={() => {
                          setSearchTerm("");
                          setFilteredHotels(hotels);
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
                              src={hotel.image360 || "/images/not-available.jpg"}
                              alt={hotel.hotelName}
                              style={{
                                height: '170px',
                                objectFit: 'cover',
                                borderRadius: '1rem 1rem 0 0'
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
                                    handleDeleteHotel(hotel.id);
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
              </Card.Body>
            </Card>
          </Container>
        </main>
      </div>
    </div>
  );
};

export default HotelList;