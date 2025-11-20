import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Navbar,
  Container,
  Nav,
  Dropdown,
  Image,
  Button,
  Modal,
  Badge,
  Card,
  Row,
  Col,
  Spinner,
} from "react-bootstrap";
import {
  FaKey,
  FaUser,
  FaSignOutAlt,
  FaShoppingCart,
  FaTrash,
  FaCalendarAlt,
  FaUsers,
  FaBed,
  FaMapMarkerAlt,
  FaTicketAlt,
  FaChild,
} from "react-icons/fa";
import axiosInstance from "./AxiosInstance";
import { toast } from "react-hot-toast";

export default function TopBar() {
  const navigate = useNavigate();
  const [showCartModal, setShowCartModal] = useState(false);
  const [cartItems, setCartItems] = useState([]);
  const [cartLoading, setCartLoading] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  const getCartAgentId = () =>
    sessionStorage.getItem("makeYourOwnPackageAgentId") ||
    localStorage.getItem("makeYourOwnPackageAgentId") ||
    "";

  const getCartKey = (item) => {
    if (!item) return "";
    return (
      item.cartKey ||
      item.id ||
      item.key ||
      item.activity?.cartKey ||
      item.activity?.id ||
      item.activity?.activityId ||
      item.hotel?.cartKey ||
      item.cab?.cartKey ||
      ""
    );
  };

  const renderActivityItem = (item, key) => {
    const activity = item.activity;
    if (!activity) return null;

    return (
      <Card key={key} className="shadow-sm">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-start mb-2">
            <div>
              <Badge bg="info" className="mb-2">
                Activity
              </Badge>
              <h6 className="fw-bold mb-2">
                {activity.activityName || "Activity"}
              </h6>
            </div>
            <Button
              variant="outline-danger"
              size="sm"
              onClick={() => handleRemoveFromCart(item)}
            >
              <FaTrash className="me-1" /> Remove
            </Button>
          </div>

          <Row className="g-2 small text-muted">
            <Col sm={6} className="d-flex align-items-center">
              <FaTicketAlt className="me-2 text-primary" />
              <span>
                <strong>Date:</strong> {activity.activityDate || "-"}
              </span>
            </Col>
            <Col sm={6} className="d-flex align-items-center">
              <FaUsers className="me-2 text-success" />
              <span>
                <strong>Adults:</strong> {activity.adult ?? "-"}
              </span>
            </Col>
            <Col sm={6} className="d-flex align-items-center">
              <FaChild className="me-2 text-warning" />
              <span>
                <strong>Children:</strong> {activity.child ?? "-"}
              </span>
            </Col>
            <Col sm={6} className="d-flex align-items-center">
              <FaMapMarkerAlt className="me-2 text-danger" />
              <span>
                <strong>Country ID:</strong> {activity.nativeCountryId || "-"}
              </span>
            </Col>
          </Row>

          {Array.isArray(activity.childAge) && activity.childAge.length > 0 && (
            <div className="mt-2 small text-muted">
              <strong>Child Ages:</strong> {activity.childAge.join(", ")}
            </div>
          )}
        </Card.Body>
      </Card>
    );
  };

  const renderHotelItem = (item, key) => {
    console.log("renderHotelItem:::", item);
    const hotel = item.hotel || {};
    const meta = hotel.meta || {};
    const details = hotel.details || {};

    // Get values from hotel or details
    const hotelName = hotel.hotelName || "Hotel";
    const hotelAddress = hotel.hotelAddress || details.hotelAddress || "";
    const checkIn = hotel.checkIn || details.checkInDate || details.checkIn || "";
    const checkOut = hotel.checkOut || details.checkOutDate || details.checkOut || "";
    const roomCategory = hotel.roomCategory || details.roomCategory || "";
    const roomType = hotel.roomType || details.mealPlan || "";
    const adult = hotel.adult || details.adult || "";
    const child = hotel.child || details.child || "";
    
    // Handle childAges - could be array or string
    let childAges = [];
    if (hotel.childAge) {
      childAges = Array.isArray(hotel.childAge) ? hotel.childAge : [hotel.childAge];
    } else if (hotel.childAges) {
      childAges = Array.isArray(hotel.childAges) ? hotel.childAges : [hotel.childAges];
    } else if (details.childAge) {
      childAges = Array.isArray(details.childAge) ? details.childAge : [details.childAge];
    } else if (details.childAges) {
      childAges = Array.isArray(details.childAges) ? details.childAges : [details.childAges];
    }

    return (
      <Card key={key} className="shadow-sm">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-start mb-2">
            <div>
              <Badge bg="primary" className="mb-2">
                Hotel
              </Badge>
              <h6 className="fw-bold mb-2">
                {hotelName}
              </h6>
            </div>
            <Button
              variant="outline-danger"
              size="sm"
              onClick={() => handleRemoveFromCart(item)}
            >
              <FaTrash className="me-1" /> Remove
            </Button>
          </div>

          <Row className="g-2 small text-muted">
            {hotelAddress && (
              <Col sm={6} className="d-flex align-items-center">
                <FaMapMarkerAlt className="me-2 text-danger" />
                <span>
                  <strong>Address:</strong> {hotelAddress}
                </span>
              </Col>
            )}
            {checkIn && (
              <Col sm={6} className="d-flex align-items-center">
                <FaCalendarAlt className="me-2 text-primary" />
                <span>
                  <strong>Check-in:</strong> {checkIn}
                </span>
              </Col>
            )}
            {checkOut && (
              <Col sm={6} className="d-flex align-items-center">
                <FaCalendarAlt className="me-2 text-primary" />
                <span>
                  <strong>Check-out:</strong> {checkOut}
                </span>
              </Col>
            )}
            {roomCategory && (
              <Col sm={6} className="d-flex align-items-center">
                <FaBed className="me-2 text-success" />
                <span>
                  <strong>Room:</strong> {roomCategory}
                </span>
              </Col>
            )}
            {roomType && (
              <Col sm={6} className="d-flex align-items-center">
                <span>
                  <strong>Meal Plan:</strong> {roomType}
                </span>
              </Col>
            )}
            {adult && (
              <Col sm={6} className="d-flex align-items-center">
                <FaUsers className="me-2 text-success" />
                <span>
                  <strong>Adults:</strong> {adult}
                </span>
              </Col>
            )}
            {child && (
              <Col sm={6} className="d-flex align-items-center">
                <FaChild className="me-2 text-warning" />
                <span>
                  <strong>Children:</strong> {child}
                </span>
              </Col>
            )}
          </Row>

          {childAges.length > 0 && (
            <div className="mt-2 small text-muted">
              <strong>Child Ages:</strong> {childAges.join(", ")}
            </div>
          )}
        </Card.Body>
      </Card>
    );
  };

  const renderCabItem = (item, key) => {
    const cab = item.cab || {};
    return (
      <Card key={key} className="shadow-sm">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-start mb-2">
            <div>
              <Badge bg="secondary" className="mb-2">
                Transfer
              </Badge>
              <h6 className="fw-bold mb-2">{cab.vehicleName || "Transfer"}</h6>
            </div>
            <Button
              variant="outline-danger"
              size="sm"
              onClick={() => handleRemoveFromCart(item)}
            >
              <FaTrash className="me-1" /> Remove
            </Button>
          </div>

          <Row className="g-2 small text-muted">
            {cab.pickupLocation && (
              <Col sm={6} className="d-flex align-items-center">
                <FaMapMarkerAlt className="me-2 text-primary" />
                <span>
                  <strong>Pickup:</strong> {cab.pickupLocation}
                </span>
              </Col>
            )}
            {cab.dropoffLocation && (
              <Col sm={6} className="d-flex align-items-center">
                <FaMapMarkerAlt className="me-2 text-success" />
                <span>
                  <strong>Dropoff:</strong> {cab.dropoffLocation}
                </span>
              </Col>
            )}
            {cab.capacity && (
              <Col sm={6} className="d-flex align-items-center">
                <FaUsers className="me-2 text-warning" />
                <span>
                  <strong>Capacity:</strong> {cab.capacity}
                </span>
              </Col>
            )}
          </Row>
        </Card.Body>
      </Card>
    );
  };

  const renderCartItem = (item, index) => {
    const key =
      getCartKey(item) ||
      item.activity?.activityId ||
      item.hotel?.hotelId ||
      item.cab?.cabId ||
      `cart-item-${index}`;

    if (item.activity) return renderActivityItem(item, key);
    if (item.hotel) return renderHotelItem(item, key);
    if (item.cab) return renderCabItem(item, key);
    return null;
  };

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
    try {
      setCartLoading(true);
      const agentId = getCartAgentId();

      if (!agentId) {
        setCartItems([]);
        setCartCount(0);
        return;
      }

      const response = await axiosInstance.post(
        `/api/makeYourOwnPackage/fetchDataFromRedis?userId=${encodeURIComponent(
          agentId
        )}`
      );

      if (Array.isArray(response.data)) {
        setCartItems(response.data || []);
        setCartCount(response.data.length);
      } else {
        setCartItems([]);
        setCartCount(0);
      }
    } catch (err) {
      console.error("Error fetching cart:", err);
      setCartItems([]);
      setCartCount(0);
      toast.error("Failed to load cart items. Please try again.");
    } finally {
      setCartLoading(false);
    }
  };

  // Remove item from cart
  const handleRemoveFromCart = async (item) => {
    try {
      const agentId = getCartAgentId();

      if (!agentId) {
        toast.error("Select an agent before modifying the cart.");
        return;
      }

      const cartKey = getCartKey(item);

      if (!cartKey) {
        toast.error("Unable to identify the selected cart item.");
        return;
      }

      const response = await axiosInstance.post(
        "/api/makeYourOwnPackage/deleteFromCart",
        null,
        {
          params: {
            agentId: agentId,
            cartKey: cartKey,
          },
        }
      );
      console.log("Response:", response.data);
      if (response.data === 1) {
        toast.success("Item removed from cart.");
        fetchCartData();
        // let nextCart = [];
        // setCartItems((prev) => {
        //   nextCart = prev.filter(
        //     (cartItem) => getCartKey(cartItem) !== cartKey
        //   );
        //   return nextCart;
        // });
        // setCartCount(nextCart.length);

        // Ensure UI stays in sync with backend state
        // await fetchCartData();
      } else {
        toast.error("Failed to remove item from cart.");
      }
    } catch (err) {
      console.error("Error removing from cart:", err);
      toast.error("Failed to remove item from cart. Please try again.");
    }
  };

  // Clear all items from cart
  const handleClearCart = async () => {
    try {
      const agentId = getCartAgentId();

      if (!agentId) {
        toast.error("Select an agent before modifying the cart.");
        return;
      }

      if (cartItems.length === 0) {
        toast.info("Cart is already empty.");
        return;
      }

      const response = await axiosInstance.post(
        "/api/makeYourOwnPackage/clearFromCart",
        null,
        {
          params: {
            agentId: agentId,
          },
        }
      );
      
      console.log("Clear cart response:", response.data);
      
      if (response.data === 1 || response.data === true || response.data?.success === true) {
        toast.success("Cart cleared successfully.");
        fetchCartData();
      } else {
        toast.error("Failed to clear cart.");
      }
    } catch (err) {
      console.error("Error clearing cart:", err);
      toast.error("Failed to clear cart. Please try again.");
    }
  };

  // Handle cart modal open
  const handleCartClick = () => {
    fetchCartData();
    setShowCartModal(true);
  };

  const handleContinueBooking = async () => {
    try {
      const agentId = getCartAgentId();
      if (!agentId) {
        toast.error("Select an agent before proceeding to checkout.");
        return;
      }

      // Fetch latest cart data before navigating
      const response = await axiosInstance.post(
        `/api/makeYourOwnPackage/fetchDataFromRedis?userId=${encodeURIComponent(
          agentId
        )}`
      );

      if (Array.isArray(response.data) && response.data.length > 0) {
        // Store cart data in sessionStorage for the booking page
        sessionStorage.setItem("makePkgCartData", JSON.stringify(response.data));
        sessionStorage.setItem("makePkgAgentId", agentId);
       window.open("/new-booking/make-your-own-package/booking-page");
      } else {
        toast.error("Your cart is empty. Please add items to cart first.");
      }
    } catch (err) {
      console.error("Error fetching cart data:", err);
      toast.error("Failed to load cart data. Please try again.");
    }
  };

  // Listen for cart updates
  useEffect(() => {
    const handleCartUpdate = () => {
      fetchCartData();
    };

    window.addEventListener("cartUpdated", handleCartUpdate);

    // Initial fetch
    // fetchCartData();

    return () => {
      window.removeEventListener("cartUpdated", handleCartUpdate);
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
              <p className="text-muted">
                Add rooms or cabs or activities to your cart to see them here.
              </p>
            </div>
          ) : (
            <div className="d-flex flex-column gap-3">
              {cartItems.map((item, index) => renderCartItem(item, index))}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <div className="d-flex justify-content-between w-100 align-items-center">
            <div>
              {cartItems.length > 0 && (
                <Button
                  variant="outline-danger"
                  onClick={handleClearCart}
                  className="me-2"
                >
                  Clear
                </Button>
              )}
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
                <Button
                  variant="outline-success continue-booking"
                  onClick={handleContinueBooking}
                >
                  Proceed to Checkout
                </Button>
              )}
               {cartItems.length > 0 && (
                <Button
                  variant="outline-primary generate-quotation"
                  // onClick={handleQuotationBooking}
                >
                  Generate Quotation
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
      const name =
        localStorage.getItem("UserName") ||
        sessionStorage.getItem("UserName") ||
        "";
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
      <Image
        roundedCircle
        width={34}
        height={34}
        src={avatarUrl}
        alt="profile"
      />
      <span className="d-none d-sm-inline text-dark">
        {userName ? `Hi ${userName}` : "Profile"}
      </span>
    </a>
  );
});

// Placeholder avatar for the logged-in agent
const avatarUrl = "https://i.pravatar.cc/100?img=12";
