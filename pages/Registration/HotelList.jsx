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
  FaTrash
} from "react-icons/fa";

const HotelList = () => {
  const [hotels, setHotels] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Load hotels from API
  const loadHotels = async () => {
    try {
      setIsLoading(true);
      const response = await axiosInstance.get("/api/hotels");
      console.log("Hotels response:", response.data);
      setHotels(response.data || []);
      setError(null);
    } catch (error) {
      console.error("Error loading hotels:", error);
      setError("Failed to load hotels");
      toast.error("Failed to load hotels");
    } finally {
      setIsLoading(false);
    }
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
    // You can implement view functionality here
    console.log("View hotel:", hotelId);
  };

  // Handle edit hotel
  const handleEditHotel = (hotelId) => {
    // You can implement edit functionality here
    console.log("Edit hotel:", hotelId);
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
                <div className="d-flex justify-content-between align-items-center">
                  <h4 className="mb-0">
                    <FaHotel className="me-2" />
                    Hotel List
                  </h4>
                  <Badge bg="light" text="dark" className="fs-6 px-3 py-2">
                    {hotels.length} Hotel{hotels.length !== 1 ? 's' : ''}
                  </Badge>
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
                ) : hotels.length === 0 ? (
                  <div className="text-center py-5">
                    <FaHotel size={64} className="mb-3 text-muted opacity-50" />
                    <h5 className="mb-2 text-muted">No Hotels Found</h5>
                    <p className="text-muted mb-4">Start by creating your first hotel.</p>
                    <Button
                      variant="primary"
                      onClick={handleCreateHotel}
                      className="d-flex align-items-center gap-2 mx-auto px-4 py-2 rounded-pill"
                    >
                      <FaPlus />
                      Create First Hotel
                    </Button>
                  </div>
                ) : (
                  <Row>
                    {hotels.map((hotel) => (
                      <Col key={hotel.id} lg={4} md={6} className="mb-4">
                        <Card className="h-100 shadow-sm border-0 rounded-4 hotel-card">
                          <div className="position-relative">
                            <Card.Img
                              variant="top"
                              src={hotel.image360 || "/images/not-available.jpg"}
                              alt={hotel.hotelName}
                              style={{
                                height: '200px',
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
                            <div className="mb-3">
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

                            <div className="mt-auto">
                              <div className="d-flex justify-content-between align-items-center mb-3">
                                <div>
                                  <small className="text-muted">Category ID: {hotel.hotelCategoryId}</small>
                                  <br />
                                  <small className="text-muted">Type ID: {hotel.hotelTypeId}</small>
                                </div>
                                <div className="text-end">
                                  <small className="text-muted">Currency ID: {hotel.hotelCurrencyId}</small>
                                  <br />
                                  <small className="text-muted">Markup ID: {hotel.markupTypeId}</small>
                                </div>
                              </div>

                              <div className="d-flex gap-2">
                                <Button
                                  variant="outline-primary"
                                  size="sm"
                                  onClick={() => handleViewHotel(hotel.id)}
                                  className="flex-fill rounded-pill"
                                >
                                  <FaEye className="me-1" />
                                  View
                                </Button>
                                <Button
                                  variant="outline-warning"
                                  size="sm"
                                  onClick={() => handleEditHotel(hotel.id)}
                                  className="flex-fill rounded-pill"
                                >
                                  <FaEdit className="me-1" />
                                  Edit
                                </Button>
                                <Button
                                  variant="outline-danger"
                                  size="sm"
                                  onClick={() => handleDeleteHotel(hotel.id)}
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
