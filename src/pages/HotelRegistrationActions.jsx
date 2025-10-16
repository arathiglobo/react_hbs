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
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [editingImage, setEditingImage] = useState(null);

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
    // { id: "gallery", label: "Gallery", icon: FaImages },
    // { id: "360-view", label: "360 degree view", icon: FaEye },
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
    // { label: "Image Upload", icon: FaImage, status: "count", count: 0 },
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
                <div className="row">
                  {/* Left Column - Image */}
                  <div className="col-md-6">
                    <div className="hotel-image-container">
                      {hotelData.image360 ? (
                        <img
                          src={hotelData.image360}
                          alt={hotelData.hotelName}
                          className="hotel-main-image"
                          style={{ 
                            width: "120%", 
                            height: "300px", 
                            objectFit: "cover",
                            borderRadius: "8px",
                            boxShadow: "0 4px 8px rgba(0,0,0,0.1)"
                          }}
                          onError={(e) => {
                            e.target.style.display = "none";
                            e.target.nextSibling.style.display = "flex";
                          }}
                        />
                      ) : null}
                      <div
                        className="no-image-placeholder"
                        style={{ 
                          display: hotelData.image360 ? "none" : "flex",
                          width: "130%",
                          height: "300px",
                          borderRadius: "8px"
                        }}
                      >
                        <FaImages className="placeholder-icon" />
                        <p>NO IMAGE AVAILABLE</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Right Column - Hotel Info */}
                  <div className="col-md-6">
                    <div className="hotel-info">
                      {/* Hotel Name */}
                      <h3 className="hotel-name mb-3">{hotelData.hotelName}</h3>
                      
                      {/* Hotel Address */}
                      <div className="hotel-location mb-4">
                        <FaMapMarkerAlt className="location-icon" />
                        <span>{hotelData.address}</span>
                      </div>
                      
                      {/* Overview */}
                      <div className="hotel-overview mb-4">
                        <h5>Overview</h5>
                        <p className="overview-text">
                          {hotelData.hotelDescription || "No description available"}
                        </p>
                      </div>
                      
                      {/* Amenities */}
                      <div className="amenities-section">
                        <h5 className="mb-3">Amenities</h5>
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
                </div>
              </div>
            </div>
          </div>
        );
      // case "gallery":
      //   return (
      //     <div>
      //       <h4 className="mb-3">Gallery</h4>
      //       <div className="no-image-placeholder">
      //         <FaImages className="placeholder-icon" />
      //         <p>NO IMAGE AVAILABLE</p>
      //       </div>
      //     </div>
      //   );
      // case "360-view":
      //   return (
      //     <div>
      //       <h4 className="mb-3">360 Degree View</h4>
      //       <div className="no-image-placeholder">
      //         <FaEye className="placeholder-icon" />
      //         <p>NO 360° VIEW AVAILABLE</p>
      //       </div>
      //     </div>
      //   );
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
    } 
    
    // else if (actionLabel === "Image Upload") {
    //    handleImageUploadClick();
    // } 
    
    else if (actionLabel === "Occupancy & Minimum length") {
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
    const file = event.target.files[0]; // Get only the first file
    
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast.error("Please select only image files");
      return;
    }
    
    // Clear previous selection and set new single file
    setSelectedFiles([file]);
  };

  // const handleImageUpload = async () => {
  //   if (selectedFiles.length === 0) {
  //     toast.error("Please select an image to upload");
  //     return;
  //   }

  //   // Only allow single image upload based on DTO structure
  //   if (selectedFiles.length > 1) {
  //     toast.error("Please select only one image at a time");
  //     return;
  //   }

  //   setIsUploading(true);
  //   try {
  //     const formData = new FormData();
  //     const file = selectedFiles[0]; // Get the first (and only) file
      
  //     // Match backend DTO structure
  //     formData.append('image1', file);
    
  //     const response = await axiosInstance.post(`/api/hotelInventory/imageUpload/${id}/save`, formData, {
  //       headers: {
  //         'Content-Type': 'multipart/form-data',
  //       },
  //     });

  //     if (response.data) {
  //       toast.success("Image uploaded successfully!");
  //       // Add the uploaded image to the list
  //       setUploadedImages(prev => [...prev, {
  //         id: response.data.id,
  //         hotelId: response.data.hotelId,
  //         image1Path: response.data.image1Path,
  //         name: file.name
  //       }]);
  //       setSelectedFiles([]);
  //       // setShowImageUploadModal(false);
  //     }
  //   } catch (error) {
  //     console.error("Error uploading image:", error);
  //     toast.error("Failed to upload image");
  //   } finally {
  //     setIsUploading(false);
  //   }
  // };

  const removeSelectedFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

 
  // const handleImageUploadClick = () => {
  //   setShowImageUploadModal(true);
  //   fetchUploadedImages();
  // };

  // Fetch all uploaded images
  // const fetchUploadedImages = async () => {
  //   try {
  //     setIsLoadingImages(true);
  //     const response = await axiosInstance.get(`/api/hotelInventory/imageUpload/${id}/list`);
  //     setUploadedImages(response.data || []);
  //   } catch (error) {
  //     console.error("Error fetching images:", error);
  //     // toast.error("Failed to load images");
  //   } finally {
  //     setIsLoadingImages(false);
  //   }
  // };

  // Delete image
  // const handleDeleteImage = async (imageId) => {
  //   if (!window.confirm("Are you sure you want to delete this image?")) return;
    
  //   try {
  //     await axiosInstance.delete(`/api/hotelInventory/imageUpload/${id}/${imageId}`);
  //     toast.success("Image deleted successfully!");
  //     fetchUploadedImages(); // Refresh the list
  //   } catch (error) {
  //     console.error("Error deleting image:", error);
  //     toast.error("Failed to delete image");
  //   }
  // };

  // Update image
  // const handleUpdateImage = async () => {
  //   if (selectedFiles.length === 0) {
  //     toast.error("Please select a new image to replace the existing one");
  //     return;
  //   }

  //   setIsUploading(true);
  //   try {
  //     const formData = new FormData();
  //     const file = selectedFiles[0];
      
  //     formData.append('image1', file);
     
  //     const response = await axiosInstance.put(`/api/hotelInventory/imageUpload/${id}/${editingImage.id}`, formData, {
  //       headers: {
  //         'Content-Type': 'multipart/form-data',
  //       },
  //     });

  //     if (response.data) {
  //       toast.success("Image updated successfully!");
  //       setEditingImage(null);
  //       setSelectedFiles([]);
  //       fetchUploadedImages(); // Refresh the list
  //     }
  //   } catch (error) {
  //     console.error("Error updating image:", error);
  //     toast.error("Failed to update image");
  //   } finally {
  //     setIsUploading(false);
  //   }
  // };

  // Cancel edit
  const handleCancelEdit = () => {
    setEditingImage(null);
    setSelectedFiles([]);
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
                                  // action.label === "Image Upload" ||
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

        {/* Image Upload Modal - Currently Disabled */}
    </div>
  );
};

export default HotelRegistrationActions;
