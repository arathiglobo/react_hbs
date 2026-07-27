import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Card,
  Button,
  Table,
  Modal,
  Form,
  Row, 
  Col,
  Spinner,
  InputGroup,
} from "react-bootstrap";
import {
  FaArrowLeft,
  FaPlus,
  FaTrash,
  FaEdit,
  FaEye,
  FaSave,
  FaGift,
} from "react-icons/fa";
import Select from "react-select";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";

/**
 * HoneyMoonPackageRates — per-package rate management screen.
 *
 * Route: /honeymoon/package-rates/:packageId
 *
 * Mirrors the working of /package-rates with one key difference: the
 * "Sharing Options" card is removed. Instead the RATE DETAILS section
 * captures these fields directly, with a "+" button to add multiple rate
 * rows in a single save:
 *   - Country *
 *   - Place *
 *   - No of nights *
 *   - Select Hotel or Similar (multi-select)
 *   - Per Adult Rate
 *   - Per Child With Bed
 *   - Per Child Without Bed
 *
 * Backend endpoints:
 *   - POST   /api/honeymoon-package-rate/save
 *   - PUT    /api/honeymoon-package-rate/{id}
 *   - GET    /api/honeymoon-package-rate?packageId={id}
 *   - DELETE /api/honeymoon-package-rate/{id}
 */
const emptyRateRow = () => ({
  country: null, // {value, label}
  place: null,
  noOfNights: "",
  hotels: [], // [{value, label}, ...]
  perAdultRate: "",
  perChildWithBed: "",
  perChildWithoutBed: "",
});

