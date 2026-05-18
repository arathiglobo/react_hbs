import React, { useEffect, useState, useCallback } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Form,
  Tabs,
  Tab,
  Badge,
  Modal,
  Spinner,
  InputGroup,
} from "react-bootstrap";
import {
  FaLeaf,
  FaSpa,
  FaUserMd,
  FaBookOpen,
  FaSearch,
  FaCalendarAlt,
  FaCheckCircle,
  FaInfoCircle,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import "../../styles/Ayurveda.css";

const AYURVEDA_API = "/api/v1/ayurveda";

const getUserId = () => {
  const raw = localStorage.getItem("userId");
  const parsed = raw && raw !== "null" ? Number(raw) : null;
  return Number.isFinite(parsed) ? parsed : 1; // fallback dev default
};

const AyurvedaSearch = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("packages");

  // Listings
  const [packages, setPackages] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [packageCategory, setPackageCategory] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [keyword, setKeyword] = useState("");
  const [allInclusiveOnly, setAllInclusiveOnly] = useState(false);

  const [courseLevel, setCourseLevel] = useState("");
  const [consultationStartDate, setConsultationStartDate] = useState("");
  const [consultationEndDate, setConsultationEndDate] = useState("");

  // Booking modal
  const [bookingTarget, setBookingTarget] = useState(null); // {type, item}
  const [bookingForm, setBookingForm] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const loadPackages = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (packageCategory) params.category = packageCategory;
      if (minPrice) params.minPrice = minPrice;
      if (maxPrice) params.maxPrice = maxPrice;

      const url = allInclusiveOnly
        ? `${AYURVEDA_API}/packages/all-inclusive`
        : `${AYURVEDA_API}/packages`;
      const res = await axiosInstance.get(url, { params });
      let data = Array.isArray(res.data) ? res.data : [];
      if (keyword.trim()) {
        const q = keyword.trim().toLowerCase();
        data = data.filter(
          (p) =>
            p.packageName?.toLowerCase().includes(q) ||
            p.description?.toLowerCase().includes(q) ||
            p.treatmentsIncluded?.toLowerCase().includes(q)
        );
      }
      setPackages(data);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load packages");
    } finally {
      setLoading(false);
    }
  }, [packageCategory, minPrice, maxPrice, keyword, allInclusiveOnly]);

  const loadConsultations = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (consultationStartDate) params.startDate = consultationStartDate;
      if (consultationEndDate) params.endDate = consultationEndDate;
      const res = await axiosInstance.get(`${AYURVEDA_API}/consultations/available`, {
        params,
      });
      let data = Array.isArray(res.data) ? res.data : [];
      if (keyword.trim()) {
        const q = keyword.trim().toLowerCase();
        data = data.filter(
          (c) =>
            c.doctorName?.toLowerCase().includes(q) ||
            c.specialization?.toLowerCase().includes(q)
        );
      }
      setConsultations(data);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load consultations");
    } finally {
      setLoading(false);
    }
  }, [consultationStartDate, consultationEndDate, keyword]);

  const loadCourses = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (courseLevel) params.courseLevel = courseLevel;
      if (minPrice) params.minPrice = minPrice;
      if (maxPrice) params.maxPrice = maxPrice;
      const res = await axiosInstance.get(`${AYURVEDA_API}/courses`, { params });
      let data = Array.isArray(res.data) ? res.data : [];
      if (keyword.trim()) {
        const q = keyword.trim().toLowerCase();
        data = data.filter(
          (c) =>
            c.courseName?.toLowerCase().includes(q) ||
            c.description?.toLowerCase().includes(q) ||
            c.instructorName?.toLowerCase().includes(q)
        );
      }
      setCourses(data);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load courses");
    } finally {
      setLoading(false);
    }
  }, [courseLevel, minPrice, maxPrice, keyword]);

  useEffect(() => {
    if (activeTab === "packages") loadPackages();
    else if (activeTab === "consultations") loadConsultations();
    else if (activeTab === "courses") loadCourses();
  }, [activeTab, loadPackages, loadConsultations, loadCourses]);

  const openBooking = (type, item) => {
    setBookingTarget({ type, item });
    if (type === "package") {
      setBookingForm({
        startDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        numberOfParticipants: 1,
        specialRequests: "",
      });
    } else if (type === "consultation") {
      setBookingForm({
        preferredDate: item.consultationDate,
        preferredTimeSlot: item.startTime,
        numberOfParticipants: 1,
        symptoms: "",
      });
    } else if (type === "course") {
      setBookingForm({
        numberOfParticipants: 1,
        previousExperience: "",
      });
    }
  };

  const closeBooking = () => {
    setBookingTarget(null);
    setBookingForm({});
  };

  const setBookingField = (k, v) =>
    setBookingForm((prev) => ({ ...prev, [k]: v }));

  const submitBooking = async () => {
    if (!bookingTarget) return;
    const userId = getUserId();
    if (!userId) {
      toast.error("Please log in to book");
      return;
    }

    setSubmitting(true);
    try {
      let url = "";
      let payload = {};
      if (bookingTarget.type === "package") {
        url = `${AYURVEDA_API}/bookings/package`;
        payload = {
          packageId: bookingTarget.item.id,
          userId,
          startDate: bookingForm.startDate,
          numberOfParticipants: Number(bookingForm.numberOfParticipants) || 1,
          specialRequests: bookingForm.specialRequests || "",
        };
      } else if (bookingTarget.type === "consultation") {
        url = `${AYURVEDA_API}/consultations/book`;
        payload = {
          consultationId: bookingTarget.item.id,
          userId,
          symptoms: bookingForm.symptoms || "",
          preferredDate: bookingForm.preferredDate,
          preferredTimeSlot: bookingForm.preferredTimeSlot,
          numberOfParticipants: Number(bookingForm.numberOfParticipants) || 1,
        };
      } else if (bookingTarget.type === "course") {
        url = `${AYURVEDA_API}/courses/enroll`;
        payload = {
          courseId: bookingTarget.item.id,
          userId,
          previousExperience: bookingForm.previousExperience || "",
          numberOfParticipants: Number(bookingForm.numberOfParticipants) || 1,
        };
      }

      const res = await axiosInstance.post(url, payload);
      const booking = res.data;
      toast.success(
        `Booking confirmed! Ref: ${booking?.bookingReference || ""}`
      );
      closeBooking();
      navigate("/booking-details/ayurveda-booking-list");
    } catch (e) {
      console.error(e);
      const msg =
        e?.response?.data?.message ||
        e?.response?.data ||
        "Booking failed. Please verify the details.";
      toast.error(typeof msg === "string" ? msg : "Booking failed");
    } finally {
      setSubmitting(false);
    }
  };

  const renderPackages = () => (
    <Row className="g-3">
      {packages.length === 0 ? (
        <Col xs={12}>
          <div className="ayurveda-empty">No matching packages found.</div>
        </Col>
      ) : (
        packages.map((p) => (
          <Col md={6} lg={4} key={p.id}>
            <Card className="ayurveda-card">
              <div className="ayurveda-card-img">
                {p.imageUrl ? <img src={p.imageUrl} alt={p.packageName} /> : <FaSpa />}
              </div>
              <Card.Body className="ayurveda-card-body">
                <div className="d-flex justify-content-between align-items-start">
                  <h6 className="ayurveda-card-title">{p.packageName}</h6>
                  {p.isAllInclusive && <Badge bg="success">All-Inclusive</Badge>}
                </div>
                <div className="ayurveda-card-desc">{p.description}</div>
                <div className="ayurveda-card-meta">
                  <span>
                    <FaCalendarAlt /> {p.durationDays} days
                  </span>
                  {p.category && <span>• {p.category}</span>}
                  {p.maxCapacity && <span>• Capacity: {p.maxCapacity}</span>}
                </div>
                <div className="mb-2">
                  {p.includesYoga && (
                    <span className="ayurveda-feature-chip">🧘 Yoga</span>
                  )}
                  {p.includesMeditation && (
                    <span className="ayurveda-feature-chip">🌿 Meditation</span>
                  )}
                  {p.includesDining && (
                    <span className="ayurveda-feature-chip">🍽 Dining</span>
                  )}
                </div>
                {p.treatmentsIncluded && (
                  <div className="ayurveda-card-meta">
                    <FaInfoCircle /> {p.treatmentsIncluded}
                  </div>
                )}
                <div className="d-flex justify-content-between align-items-center mt-2">
                  <span className="ayurveda-card-price">₹{p.price}</span>
                  <Button
                    size="sm"
                    variant="success"
                    onClick={() => openBooking("package", p)}
                  >
                    Book Now
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))
      )}
    </Row>
  );

  const renderConsultations = () => (
    <Row className="g-3">
      {consultations.length === 0 ? (
        <Col xs={12}>
          <div className="ayurveda-empty">No available consultation slots.</div>
        </Col>
      ) : (
        consultations.map((c) => (
          <Col md={6} lg={4} key={c.id}>
            <Card className="ayurveda-card">
              <div className="ayurveda-card-img">
                {c.doctorImageUrl ? <img src={c.doctorImageUrl} alt={c.doctorName} /> : <FaUserMd />}
              </div>
              <Card.Body className="ayurveda-card-body">
                <h6 className="ayurveda-card-title">{c.doctorName}</h6>
                <div className="ayurveda-card-desc">
                  {c.specialization} • {c.qualification}
                </div>
                <div className="ayurveda-card-meta">
                  <span>
                    <FaCalendarAlt /> {c.consultationDate}
                  </span>
                  <span>
                    🕒 {c.startTime} - {c.endTime}
                  </span>
                  {c.experienceYears != null && (
                    <span>• {c.experienceYears} yrs exp</span>
                  )}
                </div>
                <div className="ayurveda-card-meta">
                  Slots available:{" "}
                  <b>{(c.maxPatientsPerSlot || 0) - (c.currentBookings || 0)}</b>
                </div>
                <div className="d-flex justify-content-between align-items-center mt-2">
                  <span className="ayurveda-card-price">₹{c.price}</span>
                  <Button
                    size="sm"
                    variant="success"
                    onClick={() => openBooking("consultation", c)}
                  >
                    Book Slot
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))
      )}
    </Row>
  );

  const renderCourses = () => (
    <Row className="g-3">
      {courses.length === 0 ? (
        <Col xs={12}>
          <div className="ayurveda-empty">No matching courses found.</div>
        </Col>
      ) : (
        courses.map((c) => (
          <Col md={6} lg={4} key={c.id}>
            <Card className="ayurveda-card">
              <div className="ayurveda-card-img">
                {c.courseImageUrl ? <img src={c.courseImageUrl} alt={c.courseName} /> : <FaBookOpen />}
              </div>
              <Card.Body className="ayurveda-card-body">
                <div className="d-flex justify-content-between align-items-start">
                  <h6 className="ayurveda-card-title">{c.courseName}</h6>
                  {c.courseLevel && <Badge bg="info">{c.courseLevel}</Badge>}
                </div>
                <div className="ayurveda-card-desc">{c.description}</div>
                <div className="ayurveda-card-meta">
                  <span>
                    <FaCalendarAlt /> {c.durationWeeks} weeks
                  </span>
                  {c.instructorName && <span>• by {c.instructorName}</span>}
                </div>
                <div className="ayurveda-card-meta">
                  <span>
                    {c.startDate} → {c.endDate}
                  </span>
                </div>
                <div className="ayurveda-card-meta">
                  Seats available:{" "}
                  <b>{(c.maxStudents || 0) - (c.currentEnrollments || 0)}</b>
                  {c.certificationIncluded && (
                    <span className="ayurveda-feature-chip ms-2">
                      <FaCheckCircle /> Certified
                    </span>
                  )}
                </div>
                {c.prerequisites && (
                  <div className="ayurveda-card-meta">
                    Prerequisites: {c.prerequisites}
                  </div>
                )}
                <div className="d-flex justify-content-between align-items-center mt-2">
                  <span className="ayurveda-card-price">₹{c.price}</span>
                  <Button
                    size="sm"
                    variant="success"
                    onClick={() => openBooking("course", c)}
                  >
                    Enroll
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))
      )}
    </Row>
  );

  return (
    <div className="d-flex">
      <Sidebar />
      <div className="flex-grow-1">
        <TopBar />
        <div className="ayurveda-page">
          <Container fluid className="p-3">
            <div className="ayurveda-header">
              <div>
                <h2 className="ayurveda-title">
                  <FaLeaf /> Ayurveda Booking
                </h2>
                <p className="ayurveda-subtitle">
                  Browse packages, book doctor consultations, enroll in courses
                </p>
              </div>
            </div>

            <div className="ayurveda-filter-bar">
              <InputGroup style={{ maxWidth: 340 }}>
                <InputGroup.Text>
                  <FaSearch />
                </InputGroup.Text>
                <Form.Control
                  placeholder="Search by name, description..."
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                />
              </InputGroup>

              {activeTab === "packages" && (
                <>
                  <Form.Select
                    style={{ maxWidth: 200 }}
                    value={packageCategory}
                    onChange={(e) => setPackageCategory(e.target.value)}
                  >
                    <option value="">All Categories</option>
                    <option>Detox</option>
                    <option>Panchakarma</option>
                    <option>Rejuvenation</option>
                    <option>Wellness</option>
                    <option>Weight Management</option>
                    <option>Stress Relief</option>
                  </Form.Select>
                  <Form.Check
                    type="switch"
                    label="All-Inclusive Only"
                    checked={allInclusiveOnly}
                    onChange={(e) => setAllInclusiveOnly(e.target.checked)}
                    className="align-self-center"
                  />
                </>
              )}

              {activeTab === "courses" && (
                <Form.Select
                  style={{ maxWidth: 200 }}
                  value={courseLevel}
                  onChange={(e) => setCourseLevel(e.target.value)}
                >
                  <option value="">All Levels</option>
                  <option>Beginner</option>
                  <option>Intermediate</option>
                  <option>Advanced</option>
                </Form.Select>
              )}

              {activeTab === "consultations" && (
                <>
                  <Form.Control
                    type="date"
                    style={{ maxWidth: 180 }}
                    value={consultationStartDate}
                    onChange={(e) => setConsultationStartDate(e.target.value)}
                  />
                  <Form.Control
                    type="date"
                    style={{ maxWidth: 180 }}
                    value={consultationEndDate}
                    onChange={(e) => setConsultationEndDate(e.target.value)}
                  />
                </>
              )}

              {(activeTab === "packages" || activeTab === "courses") && (
                <>
                  <Form.Control
                    type="number"
                    placeholder="Min price"
                    style={{ maxWidth: 140 }}
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                  />
                  <Form.Control
                    type="number"
                    placeholder="Max price"
                    style={{ maxWidth: 140 }}
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                  />
                </>
              )}

              <Button
                variant="success"
                onClick={() => {
                  if (activeTab === "packages") loadPackages();
                  if (activeTab === "consultations") loadConsultations();
                  if (activeTab === "courses") loadCourses();
                }}
              >
                <FaSearch className="me-1" /> Search
              </Button>
            </div>

            <Tabs
              activeKey={activeTab}
              onSelect={(k) => setActiveTab(k)}
              className="ayurveda-tabs"
              fill
            >
              <Tab
                eventKey="packages"
                title={
                  <span>
                    <FaSpa className="me-2" />
                    Packages
                  </span>
                }
              >
                {loading ? (
                  <div className="text-center py-5">
                    <Spinner animation="border" variant="success" />
                  </div>
                ) : (
                  renderPackages()
                )}
              </Tab>
              <Tab
                eventKey="consultations"
                title={
                  <span>
                    <FaUserMd className="me-2" />
                    Doctor Consultation
                  </span>
                }
              >
                {loading ? (
                  <div className="text-center py-5">
                    <Spinner animation="border" variant="success" />
                  </div>
                ) : (
                  renderConsultations()
                )}
              </Tab>
              <Tab
                eventKey="courses"
                title={
                  <span>
                    <FaBookOpen className="me-2" />
                    Courses
                  </span>
                }
              >
                {loading ? (
                  <div className="text-center py-5">
                    <Spinner animation="border" variant="success" />
                  </div>
                ) : (
                  renderCourses()
                )}
              </Tab>
            </Tabs>
          </Container>
        </div>
      </div>

      {/* Booking Modal */}
      <Modal show={!!bookingTarget} onHide={closeBooking} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {bookingTarget?.type === "package" && "Book Ayurveda Package"}
            {bookingTarget?.type === "consultation" && "Book Doctor Consultation"}
            {bookingTarget?.type === "course" && "Enroll in Course"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {bookingTarget && (
            <>
              <div className="ayurveda-summary-card">
                <strong>
                  {bookingTarget.item.packageName ||
                    bookingTarget.item.doctorName ||
                    bookingTarget.item.courseName}
                </strong>
                <div className="small text-muted">
                  Price per person: ₹{bookingTarget.item.price}
                </div>
              </div>

              {bookingTarget.type === "package" && (
                <Form>
                  <Form.Group className="mb-2">
                    <Form.Label>Start Date *</Form.Label>
                    <Form.Control
                      type="date"
                      min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                      value={bookingForm.startDate || ""}
                      onChange={(e) => setBookingField("startDate", e.target.value)}
                    />
                    <Form.Text className="text-muted">
                      Backend requires a future date.
                    </Form.Text>
                  </Form.Group>
                  <Form.Group className="mb-2">
                    <Form.Label>Number of Participants *</Form.Label>
                    <Form.Control
                      type="number"
                      min={1}
                      value={bookingForm.numberOfParticipants || 1}
                      onChange={(e) =>
                        setBookingField("numberOfParticipants", e.target.value)
                      }
                    />
                  </Form.Group>
                  <Form.Group className="mb-2">
                    <Form.Label>Special Requests</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={2}
                      value={bookingForm.specialRequests || ""}
                      onChange={(e) =>
                        setBookingField("specialRequests", e.target.value)
                      }
                    />
                  </Form.Group>
                </Form>
              )}

              {bookingTarget.type === "consultation" && (
                <Form>
                  <Form.Group className="mb-2">
                    <Form.Label>Preferred Date *</Form.Label>
                    <Form.Control
                      type="date"
                      value={bookingForm.preferredDate || ""}
                      onChange={(e) =>
                        setBookingField("preferredDate", e.target.value)
                      }
                    />
                    <Form.Text className="text-muted">
                      Must match the doctor's slot date.
                    </Form.Text>
                  </Form.Group>
                  <Form.Group className="mb-2">
                    <Form.Label>Preferred Time *</Form.Label>
                    <Form.Control
                      type="time"
                      value={bookingForm.preferredTimeSlot || ""}
                      onChange={(e) =>
                        setBookingField("preferredTimeSlot", e.target.value)
                      }
                    />
                  </Form.Group>
                  <Form.Group className="mb-2">
                    <Form.Label>Number of Participants *</Form.Label>
                    <Form.Control
                      type="number"
                      min={1}
                      value={bookingForm.numberOfParticipants || 1}
                      onChange={(e) =>
                        setBookingField("numberOfParticipants", e.target.value)
                      }
                    />
                  </Form.Group>
                  <Form.Group className="mb-2">
                    <Form.Label>Symptoms / Health Concerns</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={2}
                      value={bookingForm.symptoms || ""}
                      onChange={(e) => setBookingField("symptoms", e.target.value)}
                    />
                  </Form.Group>
                </Form>
              )}

              {bookingTarget.type === "course" && (
                <Form>
                  <Form.Group className="mb-2">
                    <Form.Label>Number of Participants *</Form.Label>
                    <Form.Control
                      type="number"
                      min={1}
                      value={bookingForm.numberOfParticipants || 1}
                      onChange={(e) =>
                        setBookingField("numberOfParticipants", e.target.value)
                      }
                    />
                  </Form.Group>
                  <Form.Group className="mb-2">
                    <Form.Label>Previous Experience</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={2}
                      value={bookingForm.previousExperience || ""}
                      onChange={(e) =>
                        setBookingField("previousExperience", e.target.value)
                      }
                    />
                  </Form.Group>
                </Form>
              )}

              <div className="mt-2">
                <strong>Estimated Total:</strong>{" "}
                ₹
                {(
                  Number(bookingTarget.item.price || 0) *
                  Number(bookingForm.numberOfParticipants || 1)
                ).toFixed(2)}
              </div>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeBooking} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="success" onClick={submitBooking} disabled={submitting}>
            {submitting ? <Spinner size="sm" animation="border" /> : "Confirm Booking"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AyurvedaSearch;
