import React, { useEffect, useState } from "react";
import {
  Container,
  Row,
  Col,
  Form,
  Button,
  Table,
  Card,
  Spinner,
} from "react-bootstrap";
import { FaArrowLeft, FaPlus, FaTrash, FaSave } from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";
import Sidebar from "../../../components/Sidebar";
import Topbar from "../../../components/TopBar";
import axiosInstance from "../../../components/AxiosInstance";
import HotelTitleBadge from "../../../components/HotelTitleBadge";
import { toast } from "react-hot-toast";
import Select from "react-select";


export default function StayPayPromotion() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [loading, setLoading] = useState(false);
  const [hotelRoomsData, setHotelRoomsData] = useState([]);
  const [roomRates, setRoomRates] = useState({});
  const [markets, setMarkets] = useState([]);
  const [countries, setCountries] = useState([]);
  const [filteredCountries, setFilteredCountries] = useState([]);
  const [seasonData, setSeasonData] = useState([]);
  const [validationErrors, setValidationErrors] = useState({});

  // ✅ Helper function to get minimum validity to date (same as from date for datetime)
  const getMinValidityToDate = (fromDate) => {
    if (!fromDate) return "";
    return fromDate;
  };

  // ✅ Validation function - Only basic required fields
  const validateForm = () => {
    const errors = {};

    // Season validation
    if (!formData.season || formData.season === "") {
      errors.season = "Please select a season";
    }

    // Rate Code validation
    if (!formData.rateCode || formData.rateCode.trim() === "") {
      errors.rateCode = "Please enter a rate code";
    }

    // Market Type validation
    if (!formData.marketType || formData.marketType.length === 0) {
      errors.marketType = "Please select at least one market type";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const [formData, setFormData] = useState({
    season: "",
    rateCode: "",
    marketType: [],
    excludeNationality: [],
    isRefundable: false,
    promotionFor: "rooms", // 'rooms' or 'extraBed'
    weekType: "all",
    bookByDate: "",
    bookByPriorDays: "",
    validityList: [{ from: "", to: "" }],
    blackoutDates: [{ from: "", to: "" }],
    stayPayDetails: [],
    remarks: "",
  });

  // ✅ Load hotel room data dynamically (same as Special Rates)
  const loadHotelRoomDatas = async () => {
    try {
      setLoading(true);
      console.log("Loading room data for hotel ID:", id);
      const response = await axiosInstance.get(
        `/api/hotelRoomDetailsController/${id}`
      );
      console.log("Hotel Rooms Data:", response.data);
      console.log("Room data length:", response.data?.length);
      setHotelRoomsData(response.data || []);
      console.log("Hotel rooms data set:", response.data || []);
    } catch (error) {
      console.error("Room fetch error:", error);
      console.error("Error details:", error.response?.data);
      toast.error("Failed to load Hotel Rooms Data");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Handle Stay/Pay table changes with auto-calculation and validation
  const handleStayPayChange = (roomCategory, roomType, field, value) => {
    const baseKey = `${roomCategory.rommCategoryId}_${roomType.roomTypeId}`;

    if (field === "stay") {
      // When Stay changes, just update Stay (no auto-calculation of Free)
      setRoomRates(prev => ({
        ...prev,
        [`${baseKey}_stay`]: value
      }));
    } else if (field === "pay") {
      // When Pay changes, auto-calculate Free
      const currentRates = roomRates;
      const stayValue = currentRates[`${baseKey}_stay`] || 0;
      let payValue = value;

      // Validation: Pay cannot exceed Stay - 1
      if (stayValue > 0) {
        payValue = Math.min(payValue, stayValue - 1);
      }

      const freeValue = Math.max(0, stayValue - payValue);

      setRoomRates(prev => ({
        ...prev,
        [`${baseKey}_pay`]: payValue,
        [`${baseKey}_free`]: freeValue,
      }));
    } else {
      // For free field, just update normally
      setRoomRates(prev => ({
        ...prev,
        [`${baseKey}_${field}`]: value
      }));
    }
  };




  const fetchDropdowns = async () => {
    try {
      const [marketRes, countryRes, seasonRes] = await Promise.all([
        axiosInstance.get("/api/marketType"),
        axiosInstance.get("/api/country"),
        axiosInstance.get("/api/seasonType"),
      ]);

      // Add "All" option with value -1 at the beginning
      const marketsWithAll = [
        { marketTypeId: 100, name: "All" },
        ...(marketRes.data || [])
      ];

      setMarkets(marketsWithAll);
      setCountries(countryRes.data || []);
      setFilteredCountries(countryRes.data || []);
      setSeasonData(seasonRes.data || []);
    } catch {
      toast.error("Failed to load dropdown data");
    }
  };

  useEffect(() => {
    if (!formData.marketType?.length) {
      setFilteredCountries(countries);
    } else {
      const selectedIds = formData.marketType.map((m) => m.value);
      const filtered = countries.filter((c) =>
        selectedIds.includes(c.marketTypeId)
      );
      setFilteredCountries(filtered);
    }
  }, [formData.marketType, countries]);


  useEffect(() => {
    loadHotelRoomDatas();
    fetchDropdowns();
  }, [id]);


  // ✅ Handle validity / blackout date logic
  const handleAddDate = (field) => {
    setFormData({
      ...formData,
      [field]: [...formData[field], { from: "", to: "" }],
    });
  };

  const handleRemoveDate = (field, index) => {
    const updated = [...formData[field]];
    updated.splice(index, 1);
    setFormData({ ...formData, [field]: updated });
  };

  const handleDateChange = (field, index, key, value) => {
    const updated = [...formData[field]];
    updated[index][key] = value;
    setFormData({ ...formData, [field]: updated });
  };



  // ✅ Submit handler
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate form before submission
    if (!validateForm()) {
      return;
    }

    try {
      // Normalise to Spring's `yyyy-MM-dd'T'HH:mm:ss`. `<input type="date">`
      // returns "yyyy-MM-dd" and the old `${date}:00` produced
      // "2026-06-30:00", which the backend rejected because of the
      // missing `T` separator (see the 400 from /api/hotelStaypay/save).
      const formatDate = (date) => {
        if (!date) return "";
        if (date.includes("T")) {
          return date.length === 16 ? `${date}:00` : date;
        }
        return `${date}T00:00:00`;
      };

      const weekDay = formData.weekType === "weekdays" ? 1 : 0;
      const weekEnd = formData.weekType === "weekends" ? 1 : 0;
      const allDays = formData.weekType === "all" ? 1 : 0;

      const validityList = formData.validityList.map((v) => ({
        promo_validity_id: "",
        validityFrom: formatDate(v.from),
        validityTo: formatDate(v.to),
        deleted: 0,
        isType: "V",
      }));

      const blackoutDates = formData.blackoutDates.map((b) => ({
        promo_validity_id: "",
        validityFrom: formatDate(b.from),
        validityTo: formatDate(b.to),
        deleted: 0,
        isType: "B",
      }));

      const payload = {
        marketype: formData.marketType.map((m) => m.value),
        combinedPromo: [],
        promotypeArray: [],
        hotelId: String(id),
        seasonId: String(formData.season),
        staypayId: "",
        rateCode: formData.rateCode.trim(),
        // ========================================
        // EXCLUDE NATIONALITY - CURRENT FORMAT (STRING)
        // ========================================
        excludeCountry: formData.excludeNationality.length > 0
          ? formData.excludeNationality.map((n) => n.value).join(",")
          : "",

        // ========================================
        // EXCLUDE NATIONALITY - FUTURE FORMAT (ARRAY) - COMMENTED OUT
        // ========================================
        // excludeCountrys: formData.excludeNationality.map((n) => n.value),
        weekDay,
        weekEnd,
        allDays,
        refund: formData.isRefundable ? 1 : 0,
        bookDate: formatDate(formData.bookByDate),
        bookDay: String(formData.bookByPriorDays),
        promotionfor: formData.promotionFor === "rooms" ? "1" : "2",
        // StayPay.remark is a VARCHAR(255) — the backend returns
        // 400 "field value is too long (max 255 characters allowed)"
        // if we exceed it. Truncate as a safety net in case the
        // textarea cap below was bypassed.
        remark: (formData.remarks || "").slice(0, 255),
        promotionValidityDTO: [...validityList, ...blackoutDates],
        promotionRoomDTO: hotelRoomsData.flatMap((roomCategory) =>
          roomCategory.roomTypeDetailsDTOs?.map((roomType) => ({
            promo_room_id: "",
            hotelRoomcategoryId: String(roomCategory.rommCategoryId),
            hotelRoomtypeId: String(roomType.roomTypeId),
            noOffree: String(roomRates[`${roomCategory.rommCategoryId}_${roomType.roomTypeId}_free`] || 0),
            noOfpay: String(roomRates[`${roomCategory.rommCategoryId}_${roomType.roomTypeId}_pay`] || 0),
            noOfstay: String(roomRates[`${roomCategory.rommCategoryId}_${roomType.roomTypeId}_stay`] || 0),
          })) || []
        ),
      };

      console.log("Stay Pay payload:", payload);
      console.log("Hotel rooms data being sent:", hotelRoomsData);
      console.log("Form data:", formData);
      console.log("Exclude Nationality form data:", formData.excludeNationality);
      console.log("Exclude Country in payload:", payload.excludeCountry);
      console.log("Exclude Nationality length:", formData.excludeNationality.length);
      console.log("Exclude Country type:", typeof payload.excludeCountry);

      // Try different endpoint patterns
      let response;
      try {
        response = await axiosInstance.post("/api/hotelStaypay/save", payload);
      } catch (firstError) {
        if (firstError.response?.status === 404) {
          // Try alternative endpoint
          console.log("Trying alternative endpoint...");
          response = await axiosInstance.post("/api/hotelStaypay", payload);
        } else {
          throw firstError;
        }
      }

      if (response.data) {
        toast.success("Stay & Pay Promotion Saved Successfully!");
        navigate(`/hotel-actions/${id}/promotions`);
      }
    } catch (error) {
      console.error("Save error:", error);
      if (error.response?.status === 403) {
        toast.error("Access denied. Please check your permissions or contact administrator.");
      } else if (error.response?.status === 400) {
        toast.error("Invalid data. Please check all required fields.");
      } else {
        toast.error("Failed to save Stay & Pay promotion");
      }
    }
  };


  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Container fluid>
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center mb-4">
              <Button
                variant="outline-secondary"
                onClick={() => navigate(-1)}
                className="rounded-pill px-3"
              >
                <FaArrowLeft className="me-2" /> Back
              </Button>
              <h4 className="fw-semibold mb-0 text-dark d-flex align-items-center gap-2">
                Save Stay and Pay Promotion
                <HotelTitleBadge hotelId={id} />
              </h4>
            </div>

            <Card className="p-4 shadow-sm border-0 mb-4 rounded-4">
              {loading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" variant="primary" />
                </div>
              ) : (
                <Form onSubmit={handleSubmit}>
                  {/* ==================== BASIC INFO ==================== */}
                  <Row className="mb-3">
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label>Season *</Form.Label>
                        <Form.Select
                          value={formData.season}
                          onChange={(e) => {
                            setFormData({
                              ...formData,
                              season: e.target.value,
                            });
                            // Clear validation error when user selects
                            if (validationErrors.season) {
                              setValidationErrors({ ...validationErrors, season: "" });
                            }
                          }}
                          isInvalid={!!validationErrors.season}
                        >
                          <option value="">SELECT</option>
                          {seasonData?.map((season) => (
                            <option key={season.seasonTypeId} value={season.seasonTypeId}>
                              {season.season}
                            </option>
                          ))}
                        </Form.Select>
                        {validationErrors.season && (
                          <Form.Control.Feedback type="invalid">
                            {validationErrors.season}
                          </Form.Control.Feedback>
                        )}
                      </Form.Group>
                    </Col>
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label>Rate Code *</Form.Label>
                        <Form.Control
                          value={formData.rateCode}
                          onChange={(e) => {
                            setFormData({
                              ...formData,
                              rateCode: e.target.value,
                            });
                            // Clear validation error when user types
                            if (validationErrors.rateCode) {
                              setValidationErrors({ ...validationErrors, rateCode: "" });
                            }
                          }}
                          placeholder="Enter Rate Code"
                          isInvalid={!!validationErrors.rateCode}
                        />
                        {validationErrors.rateCode && (
                          <Form.Control.Feedback type="invalid">
                            {validationErrors.rateCode}
                          </Form.Control.Feedback>
                        )}
                      </Form.Group>
                    </Col>
                    {/* Market Type */}
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label>Market Type *</Form.Label>
                        <Select
                          isMulti
                          options={markets.map((m) => ({
                            value: m.marketTypeId,
                            label: m.name,
                          }))}
                          value={formData.marketType}
                          onChange={(selected) => {
                            setFormData({ ...formData, marketType: selected });
                            // Clear validation error when user selects
                            if (validationErrors.marketType) {
                              setValidationErrors({ ...validationErrors, marketType: "" });
                            }
                          }}
                          classNamePrefix="react-select"
                          placeholder="Select Market Type"
                          className={validationErrors.marketType ? 'is-invalid' : ''}
                          menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
                          menuPosition="fixed"
                          styles={{
                            control: (base, state) => ({
                              ...base,
                              borderColor: validationErrors.marketType ? '#dc3545' : base.borderColor,
                              boxShadow: validationErrors.marketType ? '0 0 0 0.25rem rgba(220, 53, 69, 0.25)' : base.boxShadow,
                            }),
                            menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                          }}
                        />
                        {validationErrors.marketType && (
                          <div className="invalid-feedback d-block">
                            {validationErrors.marketType}
                          </div>
                        )}
                      </Form.Group>
                    </Col>
                    {/* Exclude Nationality */}
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label>Exclude Nationality</Form.Label>
                        <Select
                          isMulti
                          options={filteredCountries.map((c) => ({
                            value: c.id,
                            label: `${c.name} (${c.marketType})`,
                          }))}
                          value={formData.excludeNationality}
                          onChange={(selected) => {
                            console.log("Exclude Nationality selected:", selected);
                            setFormData({
                              ...formData,
                              excludeNationality: selected,
                            });
                          }}
                          classNamePrefix="react-select"
                          placeholder="Select Countries"
                          menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
                          menuPosition="fixed"
                          styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  {/* ==================== OPTIONS ==================== */}
                  <Row className="align-items-start mb-3 g-3">
                    <Col md={4}>
                      {/* Refundability toggle — replaces the single
                          "Is Refundable" checkbox so the operator has
                          to make an explicit choice. The payload
                          field (`refund`) keeps its 1/0 shape. */}
                      <Form.Label className="d-block fw-semibold">Refundability</Form.Label>
                      <div className="d-flex flex-wrap gap-3">
                        <Form.Check
                          type="radio"
                          inline
                          name="staypayRefundable"
                          id="staypayRefundable-yes"
                          label="Refundable"
                          checked={formData.isRefundable === true}
                          onChange={() =>
                            setFormData({ ...formData, isRefundable: true })
                          }
                        />
                        <Form.Check
                          type="radio"
                          inline
                          name="staypayRefundable"
                          id="staypayRefundable-no"
                          label="Non Refundable"
                          checked={formData.isRefundable === false}
                          onChange={() =>
                            setFormData({ ...formData, isRefundable: false })
                          }
                        />
                      </div>
                    </Col>

                    <Col md={4}>
                      <Form.Label className="d-block fw-semibold">Promotions For *</Form.Label>
                      <div className="d-flex flex-wrap gap-3">
                        <Form.Check
                          type="radio"
                          inline
                          label="Rooms"
                          name="promotionFor"
                          id="staypay-promotionFor-rooms"
                          checked={formData.promotionFor === "rooms"}
                          onChange={() =>
                            setFormData({ ...formData, promotionFor: "rooms" })
                          }
                        />
                        <Form.Check
                          type="radio"
                          inline
                          label="Extra Bed"
                          name="promotionFor"
                          id="staypay-promotionFor-extrabed"
                          checked={formData.promotionFor === "extraBed"}
                          onChange={() =>
                            setFormData({
                              ...formData,
                              promotionFor: "extraBed",
                            })
                          }
                        />
                      </div>
                    </Col>

                    <Col md={4}>
                      <Form.Label className="d-block fw-semibold">Please Select *</Form.Label>
                      <div className="d-flex flex-wrap gap-3">
                        <Form.Check
                          type="radio"
                          inline
                          label="All Days"
                          name="days"
                          id="staypay-days-all"
                          checked={formData.weekType === "all"}
                          onChange={() =>
                            setFormData({ ...formData, weekType: "all" })
                          }
                        />
                        <Form.Check
                          type="radio"
                          inline
                          label="Week Days"
                          name="days"
                          id="staypay-days-weekdays"
                          checked={formData.weekType === "weekdays"}
                          onChange={() =>
                            setFormData({ ...formData, weekType: "weekdays" })
                          }
                        />
                        <Form.Check
                          type="radio"
                          inline
                          label="Week End Days"
                          name="days"
                          id="staypay-days-weekends"
                          checked={formData.weekType === "weekends"}
                          onChange={() =>
                            setFormData({ ...formData, weekType: "weekends" })
                          }
                        />
                      </div>
                    </Col>
                  </Row>

                  <Row className="mb-4 g-3">
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label>Book by Date</Form.Label>
                        <Form.Control
                          type="date"
                          value={formData.bookByDate}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              bookByDate: e.target.value,
                            })
                          }
                        />
                      </Form.Group>
                    </Col>

                    <Col md={3}>
                      <Form.Group>
                        <Form.Label>By Prior Days</Form.Label>
                        <Form.Control
                          type="number"
                          value={formData.bookByPriorDays}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              bookByPriorDays: e.target.value,
                            })
                          }
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  {/* ==================== VALIDITY & BLACKOUT ==================== */}
                  <Row className="mb-4">
                    <Col md={6}>
                      <Card className="p-3 border rounded-3">
                        <div className="d-flex justify-content-between mb-2">
                          <strong>Validity List</strong>
                          <Button
                            size="sm"
                            variant="outline-primary"
                            onClick={() => handleAddDate("validityList")}
                          >
                            <FaPlus /> Add
                          </Button>
                        </div>
                        {formData.validityList.map((v, i) => (
                          <Row key={i} className="align-items-end mb-2">
                            <Col md={5}>
                              <Form.Label className="mb-1 small fw-semibold">
                                FROM
                              </Form.Label>
                              <Form.Control
                                type="datetime-local"
                                size="sm"
                                value={v.from}
                                onChange={(e) => {
                                  const updated = [...formData.validityList];
                                  updated[i].from = e.target.value;
                                  const currentToDate = formData.validityList[i].to;
                                  if (currentToDate && e.target.value && new Date(currentToDate) < new Date(e.target.value)) {
                                    updated[i].to = "";
                                  }
                                  setFormData({
                                    ...formData,
                                    validityList: updated,
                                  });
                                }}
                              />
                            </Col>
                            <Col md={5}>
                              <Form.Label className="mb-1 small fw-semibold">
                                TO
                              </Form.Label>
                              <Form.Control
                                type="datetime-local"
                                size="sm"
                                value={v.to}
                                min={getMinValidityToDate(v.from)}
                                onChange={(e) =>
                                  handleDateChange(
                                    "validityList",
                                    i,
                                    "to",
                                    e.target.value
                                  )
                                }
                              />
                            </Col>
                            <Col md={2} className="text-end">
                              {formData.validityList.length > 1 && (
                                <Button
                                  size="sm"
                                  variant="outline-danger"
                                  onClick={() =>
                                    handleRemoveDate("validityList", i)
                                  }
                                >
                                  <FaTrash />
                                </Button>
                              )}
                            </Col>
                          </Row>
                        ))}
                      </Card>
                    </Col>

                    <Col md={6}>
                      <Card className="p-3 border rounded-3">
                        <div className="d-flex justify-content-between mb-2">
                          <strong>Black Out Dates</strong>
                          <Button
                            size="sm"
                            variant="outline-primary"
                            onClick={() => handleAddDate("blackoutDates")}
                          >
                            <FaPlus /> Add
                          </Button>
                        </div>
                        {formData.blackoutDates.map((b, i) => (
                          <Row key={i} className="align-items-end mb-2">
                            <Col md={5}>
                              <Form.Label className="mb-1 small fw-semibold">
                                FROM
                              </Form.Label>
                              <Form.Control
                                type="datetime-local"
                                size="sm"
                                value={b.from}
                                onChange={(e) => {
                                  const updated = [...formData.blackoutDates];
                                  updated[i].from = e.target.value;
                                  const currentToDate = formData.blackoutDates[i].to;
                                  if (currentToDate && e.target.value && new Date(currentToDate) < new Date(e.target.value)) {
                                    updated[i].to = "";
                                  }
                                  setFormData({
                                    ...formData,
                                    blackoutDates: updated,
                                  });
                                }}
                              />
                            </Col>
                            <Col md={5}>
                              <Form.Label className="mb-1 small fw-semibold">
                                TO
                              </Form.Label>
                              <Form.Control
                                type="datetime-local"
                                size="sm"
                                value={b.to}
                                min={getMinValidityToDate(b.from)}
                                onChange={(e) =>
                                  handleDateChange(
                                    "blackoutDates",
                                    i,
                                    "to",
                                    e.target.value
                                  )
                                }
                              />
                            </Col>
                            <Col md={2} className="text-end">
                              {formData.blackoutDates.length > 1 && (
                                <Button
                                  size="sm"
                                  variant="outline-danger"
                                  onClick={() =>
                                    handleRemoveDate("blackoutDates", i)
                                  }
                                >
                                  <FaTrash />
                                </Button>
                              )}
                            </Col>
                          </Row>
                        ))}
                      </Card>
                    </Col>
                  </Row>

                  {/* ==================== STAY & PAY TABLE ==================== */}
                  {/* ==================== STAY & PAY TABLE ==================== */}
                  <Card className="p-3 border-0 mb-4">
                    <h6 className="fw-bold mb-3 text-primary">Stay and Pay Details</h6>
                    {validationErrors.roomData && (
                      <div className="text-danger small mb-3">
                        {validationErrors.roomData}
                      </div>
                    )}

                    <div className="table-responsive">
                      <Table bordered hover responsive size="sm">
                        <thead className="table-light text-center align-middle">
                          <tr>
                            <th>Room Type</th>
                            <th>Stay</th>
                            <th>Pay </th>
                            <th>Free </th>
                          </tr>
                        </thead>
                        <tbody>
                          {loading ? (
                            <tr>
                              <td colSpan={4} className="text-center py-4">
                                <div className="d-flex align-items-center justify-content-center">
                                  <Spinner animation="border" size="sm" className="me-2" />
                                  Loading rooms...
                                </div>
                              </td>
                            </tr>
                          ) : hotelRoomsData && hotelRoomsData.length > 0 ? (
                            hotelRoomsData.flatMap((roomCategory, categoryIndex) => {
                              return roomCategory.roomTypeDetailsDTOs?.map((roomType, roomTypeIndex) => (
                                <tr key={`${roomCategory.rommCategoryId}-${roomType.roomTypeId}`}>
                                  <td className="fw-semibold">
                                    {roomCategory.roomCategory} - {roomType.roomTypeName}
                                  </td>
                                  <td>
                                    <Form.Control
                                      type="number"
                                      min="0"
                                      max="25"
                                      step="1"
                                      placeholder="0"
                                      value={roomRates[`${roomCategory.rommCategoryId}_${roomType.roomTypeId}_stay`] || 0}
                                      onChange={(e) => {
                                        const value = Math.max(0, Math.min(25, parseInt(e.target.value) || 0));
                                        handleStayPayChange(roomCategory, roomType, "stay", value);
                                      }}
                                      onKeyDown={(e) => {
                                        if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
                                          e.preventDefault();
                                        }
                                      }}
                                    />
                                  </td>
                                  <td>
                                    <Form.Control
                                      type="number"
                                      min="0"
                                      max="25"
                                      step="1"
                                      placeholder="0"
                                      value={roomRates[`${roomCategory.rommCategoryId}_${roomType.roomTypeId}_pay`] || 0}
                                      onChange={(e) => {
                                        const value = Math.max(0, Math.min(25, parseInt(e.target.value) || 0));
                                        handleStayPayChange(roomCategory, roomType, "pay", value);
                                      }}
                                      onKeyDown={(e) => {
                                        if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
                                          e.preventDefault();
                                        }
                                      }}
                                    />
                                  </td>
                                  <td>
                                    <Form.Control
                                      type="number"
                                      min="0"
                                      max="25"
                                      step="1"
                                      placeholder="0"
                                      value={roomRates[`${roomCategory.rommCategoryId}_${roomType.roomTypeId}_free`] || 0}
                                      onChange={(e) => {
                                        const value = Math.max(0, Math.min(25, parseInt(e.target.value) || 0));
                                        handleStayPayChange(roomCategory, roomType, "free", value);
                                      }}
                                      onKeyDown={(e) => {
                                        if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
                                          e.preventDefault();
                                        }
                                      }}
                                    />
                                  </td>
                                </tr>
                              ))
                            })
                          ) : (
                            <tr>
                              <td colSpan={4} className="text-center py-4 text-muted">
                                No rooms found for this hotel. Please check if the hotel has room configurations.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </Table>
                    </div>
                  </Card>


                  {/* ==================== REMARKS + BUTTONS ====================
                      Backend column is VARCHAR(255). Cap the input
                      and surface a counter so the operator can see
                      remaining headroom. */}
                  <Form.Group className="mb-3">
                    <Form.Label>Remarks</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      maxLength={255}
                      value={formData.remarks}
                      onChange={(e) =>
                        setFormData({ ...formData, remarks: e.target.value })
                      }
                    />
                    <Form.Text className="text-muted">
                      {(formData.remarks || "").length} / 255
                    </Form.Text>
                  </Form.Group>

                  <div className="d-flex justify-content-end gap-3 mt-3 pt-3 border-top">
                    <Button
                      variant="outline-danger"
                      className="px-4 rounded-pill"
                      onClick={() => navigate(-1)}
                    >
                      ✖ Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="success"
                      className="px-4 rounded-pill"
                    >
                      <FaSave className="me-2" /> Save Promotion
                    </Button>
                  </div>
                </Form>
              )}
            </Card>
          </Container>
        </main>
      </div>
    </div>
  );
}
