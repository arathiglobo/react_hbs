import React, { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  Badge,
  Spinner,
  Modal,
} from "react-bootstrap";
import { FaTicketAlt, FaUserAlt, FaCheckCircle, FaCalendarAlt, FaMapMarkerAlt, FaUsers, FaClock, FaPlus, FaRoute, FaShoppingCart } from "react-icons/fa";
import axiosInstance from "../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";

const ActivityBookingPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { activity, searchCriteria } = location.state || {};

  // If accessed directly without state, redirect or show an error
  const hasValidState = !!activity && !!searchCriteria;

  const [primaryGuest, setPrimaryGuest] = useState({
    salutation: "Mr",
    firstName: "",
    lastName: "",
    contactNumber: "",
    emailId: "",
    passportNumber: "",
    lpo: "",
  });

  // ── Pax manifest (one row per adult + child) ─────────────────────
  // Pattern mirrors HotelBookingPage / CabBookingPage: seed the list
  // from the search counts, keep Adult 1 in lock-step with the primary
  // guest contact card above, and POST the full list as `guests` so
  // the backend can persist every traveller.
  const totalAdults = Math.max(0, Number(searchCriteria?.adults) || 0);
  const totalChildren = Math.max(0, Number(searchCriteria?.children) || 0);
  const childAges = Array.isArray(searchCriteria?.childAges)
    ? searchCriteria.childAges
    : [];
  const initialGuests = useMemo(() => {
    const out = [];
    for (let i = 0; i < totalAdults; i++) {
      out.push({
        salutation: i === 0 ? "Mr" : "",
        firstName: "",
        middleName: "",
        lastName: "",
        gender: "",
        isChild: false,
        age: null,
        passportNo: "",
      });
    }
    for (let i = 0; i < totalChildren; i++) {
      out.push({
        salutation: "",
        firstName: "",
        middleName: "",
        lastName: "",
        gender: "",
        isChild: true,
        age: childAges[i] != null ? Number(childAges[i]) : null,
        passportNo: "",
      });
    }
    return out;
    // eslint-disable-next-line
  }, []);
  const [guests, setGuests] = useState(initialGuests);

  // Adult 1 ↔ primary guest two-way sync (name + salutation only).
  useEffect(() => {
    if (guests.length === 0) return;
    setGuests((prev) => {
      const next = [...prev];
      if (!next[0]) return prev;
      const a1 = next[0];
      if (
        a1.salutation === primaryGuest.salutation &&
        a1.firstName === primaryGuest.firstName &&
        a1.lastName === primaryGuest.lastName
      ) {
        return prev;
      }
      next[0] = {
        ...a1,
        salutation: primaryGuest.salutation || a1.salutation,
        firstName: primaryGuest.firstName,
        lastName: primaryGuest.lastName,
      };
      return next;
    });
    // eslint-disable-next-line
  }, [primaryGuest.salutation, primaryGuest.firstName, primaryGuest.lastName]);

  const handleGuestChange = (index, field, value) => {
    setGuests((prev) => {
      const next = [...prev];
      if (!next[index]) return prev;
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    // Mirror Adult 1 → primary guest contact card for the three name
    // fields. Other fields stay local to each pax row.
    if (
      index === 0 &&
      ["salutation", "firstName", "lastName"].includes(field)
    ) {
      setPrimaryGuest((prev) =>
        prev[field] === value ? prev : { ...prev, [field]: value }
      );
    }
    const key = `guest_${index}_${field}`;
    if (validationErrors[key]) {
      setValidationErrors((prev) => {
        const updated = { ...prev };
        delete updated[key];
        return updated;
      });
    }
  };

  const [validationErrors, setValidationErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Itinerary state
  const [itineraryList, setItineraryList] = useState([]);
  const [selectedItineraries, setSelectedItineraries] = useState([]);
  const [loadingItinerary, setLoadingItinerary] = useState(false);
  const [showItineraryModal, setShowItineraryModal] = useState(false);
  const [itinerarySearchTerm, setItinerarySearchTerm] = useState("");
  const [filteredItineraryList, setFilteredItineraryList] = useState([]);
  const [expandedDescriptions, setExpandedDescriptions] = useState({});

  // Fetch Itinerary details
  React.useEffect(() => {
    const fetchItineraryDetails = async () => {
      try {
        setLoadingItinerary(true);
        const response = await axiosInstance.get("/api/master/itenaryDetails");
        if (Array.isArray(response.data)) {
          setItineraryList(response.data);
          setFilteredItineraryList(response.data);
        } else {
          toast.error("Failed to load itinerary details.");
        }
      } catch (err) {
        console.error("Error fetching itinerary:", err);
        toast.error("Failed to load itinerary details.");
      } finally {
        setLoadingItinerary(false);
      }
    };

    fetchItineraryDetails();
  }, []);

  // Filter itinerary list based on search term
  React.useEffect(() => {
    if (itinerarySearchTerm.trim().length >= 3) {
      const filtered = itineraryList.filter((item) => {
        const heading = (item.itineraryHeading || "").toLowerCase();
        const desc = (item.itineraryDesc || "").toLowerCase();
        const search = itinerarySearchTerm.toLowerCase();
        return heading.includes(search) || desc.includes(search);
      });
      setFilteredItineraryList(filtered);
    } else if (itinerarySearchTerm.trim().length === 0) {
      setFilteredItineraryList(itineraryList);
    } else {
      setFilteredItineraryList([]);
    }
  }, [itinerarySearchTerm, itineraryList]);

  // Handle Itinerary Modal
  const handleOpenItineraryModal = () => {
    setItinerarySearchTerm("");
    setFilteredItineraryList(itineraryList);
    setShowItineraryModal(true);
  };

  const handleCloseItineraryModal = () => {
    setShowItineraryModal(false);
    setItinerarySearchTerm("");
    setExpandedDescriptions({});
  };

  const handleItineraryToggle = (itineraryId) => {
    setSelectedItineraries((prev) => {
      if (prev.includes(itineraryId)) {
        return prev.filter((id) => id !== itineraryId);
      } else {
        return [...prev, itineraryId];
      }
    });
  };

  // If no state, show prompt
  if (!hasValidState) {
    return (
      <div className="min-vh-100 bg-light d-flex flex-column">
        <TopBar />
        <div className="d-flex flex-grow-1">
          <Sidebar />
          <main className="flex-grow-1 p-4 d-flex justify-content-center align-items-center">
            <Card className="text-center p-5 shadow-sm border-0 rounded-4">
              <Card.Body>
                <FaTicketAlt className="display-4 text-warning mb-3" />
                <h4 className="fw-bold mb-3">No Activity Selected</h4>
                <p className="text-muted mb-4">Please select an activity from the search page first.</p>
                <Button variant="primary" onClick={() => navigate("/new-booking/tours-and-activities")}>
                  Go to Activity Search
                </Button>
              </Card.Body>
            </Card>
          </main>
        </div>
      </div>
    );
  }

  const totalRate = activity.totalRate || activity.totalRateWithoutMrk || 0;

  const handlePrimaryGuestChange = (field, value) => {
    setPrimaryGuest((prev) => ({ ...prev, [field]: value }));

    // Real-time validation for email format
    if (field === "emailId" && value.trim() !== "") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        setValidationErrors((prev) => ({
          ...prev,
          emailId: "Please enter a valid email address",
        }));
        return;
      }
    }

    // Clear validation error when user starts typing
    const errorKey = field;
    if (validationErrors[errorKey]) {
      setValidationErrors((prev) => {
        const updated = { ...prev };
        delete updated[errorKey];
        return updated;
      });
    }
  };

  const validateForm = () => {
    const errors = {};
    let hasErrors = false;

    if (!primaryGuest.salutation || primaryGuest.salutation.trim() === "") {
      errors.salutation = "Salutation is required";
      hasErrors = true;
    }
    if (!primaryGuest.firstName || primaryGuest.firstName.trim() === "") {
      errors.firstName = "First Name is required";
      hasErrors = true;
    }
    if (!primaryGuest.lastName || primaryGuest.lastName.trim() === "") {
      errors.lastName = "Last Name is required";
      hasErrors = true;
    }
    if (!primaryGuest.contactNumber || primaryGuest.contactNumber.trim() === "") {
      errors.contactNumber = "Contact Number is required";
      hasErrors = true;
    }
    if (!primaryGuest.emailId || primaryGuest.emailId.trim() === "") {
      errors.emailId = "Email Id is required";
      hasErrors = true;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(primaryGuest.emailId)) {
      errors.emailId = "Please enter a valid email address";
      hasErrors = true;
    }
    if (!primaryGuest.lpo || primaryGuest.lpo.trim() === "") {
      errors.lpo = "LPO is required";
      hasErrors = true;
    }

    // Each pax row needs first + last name; adult rows also need a
    // salutation. Children can leave salutation blank.
    guests.forEach((g, idx) => {
      if (!g.firstName || !g.firstName.trim()) {
        errors[`guest_${idx}_firstName`] = "Required";
        hasErrors = true;
      }
      if (!g.lastName || !g.lastName.trim()) {
        errors[`guest_${idx}_lastName`] = "Required";
        hasErrors = true;
      }
      if (!g.isChild && (!g.salutation || !g.salutation.trim())) {
        errors[`guest_${idx}_salutation`] = "Required";
        hasErrors = true;
      }
    });

    return { errors, hasErrors };
  };

  const formatDateToDDMMYYYY = (dateString) => {
    if (!dateString) return "";
    try {
      let date;
      if (dateString.includes("/")) {
        return dateString.replace(/\//g, "-");
      } else if (dateString.includes("-") && dateString.split("-")[0].length === 4) {
        // YYYY-MM-DD to DD-MM-YYYY
        const [y, m, d] = dateString.split("-");
        return `${d}-${m}-${y}`;
      } else {
        date = new Date(dateString);
      }
      if (isNaN(date.getTime())) return dateString;
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch {
      return dateString;
    }
  };

  const confirmBooking = async () => {
    const { errors, hasErrors } = validateForm();

    if (hasErrors) {
      setValidationErrors(errors);
      toast.error("Please fill in all required fields correctly.");
      return;
    }

    setIsSubmitting(true);
    try {
      const agentId = sessionStorage.getItem("makeYourOwnPackageAgentId") 
                   || localStorage.getItem("makeYourOwnPackageAgentId")
                   || "1";

      const userId = sessionStorage.getItem("userId") || localStorage.getItem("userId") || "1";

      const payload = {
        activityId: activity.id || activity.activityId,
        tourDate: formatDateToDDMMYYYY(searchCriteria.tourDate),
        noOfAdult: parseInt(searchCriteria.adults),
        noOfChild: parseInt(searchCriteria.children),
        childAgeArray: (searchCriteria.childAges || []).map(age => String(age)),
        sellingPrice: String(totalRate),
        totalPrice: String(totalRate),
        agentId: parseInt(agentId),
        userId: parseInt(userId),
        customerDTO: {
          salutation: primaryGuest.salutation,
          firstName: primaryGuest.firstName,
          lastName: primaryGuest.lastName,
          contactNumber: primaryGuest.contactNumber,
          emailId: primaryGuest.emailId,
          passportNumber: primaryGuest.passportNumber,
          lpo: primaryGuest.lpo
        },
        // Full pax manifest — backend can persist into activity_guest
        // once the schema lands. Today's backend ignores unknown
        // fields, so sending this is forward-compatible.
        guests: guests.map((g, idx) => ({
          salutation: g.salutation || null,
          firstName: g.firstName || null,
          middleName: g.middleName || null,
          lastName: g.lastName || null,
          gender: g.gender || null,
          isChild: !!g.isChild,
          age: g.age != null ? Number(g.age) : null,
          passportNo: g.passportNo || null,
          guestIndex: g.isChild ? idx - totalAdults + 1 : idx + 1,
        })),
        customBookingItinearyDTO: selectedItineraries.map(id => ({
          itinearyId: parseInt(id),
          days: 1
        }))
      };

      console.log("Activity Booking Payload:", payload);
      const response = await axiosInstance.post("/api/activity/book", payload);

      if (response && (response.data?.success !== false && response.status === 200)) {
        toast.success("Activity booked successfully!");
        navigate("/booking-details/activity-booking-list"); // Or to a booking success list page
      } else {
        toast.error(response.data?.message || "Failed to book activity.");
      }
    } catch (error) {
      console.error("Booking error:", error);
      toast.error("An error occurred during booking. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat("en-AE", {
      style: "currency",
      currency: "AED",
    }).format(price || 0);
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Container fluid className="px-0">
            <h4 className="fw-bold mb-4 text-primary">Activity Booking Checkout</h4>
            
            <Row className="g-4">
              {/* Left Column: Guest Details */}
              <Col lg={8}>
                {/* Itinerary Option Section */}
                <Card className="shadow-sm border-0 rounded-4 mb-4 overflow-hidden">
                  <Card.Header className="bg-white border-bottom-0 pt-4 pb-2 px-4 d-flex justify-content-between align-items-center">
                    <div>
                      <h5 className="fw-bold text-dark d-flex align-items-center m-0">
                        <FaRoute className="me-2 text-primary" />
                        Itinerary Option
                      </h5>
                      <small className="text-muted">Select additional plans for your activity on {searchCriteria.tourDate}</small>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      className="rounded-circle shadow-sm btn-add-itinerary"
                      onClick={handleOpenItineraryModal}
                    >
                      <FaPlus />
                    </Button>
                  </Card.Header>
                  <Card.Body className="px-4 pb-4 pt-2">
                    {/* Selected Itineraries Preview */}
                    {selectedItineraries.length > 0 ? (
                      <div className="selected-itineraries-list mt-2">
                        {selectedItineraries.map((itineraryId) => {
                          const itinerary = itineraryList.find((item) => item.itineraryId === itineraryId);
                          if (!itinerary) return null;
                          return (
                            <div key={itineraryId} className="itinerary-chip d-inline-flex align-items-center me-2 mb-2 px-3 py-2 bg-primary-subtle rounded-pill border border-primary border-opacity-10">
                              <FaCheckCircle className="text-primary me-2" size={14} />
                              <span className="small fw-semibold text-primary">{itinerary.itineraryHeading || "Untitled"}</span>
                              <Button
                                variant="link"
                                size="sm"
                                className="text-primary p-0 ms-2 text-decoration-none lh-1"
                                onClick={() => handleItineraryToggle(itineraryId)}
                                style={{ fontSize: '1.2rem' }}
                              >
                                &times;
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="empty-itinerary text-center py-3 bg-light rounded-4 border border-dashed">
                        <small className="text-muted">No itineraries selected. Click the add button to enhance your trip.</small>
                      </div>
                    )}
                  </Card.Body>
                </Card>

                {/* ── Pax Manifest ─────────────────────────────────────
                     One compact row per traveller (Adult 1..N, Child
                     1..M). Adult 1 mirrors the Primary Guest card
                     below — name/salutation flow both ways so the
                     operator types each detail only once. */}
                {guests.length > 0 && (
                  <Card className="shadow-sm border-0 rounded-4 mb-4">
                    <Card.Header className="bg-white border-bottom-0 pt-3 pb-1 px-4">
                      <h6 className="fw-bold text-dark d-flex align-items-center m-0">
                        <FaUsers className="me-2 text-primary" />
                        Passenger Details
                        <span className="text-muted small ms-2 fw-normal">
                          ({totalAdults} Adult{totalAdults !== 1 ? "s" : ""}
                          {totalChildren > 0
                            ? `, ${totalChildren} Child${totalChildren !== 1 ? "ren" : ""}`
                            : ""}
                          )
                        </span>
                      </h6>
                      <small className="text-muted">
                        Adult 1 will auto-fill the Primary Guest card below.
                      </small>
                    </Card.Header>
                    <Card.Body className="px-4 pt-2 pb-3">
                      {guests.map((g, idx) => {
                        const adultSeat = idx + 1;
                        const childSeat = idx - totalAdults + 1;
                        const label = g.isChild
                          ? `Child ${childSeat}${g.age != null ? ` (Age ${g.age})` : ""}`
                          : `Adult ${adultSeat}`;
                        return (
                          <Row key={idx} className="g-2 align-items-center mb-2">
                            <Col xs={12} md={2}>
                              <span className="fw-semibold text-muted small">
                                {label}
                                {idx === 0 && (
                                  <span className="text-danger ms-1">*</span>
                                )}
                                {idx === 0 && (
                                  <Badge
                                    bg="primary-subtle"
                                    text="primary"
                                    className="ms-2"
                                    style={{ fontSize: "0.6rem" }}
                                  >
                                    Primary
                                  </Badge>
                                )}
                              </span>
                            </Col>
                            <Col xs={6} md={2}>
                              <Form.Select
                                size="sm"
                                value={g.salutation}
                                onChange={(e) =>
                                  handleGuestChange(idx, "salutation", e.target.value)
                                }
                                isInvalid={!!validationErrors[`guest_${idx}_salutation`]}
                              >
                                <option value="">Title</option>
                                {g.isChild ? (
                                  <>
                                    <option value="Mstr">Mstr</option>
                                    <option value="Miss">Miss</option>
                                  </>
                                ) : (
                                  <>
                                    <option value="Mr">Mr</option>
                                    <option value="Mrs">Mrs</option>
                                    <option value="Ms">Ms</option>
                                  </>
                                )}
                              </Form.Select>
                            </Col>
                            <Col xs={6} md={3}>
                              <Form.Control
                                size="sm"
                                type="text"
                                placeholder="First Name"
                                value={g.firstName}
                                onChange={(e) =>
                                  handleGuestChange(idx, "firstName", e.target.value)
                                }
                                isInvalid={!!validationErrors[`guest_${idx}_firstName`]}
                              />
                            </Col>
                            <Col xs={6} md={3}>
                              <Form.Control
                                size="sm"
                                type="text"
                                placeholder="Last Name"
                                value={g.lastName}
                                onChange={(e) =>
                                  handleGuestChange(idx, "lastName", e.target.value)
                                }
                                isInvalid={!!validationErrors[`guest_${idx}_lastName`]}
                              />
                            </Col>
                            <Col xs={6} md={2}>
                              <Form.Control
                                size="sm"
                                type="text"
                                placeholder="Passport (opt)"
                                value={g.passportNo}
                                onChange={(e) =>
                                  handleGuestChange(idx, "passportNo", e.target.value)
                                }
                              />
                            </Col>
                          </Row>
                        );
                      })}
                    </Card.Body>
                  </Card>
                )}

                <Card className="shadow-sm border-0 rounded-4 mb-4">
                  <Card.Header className="bg-white border-bottom-0 pt-4 pb-0 px-4">
                    <h5 className="fw-bold text-dark d-flex align-items-center m-0">
                      <FaUserAlt className="me-2 text-primary" />
                      Primary Guest Details
                    </h5>
                    <small className="text-muted">Auto-filled from Adult 1 above — add the contact details here</small>
                  </Card.Header>
                  <Card.Body className="p-4">
                    <Row className="g-3">
                      <Col md={2}>
                        <Form.Group>
                          <Form.Label className="small fw-semibold text-muted">Salutation <span className="text-danger">*</span></Form.Label>
                          <Form.Select
                            value={primaryGuest.salutation}
                            onChange={(e) => handlePrimaryGuestChange("salutation", e.target.value)}
                            isInvalid={!!validationErrors.salutation}
                          >
                            <option value="Mr">Mr</option>
                            <option value="Mrs">Mrs</option>
                            <option value="Ms">Ms</option>
                            <option value="Miss">Miss</option>
                            <option value="Dr">Dr</option>
                          </Form.Select>
                          <Form.Control.Feedback type="invalid">
                            {validationErrors.salutation}
                          </Form.Control.Feedback>
                        </Form.Group>
                      </Col>
                      <Col md={5}>
                        <Form.Group>
                          <Form.Label className="small fw-semibold text-muted">First Name <span className="text-danger">*</span></Form.Label>
                          <Form.Control
                            type="text"
                            placeholder="First name"
                            value={primaryGuest.firstName}
                            onChange={(e) => handlePrimaryGuestChange("firstName", e.target.value)}
                            isInvalid={!!validationErrors.firstName}
                          />
                          <Form.Control.Feedback type="invalid">
                            {validationErrors.firstName}
                          </Form.Control.Feedback>
                        </Form.Group>
                      </Col>
                      <Col md={5}>
                        <Form.Group>
                          <Form.Label className="small fw-semibold text-muted">Last Name <span className="text-danger">*</span></Form.Label>
                          <Form.Control
                            type="text"
                            placeholder="Last name"
                            value={primaryGuest.lastName}
                            onChange={(e) => handlePrimaryGuestChange("lastName", e.target.value)}
                            isInvalid={!!validationErrors.lastName}
                          />
                          <Form.Control.Feedback type="invalid">
                            {validationErrors.lastName}
                          </Form.Control.Feedback>
                        </Form.Group>
                      </Col>

                      <Col md={6}>
                        <Form.Group>
                          <Form.Label className="small fw-semibold text-muted">Contact Number <span className="text-danger">*</span></Form.Label>
                          <Form.Control
                            type="text"
                            placeholder="Contact number"
                            value={primaryGuest.contactNumber}
                            onChange={(e) => handlePrimaryGuestChange("contactNumber", e.target.value)}
                            isInvalid={!!validationErrors.contactNumber}
                          />
                          <Form.Control.Feedback type="invalid">
                            {validationErrors.contactNumber}
                          </Form.Control.Feedback>
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group>
                          <Form.Label className="small fw-semibold text-muted">Email ID <span className="text-danger">*</span></Form.Label>
                          <Form.Control
                            type="email"
                            placeholder="Email address"
                            value={primaryGuest.emailId}
                            onChange={(e) => handlePrimaryGuestChange("emailId", e.target.value)}
                            isInvalid={!!validationErrors.emailId}
                          />
                          <Form.Control.Feedback type="invalid">
                            {validationErrors.emailId}
                          </Form.Control.Feedback>
                        </Form.Group>
                      </Col>

                      <Col md={6}>
                        <Form.Group>
                          <Form.Label className="small fw-semibold text-muted">Passport Number <span className="text-muted fw-normal">(Optional)</span></Form.Label>
                          <Form.Control
                            type="text"
                            placeholder="Passport number"
                            value={primaryGuest.passportNumber}
                            onChange={(e) => handlePrimaryGuestChange("passportNumber", e.target.value)}
                          />
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group>
                          <Form.Label className="small fw-semibold text-muted">LPO Number <span className="text-danger">*</span></Form.Label>
                          <Form.Control
                            type="text"
                            placeholder="LPO number"
                            value={primaryGuest.lpo}
                            onChange={(e) => handlePrimaryGuestChange("lpo", e.target.value)}
                            isInvalid={!!validationErrors.lpo}
                          />
                          <Form.Control.Feedback type="invalid">
                            {validationErrors.lpo}
                          </Form.Control.Feedback>
                        </Form.Group>
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>
              </Col>

              {/* Right Column: Order Summary */}
              <Col lg={4}>
                <Card className="shadow-sm border-0 rounded-4 sticky-top overflow-hidden" style={{ top: "20px" }}>
                  <Card.Header className="bg-primary text-white border-bottom-0 p-4">
                    <h5 className="mb-0 fw-bold d-flex align-items-center">
                      <FaShoppingCart className="me-2" size={18} />
                      Booking Summary
                    </h5>
                  </Card.Header>
                  <Card.Body className="p-0">
                    {/* Activity Info */}
                    <div className="p-4 border-bottom">
                      <div className="d-flex mb-4">
                        <div className="me-3 position-relative" style={{ width: "84px", height: "84px" }}>
                          <img 
                            src={activity.activityImage || "https://via.placeholder.com/84?text=Activity"} 
                            alt={activity.activityName}
                            className="rounded-3 shadow-sm"
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        </div>
                        <div className="flex-grow-1">
                          <h6 className="fw-bold mb-1 text-dark lh-sm">{activity.activityName}</h6>
                          <div className="mt-2">
                            <span className="badge bg-primary-subtle text-primary rounded-pill px-3 py-1 fw-semibold small">
                              ID: {activity.id || activity.activityId}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="booking-info-grid bg-light rounded-4 p-3 mb-3 border border-light-subtle">
                        <div className="d-flex align-items-start mb-3">
                          <div className="icon-box bg-white rounded-3 p-2 shadow-sm me-3 border border-light">
                            <FaCalendarAlt className="text-primary" />
                          </div>
                          <div>
                            <small className="d-block text-muted fw-semibold">Tour Date</small>
                            <span className="fw-bold text-dark">{searchCriteria.tourDate}</span>
                          </div>
                        </div>
                        {activity.duration && (
                          <div className="d-flex align-items-start mb-3">
                            <div className="icon-box bg-white rounded-3 p-2 shadow-sm me-3 border border-light">
                              <FaClock className="text-warning" />
                            </div>
                            <div>
                              <small className="d-block text-muted fw-semibold">Duration</small>
                              <span className="fw-bold text-dark">{activity.duration} hrs</span>
                            </div>
                          </div>
                        )}
                        <div className="d-flex align-items-start">
                          <div className="icon-box bg-white rounded-3 p-2 shadow-sm me-3 border border-light">
                            <FaMapMarkerAlt className="text-danger" />
                          </div>
                          <div>
                            <small className="d-block text-muted fw-semibold">Destination</small>
                            <span className="fw-bold text-dark">{searchCriteria.destination?.label || "N/A"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="d-flex justify-content-between p-2 bg-light rounded-pill px-3">
                        <span className="small fw-semibold text-muted">Adults: <span className="text-dark">{searchCriteria.adults}</span></span>
                        <span className="small fw-semibold text-muted">Children: <span className="text-dark">{searchCriteria.children}</span></span>
                      </div>
                    </div>

                    {/* Price Summary */}
                    <div className="p-4 bg-light bg-opacity-50">
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <span className="text-muted fw-medium">Activity Fare</span>
                        <span className="fw-bold text-dark">{formatPrice(totalRate)}</span>
                      </div>
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <span className="text-muted fw-medium">Taxes & Fees</span>
                        <span className="fw-bold text-success gratuity-text">FREE</span>
                      </div>
                      
                      <div className="my-4 border-top border-light-subtle"></div>
                      
                      <div className="d-flex justify-content-between align-items-center">
                        <span className="fw-bold text-dark fs-5">Total Amount</span>
                        <div className="text-end">
                          <span className="d-block fw-bold text-primary fs-3">{formatPrice(totalRate)}</span>
                          <small className="text-muted" style={{ fontSize: '0.7rem' }}>Inclusive of all taxes</small>
                        </div>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <div className="p-4">
                      <Button
                        variant="success"
                        className="w-100 py-3 rounded-4 fw-bold fs-5 shadow-sm d-flex justify-content-center align-items-center btn-confirm"
                        onClick={confirmBooking}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <Spinner animation="border" size="sm" className="me-2" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <FaCheckCircle className="me-2" /> Confirm Booking
                          </>
                        )}
                      </Button>
                      <p className="text-center text-muted small mt-3 mb-0" style={{ fontSize: '0.75rem' }}>
                        By confirming, you agree to our <span className="text-primary cursor-pointer">Terms & Conditions</span>
                      </p>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </Container>
        </main>
      </div>

      {/* Itinerary Modal */}
      <Modal show={showItineraryModal} onHide={handleCloseItineraryModal} size="lg" centered className="itinerary-modal">
        <Modal.Header closeButton className="border-0 pb-0 px-4 pt-4">
          <Modal.Title className="fw-bold">Select Itinerary</Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4">
          <Form.Group className="mb-4">
            <div className="position-relative">
              <Form.Control
                type="text"
                placeholder="Search itineraries..."
                className="rounded-pill px-4"
                value={itinerarySearchTerm}
                onChange={(e) => setItinerarySearchTerm(e.target.value)}
              />
            </div>
          </Form.Group>

          <div className="itinerary-list" style={{ maxHeight: "450px", overflowY: "auto" }}>
            {loadingItinerary ? (
              <div className="text-center py-5">
                <Spinner animation="border" variant="primary" />
                <p className="mt-3 text-muted">Loading itineraries...</p>
              </div>
            ) : filteredItineraryList.length > 0 ? (
              filteredItineraryList.map((item) => (
                <div 
                  key={item.itineraryId} 
                  className={`itinerary-item p-3 mb-2 rounded-4 border transition-all cursor-pointer ${selectedItineraries.includes(item.itineraryId) ? "border-primary bg-primary-subtle" : "border-light bg-white"}`}
                  onClick={() => handleItineraryToggle(item.itineraryId)}
                >
                  <div className="d-flex align-items-center">
                    <div className="form-check me-3">
                      <input 
                        type="checkbox" 
                        className="form-check-input mt-0" 
                        checked={selectedItineraries.includes(item.itineraryId)}
                        readOnly
                      />
                    </div>
                    <div className="flex-grow-1">
                      <h6 className="fw-bold mb-1">{item.itineraryHeading}</h6>
                      <div className={`small text-muted ${expandedDescriptions[item.itineraryId] ? "" : "text-truncate"}`} style={{ maxWidth: "600px" }}>
                        {item.itineraryDesc}
                      </div>
                      {item.itineraryDesc && item.itineraryDesc.length > 100 && (
                        <Button 
                          variant="link" 
                          size="sm" 
                          className="p-0 mt-1 text-primary text-decoration-none small"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedDescriptions(prev => ({ ...prev, [item.itineraryId]: !prev[item.itineraryId] }));
                          }}
                        >
                          {expandedDescriptions[item.itineraryId] ? "Show Less" : "Read More"}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-5">
                <p className="text-muted">No itineraries found matching your search.</p>
              </div>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer className="border-0 p-4">
          <Button variant="light" className="rounded-pill px-4" onClick={handleCloseItineraryModal}>
            Cancel
          </Button>
          <Button variant="primary" className="rounded-pill px-4 fw-bold" onClick={handleCloseItineraryModal}>
            Done
          </Button>
        </Modal.Footer>
      </Modal>

      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --primary-soft: rgba(13, 110, 253, 0.08);
          --primary-border: rgba(13, 110, 253, 0.15);
        }
        .cursor-pointer { cursor: pointer; }
        .itinerary-item:hover { border-color: #0d6efd !important; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .transition-all { transition: all 0.2s ease; }
        .bg-primary-subtle { background-color: var(--primary-soft) !important; }
        .border-dashed { border-style: dashed !important; border-width: 2px !important; }
        .itinerary-chip { transition: all 0.2s ease; }
        .itinerary-chip:hover { background-color: rgba(13, 110, 253, 0.12) !important; }
        .btn-add-itinerary {
          width: 32px;
          height: 32px;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s ease;
        }
        .btn-add-itinerary:hover { transform: scale(1.1); }
        .form-control, .form-select {
          border-color: #e9ecef;
          padding: 0.6rem 1rem;
          font-size: 0.95rem;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .form-control:focus, .form-select:focus {
          border-color: #0d6efd;
          box-shadow: 0 0 0 4px rgba(13, 110, 253, 0.1);
        }
        .itinerary-modal .modal-content {
          border-radius: 1.5rem;
          border: none;
        }
        .icon-box {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .btn-confirm {
          transition: all 0.3s ease;
          background: linear-gradient(135deg, #198754 0%, #146c43 100%);
          border: none;
        }
        .btn-confirm:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(25, 135, 84, 0.2) !important;
        }
        .gratuity-text {
          font-size: 0.8rem;
          letter-spacing: 1px;
        }
      `}} />
    </div>
  );
};

export default ActivityBookingPage;