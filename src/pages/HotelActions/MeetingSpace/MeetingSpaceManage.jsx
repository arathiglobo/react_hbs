/**
 * MeetingSpaceManage.jsx
 *
 * "Meeting & Space" hotel-actions screen — list page styled like ContractRate.jsx.
 * Lists every meeting space configured for the hotel with action icons; creating
 * or editing opens a large modal that captures rich data:
 *
 *   - long-form description (TEXT in the DB)
 *   - amenities as a normalised list (one row per amenity — meet_space_amenty)
 *   - multiple cancellation policies (own table)
 *   - multiple images (own table)
 *   - currency picked from a /api/currency dropdown (currencyId persisted)
 *   - standard / contract / special rate slabs
 *
 * Built so it does not affect any existing hotel-side flows.
 */
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Card,
  Button,
  Table,
  Spinner,
  Badge,
  Form,
  Pagination,
  Modal,
  Row,
  Col,
} from "react-bootstrap";
import {
  FaArrowLeft,
  FaPlus,
  FaEdit,
  FaTrash,
  FaImages,
  FaUsers,
} from "react-icons/fa";
import axiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import Sidebar from "../../../components/Sidebar";
import Topbar from "../../../components/TopBar";
import HotelTitleBadge from "../../../components/HotelTitleBadge";
import Select from "react-select";
import Swal from "sweetalert2";

// ── constants ────────────────────────────────────────────────────────────
const SPACE_TYPES = [
  "Conference Hall",
  "Meeting Room",
  "Banquet Hall",
  "Board Room",
  "Training Room",
  "Auditorium",
  "Event Hall",
];

const LAYOUT_OPTIONS = [
  "Theatre",
  "U-Shape",
  "Classroom",
  "Boardroom",
  "Banquet",
  "Reception",
];

// Dummy amenity presets — testers can click "Quick add" to populate the chip row.
const COMMON_AMENITIES = [
  "Projector",
  "Wi-Fi",
  "Microphone",
  "AC",
  "Stage",
  "Whiteboard",
  "Video Conferencing",
  "LED Wall",
  "Podium",
  "Dance Floor",
];

// Random sample presets (for one-click testing).
const SAMPLE_PRESETS = [
  {
    spaceName: "Grand Ballroom",
    spaceType: "Banquet Hall",
    description:
      "Spacious banquet hall ideal for weddings, large conferences and gala events. " +
      "Features high ceilings, chandelier lighting, integrated AV system and " +
      "a fully equipped stage area.",
    capacity: 300,
    areaSqft: 4500,
    floorLocation: "Ground Floor",
    layoutOptions: ["Theatre", "Banquet", "Reception"],
    amenities: ["Projector", "Wi-Fi", "Microphone", "AC", "Stage", "LED Wall", "Dance Floor"],
    openTime: "08:00",
    closeTime: "23:00",
    minBookingHours: 4,
    hourlyRate: 5000,
    halfDayRate: 18000,
    fullDayRate: 32000,
    contractHourlyRate: 4200,
    contractHalfDayRate: 15500,
    contractFullDayRate: 28000,
    specialHourlyRate: 3800,
    specialHalfDayRate: 14000,
    specialFullDayRate: 25000,
    taxPercent: 18,
    images: [
      "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800",
      "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=800",
    ],
    cancellationPolicies: [
      { policyText: "Free cancellation up to 7 days before event.", daysBeforeEvent: 7, chargePercent: 0 },
      { policyText: "50% charge if cancelled within 7 days.", daysBeforeEvent: 3, chargePercent: 50 },
      { policyText: "100% charge within 48 hours of the event.", daysBeforeEvent: 1, chargePercent: 100 },
    ],
  },
  {
    spaceName: "Executive Board Room",
    spaceType: "Board Room",
    description:
      "Private board room with 14-seat conference table, video-conferencing system " +
      "and presentation screens.",
    capacity: 14,
    areaSqft: 600,
    floorLocation: "5th Floor",
    layoutOptions: ["Boardroom"],
    amenities: ["Projector", "Wi-Fi", "Microphone", "AC", "Video Conferencing", "Whiteboard"],
    openTime: "08:00",
    closeTime: "20:00",
    minBookingHours: 1,
    hourlyRate: 1500,
    halfDayRate: 5500,
    fullDayRate: 10000,
    contractHourlyRate: 1200,
    contractHalfDayRate: 4500,
    contractFullDayRate: 8500,
    specialHourlyRate: 1000,
    specialHalfDayRate: 3800,
    specialFullDayRate: 7000,
    taxPercent: 18,
    images: ["https://images.unsplash.com/photo-1497366216548-37526070297c?w=800"],
    cancellationPolicies: [
      { policyText: "Free cancellation up to 24 hours before booking.", daysBeforeEvent: 1, chargePercent: 0 },
      { policyText: "100% charge within 24 hours.", daysBeforeEvent: 0, chargePercent: 100 },
    ],
  },
  {
    spaceName: "Sky Conference Hall",
    spaceType: "Conference Hall",
    description:
      "Premium top-floor conference hall with panoramic city views, modular seating " +
      "and full audio-visual support.",
    capacity: 120,
    areaSqft: 2000,
    floorLocation: "12th Floor",
    layoutOptions: ["Theatre", "U-Shape", "Classroom", "Boardroom"],
    amenities: ["Projector", "Wi-Fi", "Microphone", "AC", "Stage", "Podium"],
    openTime: "09:00",
    closeTime: "22:00",
    minBookingHours: 2,
    hourlyRate: 3000,
    halfDayRate: 11000,
    fullDayRate: 20000,
    contractHourlyRate: 2500,
    contractHalfDayRate: 9500,
    contractFullDayRate: 17000,
    specialHourlyRate: 2200,
    specialHalfDayRate: 8500,
    specialFullDayRate: 15000,
    taxPercent: 18,
    images: ["https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=800"],
    cancellationPolicies: [
      { policyText: "Free cancellation up to 72 hours before the event.", daysBeforeEvent: 3, chargePercent: 0 },
      { policyText: "30% charge within 72 hours.", daysBeforeEvent: 2, chargePercent: 30 },
      { policyText: "100% charge within 24 hours.", daysBeforeEvent: 1, chargePercent: 100 },
    ],
  },
];

