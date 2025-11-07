import React, { useState, useEffect } from "react";
import { Navbar, Container, Nav, Dropdown, Image, Button, Modal, Badge, Card, Row, Col, Spinner } from "react-bootstrap";
import { FaKey, FaUser, FaSignOutAlt, FaShoppingCart, FaTrash, FaCalendarAlt, FaUsers, FaBed, FaMapMarkerAlt } from "react-icons/fa";
import axiosInstance from "./AxiosInstance";

export default function TopBar() {
  const [showCartModal, setShowCartModal] = useState(false);
  const [cartItems, setCartItems] = useState([]);
  const [cartLoading, setCartLoading] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  const handleLogout = () => {
    // Remove specific items
    localStorage.removeItem("authToken");
    localStorage.removeItem("userRole");
    localStorage.removeItem("UserName");
    localStorage.removeItem("currentActiveRole");

    // Optionally redirect to login page
    window.location.href = "/";
  };

  // Fetch cart data from redis
  const fetchCartData = async () => {
    // try {
    //   setCartLoading(true);
    //    const response = await axiosInstance.get("/api/cart/get");
      
    //   if (response.data && response.data.items) {
    //     setCartItems(response.data.items || []);
    //     setCartCount(response.data.items?.length || 0);
    //   } else {
    //     setCartItems([]);
    //     setCartCount(0);
    //   }
    // } catch (err) {
    //   console.error("Error fetching cart:", err);
    //   setCartItems([]);
    //   setCartCount(0);
    // } finally {
    //   setCartLoading(false);
    // }
  };

  // Remove item from cart
  const handleRemoveFromCart = async (itemId) => {
    try {
      const response = await axiosInstance.delete(`/api/cart/remove/${itemId}`);
      if (response.data && response.data.success !== false) {
        // Refresh cart data
        fetchCartData();
      } else {
        alert(response.data?.message || "Failed to remove item from cart");
      }
    } catch (err) {
      console.error("Error removing from cart:", err);
      alert("Failed to remove item from cart. Please try again.");
    }
  };

  // Handle cart modal open
  const handleCartClick = () => {
    setShowCartModal(true);
    fetchCartData();
  };

  // Listen for cart updates
  useEffect(() => {
    const handleCartUpdate = () => {
      fetchCartData();
    };

    window.addEventListener('cartUpdated', handleCartUpdate);
    
    // Initial fetch
    fetchCartData();

    return () => {
      window.removeEventListener('cartUpdated', handleCartUpdate);
    };
  }, []);

  return (
    <Navbar bg="white" className="topbar shadow-sm" expand="lg" sticky="top">
      <Container fluid className="px-3">
        <Navbar.Brand href="#" className="d-flex align-items-center gap-2">
          <div className="logo-placeholder">GS</div>
          <span className="fw-semibold">Globosoft</span>
        </Navbar.Brand>
        <Nav className="ms-auto d-flex align-items-center gap-3">
          <Button
            variant="link"
            className="position-relative text-dark text-decoration-none p-0"
            onClick={handleCartClick}
            style={{ border: "none", background: "none" }}
          >
            <FaShoppingCart size={20} />
            {cartCount > 0 && (
              <Badge
                bg="danger"
                className="position-absolute top-0 start-100 translate-middle rounded-pill"
                style={{ fontSize: "0.65rem", padding: "2px 6px" }}
              >
                {cartCount}
              </Badge>
            )}
          </Button>
          <Dropdown align="end">
            <Dropdown.Toggle as={ProfileToggle} id="profile-dropdown" />
            <Dropdown.Menu className="shadow-sm">
              <Dropdown.Item href="change-password">
                <FaKey className="me-2" />
                Change Password
              </Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item href="view-profile">
                <FaUser className="me-2" />
                View Profile
              </Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item onClick={handleLogout}>
                <FaSignOutAlt className="me-2" />
                Logout
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </Nav>
      </Container>

      {/* Cart Modal */}
      <Modal
        show={showCartModal}
        onHide={() => setShowCartModal(false)}
        size="lg"
        centered
        backdrop="static"
        keyboard={false}
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <FaShoppingCart className="me-2" />
            Shopping Cart {cartCount > 0 && `(${cartCount})`}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: "70vh", overflowY: "auto" }}>
          {cartLoading ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="primary" />
              <p className="mt-3 text-muted">Loading cart items...</p>
            </div>
          ) : cartItems.length === 0 ? (
            <div className="text-center py-5">
              <FaShoppingCart size={48} className="text-muted mb-3" />
              <h5 className="text-muted">Your cart is empty</h5>
              <p className="text-muted">Add rooms or cabs or activities to your cart to see them here.</p>
            </div>
          ) : (
            <div className="d-flex flex-column gap-3">
              {cartItems.map((item, index) => (
                <Card key={index} className="shadow-sm">
                  <Card.Body>
                    <Row>
                      <Col md={8}>
                        <h6 className="fw-bold mb-2">{item.hotelName || "Hotel Name"}</h6>
                        {item.hotelAddress && (
                          <p className="text-muted small mb-2">
                            <FaMapMarkerAlt className="me-1" />
                            {item.hotelAddress}
                          </p>
                        )}
                        <div className="d-flex flex-wrap gap-3 mb-2 small">
                          {item.checkInDate && (
                            <div>
                              <FaCalendarAlt className="me-1 text-muted" />
                              <strong>Check-in:</strong> {item.checkInDate}
                            </div>
                          )}
                          {item.checkOutDate && (
                            <div>
                              <FaCalendarAlt className="me-1 text-muted" />
                              <strong>Check-out:</strong> {item.checkOutDate}
                            </div>
                          )}
                        </div>
                        <div className="d-flex flex-wrap gap-3 mb-2 small">
                          {item.roomCategory && (
                            <div>
                              <FaBed className="me-1 text-muted" />
                              <strong>Room:</strong> {item.roomCategory}
                            </div>
                          )}
                          {item.mealPlan && (
                            <div>
                              <strong>Meal:</strong> {item.mealPlan}
                            </div>
                          )}
                        </div>
                        {item.guestBreakdown && (
                          <div className="small mb-2">
                            <FaUsers className="me-1 text-muted" />
                            <strong>Guests:</strong> {item.guestBreakdown}
                          </div>
                        )}
                      </Col>
                      <Col md={4} className="text-end">
                        <div className="mb-3">
                          <h5 className="text-primary mb-0">
                            {item.totalRate ? `${item.currency || "AED"} ${item.totalRate.toLocaleString()}` : "Price on request"}
                          </h5>
                          {item.nonRefundable && (
                            <Badge bg={item.nonRefundable === "true" ? "danger" : "success"} className="mt-2">
                              {item.nonRefundable === "true" ? "Non-Refundable" : "Refundable"}
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => handleRemoveFromCart(item.id || index)}
                        >
                          <FaTrash className="me-1" />
                          Remove
                        </Button>
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>
              ))}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <div className="d-flex justify-content-between w-100 align-items-center">
            <div>
              <strong>Total Items:</strong> {cartCount}
            </div>
            <div>
              <Button
                variant="secondary"
                onClick={() => setShowCartModal(false)}
                className="me-2"
              >
                Close
              </Button>
              {cartItems.length > 0 && (
                <Button variant="primary">
                  Proceed to Checkout
                </Button>
              )}
            </div>
          </div>
        </Modal.Footer>
      </Modal>
    </Navbar>
  );
}

const ProfileToggle = React.forwardRef(({ onClick }, ref) => {
  const [userName, setUserName] = React.useState("");
  
  React.useEffect(() => {
    const updateUserName = () => {
      const name = localStorage.getItem("UserName") || sessionStorage.getItem("UserName") || "";
      setUserName(name);
    };
    
    // Initial load
    updateUserName();
    
    // Listen for storage changes (in case username is updated in another tab)
    window.addEventListener("storage", updateUserName);
    
    return () => {
      window.removeEventListener("storage", updateUserName);
    };
  }, []);
  
  return (
    <a
      href="#profile"
      ref={ref}
      onClick={(e) => {
        e.preventDefault();
        onClick(e);
      }}
      className="d-flex align-items-center gap-2 text-decoration-none profile-toggle"
    >
      <Image roundedCircle width={34} height={34} src={avatarUrl} alt="profile" />
      <span className="d-none d-sm-inline text-dark">
        {userName ? `Hi ${userName}` : "Profile"}
      </span>
    </a>
  );
});

// Placeholder avatar for the logged-in agent
const avatarUrl = "https://i.pravatar.cc/100?img=12";
