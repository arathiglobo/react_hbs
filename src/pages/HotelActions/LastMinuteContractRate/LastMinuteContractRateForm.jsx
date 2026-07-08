import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Container,
  Row,
  Col,
  Form,
  Button,
  Card,
  Spinner,
  Table,
  Alert,
  Badge,
} from "react-bootstrap";
import { FaArrowLeft, FaPlus, FaTrash } from "react-icons/fa";
import Select from "react-select";
import Sidebar from "../../../components/Sidebar";
import Topbar from "../../../components/TopBar";
import axiosInstance from "../../../components/AxiosInstance";
import HotelTitleBadge from "../../../components/HotelTitleBadge";
import { toast } from "react-hot-toast";

/**
 * LastMinuteContractRateForm — clone of CreateContractRate.jsx for the
 * Last Minute module. One component used for BOTH create and edit (mode prop).
 *
 * Fields are identical to the existing Contract Rate form:
 *   season, rate code, market type[], exclude country[], day selection,
 *   validity periods[], per-room×occupancy×roomType rate cells.
 *
 * KEY ADDITION:
 *   On mount we call GET /api/last-minute-contract-rate/suggest/{hotelId}.
 *   That returns one record per (roomCategory, roomType, occupancy) combo
 *   carrying `normalRate` and `suggestedRate` (= normalRate × 0.90).
 *   We pre-fill every rate cell with the suggestion. The user can override.
 *   The backend re-validates on save (rate must be ≤ 90% of normal).
 *
 * Endpoints used:
 *   POST /api/last-minute-contract-rate/save           (create)
 *   PUT  /api/last-minute-contract-rate/{id}           (edit)
 *   GET  /api/last-minute-contract-rate/{id}           (load on edit)
 *   GET  /api/last-minute-contract-rate/suggest/{id}   (auto-populate)
 *   GET  /api/hotelRoomDetailsController/{id}          (room metadata, shared)
 *   GET  /api/marketType, /api/country, /api/seasonType (dropdowns, shared)
 */
