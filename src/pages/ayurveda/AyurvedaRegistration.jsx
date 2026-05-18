import React, { useEffect, useState, useCallback } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Form,
  Tab,
  Tabs,
  Table,
  Badge,
  Modal,
  Spinner,
} from "react-bootstrap";
import { FaPlus, FaEdit, FaTrash, FaSpa, FaUserMd, FaBookOpen, FaLeaf } from "react-icons/fa";
import toast from "react-hot-toast";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import "../../styles/Ayurveda.css";

const AYURVEDA_API = "/api/v1/ayurveda";

const emptyPackage = {
  packageName: "",
  description: "",
  durationDays: 7,
  price: "",
  isActive: true,
  isAllInclusive: false,
  includesYoga: false,
  includesMeditation: false,
  includesDining: false,
  maxCapacity: 10,
  validFrom: "",
  validTo: "",
  imageUrl: "",
  category: "",
  treatmentsIncluded: "",
};

const emptyCourse = {
  courseName: "",
  description: "",
  durationWeeks: 4,
  price: "",
  maxStudents: 20,
  startDate: "",
  endDate: "",
  isActive: true,
  instructorName: "",
  courseLevel: "Beginner",
  certificationIncluded: false,
  courseImageUrl: "",
  prerequisites: "",
};

const emptyConsultation = {
  doctorName: "",
  specialization: "",
  qualification: "",
  experienceYears: 0,
  consultationDate: "",
  startTime: "09:00",
  endTime: "10:00",
  price: "",
  maxPatientsPerSlot: 1,
  isActive: true,
  doctorImageUrl: "",
};

