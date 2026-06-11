import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Container,
  Row,
  Col,
  Form,
  Button,
  Card,
  Spinner,
  Table,
  Overlay,
  Popover,
} from "react-bootstrap";
import { FaArrowLeft, FaPlus } from "react-icons/fa";
import Select from "react-select";
import Sidebar from "../../../components/Sidebar";
import Topbar from "../../../components/TopBar";
import axiosInstance from "../../../components/AxiosInstance";
import HotelTitleBadge from "../../../components/HotelTitleBadge";
import { toast } from "react-hot-toast";

/**
 * DayStayContractForm — used for both CREATE and EDIT.
 *
 * Mirrors /hotel-actions/hotel/{hotelId}/contract-rate/create with every
 * field intact (season, rate code, market types, exclude countries, day
 * selection, multiple validity periods, per-room/occupancy rate matrix +
 * refundable per category), PLUS the day-stay-specific fields:
 *   - Check-In Window Start / End
 *   - Markup %
 *   - Remarks
 *
 * POST /api/day-stay-contract/save     (create)
 * PUT  /api/day-stay-contract/{id}     (edit)
 */
export default function DayStayContractForm({ mode }) {
  const navigate = useNavigate();
  const { id: hotelId, contractId } = useParams();
  const isEdit = mode === "edit";

  // View mode — `?mode=view` makes the form read-only. Mirrors the
  // /occupancy-and-minimumlength view pattern.
  const [searchParams] = useSearchParams();
  const isViewMode = searchParams.get("mode") === "view";

  const [formData, setFormData] = useState({
    seasonId: "",
    rateCode: "",
    marketType: [],
    excludeCountry: [],
    daySelection: "allDays",
    validityList: [{ validityFrom: "", validityTo: "" }],
    roomRates: [],
    // Day-stay extras
    checkInStartTime: "08:00",
    checkInEndTime: "17:00",
    percentage: "",
    remarks: "",
    termsAndConditions: [{ value: "" }],
    cancellationPolicies: [{ value: "" }],
  });

  const [markets, setMarkets] = useState([]);
  const [countries, setCountries] = useState([]);
  const [filteredCountries, setFilteredCountries] = useState([]);
  const [hotelRooms, setHotelRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [roomLoading, setRoomLoading] = useState(false);
  const [seasonTypes, setSeasonTypes] = useState([]);
  const [validationErrors, setValidationErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showCellConfirm, setShowCellConfirm] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [confirmData, setConfirmData] = useState(null);

  // ── Dropdown reference data ─────────────────────────────────────────
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
        setFilteredCountries(countryRes.data || []);
        setSeasonTypes(seasonTypeRes.data || []);
      } catch {
        toast.error("Failed to load dropdown data");
      } finally {
        setLoading(false);
      }
    };
    fetchDropdowns();
  }, []);

  // ── Hotel rooms ─────────────────────────────────────────────────────
  useEffect(() => {
    const fetchHotelRooms = async () => {
      if (!hotelId) return;
      try {
        setRoomLoading(true);
        const res = await axiosInstance.get(
          `/api/hotelRoomDetailsController/${hotelId}`
        );
        if (res.data) {
          const mapped = res.data.map((room) => {
            const uniqueOccupancy = (room.occupancyDetailsDTOs || []).reduce(
              (acc, current) => {
                const i = acc.findIndex(
                  (item) =>
                    item.id === current.id &&
                    item.occupanyType === current.occupanyType
                );
                if (i === -1) acc.push(current);
                return acc;
              },
              []
            );
            return {
              hotelRoomcategoryId:
                room.rommCategoryId || room.hotelRoomcategoryId,
              roomCategory: room.roomCategory,
              occupancyDetailsDTOs: uniqueOccupancy,
              roomTypeDetailsDTOs: room.roomTypeDetailsDTOs || [],
            };
          });
          setHotelRooms(mapped);
        }
      } catch {
        toast.error("Failed to load hotel room details");
      } finally {
        setRoomLoading(false);
      }
    };
    fetchHotelRooms();
  }, [hotelId]);

  // ── Edit-mode hydration ─────────────────────────────────────────────
  useEffect(() => {
    if (!isEdit || !contractId) return;
    const load = async () => {
      try {
        const res = await axiosInstance.get(
          `/api/day-stay-contract/${contractId}`
        );
        const d = res.data || {};
        const sel = d.allDays
          ? "allDays"
          : d.weekDay
          ? "weekDays"
          : d.weekEndDay
          ? "weekendDays"
          : "allDays";
        setFormData((p) => ({
          ...p,
          seasonId: d.seasonId ? String(d.seasonId) : "",
          rateCode: d.rateCode || "",
          marketType: (d.marketType || []).map((mid) => ({
            value: mid,
            label: String(mid),
          })),
          excludeCountry: (d.excludeCountry || []).map((cid) => ({
            value: cid,
            label: String(cid),
          })),
          daySelection: sel,
          validityList:
            (d.validityList || []).length > 0
              ? d.validityList.map((v) => ({
                  validityFrom: (v.validityFrom || "").slice(0, 16),
                  validityTo: (v.validityTo || "").slice(0, 16),
                }))
              : [{ validityFrom: "", validityTo: "" }],
          roomRates: (d.roomRates || []).map((r) => ({
            hotelRoomcategoryId: String(r.hotelRoomCategoryId || ""),
            hotelRoomtypeId: String(r.hotelRoomTypeId || ""),
            ocuppancytypeId: String(r.occupancyTypeId || ""),
            mealType: r.mealType || "",
            hotelMealId: r.hotelMealId || 0,
            rate: Number(r.rate || 0),
            adultRate: Number(r.adultRate || 0),
            childRate: Number(r.childRate || 0),
            meal: !!r.meal,
            extraBed: !!r.extraBed,
            refundable: !!r.refundable,
          })),
          checkInStartTime: (d.checkInStartTime || "08:00").slice(0, 5),
          checkInEndTime: (d.checkInEndTime || "17:00").slice(0, 5),
          percentage: d.percentage ?? "",
          remarks: d.remarks || "",
          termsAndConditions: seedPolicyRows(d.termsAndConditions),
          cancellationPolicies: seedPolicyRows(d.cancellationPolicies),
        }));
      } catch (err) {
        toast.error("Failed to load Day Stay contract");
      }
    };
    load();
  }, [isEdit, contractId]);

  // Once markets / countries arrive, hydrate the multi-select labels for edit.
  useEffect(() => {
    if (!isEdit) return;
    setFormData((p) => {
      const mt = (p.marketType || []).map((opt) => {
        const m = markets.find((x) => x.marketTypeId === opt.value);
        return m ? { value: m.marketTypeId, label: m.name } : opt;
      });
      const ec = (p.excludeCountry || []).map((opt) => {
        const c = countries.find((x) => x.id === opt.value);
        return c
          ? { value: c.id, label: `${c.name} (${c.marketType})` }
          : opt;
      });
      return { ...p, marketType: mt, excludeCountry: ec };
    });
  }, [markets, countries, isEdit]);

  const getMinValidityToDate = (fromDate) => fromDate || "";

  const seedPolicyRows = (items) => {
    const rows = Array.isArray(items)
      ? items.filter(Boolean).map((value) => ({ value }))
      : [];
    return rows.length ? rows : [{ value: "" }];
  };

  const updatePolicyRow = (field, index, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field].map((row, i) =>
        i === index ? { ...row, value } : row
      ),
    }));
  };

  const addPolicyRow = (field) => {
    setFormData((prev) => ({
      ...prev,
      [field]: [...prev[field], { value: "" }],
    }));
  };

  const removePolicyRow = (field, index) => {
    setFormData((prev) => ({
      ...prev,
      [field]:
        prev[field].length > 1
          ? prev[field].filter((_, i) => i !== index)
          : [{ value: "" }],
    }));
  };

  const addValidity = () =>
    setFormData((p) => ({
      ...p,
      validityList: [...p.validityList, { validityFrom: "", validityTo: "" }],
    }));

  const removeValidity = (index) =>
    setFormData((p) => ({
      ...p,
      validityList: p.validityList.filter((_, i) => i !== index),
    }));

  const handleRefundableChange = (roomId, checked) => {
    setFormData((prev) => {
      const updated = [...prev.roomRates];
      updated.forEach((r) => {
        if (r.hotelRoomcategoryId === String(roomId)) r.refundable = checked;
      });
      return { ...prev, roomRates: updated };
    });
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.seasonId) errors.seasonId = "Please select a season.";
    if (!formData.rateCode.trim()) errors.rateCode = "Please enter a rate code.";
    if (!formData.marketType.length)
      errors.marketType = "Please select at least one market type.";
    if (!formData.checkInStartTime)
      errors.checkInStartTime = "Required";
    if (!formData.checkInEndTime) errors.checkInEndTime = "Required";
    if (
      formData.checkInStartTime &&
      formData.checkInEndTime &&
      formData.checkInStartTime >= formData.checkInEndTime
    )
      errors.checkInEndTime = "End time must be after start time";
    if (formData.percentage !== "" && Number(formData.percentage) < 0)
      errors.percentage = "Cannot be negative";

    if (!formData.validityList.length) {
      errors.validityList = "Please add a validity period.";
    } else {
      formData.validityList.forEach((v, index) => {
        if (!v.validityFrom || !v.validityTo) {
          errors[`validityFrom_${index}`] = "Please fill both validity dates.";
        } else if (new Date(v.validityFrom) >= new Date(v.validityTo)) {
          errors[`validityTo_${index}`] =
            "Validity To must be after Validity From.";
        }
      });
    }

    if (formData.roomRates.length === 0) {
      errors.roomRates = "Please add at least one room rate.";
    } else {
      const hasValid = formData.roomRates.some(
        (r) => r.rate > 0 || r.adultRate > 0 || r.childRate > 0
      );
      if (!hasValid)
        errors.roomRates =
          "Please enter at least one valid rate (rate, adult, or child).";
    }
    return errors;
  };

  const handleBlur = (e, roomId, occName, roomTypeId, roomTypeName, field, value) => {
    if (value && Number(value) > 0) {
      const target = e.target;
      setTimeout(() => {
        setConfirmTarget(target);
        setConfirmData({ roomId, occName, roomTypeId, roomTypeName, field, value });
        setShowCellConfirm(true);
      }, 150);
    } else {
      setShowCellConfirm(false);
    }
  };

  const handleRateChange = (roomId, occId, roomTypeId, roomTypeName, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.roomRates];
      const idx = updated.findIndex(
        (r) =>
          r.hotelRoomcategoryId === String(roomId) &&
          r.ocuppancytypeId === String(occId) &&
          r.hotelRoomtypeId === String(roomTypeId)
      );
      if (idx !== -1) {
        updated[idx][field] = Number(value);
        if (field === "adultRate" || field === "childRate") {
          updated[idx].extraBed = Number(value) > 0;
        }
      } else {
        updated.push({
          hotelRoomcategoryId: String(roomId),
          hotelRoomtypeId: String(roomTypeId),
          ocuppancytypeId: String(occId),
          mealType: roomTypeName,
          hotelMealId: roomTypeName.toLowerCase().includes("breakfast") ? 1 : 0,
          rate: field === "rate" ? Number(value) : 0,
          adultRate: field === "adultRate" ? Number(value) : 0,
          childRate: field === "childRate" ? Number(value) : 0,
          meal: roomTypeName.toLowerCase().includes("breakfast"),
          extraBed:
            field === "adultRate" || field === "childRate"
              ? Number(value) > 0
              : false,
          refundable: false,
        });
      }
      return { ...prev, roomRates: updated };
    });
  };

  const handleSaveClick = () => {
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});
    submitData();
  };

  const submitData = async () => {
    setIsSubmitting(true);
    try {
      let allDays = 0,
        weekDay = 0,
        weekEndDay = 0;
      switch (formData.daySelection) {
        case "allDays":
          allDays = 1;
          break;
        case "weekDays":
          weekDay = 1;
          break;
        case "weekendDays":
          weekEndDay = 1;
          break;
        default:
          allDays = 1;
      }

      const payload = {
        hotelId: Number(hotelId),
        rateCode: formData.rateCode.trim(),
        seasonId: formData.seasonId ? Number(formData.seasonId) : null,
        marketType: formData.marketType.map((m) => Number(m.value)),
        excludeCountry: formData.excludeCountry.map((c) => Number(c.value)),
        allDays,
        weekDay,
        weekEndDay,
        checkInStartTime: formData.checkInStartTime,
        checkInEndTime: formData.checkInEndTime,
        percentage:
          formData.percentage === "" ? null : Number(formData.percentage),
        remarks: formData.remarks?.trim() || null,
        termsAndConditions: formData.termsAndConditions
          .map((row) => row.value.trim())
          .filter(Boolean),
        cancellationPolicies: formData.cancellationPolicies
          .map((row) => row.value.trim())
          .filter(Boolean),
        validityList: formData.validityList.map((v) => ({
          validityFrom: v.validityFrom ? `${v.validityFrom}:00` : null,
          validityTo: v.validityTo ? `${v.validityTo}:00` : null,
        })),
        roomRates: formData.roomRates.map((r) => ({
          hotelRoomCategoryId: Number(r.hotelRoomcategoryId),
          hotelRoomTypeId: Number(r.hotelRoomtypeId),
          occupancyTypeId: Number(r.ocuppancytypeId),
          mealType: r.mealType || null,
          hotelMealId: Number(r.hotelMealId || 0),
          rate: Number(r.rate || 0),
          dayStayRate: Number(r.rate || 0),
          adultRate: Number(r.adultRate || 0),
          childRate: Number(r.childRate || 0),
          extraBed: !!r.extraBed,
          meal: !!r.meal,
          refundable: !!r.refundable,
        })),
        isLive: true,
      };

      let res;
      if (isEdit) {
        res = await axiosInstance.put(
          `/api/day-stay-contract/${contractId}`,
          payload
        );
      } else {
        res = await axiosInstance.post(
          "/api/day-stay-contract/save",
          payload
        );
      }
      if (res.status === 200 || res.status === 201) {
        toast.success(
          isEdit
            ? "Day Stay contract updated successfully!"
            : "Day Stay contract saved successfully!"
        );
        navigate(`/hotel-actions/${hotelId}/day-stay-contract`);
      }
    } catch (err) {
      toast.error(
        `Failed to save Day Stay contract: ${
          err.response?.data?.message || err.message
        }`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Container fluid>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <Button variant="outline-secondary" onClick={() => navigate(-1)}>
                <FaArrowLeft className="me-2" /> Back
              </Button>
              <h4 className="fw-semibold text-dark mb-0 d-flex align-items-center gap-2">
                {isViewMode ? "View" : isEdit ? "Edit" : "Create"} Day Stay Contract
                <HotelTitleBadge hotelId={hotelId} />
              </h4>
            </div>

            <Card className="shadow-sm border-0 rounded-4 p-4">
              {loading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" />
                </div>
              ) : (
                <fieldset disabled={isViewMode}>
                  {/* Top Form Fields — mirror of Contract Rate */}
                  <Row className="mb-4 g-4">
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label>Season</Form.Label>
                        <Form.Select
                          value={formData.seasonId}
                          isInvalid={!!validationErrors.seasonId}
                          onChange={(e) => {
                            setFormData({ ...formData, seasonId: e.target.value });
                            if (validationErrors.seasonId)
                              setValidationErrors((p) => ({
                                ...p,
                                seasonId: "",
                              }));
                          }}
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
                          onChange={(e) => {
                            setFormData({
                              ...formData,
                              rateCode: e.target.value,
                            });
                            if (validationErrors.rateCode)
                              setValidationErrors((p) => ({
                                ...p,
                                rateCode: "",
                              }));
                          }}
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
                          isDisabled={isViewMode}
                          options={markets.map((m) => ({
                            value: m.marketTypeId,
                            label: m.name,
                          }))}
                          value={formData.marketType}
                          onChange={(sel) => {
                            setFormData({ ...formData, marketType: sel });
                            if (validationErrors.marketType)
                              setValidationErrors((p) => ({
                                ...p,
                                marketType: "",
                              }));
                          }}
                          className={
                            validationErrors.marketType ? "is-invalid" : ""
                          }
                        />
                        {validationErrors.marketType && (
                          <div className="invalid-feedback d-block">
                            {validationErrors.marketType}
                          </div>
                        )}
                      </Form.Group>
                    </Col>
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label>Exclude Nationality</Form.Label>
                        <Select
                          isMulti
                          isDisabled={isViewMode}
                          options={filteredCountries.map((c) => ({
                            value: c.id,
                            label: `${c.name} (${c.marketType})`,
                          }))}
                          value={formData.excludeCountry}
                          onChange={(sel) =>
                            setFormData({ ...formData, excludeCountry: sel })
                          }
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  {/* Day-stay extras: window + markup % + remarks */}
                  <Row className="mb-4 g-4">
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label>Check-In Window — Start *</Form.Label>
                        <Form.Control
                          type="time"
                          value={formData.checkInStartTime}
                          isInvalid={!!validationErrors.checkInStartTime}
                          onChange={(e) => {
                            setFormData({
                              ...formData,
                              checkInStartTime: e.target.value,
                            });
                            if (validationErrors.checkInStartTime)
                              setValidationErrors((p) => ({
                                ...p,
                                checkInStartTime: "",
                              }));
                          }}
                        />
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.checkInStartTime}
                        </Form.Control.Feedback>
                      </Form.Group>
                    </Col>
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label>Check-In Window — End *</Form.Label>
                        <Form.Control
                          type="time"
                          value={formData.checkInEndTime}
                          isInvalid={!!validationErrors.checkInEndTime}
                          onChange={(e) => {
                            setFormData({
                              ...formData,
                              checkInEndTime: e.target.value,
                            });
                            if (validationErrors.checkInEndTime)
                              setValidationErrors((p) => ({
                                ...p,
                                checkInEndTime: "",
                              }));
                          }}
                        />
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.checkInEndTime}
                        </Form.Control.Feedback>
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Remarks</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={1}
                          value={formData.remarks}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              remarks: e.target.value,
                            })
                          }
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  {/* Day Selection */}
                  <Row className="mb-4">
                    <Col md={12}>
                      <Card className="p-3 bg-light border-0 rounded-3">
                        <h6 className="fw-bold text-primary mb-3">
                          Day Selection
                        </h6>
                        <div className="d-flex gap-4">
                          {[
                            { id: "allDays", label: "All Days" },
                            { id: "weekDays", label: "Week Days" },
                            { id: "weekendDays", label: "Weekend Days" },
                          ].map((d) => (
                            <Form.Check
                              key={d.id}
                              type="radio"
                              id={`ds-${d.id}`}
                              name="daySelection"
                              label={d.label}
                              value={d.id}
                              checked={formData.daySelection === d.id}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  daySelection: e.target.value,
                                })
                              }
                            />
                          ))}
                        </div>
                      </Card>
                    </Col>
                  </Row>

                  {/* Validity Periods */}
                  <Card className="p-3 bg-light border-0 mb-4 rounded-3">
                    <div className="d-flex justify-content-between mb-3">
                      <h6 className="fw-bold text-primary mb-0">
                        Validity Periods
                      </h6>
                      <Button
                        size="sm"
                        variant="outline-primary"
                        onClick={addValidity}
                      >
                        <FaPlus className="me-1" /> Add
                      </Button>
                    </div>
                    {formData.validityList.map((v, index) => (
                      <Row key={index} className="align-items-end mb-2">
                        <Col md={4}>
                          <Form.Control
                            type="datetime-local"
                            value={v.validityFrom}
                            isInvalid={
                              !!validationErrors[`validityFrom_${index}`]
                            }
                            onChange={(e) => {
                              const updated = [...formData.validityList];
                              updated[index].validityFrom = e.target.value;
                              if (
                                updated[index].validityTo &&
                                new Date(updated[index].validityTo) <=
                                  new Date(e.target.value)
                              )
                                updated[index].validityTo = "";
                              setFormData({
                                ...formData,
                                validityList: updated,
                              });
                              if (validationErrors[`validityFrom_${index}`])
                                setValidationErrors((p) => ({
                                  ...p,
                                  [`validityFrom_${index}`]: "",
                                }));
                            }}
                          />
                          {validationErrors[`validityFrom_${index}`] && (
                            <Form.Control.Feedback type="invalid">
                              {validationErrors[`validityFrom_${index}`]}
                            </Form.Control.Feedback>
                          )}
                        </Col>
                        <Col md={4}>
                          <Form.Control
                            type="datetime-local"
                            value={v.validityTo}
                            min={getMinValidityToDate(v.validityFrom)}
                            isInvalid={
                              !!validationErrors[`validityTo_${index}`]
                            }
                            onChange={(e) => {
                              const updated = [...formData.validityList];
                              updated[index].validityTo = e.target.value;
                              setFormData({
                                ...formData,
                                validityList: updated,
                              });
                              if (validationErrors[`validityTo_${index}`])
                                setValidationErrors((p) => ({
                                  ...p,
                                  [`validityTo_${index}`]: "",
                                }));
                            }}
                          />
                          {validationErrors[`validityTo_${index}`] && (
                            <Form.Control.Feedback type="invalid">
                              {validationErrors[`validityTo_${index}`]}
                            </Form.Control.Feedback>
                          )}
                        </Col>
                        <Col md="auto">
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => removeValidity(index)}
                          >
                            ✖
                          </Button>
                        </Col>
                      </Row>
                    ))}
                  </Card>

                  {/* Rate matrix */}
                  <Card className="p-3 bg-light border-0 rounded-3">
                    <h6 className="fw-bold mb-3 text-primary">
                      Day Stay Rate Details
                    </h6>
                    {validationErrors.roomRates && (
                      <div className="alert alert-danger mb-3">
                        {validationErrors.roomRates}
                      </div>
                    )}
                    {roomLoading ? (
                      <div className="text-center py-5">
                        <Spinner animation="border" />
                      </div>
                    ) : (
                      hotelRooms.map((room) => (
                        <div
                          key={room.hotelRoomcategoryId}
                          className="border rounded-4 bg-white p-3 mb-4 shadow-sm"
                        >
                          <div className="d-flex justify-content-between align-items-center mb-3">
                            <span className="fw-semibold text-uppercase">
                              {room.roomCategory}
                            </span>
                            <Form.Check
                              label="Is Refundable"
                              checked={
                                formData.roomRates.find(
                                  (r) =>
                                    r.hotelRoomcategoryId ===
                                    String(room.hotelRoomcategoryId)
                                )?.refundable || false
                              }
                              onChange={(e) =>
                                handleRefundableChange(
                                  room.hotelRoomcategoryId,
                                  e.target.checked
                                )
                              }
                            />
                          </div>

                          <Table bordered hover responsive size="sm">
                            <thead className="table-light">
                              <tr>
                                <th>Occupancy</th>
                                <th>Room Type</th>
                                <th>Rate</th>
                                <th>Extra Adult</th>
                                <th>Extra Child</th>
                              </tr>
                            </thead>
                            <tbody>
                              {room.occupancyDetailsDTOs.length > 0 &&
                              room.roomTypeDetailsDTOs.length > 0 ? (
                                room.occupancyDetailsDTOs.map((occ) =>
                                  room.roomTypeDetailsDTOs.map((rt) => (
                                    <tr key={`${occ.id}-${rt.roomTypeId}`}>
                                      <td>{occ.occupanyType}</td>
                                      <td>{rt.roomTypeName}</td>
                                      {["rate", "adultRate", "childRate"].map(
                                        (field) => (
                                          <td key={field}>
                                            <Form.Control
                                              type="number"
                                              min="0"
                                              value={
                                                formData.roomRates.find(
                                                  (r) =>
                                                    r.hotelRoomcategoryId ===
                                                      String(
                                                        room.hotelRoomcategoryId
                                                      ) &&
                                                    r.ocuppancytypeId ===
                                                      String(occ.id) &&
                                                    r.hotelRoomtypeId ===
                                                      String(rt.roomTypeId)
                                                )?.[field] || ""
                                              }
                                              onChange={(e) =>
                                                handleRateChange(
                                                  room.hotelRoomcategoryId,
                                                  occ.id,
                                                  rt.roomTypeId,
                                                  rt.roomTypeName,
                                                  field,
                                                  e.target.value
                                                )
                                              }
                                              onBlur={(e) =>
                                                handleBlur(
                                                  e,
                                                  room.hotelRoomcategoryId,
                                                  occ.occupanyType,
                                                  rt.roomTypeId,
                                                  rt.roomTypeName,
                                                  field,
                                                  e.target.value
                                                )
                                              }
                                            />
                                          </td>
                                        )
                                      )}
                                    </tr>
                                  ))
                                )
                              ) : (
                                <tr>
                                  <td
                                    colSpan="5"
                                    className="text-center text-muted py-3"
                                  >
                                    No room types or occupancy details
                                    available
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </Table>
                        </div>
                      ))
                    )}
                  </Card>

                  <Card className="p-3 bg-light border-0 rounded-3 mt-4">
                    <h6 className="fw-bold mb-3 text-primary">
                      Terms &amp; Conditions
                    </h6>
                    {formData.termsAndConditions.map((row, index) => (
                      <Row key={`day-stay-term-${index}`} className="g-2 mb-2">
                        <Col>
                          <Form.Control
                            as="textarea"
                            rows={2}
                            placeholder={`Term ${index + 1}`}
                            value={row.value}
                            onChange={(e) =>
                              updatePolicyRow(
                                "termsAndConditions",
                                index,
                                e.target.value
                              )
                            }
                          />
                        </Col>
                        <Col md="auto">
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() =>
                              removePolicyRow("termsAndConditions", index)
                            }
                          >
                            Remove
                          </Button>
                        </Col>
                      </Row>
                    ))}
                    <Button
                      variant="outline-primary"
                      size="sm"
                      className="align-self-start"
                      onClick={() => addPolicyRow("termsAndConditions")}
                    >
                      <FaPlus className="me-1" /> Add Term
                    </Button>
                  </Card>

                  <Card className="p-3 bg-light border-0 rounded-3 mt-4">
                    <h6 className="fw-bold mb-3 text-primary">
                      Cancellation Policies
                    </h6>
                    {formData.cancellationPolicies.map((row, index) => (
                      <Row
                        key={`day-stay-cancellation-${index}`}
                        className="g-2 mb-2"
                      >
                        <Col>
                          <Form.Control
                            as="textarea"
                            rows={2}
                            placeholder={`Cancellation policy ${index + 1}`}
                            value={row.value}
                            onChange={(e) =>
                              updatePolicyRow(
                                "cancellationPolicies",
                                index,
                                e.target.value
                              )
                            }
                          />
                        </Col>
                        <Col md="auto">
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() =>
                              removePolicyRow("cancellationPolicies", index)
                            }
                          >
                            Remove
                          </Button>
                        </Col>
                      </Row>
                    ))}
                    <Button
                      variant="outline-primary"
                      size="sm"
                      className="align-self-start"
                      onClick={() => addPolicyRow("cancellationPolicies")}
                    >
                      <FaPlus className="me-1" /> Add Policy
                    </Button>
                  </Card>

                  <div className="d-flex justify-content-between mt-4">
                    <Button
                      variant="outline-danger"
                      onClick={() => navigate(-1)}
                    >
                      {isViewMode ? "Close" : "Cancel"}
                    </Button>
                    {!isViewMode && (
                      <Button
                        variant="success"
                        onClick={handleSaveClick}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <Spinner size="sm" animation="border" />
                        ) : isEdit ? (
                          "Update"
                        ) : (
                          "Save"
                        )}
                      </Button>
                    )}
                  </div>
                </fieldset>
              )}
            </Card>

            <Overlay
              show={showCellConfirm}
              target={confirmTarget}
              placement="top"
              rootClose
              rootCloseEvent="mousedown"
              onHide={() => setShowCellConfirm(false)}
            >
              <Popover id="popover-confirm-rate">
                <Popover.Header
                  as="h6"
                  className="py-1 bg-warning text-dark"
                >
                  Confirm Rate
                </Popover.Header>
                <Popover.Body className="p-2">
                  <div
                    className="mb-2 text-center text-dark"
                    style={{ fontSize: "0.9rem" }}
                  >
                    Verify{" "}
                    {confirmData?.field === "rate"
                      ? "Rate"
                      : confirmData?.field === "adultRate"
                      ? "Extra Adult"
                      : "Extra Child"}{" "}
                    of <strong>{confirmData?.value}</strong> for{" "}
                    {confirmData?.occName} with{" "}
                    <strong>{confirmData?.roomTypeName}</strong>?
                  </div>
                  <div className="d-flex justify-content-center gap-2">
                    <Button
                      size="sm"
                      variant="success"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowCellConfirm(false);
                      }}
                    >
                      Yes
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        const currentRoom = hotelRooms.find(
                          (r) =>
                            r.hotelRoomcategoryId === confirmData.roomId
                        );
                        const currentOcc =
                          currentRoom?.occupancyDetailsDTOs.find(
                            (o) => o.occupanyType === confirmData.occName
                          );
                        handleRateChange(
                          confirmData.roomId,
                          currentOcc?.id || "",
                          confirmData.roomTypeId,
                          confirmData.roomTypeName,
                          confirmData.field,
                          ""
                        );
                        setShowCellConfirm(false);
                      }}
                    >
                      No
                    </Button>
                  </div>
                </Popover.Body>
              </Popover>
            </Overlay>
          </Container>
        </main>
      </div>
    </div>
  );
}
