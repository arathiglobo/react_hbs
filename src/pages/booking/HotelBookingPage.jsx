import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaHotel,
  FaCalendarAlt,
  FaUsers,
  FaUtensils,
  FaUserTie,
} from "react-icons/fa";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import "../../styles/HotelBookingPage.css";
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  Accordion,
  Badge,
  Alert,
  Modal,
} from "react-bootstrap";
import axiosInstance from "../../components/AxiosInstance";
import toast from "react-hot-toast";
import { toLocalDateTime, formatDateTime } from "../../utils/dateUtils";

const SPECIAL_REQUEST_OPTIONS = [
  "Early Check-In",
  "Non-Smoking Rooms",
  "High Floor",
  "VIP Client",
  "Late Check-In",
  "Inter-connecting rooms",
  "Low Floor",
  "Room with Bathtub",
  "Late check-Out",
  "Honeymooners / Anniversary",
  "Smoking Room",
];

const HotelBookingPage = () => {
  const navigate = useNavigate();

  let activeUserRole = localStorage.getItem("currentActiveRole");
  console.log("currentActiveRole::", activeUserRole);

  const [bookingData, setBookingData] = useState(null);
  const [agentAvailableBalance, setAgentAvailableBalance] = useState(null);
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
    employeeId: "",
  });
  const [validationErrors, setValidationErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingPayload, setPendingPayload] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [tourismDirhams, setTourismDirhams] = useState("0");
  const [remarks, setRemarks] = useState("");
  const [specialRequests, setSpecialRequests] = useState([]);
  const [bookingConfirmation, setBookingConfirmation] =
    useState("Book & Voucher");
  // Policy + T&C consent flow
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [policyData, setPolicyData] = useState(null);
  const [termsAndConditions, setTermsAndConditions] = useState("");
  const [policiesLoading, setPoliciesLoading] = useState(false);
  const [policyAccepted, setPolicyAccepted] = useState(false);

  // Fetch employees list
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await axiosInstance.get("/api/employee?page=0&limit=1000");
        if (res.data && Array.isArray(res.data)) {
          setEmployees(res.data);
        }
      } catch (error) {
        console.error("Error fetching employees:", error);
      }
    };
    fetchEmployees();
  }, []);

  // Fetch the selected agent's available credit balance for display
  useEffect(() => {
    const aId = bookingData?.payload?.agentId;
    if (!aId) {
      setAgentAvailableBalance(null);
      return;
    }
    let cancelled = false;
    axiosInstance
      .get(`/api/agent-credit-limit/agent/${aId}`)
      .then((res) => {
        if (!cancelled)
          setAgentAvailableBalance(res?.data?.availableCreditLimit ?? null);
      })
      .catch(() => {
        if (!cancelled) setAgentAvailableBalance(null);
      });
    return () => {
      cancelled = true;
    };
  }, [bookingData]);

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

    // Auto-populate Primary Guest if Room 1 Adult 1
    if (roomIndex === 0 && guestIndex === 0) {
      if (["salutation", "firstName", "lastName"].includes(field)) {
        setPrimaryGuest((prev) => ({
          ...prev,
          [field]: value,
        }));

        // Clear validation error for primary guest field
        if (validationErrors[field]) {
          setValidationErrors((prev) => {
            const updated = { ...prev };
            delete updated[field];
            return updated;
          });
        }
      }
    }

    // Clear validation error when user starts typing
    const guestKey = `room_${roomIndex}_guest_${guestIndex}_${field}`;
    if (validationErrors[guestKey]) {
      setValidationErrors((prev) => {
        const updated = { ...prev };
        delete updated[guestKey];
        return updated;
      });
    }
  };

  const handlePrimaryGuestChange = (field, value) => {
    setPrimaryGuest((prev) => ({ ...prev, [field]: value }));

    // Real-time validation for email format
    if (field === "email" && value.trim() !== "") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        setValidationErrors((prev) => ({
          ...prev,
          email: "Please enter a valid email address",
        }));
        return;
      }
    }

    // Real-time validation for phone length
    if (field === "phone" && value.trim() !== "") {
      if (value.trim().length > 15) {
        setValidationErrors((prev) => ({
          ...prev,
          phone: "Phone number cannot exceed 15 digits",
        }));
        return;
      }
    }

    // Clear validation error when user starts typing
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const updated = { ...prev };
        delete updated[field];
        return updated;
      });
    }
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

  const validateForm = () => {
    const errors = {};
    let hasErrors = false;

    // Validate Primary Guest fields
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
    if (!primaryGuest.email || primaryGuest.email.trim() === "") {
      errors.email = "Email is required";
      hasErrors = true;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(primaryGuest.email)) {
      errors.email = "Please enter a valid email address";
      hasErrors = true;
    }
    if (!primaryGuest.phone || primaryGuest.phone.trim() === "") {
      errors.phone = "Phone is required";
      hasErrors = true;
    } else if (primaryGuest.phone.trim().length > 15) {
      errors.phone = "Phone number cannot exceed 15 digits";
      hasErrors = true;
    }
    if (!primaryGuest.agentLpo || primaryGuest.agentLpo.trim() === "") {
      errors.agentLpo = "Agent LPO is required";
      hasErrors = true;
    }

    // Validate Guest fields in rooms
    rooms.forEach((room, roomIndex) => {
      room.guests.forEach((guest, guestIndex) => {
        const guestKey = `room_${roomIndex}_guest_${guestIndex}`;

        if (!guest.salutation || guest.salutation.trim() === "") {
          errors[`${guestKey}_salutation`] = "Salutation is required";
          hasErrors = true;
        }
        if (!guest.firstName || guest.firstName.trim() === "") {
          errors[`${guestKey}_firstName`] = "First Name is required";
          hasErrors = true;
        }
        if (!guest.lastName || guest.lastName.trim() === "") {
          errors[`${guestKey}_lastName`] = "Last Name is required";
          hasErrors = true;
        }
        if (!guest.gender || guest.gender.trim() === "") {
          errors[`${guestKey}_gender`] = "Gender is required";
          hasErrors = true;
        }
      });
    });

    return { errors, hasErrors };
  };

  // const checkIn = new Date(bookingData.payload.checkInDate);
  // const checkOut = new Date(bookingData.payload.checkOutDate);

  // // // Calculate difference in milliseconds → convert to days
  // const nights = Math.max(
  //   1,
  //   Math.round((checkOut - checkIn) / (1000 * 60 * 60 * 24))
  // );

  // Step 1 in confirm flow: validate, fetch policies + T&C, show consent modal.
  const openPolicyConsent = async () => {
    const { errors, hasErrors } = validateForm();
    if (hasErrors) {
      setValidationErrors(errors);
      toast.error("Please fill in all required fields correctly.");
      return;
    }
    setValidationErrors({});

    const hotelId = bookingData?.selectedRate?.hotelId;
    if (!hotelId) {
      toast.error("Hotel reference missing — cannot fetch policies.");
      return;
    }

    setPolicyAccepted(false);
    setShowPolicyModal(true);
    setPoliciesLoading(true);
    try {
      const [policiesRes, termsRes] = await Promise.allSettled([
        axiosInstance.get(`/api/hotels/${hotelId}/policies`),
        axiosInstance.get(`/api/hotels/${hotelId}/terms-and-conditions`),
      ]);

      if (policiesRes.status === "fulfilled") {
        setPolicyData(policiesRes.value?.data || null);
      } else {
        setPolicyData(null);
      }

      if (termsRes.status === "fulfilled") {
        const d = termsRes.value?.data;
        // Accept multiple shapes:
        //  - List<{description}>   ← current backend
        //  - List of plain strings
        //  - Plain string
        //  - { termsAndConditions } / { data } / { message }
        let tc = "";
        if (Array.isArray(d)) {
          tc = d
            .map((row) =>
              typeof row === "string" ? row : row?.description || "",
            )
            .filter(Boolean)
            .join("\n\n");
        } else if (typeof d === "string") {
          tc = d;
        } else {
          tc =
            d?.termsAndConditions ||
            d?.terms ||
            d?.data ||
            d?.message ||
            "";
        }
        setTermsAndConditions(tc);
      } else {
        setTermsAndConditions("");
      }
    } catch (err) {
      console.error("policies/T&C fetch error", err);
    } finally {
      setPoliciesLoading(false);
    }
  };

  // Step 2: user accepted policies → build payload + show order summary modal.
  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    const { errors, hasErrors } = validateForm();

    if (hasErrors) {
      setValidationErrors(errors);
      toast.error("Please fill in all required fields correctly.");
      return;
    }

    // ✅ Clear validation errors before submission
    setValidationErrors({});

    try {
      setIsSubmitting(true);

      // ---------------------------
      // ✅ Construct booking payload
      // ---------------------------

      // Calculate nights difference between check-in and check-out
      const cinStr = toLocalDateTime(bookingData.payload.checkInDate);
      const coutStr = toLocalDateTime(bookingData.payload.checkOutDate);
      const checkIn = new Date(cinStr);
      const checkOut = new Date(coutStr);
      const nights = Math.max(
        1,
        Math.round((checkOut - checkIn) / (1000 * 60 * 60 * 24)),
      );

      const payload = {
        agentId: bookingData.payload.agentId || null,
        apiId: bookingData.payload.apiId || null,
        hotelId: selectedRate.hotelId,
        hotelName: bookingData.hotelStaticData.hotelName,
        address: bookingData.hotelStaticData.address,
        starRating: bookingData.hotelStaticData.starRating,
        checkInDate: cinStr,
        checkOutDate: coutStr,
        nights: nights,
        employeeId: primaryGuest.employeeId || null,
        roomStatus: bookingData.selectedRate.roomStatus,
        cancellationPolicy:
          bookingData.selectedRate.cancellationPolicy?.map(
            (p) => p.policyText,
          ) || [],

        // Calculate deadlineDate based on nonRefundable and cancellationPolicy
        deadlineDate: (() => {
          const nonRefundable =
            bookingData.selectedRate.nonRefundable === true ||
            bookingData.selectedRate.nonRefundable === "true";

          if (nonRefundable === true) {
            // 2 days before current date
            const today = new Date();
            const deadline = new Date(today);
            deadline.setDate(today.getDate() - 2);
            deadline.setHours(0, 0, 0, 0); // Set to midnight
            const year = deadline.getFullYear();
            const month = String(deadline.getMonth() + 1).padStart(2, "0");
            const day = String(deadline.getDate()).padStart(2, "0");
            return `${year}-${month}-${day}T00:00:00`;
          } else {
            // 2 days before earliest fromDate from cancellationPolicy
            const policies = bookingData.selectedRate.cancellationPolicy || [];
            if (policies.length === 0) {
              return null;
            }

            // Find earliest fromDate
            const dates = policies
              .map((p) => (p.fromDate ? new Date(p.fromDate) : null))
              .filter((date) => date !== null && !isNaN(date.getTime()));

            if (dates.length === 0) {
              return null;
            }

            const earliestDate = new Date(
              Math.min(...dates.map((d) => d.getTime())),
            );
            const deadline = new Date(earliestDate);
            deadline.setDate(earliestDate.getDate() - 2);
            deadline.setHours(0, 0, 0, 0); // Set to midnight
            const year = deadline.getFullYear();
            const month = String(deadline.getMonth() + 1).padStart(2, "0");
            const day = String(deadline.getDate()).padStart(2, "0");
            return `${year}-${month}-${day}T00:00:00`;
          }
        })(),
        // New Payload Mapping Logic (Around line 331)
        isBookandVoucher: (() => {
          if (selectedRate.roomStatus === "Available") {
            // User selects from radio buttons when available
            return bookingConfirmation === "Book & Voucher" ? true : false;
          } else {
            // For "On Request" or any other status, avoid pushing inappropriate voucher flags
            // Adjust this fallback to what's expected by the backend for "On Request"
            return false;
          }
        })(),

        // ✅ Primary guest details
        primaryGuest: {
          salutation: primaryGuest.salutation,
          firstName: primaryGuest.firstName,
          middleName: primaryGuest.middleName,
          lastName: primaryGuest.lastName,
          email: primaryGuest.email,
          phone: primaryGuest.phone,
          passportNo: primaryGuest.passportNo,
          agentLpo: primaryGuest.agentLpo,
          nativeCountry: bookingData.payload.nationality,
        },

        // ✅ Room & guest breakdown
        rooms: rooms.map((room, roomIndex) => ({
          roomNo: roomIndex + 1,
          roomCategory: bookingData.selectedRate.roomCategory, // per room
          mealPlan: bookingData.selectedRate.mealPlan,
          nonRefundable:
            bookingData.selectedRate.nonRefundable === true ||
            bookingData.selectedRate.nonRefundable === "true"
              ? true
              : false,
          currency: bookingData.selectedRate.currency || "AED",
          rate: bookingData.selectedRate.rate,
          rateWithoutMarkup: bookingData.selectedRate.rateWithoutMarkup,
          adults: room.adults,
          children: room.children,
          childAges: room.childAges || [],
          guests: room.guests.map((guest) => ({
            salutation: guest.salutation,
            firstName: guest.firstName,
            middleName: guest.middleName || "",
            lastName: guest.lastName,
            gender: guest.gender,
            isChild: guest.isChild,
          })),
        })),

        // ✅ Additional remarks
        remarks: remarks || "",
        specialRequests: specialRequests,
        tourismDirhams: parseFloat(tourismDirhams) || 0,
        bookingConfirmation: bookingConfirmation || "Book & Voucher",

        // Parent booking code for Edit -> Search -> Book Again flow.
        // When set, backend generates child bookingCode like GLBIN37/1, GLBIN37/2...
        parentBookingCode: bookingData.payload.parentBookingCode || null,

        // ── 24 Hour Check-In: forward the optional flags from the search
        //    handoff payload through to the booking-create endpoint. The
        //    backend stamps these onto the HotelBooking row when present.
        //    Existing flows leave is24HourCheckin = false / times = null.
        is24HourCheckin: !!bookingData.payload.is24HourCheckin,
        checkInTime: bookingData.payload.checkInTime || null,
        checkOutTime: bookingData.payload.checkOutTime || null,

        // ✅ Metadata
      };

      console.log("📦 Final booking payload:", payload);
      setPendingPayload(payload);
      setShowConfirmModal(true);
    } catch (err) {
      console.error("booking payload error", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ Confirm and post API only on OK
  const confirmBooking = async () => {
    if (!pendingPayload) return;
    setShowConfirmModal(false);
    setIsSubmitting(true);

    try {
      // ✅ Step 1: Check agent credit status
      const agentId = pendingPayload.agentId;
      const requiredAmount = pendingPayload.rooms.reduce(
        (sum, r) => sum + (r.rate || 0),
        0,
      );

      console.log(
        "🔍 Checking credit for Agent:",
        agentId,
        "Amount:",
        requiredAmount,
      );

      const creditResponse = await axiosInstance.get(
        `/api/agent-credit-limit/check-sufficient-credit?agentId=${agentId}&requiredAmount=${requiredAmount}`,
      );

      if (creditResponse.data === false) {
        // ❌ Not enough credit — show Bootbox alert

        toast.error("Insufficient credit. Please proceed with online payment.");

        // bootbox.alert({
        //   title: "Insufficient Credit",
        //   message:
        //     "Your available credit is insufficient for this booking.<br/>Please proceed with <strong>online payment</strong>.",
        //   centerVertical: true,
        //   closeButton: false,
        //   buttons: {
        //     ok: {
        //       label: "OK",
        //       className: "btn-primary",
        //     },
        //   },
        // });
        return; // stop here
      }

      // ✅ Step 2: Proceed to confirm booking
      console.log("✅ Credit check passed. Proceeding with booking...");

      const response = await axiosInstance.post(
        "/api/hotel-booking/create",
        pendingPayload,
      );

      const bookingResponse = response.data;
      console.log("response:::", response);
      console.log("bookingResponse:::", bookingResponse);
      if (
        bookingResponse &&
        bookingResponse.status &&
        (bookingResponse.status.toUpperCase() === "CONFIRMED" ||
          bookingResponse.status.toUpperCase() === "NOT CONFIRMED") &&
        bookingResponse.bookingId != 0
      ) {
        toast.success(bookingResponse.message);
        navigate("/booking-details/hotel-booking-list");
      } else {
        toast.error("Booking submission failed. Please try again.");
      }
    } catch (err) {
      console.error("❌ Error in booking confirmation:", err);
      toast.error("Booking submission failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatPrice = (price) =>
    new Intl.NumberFormat("en-AE", {
      style: "currency",
      currency: "AED",
    }).format(price);

  const handleSpecialRequestToggle = (request) => {
    setSpecialRequests((prevRequests) =>
      prevRequests.includes(request)
        ? prevRequests.filter((item) => item !== request)
        : [...prevRequests, request],
    );
  };

  if (!bookingData) return <div>Loading booking data...</div>;

  const { hotelStaticData, payload, selectedRate } = bookingData;
  const tourismDirhamsAmount = parseFloat(tourismDirhams) || 0;
  const sellingPriceWithTd =
    (selectedRate?.roomRateBasedOnRoomCount || 0) + tourismDirhamsAmount;
  const totalPriceWithTd =
    (selectedRate?.roomRateBasedOnRoomCount_WithoutMarkup || 0) +
    tourismDirhamsAmount;
  console.log("bookingData:::", bookingData);

  return (
    <div className="min-vh-100 bg-light d-flex flex-column  hotel-booking-container">
      <TopBar />
      <div className="main-content">
        <Sidebar />
        <main className="content-wrapper py-4">
          <Container fluid="xl">
            {agentAvailableBalance != null && (
              <div className="d-flex justify-content-end mb-2">
                <span
                  className="fw-bold"
                  style={{ color: "#dc3545", fontSize: "0.95rem" }}
                >
                  Available Balance: {Number(agentAvailableBalance).toFixed(2)}
                </span>
              </div>
            )}
            {/* Guest Details Section */}
            <Form onSubmit={(e) => { e.preventDefault(); openPolicyConsent(); }}>
              <Row className="g-3">
                <Col lg={8} className="hbp-left-col">
                  {/* {Object.keys(validationErrors).length > 0 && (
                <Alert variant="danger" className="mb-3 d-flex align-items-center">
                  <strong className="me-2">✕</strong>
                  <div>
                    <Alert.Heading className="mb-0">
                      Please fix the validation errors
                    </Alert.Heading>
                  </div>
                </Alert>
              )} */}
                  <Card className="mb-2 shadow-sm border-0">
                    <Card.Header className="bg-light py-2">
                      <div className="d-flex align-items-center">
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          onClick={() => navigate("/room-list")}
                          className="me-3"
                        >
                          ← Back
                        </Button>

                        <h5 className="mb-0 fw-bold text-dark">
                          Guest Details
                        </h5>
                      </div>
                    </Card.Header>
                    <Card.Body className="p-0">
                      <Accordion
                        alwaysOpen
                        defaultActiveKey={rooms.map((_, i) => i.toString())}
                        className="guest-details-accordion"
                      >
                        {rooms.map((room, roomIndex) => (
                          <Accordion.Item
                            key={roomIndex}
                            eventKey={roomIndex.toString()}
                            className="mb-3 guest-room-item"
                          >
                            <Accordion.Header className="bg-primary text-white">
                              <h6 className="mb-0 fw-bold w-100 d-flex flex-wrap align-items-center gap-2">
                                <span>
                                  Room {roomIndex + 1} -{" "}
                                  {selectedRate.roomCategory}
                                </span>
                                {selectedRate?.mealPlan && (
                                  <Badge
                                    bg="light"
                                    text="dark"
                                    className="ms-2"
                                  >
                                    <FaUtensils className="me-1" />
                                    {selectedRate.mealPlan}
                                  </Badge>
                                )}
                              </h6>
                            </Accordion.Header>
                            <Accordion.Body className="p-4">
                              {room.guests.map((guest, guestIndex) => (
                                <div
                                  key={guestIndex}
                                  className="guest-row mb-3"
                                >
                                  <Row className="align-items-center g-2">
                                    <Col md={2}>
                                      <span className="fw-semibold text-muted">
                                        {guest.isChild
                                          ? `Child ${
                                              guestIndex - room.adults + 1
                                            } (Age: ${
                                              room.childAges[
                                                guestIndex - room.adults
                                              ]
                                            })`
                                          : `Adult ${guestIndex + 1}`}{" "}
                                        *
                                      </span>
                                    </Col>
                                    <Col md={2}>
                                      <Form.Select
                                        value={guest.salutation}
                                        onChange={(e) =>
                                          handleGuestChange(
                                            roomIndex,
                                            guestIndex,
                                            "salutation",
                                            e.target.value,
                                          )
                                        }
                                        className="form-control-sm"
                                        isInvalid={
                                          !!validationErrors[
                                            `room_${roomIndex}_guest_${guestIndex}_salutation`
                                          ]
                                        }
                                      >
                                        <option value="">SELECT</option>
                                        <option value="Mr">Mr</option>
                                        <option value="Mrs">Mrs</option>
                                        <option value="Ms">Ms</option>
                                        <option value="Dr">Master</option>
                                      </Form.Select>
                                      {validationErrors[
                                        `room_${roomIndex}_guest_${guestIndex}_salutation`
                                      ] && (
                                        <Form.Control.Feedback type="invalid">
                                          {
                                            validationErrors[
                                              `room_${roomIndex}_guest_${guestIndex}_salutation`
                                            ]
                                          }
                                        </Form.Control.Feedback>
                                      )}
                                    </Col>
                                    <Col md={3}>
                                      <Form.Control
                                        type="text"
                                        placeholder="First Name *"
                                        value={guest.firstName}
                                        onChange={(e) =>
                                          handleGuestChange(
                                            roomIndex,
                                            guestIndex,
                                            "firstName",
                                            e.target.value,
                                          )
                                        }
                                        className="form-control-sm"
                                        isInvalid={
                                          !!validationErrors[
                                            `room_${roomIndex}_guest_${guestIndex}_firstName`
                                          ]
                                        }
                                      />
                                      {validationErrors[
                                        `room_${roomIndex}_guest_${guestIndex}_firstName`
                                      ] && (
                                        <Form.Control.Feedback type="invalid">
                                          {
                                            validationErrors[
                                              `room_${roomIndex}_guest_${guestIndex}_firstName`
                                            ]
                                          }
                                        </Form.Control.Feedback>
                                      )}
                                    </Col>
                                    <Col md={3}>
                                      <Form.Control
                                        type="text"
                                        placeholder="Last Name *"
                                        value={guest.lastName}
                                        onChange={(e) =>
                                          handleGuestChange(
                                            roomIndex,
                                            guestIndex,
                                            "lastName",
                                            e.target.value,
                                          )
                                        }
                                        className="form-control-sm"
                                        isInvalid={
                                          !!validationErrors[
                                            `room_${roomIndex}_guest_${guestIndex}_lastName`
                                          ]
                                        }
                                      />
                                      {validationErrors[
                                        `room_${roomIndex}_guest_${guestIndex}_lastName`
                                      ] && (
                                        <Form.Control.Feedback type="invalid">
                                          {
                                            validationErrors[
                                              `room_${roomIndex}_guest_${guestIndex}_lastName`
                                            ]
                                          }
                                        </Form.Control.Feedback>
                                      )}
                                    </Col>
                                    <Col md={2}>
                                      <Form.Select
                                        value={guest.gender}
                                        onChange={(e) =>
                                          handleGuestChange(
                                            roomIndex,
                                            guestIndex,
                                            "gender",
                                            e.target.value,
                                          )
                                        }
                                        className="form-control-sm"
                                        isInvalid={
                                          !!validationErrors[
                                            `room_${roomIndex}_guest_${guestIndex}_gender`
                                          ]
                                        }
                                      >
                                        <option value="">Gender</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Other</option>
                                      </Form.Select>
                                      {validationErrors[
                                        `room_${roomIndex}_guest_${guestIndex}_gender`
                                      ] && (
                                        <Form.Control.Feedback type="invalid">
                                          {
                                            validationErrors[
                                              `room_${roomIndex}_guest_${guestIndex}_gender`
                                            ]
                                          }
                                        </Form.Control.Feedback>
                                      )}
                                    </Col>
                                  </Row>
                                  {guestIndex < room.guests.length - 1 && (
                                    <hr className="my-3" />
                                  )}
                                </div>
                              ))}
                            </Accordion.Body>
                          </Accordion.Item>
                        ))}
                      </Accordion>
                    </Card.Body>
                  </Card>

                  {/* Primary Guest */}
                  <Card className="p-4 mb-4 shadow-sm border-0">
                    <h5 className="mb-3 fw-bold">Lead Passenger</h5>
                    <Row className="g-3">
                      <Col md={3}>
                        <Form.Group>
                          <Form.Label>
                            <span style={{ color: "red" }}>*</span>Salutation
                          </Form.Label>
                          <Form.Select
                            value={primaryGuest.salutation}
                            onChange={(e) =>
                              handlePrimaryGuestChange(
                                "salutation",
                                e.target.value,
                              )
                            }
                            isInvalid={!!validationErrors.salutation}
                          >
                            <option value="">Select</option>
                            <option value="Mr">Mr</option>
                            <option value="Mrs">Mrs</option>
                            <option value="Ms">Ms</option>
                            <option value="Dr">Dr</option>
                          </Form.Select>
                          {validationErrors.salutation && (
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.salutation}
                            </Form.Control.Feedback>
                          )}
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
                              handlePrimaryGuestChange(
                                "firstName",
                                e.target.value,
                              )
                            }
                            isInvalid={!!validationErrors.firstName}
                            required
                          />
                          {validationErrors.firstName && (
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.firstName}
                            </Form.Control.Feedback>
                          )}
                        </Form.Group>
                      </Col>
                      <Col md={3}>
                        <Form.Group>
                          <Form.Label>Middle Name</Form.Label>
                          <Form.Control
                            type="text"
                            value={primaryGuest.middleName}
                            onChange={(e) =>
                              handlePrimaryGuestChange(
                                "middleName",
                                e.target.value,
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
                              handlePrimaryGuestChange(
                                "lastName",
                                e.target.value,
                              )
                            }
                            isInvalid={!!validationErrors.lastName}
                            required
                          />
                          {validationErrors.lastName && (
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.lastName}
                            </Form.Control.Feedback>
                          )}
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
                            isInvalid={!!validationErrors.email}
                            required
                          />
                          {validationErrors.email && (
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.email}
                            </Form.Control.Feedback>
                          )}
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
                            isInvalid={!!validationErrors.phone}
                            required
                          />
                          {validationErrors.phone && (
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.phone}
                            </Form.Control.Feedback>
                          )}
                        </Form.Group>
                      </Col>
                      <Col md={3}>
                        <Form.Group>
                          <Form.Label>Passport No</Form.Label>
                          <Form.Control
                            type="text"
                            value={primaryGuest.passportNo}
                            onChange={(e) =>
                              handlePrimaryGuestChange(
                                "passportNo",
                                e.target.value,
                              )
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
                              handlePrimaryGuestChange(
                                "agentLpo",
                                e.target.value,
                              )
                            }
                            isInvalid={!!validationErrors.agentLpo}
                            required
                          />
                          {validationErrors.agentLpo && (
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.agentLpo}
                            </Form.Control.Feedback>
                          )}
                        </Form.Group>
                      </Col>
                    </Row>
                  </Card>

                  {/* Remarks & Requests */}
                  <Card className="p-4 mb-2 shadow-sm border-0">
                    <h5 className="mb-3 fw-bold">Remarks & Special Requests</h5>
                    <Row className="g-3">
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Tourism Dirhams (AED)</Form.Label>
                          <Form.Control
                            type="number"
                            value={tourismDirhams}
                            onChange={(e) => setTourismDirhams(e.target.value)}
                            placeholder="0"
                            min="0"
                            step="0.01"
                          />
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Remarks</Form.Label>
                          <Form.Control
                            as="textarea"
                            rows={3}
                            placeholder="Any remarks..."
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                          />
                        </Form.Group>
                      </Col>
                      <Col md={12}>
                        <Form.Group className="mb-3">
                          <Form.Label>Special Request</Form.Label>
                          <div className="special-request-grid">
                            {SPECIAL_REQUEST_OPTIONS.map((request) => (
                              <Form.Check
                                key={request}
                                type="checkbox"
                                id={`special-request-${request.replace(/[^a-zA-Z0-9]/g, "-")}`}
                                label={request}
                                checked={specialRequests.includes(request)}
                                onChange={() =>
                                  handleSpecialRequestToggle(request)
                                }
                                className="mb-2 special-request-check"
                              />
                            ))}
                          </div>
                        </Form.Group>
                      </Col>
                      {selectedRate?.roomStatus !== "On Request" && (
                        <Col md={12}>
                          <Form.Group className="mb-3">
                            <Form.Label className="mb-2 fw-semibold">
                              Are you sure to continue booking?
                            </Form.Label>
                            <div className="d-flex gap-4 mt-2">
                              <Form.Check
                                type="radio"
                                id="book-voucher"
                                name="bookingConfirmation"
                                label="Book & Voucher"
                                value="Book & Voucher"
                                checked={
                                  bookingConfirmation === "Book & Voucher"
                                }
                                onChange={(e) =>
                                  setBookingConfirmation(e.target.value)
                                }
                                className="mb-2"
                              />
                              <Form.Check
                                type="radio"
                                id="book-now-voucher-later"
                                name="bookingConfirmation"
                                label="Book Now & Voucher later"
                                value="Book Now & Voucher later"
                                checked={
                                  bookingConfirmation ===
                                  "Book Now & Voucher later"
                                }
                                onChange={(e) =>
                                  setBookingConfirmation(e.target.value)
                                }
                              />
                            </div>
                          </Form.Group>
                        </Col>
                      )}
                    </Row>
                  </Card>

                  {/* Booking Done By Section */}
                  <Card className="p-4 mb-4 shadow-sm border-0 bg-light">
                    <h6 className="mb-3 fw-bold text-primary d-flex align-items-center">
                      <FaUserTie className="me-2" /> Booking Done By
                    </h6>
                    <Row>
                      <Col md={4}>
                        <Form.Group>
                          <Form.Label className="fw-semibold">
                            Employee
                          </Form.Label>
                          <Form.Select
                            value={primaryGuest.employeeId}
                            onChange={(e) =>
                              handlePrimaryGuestChange(
                                "employeeId",
                                e.target.value,
                              )
                            }
                            className="form-control"
                          >
                            <option value="">Select Employee</option>
                            {employees.map((employee) => (
                              <option
                                key={employee.employeeId}
                                value={employee.employeeId}
                              >
                                {employee.firstName} {employee.lastName}
                              </option>
                            ))}
                          </Form.Select>
                        </Form.Group>
                      </Col>
                    </Row>
                  </Card>

                </Col>

                {/* Right sticky column — Booking Summary + Price */}
                <Col lg={4} className="hbp-right-col">
                  <div className="hbp-sticky-summary">
                    <Card className="shadow-sm rounded-3 mb-3 booking-summary-card border-0 overflow-hidden">
                      <Card.Header className="bg-primary text-white py-2 rounded-top">
                        <h6 className="mb-0 d-flex align-items-center">
                          <FaHotel className="me-2" /> Booking Summary
                        </h6>
                      </Card.Header>
                      <Card.Body className="p-3">
                        <div className="mb-3">
                          <div className="fw-bold text-primary mb-1">
                            {hotelStaticData.hotelName}
                          </div>
                          <div className="text-muted small mb-2">
                            {hotelStaticData.address}
                          </div>
                          <div className="d-flex flex-wrap align-items-center gap-2">
                            <span className="badge bg-warning text-dark">
                              ⭐ {hotelStaticData.starRating} Star
                            </span>
                            {selectedRate?.nonRefundable !== undefined &&
                              getRefundStatusBadge(
                                selectedRate.nonRefundable === true ||
                                  selectedRate.nonRefundable === "true"
                                  ? "NON REFUNDABLE"
                                  : "FLEXIBLE",
                              )}
                          </div>
                        </div>

                        <div className="hbp-summary-row">
                          <div className="hbp-summary-label">
                            <FaCalendarAlt className="me-2 text-primary" />
                            Check-in
                          </div>
                          <div className="hbp-summary-value">
                            {formatDateTime(payload.checkInDate)}
                          </div>
                        </div>
                        <div className="hbp-summary-row">
                          <div className="hbp-summary-label">
                            <FaCalendarAlt className="me-2 text-primary" />
                            Check-out
                          </div>
                          <div className="hbp-summary-value">
                            {formatDateTime(payload.checkOutDate)}
                          </div>
                        </div>
                        <div className="hbp-summary-row align-items-start">
                          <div className="hbp-summary-label">
                            <FaUsers className="me-2 text-primary" />
                            Guests
                          </div>
                          <div className="hbp-summary-value text-end">
                            {payload.rooms.map((room, i) => (
                              <div key={i} className="small">
                                Room {i + 1}: {room.adults} Adult
                                {room.adults > 1 ? "s" : ""}
                                {room.children
                                  ? `, ${room.children} Child${
                                      room.children > 1 ? "ren" : ""
                                    }`
                                  : ""}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="hbp-summary-row">
                          <div className="hbp-summary-label">
                            <FaUtensils className="me-2 text-primary" />
                            Meal Plan
                          </div>
                          <div className="hbp-summary-value">
                            {selectedRate.mealPlan}
                          </div>
                        </div>
                      </Card.Body>
                    </Card>

                    <Card className="shadow-sm rounded-3 border-0 hbp-price-card">
                      <Card.Header className="bg-light py-2">
                        <h6 className="mb-0 fw-bold">Price Details</h6>
                      </Card.Header>
                      <Card.Body className="p-3">
                        <div className="hbp-summary-row">
                          <div className="hbp-summary-label">Selling Price</div>
                          <div className="hbp-summary-value">
                            {formatPrice(
                              selectedRate?.roomRateBasedOnRoomCount || 0,
                            )}
                          </div>
                        </div>
                        <div className="hbp-summary-row">
                          <div className="hbp-summary-label">
                            Tourism Dirhams
                          </div>
                          <div className="hbp-summary-value">
                            {formatPrice(tourismDirhamsAmount)}
                          </div>
                        </div>
                        <hr className="my-2" />
                        <div className="hbp-summary-row fw-bold">
                          <div className="hbp-summary-label text-danger">
                            New Total
                          </div>
                          <div className="hbp-summary-value text-danger">
                            {formatPrice(sellingPriceWithTd)}
                          </div>
                        </div>
                        {activeUserRole === "ADMIN" && (
                          <div className="hbp-summary-row mt-2">
                            <div className="hbp-summary-label text-muted small">
                              Total (incl. markup)
                            </div>
                            <div className="hbp-summary-value text-success fw-bold">
                              {formatPrice(totalPriceWithTd)}
                            </div>
                          </div>
                        )}
                      </Card.Body>
                    </Card>

                    <div className="hbp-action-bar mt-3 d-flex gap-2">
                      <Button
                        variant="outline-secondary"
                        onClick={() => navigate(-1)}
                        className="flex-grow-1"
                      >
                        Back
                      </Button>
                      <Button
                        variant="primary"
                        type="button"
                        onClick={openPolicyConsent}
                        className="flex-grow-1"
                      >
                        Confirm Booking
                      </Button>
                    </div>
                  </div>
                </Col>
              </Row>

              {/* ✅ Policies + T&C Consent Modal (step before order summary) */}
              <Modal
                show={showPolicyModal}
                onHide={() => setShowPolicyModal(false)}
                centered
                backdrop="static"
                size="lg"
                scrollable
              >
                <Modal.Header
                  closeButton
                  className="bg-primary text-white py-2"
                  style={{ borderBottom: "none" }}
                >
                  <Modal.Title className="fw-semibold d-flex align-items-center">
                    <FaHotel className="me-2" />
                    Hotel Policies &amp; Terms
                  </Modal.Title>
                </Modal.Header>
                <Modal.Body className="bg-light">
                  {policiesLoading ? (
                    <div className="text-center py-5">
                      <div className="spinner-border text-primary" />
                      <div className="mt-3 text-muted">
                        Fetching hotel policies &amp; terms...
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Cancellation Policy */}
                      <div className="policy-block mb-3 p-3 rounded bg-white shadow-sm">
                        <h6 className="text-danger mb-2 fw-bold">
                          Cancellation Policy
                        </h6>
                        {policyData?.policies?.cancellationPolicy?.length ? (
                          policyData.policies.cancellationPolicy.map(
                            (p, idx) => (
                              <div key={idx} className="mb-2">
                                <div className="small text-dark">
                                  {p.policyText || "—"}
                                </div>
                                {(p.fromDate || p.toDate) && (
                                  <div className="text-muted small">
                                    Valid:{" "}
                                    {p.fromDate
                                      ? new Date(p.fromDate).toLocaleDateString()
                                      : "—"}
                                    {" – "}
                                    {p.toDate
                                      ? new Date(p.toDate).toLocaleDateString()
                                      : "—"}
                                  </div>
                                )}
                              </div>
                            ),
                          )
                        ) : (
                          <div className="text-muted small">
                            No cancellation policy specified.
                          </div>
                        )}
                      </div>

                      {/* Amendment Policy */}
                      <div className="policy-block mb-3 p-3 rounded bg-white shadow-sm">
                        <h6 className="text-warning mb-2 fw-bold">
                          Amendment Policy
                        </h6>
                        {policyData?.policies?.amendmentPolicy?.length ? (
                          policyData.policies.amendmentPolicy.map((p, idx) => (
                            <div key={idx} className="mb-2">
                              <div className="small text-dark">
                                {p.policyText || "—"}
                              </div>
                              {(p.fromDate || p.toDate) && (
                                <div className="text-muted small">
                                  Valid:{" "}
                                  {p.fromDate
                                    ? new Date(p.fromDate).toLocaleDateString()
                                    : "—"}
                                  {" – "}
                                  {p.toDate
                                    ? new Date(p.toDate).toLocaleDateString()
                                    : "—"}
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="text-muted small">
                            No amendment policy specified.
                          </div>
                        )}
                      </div>

                      {/* Child Policy */}
                      <div className="policy-block mb-3 p-3 rounded bg-white shadow-sm">
                        <h6 className="text-primary mb-2 fw-bold">
                          Child Policy
                        </h6>
                        {policyData?.policies?.childPolicy?.length &&
                        policyData.policies.childPolicy.some(
                          (p) => p.policyText,
                        ) ? (
                          policyData.policies.childPolicy.map((p, idx) => (
                            <div key={idx} className="mb-2 small text-dark">
                              {p.policyText || "—"}
                            </div>
                          ))
                        ) : (
                          <div className="text-muted small">
                            No child policy specified.
                          </div>
                        )}
                      </div>

                      {/* Terms & Conditions */}
                      <div className="policy-block p-3 rounded bg-white shadow-sm">
                        <h6 className="text-dark mb-2 fw-bold">
                          Terms &amp; Conditions
                        </h6>
                        {termsAndConditions ? (
                          <div
                            className="small text-dark terms-content"
                            style={{ whiteSpace: "pre-wrap", maxHeight: 220, overflowY: "auto" }}
                            dangerouslySetInnerHTML={{
                              __html: termsAndConditions,
                            }}
                          />
                        ) : (
                          <div className="text-muted small">
                            No terms &amp; conditions configured for this hotel.
                          </div>
                        )}
                      </div>

                      <div className="mt-3 p-3 bg-white rounded shadow-sm">
                        <Form.Check
                          type="checkbox"
                          id="policy-accept"
                          label="Yes, I have read and accept the policies and terms &amp; conditions"
                          checked={policyAccepted}
                          onChange={(e) =>
                            setPolicyAccepted(e.target.checked)
                          }
                        />
                      </div>
                    </>
                  )}
                </Modal.Body>
                <Modal.Footer className="bg-light border-0 d-flex justify-content-between">
                  <Button
                    variant="outline-secondary"
                    onClick={() => setShowPolicyModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    disabled={!policyAccepted || policiesLoading}
                    onClick={() => {
                      setShowPolicyModal(false);
                      // Move to order-summary step
                      handleSubmit();
                    }}
                  >
                    Proceed
                  </Button>
                </Modal.Footer>
              </Modal>

              {/* ✅ Confirmation Modal */}
              <Modal
                show={showConfirmModal}
                onHide={() => setShowConfirmModal(false)}
                centered
                backdrop="static"
                size="md"
              >
                <Modal.Header
                  closeButton
                  className="bg-primary text-white py-2"
                  style={{ borderBottom: "none" }}
                >
                  <Modal.Title className="fw-semibold d-flex align-items-center">
                    <FaHotel className="me-2" /> Confirm Your Booking
                  </Modal.Title>
                </Modal.Header>

                {console.log(
                  "pendingPayload::inside :order modal:::",
                  pendingPayload,
                )}
                <Modal.Body className="px-4 py-3 bg-light">
                  {pendingPayload && (
                    <div className="border rounded-3 bg-white shadow-sm p-3">
                      <div className="mb-3">
                        <h5 className="fw-bold text-primary mb-2">
                          {pendingPayload.hotelName}
                        </h5>
                        <p className="text-muted mb-0">
                          {pendingPayload.address}
                        </p>
                      </div>

                      <hr />

                      <Row className="gy-2">
                        <Col xs={6}>
                          <p className="mb-1">
                            <strong>Check-In:</strong>
                            <br />
                            <span className="text-dark">
                              {formatDateTime(pendingPayload.checkInDate)}
                            </span>
                          </p>
                        </Col>
                        <Col xs={6}>
                          <p className="mb-1">
                            <strong>Check-Out:</strong>
                            <br />
                            <span className="text-dark">
                              {formatDateTime(pendingPayload.checkOutDate)}
                            </span>
                          </p>
                        </Col>
                        <Col xs={6}>
                          <p className="mb-1">
                            <strong>Rooms:</strong>{" "}
                            {pendingPayload.rooms.length}
                          </p>
                        </Col>
                        <Col xs={6}>
                          <p className="mb-1">
                            <strong>Nights:</strong> {pendingPayload.nights}
                          </p>
                        </Col>
                        <Col xs={12}>
                          <p className="mb-1">
                            <strong>Cancellation Policy:</strong>
                          </p>
                          <ul className="mb-0 ps-3">
                            {pendingPayload.cancellationPolicy &&
                            pendingPayload.cancellationPolicy.length > 0 ? (
                              pendingPayload.cancellationPolicy.map(
                                (policy, index) => (
                                  <li key={index} className="text-dark">
                                    {policy}
                                  </li>
                                ),
                              )
                            ) : (
                              <li className="text-muted">
                                No cancellation policy available.
                              </li>
                            )}
                          </ul>
                        </Col>

                        <Col xs={12}>
                          {/* ✅ Show Selling Price only if ADMIN */}
                          {activeUserRole === "ADMIN" && (
                            <div className="p-3 rounded bg-white shadow-sm mt-2 border">
                              <div className="d-flex justify-content-between align-items-center">
                                <h6 className="mb-0 text-muted">
                                  Selling Price
                                </h6>
                                <h5 className="mb-0 text-success fw-bold">
                                  {formatPrice(sellingPriceWithTd)}
                                </h5>
                              </div>
                            </div>
                          )}

                          <div className="p-3 rounded bg-gradient-success text-white text-center mt-2">
                            <h6 className="mb-0 fw-bold">Total Price</h6>
                            <h4 className="mb-0">
                              {formatPrice(totalPriceWithTd)} for{" "}
                              {pendingPayload.rooms.length}{" "}
                              {pendingPayload.rooms.length > 1
                                ? "rooms"
                                : "room"}
                            </h4>
                          </div>
                        </Col>
                      </Row>

                      <div className="mt-3 p-3 bg-white border rounded">
                        <h6 className="fw-bold mb-2">Rate Split</h6>
                        <div className="d-flex justify-content-between">
                          <span>Selling Price</span>
                          <span>
                            {formatPrice(
                              selectedRate.roomRateBasedOnRoomCount || 0,
                            )}
                          </span>
                        </div>
                        <div className="d-flex justify-content-between">
                          <span>Tourism Dirhams</span>
                          <span>{formatPrice(tourismDirhamsAmount)}</span>
                        </div>
                        <hr className="my-2" />
                        <div className="d-flex justify-content-between fw-bold text-danger">
                          <span>Total (Selling + TD)</span>
                          <span>{formatPrice(sellingPriceWithTd)}</span>
                        </div>
                      </div>

                      <div className="mt-4 text-center">
                        <p className="text-muted small mb-0">
                          Please review the booking details carefully before
                          confirming.
                        </p>
                      </div>
                    </div>
                  )}
                </Modal.Body>

                <Modal.Footer className="bg-light border-0 d-flex justify-content-between">
                  <Button
                    variant="outline-secondary"
                    onClick={() => setShowConfirmModal(false)}
                    disabled={isSubmitting}
                  >
                    <i className="bi bi-x-circle me-1"></i> Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={confirmBooking}
                    disabled={isSubmitting}
                    className="px-4 fw-semibold"
                  >
                    {isSubmitting ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                        ></span>
                        Processing...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-circle me-1"></i> Confirm
                      </>
                    )}
                  </Button>
                </Modal.Footer>
              </Modal>
            </Form>
          </Container>
        </main>
      </div>
    </div>
  );
};

export default HotelBookingPage;