const AyurvedaRegistration = () => {
  const [activeTab, setActiveTab] = useState("packages");

  // packages
  const [packages, setPackages] = useState([]);
  const [packagesLoading, setPackagesLoading] = useState(false);

  // courses
  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(false);

  // consultations
  const [consultations, setConsultations] = useState([]);
  const [consultationsLoading, setConsultationsLoading] = useState(false);

  // modal state
  const [modalType, setModalType] = useState(null); // 'package' | 'course' | 'consultation'
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const loadPackages = useCallback(async () => {
    setPackagesLoading(true);
    try {
      const res = await axiosInstance.get(`${AYURVEDA_API}/packages`);
      setPackages(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load packages");
    } finally {
      setPackagesLoading(false);
    }
  }, []);

  const loadCourses = useCallback(async () => {
    setCoursesLoading(true);
    try {
      const res = await axiosInstance.get(`${AYURVEDA_API}/courses`);
      setCourses(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load courses");
    } finally {
      setCoursesLoading(false);
    }
  }, []);

  const loadConsultations = useCallback(async () => {
    setConsultationsLoading(true);
    try {
      const res = await axiosInstance.get(`${AYURVEDA_API}/consultations`);
      setConsultations(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load consultations");
    } finally {
      setConsultationsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPackages();
    loadCourses();
    loadConsultations();
  }, [loadPackages, loadCourses, loadConsultations]);

  const openCreate = (type) => {
    setEditingId(null);
    if (type === "package") setForm({ ...emptyPackage });
    if (type === "course") setForm({ ...emptyCourse });
    if (type === "consultation") setForm({ ...emptyConsultation });
    setModalType(type);
  };

  const openEdit = (type, row) => {
    setEditingId(row.id);
    setForm({ ...row });
    setModalType(type);
  };

  const closeModal = () => {
    setModalType(null);
    setEditingId(null);
    setForm({});
  };

  const setField = (key, value) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const validatePackage = (f) => {
    if (!f.packageName?.trim()) return "Package name is required";
    if (!f.durationDays || f.durationDays <= 0) return "Duration days must be positive";
    if (!f.price || Number(f.price) <= 0) return "Price must be positive";
    if (f.isAllInclusive && (!f.includesYoga || !f.includesMeditation || !f.includesDining)) {
      return "All-inclusive packages must include yoga, meditation and dining";
    }
    return null;
  };

  const validateCourse = (f) => {
    if (!f.courseName?.trim()) return "Course name is required";
    if (!f.durationWeeks || f.durationWeeks <= 0) return "Duration weeks must be positive";
    if (!f.price || Number(f.price) <= 0) return "Price must be positive";
    if (!f.maxStudents || f.maxStudents <= 0) return "Max students must be positive";
    if (!f.startDate || !f.endDate) return "Start and end dates are required";
    return null;
  };

  const validateConsultation = (f) => {
    if (!f.doctorName?.trim()) return "Doctor name is required";
    if (!f.consultationDate) return "Consultation date is required";
    if (!f.startTime || !f.endTime) return "Start and end times are required";
    if (!f.price || Number(f.price) <= 0) return "Price must be positive";
    return null;
  };

  const submit = async () => {
    let err = null;
    let url = "";
    let payload = { ...form };

    if (modalType === "package") {
      err = validatePackage(form);
      url = `${AYURVEDA_API}/packages${editingId ? `/${editingId}` : ""}`;
      payload.price = Number(payload.price);
      payload.durationDays = Number(payload.durationDays);
      payload.maxCapacity = payload.maxCapacity ? Number(payload.maxCapacity) : null;
    } else if (modalType === "course") {
      err = validateCourse(form);
      url = `${AYURVEDA_API}/courses${editingId ? `/${editingId}` : ""}`;
      payload.price = Number(payload.price);
      payload.durationWeeks = Number(payload.durationWeeks);
      payload.maxStudents = Number(payload.maxStudents);
    } else if (modalType === "consultation") {
      err = validateConsultation(form);
      url = `${AYURVEDA_API}/consultations${editingId ? `/${editingId}` : ""}`;
      payload.price = Number(payload.price);
      payload.experienceYears = payload.experienceYears ? Number(payload.experienceYears) : 0;
      payload.maxPatientsPerSlot = Number(payload.maxPatientsPerSlot) || 1;
    }

    if (err) {
      toast.error(err);
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await axiosInstance.put(url, payload);
        toast.success("Updated successfully");
      } else {
        await axiosInstance.post(url, payload);
        toast.success("Created successfully");
      }
      closeModal();
      if (modalType === "package") loadPackages();
      if (modalType === "course") loadCourses();
      if (modalType === "consultation") loadConsultations();
    } catch (e) {
      console.error(e);
      const msg = e?.response?.data?.message || "Save failed";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (type, id) => {
    if (!window.confirm("Deactivate this item? (Soft delete)")) return;
    try {
      let url = "";
      if (type === "package") url = `${AYURVEDA_API}/packages/${id}`;
      if (type === "course") url = `${AYURVEDA_API}/courses/${id}`;
      if (type === "consultation") url = `${AYURVEDA_API}/consultations/${id}`;
      await axiosInstance.delete(url);
      toast.success("Deactivated");
      if (type === "package") loadPackages();
      if (type === "course") loadCourses();
      if (type === "consultation") loadConsultations();
    } catch (e) {
      console.error(e);
      toast.error("Delete failed");
    }
  };

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
                  <FaLeaf /> Ayurveda Registration
                </h2>
                <p className="ayurveda-subtitle">
                  Manage Ayurveda packages, doctor consultations & courses
                </p>
              </div>
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
                    Ayurveda Packages
                  </span>
                }
              >
                <div className="ayurveda-action-bar">
                  <Button variant="success" onClick={() => openCreate("package")}>
                    <FaPlus className="me-1" /> New Package
                  </Button>
                </div>
                <Card className="ayurveda-card-body">
                  {packagesLoading ? (
                    <div className="text-center py-4">
                      <Spinner animation="border" variant="success" />
                    </div>
                  ) : packages.length === 0 ? (
                    <div className="ayurveda-empty">No packages yet. Click "New Package" to add one.</div>
                  ) : (
                    <Table responsive striped hover size="sm">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Name</th>
                          <th>Category</th>
                          <th>Duration</th>
                          <th>Price</th>
                          <th>All-Inclusive</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {packages.map((p, idx) => (
                          <tr key={p.id}>
                            <td>{idx + 1}</td>
                            <td>{p.packageName}</td>
                            <td>{p.category || "-"}</td>
                            <td>{p.durationDays} days</td>
                            <td>₹{p.price}</td>
                            <td>{p.isAllInclusive ? <Badge bg="success">Yes</Badge> : <Badge bg="secondary">No</Badge>}</td>
                            <td>
                              {p.isActive ? (
                                <Badge bg="success">Active</Badge>
                              ) : (
                                <Badge bg="secondary">Inactive</Badge>
                              )}
                            </td>
                            <td>
                              <Button
                                size="sm"
                                variant="outline-primary"
                                className="me-1"
                                onClick={() => openEdit("package", p)}
                              >
                                <FaEdit />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline-danger"
                                onClick={() => deleteItem("package", p.id)}
                              >
                                <FaTrash />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  )}
                </Card>
              </Tab>

              <Tab
                eventKey="consultations"
                title={
                  <span>
                    <FaUserMd className="me-2" />
                    Doctor Consultations
                  </span>
                }
              >
                <div className="ayurveda-action-bar">
                  <Button variant="success" onClick={() => openCreate("consultation")}>
                    <FaPlus className="me-1" /> New Consultation Slot
                  </Button>
                </div>
                <Card className="ayurveda-card-body">
                  {consultationsLoading ? (
                    <div className="text-center py-4">
                      <Spinner animation="border" variant="success" />
                    </div>
                  ) : consultations.length === 0 ? (
                    <div className="ayurveda-empty">No consultation slots configured.</div>
                  ) : (
                    <Table responsive striped hover size="sm">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Doctor</th>
                          <th>Specialization</th>
                          <th>Date</th>
                          <th>Time</th>
                          <th>Price</th>
                          <th>Slots</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {consultations.map((c, idx) => (
                          <tr key={c.id}>
                            <td>{idx + 1}</td>
                            <td>{c.doctorName}</td>
                            <td>{c.specialization || "-"}</td>
                            <td>{c.consultationDate}</td>
                            <td>
                              {c.startTime} - {c.endTime}
                            </td>
                            <td>₹{c.price}</td>
                            <td>
                              {c.currentBookings}/{c.maxPatientsPerSlot}
                            </td>
                            <td>
                              {c.isActive ? (
                                <Badge bg="success">Active</Badge>
                              ) : (
                                <Badge bg="secondary">Inactive</Badge>
                              )}
                            </td>
                            <td>
                              <Button
                                size="sm"
                                variant="outline-primary"
                                className="me-1"
                                onClick={() => openEdit("consultation", c)}
                              >
                                <FaEdit />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline-danger"
                                onClick={() => deleteItem("consultation", c.id)}
                              >
                                <FaTrash />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  )}
                </Card>
              </Tab>

              <Tab
                eventKey="courses"
                title={
                  <span>
                    <FaBookOpen className="me-2" />
                    Ayurveda Courses
                  </span>
                }
              >
                <div className="ayurveda-action-bar">
                  <Button variant="success" onClick={() => openCreate("course")}>
                    <FaPlus className="me-1" /> New Course
                  </Button>
                </div>
                <Card className="ayurveda-card-body">
                  {coursesLoading ? (
                    <div className="text-center py-4">
                      <Spinner animation="border" variant="success" />
                    </div>
                  ) : courses.length === 0 ? (
                    <div className="ayurveda-empty">No courses yet.</div>
                  ) : (
                    <Table responsive striped hover size="sm">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Course</th>
                          <th>Instructor</th>
                          <th>Level</th>
                          <th>Duration</th>
                          <th>Price</th>
                          <th>Seats</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {courses.map((c, idx) => (
                          <tr key={c.id}>
                            <td>{idx + 1}</td>
                            <td>{c.courseName}</td>
                            <td>{c.instructorName || "-"}</td>
                            <td>{c.courseLevel || "-"}</td>
                            <td>{c.durationWeeks} wks</td>
                            <td>₹{c.price}</td>
                            <td>
                              {c.currentEnrollments}/{c.maxStudents}
                            </td>
                            <td>
                              {c.isActive ? (
                                <Badge bg="success">Active</Badge>
                              ) : (
                                <Badge bg="secondary">Inactive</Badge>
                              )}
                            </td>
                            <td>
                              <Button
                                size="sm"
                                variant="outline-primary"
                                className="me-1"
                                onClick={() => openEdit("course", c)}
                              >
                                <FaEdit />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline-danger"
                                onClick={() => deleteItem("course", c.id)}
                              >
                                <FaTrash />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  )}
                </Card>
              </Tab>
            </Tabs>
          </Container>
        </div>
      </div>

      {/* ===== Modal ===== */}
      <Modal show={modalType !== null} onHide={closeModal} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {editingId ? "Edit " : "New "}
            {modalType === "package" && "Ayurveda Package"}
            {modalType === "course" && "Ayurveda Course"}
            {modalType === "consultation" && "Doctor Consultation"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {modalType === "package" && (
            <Form>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-2">
                    <Form.Label>Package Name *</Form.Label>
                    <Form.Control
                      value={form.packageName || ""}
                      onChange={(e) => setField("packageName", e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-2">
                    <Form.Label>Category</Form.Label>
                    <Form.Select
                      value={form.category || ""}
                      onChange={(e) => setField("category", e.target.value)}
                    >
                      <option value="">-- Select --</option>
                      <option>Detox</option>
                      <option>Panchakarma</option>
                      <option>Rejuvenation</option>
                      <option>Wellness</option>
                      <option>Weight Management</option>
                      <option>Stress Relief</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>
              <Form.Group className="mb-2">
                <Form.Label>Description</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  value={form.description || ""}
                  onChange={(e) => setField("description", e.target.value)}
                />
              </Form.Group>
              <Row>
                <Col md={3}>
                  <Form.Group className="mb-2">
                    <Form.Label>Duration (Days) *</Form.Label>
                    <Form.Control
                      type="number"
                      value={form.durationDays || ""}
                      onChange={(e) => setField("durationDays", e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group className="mb-2">
                    <Form.Label>Price *</Form.Label>
                    <Form.Control
                      type="number"
                      value={form.price || ""}
                      onChange={(e) => setField("price", e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group className="mb-2">
                    <Form.Label>Max Capacity</Form.Label>
                    <Form.Control
                      type="number"
                      value={form.maxCapacity || ""}
                      onChange={(e) => setField("maxCapacity", e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group className="mb-2">
                    <Form.Label>Image URL</Form.Label>
                    <Form.Control
                      value={form.imageUrl || ""}
                      onChange={(e) => setField("imageUrl", e.target.value)}
                    />
                  </Form.Group>
                </Col>
              </Row>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-2">
                    <Form.Label>Valid From</Form.Label>
                    <Form.Control
                      type="date"
                      value={form.validFrom || ""}
                      onChange={(e) => setField("validFrom", e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-2">
                    <Form.Label>Valid To</Form.Label>
                    <Form.Control
                      type="date"
                      value={form.validTo || ""}
                      onChange={(e) => setField("validTo", e.target.value)}
                    />
                  </Form.Group>
                </Col>
              </Row>
              <Form.Group className="mb-2">
                <Form.Label>Treatments Included</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  value={form.treatmentsIncluded || ""}
                  onChange={(e) => setField("treatmentsIncluded", e.target.value)}
                  placeholder="e.g. Abhyanga, Shirodhara, Herbal Steam Bath"
                />
              </Form.Group>
              <Row className="mt-2">
                <Col md={3}>
                  <Form.Check
                    type="checkbox"
                    label="Includes Yoga"
                    checked={!!form.includesYoga}
                    onChange={(e) => setField("includesYoga", e.target.checked)}
                  />
                </Col>
                <Col md={3}>
                  <Form.Check
                    type="checkbox"
                    label="Includes Meditation"
                    checked={!!form.includesMeditation}
                    onChange={(e) => setField("includesMeditation", e.target.checked)}
                  />
                </Col>
                <Col md={3}>
                  <Form.Check
                    type="checkbox"
                    label="Includes Dining"
                    checked={!!form.includesDining}
                    onChange={(e) => setField("includesDining", e.target.checked)}
                  />
                </Col>
                <Col md={3}>
                  <Form.Check
                    type="checkbox"
                    label="All-Inclusive"
                    checked={!!form.isAllInclusive}
                    onChange={(e) => setField("isAllInclusive", e.target.checked)}
                  />
                </Col>
              </Row>
              <Form.Check
                type="switch"
                className="mt-2"
                label="Active"
                checked={form.isActive !== false}
                onChange={(e) => setField("isActive", e.target.checked)}
              />
            </Form>
          )}

          {modalType === "course" && (
            <Form>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-2">
                    <Form.Label>Course Name *</Form.Label>
                    <Form.Control
                      value={form.courseName || ""}
                      onChange={(e) => setField("courseName", e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-2">
                    <Form.Label>Instructor</Form.Label>
                    <Form.Control
                      value={form.instructorName || ""}
                      onChange={(e) => setField("instructorName", e.target.value)}
                    />
                  </Form.Group>
                </Col>
              </Row>
              <Form.Group className="mb-2">
                <Form.Label>Description</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  value={form.description || ""}
                  onChange={(e) => setField("description", e.target.value)}
                />
              </Form.Group>
              <Row>
                <Col md={3}>
                  <Form.Group className="mb-2">
                    <Form.Label>Level</Form.Label>
                    <Form.Select
                      value={form.courseLevel || ""}
                      onChange={(e) => setField("courseLevel", e.target.value)}
                    >
                      <option>Beginner</option>
                      <option>Intermediate</option>
                      <option>Advanced</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group className="mb-2">
                    <Form.Label>Duration (Weeks) *</Form.Label>
                    <Form.Control
                      type="number"
                      value={form.durationWeeks || ""}
                      onChange={(e) => setField("durationWeeks", e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group className="mb-2">
                    <Form.Label>Price *</Form.Label>
                    <Form.Control
                      type="number"
                      value={form.price || ""}
                      onChange={(e) => setField("price", e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group className="mb-2">
                    <Form.Label>Max Students *</Form.Label>
                    <Form.Control
                      type="number"
                      value={form.maxStudents || ""}
                      onChange={(e) => setField("maxStudents", e.target.value)}
                    />
                  </Form.Group>
                </Col>
              </Row>
              <Row>
                <Col md={4}>
                  <Form.Group className="mb-2">
                    <Form.Label>Start Date *</Form.Label>
                    <Form.Control
                      type="date"
                      value={form.startDate || ""}
                      onChange={(e) => setField("startDate", e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className="mb-2">
                    <Form.Label>End Date *</Form.Label>
                    <Form.Control
                      type="date"
                      value={form.endDate || ""}
                      onChange={(e) => setField("endDate", e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className="mb-2">
                    <Form.Label>Image URL</Form.Label>
                    <Form.Control
                      value={form.courseImageUrl || ""}
                      onChange={(e) => setField("courseImageUrl", e.target.value)}
                    />
                  </Form.Group>
                </Col>
              </Row>
              <Form.Group className="mb-2">
                <Form.Label>Prerequisites</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  value={form.prerequisites || ""}
                  onChange={(e) => setField("prerequisites", e.target.value)}
                />
              </Form.Group>
              <Form.Check
                type="checkbox"
                label="Certification Included"
                checked={!!form.certificationIncluded}
                onChange={(e) => setField("certificationIncluded", e.target.checked)}
              />
              <Form.Check
                type="switch"
                className="mt-2"
                label="Active"
                checked={form.isActive !== false}
                onChange={(e) => setField("isActive", e.target.checked)}
              />
            </Form>
          )}

          {modalType === "consultation" && (
            <Form>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-2">
                    <Form.Label>Doctor Name *</Form.Label>
                    <Form.Control
                      value={form.doctorName || ""}
                      onChange={(e) => setField("doctorName", e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-2">
                    <Form.Label>Specialization</Form.Label>
                    <Form.Control
                      value={form.specialization || ""}
                      onChange={(e) => setField("specialization", e.target.value)}
                      placeholder="e.g. Panchakarma Specialist"
                    />
                  </Form.Group>
                </Col>
              </Row>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-2">
                    <Form.Label>Qualification</Form.Label>
                    <Form.Control
                      value={form.qualification || ""}
                      onChange={(e) => setField("qualification", e.target.value)}
                      placeholder="BAMS, MD (Ayurveda)"
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group className="mb-2">
                    <Form.Label>Experience (Years)</Form.Label>
                    <Form.Control
                      type="number"
                      value={form.experienceYears || 0}
                      onChange={(e) => setField("experienceYears", e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group className="mb-2">
                    <Form.Label>Price *</Form.Label>
                    <Form.Control
                      type="number"
                      value={form.price || ""}
                      onChange={(e) => setField("price", e.target.value)}
                    />
                  </Form.Group>
                </Col>
              </Row>
              <Row>
                <Col md={4}>
                  <Form.Group className="mb-2">
                    <Form.Label>Date *</Form.Label>
                    <Form.Control
                      type="date"
                      value={form.consultationDate || ""}
                      onChange={(e) => setField("consultationDate", e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group className="mb-2">
                    <Form.Label>Start Time *</Form.Label>
                    <Form.Control
                      type="time"
                      value={form.startTime || ""}
                      onChange={(e) => setField("startTime", e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group className="mb-2">
                    <Form.Label>End Time *</Form.Label>
                    <Form.Control
                      type="time"
                      value={form.endTime || ""}
                      onChange={(e) => setField("endTime", e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={2}>
                  <Form.Group className="mb-2">
                    <Form.Label>Slots</Form.Label>
                    <Form.Control
                      type="number"
                      min={1}
                      value={form.maxPatientsPerSlot || 1}
                      onChange={(e) => setField("maxPatientsPerSlot", e.target.value)}
                    />
                  </Form.Group>
                </Col>
              </Row>
              <Form.Group className="mb-2">
                <Form.Label>Image URL</Form.Label>
                <Form.Control
                  value={form.doctorImageUrl || ""}
                  onChange={(e) => setField("doctorImageUrl", e.target.value)}
                />
              </Form.Group>
              <Form.Check
                type="switch"
                className="mt-2"
                label="Active"
                checked={form.isActive !== false}
                onChange={(e) => setField("isActive", e.target.checked)}
              />
            </Form>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeModal} disabled={saving}>
            Cancel
          </Button>
          <Button variant="success" onClick={submit} disabled={saving}>
            {saving ? <Spinner size="sm" animation="border" /> : editingId ? "Update" : "Create"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AyurvedaRegistration;
