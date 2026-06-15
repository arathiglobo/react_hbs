/**
 * AyurvedaCentreManage.jsx
 *
 * Per-centre management page — mirrors the activity-provider → activity-rates
 * navigation pattern. Lists/edits Packages, Doctor Consultations and Courses
 * for one centre. The centre id comes either from the route param
 * (/registration/ayurveda/centre/:centreId) or from navigation state.
 *
 * Creates auto-attach to this centre (no centre dropdown in the modal —
 * the centre is fixed for the whole page).
 */

import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
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
import {
  FaPlus,
  FaEdit,
  FaTrash,
  FaSpa,
  FaUserMd,
  FaBookOpen,
  FaLeaf,
  FaArrowLeft,
  FaBuilding,
} from "react-icons/fa";
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
  countryId: "",
  cityId: "",
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
  countryId: "",
  cityId: "",
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
  countryId: "",
  cityId: "",
};

const AyurvedaCentreManage = () => {
  const navigate = useNavigate();
  const { centreId: routeCentreId } = useParams();
  const location = useLocation();
  const stateCentre = location.state?.centre || null;

  // Source of truth for the centre id we operate on.
  const centreId = routeCentreId
    ? Number(routeCentreId)
    : stateCentre?.id
    ? Number(stateCentre.id)
    : null;

  const [centre, setCentre] = useState(stateCentre);
  const [activeTab, setActiveTab] = useState("packages");

  // Per-centre item lists
  const [packages, setPackages] = useState([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [consultations, setConsultations] = useState([]);
  const [consultationsLoading, setConsultationsLoading] = useState(false);

  // Modal state for create/edit (one shared modal across the 3 types)
  const [modalType, setModalType] = useState(null); // 'package' | 'course' | 'consultation'
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({});
  const [pendingImages, setPendingImages] = useState([]);
  const [saving, setSaving] = useState(false);

  // Country/city lookups for the inner forms.
  const [countries, setCountries] = useState([]);
  const [cities, setCities] = useState([]);
  const [citiesLoading, setCitiesLoading] = useState(false);

  // ----- Loaders (all scoped to centreId so legacy items never leak in) -----
  const loadCentre = useCallback(async () => {
    if (!centreId) return;
    try {
      const res = await axiosInstance.get(`${AYURVEDA_API}/centres/${centreId}`);
      setCentre(res.data);
    } catch (e) {
      console.error(e);
    }
  }, [centreId]);

  const loadPackages = useCallback(async () => {
    if (!centreId) return;
    setPackagesLoading(true);
    try {
      const res = await axiosInstance.get(`${AYURVEDA_API}/packages`, {
        params: { centreId },
      });
      setPackages(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load packages");
    } finally {
      setPackagesLoading(false);
    }
  }, [centreId]);

  const loadCourses = useCallback(async () => {
    if (!centreId) return;
    setCoursesLoading(true);
    try {
      const res = await axiosInstance.get(`${AYURVEDA_API}/courses`, {
        params: { centreId },
      });
      setCourses(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load courses");
    } finally {
      setCoursesLoading(false);
    }
  }, [centreId]);

  // /consultations (list of all) is not centre-aware; use available
  // endpoint which now accepts centreId.
  const loadConsultations = useCallback(async () => {
    if (!centreId) return;
    setConsultationsLoading(true);
    try {
      const res = await axiosInstance.get(`${AYURVEDA_API}/consultations`);
      const all = Array.isArray(res.data) ? res.data : [];
      // Client-side scope by centreId so admin sees this centre's doctors
      // even when they're booked / inactive.
      setConsultations(
        all.filter((c) => Number(c.centreId) === Number(centreId))
      );
    } catch (e) {
      console.error(e);
      toast.error("Failed to load consultations");
    } finally {
      setConsultationsLoading(false);
    }
  }, [centreId]);

  useEffect(() => {
    if (!stateCentre) loadCentre();
    loadPackages();
    loadCourses();
    loadConsultations();
  }, [stateCentre, loadCentre, loadPackages, loadCourses, loadConsultations]);

  // Country list once.
  useEffect(() => {
    axiosInstance
      .get("/api/country?limit=10000")
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setCountries(list.filter((c) => !c.isDeleted));
      })
      .catch(() => {});
  }, []);

  // Cities re-load whenever the form's country changes.
  useEffect(() => {
    if (modalType === null) return;
    setCitiesLoading(true);
    const url = form.countryId
      ? `/api/province/getByCountryId/${form.countryId}`
      : `/api/province?limit=10000`;
    axiosInstance
      .get(url)
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setCities(list.filter((c) => !c.isDeleted));
      })
      .catch(() => setCities([]))
      .finally(() => setCitiesLoading(false));
  }, [modalType, form.countryId]);

  // ----- Modal helpers -----
  const openCreate = (type) => {
    setEditingId(null);
    if (type === "package") setForm({ ...emptyPackage });
    if (type === "course") setForm({ ...emptyCourse });
    if (type === "consultation") setForm({ ...emptyConsultation });
    setPendingImages([]);
    setModalType(type);
  };

  const openEdit = (type, row) => {
    setEditingId(row.id);
    setForm({ ...row });
    setPendingImages([]);
    setModalType(type);
  };

  const closeModal = () => {
    setModalType(null);
    setEditingId(null);
    setForm({});
    setPendingImages([]);
  };

  const setField = (key, value) =>
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      // Reset cityId whenever the country changes — we never want a stale
      // (countryId, cityId) pair to be persisted.
      if (key === "countryId" && prev.countryId !== value) {
        next.cityId = "";
      }
      return next;
    });

  // ----- Validators -----
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

  // ----- Submit (auto-attaches the page's centreId) -----
  const submit = async () => {
    if (!centreId) {
      toast.error("Missing centre — go back to the centres list");
      return;
    }
    let err = null;
    let url = "";
    let payload = { ...form };

    // Auto-attach the centre and coerce nullable lookup IDs.
    payload.centreId = Number(centreId);
    payload.countryId = payload.countryId ? Number(payload.countryId) : null;
    payload.cityId = payload.cityId ? Number(payload.cityId) : null;

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
      const hasFiles = pendingImages && pendingImages.length > 0;
      const method = editingId ? "put" : "post";

      if (hasFiles) {
        const fd = new FormData();
        fd.append("data", new Blob([JSON.stringify(payload)], { type: "application/json" }));
        if (modalType === "consultation") {
          fd.append("image", pendingImages[0]);
        } else {
          Array.from(pendingImages).forEach((f) => fd.append("images", f));
        }
        await axiosInstance({
          method,
          url,
          data: fd,
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        await axiosInstance[method](url, payload);
      }

      toast.success(editingId ? "Updated successfully" : "Created successfully");
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

  // Guard: no centreId in URL/state — bounce back to the centre list.
  if (!centreId) {
    return (
      <div className="min-vh-100 bg-light d-flex flex-column">
        <TopBar />
        <div className="d-flex flex-grow-1">
          <Sidebar />
          <main className="flex-grow-1" style={{ minWidth: 0, overflowX: "hidden" }}>
          <Container fluid className="p-4">
            <div className="ayurveda-empty">
              No centre selected.{" "}
              <Button
                variant="link"
                onClick={() => navigate("/registration/ayurveda")}
              >
                Go back to centres
              </Button>
            </div>
          </Container>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1" style={{ minWidth: 0, overflowX: "hidden" }}>
        <div className="ayurveda-page">
          <Container fluid className="p-3">
            <div className="ayurveda-header">
              <div>
                <h2 className="ayurveda-title">
                  <FaLeaf /> {centre?.name || "Ayurveda Centre"}
                </h2>
                <p className="ayurveda-subtitle">
                  <FaBuilding className="me-1" />
                  Manage packages, doctor consultations & courses for this centre
                </p>
              </div>
              <div>
                <Button
                  variant="light"
                  size="sm"
                  onClick={() => navigate("/registration/ayurveda")}
                >
                  <FaArrowLeft className="me-1" /> Back to Centres
                </Button>
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
                    <FaSpa className="me-2" /> Packages
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
                    <div className="ayurveda-empty">
                      No packages yet for this centre. Click "New Package" to add one.
                    </div>
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
                            <td>
                              {p.isAllInclusive ? (
                                <Badge bg="success">Yes</Badge>
                              ) : (
                                <Badge bg="secondary">No</Badge>
                              )}
                            </td>
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
                    <FaUserMd className="me-2" /> Doctor Consultations
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
                    <div className="ayurveda-empty">
                      No consultation slots configured for this centre.
                    </div>
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
                    <FaBookOpen className="me-2" /> Courses
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
                    <div className="ayurveda-empty">
                      No courses yet for this centre.
                    </div>
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
        </main>
      </div>

      {/* ===== Create / Edit Modal ===== */}
      <Modal show={modalType !== null} onHide={closeModal} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {editingId ? "Edit " : "New "}
            {modalType === "package" && "Ayurveda Package"}
            {modalType === "course" && "Ayurveda Course"}
            {modalType === "consultation" && "Doctor Consultation"}
            {centre?.name && (
              <small className="text-muted ms-2">· {centre.name}</small>
            )}
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
                    <Form.Label>Images (multiple)</Form.Label>
                    <Form.Control
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) =>
                        setPendingImages(Array.from(e.target.files || []))
                      }
                    />
                    {pendingImages.length > 0 ? (
                      <Form.Text className="text-success">
                        {pendingImages.length} new image
                        {pendingImages.length > 1 ? "s" : ""} selected
                      </Form.Text>
                    ) : form.imageUrl ? (
                      <Form.Text className="text-muted">
                        {form.imageUrl.split(",").filter(Boolean).length} existing image
                        {form.imageUrl.split(",").filter(Boolean).length > 1 ? "s" : ""} kept
                      </Form.Text>
                    ) : null}
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
                    onChange={(e) =>
                      setField("includesMeditation", e.target.checked)
                    }
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
              <Row className="mt-2">
                <Col md={6}>
                  <Form.Group className="mb-2">
                    <Form.Label>Country</Form.Label>
                    <Form.Select
                      value={form.countryId || ""}
                      onChange={(e) => setField("countryId", e.target.value)}
                    >
                      <option value="">-- Select Country --</option>
                      {countries.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-2">
                    <Form.Label>
                      City {citiesLoading && <Spinner size="sm" animation="border" />}
                    </Form.Label>
                    <Form.Select
                      value={form.cityId || ""}
                      onChange={(e) => setField("cityId", e.target.value)}
                      disabled={citiesLoading}
                    >
                      <option value="">-- Select City --</option>
                      {cities.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.stateName}
                          {c.country ? ` (${c.country})` : ""}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
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
                    <Form.Label>Images (multiple)</Form.Label>
                    <Form.Control
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) =>
                        setPendingImages(Array.from(e.target.files || []))
                      }
                    />
                    {pendingImages.length > 0 ? (
                      <Form.Text className="text-success">
                        {pendingImages.length} new image
                        {pendingImages.length > 1 ? "s" : ""} selected
                      </Form.Text>
                    ) : form.courseImageUrl ? (
                      <Form.Text className="text-muted">
                        {form.courseImageUrl.split(",").filter(Boolean).length} existing image
                        {form.courseImageUrl.split(",").filter(Boolean).length > 1 ? "s" : ""} kept
                      </Form.Text>
                    ) : null}
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
                onChange={(e) =>
                  setField("certificationIncluded", e.target.checked)
                }
              />
              <Row className="mt-2">
                <Col md={6}>
                  <Form.Group className="mb-2">
                    <Form.Label>Country</Form.Label>
                    <Form.Select
                      value={form.countryId || ""}
                      onChange={(e) => setField("countryId", e.target.value)}
                    >
                      <option value="">-- Select Country --</option>
                      {countries.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-2">
                    <Form.Label>
                      City {citiesLoading && <Spinner size="sm" animation="border" />}
                    </Form.Label>
                    <Form.Select
                      value={form.cityId || ""}
                      onChange={(e) => setField("cityId", e.target.value)}
                      disabled={citiesLoading}
                    >
                      <option value="">-- Select City --</option>
                      {cities.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.stateName}
                          {c.country ? ` (${c.country})` : ""}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
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
                      onChange={(e) =>
                        setField("consultationDate", e.target.value)
                      }
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
                      onChange={(e) =>
                        setField("maxPatientsPerSlot", e.target.value)
                      }
                    />
                  </Form.Group>
                </Col>
              </Row>
              <Form.Group className="mb-2">
                <Form.Label>Doctor Image</Form.Label>
                <Form.Control
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setPendingImages(Array.from(e.target.files || []))
                  }
                />
                {pendingImages.length > 0 ? (
                  <Form.Text className="text-success">New image selected</Form.Text>
                ) : form.doctorImageUrl ? (
                  <Form.Text className="text-muted">
                    Current image will be kept (upload a new one to replace it).
                  </Form.Text>
                ) : null}
              </Form.Group>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-2">
                    <Form.Label>Country</Form.Label>
                    <Form.Select
                      value={form.countryId || ""}
                      onChange={(e) => setField("countryId", e.target.value)}
                    >
                      <option value="">-- Select Country --</option>
                      {countries.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-2">
                    <Form.Label>
                      City {citiesLoading && <Spinner size="sm" animation="border" />}
                    </Form.Label>
                    <Form.Select
                      value={form.cityId || ""}
                      onChange={(e) => setField("cityId", e.target.value)}
                      disabled={citiesLoading}
                    >
                      <option value="">-- Select City --</option>
                      {cities.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.stateName}
                          {c.country ? ` (${c.country})` : ""}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
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
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeModal} disabled={saving}>
            Cancel
          </Button>
          <Button variant="success" onClick={submit} disabled={saving}>
            {saving ? (
              <Spinner size="sm" animation="border" />
            ) : editingId ? (
              "Update"
            ) : (
              "Create"
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AyurvedaCentreManage;
