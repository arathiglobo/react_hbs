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
import { FaPlus, FaEdit, FaTrash, FaSpa, FaUserMd, FaBookOpen, FaLeaf, FaEnvelopeOpenText, FaReply } from "react-icons/fa";
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

  // enquiries
  const [enquiries, setEnquiries] = useState([]);
  const [enquiriesLoading, setEnquiriesLoading] = useState(false);
  const [enquiryStatusFilter, setEnquiryStatusFilter] = useState("");
  const [respondingEnquiry, setRespondingEnquiry] = useState(null);
  const [respondForm, setRespondForm] = useState({ status: "RESPONDED", response: "", respondedBy: "" });
  const [responding, setResponding] = useState(false);

  // modal state
  const [modalType, setModalType] = useState(null); // 'package' | 'course' | 'consultation'
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  // Pending image uploads. For packages/courses this is a FileList (multiple).
  // For consultations it's a single File. Cleared on modal open.
  const [pendingImages, setPendingImages] = useState([]);

  // Country & City lookups for registration forms
  const [countries, setCountries] = useState([]);
  const [cities, setCities] = useState([]);
  const [citiesLoading, setCitiesLoading] = useState(false);

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

  const loadEnquiries = useCallback(async () => {
    setEnquiriesLoading(true);
    try {
      const params = { page: 0, size: 100 };
      if (enquiryStatusFilter) params.status = enquiryStatusFilter;
      const res = await axiosInstance.get(`${AYURVEDA_API}/enquiries`, { params });
      const data = res.data?.content || res.data || [];
      setEnquiries(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load enquiries");
    } finally {
      setEnquiriesLoading(false);
    }
  }, [enquiryStatusFilter]);

  useEffect(() => {
    loadPackages();
    loadCourses();
    loadConsultations();
  }, [loadPackages, loadCourses, loadConsultations]);

  // Load countries once. We pass a large `limit` because the /api/country
  // endpoint paginates (default 50) — without this we'd cap the dropdown.
  useEffect(() => {
    axiosInstance
      .get("/api/country?limit=10000")
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setCountries(list.filter((c) => !c.isDeleted));
      })
      .catch((e) => console.error("Failed to load countries", e));
  }, []);

  // Reload cities whenever the country in the active form changes.
  // - With a country selected, use the dedicated `/getByCountryId` endpoint
  //   (returns the full list, no pagination).
  // - Without a country, fall back to the paginated province list with a
  //   large limit so the user still sees the full catalogue.
  useEffect(() => {
    if (modalType === null) return;
    const countryId = form.countryId;
    setCitiesLoading(true);
    const url = countryId
      ? `/api/province/getByCountryId/${countryId}`
      : `/api/province?limit=10000`;
    axiosInstance
      .get(url)
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setCities(list.filter((c) => !c.isDeleted));
      })
      .catch((e) => {
        console.error("Failed to load cities", e);
        setCities([]);
      })
      .finally(() => setCitiesLoading(false));
  }, [modalType, form.countryId]);

  useEffect(() => {
    if (activeTab === "enquiries") loadEnquiries();
  }, [activeTab, loadEnquiries]);

  const openRespond = (enquiry) => {
    setRespondingEnquiry(enquiry);
    setRespondForm({
      status: enquiry.status === "NEW" ? "IN_PROGRESS" : enquiry.status,
      response: enquiry.response || "",
      respondedBy:
        localStorage.getItem("UserName") ||
        localStorage.getItem("userName") ||
        "",
    });
  };

  const closeRespond = () => {
    setRespondingEnquiry(null);
    setRespondForm({ status: "RESPONDED", response: "", respondedBy: "" });
  };

  const submitRespond = async () => {
    if (!respondingEnquiry) return;
    if (!respondForm.status) {
      toast.error("Status is required");
      return;
    }
    setResponding(true);
    try {
      await axiosInstance.put(
        `${AYURVEDA_API}/enquiries/${respondingEnquiry.id}/status`,
        respondForm
      );
      toast.success("Enquiry updated");
      closeRespond();
      loadEnquiries();
    } catch (e) {
      console.error(e);
      toast.error("Update failed");
    } finally {
      setResponding(false);
    }
  };

  const deleteEnquiry = async (id) => {
    if (!window.confirm("Delete this enquiry permanently?")) return;
    try {
      await axiosInstance.delete(`${AYURVEDA_API}/enquiries/${id}`);
      toast.success("Deleted");
      loadEnquiries();
    } catch (e) {
      console.error(e);
      toast.error("Delete failed");
    }
  };

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
      // Changing the country should clear the previously selected city
      // so we never persist a mismatched (countryId, cityId) pair.
      if (key === "countryId" && prev.countryId !== value) {
        next.cityId = "";
      }
      return next;
    });

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

    // Coerce country/city IDs to Long-friendly values (or null when blank)
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
      // If the user picked file(s), submit as multipart. Otherwise fall
      // back to JSON so we don't strip the existing imageUrl on edits
      // where they didn't re-upload.
      const hasFiles = pendingImages && pendingImages.length > 0;
      const method = editingId ? "put" : "post";

      if (hasFiles) {
        const fd = new FormData();
        fd.append("data", new Blob([JSON.stringify(payload)], { type: "application/json" }));
        if (modalType === "consultation") {
          // single file under the "image" part
          fd.append("image", pendingImages[0]);
        } else {
          // multiple files under "images" — repeat the part name
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
                eventKey="enquiries"
                title={
                  <span>
                    <FaEnvelopeOpenText className="me-2" />
                    Enquiries
                  </span>
                }
              >
                <div className="ayurveda-action-bar">
                  <Form.Select
                    style={{ maxWidth: 200 }}
                    value={enquiryStatusFilter}
                    onChange={(e) => setEnquiryStatusFilter(e.target.value)}
                  >
                    <option value="">All Statuses</option>
                    <option value="NEW">New</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="RESPONDED">Responded</option>
                    <option value="CLOSED">Closed</option>
                  </Form.Select>
                  <Button variant="outline-success" onClick={loadEnquiries}>
                    Refresh
                  </Button>
                </div>
                <Card className="ayurveda-card-body">
                  {enquiriesLoading ? (
                    <div className="text-center py-4">
                      <Spinner animation="border" variant="success" />
                    </div>
                  ) : enquiries.length === 0 ? (
                    <div className="ayurveda-empty">No enquiries yet.</div>
                  ) : (
                    <Table responsive striped hover size="sm">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Ref</th>
                          <th>Customer</th>
                          <th>Contact</th>
                          <th>Treatment</th>
                          <th>Travel</th>
                          <th>Pax</th>
                          <th>Health Concern</th>
                          <th>Status</th>
                          <th>Submitted</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {enquiries.map((e, idx) => (
                          <tr key={e.id}>
                            <td>{idx + 1}</td>
                            <td><strong>{e.enquiryReference}</strong></td>
                            <td>{e.name}</td>
                            <td>
                              <div>{e.email || "-"}</div>
                              <div className="small text-muted">{e.phone || "-"}</div>
                            </td>
                            <td>{e.preferredTreatment || "-"}</td>
                            <td>
                              {e.travelStartDate || "-"}
                              {e.travelEndDate ? ` → ${e.travelEndDate}` : ""}
                            </td>
                            <td>{e.numberOfPersons}</td>
                            <td style={{ maxWidth: 200, whiteSpace: "normal" }}>
                              {e.healthConcern || "-"}
                            </td>
                            <td>
                              <Badge
                                bg={
                                  e.status === "NEW"
                                    ? "warning"
                                    : e.status === "IN_PROGRESS"
                                    ? "info"
                                    : e.status === "RESPONDED"
                                    ? "success"
                                    : "secondary"
                                }
                              >
                                {e.status}
                              </Badge>
                            </td>
                            <td>
                              {e.createdDate
                                ? new Date(e.createdDate).toLocaleString()
                                : "-"}
                            </td>
                            <td>
                              <Button
                                size="sm"
                                variant="outline-primary"
                                className="me-1"
                                onClick={() => openRespond(e)}
                                title="Respond / update status"
                              >
                                <FaReply />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline-danger"
                                onClick={() => deleteEnquiry(e.id)}
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
                    <Form.Label>Images (multiple)</Form.Label>
                    <Form.Control
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => setPendingImages(Array.from(e.target.files || []))}
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
                      onChange={(e) => setPendingImages(Array.from(e.target.files || []))}
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
                onChange={(e) => setField("certificationIncluded", e.target.checked)}
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
                <Form.Label>Doctor Image</Form.Label>
                <Form.Control
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPendingImages(Array.from(e.target.files || []))}
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
            {saving ? <Spinner size="sm" animation="border" /> : editingId ? "Update" : "Create"}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ===== Enquiry Respond Modal ===== */}
      <Modal show={!!respondingEnquiry} onHide={closeRespond} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            <FaReply className="me-2" /> Respond to Enquiry
            {respondingEnquiry?.enquiryReference
              ? ` — ${respondingEnquiry.enquiryReference}`
              : ""}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {respondingEnquiry && (
            <>
              <div className="ayurveda-summary-card">
                <Row className="g-2">
                  <Col md={6}>
                    <strong>Name:</strong> {respondingEnquiry.name}
                  </Col>
                  <Col md={6}>
                    <strong>Persons:</strong> {respondingEnquiry.numberOfPersons}
                  </Col>
                  <Col md={6}>
                    <strong>Email:</strong> {respondingEnquiry.email || "-"}
                  </Col>
                  <Col md={6}>
                    <strong>Phone:</strong> {respondingEnquiry.phone || "-"}
                  </Col>
                  <Col md={6}>
                    <strong>Preferred Treatment:</strong>{" "}
                    {respondingEnquiry.preferredTreatment || "-"}
                  </Col>
                  <Col md={6}>
                    <strong>Travel:</strong>{" "}
                    {respondingEnquiry.travelStartDate || "-"}
                    {respondingEnquiry.travelEndDate
                      ? ` → ${respondingEnquiry.travelEndDate}`
                      : ""}
                  </Col>
                  {respondingEnquiry.healthConcern && (
                    <Col md={12}>
                      <strong>Health Concern:</strong>{" "}
                      {respondingEnquiry.healthConcern}
                    </Col>
                  )}
                  {respondingEnquiry.notes && (
                    <Col md={12}>
                      <strong>Notes:</strong> {respondingEnquiry.notes}
                    </Col>
                  )}
                </Row>
              </div>

              <Form>
                <Row>
                  <Col md={4}>
                    <Form.Group className="mb-2">
                      <Form.Label>Status *</Form.Label>
                      <Form.Select
                        value={respondForm.status}
                        onChange={(e) =>
                          setRespondForm({ ...respondForm, status: e.target.value })
                        }
                      >
                        <option value="NEW">New</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="RESPONDED">Responded</option>
                        <option value="CLOSED">Closed</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={8}>
                    <Form.Group className="mb-2">
                      <Form.Label>Responded By</Form.Label>
                      <Form.Control
                        value={respondForm.respondedBy}
                        onChange={(e) =>
                          setRespondForm({
                            ...respondForm,
                            respondedBy: e.target.value,
                          })
                        }
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Form.Group className="mb-2">
                  <Form.Label>Response Message</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={4}
                    value={respondForm.response}
                    onChange={(e) =>
                      setRespondForm({ ...respondForm, response: e.target.value })
                    }
                    placeholder="Recommendation, suggested package/consultation/course, follow-up details..."
                  />
                </Form.Group>
              </Form>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeRespond} disabled={responding}>
            Cancel
          </Button>
          <Button variant="success" onClick={submitRespond} disabled={responding}>
            {responding ? (
              <Spinner size="sm" animation="border" />
            ) : (
              "Save"
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AyurvedaRegistration;