export default function LastMinuteContractRateForm({ mode = "create" }) {
  const isEdit = mode === "edit";
  const navigate = useNavigate();
  const { id: hotelId, rateId } = useParams();

  const [formData, setFormData] = useState({
    seasonId: "",
    rateCode: "",
    marketType: [],
    excludeCountry: [],
    daySelection: "allDays", // allDays | weekDays | weekendDays
    validityList: [{ validityFrom: "", validityTo: "" }],
    roomRates: [],
    isLive: false,
    checkInWindowDays: 2,
    markup: "",
    termsAndConditions: [""],
    cancellationPolicies: [{ amount: "", amountType: "PERCENT", daysBeforeArrival: "" }],
    amendmentPolicies: [{ amount: "", amountType: "PERCENT", daysBeforeArrival: "" }],
    noShowPolicies: [{ amount: "", amountType: "PERCENT", daysBeforeArrival: "" }],
    paymentPolicies: [""],
  });

  const [markets, setMarkets] = useState([]);
  const [countries, setCountries] = useState([]);
  const [hotelRooms, setHotelRooms] = useState([]);
  const [seasonTypes, setSeasonTypes] = useState([]);
  // suggestions keyed by `${categoryId}|${typeId}|${occId}` → { normalRate, suggestedRate, ... }
  const [suggestions, setSuggestions] = useState({});
  const [loading, setLoading] = useState(false);
  const [roomLoading, setRoomLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState(null);

  // ── 1. Load shared dropdowns ────────────────────────────────────────────────
  useEffect(() => {
    const fetchDropdowns = async () => {
      try {
        setLoading(true);
        const [marketRes, countryRes, seasonTypeRes] = await Promise.all([
          axiosInstance.get("/api/marketType"),
          axiosInstance.get("/api/country"),
          axiosInstance.get("/api/seasonType"),
        ]);
        const marketsWithAll = [
          { marketTypeId: 100, name: "All" },
          ...(marketRes.data || []),
        ];
        setMarkets(marketsWithAll);
        setCountries(countryRes.data || []);
        setSeasonTypes(seasonTypeRes.data || []);
      } catch (err) {
        toast.error("Failed to load dropdown data");
      } finally {
        setLoading(false);
      }
    };
    fetchDropdowns();
  }, []);

  // ── 1b. Once markets/countries arrive, upgrade `#<id>` placeholder
  //        labels in edit-mode chips to real names. The previous
  //        version only depended on `[markets, countries, isEdit]`, so
  //        if init() finished AFTER the master lists had loaded the
  //        resolution never re-fired and chips stayed as "#100". We
  //        now also depend on formData.marketType /
  //        formData.excludeCountry and guard with a needsResolution
  //        check to avoid re-render loops.
  useEffect(() => {
    if (!isEdit) return;
    if (markets.length === 0 && countries.length === 0) return;
    const needsResolution =
      (formData.marketType || []).some((m) =>
        typeof m.label === "string" && /^#?\d+$/.test(m.label)
      ) ||
      (formData.excludeCountry || []).some((c) =>
        typeof c.label === "string" && /^#?\d+$/.test(c.label)
      );
    if (!needsResolution) return;
    setFormData((f) => ({
      ...f,
      marketType: f.marketType.map((m) => {
        const found = markets.find((x) => x.marketTypeId === m.value);
        return found ? { value: m.value, label: found.name } : m;
      }),
      excludeCountry: f.excludeCountry.map((c) => {
        const found = countries.find((x) => x.id === c.value);
        return found ? { value: c.value, label: `${found.name} (${found.marketType})` } : c;
      }),
    }));
  }, [markets, countries, isEdit, formData.marketType, formData.excludeCountry]);

  // ── 2. Load hotel rooms + suggestions; if editing also load existing rate ──
  useEffect(() => {
    const init = async () => {
      if (!hotelId) return;
      try {
        setRoomLoading(true);

        const reqs = [
          axiosInstance.get(`/api/hotelRoomDetailsController/${hotelId}`),
          axiosInstance.get(`/api/last-minute-contract-rate/suggest/${hotelId}`),
        ];
        if (isEdit && rateId) {
          reqs.push(axiosInstance.get(`/api/last-minute-contract-rate/${rateId}`));
        }
        const [roomsRes, suggestRes, existingRes] = await Promise.all(reqs);

        // Map hotel rooms (same shape as the existing CreateContractRate)
        const mapped = (roomsRes.data || []).map((room) => {
          const uniqOcc = (room.occupancyDetailsDTOs || []).reduce((acc, cur) => {
            const exists = acc.find(
              (x) => x.id === cur.id && x.occupanyType === cur.occupanyType
            );
            if (!exists) acc.push(cur);
            return acc;
          }, []);
          return {
            hotelRoomcategoryId: room.rommCategoryId || room.hotelRoomcategoryId,
            roomCategory: room.roomCategory,
            occupancyDetailsDTOs: uniqOcc,
            roomTypeDetailsDTOs: room.roomTypeDetailsDTOs || [],
          };
        });
        setHotelRooms(mapped);

        // Build suggestions map: catId|typeId|occId → suggestion
        const map = {};
        (suggestRes.data || []).forEach((s) => {
          const key = `${s.hotelRoomcategoryId}|${s.hotelRoomtypeId}|${s.ocuppancytypeId}`;
          map[key] = s;
        });
        setSuggestions(map);

        if (isEdit && existingRes?.data) {
          // Hydrate the form from the existing rate (preserves user-entered overrides).
          // Note: market labels fall back to `#<id>` here; a follow-up effect below
          // re-resolves real names once the markets/countries dropdowns are loaded.
          const e = existingRes.data;
          setFormData({
            seasonId: e.seasonId ?? "",
            rateCode: e.rateCode ?? "",
            marketType: (e.markeType || []).map((mid) => ({
              value: mid,
              label: `#${mid}`,
            })),
            excludeCountry: (e.excludeCountry || []).map((cid) => ({
              value: cid,
              label: `#${cid}`,
            })),
            daySelection: e.allDays
              ? "allDays"
              : e.weekDay
              ? "weekDays"
              : e.weekEndDay
              ? "weekendDays"
              : "allDays",
            validityList:
              e.contractRateValidityDTO && e.contractRateValidityDTO.length > 0
                ? e.contractRateValidityDTO.map((v) => ({
                    validityFrom: v.validityFrom ? String(v.validityFrom).slice(0, 16) : "",
                    validityTo: v.validityTo ? String(v.validityTo).slice(0, 16) : "",
                  }))
                : [{ validityFrom: "", validityTo: "" }],
            roomRates: (e.contractRateRoomDTO || []).map((r) => ({
              hotelRoomcategoryId: String(r.hotelRoomcategoryId),
              hotelRoomtypeId: String(r.hotelRoomtypeId),
              ocuppancytypeId: String(r.ocuppancytypeId),
              rate: r.rate ?? 0,
              adultRate: r.adultRate ?? 0,
              childRate: r.childRate ?? 0,
              extraBed: !!r.extraBed,
              meal: !!r.meal,
              // Legacy rows may not carry a refundable value; default to
              // Refundable so the mandatory radio always loads a selection.
              refundable: r.refundable === null || r.refundable === undefined
                ? true
                : !!r.refundable,
            })),
            isLive: !!e.isLive,
            checkInWindowDays: e.checkInWindowDays != null ? Number(e.checkInWindowDays) : 2,
            markup: e.markup ?? "",
            termsAndConditions:
              e.termsAndConditions && e.termsAndConditions.length > 0
                ? e.termsAndConditions
                : [""],
            cancellationPolicies:
              e.cancellationPolicies && e.cancellationPolicies.length > 0
                ? e.cancellationPolicies
                : [{ amount: "", amountType: "PERCENT", daysBeforeArrival: "" }],
            amendmentPolicies:
              e.amendmentPolicies && e.amendmentPolicies.length > 0
                ? e.amendmentPolicies
                : [{ amount: "", amountType: "PERCENT", daysBeforeArrival: "" }],
            noShowPolicies:
              e.noShowPolicies && e.noShowPolicies.length > 0
                ? e.noShowPolicies
                : [{ amount: "", amountType: "PERCENT", daysBeforeArrival: "" }],
            paymentPolicies:
              e.paymentPolicies && e.paymentPolicies.length > 0
                ? e.paymentPolicies
                : [""],
          });
        } else {
          // CREATE mode: leave every rate cell empty so the operator enters
          // the rates manually (no auto-suggested pre-fill). The suggestions
          // map is still loaded above and used only for the on-save validation
          // (rate must be <= normal - markup%) and the "normal → -X%" hint
          // shown beside each cell.
          setFormData((f) => ({ ...f, roomRates: [] }));
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to load form data");
      } finally {
        setRoomLoading(false);
      }
    };
    init();
  }, [hotelId, rateId, isEdit]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const addValidity = () =>
    setFormData((f) => ({
      ...f,
      validityList: [...f.validityList, { validityFrom: "", validityTo: "" }],
    }));

  const removeValidity = (index) =>
    setFormData((f) => ({
      ...f,
      validityList: f.validityList.filter((_, i) => i !== index),
    }));

  const handleRefundableChange = (catId, checked) => {
    setFormData((prev) => ({
      ...prev,
      roomRates: prev.roomRates.map((r) =>
        r.hotelRoomcategoryId === String(catId) ? { ...r, refundable: checked } : r
      ),
    }));
  };

  const handleRateChange = (catId, occId, typeId, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.roomRates];
      const idx = updated.findIndex(
        (r) =>
          r.hotelRoomcategoryId === String(catId) &&
          r.ocuppancytypeId === String(occId) &&
          r.hotelRoomtypeId === String(typeId)
      );
      if (idx !== -1) {
        updated[idx] = { ...updated[idx], [field]: Number(value) };
        if (field === "adultRate" || field === "childRate") {
          updated[idx].extraBed = Number(value) > 0;
        }
      } else {
        updated.push({
          hotelRoomcategoryId: String(catId),
          hotelRoomtypeId: String(typeId),
          ocuppancytypeId: String(occId),
          rate: field === "rate" ? Number(value) : 0,
          adultRate: field === "adultRate" ? Number(value) : 0,
          childRate: field === "childRate" ? Number(value) : 0,
          meal: false,
          extraBed: field === "adultRate" || field === "childRate" ? Number(value) > 0 : false,
          refundable: true,
        });
      }
      return { ...prev, roomRates: updated };
    });
  };

  const cellValue = (catId, occId, typeId, field) =>
    formData.roomRates.find(
      (r) =>
        r.hotelRoomcategoryId === String(catId) &&
        r.ocuppancytypeId === String(occId) &&
        r.hotelRoomtypeId === String(typeId)
    )?.[field] ?? "";

  const updateTextPolicy = (field, index, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field].map((item, i) => (i === index ? value : item)),
    }));
  };

  const addTextPolicy = (field) => {
    setFormData((prev) => ({ ...prev, [field]: [...prev[field], ""] }));
  };

  const removeTextPolicy = (field, index) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field].length > 1 ? prev[field].filter((_, i) => i !== index) : [""],
    }));
  };

  const updateRulePolicy = (field, index, key, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field].map((item, i) =>
        i === index ? { ...item, [key]: value } : item
      ),
    }));
  };

  const addRulePolicy = (field) => {
    setFormData((prev) => ({
      ...prev,
      [field]: [...prev[field], { amount: "", amountType: "PERCENT", daysBeforeArrival: "" }],
    }));
  };

  const removeRulePolicy = (field, index) => {
    setFormData((prev) => ({
      ...prev,
      [field]:
        prev[field].length > 1
          ? prev[field].filter((_, i) => i !== index)
          : [{ amount: "", amountType: "PERCENT", daysBeforeArrival: "" }],
    }));
  };

  const policyRulePayload = (rows) =>
    (rows || [])
      .filter((row) => row.amount !== "" || row.daysBeforeArrival !== "")
      .map((row) => ({
        amount: row.amount !== "" ? Number(row.amount) : null,
        amountType: row.amountType || "PERCENT",
        daysBeforeArrival: row.daysBeforeArrival !== "" ? Number(row.daysBeforeArrival) : null,
      }));

  // Safely parse the markup text field — handles "", ".", NaN without crashing.
  const parseMarkup = (val) => {
    if (!val || val === ".") return 0;
    const n = parseFloat(val);
    return isNaN(n) ? 0 : n;
  };

  // ── Validation ─────────────────────────────────────────────────────────────
  const validateForm = () => {
    const errs = {};
    if (!formData.seasonId) errs.seasonId = "Please select a season.";
    if (!formData.rateCode.trim()) errs.rateCode = "Please enter a rate code.";
    if (!formData.marketType.length) errs.marketType = "Pick at least one market type.";
    if (!formData.validityList.length) {
      errs.validityList = "Add at least one validity period.";
    } else {
      formData.validityList.forEach((v, i) => {
        if (!v.validityFrom || !v.validityTo) {
          errs[`validityFrom_${i}`] = "Both dates are required.";
        } else if (new Date(v.validityFrom) >= new Date(v.validityTo)) {
          errs[`validityTo_${i}`] = "Validity To must be after Validity From.";
        }
      });
    }
    if (!formData.roomRates.length) {
      errs.roomRates = "Please enter at least one rate.";
    }

    // Refundable selection is mandatory on every room category.
    const missingRefundable = formData.roomRates.some(
      (r) => r.refundable !== true && r.refundable !== false
    );
    if (missingRefundable) {
      errs.roomRates = "Please select Refundable or Non Refundable for every room category.";
    }

    // Client-side rate check incorporating markup percentage as a discount off normal rate
    const discountPct = (formData.markup === "" || formData.markup === undefined || formData.markup === null) ? 10 : parseMarkup(formData.markup);
    const maxAllowedFactor = 1.0 - discountPct / 100.0;
    formData.roomRates.forEach((r, i) => {
      const key = `${r.hotelRoomcategoryId}|${r.hotelRoomtypeId}|${r.ocuppancytypeId}`;
      const s = suggestions[key];
      if (s?.normalRate != null) {
        const maxRate = Math.round(s.normalRate * maxAllowedFactor * 100) / 100;
        if (Number(r.rate) > maxRate + 0.001) {
          errs[`rate_${i}`] = `Rate ${r.rate} exceeds cap (max ${maxRate.toFixed(2)}).`;
        }
      }
    });
    return errs;
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const errs = validateForm();
    if (Object.keys(errs).length) {
      setValidationErrors(errs);
      const cellWarn = Object.keys(errs).find((k) => k.startsWith("rate_"));
      if (cellWarn) toast.error(errs[cellWarn]);
      return;
    }
    setValidationErrors({});
    setServerError(null);
    setIsSubmitting(true);

    let allDays = false, weekDay = false, weekEndDay = false;
    if (formData.daySelection === "allDays") allDays = true;
    if (formData.daySelection === "weekDays") weekDay = true;
    if (formData.daySelection === "weekendDays") weekEndDay = true;

    // Drop empty rows (rate <= 0). The backend would skip them anyway, but
    // filtering here keeps the wire payload clean and the inline-error path
    // accurate for the reported "no matching normal rate" case.
    const meaningfulRoomRates = formData.roomRates.filter(
      (r) => Number(r.rate || 0) > 0
    );
    if (meaningfulRoomRates.length === 0) {
      toast.error("Enter at least one rate value greater than 0.");
      setIsSubmitting(false);
      return;
    }

    const payload = {
      markeType: formData.marketType.map((m) => m.value),
      excludeCountry: formData.excludeCountry.map((c) => c.value),
      hotelId: Number(hotelId),
      seasonId: Number(formData.seasonId),
      rateCode: formData.rateCode.trim(),
      weekDay,
      weekEndDay,
      allDays,
      isLive: formData.isLive,
      checkInWindowDays: Number(formData.checkInWindowDays) || 2,
      markup: formData.markup,
      termsAndConditions: formData.termsAndConditions
        .map((item) => item.trim())
        .filter(Boolean),
      cancellationPolicies: policyRulePayload(formData.cancellationPolicies),
      amendmentPolicies: policyRulePayload(formData.amendmentPolicies),
      noShowPolicies: policyRulePayload(formData.noShowPolicies),
      paymentPolicies: formData.paymentPolicies
        .map((item) => item.trim())
        .filter(Boolean),
      contractRateValidityDTO: formData.validityList.map((v) => ({
        validityFrom: v.validityFrom ? `${v.validityFrom}:00` : null,
        validityTo: v.validityTo ? `${v.validityTo}:00` : null,
      })),
      contractRateRoomDTO: meaningfulRoomRates.map((r) => ({
        hotelRoomcategoryId: Number(r.hotelRoomcategoryId),
        hotelRoomtypeId: Number(r.hotelRoomtypeId),
        ocuppancytypeId: Number(r.ocuppancytypeId),
        refundable: !!r.refundable,
        rate: Number(r.rate || 0),
        extraBed: !!r.extraBed,
        meal: !!r.meal,
        adultRate: Number(r.adultRate || 0),
        childRate: Number(r.childRate || 0),
      })),
    };

    try {
      if (isEdit) {
        await axiosInstance.put(`/api/last-minute-contract-rate/${rateId}`, payload);
        toast.success("Last Minute Contract Rate updated");
      } else {
        await axiosInstance.post(`/api/last-minute-contract-rate/save`, payload);
        toast.success("Last Minute Contract Rate saved");
      }
      navigate(`/hotel-actions/${hotelId}/last-minute-contract-rate`);
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || "Save failed";
      setServerError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderTextPolicies = (title, field, placeholder) => (
    <div className="border-top pt-4 mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="fw-bold text-primary mb-0">{title}</h6>
        <Button size="sm" variant="outline-primary" onClick={() => addTextPolicy(field)}>
          <FaPlus className="me-1" /> Add More
        </Button>
      </div>
      {formData[field].map((item, index) => (
        <Row key={`${field}-${index}`} className="align-items-start mb-2 g-2">
          <Col md={11}>
            <Form.Control
              as="textarea"
              rows={2}
              value={item}
              placeholder={placeholder}
              onChange={(e) => updateTextPolicy(field, index, e.target.value)}
            />
          </Col>
          <Col md={1} className="text-end">
            <Button
              size="sm"
              variant="outline-danger"
              onClick={() => removeTextPolicy(field, index)}
              disabled={formData[field].length === 1}
            >
              <FaTrash />
            </Button>
          </Col>
        </Row>
      ))}
    </div>
  );

  const renderRulePolicies = (title, field, label) => (
    <div className="border-top pt-4 mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="fw-bold text-primary mb-0">{title}</h6>
        <Button size="sm" variant="outline-primary" onClick={() => addRulePolicy(field)}>
          <FaPlus className="me-1" /> Add More
        </Button>
      </div>
      {formData[field].map((item, index) => (
        <Row key={`${field}-${index}`} className="align-items-center mb-3 bg-light p-3 rounded-3">
          <Col md={12}>
            <div className="d-flex align-items-center flex-wrap gap-2">
              <span className="fw-semibold small">{label} of</span>
              <Form.Control
                type="number"
                min="0"
                step="0.01"
                style={{ width: "120px" }}
                value={item.amount}
                onChange={(e) => updateRulePolicy(field, index, "amount", e.target.value)}
              />
              <Form.Select
                style={{ width: "110px" }}
                value={item.amountType || "PERCENT"}
                onChange={(e) => updateRulePolicy(field, index, "amountType", e.target.value)}
              >
                <option value="PERCENT">%</option>
                <option value="AMOUNT">Amount</option>
              </Form.Select>
              <span className="text-muted small">if applicable less than</span>
              <Form.Control
                type="number"
                min="0"
                step="1"
                style={{ width: "90px" }}
                value={item.daysBeforeArrival}
                onChange={(e) => updateRulePolicy(field, index, "daysBeforeArrival", e.target.value)}
              />
              <span className="text-muted small">days before arrival</span>
              <Button
                size="sm"
                variant="outline-danger"
                onClick={() => removeRulePolicy(field, index)}
                disabled={formData[field].length === 1}
              >
                <FaTrash />
              </Button>
            </div>
          </Col>
        </Row>
      ))}
    </div>
  );

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Container fluid>
            <div className="position-relative d-flex align-items-center mb-4">
  <Button
    variant="outline-secondary"
    onClick={() => navigate(-1)}
  >
    <FaArrowLeft className="me-2" /> Back
  </Button>

  <div className="position-absolute start-50 translate-middle-x">
    <h4 className="fw-semibold text-dark mb-0">
      {isEdit ? "Edit" : "Create"} Last Minute
    </h4>
  </div>

  <div className="ms-auto">
    <HotelTitleBadge hotelId={hotelId} />
  </div>
</div>

            <Card className="shadow-sm border-0 rounded-4 p-4">
              {loading ? (
                <div className="text-center py-5"><Spinner animation="border" /></div>
              ) : (
                <>
                  <Alert variant="info" className="py-2 mb-3" style={{ fontSize: "0.85rem" }}>
                    Last-minute rates are auto-suggested as <strong>10% lower</strong> than the
                    matching normal contract rate. You may edit cells, but the server will reject
                    any value above the 90% cap.
                  </Alert>

                  {serverError && (
                    <Alert variant="danger" className="py-2 mb-3">{serverError}</Alert>
                  )}

                  {/* Top form */}
                  <Row className="mb-4 g-4">
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label>Season</Form.Label>
                        <Form.Select
                          value={formData.seasonId}
                          isInvalid={!!validationErrors.seasonId}
                          onChange={(e) => setFormData({ ...formData, seasonId: e.target.value })}
                        >
                          <option value="">Select Season Type</option>
                          {seasonTypes.map((s) => (
                            <option key={s.seasonTypeId} value={s.seasonTypeId}>
                              {s.season}
                            </option>
                          ))}
                        </Form.Select>
                        {validationErrors.seasonId && (
                          <Form.Control.Feedback type="invalid">
                            {validationErrors.seasonId}
                          </Form.Control.Feedback>
                        )}
                      </Form.Group>
                    </Col>

                    <Col md={3}>
                      <Form.Group>
                        <Form.Label>Rate Code</Form.Label>
                        <Form.Control
                          value={formData.rateCode}
                          isInvalid={!!validationErrors.rateCode}
                          onChange={(e) => setFormData({ ...formData, rateCode: e.target.value })}
                        />
                        {validationErrors.rateCode && (
                          <Form.Control.Feedback type="invalid">
                            {validationErrors.rateCode}
                          </Form.Control.Feedback>
                        )}
                      </Form.Group>
                    </Col>

                    <Col md={3}>
                      <Form.Group>
                        <Form.Label>Market Type</Form.Label>
                        <Select
                          isMulti
                          options={markets.map((m) => ({ value: m.marketTypeId, label: m.name }))}
                          value={formData.marketType}
                          onChange={(sel) => setFormData({ ...formData, marketType: sel || [] })}
                          className={validationErrors.marketType ? "is-invalid" : ""}
                          menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
                          menuPosition="fixed"
                          styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
                        />
                        {validationErrors.marketType && (
                          <div className="invalid-feedback d-block">{validationErrors.marketType}</div>
                        )}
                      </Form.Group>
                    </Col>

                    <Col md={3}>
                      <Form.Group>
                        <Form.Label>Exclude Nationality</Form.Label>
                        <Select
                          isMulti
                          options={countries.map((c) => ({
                            value: c.id,
                            label: `${c.name} (${c.marketType})`,
                          }))}
                          value={formData.excludeCountry}
                          onChange={(sel) => setFormData({ ...formData, excludeCountry: sel || [] })}
                          menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
                          menuPosition="fixed"
                          styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
                        />
                      </Form.Group>
                    </Col>

                    <Col md={3}>
                      <Form.Group>
                        <Form.Label>Check-in Window (Days)</Form.Label>
                        <Form.Control
                          type="number"
                          min="1"
                          max="30"
                          step="1"
                          value={formData.checkInWindowDays}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const n =
                              raw === "" ? "" : Math.max(1, Math.min(30, Number(raw) || 1));
                            setFormData({ ...formData, checkInWindowDays: n });
                          }}
                        />
                        <Form.Text className="text-muted" style={{ fontSize: "0.75rem" }}>
                          — booking page calendar opens for this many days from today
                        </Form.Text>
                      </Form.Group>
                    </Col>

                    <Col md={3}>
                      <Form.Group>
                        <Form.Label>Markup Percentage</Form.Label>
                        <Form.Control
                          type="text"
                          name="markup"
                          placeholder="Enter markup percentage"
                          value={formData.markup}
                          onChange={(e) => {
                            const val = e.target.value;
                            // Treat markup % as a discount % off the normal rate.
                            // If empty, defaults to 10%.
                            const discountPct = (val === "" || val === undefined || val === null) ? 10 : parseMarkup(val);
                            const maxAllowedFactor = 1.0 - discountPct / 100.0;
                            
                            // Recalculate room rates dynamically based on the normal rates from suggestions
                            const updatedRates = formData.roomRates.map((r) => {
                              const key = `${r.hotelRoomcategoryId}|${r.hotelRoomtypeId}|${r.ocuppancytypeId}`;
                              const s = suggestions[key];
                              if (s) {
                                return {
                                  ...r,
                                  rate: s.normalRate != null ? Math.round(s.normalRate * maxAllowedFactor * 100) / 100 : r.rate,
                                  adultRate: s.normalAdultRate != null ? Math.round(s.normalAdultRate * maxAllowedFactor * 100) / 100 : r.adultRate,
                                  childRate: s.normalChildRate != null ? Math.round(s.normalChildRate * maxAllowedFactor * 100) / 100 : r.childRate,
                                };
                              }
                              return r;
                            });
                            
                            setFormData((f) => ({
                              ...f,
                              markup: val,
                              roomRates: updatedRates,
                            }));
                          }}
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  {/* Day Selection */}
                  <Row className="mb-4">
                    <Col md={12}>
                      <Card className="p-3 bg-light border-0 rounded-3">
                        <h6 className="fw-bold text-primary mb-3">Day Selection</h6>
                        <Form.Group>
                          <div className="d-flex gap-4">
                            {[
                              { id: "allDays", label: "All Days" },
                              { id: "weekDays", label: "Week Days" },
                              { id: "weekendDays", label: "Weekend Days" },
                            ].map((d) => (
                              <Form.Check
                                key={d.id}
                                type="radio"
                                id={`lm-${d.id}`}
                                name="lmDaySelection"
                                label={d.label}
                                value={d.id}
                                checked={formData.daySelection === d.id}
                                onChange={(e) =>
                                  setFormData({ ...formData, daySelection: e.target.value })
                                }
                              />
                            ))}
                          </div>
                        </Form.Group>
                      </Card>
                    </Col>
                  </Row>

                  {/* Validity */}
                  <Card className="p-3 bg-light border-0 mb-4 rounded-3">
                    <div className="d-flex justify-content-between mb-3">
                      <h6 className="fw-bold text-primary mb-0">Validity Periods</h6>
                      <Button size="sm" variant="outline-primary" onClick={addValidity}>
                        <FaPlus className="me-1" /> Add
                      </Button>
                    </div>
                    {formData.validityList.map((v, idx) => (
                      <Row key={idx} className="align-items-end mb-2">
                        <Col md={4}>
                          <Form.Control
                            type="datetime-local"
                            value={v.validityFrom}
                            isInvalid={!!validationErrors[`validityFrom_${idx}`]}
                            onChange={(e) => {
                              const updated = [...formData.validityList];
                              updated[idx].validityFrom = e.target.value;
                              const cur = formData.validityList[idx].validityTo;
                              if (cur && e.target.value && new Date(cur) <= new Date(e.target.value)) {
                                updated[idx].validityTo = "";
                              }
                              setFormData({ ...formData, validityList: updated });
                            }}
                          />
                          {validationErrors[`validityFrom_${idx}`] && (
                            <Form.Control.Feedback type="invalid">
                              {validationErrors[`validityFrom_${idx}`]}
                            </Form.Control.Feedback>
                          )}
                        </Col>
                        <Col md={4}>
                          <Form.Control
                            type="datetime-local"
                            value={v.validityTo}
                            min={v.validityFrom || undefined}
                            isInvalid={!!validationErrors[`validityTo_${idx}`]}
                            onChange={(e) => {
                              const updated = [...formData.validityList];
                              updated[idx].validityTo = e.target.value;
                              setFormData({ ...formData, validityList: updated });
                            }}
                          />
                          {validationErrors[`validityTo_${idx}`] && (
                            <Form.Control.Feedback type="invalid">
                              {validationErrors[`validityTo_${idx}`]}
                            </Form.Control.Feedback>
                          )}
                        </Col>
                        <Col md="auto">
                          <Button variant="outline-danger" size="sm" onClick={() => removeValidity(idx)}>
                            ✖
                          </Button>
                        </Col>
                      </Row>
                    ))}
                  </Card>

                  {/* Room Rate Section — auto-populated, with normal-rate hint */}
                  <Card className="p-3 bg-light border-0 rounded-3">
                    <h6 className="fw-bold mb-3 text-primary">
                      Last Minute Rate Details (auto-populated · {((formData.markup === "" || formData.markup === undefined || formData.markup === null) ? 10 : parseMarkup(formData.markup))}% off normal)
                    </h6>
                    {validationErrors.roomRates && (
                      <div className="alert alert-danger mb-3">{validationErrors.roomRates}</div>
                    )}
                    {roomLoading ? (
                      <div className="text-center py-5"><Spinner animation="border" /></div>
                    ) : (
                      hotelRooms.map((room) => (
                        <div
                          key={room.hotelRoomcategoryId}
                          className="border rounded-4 bg-white p-3 mb-4 shadow-sm"
                        >
                          <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                            <span className="fw-semibold text-uppercase">{room.roomCategory}</span>
                            {(() => {
                              const current = formData.roomRates.find(
                                (r) => r.hotelRoomcategoryId === String(room.hotelRoomcategoryId)
                              );
                              const isRefundable    = current?.refundable === true;
                              const isNonRefundable = current?.refundable === false;
                              const groupName = `lm-refundable-${room.hotelRoomcategoryId}`;
                              return (
                                <div className="d-flex align-items-center gap-3">
                                  <Form.Check
                                    type="radio"
                                    inline
                                    name={groupName}
                                    id={`${groupName}-yes`}
                                    label="Refundable"
                                    checked={isRefundable}
                                    onChange={() => handleRefundableChange(room.hotelRoomcategoryId, true)}
                                  />
                                  <Form.Check
                                    type="radio"
                                    inline
                                    name={groupName}
                                    id={`${groupName}-no`}
                                    label="Non Refundable"
                                    checked={isNonRefundable}
                                    onChange={() => handleRefundableChange(room.hotelRoomcategoryId, false)}
                                  />
                                </div>
                              );
                            })()}
                          </div>
 
                          <Table bordered hover responsive size="sm">
                            <thead className="table-light">
                              <tr>
                                <th>Occupancy</th>
                                <th>Room Type</th>
                                <th>Rate <small className="text-muted">(normal → -{((formData.markup === "" || formData.markup === undefined || formData.markup === null) ? 10 : parseMarkup(formData.markup))}%)</small></th>
                                <th>Extra Adult</th>
                                <th>Extra Child</th>
                              </tr>
                            </thead>
                            <tbody>
                              {room.occupancyDetailsDTOs.length > 0 && room.roomTypeDetailsDTOs.length > 0 ? (
                                room.occupancyDetailsDTOs.map((occ) =>
                                  room.roomTypeDetailsDTOs.map((rt) => {
                                    const key = `${room.hotelRoomcategoryId}|${rt.roomTypeId}|${occ.id}`;
                                    const s = suggestions[key];
                                    const discountPct = (formData.markup === "" || formData.markup === undefined || formData.markup === null) ? 10 : parseMarkup(formData.markup);
                                    const maxAllowedFactor = 1.0 - discountPct / 100.0;
                                    return (
                                      <tr key={`${occ.id}-${rt.roomTypeId}`}>
                                        <td>{occ.occupanyType}</td>
                                        <td>{rt.roomTypeName}</td>
                                        {[
                                          {
                                            field: "rate",
                                            normal: s?.normalRate,
                                            maxVal: s?.normalRate != null
                                              ? Math.round(s.normalRate * maxAllowedFactor * 100) / 100
                                              : undefined,
                                          },
                                          {
                                            field: "adultRate",
                                            normal: s?.normalAdultRate,
                                            maxVal: s?.normalAdultRate != null
                                              ? Math.round(s.normalAdultRate * maxAllowedFactor * 100) / 100
                                              : undefined,
                                          },
                                          {
                                            field: "childRate",
                                            normal: s?.normalChildRate,
                                            maxVal: s?.normalChildRate != null
                                              ? Math.round(s.normalChildRate * maxAllowedFactor * 100) / 100
                                              : undefined,
                                          },
                                        ].map(({ field, normal, maxVal }) => {
                                          const currentVal = cellValue(room.hotelRoomcategoryId, occ.id, rt.roomTypeId, field);
                                          const exceedsMax = maxVal != null && Number(currentVal) > maxVal;
                                          return (
                                          <td key={field} style={{ minWidth: 130 }}>
                                            {normal == null ? (
                                              <div
                                                style={{
                                                  fontSize: "0.72rem",
                                                  lineHeight: "1.3",
                                                  color: "#b45309",
                                                  background: "#fffbeb",
                                                  border: "1px solid #fcd34d",
                                                  borderRadius: "6px",
                                                  padding: "6px 8px",
                                                }}
                                              >
                                                No contract rate yet.
                                                <br />
                                                Add a normal contract rate first before entering a last-minute rate.
                                              </div>
                                            ) : (
                                              <>
                                                <Form.Control
                                                  type="number"
                                                  min="0"
                                                  max={maxVal != null ? maxVal : undefined}
                                                  step="0.01"
                                                  value={currentVal}
                                                  isInvalid={exceedsMax}
                                                  onChange={(e) => {
                                                    const raw = e.target.value;
                                                    const cleaned =
                                                      raw === "" ? "" : String(Number(raw));
                                                    const capped =
                                                      maxVal != null && Number(cleaned) > maxVal
                                                        ? String(maxVal)
                                                        : cleaned;
                                                    handleRateChange(
                                                      room.hotelRoomcategoryId,
                                                      occ.id,
                                                      rt.roomTypeId,
                                                      field,
                                                      capped
                                                    );
                                                  }}
                                                />
                                                <div style={{ fontSize: "0.7rem" }} className="mt-1">
                                                  <Badge bg="light" text="dark" className="me-1">
                                                    Normal: {Number(normal).toFixed(2)}
                                                  </Badge>
                                                  <Badge bg="success">
                                                    Max: {maxVal != null ? Number(maxVal).toFixed(2) : "—"}
                                                  </Badge>
                                                </div>
                                              </>
                                            )}
                                          </td>
                                        );
                                        })}
                                      </tr>
                                    );
                                  })
                                )
                              ) : (
                                <tr>
                                  <td colSpan="5" className="text-center text-muted py-3">
                                    No room types or occupancy details available
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </Table>
                        </div>
                      ))
                    )}
                  </Card>

                  <Card className="p-3 bg-white border-0 rounded-3 mt-4 shadow-sm">
                    <h6 className="fw-bold mb-1 text-primary">
                      Terms &amp; Conditions and Policies
                    </h6>
                    <p className="text-muted small mb-0">
                      These Last Minute-specific policies will be shown before booking confirmation.
                    </p>

                    {renderTextPolicies(
                      "Terms & Conditions",
                      "termsAndConditions",
                      "Example: Last minute rate is subject to availability"
                    )}
                    {renderRulePolicies(
                      "Cancellation Policies",
                      "cancellationPolicies",
                      "Cancellation fee"
                    )}
                    {renderRulePolicies(
                      "Amendment Policies",
                      "amendmentPolicies",
                      "Amendment fee"
                    )}
                    {renderRulePolicies(
                      "No-show Policies",
                      "noShowPolicies",
                      "No-show fee"
                    )}
                    {renderTextPolicies(
                      "Payment Policies",
                      "paymentPolicies",
                      "Example: Full payment required before confirmation"
                    )}
                  </Card>

                  <div className="d-flex justify-content-between mt-4">
                    <Button variant="outline-danger" onClick={() => navigate(-1)}>
                      Cancel
                    </Button>
                    <Button variant="success" onClick={handleSave} disabled={isSubmitting}>
                      {isSubmitting ? <Spinner size="sm" animation="border" /> : isEdit ? "Update" : "Save"}
                    </Button>
                  </div>
                </>
              )}
            </Card>
          </Container>
        </main>
      </div>
    </div>
  );
}
