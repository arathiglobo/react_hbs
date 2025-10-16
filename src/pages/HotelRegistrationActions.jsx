import React, { useState, useEffect } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Badge,
  Button,
  Spinner,
  Alert,
  Modal,
  Form,
  Table,
} from "react-bootstrap";
import { useParams, useNavigate } from "react-router-dom";
import {
  FaArrowLeft,
  FaUser,
  FaPhone,
  FaEnvelope,
  FaMobile,
  FaCheck,
  FaAt,
  FaArrowRight,
  FaUsers,
  FaBullhorn,
  FaMoneyBill,
  FaGift,
  FaFileAlt,
  FaCheckSquare,
  FaImage,
  FaEdit,
  FaExclamationTriangle,
  FaBed,
  FaImages,
  FaEye,
  FaUnlink,
  FaCreditCard,
  FaFileContract,
  FaCog,
  FaMapMarkerAlt,
  FaStar,
  FaSwimmingPool,
  FaUtensils,
  FaSpa,
  FaWifi,
  FaHotel,
} from "react-icons/fa";
import axiosInstance from "../components/AxiosInstance";
import { toast } from "react-hot-toast";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/TopBar";
import "../styles/HotelRegistrationActions.css";

const HotelRegistrationActions = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("basic-details");
  const [hotelData, setHotelData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal states
  const [showMailCenterModal, setShowMailCenterModal] = useState(false);
  const [showLoginDetailsModal, setShowLoginDetailsModal] = useState(false);
  const [showImageUploadModal, setShowImageUploadModal] = useState(false);
  const [mailCenterData, setMailCenterData] = useState([]);
  
  // Image upload states
  const [uploadedImages, setUploadedImages] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  console.log("hotel complete data::", hotelData);

  // Mail Center data
  useEffect(() => {
    if (hotelData?.contactDetails) {
      console.log("hotelData contact details::", hotelData.contactDetails);
      const formattedData = hotelData.contactDetails.map((item) => ({
        id: item.id,
        userType: "Hotel Contact", // you can change this dynamically if needed
        username: item.contactPerson || "N/A",
        contactNumber: item.mobileNumber || item.teleNumber || "N/A",
        mailId: item.personalEmail || "N/A",
        mailType: item.mailTyIds || "N/A",
      }));
      setMailCenterData(formattedData);
    }
  }, [hotelData]);

  // Login Details form data
  const [loginFormData, setLoginFormData] = useState({
    username: "",
    password: "",
    repassword: "",
  });

  const navigationTabs = [
    { id: "basic-details", label: "Basic details", icon: FaUser },
    { id: "gallery", label: "Gallery", icon: FaImages },
    { id: "360-view", label: "360 degree view", icon: FaEye },
    { id: "contact-details", label: "Contact details", icon: FaPhone },
    { id: "bank-details", label: "Bank details", icon: FaCreditCard },
    { id: "room-details", label: "Room details", icon: FaBed },
    {
      id: "terms-conditions",
      label: "Terms and Conditions",
      icon: FaFileContract,
    },
  ];

  const actions = [
    { label: "Mail center", icon: FaAt, status: "success", count: null },
    {
      label: "Login Details",
      icon: FaArrowRight,
      status: "success",
      count: null,
    },
    {
      label: "Occupancy & Minimum length",
      icon: FaUsers,
      status: "count",
      count: 0,
    },
    {
      label: "Hotel Availability",
      icon: FaBullhorn,
      status: "count",
      count: 0,
    },
    { label: "Contract Rate", icon: FaMoneyBill, status: "count", count: 0 },
    { label: "Promotion", icon: FaGift, status: "count", count: 0 },
    { label: "Policy", icon: FaFileAlt, status: "count", count: 0 },
    {
      label: "Compulsory Events",
      icon: FaCheckSquare,
      status: "count",
      count: 0,
    },
    { label: "Image Upload", icon: FaImage, status: "count", count: 0 },
    { label: "Hotel Edit", icon: FaEdit, status: "none", count: null },
    {
      label: "Validity Periods",
      icon: FaExclamationTriangle,
      status: "none",
      count: null,
    },
    { label: "Book Hotel", icon: FaBed, status: "none", count: null },
  ];

  // Fetch hotel data
  useEffect(() => {
    const fetchHotelData = async () => {
      try {
        setIsLoading(true);
        const response = await axiosInstance.get(`/api/hotels/${id}`);
        setHotelData(response.data);
        console.log("Hotel Data:", response.data);
        setError(null);
      } catch (error) {
        console.error("Error fetching hotel data:", error);
        setError("Failed to load hotel details");
        toast.error("Failed to load hotel details");
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchHotelData();
    }
  }, [id]);

  const getAmenityIcon = (amenityId) => {
    const iconMap = {
      1: FaSwimmingPool,
      2: FaUtensils,
      3: FaSpa,
      4: FaSpa,
      5: FaWifi,
      6: FaCog,
      7: FaCog,
      8: FaCog,
    };
    return iconMap[amenityId] || FaCheck;
  };

  const renderContent = () => {
    if (!hotelData) return null;

    switch (activeTab) {
      case "basic-details":
        return (
          <div>
            <h4 className="mb-3">Basic Details</h4>
            <div className="hotel-basic-info">
              <div className="hotel-image-section mb-4">
                <div className="hotel-image-container">
                  {hotelData.image360 ? (
                    <img
                      src={hotelData.image360}
                      alt={hotelData.hotelName}
                      className="hotel-main-image"
                      onError={(e) => {
                        e.target.style.display = "none";
                        e.target.nextSibling.style.display = "flex";
                      }}
                    />
                  ) : null}
                  <div
                    className="no-image-placeholder"
                    style={{ display: hotelData.image360 ? "none" : "flex" }}
                  >
                    <FaImages className="placeholder-icon" />
                    <p>NO IMAGE AVAILABLE</p>
                  </div>
                </div>
                <div className="hotel-info">
                  <h3 className="hotel-name">{hotelData.hotelName}</h3>
                  <div className="hotel-location">
                    <FaMapMarkerAlt className="location-icon" />
                    <span>{hotelData.address}</span>
                  </div>
                  <div className="hotel-rating">
                    <FaStar className="star-icon" />
                    <FaStar className="star-icon" />
                  </div>
                </div>
              </div>

              <div className="hotel-overview mb-4">
                <h5>Overview</h5>
                <p className="overview-text">
                  {hotelData.hotelDescription || "No description available"}
                </p>
              </div>

              <div className="amenities-section">
                <h5>Amenities</h5>
                <div className="amenities-grid">
                  {hotelData.amenities &&
                    hotelData.amenities.map((amenity) => {
                      const IconComponent = getAmenityIcon(amenity.amenityId);
                      return (
                        <div key={amenity.amenityId} className="amenity-item">
                          <IconComponent className="amenity-icon" />
                          <span>{amenity.amenityName}</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        );
      case "gallery":
        return (
          <div>
            <h4 className="mb-3">Gallery</h4>
            <div className="no-image-placeholder">
              <FaImages className="placeholder-icon" />
              <p>NO IMAGE AVAILABLE</p>
            </div>
          </div>
        );
      case "360-view":
        return (
          <div>
            <h4 className="mb-3">360 Degree View</h4>
            <div className="no-image-placeholder">
              <FaEye className="placeholder-icon" />
              <p>NO 360° VIEW AVAILABLE</p>
            </div>
          </div>
        );
      case "contact-details":
        return (
          <div>
            <h4 className="mb-3">Contact Details</h4>
            {hotelData.contactDetails && hotelData.contactDetails.length > 0 ? (
              hotelData.contactDetails.map((contact, index) => (
                <div key={index}>
                  <div className="contact-item">
                    <FaUser className="contact-icon" />
                    <span>{contact.contactPerson}</span>
                  </div>
                  <div className="contact-item">
                    <FaPhone className="contact-icon" />
                    <span>{contact.teleNumber}</span>
                  </div>
                  <div className="contact-item">
                    <FaEnvelope className="contact-icon" />
                    <span>{contact.personalEmail}</span>
                  </div>
                  <div className="contact-item">
                    <FaMobile className="contact-icon" />
                    <span>{contact.mobileNumber}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted">No contact details available</p>
            )}
          </div>
        );
      case "bank-details":
        return (
          <div>
            <h4 className="mb-3">Bank Details</h4>
            {hotelData.bankDetails && hotelData.bankDetails.length > 0 ? (
              hotelData.bankDetails.map((bank, index) => (
                <div key={index}>
                  <div className="content-item">
                    <strong>Account Number:</strong> {bank.accountNo}
                  </div>
                  <div className="content-item">
                    <strong>IBAN:</strong> {bank.iban}
                  </div>
                  <div className="content-item">
                    <strong>SWIFT Code:</strong> {bank.swiftCode}
                  </div>
                  <div className="content-item">
                    <strong>Bank Address:</strong> {bank.bankAddress}
                  </div>
                  <div className="content-item">
                    <strong>Telephone:</strong> {bank.telephone}
                  </div>
                  <div className="content-item">
                    <strong>Fax Number:</strong> {bank.faxNumber}
                  </div>
                  <div className="content-item">
                    <strong>Contact Person:</strong> {bank.contactPerson}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted">No bank details available</p>
            )}
          </div>
        );
      case "room-details":
        return (
          <div>
            <h4 className="mb-3">Room Details</h4>
            {hotelData.roomCategories && hotelData.roomCategories.length > 0 ? (
              hotelData.roomCategories.map(
                (room, index) => (
                  console.log("room::##", room),
                  (
                    <div key={index} className="room-item">
                      <div className="content-item">
                        <strong>Room Name:</strong> {room.name}
                      </div>
                      {/* <div className="content-item">
                    <strong>Room Category ID:</strong> {room.roomCategoryId}
                  </div>
                  <div className="content-item">
                    <strong>Room Type ID:</strong> {room.roomTypeId}
                  </div> */}
                      <div className="content-item">
                        <strong>Status:</strong>
                        <Badge
                          bg={room.isDeleted ? "danger" : "success"}
                          className="ms-2"
                        >
                          {room.isDeleted ? "Deleted" : "Active"}
                        </Badge>
                      </div>
                      <hr />
                    </div>
                  )
                )
              )
            ) : (
              <p className="text-muted">No room details available</p>
            )}
          </div>
        );
      case "terms-conditions":
        return (
          <div>
            <h4 className="mb-3">Terms and Conditions</h4>
            {hotelData.termsAndConditions &&
            hotelData.termsAndConditions.length > 0 ? (
              hotelData.termsAndConditions.map((term, index) => (
                <div key={index} className="content-item">
                  <FaCheck className="check-icon" />
                  <span>{term.description}</span>
                </div>
              ))
            ) : (
              <p className="text-muted">No terms and conditions available</p>
            )}
          </div>
        );
      default:
        return <div>Select a tab to view details</div>;
    }
  };

  const getStatusIcon = (action) => {
    if (action.status === "success") {
      return <FaCheck className="status-icon success" />;
    } else if (action.status === "count") {
      return (
        <Badge
          bg={action.count > 0 ? "success" : "danger"}
          className="status-badge"
        >
          {action.count}
        </Badge>
      );
    }
    return null;
  };

  // Modal handlers
  const handleActionClick = (actionLabel) => {
    if (actionLabel === "Mail center") {
      setShowMailCenterModal(true);
    } else if (actionLabel === "Login Details") {
      setShowLoginDetailsModal(true);
    } else if (actionLabel === "Image Upload") {
      handleImageUploadClick();
    } else if (actionLabel === "Occupancy & Minimum length") {
      navigate(`/hotel-actions/${id}/occupancy-and-minimumlength`);
    } else if (actionLabel === "Hotel Edit") {
      navigate(`/registration/hotel/create/${id}`);
    } else if (actionLabel === "Compulsory Events") {
      navigate(`/registration/hotel/${id}/compulsory-events`);
    } else if (actionLabel === "Hotel Availability") {
      navigate(`/hotel-actions/${id}/hotel-availability`);
    } else if (actionLabel === "Validity Periods") {
      navigate(`/hotel-actions/${id}/validity-period-details`);
    }
  };

  const handleMailTypeChange = (id, newMailType) => {
    setMailCenterData((prevData) =>
      prevData.map((item) =>
        item.id === id ? { ...item, mailType: newMailType } : item
      )
    );
  };

  const handleLoginFormChange = (field, value) => {
    setLoginFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleLoginSave = () => {
    if (loginFormData.password !== loginFormData.repassword) {
      toast.error("Passwords do not match!");
      return;
    }
    if (!loginFormData.username || !loginFormData.password) {
      toast.error("Please fill in all fields!");
      return;
    }
    // Here you would typically save to API
    toast.success("Login details saved successfully!");
    setShowLoginDetailsModal(false);
    setLoginFormData({ username: "", password: "", repassword: "" });
  };

  const handleLoginCancel = () => {
    setShowLoginDetailsModal(false);
    setLoginFormData({ username: "", password: "", repassword: "" });
  };

  // Image upload handlers
  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length !== files.length) {
      toast.error("Please select only image files");
    }
    
    setSelectedFiles(prev => [...prev, ...imageFiles]);
  };

  const handleImageUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error("Please select images to upload");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      selectedFiles.forEach((file, index) => {
        formData.append(`images`, file);
      });
      formData.append('hotelId', id);

      const response = await axiosInstance.post('/api/hotel/images/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data) {
        toast.success(`${selectedFiles.length} image(s) uploaded successfully!`);
        setUploadedImages(prev => [...prev, ...response.data]);
        setSelectedFiles([]);
        setShowImageUploadModal(false);
      }
    } catch (error) {
      console.error("Error uploading images:", error);
      toast.error("Failed to upload images");
    } finally {
      setIsUploading(false);
    }
  };

  const removeSelectedFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeUploadedImage = (index) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleImageUploadClick = () => {
    setShowImageUploadModal(true);
    // Load existing images if any
    if (hotelData?.images) {
      setUploadedImages(hotelData.images);
    }
  };

  if (isLoading) {
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
          <main className="flex-grow-1 d-flex justify-content-center align-items-center">
            <div className="text-center">
              <Spinner animation="border" variant="primary" size="lg" />
              <p className="mt-3 text-muted">Loading hotel details...</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (error) {
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
          <main className="flex-grow-1 d-flex justify-content-center align-items-center">
            <Alert variant="danger" className="text-center">
              <FaHotel className="me-2" />
              {error}
              <Button
                variant="outline-danger"
                className="ms-3"
                onClick={() => window.location.reload()}
              >
                Retry
              </Button>
            </Alert>
          </main>
        </div>
      </div>
    );
  }

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
              <div className="d-flex align-items-center">
                <Button
                  variant="outline-primary"
                  className="back-button btn-sm d-flex align-items-center gap-2"
                  onClick={() => navigate(`/registration/hotel`)}
                >
                  <FaArrowLeft /> Back
                </Button>
                <h1 className="page-title ms-3 mb-0">View Hotel</h1>
              </div>
            </div>

            {/* Horizontal Navigation Tabs */}
            <div className="horizontal-tabs mb-4">
              <div className="nav nav-tabs" role="tablist">
                {navigationTabs.map((tab) => (
                  <button
                    key={tab.id}
                    className={`nav-link ${
                      activeTab === tab.id ? "active" : ""
                    }`}
                    onClick={() => setActiveTab(tab.id)}
                    type="button"
                    role="tab"
                  >
                    <tab.icon className="me-2" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Main Content Area with Actions */}
            <div className="main-content-area">
              <Card className="content-card">
                <Card.Body className="p-0">
                  <Row className="h-100">
                    {/* Left Content Panel */}
                    <Col md={8} className="content-panel">
                      <div className="content-wrapper">{renderContent()}</div>
                    </Col>

                    {/* Right Actions Panel */}
                    <Col md={4} className="actions-panel">
                      <div className="actions-wrapper">
                        <div className="actions-header">
                          <h5 className="mb-0">Actions</h5>
                        </div>
                        <div className="actions-list">
                          {actions.map((action, index) => (
                            <div
                              key={index}
                              className="action-item"
                              onClick={() => handleActionClick(action.label)}
                              style={{
                                cursor:
                                  action.label === "Mail center" ||
                                  action.label === "Login Details" ||
                                  action.label === "Image Upload" ||
                                  action.label === "Hotel Edit"
                                    ? "pointer"
                                    : "default",
                              }}
                            >
                              <div className="action-content">
                                <action.icon className="action-icon" />
                                <span className="action-label">
                                  {action.label}
                                </span>
                              </div>
                              {getStatusIcon(action)}
                            </div>
                          ))}
                        </div>
                      </div>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            </div>
          </Container>
        </main>
      </div>

      {/* Mail Center Modal */}
      <Modal
        show={showMailCenterModal}
        onHide={() => setShowMailCenterModal(false)}
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <FaAt className="me-2" />
            Mail Center
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Table responsive striped hover>
            <thead>
              <tr>
                <th>User Type</th>
                <th>Username</th>
                <th>Contact Number</th>
                <th>Mail ID</th>
                <th>Mail Type</th>
              </tr>
            </thead>
            <tbody>
              {mailCenterData.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Form.Control
                      type="text"
                      value={item.userType}
                      readOnly
                      className="border-0 bg-transparent"
                    />
                  </td>
                  <td>
                    <Form.Control
                      type="text"
                      value={item.username}
                      readOnly
                      className="border-0 bg-transparent"
                    />
                  </td>
                  <td>
                    <Form.Control
                      type="text"
                      value={item.contactNumber}
                      readOnly
                      className="border-0 bg-transparent"
                    />
                  </td>
                  <td>
                    <Form.Control
                      type="text"
                      value={item.mailId}
                      readOnly
                      className="border-0 bg-transparent"
                    />
                  </td>
                  <td>
                    <Form.Select
                      value={item.mailType}
                      onChange={(e) =>
                        handleMailTypeChange(item.id, e.target.value)
                      }
                      size="sm"
                    >
                      <option value="login credentials">
                        Login Credentials
                      </option>
                      <option value="voucher">Voucher</option>
                    </Form.Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowMailCenterModal(false)}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Login Details Modal */}
      <Modal show={showLoginDetailsModal} onHide={handleLoginCancel} size="md">
        <Modal.Header closeButton>
          <Modal.Title>
            <FaArrowRight className="me-2" />
            Login Details
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Username</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter username"
                value={loginFormData.username}
                onChange={(e) =>
                  handleLoginFormChange("username", e.target.value)
                }
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Password</Form.Label>
              <Form.Control
                type="password"
                placeholder="Enter password"
                value={loginFormData.password}
                onChange={(e) =>
                  handleLoginFormChange("password", e.target.value)
                }
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Re-enter Password</Form.Label>
              <Form.Control
                type="password"
                placeholder="Re-enter password"
                value={loginFormData.repassword}
                onChange={(e) =>
                  handleLoginFormChange("repassword", e.target.value)
                }
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleLoginCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleLoginSave}>
            Save
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Image Upload Modal */}
      <Modal
        show={showImageUploadModal}
        onHide={() => setShowImageUploadModal(false)}
        size="xl"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <FaImage className="me-2" />
            Image Upload
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="row">
            {/* Upload Section */}
            <div className="col-md-6">
              <h5 className="mb-3">Upload New Images</h5>
              <div className="upload-area border-2 border-dashed border-primary rounded p-4 text-center mb-3">
                <FaImage size={48} className="text-primary mb-3" />
                <h6>Drop images here or click to browse</h6>
                <p className="text-muted small">Supports JPG, PNG, GIF formats</p>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="d-none"
                  id="image-upload-input"
                />
                <label htmlFor="image-upload-input" className="btn btn-primary">
                  Choose Images
                </label>
              </div>

              {/* Selected Files Preview */}
              {selectedFiles.length > 0 && (
                <div className="selected-files">
                  <h6 className="mb-2">Selected Files ({selectedFiles.length})</h6>
                  <div className="row">
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="col-md-6 mb-2">
                        <div className="card">
                          <div className="card-body p-2">
                            <div className="d-flex align-items-center">
                              <img
                                src={URL.createObjectURL(file)}
                                alt={file.name}
                                className="img-thumbnail me-2"
                                style={{ width: "50px", height: "50px", objectFit: "cover" }}
                              />
                              <div className="flex-grow-1">
                                <small className="text-truncate d-block">{file.name}</small>
                                <small className="text-muted">
                                  {(file.size / 1024 / 1024).toFixed(2)} MB
                                </small>
                              </div>
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => removeSelectedFile(index)}
                                className="ms-2"
                              >
                                ×
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Uploaded Images Section */}
            <div className="col-md-6">
              <h5 className="mb-3">Uploaded Images ({uploadedImages.length})</h5>
              {uploadedImages.length > 0 ? (
                <div className="uploaded-images">
                  <div className="row">
                    {uploadedImages.map((image, index) => (
                      <div key={index} className="col-md-6 mb-2">
                        <div className="card">
                          <div className="card-body p-2">
                            <div className="d-flex align-items-center">
                              <img
                                src={image.url || image}
                                alt={`Uploaded ${index + 1}`}
                                className="img-thumbnail me-2"
                                style={{ width: "50px", height: "50px", objectFit: "cover" }}
                                onError={(e) => {
                                  e.target.src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHZpZXdCb3g9IjAgMCA1MCA1MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiBmaWxsPSIjRjVGNUY1Ii8+CjxwYXRoIGQ9Ik0yMCAyMEgzMFYzMEgyMFYyMFoiIGZpbGw9IiNDQ0NDQ0MiLz4KPC9zdmc+";
                                }}
                              />
                              <div className="flex-grow-1">
                                <small className="text-truncate d-block">
                                  {image.name || `Image ${index + 1}`}
                                </small>
                                <small className="text-muted">Uploaded</small>
                              </div>
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => removeUploadedImage(index)}
                                className="ms-2"
                              >
                                ×
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted py-4">
                  <FaImages size={48} className="mb-2" />
                  <p>No images uploaded yet</p>
                </div>
              )}
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowImageUploadModal(false)}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleImageUpload}
            disabled={selectedFiles.length === 0 || isUploading}
          >
            {isUploading ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Uploading...
              </>
            ) : (
              `Upload ${selectedFiles.length} Image(s)`
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default HotelRegistrationActions;
