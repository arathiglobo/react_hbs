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
  Form
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
  FaInfoCircle,
} from "react-icons/fa";
import axiosInstance from "./AxiosInstance";
import { toast } from "react-hot-toast";

export default function TopBar() {
  const navigate = useNavigate();
  const [showCartModal, setShowCartModal] = useState(false);
  const [cartItems, setCartItems] = useState([]);
  const [cartLoading, setCartLoading] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [markups, setMarkups] = useState({});

  const getCartAgentId = () =>
    sessionStorage.getItem("makeYourOwnPackageAgentId") ||
    localStorage.getItem("makeYourOwnPackageAgentId") ||
    "";

  // v2 flow detection — when set by MakeUrOwnPackageV2 on entry, every
  // mypkg cart API call below targets /api/makeYourOwnPackageV2/cart/*
  // instead of the legacy /api/makeYourOwnPackage* endpoints. The legacy
  // flow keeps working unchanged.
  const _isV2Flow = () =>
    typeof window !== "undefined" &&
    sessionStorage.getItem("makePkgFlow") === "v2";

  // URL builders so the rest of the file stays readable.
  const _fetchUrl = (uid) =>
    _isV2Flow()
      ? `/api/makeYourOwnPackageV2/cart/fetch?userId=${encodeURIComponent(uid)}`
      : `/api/makeYourOwnPackage/fetchDataFromRedis?userId=${encodeURIComponent(uid)}`;
  const _deleteUrl = () =>
    _isV2Flow()
      ? "/api/makeYourOwnPackageV2/cart/remove"
      : "/api/makeYourOwnPackage/deleteFromCart";
  const _clearUrl = () =>
    _isV2Flow()
      ? "/api/makeYourOwnPackageV2/cart/clear"
      : "/api/makeYourOwnPackage/clearFromCart";

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
      <Card key={key} className="border-0 shadow-sm mb-3 overflow-hidden" style={{ borderRadius: "12px", borderLeft: "4px solid #0dcaf0" }}>
        <Card.Body className="p-3">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div className="d-flex align-items-center gap-2">
              <div className="bg-light p-2 rounded-3 text-info">
                <FaTicketAlt size={18} />
              </div>
              <div>
                <span className="text-muted x-small text-uppercase fw-bold ls-1" style={{ fontSize: "10px" }}>Activity</span>
                <h6 className="fw-bold mb-0 text-dark">
                  {activity.activityName || "Activity"}
                </h6>
              </div>
            </div>
            <Button
              variant="link"
              className="text-danger p-0 text-decoration-none small d-flex align-items-center"
              onClick={() => handleRemoveFromCart(item)}
            >
              <FaTrash size={12} className="me-1" /> <span style={{ fontSize: "13px" }}>Remove</span>
            </Button>
          </div>

          <Row className="g-3 align-items-end">
            <Col md={8}>
              <Row className="g-2 text-muted" style={{ fontSize: "13px" }}>
                <Col xs={6} className="d-flex align-items-center">
                  <FaCalendarAlt className="me-2 opacity-50" />
                  <span>{activity.activityDate || "-"}</span>
                </Col>
                <Col xs={6} className="d-flex align-items-center">
                  <FaUsers className="me-2 opacity-50" />
                  <span>{activity.adult || 0} Adults, {activity.child || 0} Children</span>
                </Col>
                <Col xs={12} className="d-flex align-items-center">
                  <FaMapMarkerAlt className="me-2 opacity-50" />
                  <span className="text-truncate">Rate: <span className="text-dark fw-bold">AED {activity.totalRate || "-"}</span></span>
                </Col>
              </Row>
            </Col>
            <Col md={4}>
              <div className="bg-light p-2 rounded-3 border">
                <Form.Label className="mb-1 x-small fw-bold text-muted" style={{ fontSize: "10px" }}>ADDITIONAL MARKUP %</Form.Label>
                <div className="input-group input-group-sm">
                  <Form.Control
                    type="number"
                    placeholder="0"
                    className="fw-bold text-primary shadow-none border-0 bg-transparent"
                    style={{ fontSize: "15px" }}
                    value={markups[getCartKey(item)] || ""}
                    onChange={(e) =>
                      setMarkups((prev) => ({
                        ...prev,
                        [getCartKey(item)]: e.target.value,
                      }))
                    }
                  />
                  <span className="input-group-text bg-transparent border-0 text-muted fw-bold">%</span>
                </div>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>
    );
  };

  const renderHotelItem = (item, key) => {
    const hotel = item.hotel || {};
    const details = hotel.details || {};

    const hotelName = hotel.hotelName || "Hotel";
    const checkIn = hotel.checkIn || details.checkInDate || details.checkIn || "";
    const checkOut = hotel.checkOut || details.checkOutDate || details.checkOut || "";
    const roomCategory = hotel.roomCategory || details.roomCategory || "";
    const roomType = hotel.roomType || details.mealPlan || "";
    const totalRate = hotel.totalRate || "";
    
    const searchRoomDTOs = hotel.searchRoomDTOs || details.searchRoomDTOs || [];
    let totalAdults = 0;
    let totalChildren = 0;
    
    if (searchRoomDTOs.length > 0) {
      searchRoomDTOs.forEach((room) => {
        totalAdults += parseInt(room.adult || room.adults || 0);
        totalChildren += parseInt(room.child || room.children || 0);
      });
    } else {
      totalAdults = parseInt(hotel.adult || details.adult || 0);
      totalChildren = parseInt(hotel.child || details.child || 0);
    }

    return (
      <Card key={key} className="border-0 shadow-sm mb-3 overflow-hidden" style={{ borderRadius: "12px", borderLeft: "4px solid #0d6efd" }}>
        <Card.Body className="p-3">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div className="d-flex align-items-center gap-2">
              <div className="bg-light p-2 rounded-3 text-primary">
                <FaBed size={18} />
              </div>
              <div>
                <span className="text-muted x-small text-uppercase fw-bold ls-1" style={{ fontSize: "10px" }}>Hotel</span>
                <h6 className="fw-bold mb-0 text-dark">{hotelName}</h6>
              </div>
            </div>
            <Button
              variant="link"
              className="text-danger p-0 text-decoration-none small d-flex align-items-center"
              onClick={() => handleRemoveFromCart(item)}
            >
              <FaTrash size={12} className="me-1" /> <span style={{ fontSize: "13px" }}>Remove</span>
            </Button>
          </div>

          <Row className="g-3 align-items-end">
            <Col md={8}>
              <div className="mb-2 border-bottom pb-2">
                <span className="text-muted small d-block">Room & Plan</span>
                <span className="fw-bold small text-dark">{roomCategory} • {roomType}</span>
              </div>
              <Row className="g-2 text-muted" style={{ fontSize: "13px" }}>
                <Col xs={6} className="d-flex align-items-center">
                  <FaCalendarAlt className="me-2 opacity-50" />
                  <span>{checkIn} → {checkOut}</span>
                </Col>
                <Col xs={6} className="d-flex align-items-center">
                  <FaUsers className="me-2 opacity-50" />
                  <span>{totalAdults} Adults {totalChildren > 0 ? `, ${totalChildren} Child` : ""}</span>
                </Col>
                <Col xs={12} className="d-flex align-items-center mt-2">
                  <span className="text-muted">Total Rate: <span className="text-dark fw-bold">AED {totalRate}</span></span>
                </Col>
              </Row>
            </Col>
            <Col md={4}>
              <div className="bg-light p-2 rounded-3 border">
                <Form.Label className="mb-1 x-small fw-bold text-muted" style={{ fontSize: "10px" }}>ADDITIONAL MARKUP %</Form.Label>
                <div className="input-group input-group-sm">
                  <Form.Control
                    type="number"
                    placeholder="0"
                    className="fw-bold text-primary shadow-none border-0 bg-transparent"
                    style={{ fontSize: "15px" }}
                    value={markups[getCartKey(item)] || ""}
                    onChange={(e) =>
                      setMarkups((prev) => ({
                        ...prev,
                        [getCartKey(item)]: e.target.value,
                      }))
                    }
                  />
                  <span className="input-group-text bg-transparent border-0 text-muted fw-bold">%</span>
                </div>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>
    );
  };

  const renderCabItem = (item, key) => {
    const cab = item.cab || {};
    const cabName = cab.cabName || cab.vehicleName || "Transfer";
    const pickupDate = cab.pickupDate || "";
    const adult = cab.adult || "";
    const child = cab.child || "";
    
    return (
      <Card key={key} className="border-0 shadow-sm mb-3 overflow-hidden" style={{ borderRadius: "12px", borderLeft: "4px solid #6c757d" }}>
        <Card.Body className="p-3">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div className="d-flex align-items-center gap-2">
              <div className="bg-light p-2 rounded-3 text-secondary">
                <FaMapMarkerAlt size={18} />
              </div>
              <div>
                <span className="text-muted x-small text-uppercase fw-bold ls-1" style={{ fontSize: "10px" }}>Transfer</span>
                <h6 className="fw-bold mb-0 text-dark">{cabName}</h6>
              </div>
            </div>
            <Button
              variant="link"
              className="text-danger p-0 text-decoration-none small d-flex align-items-center"
              onClick={() => handleRemoveFromCart(item)}
            >
              <FaTrash size={12} className="me-1" /> <span style={{ fontSize: "13px" }}>Remove</span>
            </Button>
          </div>

          <Row className="g-3 align-items-end">
            <Col md={8}>
              <div className="mb-2 border-bottom pb-2">
                <span className="text-muted small d-block">Route</span>
                <span className="fw-bold small text-dark text-truncate d-block">{cab.pickupLocation} → {cab.dropoffLocation}</span>
              </div>
              <Row className="g-2 text-muted" style={{ fontSize: "13px" }}>
                <Col xs={6} className="d-flex align-items-center">
                  <FaCalendarAlt className="me-2 opacity-50" />
                  <span>{pickupDate}</span>
                </Col>
                <Col xs={6} className="d-flex align-items-center">
                  <FaUsers className="me-2 opacity-50" />
                  <span>{adult} Adults {child > 0 ? `, ${child} Child` : ""}</span>
                </Col>
                <Col xs={12} className="d-flex align-items-center mt-2">
                  <span className="text-muted">Total Rate: <span className="text-dark fw-bold">AED {cab.totalRate}</span></span>
                </Col>
              </Row>
            </Col>
            <Col md={4}>
              <div className="bg-light p-2 rounded-3 border">
                <Form.Label className="mb-1 x-small fw-bold text-muted" style={{ fontSize: "10px" }}>ADDITIONAL MARKUP %</Form.Label>
                <div className="input-group input-group-sm">
                  <Form.Control
                    type="number"
                    placeholder="0"
                    className="fw-bold text-primary shadow-none border-0 bg-transparent"
                    style={{ fontSize: "15px" }}
                    value={markups[getCartKey(item)] || ""}
                    onChange={(e) =>
                      setMarkups((prev) => ({
                        ...prev,
                        [getCartKey(item)]: e.target.value,
                      }))
                    }
                  />
                  <span className="input-group-text bg-transparent border-0 text-muted fw-bold">%</span>
                </div>
              </div>
            </Col>
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

      const response = await axiosInstance.post(_fetchUrl(agentId));

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

      const response = await axiosInstance.post(_deleteUrl(), null, {
        params: _isV2Flow()
          ? { userId: agentId, cartItemId: cartKey }
          : { agentId: agentId, cartKey: cartKey },
      });
      console.log("Response:", response.data);
      // Accept both the legacy "1" sentinel and the v2 endpoint's
      // { status: "SUCCESS" } / { status: "NOT_FOUND" } shape. A
      // NOT_FOUND from v2 still means the row isn't on the server, so
      // refreshing the cart matches the user's intent.
      const v2Status = response.data?.status;
      const ok =
        response.data === 1 ||
        response.data === "1" ||
        v2Status === "SUCCESS" ||
        v2Status === "NOT_FOUND";
      if (ok) {
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

      const response = await axiosInstance.post(_clearUrl(), null, {
        params: _isV2Flow() ? { userId: agentId } : { agentId: agentId },
      });
      
      console.log("Clear cart response:", response.data);
      
      // Accept the legacy "1"/true response shape AND the v2 endpoint's
      // { status: "CLEARED" } / { status: "EMPTY" } shape — both mean the
      // cart is empty server-side, which is what the operator wanted.
      const v2Status = response.data?.status;
      const ok =
        response.data === 1 ||
        response.data === true ||
        response.data?.success === true ||
        v2Status === "CLEARED" ||
        v2Status === "EMPTY";
      if (ok) {
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

  const handleQuotationBooking = async () => {
    try {
      const agentId = getCartAgentId();
      if (!agentId) {
        toast.error("Select an agent before proceeding to checkout.");
        return;
      }

      // Check for hotel
      const hotelExists = cartItems.some(item => !!item.hotel);
      if (!hotelExists && cartItems.length > 0) {
        toast.error("Please add a hotel to your package before proceeding.");
        return;
      }

      // Fetch latest cart data before navigating
      const response = await axiosInstance.post(_fetchUrl(agentId));

      if (Array.isArray(response.data) && response.data.length > 0) {
        // Apply markups to cart data
        const cartWithMarkups = response.data.map((item) => {
          const key = getCartKey(item);
          const markupPercent = parseFloat(markups[key]) || 0;
          
          const newItem = JSON.parse(JSON.stringify(item));
          
          if (markupPercent > 0) {
            if (newItem.hotel) {
              const originalRate = parseFloat(newItem.hotel.totalRate || 0);
              newItem.hotel.totalRateWithoutmrk = originalRate;
              newItem.hotel.totalRate = originalRate * (1 + markupPercent / 100);
              newItem.hotel.markupPercent = markupPercent;
            } else if (newItem.activity) {
              const originalRate = parseFloat(newItem.activity.totalRate || 0);
              newItem.activity.totalRateWithoutmrk = originalRate;
              newItem.activity.totalRate = originalRate * (1 + markupPercent / 100);
              newItem.activity.markupPercent = markupPercent;
            } else if (newItem.cab) {
              const originalRate = parseFloat(newItem.cab.totalRate || 0);
              newItem.cab.totalRateWithoutmrk = originalRate;
              newItem.cab.totalRate = originalRate * (1 + markupPercent / 100);
              newItem.cab.markupPercent = markupPercent;
            }
          }
          return newItem;
        });

        // Store cart data in sessionStorage for the booking page
        sessionStorage.setItem("makePkgCartData", JSON.stringify(cartWithMarkups));
        sessionStorage.setItem("makePkgAgentId", agentId);
        window.open("/make-your-own-package/generate-quotation-booking");
      } else {
        toast.error("Your cart is empty. Please add items to cart first.");
      }
    } catch (err) {
      console.error("Error fetching cart data:", err);
      toast.error("Failed to load cart data. Please try again.");
    }
  };

  const handleContinueBooking = async () => {
    try {
      const agentId = getCartAgentId();
      if (!agentId) {
        toast.error("Select an agent before proceeding to checkout.");
        return;
      }

      // Check for hotel
      const hotelExists = cartItems.some(item => !!item.hotel);
      if (!hotelExists && cartItems.length > 0) {
        toast.error("Please add a hotel to your package before proceeding.");
        return;
      }

      // Fetch latest cart data before navigating
      const response = await axiosInstance.post(_fetchUrl(agentId));

      if (Array.isArray(response.data) && response.data.length > 0) {
        // Apply markups to cart data
        const cartWithMarkups = response.data.map((item) => {
          const key = getCartKey(item);
          const markupPercent = parseFloat(markups[key]) || 0;
          
          const newItem = JSON.parse(JSON.stringify(item));
          
          if (markupPercent > 0) {
            if (newItem.hotel) {
              const originalRate = parseFloat(newItem.hotel.totalRate || 0);
              newItem.hotel.totalRateWithoutmrk = originalRate;
              newItem.hotel.totalRate = originalRate * (1 + markupPercent / 100);
              newItem.hotel.markupPercent = markupPercent;
            } else if (newItem.activity) {
              const originalRate = parseFloat(newItem.activity.totalRate || 0);
              newItem.activity.totalRateWithoutmrk = originalRate;
              newItem.activity.totalRate = originalRate * (1 + markupPercent / 100);
              newItem.activity.markupPercent = markupPercent;
            } else if (newItem.cab) {
              const originalRate = parseFloat(newItem.cab.totalRate || 0);
              newItem.cab.totalRateWithoutmrk = originalRate;
              newItem.cab.totalRate = originalRate * (1 + markupPercent / 100);
              newItem.cab.markupPercent = markupPercent;
            }
          }
          return newItem;
        });

        // Store cart data in sessionStorage for the booking page
        sessionStorage.setItem("makePkgCartData", JSON.stringify(cartWithMarkups));
        sessionStorage.setItem("makePkgAgentId", agentId);
        // Flow-aware: when the operator entered via the v2 menu we route
        // the cart's Proceed button to the v2 booking-page instead.
        // makePkgFlow flag is set by MakeUrOwnPackageV2 on entry.
        const _v2 =
          typeof window !== "undefined" &&
          sessionStorage.getItem("makePkgFlow") === "v2"
            ? "-v2"
            : "";
        window.open(`/new-booking/make-your-own-package${_v2}/booking-page`);
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
    <Navbar className="topbar shadow-sm" expand="lg" sticky="top">
      <Container fluid className="px-3">
       <Navbar.Brand
  href="#"
  className="d-flex align-items-center gap-2"
  style={{
    marginLeft: window.innerWidth <= 991 ? "40px" : "0px"
  }}
>
  <div className="logo-placeholder">GS</div>
  <span className="fw-semibold">Globosoft</span>
</Navbar.Brand>
        <Nav className="ms-auto d-flex flex-row align-items-center gap-2 gap-md-3 flex-nowrap">
  {/* Cart Button — hidden in the v3 flow (no Redis cart there;
       selection is held in component state on /results) */}
  {sessionStorage.getItem("makePkgFlow") !== "v3" && (
    <Button
      variant="link"
      className="position-relative text-dark text-decoration-none p-0 d-flex align-items-center"
      onClick={handleCartClick}
      style={{ border: "none", background: "none", minWidth: "auto" }}
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
  )}

  {/* Profile Dropdown */}
  <Dropdown align="end">
    <Dropdown.Toggle
      as={ProfileToggle}
      id="profile-dropdown"
      className="p-0"
      style={{ minWidth: "auto" }}
    />
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
        <Modal.Header closeButton className="border-bottom pb-3" style={{ background: "white", color: "#333" }}>
          <Modal.Title className="fw-bold d-flex align-items-center gap-2" style={{ fontSize: "1.25rem" }}>
            <FaShoppingCart className="text-primary" size={24} />
            <span className="text-dark">Shopping Cart</span>
            <Badge bg="primary" pill style={{ fontSize: "0.8rem", padding: "0.4em 0.8em" }}>{cartCount}</Badge>
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
              {cartItems.length > 0 && !cartItems.some(item => !!item.hotel) && (
                <div className="alert alert-warning py-2 mb-0 d-flex align-items-center gap-2" style={{ border: "none", borderRadius: "10px", fontSize: "13px" }}>
                  <FaInfoCircle />
                  <span>Please add a hotel to your package before proceeding to checkout.</span>
                </div>
              )}
              {cartItems.map((item, index) => renderCartItem(item, index))}
              {/* v2 add-ons summary — surfaces what the operator picked
                  on /addons so they see it without leaving the cart. */}
              {_isV2Flow() && (() => {
                let svcMap = {};
                try {
                  svcMap = JSON.parse(
                    sessionStorage.getItem("mypkg_addon_services") || "{}"
                  );
                } catch {
                  svcMap = {};
                }
                const enabled = Object.entries(svcMap)
                  .filter(([, v]) => v && v.enabled === true)
                  .map(([k]) => k);
                const visa = sessionStorage.getItem("makePkgV2VisaRequired") || "NO";
                if (enabled.length === 0 && visa === "NO") return null;
                return (
                  <div
                    className="mt-3 p-2 rounded border bg-light"
                    style={{ fontSize: "0.85rem" }}
                  >
                    <div className="fw-semibold text-secondary mb-1">
                      Add-ons selected on the /addons step
                    </div>
                    <div className="d-flex flex-wrap gap-1">
                      <span
                        className={`badge ${visa === "YES" ? "bg-danger" : "bg-secondary"}`}
                      >
                        Visa: {visa}
                      </span>
                      {enabled.map((k) => (
                        <span key={k} className="badge bg-success-subtle text-success">
                          {k}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="border-top-0 pt-3">
          <div className="d-flex justify-content-between w-100 align-items-center">
            <div>
              {cartItems.length > 0 && (
                <Button
                  variant="link"
                  onClick={handleClearCart}
                  className="text-danger p-0 text-decoration-none small fw-bold"
                >
                  Clear All
                </Button>
              )}
            </div>
            <div className="d-flex gap-2">
              <Button
                variant="light"
                onClick={() => setShowCartModal(false)}
                className="px-4 fw-bold text-muted rounded-pill border-0"
              >
                Close
              </Button>
              {cartItems.length > 0 && (
                <Button
                  variant="primary"
                  onClick={handleContinueBooking}
                  className="px-4 fw-bold rounded-pill"
                  disabled={!cartItems.some(item => !!item.hotel)}
                  title={!cartItems.some(item => !!item.hotel) ? "Please add a hotel first" : ""}
                >
                  Checkout
                </Button>
              )}
              {cartItems.length > 0 && (
                <Button
                  variant="outline-primary"
                  onClick={handleQuotationBooking}
                  className="px-4 fw-bold rounded-pill"
                  disabled={!cartItems.some(item => !!item.hotel)}
                  title={!cartItems.some(item => !!item.hotel) ? "Please add a hotel first" : ""}
                >
                  Get Quote
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