const HoneyMoonPackageRates = () => {
  const { id: packageId } = useParams();
  const navigate = useNavigate();

  const [pkg, setPkg] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // Reference data
  const [countries, setCountries] = useState([]);
  const [countriesLoading, setCountriesLoading] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewMode, setViewMode] = useState(false);
  const [rateRows, setRateRows] = useState([emptyRateRow()]);
  const [submitting, setSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  // Per-row place + hotel option caches.
  const [placeOptionsByRow, setPlaceOptionsByRow] = useState({}); // {rowIdx: [...]}
  const [hotelOptions, setHotelOptions] = useState([]);
  const [hotelsLoading, setHotelsLoading] = useState(false);
  const placeDebounceRef = useRef({});
  const hotelDebounceRef = useRef(null);

  // ── Add-on service rates ──────────────────────────────────────────
  // Names are defined on the Registration page; this section lets the
  // agent set per-add-on prices. The Booking page filters by `price > 0`
  // so blank rates simply hide the add-on at booking time.
  // Shape: [{ key, label, price }]. Mirrored to
  // `localStorage[honeymoon_addons_<packageId>]` so the Booking page can
  // pick them up even if the backend hasn't been extended to round-trip
  // the `addOns` field on `/api/honeymoon/{id}`.
  const [addOnRates, setAddOnRates] = useState([]);
  const [savingAddOnRates, setSavingAddOnRates] = useState(false);

  // ─────────────────────────────────────────────
  // Load package + countries + hotels + rates
  // ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    // localStorage cache for add-on rates is read up front so the section
    // still hydrates even if the API call below fails (e.g. backend down).
    let storedAddOns = null;
    try {
      const raw = localStorage.getItem(`honeymoon_addons_${packageId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.addOns)) storedAddOns = parsed.addOns;
      }
    } catch {
      /* ignore */
    }

    const hydrateAddOnRates = (serverList) => {
      // Merge: server labels are authoritative when present, localStorage
      // prices fill in where the server doesn't echo a price.
      const baseList = (serverList && serverList.length)
        ? serverList
        : (storedAddOns || []);
      const storedByKey = new Map(
        (storedAddOns || []).map((a) => [a.key, a])
      );
      const normalised = baseList
        .map((a) => {
          const label = String(a?.label || "").trim();
          if (!label) return null;
          const key = String(a?.key || "").trim() || label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
          const stored = storedByKey.get(key);
          const price = Number(
            a?.price != null && a.price !== "" ? a.price : stored?.price
          ) || 0;
          return { key, label, price };
        })
        .filter(Boolean);
      if (!cancelled) setAddOnRates(normalised);
    };

    // Hydrate from localStorage immediately so the section is populated
    // even before (or in spite of) the API call resolving.
    hydrateAddOnRates(null);

    (async () => {
      try {
        const r = await axiosInstance.get(`/api/honeymoon/${packageId}`);
        if (cancelled) return;
        setPkg(r.data);
        // Re-hydrate with server data — server `addOns` overrides the
        // localStorage fallback when present.
        const serverAddOns = Array.isArray(r.data?.addOns) ? r.data.addOns : null;
        if (serverAddOns && serverAddOns.length) {
          hydrateAddOnRates(serverAddOns);
        }
      } catch {
        toast.error("Failed to load package");
      }
    })();
    fetchRates();
    fetchCountries();
    fetchHotels();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line
  }, [packageId]);

  const fetchRates = async () => {
    try {
      setLoading(true);
      const r = await axiosInstance.get(
        `/api/honeymoon-package-rate?packageId=${packageId}`
      );
      setItems(Array.isArray(r.data) ? r.data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCountries = async (search = "") => {
    setCountriesLoading(true);
    try {
      const r = await axiosInstance.get(
        `/api/country?page=0&limit=50&search=${encodeURIComponent(search)}`
      );
      setCountries(
        (Array.isArray(r.data) ? r.data : []).map((c) => ({
          value: c.id,
          label: c.name,
        }))
      );
    } catch {
      setCountries([]);
    } finally {
      setCountriesLoading(false);
    }
  };

  const fetchHotels = async (search = "") => {
    setHotelsLoading(true);
    try {
      const r = await axiosInstance.get(
        `/api/hotels?search=${encodeURIComponent(search)}&page=0&limit=50`
      );
      const rows = Array.isArray(r.data?.content)
        ? r.data.content
        : Array.isArray(r.data)
        ? r.data
        : [];
      setHotelOptions(
        rows.map((h) => ({
          value: h.hotelId || h.id,
          label: h.hotelName || h.name || `Hotel #${h.hotelId || h.id}`,
        }))
      );
    } catch {
      setHotelOptions([]);
    } finally {
      setHotelsLoading(false);
    }
  };

  const loadPlacesForRow = async (rowIdx, countryId, search = "") => {
    if (!countryId) {
      setPlaceOptionsByRow((p) => ({ ...p, [rowIdx]: [] }));
      return;
    }
    try {
      const r = await axiosInstance.get(
        `/api/province?countryId=${countryId}&page=0&limit=50&search=${encodeURIComponent(
          search
        )}`
      );
      const rows = Array.isArray(r.data) ? r.data : [];
      setPlaceOptionsByRow((p) => ({
        ...p,
        [rowIdx]: rows.map((pl) => ({
          value: pl.id,
          label: pl.name || pl.stateName,
        })),
      }));
    } catch {
      setPlaceOptionsByRow((p) => ({ ...p, [rowIdx]: [] }));
    }
  };

  // ─────────────────────────────────────────────
  // Modal openers
  // ─────────────────────────────────────────────
  const openCreate = () => {
    setEditing(null);
    setViewMode(false);
    setValidationErrors({});
    setRateRows([emptyRateRow()]);
    setShowModal(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setViewMode(false);
    setValidationErrors({});
    setRateRows([
      {
        country: row.countryId
          ? { value: row.countryId, label: row.countryName || "" }
          : null,
        place: row.placeId
          ? { value: row.placeId, label: row.placeName || "" }
          : null,
        noOfNights: row.noOfNights || "",
        hotels: (row.hotels || []).map((h) => ({
          value: h.hotelId,
          label: h.hotelName || `Hotel #${h.hotelId}`,
        })),
        perAdultRate: row.perAdultRate ?? "",
        perChildWithBed: row.perChildWithBed ?? "",
        perChildWithoutBed: row.perChildWithoutBed ?? "",
      },
    ]);
    if (row.countryId) loadPlacesForRow(0, row.countryId);
    setShowModal(true);
  };

  const openView = (row) => {
    openEdit(row);
    setViewMode(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setViewMode(false);
    setValidationErrors({});
  };

  // ─────────────────────────────────────────────
  // Row management
  // ─────────────────────────────────────────────
  const addRateRow = () => setRateRows((p) => [...p, emptyRateRow()]);
  const removeRateRow = (idx) =>
    setRateRows((p) => (p.length === 1 ? p : p.filter((_, i) => i !== idx)));
  const updateRateRow = (idx, field, value) =>
    setRateRows((p) =>
      p.map((r, i) => (i === idx ? { ...r, [field]: value } : r))
    );

  // ─────────────────────────────────────────────
  // Save
  // ─────────────────────────────────────────────
  const validate = () => {
    const errs = {};
    rateRows.forEach((r, i) => {
      if (!r.country) errs[`country_${i}`] = "Required";
      if (!r.place) errs[`place_${i}`] = "Required";
      if (!r.noOfNights) errs[`noOfNights_${i}`] = "Required";
    });
    setValidationErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      toast.error("Please fix the highlighted fields");
      return;
    }
    setSubmitting(true);
    try {
      for (const [i, r] of rateRows.entries()) {
        const payload = {
          packageId: Number(packageId),
          countryId: r.country?.value || null,
          countryName: r.country?.label || null,
          placeId: r.place?.value || null,
          placeName: r.place?.label || null,
          noOfNights: Number(r.noOfNights) || null,
          perAdultRate: r.perAdultRate === "" ? null : Number(r.perAdultRate),
          perChildWithBed:
            r.perChildWithBed === "" ? null : Number(r.perChildWithBed),
          perChildWithoutBed:
            r.perChildWithoutBed === "" ? null : Number(r.perChildWithoutBed),
          hotels: (r.hotels || []).map((h) => ({
            hotelId: h.value,
            hotelName: h.label,
          })),
        };
        if (editing && i === 0) {
          await axiosInstance.put(
            `/api/honeymoon-package-rate/${editing.id}`,
            payload
          );
        } else {
          await axiosInstance.post(
            "/api/honeymoon-package-rate/save",
            payload
          );
        }
      }
      toast.success(editing ? "Rate updated" : "Rates saved");
      closeModal();
      fetchRates();
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.message || "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  // Save the add-on rates list. Persists to localStorage (always works)
  // and best-effort PATCHes the package so the server can store the
  // rates too. The Booking page reads localStorage first then API.
  const saveAddOnRates = async () => {
    setSavingAddOnRates(true);
    const payloadList = addOnRates.map((a) => ({
      key: a.key,
      label: a.label,
      price: Number(a.price) || 0,
    }));
    try {
      localStorage.setItem(
        `honeymoon_addons_${packageId}`,
        JSON.stringify({ addOns: payloadList })
      );
    } catch {
      /* ignore — quota / private mode */
    }
    // Best-effort: try to update the package so the server stores the
    // rates too. The package PUT expects FormData with a `data` field;
    // we merge the existing package payload and ship it back.
    try {
      const fd = new FormData();
      // The existing package was loaded into `pkg`; mirror back the
      // fields that the registration endpoint accepts plus our addOns.
      const data = {
        ...(pkg || {}),
        addOns: payloadList,
      };
      // Strip server-only properties that PUT doesn't want.
      delete data.images;
      delete data.itinerary;
      fd.append("data", JSON.stringify(data));
      await axiosInstance.put(`/api/honeymoon/${packageId}`, fd);
    } catch {
      // Backend may not support the field yet — localStorage still has it.
    }
    setSavingAddOnRates(false);
    toast.success("Add-on rates saved");
  };

  const handleDelete = async (row) => {
    const c = await Swal.fire({
      title: "Delete this rate?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc3545",
    });
    if (!c.isConfirmed) return;
    try {
      await axiosInstance.delete(`/api/honeymoon-package-rate/${row.id}`);
      toast.success("Deleted");
      fetchRates();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Delete failed");
    }
  };

  return (
    <div className="min-vh-100 d-flex flex-column" style={{ background: "#f5f7fb" }}>
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h4 className="text-primary mb-1">Honeymoon Package Rates</h4>
              <p className="text-muted mb-0">
                Package: <strong>{pkg?.packageName || `#${packageId}`}</strong>
              </p>
            </div>
            <div className="d-flex gap-2">
              <Button
                variant="outline-secondary"
                onClick={() => navigate("/honeymoon/list")}
                className="rounded-pill"
              >
                <FaArrowLeft className="me-1" /> Back to List
              </Button>
              <Button
                style={{ backgroundColor: "#0d6efd", border: "none" }}
                onClick={openCreate}
                className="rounded-pill"
              >
                <FaPlus className="me-1" /> Add Rates
              </Button>
            </div>
          </div>

          {/* ── Add-on Service Rates ──
              The list of add-ons comes from the Registration page; this
              section is where the agent sets the per-booking price for
              each. Leave a rate blank/0 to hide that add-on from the
              Booking page. */}
          <Card className="shadow-sm mb-3">
            <Card.Header className="bg-white d-flex justify-content-between align-items-center">
              <div className="d-flex align-items-center">
                <FaGift className="me-2 text-danger" />
                <span className="fw-semibold">Add-on Service Rates</span>
              </div>
              <Button
                size="sm"
                variant="success"
                disabled={savingAddOnRates || addOnRates.length === 0}
                onClick={saveAddOnRates}
              >
                {savingAddOnRates ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-1" />
                    Saving…
                  </>
                ) : (
                  <>
                    <FaSave className="me-1" /> Save Rates
                  </>
                )}
              </Button>
            </Card.Header>
            <Card.Body>
              {addOnRates.length === 0 ? (
                <div className="text-muted text-center py-3">
                  No add-on services defined for this package.
                  {" "}
                  <Button
                    variant="link"
                    className="p-0 align-baseline"
                    onClick={() => navigate(`/honeymoon/edit/${packageId}`)}
                  >
                    Edit the package
                  </Button>
                  {" "}to add some.
                </div>
              ) : (
                <Row className="g-3">
                  {addOnRates.map((a, idx) => (
                    <Col md={6} key={a.key}>
                      <Form.Label className="mb-1 fw-semibold">
                        {a.label}
                      </Form.Label>
                      <InputGroup>
                        <InputGroup.Text>
                          {pkg?.currency || "INR"}
                        </InputGroup.Text>
                        <Form.Control
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="0.00"
                          value={a.price}
                          onChange={(e) => {
                            const v = e.target.value;
                            setAddOnRates((prev) =>
                              prev.map((x, i) =>
                                i === idx ? { ...x, price: v } : x
                              )
                            );
                          }}
                          aria-label={`Rate for ${a.label}`}
                        />
                      </InputGroup>
                      <Form.Text muted>
                        Leave blank or 0 to hide this add-on at booking time.
                      </Form.Text>
                    </Col>
                  ))}
                </Row>
              )}
            </Card.Body>
          </Card>

          <Card className="shadow-sm">
            <Card.Body>
              {loading ? (
                <div className="text-center py-4">
                  <Spinner animation="border" />
                </div>
              ) : items.length === 0 ? (
                <div className="text-center text-muted py-4">
                  No rates added yet for this package.
                </div>
              ) : (
                <Table bordered hover responsive>
                  <thead style={{ backgroundColor: "#f8f8f8" }}>
                    <tr>
                      <th>#</th>
                      <th>Country</th>
                      <th>Place</th>
                      <th>Nights</th>
                      <th>Hotels</th>
                      <th>Adult Rate</th>
                      <th>Child w/Bed</th>
                      <th>Child w/o Bed</th>
                      <th style={{ width: 150 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((r, i) => (
                      <tr key={r.id}>
                        <td>{i + 1}</td>
                        <td>{r.countryName || "—"}</td>
                        <td>{r.placeName || "—"}</td>
                        <td>{r.noOfNights || "—"}</td>
                        <td>
                          {(r.hotels || []).length === 0
                            ? "—"
                            : (r.hotels || [])
                                .map((h) => h.hotelName || `#${h.hotelId}`)
                                .join(", ")}
                        </td>
                        <td>
                          {r.perAdultRate != null
                            ? Number(r.perAdultRate).toFixed(2)
                            : "—"}
                        </td>
                        <td>
                          {r.perChildWithBed != null
                            ? Number(r.perChildWithBed).toFixed(2)
                            : "—"}
                        </td>
                        <td>
                          {r.perChildWithoutBed != null
                            ? Number(r.perChildWithoutBed).toFixed(2)
                            : "—"}
                        </td>
                        <td>
                          <Button
                            size="sm"
                            variant="outline-info"
                            className="me-1"
                            onClick={() => openView(r)}
                          >
                            <FaEye />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline-primary"
                            className="me-1"
                            onClick={() => openEdit(r)}
                          >
                            <FaEdit />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline-danger"
                            onClick={() => handleDelete(r)}
                          >
                            <FaTrash />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </main>
      </div>

      <Modal
        show={showModal}
        onHide={closeModal}
        size="xl"
        backdrop="static"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {viewMode ? "View" : editing ? "Edit" : "Add"} Honeymoon Rates
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <h6 className="border-bottom pb-2 mb-3">RATE DETAILS</h6>

          {rateRows.map((row, idx) => (
            <Card key={idx} className="mb-3 shadow-sm">
              <Card.Header className="bg-light d-flex justify-content-between align-items-center">
                <span className="fw-semibold">Rate Row #{idx + 1}</span>
                {!viewMode && rateRows.length > 1 && !editing && (
                  <Button
                    size="sm"
                    variant="outline-danger"
                    onClick={() => removeRateRow(idx)}
                  >
                    <FaTrash /> Remove
                  </Button>
                )}
              </Card.Header>
              <Card.Body>
                <Row className="g-3 mb-3">
                  <Col md={4}>
                    <Form.Label>
                      Country <span className="text-danger">*</span>
                    </Form.Label>
                    <Select
                      options={countries}
                      value={row.country}
                      onChange={(opt) => {
                        updateRateRow(idx, "country", opt);
                        updateRateRow(idx, "place", null);
                        if (opt?.value) loadPlacesForRow(idx, opt.value);
                      }}
                      onInputChange={(v, m) => {
                        if (m.action !== "input-change") return;
                        clearTimeout(placeDebounceRef.current[`c${idx}`]);
                        placeDebounceRef.current[`c${idx}`] = setTimeout(
                          () => fetchCountries(v),
                          400
                        );
                      }}
                      isLoading={countriesLoading}
                      isClearable
                      isDisabled={viewMode}
                      placeholder="Search country"
                      menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
                      menuPosition="fixed"
                      styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
                    />
                    {validationErrors[`country_${idx}`] && (
                      <div className="text-danger small mt-1">
                        {validationErrors[`country_${idx}`]}
                      </div>
                    )}
                  </Col>
                  <Col md={4}>
                    <Form.Label>
                      Place <span className="text-danger">*</span>
                    </Form.Label>
                    <Select
                      options={placeOptionsByRow[idx] || []}
                      value={row.place}
                      onChange={(opt) => updateRateRow(idx, "place", opt)}
                      onInputChange={(v, m) => {
                        if (m.action !== "input-change") return;
                        clearTimeout(placeDebounceRef.current[`p${idx}`]);
                        placeDebounceRef.current[`p${idx}`] = setTimeout(() => {
                          if (row.country?.value)
                            loadPlacesForRow(idx, row.country.value, v);
                        }, 400);
                      }}
                      isClearable
                      isDisabled={viewMode || !row.country}
                      placeholder={
                        !row.country ? "Select country first" : "Search place"
                      }
                      menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
                      menuPosition="fixed"
                      styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
                    />
                    {validationErrors[`place_${idx}`] && (
                      <div className="text-danger small mt-1">
                        {validationErrors[`place_${idx}`]}
                      </div>
                    )}
                  </Col>
                  <Col md={4}>
                    <Form.Label>
                      No of nights <span className="text-danger">*</span>
                    </Form.Label>
                    <Form.Select
                      value={row.noOfNights}
                      onChange={(e) =>
                        updateRateRow(idx, "noOfNights", e.target.value)
                      }
                      disabled={viewMode}
                      isInvalid={!!validationErrors[`noOfNights_${idx}`]}
                    >
                      <option value="">SELECT</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </Form.Select>
                    {validationErrors[`noOfNights_${idx}`] && (
                      <div className="text-danger small mt-1">
                        {validationErrors[`noOfNights_${idx}`]}
                      </div>
                    )}
                  </Col>
                </Row>

                <Row className="g-3">
                  <Col md={6}>
                    <Form.Label>Select Hotel or Similar</Form.Label>
                    <Select
                      isMulti
                      options={hotelOptions}
                      value={row.hotels}
                      onChange={(opts) =>
                        updateRateRow(idx, "hotels", opts || [])
                      }
                      onInputChange={(v, m) => {
                        if (m.action !== "input-change") return;
                        if (hotelDebounceRef.current)
                          clearTimeout(hotelDebounceRef.current);
                        hotelDebounceRef.current = setTimeout(
                          () => fetchHotels(v),
                          400
                        );
                      }}
                      isLoading={hotelsLoading}
                      isDisabled={viewMode}
                      placeholder="Click to choose hotels..."
                      menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
                      menuPosition="fixed"
                      styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
                    />
                  </Col>
                  <Col md={2}>
                    <Form.Label>Per Adult Rate</Form.Label>
                    <Form.Control
                      type="number"
                      min="0"
                      value={row.perAdultRate}
                      onChange={(e) =>
                        updateRateRow(idx, "perAdultRate", e.target.value)
                      }
                      disabled={viewMode}
                    />
                  </Col>
                  <Col md={2}>
                    <Form.Label>Per Child With Bed</Form.Label>
                    <Form.Control
                      type="number"
                      min="0"
                      value={row.perChildWithBed}
                      onChange={(e) =>
                        updateRateRow(idx, "perChildWithBed", e.target.value)
                      }
                      disabled={viewMode}
                    />
                  </Col>
                  <Col md={2}>
                    <Form.Label>Per Child Without Bed</Form.Label>
                    <Form.Control
                      type="number"
                      min="0"
                      value={row.perChildWithoutBed}
                      onChange={(e) =>
                        updateRateRow(idx, "perChildWithoutBed", e.target.value)
                      }
                      disabled={viewMode}
                    />
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          ))}

          {!viewMode && !editing && (
            <Button size="sm" variant="outline-success" onClick={addRateRow}>
              <FaPlus className="me-1" /> Add Another Rate Row
            </Button>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={closeModal}>
            {viewMode ? "Close" : "Cancel"}
          </Button>
          {!viewMode && (
            <Button
              style={{ backgroundColor: "#0d6efd", border: "none" }}
              onClick={handleSave}
              disabled={submitting}
            >
              {submitting ? "Saving..." : editing ? "Update" : "Save"}
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default HoneyMoonPackageRates;