const emptyForm = {
  spaceName: "",
  spaceType: "Conference Hall",
  description: "",
  capacity: "",
  areaSqft: "",
  floorLocation: "",
  layoutOptions: [],
  amenities: [],
  openTime: "09:00",
  closeTime: "21:00",
  minBookingHours: 1,
  hourlyRate: "",
  halfDayRate: "",
  fullDayRate: "",
  contractHourlyRate: "",
  contractHalfDayRate: "",
  contractFullDayRate: "",
  specialHourlyRate: "",
  specialHalfDayRate: "",
  specialFullDayRate: "",
  currencyId: null,
  currencyCode: "INR",
  taxPercent: "",
  status: "Active",
  images: [],
  cancellationPolicies: [],
};

const pickPreset = () =>
  SAMPLE_PRESETS[Math.floor(Math.random() * SAMPLE_PRESETS.length)];

export default function MeetingSpaceManage() {
  const { id: hotelId } = useParams();
  const navigate = useNavigate();

  // list-page state
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [hotelName, setHotelName] = useState("");

  // Status-toggle modal state — mirrors the ContractRate pattern.
  // The status column on this page is a string ("Active" / "Inactive")
  // rather than a boolean, so the PATCH body uses { status: "..." }.
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedSpace, setSelectedSpace] = useState(null);
  const [statusUpdating, setStatusUpdating] = useState(false);

  // form state
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [currencyOptions, setCurrencyOptions] = useState([]);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newAmenity, setNewAmenity] = useState("");

  const PAGE_SIZE = 10;

  // ── fetchers ──────────────────────────────────────────────────────────
  const fetchSpaces = async (pageNum = 0, searchTerm = search) => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(
        `/api/meet-and-space/by-hotel/${hotelId}`
      );
      const all = Array.isArray(res.data) ? res.data : [];
      const filtered = searchTerm
        ? all.filter(
            (r) =>
              (r.spaceName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
              (r.spaceType || "").toLowerCase().includes(searchTerm.toLowerCase())
          )
        : all;
      const start = pageNum * PAGE_SIZE;
      setRows(filtered.slice(start, start + PAGE_SIZE));
      setTotalPages(Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
      setPage(pageNum);
    } catch (err) {
      console.error("Load meeting spaces failed", err);
      toast.error("Failed to load meeting spaces");
      setRows([]);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  };

  // Currency dropdown — /api/currency?page=0&limit=10
  const fetchCurrencies = async () => {
    try {
      const res = await axiosInstance.get("/api/currency?page=0&limit=50");
      const list = Array.isArray(res.data) ? res.data : res.data?.content || [];
      setCurrencyOptions(
        list
          .filter((c) => !c.isDeleted)
          .map((c) => ({
            value: c.currencyId,
            label: `${c.currencyCode} — ${(c.name || "").trim()}`,
            currencyCode: c.currencyCode,
          }))
      );
    } catch (err) {
      console.error("Load currencies failed", err);
      setCurrencyOptions([]);
    }
  };

  useEffect(() => {
    if (!hotelId) return;
    fetchSpaces();
    fetchCurrencies();
    axiosInstance
      .get(`/api/hotels/${hotelId}`)
      .then((r) => setHotelName(r.data?.hotelName || r.data?.hotel_name || ""))
      .catch(() => {});
    // eslint-disable-next-line
  }, [hotelId]);

  // Debounced search.
  useEffect(() => {
    if (searchTimeout) clearTimeout(searchTimeout);
    const t = setTimeout(() => fetchSpaces(0, search), 400);
    setSearchTimeout(t);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [search]);

  // ── modal helpers ─────────────────────────────────────────────────────
  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, ...pickPreset() });
    setErrors({});
    setShowForm(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    setForm({
      spaceName: s.spaceName || "",
      spaceType: s.spaceType || "Conference Hall",
      description: s.description || "",
      capacity: s.capacity ?? "",
      areaSqft: s.areaSqft ?? "",
      floorLocation: s.floorLocation || "",
      layoutOptions: (s.layoutOptions || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
      amenities:
        Array.isArray(s.amenityList) && s.amenityList.length
          ? s.amenityList.map((a) => a.amenityName)
          : (s.amenities || "")
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean),
      openTime: s.openTime || "09:00",
      closeTime: s.closeTime || "21:00",
      minBookingHours: s.minBookingHours ?? 1,
      hourlyRate: s.hourlyRate ?? "",
      halfDayRate: s.halfDayRate ?? "",
      fullDayRate: s.fullDayRate ?? "",
      contractHourlyRate: s.contractHourlyRate ?? "",
      contractHalfDayRate: s.contractHalfDayRate ?? "",
      contractFullDayRate: s.contractFullDayRate ?? "",
      specialHourlyRate: s.specialHourlyRate ?? "",
      specialHalfDayRate: s.specialHalfDayRate ?? "",
      specialFullDayRate: s.specialFullDayRate ?? "",
      currencyId: s.currencyId ?? null,
      currencyCode: s.currency || "INR",
      taxPercent: s.taxPercent ?? "",
      status: s.status || "Active",
      images: (s.images || []).map((i) => i.imageUrl).filter(Boolean),
      cancellationPolicies: (s.cancellationPolicies || []).map((p) => ({
        policyText: p.policyText || "",
        daysBeforeEvent: p.daysBeforeEvent ?? "",
        chargePercent: p.chargePercent ?? "",
      })),
    });
    setErrors({});
    setShowForm(true);
  };

  const handleChange = (k, v) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: null }));
  };

  // form action helpers
  const addAmenity = (name) => {
    const trimmed = (name || "").trim();
    if (!trimmed) return;
    if (form.amenities.includes(trimmed)) return;
    setForm((p) => ({ ...p, amenities: [...p.amenities, trimmed] }));
  };
  const removeAmenity = (name) =>
    setForm((p) => ({ ...p, amenities: p.amenities.filter((a) => a !== name) }));

  const toggleLayout = (label) =>
    setForm((p) => ({
      ...p,
      layoutOptions: p.layoutOptions.includes(label)
        ? p.layoutOptions.filter((l) => l !== label)
        : [...p.layoutOptions, label],
    }));

  const addImage = () => {
    const url = newImageUrl.trim();
    if (!url) return;
    setForm((p) => ({ ...p, images: [...p.images, url] }));
    setNewImageUrl("");
  };
  const removeImage = (idx) =>
    setForm((p) => ({ ...p, images: p.images.filter((_, i) => i !== idx) }));

  // ── Upload files from disk → base64 data URIs ────────────────────────
  // The backend's image_url column accepts any string (URL or data URI), so
  // we don't need a separate upload endpoint. Each picked file becomes a
  // base64 data URI and is appended to the images array. A soft size cap
  // prevents the user from sending massive files (which would bloat the
  // booking JSON payload).
  const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB per image — keeps payloads sane
  const handleFilePick = (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    const readers = files.map((file) => {
      return new Promise((resolve, reject) => {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name}: not an image`);
          resolve(null);
          return;
        }
        if (file.size > MAX_IMAGE_BYTES) {
          toast.error(
            `${file.name}: ${(file.size / 1024 / 1024).toFixed(1)} MB exceeds 2 MB limit`
          );
          resolve(null);
          return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () =>
          reject(new Error(`Failed to read ${file.name}`));
        reader.readAsDataURL(file);
      });
    });
    Promise.all(readers)
      .then((dataUris) => {
        const valid = dataUris.filter(Boolean);
        if (valid.length === 0) return;
        setForm((p) => ({ ...p, images: [...p.images, ...valid] }));
        toast.success(`${valid.length} image(s) added`);
      })
      .catch((err) => {
        console.error(err);
        toast.error("Some images failed to load");
      });
    // Reset the input so picking the same file twice still fires onChange.
    event.target.value = "";
  };

  const addPolicy = () =>
    setForm((p) => ({
      ...p,
      cancellationPolicies: [
        ...p.cancellationPolicies,
        { policyText: "", daysBeforeEvent: "", chargePercent: "" },
      ],
    }));
  const removePolicy = (idx) =>
    setForm((p) => ({
      ...p,
      cancellationPolicies: p.cancellationPolicies.filter((_, i) => i !== idx),
    }));
  const updatePolicy = (idx, key, value) =>
    setForm((p) => {
      const next = [...p.cancellationPolicies];
      next[idx] = { ...next[idx], [key]: value };
      return { ...p, cancellationPolicies: next };
    });

  // validation
  const validate = () => {
    const e = {};
    if (!form.spaceName.trim()) e.spaceName = "Space name is required";
    if (!form.capacity || Number(form.capacity) <= 0)
      e.capacity = "Capacity is required";
    if (!form.currencyId) e.currencyId = "Currency is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // save
  const buildPayload = () => {
    const num = (x) => (x === "" || x == null ? null : Number(x));
    return {
      hotelId: Number(hotelId),
      hotelName: hotelName || null,
      spaceName: form.spaceName.trim(),
      spaceType: form.spaceType,
      description: form.description,
      capacity: num(form.capacity),
      areaSqft: num(form.areaSqft),
      floorLocation: form.floorLocation,
      layoutOptions: form.layoutOptions.join(","),
      // Legacy comma-string kept for backwards compat; the authoritative
      // normalised list goes into amenityList → meet_space_amenty table.
      amenities: form.amenities.join(","),
      amenityList: form.amenities.map((name) => ({ amenityName: name })),
      openTime: form.openTime || null,
      closeTime: form.closeTime || null,
      minBookingHours: num(form.minBookingHours),
      hourlyRate: num(form.hourlyRate),
      halfDayRate: num(form.halfDayRate),
      fullDayRate: num(form.fullDayRate),
      contractHourlyRate: num(form.contractHourlyRate),
      contractHalfDayRate: num(form.contractHalfDayRate),
      contractFullDayRate: num(form.contractFullDayRate),
      specialHourlyRate: num(form.specialHourlyRate),
      specialHalfDayRate: num(form.specialHalfDayRate),
      specialFullDayRate: num(form.specialFullDayRate),
      currency: form.currencyCode,
      currencyId: form.currencyId,
      taxPercent: num(form.taxPercent),
      status: form.status,
      images: form.images.map((url, i) => ({
        imageUrl: url,
        isPrimary: i === 0,
      })),
      cancellationPolicies: form.cancellationPolicies.map((p, i) => ({
        policyText: p.policyText,
        daysBeforeEvent: p.daysBeforeEvent ? Number(p.daysBeforeEvent) : null,
        chargePercent: p.chargePercent ? Number(p.chargePercent) : null,
        displayOrder: i,
      })),
      rates: [],
    };
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = buildPayload();
      if (editing?.id) {
        await axiosInstance.put(`/api/meet-and-space/${editing.id}`, payload);
        toast.success("Meeting space updated");
      } else {
        await axiosInstance.post("/api/meet-and-space", payload);
        toast.success("Meeting space created");
      }
      setShowForm(false);
      fetchSpaces(page, search);
    } catch (e) {
      console.error("Save failed", e);
      toast.error(e?.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // Open the confirm modal for the row whose badge was clicked.
  const handleStatusToggle = (row) => {
    setSelectedSpace(row);
    setShowStatusModal(true);
  };

  // PATCH the new status, refresh the list, close the modal.
  // The status column stores a string ("Active" / "Inactive") rather
  // than a boolean, so we send the literal target value.
  const updateSpaceStatus = async () => {
    if (!selectedSpace) return;
    try {
      setStatusUpdating(true);
      const next =
        selectedSpace.status === "Active" ? "Inactive" : "Active";
      await axiosInstance.patch(
        `/api/meet-and-space/${selectedSpace.id}/status`,
        { status: next }
      );
      toast.success(
        next === "Active"
          ? "Meeting space activated"
          : "Meeting space deactivated"
      );
      await fetchSpaces(page, search);
      setShowStatusModal(false);
      setSelectedSpace(null);
    } catch (err) {
      console.error("Status toggle failed:", err);
      toast.error(
        err?.response?.data?.message ||
          "Failed to update meeting-space status"
      );
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleDelete = async (row) => {
    const result = await Swal.fire({
      title: `Delete "${row.spaceName}"?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
    });
    if (!result.isConfirmed) return;
    try {
      await axiosInstance.delete(`/api/meet-and-space/${row.id}`);
      toast.success("Deleted");
      fetchSpaces(page, search);
    } catch (e) {
      toast.error("Failed to delete");
    }
  };

  // ── render ───────────────────────────────────────────────────────────
  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <div className="d-flex align-items-center gap-3 mb-3">
            <Button
              variant="outline-primary"
              onClick={() => navigate(`/hotel-details/${hotelId}`)}
              className="d-flex align-items-center btn-sm gap-2"
            >
              <FaArrowLeft />
              Back
            </Button>
            <h3 className="mb-0 d-flex align-items-center">
              <FaUsers className="me-2 text-primary" /> Meeting &amp; Space
            </h3>
            {/* HotelTitleBadge replaces the inline " — {hotelName}"
                rendering so this page matches the rest of the action
                inner pages. The hotelName state is kept (used in the
                save payload at line ~475) — only the display copy
                here is delegated to the badge. */}
            <HotelTitleBadge hotelId={hotelId} className="ms-2" />
          </div>

          <Card className="shadow-sm rounded-xl mb-3">
            <Card.Header className="d-flex justify-content-between align-items-center text-white">
              <span
                className="fw-semibold cursor-pointer text-primary"
                style={{ padding: "10px" }}
              >
                Meeting Spaces
              </span>
              <Form.Group className="hotel-search-bar position-relative">
                <Form.Control
                  type="text"
                  placeholder="Search meeting spaces..."
                  className="form-control-modern-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </Form.Group>
              <Button className="btn-green create-btn" onClick={openCreate}>
                <FaPlus className="me-1" /> Create
              </Button>
            </Card.Header>
            <Card.Body className="p-0">
              <Table
                striped
                bordered
                hover
                responsive
                className="mb-0 align-middle"
              >
                <thead>
                  <tr>
                    <th style={{ width: 80 }}>S/N</th>
                    <th>Space Name</th>
                    <th>Type</th>
                    <th>Capacity</th>
                    <th>Hourly</th>
                    <th>Half-Day</th>
                    <th>Full-Day</th>
                    <th>Currency</th>
                    <th>Images</th>
                    <th>Status</th>
                    <th style={{ width: 120 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={11} className="text-center py-4">
                        <Spinner animation="border" variant="primary" />
                      </td>
                    </tr>
                  ) : rows.length > 0 ? (
                    rows.map((s, i) => (
                      <tr key={s.id}>
                        <td>{i + 1 + page * PAGE_SIZE}</td>
                        <td>
                          <strong>{s.spaceName}</strong>
                          {s.floorLocation && (
                            <div className="small text-muted">
                              {s.floorLocation}
                            </div>
                          )}
                        </td>
                        <td>{s.spaceType}</td>
                        <td>{s.capacity}</td>
                        <td>{s.hourlyRate ?? "-"}</td>
                        <td>{s.halfDayRate ?? "-"}</td>
                        <td>{s.fullDayRate ?? "-"}</td>
                        <td>{s.currency}</td>
                        <td>
                          <span className="d-inline-flex align-items-center gap-1">
                            <FaImages /> {(s.images || []).length}
                          </span>
                        </td>
                        <td>
                          {/* Clickable Active/Inactive badge — opens
                              the confirm modal then PATCHes /status.
                              Mirrors /contract-rate. */}
                          <Badge
                            bg={s.status === "Active" ? "success" : "danger"}
                            style={{ cursor: "pointer" }}
                            onClick={() => handleStatusToggle(s)}
                            title={`Click to ${
                              s.status === "Active" ? "deactivate" : "activate"
                            } meeting space`}
                          >
                            {s.status}
                          </Badge>
                        </td>
                        <td>
                          <div className="d-flex gap-2">
                            <Button
                              size="sm"
                              variant="outline-primary"
                              className="d-flex align-items-center gap-1"
                              title="Edit"
                              onClick={() => openEdit(s)}
                            >
                              <FaEdit /> Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline-danger"
                              className="d-flex align-items-center gap-1"
                              title="Delete"
                              onClick={() => handleDelete(s)}
                            >
                              <FaTrash /> Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={11} className="text-center text-muted py-4">
                        No meeting spaces found
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </Card.Body>
          </Card>

          {totalPages > 1 && (
            <div className="d-flex justify-content-center">
              <Pagination className="mb-0">
                <Pagination.Prev
                  disabled={page === 0}
                  onClick={() => fetchSpaces(page - 1, search)}
                />
                {[...Array(totalPages).keys()].map((num) => (
                  <Pagination.Item
                    key={num}
                    active={num === page}
                    onClick={() => fetchSpaces(num, search)}
                  >
                    {num + 1}
                  </Pagination.Item>
                ))}
                <Pagination.Next
                  disabled={page === totalPages - 1}
                  onClick={() => fetchSpaces(page + 1, search)}
                />
              </Pagination>
            </div>
          )}
        </main>
      </div>

      {/* ── Create / Edit Modal ────────────────────────────────────────── */}
      <Modal show={showForm} onHide={() => setShowForm(false)} size="xl" scrollable>
        <Modal.Header closeButton>
          <Modal.Title>
            {editing ? "Edit Meeting Space" : "Add Meeting Space"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Row className="g-3">
            <Col md={4}>
              <Form.Label>Space Name *</Form.Label>
              <Form.Control
                value={form.spaceName}
                onChange={(e) => handleChange("spaceName", e.target.value)}
                isInvalid={!!errors.spaceName}
              />
              <Form.Control.Feedback type="invalid">
                {errors.spaceName}
              </Form.Control.Feedback>
            </Col>
            <Col md={3}>
              <Form.Label>Space Type</Form.Label>
              <Form.Select
                value={form.spaceType}
                onChange={(e) => handleChange("spaceType", e.target.value)}
              >
                {SPACE_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Form.Select>
            </Col>
            <Col md={2}>
              <Form.Label>Capacity *</Form.Label>
              <Form.Control
                type="number"
                value={form.capacity}
                onChange={(e) => handleChange("capacity", e.target.value)}
                isInvalid={!!errors.capacity}
              />
              <Form.Control.Feedback type="invalid">
                {errors.capacity}
              </Form.Control.Feedback>
            </Col>
            <Col md={2}>
              <Form.Label>Area (sqft)</Form.Label>
              <Form.Control
                type="number"
                value={form.areaSqft}
                onChange={(e) => handleChange("areaSqft", e.target.value)}
              />
            </Col>
            <Col md={1}>
              <Form.Label>Status</Form.Label>
              <Form.Select
                value={form.status}
                onChange={(e) => handleChange("status", e.target.value)}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </Form.Select>
            </Col>

            <Col md={3}>
              <Form.Label>Floor / Location</Form.Label>
              <Form.Control
                value={form.floorLocation}
                onChange={(e) =>
                  handleChange("floorLocation", e.target.value)
                }
              />
            </Col>
            <Col md={3}>
              <Form.Label>Open Time</Form.Label>
              <Form.Control
                type="time"
                value={form.openTime}
                onChange={(e) => handleChange("openTime", e.target.value)}
              />
            </Col>
            <Col md={3}>
              <Form.Label>Close Time</Form.Label>
              <Form.Control
                type="time"
                value={form.closeTime}
                onChange={(e) => handleChange("closeTime", e.target.value)}
              />
            </Col>
            <Col md={3}>
              <Form.Label>Min Booking Hours</Form.Label>
              <Form.Control
                type="number"
                value={form.minBookingHours}
                onChange={(e) =>
                  handleChange("minBookingHours", e.target.value)
                }
              />
            </Col>

            <Col md={12}>
              <Form.Label>Description (long-form)</Form.Label>
              <Form.Control
                as="textarea"
                rows={5}
                value={form.description}
                onChange={(e) => handleChange("description", e.target.value)}
                placeholder="Detailed description of the space, layout, equipment, ambience, etc."
              />
              <Form.Text className="text-muted">
                Stored as TEXT — no character limit imposed by the form.
              </Form.Text>
            </Col>

            <Col md={12}>
              <Form.Label>Layout Options</Form.Label>
              <div className="d-flex flex-wrap gap-3">
                {LAYOUT_OPTIONS.map((l) => (
                  <Form.Check
                    key={l}
                    type="checkbox"
                    label={l}
                    checked={form.layoutOptions.includes(l)}
                    onChange={() => toggleLayout(l)}
                  />
                ))}
              </div>
            </Col>

            <Col md={12}>
              <Form.Label>Amenities</Form.Label>
              <div className="d-flex flex-wrap gap-2 mb-2">
                {form.amenities.length === 0 && (
                  <span className="text-muted small">
                    No amenities yet. Click a "Quick add" chip or type your own below.
                  </span>
                )}
                {form.amenities.map((a) => (
                  <Badge
                    key={a}
                    bg="info"
                    pill
                    style={{ cursor: "pointer" }}
                    onClick={() => removeAmenity(a)}
                    title="Click to remove"
                  >
                    {a} ✕
                  </Badge>
                ))}
              </div>
              <div className="d-flex flex-wrap gap-2 mb-2">
                {COMMON_AMENITIES.map((a) => (
                  <Button
                    key={a}
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => addAmenity(a)}
                    disabled={form.amenities.includes(a)}
                  >
                    + {a}
                  </Button>
                ))}
              </div>
              <div className="d-flex gap-2">
                <Form.Control
                  size="sm"
                  placeholder="Custom amenity name"
                  value={newAmenity}
                  onChange={(e) => setNewAmenity(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addAmenity(newAmenity);
                      setNewAmenity("");
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    addAmenity(newAmenity);
                    setNewAmenity("");
                  }}
                >
                  Add
                </Button>
              </div>
              <Form.Text className="text-muted">
                Saved as one row per amenity in the meet_space_amenty table.
              </Form.Text>
            </Col>

            <Col md={12}>
              <hr />
              <h6>Currency &amp; Rates</h6>
            </Col>
            <Col md={4}>
              <Form.Label>Currency *</Form.Label>
              <Select
                options={currencyOptions}
                value={
                  currencyOptions.find((o) => o.value === form.currencyId) ||
                  null
                }
                onChange={(opt) =>
                  setForm((p) => ({
                    ...p,
                    currencyId: opt?.value || null,
                    currencyCode: opt?.currencyCode || "INR",
                  }))
                }
                placeholder="Select currency..."
                isClearable
              />
              {errors.currencyId && (
                <div className="text-danger small mt-1">
                  {errors.currencyId}
                </div>
              )}
            </Col>
            <Col md={2}>
              <Form.Label>Tax %</Form.Label>
              <Form.Control
                type="number"
                value={form.taxPercent}
                onChange={(e) => handleChange("taxPercent", e.target.value)}
              />
            </Col>
            <Col md={2}>
              <Form.Label>Hourly</Form.Label>
              <Form.Control
                type="number"
                value={form.hourlyRate}
                onChange={(e) => handleChange("hourlyRate", e.target.value)}
              />
            </Col>
            <Col md={2}>
              <Form.Label>Half Day</Form.Label>
              <Form.Control
                type="number"
                value={form.halfDayRate}
                onChange={(e) => handleChange("halfDayRate", e.target.value)}
              />
            </Col>
            <Col md={2}>
              <Form.Label>Full Day</Form.Label>
              <Form.Control
                type="number"
                value={form.fullDayRate}
                onChange={(e) => handleChange("fullDayRate", e.target.value)}
              />
            </Col>

            <Col md={12}>
              <h6>Contract Rates (B2B / Agent)</h6>
            </Col>
            <Col md={4}>
              <Form.Label>Contract Hourly</Form.Label>
              <Form.Control
                type="number"
                value={form.contractHourlyRate}
                onChange={(e) =>
                  handleChange("contractHourlyRate", e.target.value)
                }
              />
            </Col>
            <Col md={4}>
              <Form.Label>Contract Half Day</Form.Label>
              <Form.Control
                type="number"
                value={form.contractHalfDayRate}
                onChange={(e) =>
                  handleChange("contractHalfDayRate", e.target.value)
                }
              />
            </Col>
            <Col md={4}>
              <Form.Label>Contract Full Day</Form.Label>
              <Form.Control
                type="number"
                value={form.contractFullDayRate}
                onChange={(e) =>
                  handleChange("contractFullDayRate", e.target.value)
                }
              />
            </Col>

            <Col md={12}>
              <h6>Special / Promotional Rates</h6>
            </Col>
            <Col md={4}>
              <Form.Label>Special Hourly</Form.Label>
              <Form.Control
                type="number"
                value={form.specialHourlyRate}
                onChange={(e) =>
                  handleChange("specialHourlyRate", e.target.value)
                }
              />
            </Col>
            <Col md={4}>
              <Form.Label>Special Half Day</Form.Label>
              <Form.Control
                type="number"
                value={form.specialHalfDayRate}
                onChange={(e) =>
                  handleChange("specialHalfDayRate", e.target.value)
                }
              />
            </Col>
            <Col md={4}>
              <Form.Label>Special Full Day</Form.Label>
              <Form.Control
                type="number"
                value={form.specialFullDayRate}
                onChange={(e) =>
                  handleChange("specialFullDayRate", e.target.value)
                }
              />
            </Col>

            <Col md={12}>
              <hr />
              <h6>Images (saved into meet_space_image)</h6>
            </Col>
            <Col md={12}>
              {/* Two ways to add images:
                  - "Choose Files" picks multiple images from disk (data URIs)
                  - The text box still accepts a remote URL / data URI manually */}
              <div className="d-flex gap-2 mb-2 align-items-center flex-wrap">
                <Form.Group controlId="meet-space-image-upload">
                  <Form.Label className="visually-hidden">
                    Upload images
                  </Form.Label>
                  <Form.Control
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFilePick}
                    style={{ maxWidth: 320 }}
                  />
                </Form.Group>
                <span className="text-muted small">or</span>
                <Form.Control
                  placeholder="Paste image URL (or data: URI)"
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addImage();
                    }
                  }}
                  style={{ maxWidth: 360 }}
                />
                <Button variant="primary" onClick={addImage}>
                  Add URL
                </Button>
              </div>
              <Form.Text className="text-muted d-block mb-2">
                Pick multiple files from your computer or paste a URL. Each
                image is saved as a row in meet_space_image; the first one is
                used as the cover in search results. Per-image cap: 2 MB.
              </Form.Text>
              <div className="d-flex flex-wrap gap-2">
                {form.images.length === 0 && (
                  <span className="text-muted small">
                    No images yet — first image will be the cover used in search results.
                  </span>
                )}
                {form.images.map((url, idx) => (
                  <div
                    key={`${idx}-${url}`}
                    className="position-relative"
                    style={{ width: 120 }}
                  >
                    <img
                      src={url}
                      alt={`img-${idx}`}
                      style={{
                        width: 120,
                        height: 80,
                        objectFit: "cover",
                        borderRadius: 6,
                        border: "1px solid #ddd",
                      }}
                      onError={(e) => (e.target.style.opacity = 0.3)}
                    />
                    {idx === 0 && (
                      <Badge
                        bg="success"
                        className="position-absolute top-0 start-0"
                        style={{ fontSize: 10 }}
                      >
                        Cover
                      </Badge>
                    )}
                    <Button
                      variant="danger"
                      size="sm"
                      className="position-absolute top-0 end-0"
                      style={{ padding: "0 4px" }}
                      onClick={() => removeImage(idx)}
                    >
                      ✕
                    </Button>
                  </div>
                ))}
              </div>
            </Col>

            <Col md={12}>
              <hr />
              <div className="d-flex justify-content-between align-items-center">
                <h6 className="mb-0">
                  Cancellation Policies (saved into meet_space_cancellation_policy)
                </h6>
                <Button size="sm" variant="outline-primary" onClick={addPolicy}>
                  <FaPlus /> Add Policy
                </Button>
              </div>
            </Col>
            <Col md={12}>
              {form.cancellationPolicies.length === 0 && (
                <div className="text-muted small">
                  No policies yet. Click "Add Policy" to add a clause.
                </div>
              )}
              {form.cancellationPolicies.map((p, i) => (
                <Row key={i} className="g-2 mb-2 align-items-end">
                  <Col md={6}>
                    <Form.Label className="small">Policy Text *</Form.Label>
                    <Form.Control
                      value={p.policyText}
                      onChange={(e) =>
                        updatePolicy(i, "policyText", e.target.value)
                      }
                      placeholder="e.g. Free cancellation up to 7 days before event"
                    />
                  </Col>
                  <Col md={2}>
                    <Form.Label className="small">
                      Days Before Event
                    </Form.Label>
                    <Form.Control
                      type="number"
                      value={p.daysBeforeEvent}
                      onChange={(e) =>
                        updatePolicy(i, "daysBeforeEvent", e.target.value)
                      }
                    />
                  </Col>
                  <Col md={2}>
                    <Form.Label className="small">Charge %</Form.Label>
                    <Form.Control
                      type="number"
                      value={p.chargePercent}
                      onChange={(e) =>
                        updatePolicy(i, "chargePercent", e.target.value)
                      }
                    />
                  </Col>
                  <Col md={2}>
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => removePolicy(i)}
                      className="w-100"
                    >
                      <FaTrash /> Remove
                    </Button>
                  </Col>
                </Row>
              ))}
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowForm(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Spinner size="sm" animation="border" /> Saving...
              </>
            ) : editing ? (
              "Update Space"
            ) : (
              "Create Space"
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Status-toggle confirmation modal — mirrors /contract-rate. */}
      <Modal
        show={showStatusModal}
        onHide={() => setShowStatusModal(false)}
        centered
        size="sm"
        backdrop="static"
        keyboard={false}
      >
        <Modal.Header closeButton={!statusUpdating}>
          <Modal.Title>Confirm Status Change</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Are you sure you want to{" "}
            {selectedSpace?.status === "Active" ? "deactivate" : "activate"}{" "}
            this meeting space?
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowStatusModal(false)}
            disabled={statusUpdating}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={updateSpaceStatus}
            disabled={statusUpdating}
          >
            {statusUpdating ? (
              <>
                <span
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                  aria-hidden="true"
                ></span>
                Processing...
              </>
            ) : (
              "Confirm"
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
