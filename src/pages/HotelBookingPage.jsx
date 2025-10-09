import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaHotel, FaCalendarAlt, FaUsers, FaUtensils } from "react-icons/fa";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import "../styles/HotelBookingPage.css";
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  Accordion,
  Badge,
} from "react-bootstrap";

const HotelBookingPage = () => {
  const navigate = useNavigate();

  let activeUserRole = localStorage.getItem("currentActiveRole");
  console.log("currentActiveRole::", activeUserRole);

  const [bookingData, setBookingData] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [primaryGuest, setPrimaryGuest] = useState({ 
    salutation: "",
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    phone: "",
    passportNo: "",
    agentLpo: "",
  });

  // Load bookingData once
  useEffect(() => {
    const storedData = sessionStorage.getItem("bookingData");
    if (storedData) {
      const parsedData = JSON.parse(storedData);
      setBookingData(parsedData);

      // Initialize rooms with guests
      const initialRooms = parsedData.payload.rooms.map((room) => ({
        ...room,
        guests: Array.from({ length: room.adults + room.children }, (_, i) => ({
          salutation: "",
          firstName: "",
          middleName: "",
          lastName: "",
          gender: "",
          isChild: i >= room.adults,
        })),
      }));
      setRooms(initialRooms);
    }
  }, []);

  const handleGuestChange = (roomIndex, guestIndex, field, value) => {
    setRooms((prevRooms) => {
      const updatedRooms = [...prevRooms];
      updatedRooms[roomIndex].guests[guestIndex][field] = value;
      return updatedRooms;
    });
  };

  const handlePrimaryGuestChange = (field, value) => {
    setPrimaryGuest((prev) => ({ ...prev, [field]: value }));
  };

  const getRefundStatusBadge = (refundStatus) => {
    switch (refundStatus) {
      case "FLEXIBLE":
        return <Badge bg="success">Flexible</Badge>;
      case "NON REFUNDABLE":
        return <Badge bg="danger">Non-Refundable</Badge>;
      default:
        return <Badge bg="secondary">{refundStatus}</Badge>;
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const bookingPayload = { primaryGuest, rooms };
    console.log("Booking Data:", bookingPayload);
    navigate("/booking-confirmation", {
      state: { bookingData: bookingPayload },
    });
  };

  const formatPrice = (price) =>
    new Intl.NumberFormat("en-AE", {
      style: "currency",
      currency: "AED",
    }).format(price);

  if (!bookingData) return <div>Loading booking data...</div>;

  const { hotelStaticData, payload, selectedRate } = bookingData;
  console.log("bookingData:::", bookingData);

  return (
    <div className="hotel-booking-container">
      <Sidebar />
      <div className="main-content">
        <TopBar />
        <main className="content-wrapper py-4">
          <Container fluid>
            {/* Booking Summary */}
            <Row>
              <Col>
                <Card className="shadow-lg rounded-xl mb-5 booking-summary-card border-0">
                  <Card.Header className="bg-primary text-white py-3 rounded-top">
                    <h4 className="mb-0 d-flex align-items-center">
                      <FaHotel className="me-2" /> Booking Summary
                    </h4>
                  </Card.Header>
                  <Card.Body className="p-4 bg-white">
                    <Row className="gy-4">
                      <Col md={6} lg={4}>
                        <h5 className="fw-bold">{hotelStaticData.hotelName}</h5>
                        <p className="text-muted mb-1">
                          {hotelStaticData.address}
                        </p>
                        <div className="d-flex align-items-center mb-1">
                          <small className="text-muted me-2">
                            ⭐ {hotelStaticData.starRating} Star
                          </small>
                          {selectedRate.nonRefundable !== undefined &&
                            getRefundStatusBadge(
                               selectedRate.nonRefundable === "Y"
                                ? "NON REFUNDABLE"
                                : "FLEXIBLE"
                            )}
                           
                        </div>
                      </Col>
                      <Col md={6} lg={2}>
                        <FaCalendarAlt className="me-2 text-muted" />
                        <strong>Check-in:</strong>
                        <br />
                        {payload.checkInDate}
                      </Col>
                      <Col md={6} lg={2}>
                        <FaCalendarAlt className="me-2 text-muted" />
                        <strong>Check-out:</strong>
                        <br />
                        {payload.checkOutDate}
                      </Col>
                      <Col md={6} lg={2}>
                        <FaUsers className="me-2 text-muted" />
                        <strong>Guests</strong>
                        <br />
                        {payload.rooms.map((room, i) => (
                          <div key={i}>
                            Room {i + 1}: {room.adults} Adults
                            {room.children ? `, ${room.children} Children` : ""}
                          </div>
                        ))}
                      </Col>
                      <Col md={6} lg={2}>
                        <FaUtensils className="me-2 text-muted" />
                        <strong>Meal Plan:</strong>
                        <br />
                        {selectedRate.mealPlan}
                      </Col>
                    </Row>
                    <hr />

   {/* ✅ Show Selling Price only if ADMIN */}
 {activeUserRole === "ADMIN" && (
                    <div className="d-flex justify-content-end align-items-center mt-3">
                      <h4 className="mb-0">
                        Selling Price :{" "}
                        <span className="text-success fw-bold">
                            {formatPrice(selectedRate.rate)}
                          {/* {formatPrice(selectedRate.sellingPrice)} */}
                        </span>
                      </h4>
                    </div>
                     )}

                    
                    <div className="d-flex justify-content-end align-items-center mt-3">
                      <h4 className="mb-0">
                        Total Price :{" "}
                        <span className="text-success fw-bold">
                            {formatPrice(selectedRate.rate)}
                        </span>
                      </h4>
                    </div>
                  


                  </Card.Body>
                </Card>
              </Col>
            </Row>

            {/* Rooms & Guests Forms */}
            <Form onSubmit={handleSubmit}>
              <Accordion defaultActiveKey="" className="mb-5 custom-accordion">
                {rooms.map((room, roomIndex) => (
                  <Accordion.Item
                    eventKey={`room-${roomIndex}`}
                    key={roomIndex}
                    className="mb-3 border rounded shadow-sm"
                  >
                    <Accordion.Header>
                      {/* <strong>Room {roomIndex + 1} - Guest Details</strong> */}
                      Room {roomIndex + 1} - Guest Details
                    </Accordion.Header>
                    <Accordion.Body className="bg-light rounded-bottom">
                      <div className="mb-4">
                        <strong>Room Type:</strong>{" "}
                        <Badge bg="info">{selectedRate.roomCategory}</Badge>
                      </div>
                      {room.guests.map((guest, guestIndex) => (
                        <Card
                          key={guestIndex}
                          className="mb-3 p-3 border rounded shadow-sm"
                        >
                          <h6 className="fw-bold mb-3">
                            Guest {guestIndex + 1}{" "}
                            {guest.isChild ? "(Child)" : "(Adult)"}
                          </h6>
                          <Row className="g-3">
                            <Col md={3}>
                              <Form.Group>
                                <Form.Label>
                                  <span style={{ color: "red" }}>*</span>
                                  Salutation
                                </Form.Label>
                                <Form.Select
                                  value={guest.salutation}
                                  onChange={(e) =>
                                    handleGuestChange(
                                      roomIndex,
                                      guestIndex,
                                      "salutation",
                                      e.target.value
                                    )
                                  }
                                >
                                  <option value="">Select</option>
                                  <option value="Mr">Mr</option>
                                  <option value="Mrs">Mrs</option>
                                  <option value="Ms">Ms</option>
                                  <option value="Dr">Dr</option>
                                </Form.Select>
                              </Form.Group>
                            </Col>
                            <Col md={3}>
                              <Form.Group>
                                <Form.Label>
                                  <span style={{ color: "red" }}>*</span>First
                                  Name
                                </Form.Label>
                                <Form.Control
                                  type="text"
                                  value={guest.firstName}
                                  onChange={(e) =>
                                    handleGuestChange(
                                      roomIndex,
                                      guestIndex,
                                      "firstName",
                                      e.target.value
                                    )
                                  }
                                />
                              </Form.Group>
                            </Col>
                            <Col md={3}>
                              <Form.Group>
                                <Form.Label>
                                  <span style={{ color: "red" }}>*</span>Last
                                  Name
                                </Form.Label>
                                <Form.Control
                                  type="text"
                                  value={guest.lastName}
                                  onChange={(e) =>
                                    handleGuestChange(
                                      roomIndex,
                                      guestIndex,
                                      "lastName",
                                      e.target.value
                                    )
                                  }
                                />
                              </Form.Group>
                            </Col>
                            <Col md={3}>
                              <Form.Group>
                                <Form.Label>
                                  <span style={{ color: "red" }}>*</span>Gender
                                </Form.Label>
                                <Form.Select
                                  value={guest.gender}
                                  onChange={(e) =>
                                    handleGuestChange(
                                      roomIndex,
                                      guestIndex,
                                      "gender",
                                      e.target.value
                                    )
                                  }
                                >
                                  <option value="">Select</option>
                                  <option value="Male">Male</option>
                                  <option value="Female">Female</option>
                                  <option value="Other">Other</option>
                                </Form.Select>
                              </Form.Group>
                            </Col>
                          </Row>
                        </Card>
                      ))}
                    </Accordion.Body>
                  </Accordion.Item>
                ))}
              </Accordion>

              {/* Primary Guest */}
              <Card className="p-4 mb-4 shadow-sm border-0">
                <h5 className="mb-3 fw-bold">Primary Guest Details</h5>
                <Row className="g-3">
                  <Col md={3}>
                    <Form.Group>
                      <Form.Label>
                        <span style={{ color: "red" }}>*</span>Salutation
                      </Form.Label>
                      <Form.Select
                        value={primaryGuest.salutation}
                        onChange={(e) =>
                          handlePrimaryGuestChange("salutation", e.target.value)
                        }
                      >
                        <option value="">Select</option>
                        <option value="Mr">Mr</option>
                        <option value="Mrs">Mrs</option>
                        <option value="Ms">Ms</option>
                        <option value="Dr">Dr</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group>
                      <Form.Label>
                        <span style={{ color: "red" }}>*</span>First Name
                      </Form.Label>
                      <Form.Control
                        type="text"
                        value={primaryGuest.firstName}
                        onChange={(e) =>
                          handlePrimaryGuestChange("firstName", e.target.value)
                        }
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group>
                      <Form.Label>Middle Name</Form.Label>
                      <Form.Control
                        type="text"
                        value={primaryGuest.middleName}
                        onChange={(e) =>
                          handleGuestChange(
                            roomIndex,
                            guestIndex,
                            "middleName",
                            e.target.value
                          )
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group>
                      <Form.Label>
                        <span style={{ color: "red" }}>*</span>Last Name
                      </Form.Label>
                      <Form.Control
                        type="text"
                        value={primaryGuest.lastName}
                        onChange={(e) =>
                          handlePrimaryGuestChange("lastName", e.target.value)
                        }
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group>
                      <Form.Label>
                        <span style={{ color: "red" }}>*</span>Email
                      </Form.Label>
                      <Form.Control
                        type="email"
                        value={primaryGuest.email}
                        onChange={(e) =>
                          handlePrimaryGuestChange("email", e.target.value)
                        }
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group>
                      <Form.Label>
                        <span style={{ color: "red" }}>*</span>Phone
                      </Form.Label>
                      <Form.Control
                        type="text"
                        value={primaryGuest.phone}
                        onChange={(e) =>
                          handlePrimaryGuestChange("phone", e.target.value)
                        }
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group>
                      <Form.Label>Passport No</Form.Label>
                      <Form.Control
                        type="text"
                        value={primaryGuest.passportNo}
                        onChange={(e) =>
                          handlePrimaryGuestChange("passportNo", e.target.value)
                        }
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group>
                      <Form.Label>
                        <span style={{ color: "red" }}>*</span>Agent LPO
                      </Form.Label>
                      <Form.Control
                        type="text"
                        value={primaryGuest.agentLpo}
                        onChange={(e) =>
                          handlePrimaryGuestChange("agentLpo", e.target.value)
                        }
                        required
                      />
                    </Form.Group>
                  </Col>
                </Row>
              </Card>

              {/* Remarks & Requests */}
              <Card className="p-4 mb-4 shadow-sm border-0">
                <h5 className="mb-3 fw-bold">Remarks & Special Requests</h5>
                <Form.Group className="mb-3">
                  <Form.Label>Remarks</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    placeholder="Any remarks..."
                  />
                </Form.Group>
                <Form.Group>
                  <Form.Label>Special Requests</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    placeholder="Any special requests..."
                  />
                </Form.Group>
              </Card>

              <div className="d-flex justify-content-end gap-2 mt-4">
                <Button variant="secondary" onClick={() => navigate(-1)}>
                  Back
                </Button>
                <Button variant="primary" type="submit">
                  Confirm Booking
                </Button>
              </div>
            </Form>
          </Container>
        </main>
      </div>
    </div>
  );
};

export default HotelBookingPage;
