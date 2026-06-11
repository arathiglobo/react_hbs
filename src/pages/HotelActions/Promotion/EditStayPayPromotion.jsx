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
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import Sidebar from "../../../components/Sidebar";
import Topbar from "../../../components/TopBar";
import axiosInstance from "../../../components/AxiosInstance";
import HotelTitleBadge from "../../../components/HotelTitleBadge";
import { toast } from "react-hot-toast";
import Select from "react-select";

export default function EditStayPayPromotion() {
  const navigate = useNavigate();
  const { id, editId } = useParams();

  // View mode — `?mode=view` makes the form read-only. Mirrors the
  // /occupancy-and-minimumlength view pattern.
  const [searchParams] = useSearchParams();
  const isViewMode = searchParams.get("mode") === "view";

  const [loading, setLoading] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [hotelRoomsData, setHotelRoomsData] = useState([]);
  const [roomRates, setRoomRates] = useState({});
  const [markets, setMarkets] = useState([]);
  const [countries, setCountries] = useState([]);
  const [filteredCountries, setFilteredCountries] = useState([]);
  const [seasonData, setSeasonData] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  // ✅ Helper function to get minimum validity to date (From date + 1 minute)
  const getMinValidityToDate = (fromDate) => {
    if (!fromDate) return "";
    const date = new Date(fromDate);
    // Add 1 minute to the from date to ensure validityTo is after validityFrom
    date.setMinutes(date.getMinutes() + 1);
    // Format to YYYY-MM-DDTHH:MM for datetime-local input
    const pad = (num) => num.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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
    promotionFor: "rooms",
    weekType: "all",
    bookByDate: "",
    bookByPriorDays: "",
    validityList: [{ from: "", to: "" }],
    blackoutDates: [{ from: "", to: "" }],
    remarks: "",
  });

  // ✅ Fetch dropdown data
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

  // ✅ Load hotel room data dynamically (same as Special Rates)
  const loadHotelRoomDatas = async () => {
    try {
      const response = await axiosInstance.get(
        `/api/hotelRoomDetailsController/${id}`
      );
      console.log("Hotel Rooms Data:", response.data);
      setHotelRoomsData(response.data || []);
    } catch (error) {
      console.error("Room fetch error:", error);
      toast.error("Failed to load Hotel Rooms Data");
      return [];
    } finally {
      setLoading(false);
    }
  };

  // ✅ Fetch existing promotion
  const fetchPromotion = async () => {
    try {
      setLoading(true);
      console.log("Fetching promotion data for editId:", editId);
      console.log("Hotel rooms data available:", hotelRoomsData.length);
      const res = await axiosInstance.get(`/api/hotelStaypay/${editId}`);
      const data = res.data;
      console.log("Promotion data received:", data);

      // Convert date format for input (YYYY-MM-DDTHH:MM)
      const convertDateForInput = (dateStr) => {
        if (!dateStr) return "";
        if (dateStr.includes("T")) {
          return dateStr.substring(0, 16);
        }
        const parts = dateStr.split("-");
        if (parts.length === 3) {
          return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
        }
        return dateStr;
      };

      // Dates
      const validityList =
        data.promotionValidityDTO?.filter((v) => v.isType === "V")?.map((v) => ({
          from: convertDateForInput(v.validityFrom) || "",
          to: convertDateForInput(v.validityTo) || "",
        })) || [{ from: "", to: "" }];

      const blackoutDates =
        data.promotionValidityDTO?.filter((v) => v.isType === "B")?.map((b) => ({
          from: convertDateForInput(b.validityFrom) || "",
          to: convertDateForInput(b.validityTo) || "",
        })) || [{ from: "", to: "" }];

      // Populate roomRates from promotionRoomDTO (simplified approach)
      console.log("Populating room rates from promotion data");
      console.log("Hotel rooms data:", hotelRoomsData);
      console.log("Promotion room DTO:", data.promotionRoomDTO);

      const initialRoomRates = {};
      data.promotionRoomDTO?.forEach(promoRoom => {
        initialRoomRates[`${promoRoom.hotelRoomcategoryId}_${promoRoom.hotelRoomtypeId}_stay`] = promoRoom.noOfstay;
        initialRoomRates[`${promoRoom.hotelRoomcategoryId}_${promoRoom.hotelRoomtypeId}_pay`] = promoRoom.noOfpay;
        initialRoomRates[`${promoRoom.hotelRoomcategoryId}_${promoRoom.hotelRoomtypeId}_free`] = promoRoom.noOffree;
      });
      setRoomRates(initialRoomRates);
      console.log("Initial room rates set:", initialRoomRates);

      console.log("Setting form data with:");
      console.log("- Season:", data.seasonId);
      console.log("- Rate Code:", data.rateCode);
      console.log("- Market Type:", data.marketype);
      console.log("- Exclude Country:", data.excludeCountry);
      console.log("- Exclude Country Type:", typeof data.excludeCountry);
      console.log("- Exclude Country Value:", data.excludeCountry);
      console.log("- Full API Response:", data);
      console.log("- Refund:", data.refund);
      console.log("- Refund Type:", typeof data.refund);
      console.log("- Refund === 1:", data.refund === 1);
      console.log("- Refund === '1':", data.refund === '1');
      console.log("- Promotion For:", data.promotionfor);
      console.log("- Validity List:", validityList);
      console.log("- Blackout Dates:", blackoutDates);
      console.log("- Markets available:", markets.length);
      console.log("- Countries available:", countries.length);

      setFormData({
        season: String(data.seasonId || ""),
        rateCode: data.rateCode || "",
        marketType: (data.marketype || []).map((m) => ({
          value: m,
          label: markets.find((x) => x.marketTypeId === m)?.name || `Market ${m}`,
        })),
        // ========================================
        // EXCLUDE NATIONALITY - CURRENT FORMAT (STRING)
        // ========================================
        excludeNationality: (() => {
          console.log("Processing exclude nationality:");
          console.log("- Raw data.excludeCountry:", data.excludeCountry);
          console.log("- Split result:", data.excludeCountry ? data.excludeCountry.split(",") : []);
          console.log("- Countries available for mapping:", countries.length);

          const result = (data.excludeCountry ? data.excludeCountry.split(",") : []).map((n) => {
            const country = countries.find((c) => c.id === n);
            console.log(`- Mapping country ID ${n}:`, country);
            return {
              value: n,
              label: country?.name || `Country ${n}`,
            };
          });

          console.log("- Final exclude nationality result:", result);
          return result;
        })(),

        // ========================================
        // EXCLUDE NATIONALITY - FUTURE FORMAT (ARRAY) - COMMENTED OUT
        // ========================================
        // excludeNationality: (data.excludeCountrys || []).map((n) => ({
        //   value: n,
        //   label: countries.find((c) => c.id === n)?.name || `Country ${n}`,
        // })),
        isRefundable: Boolean(data.refund === 1 || data.refund === "1" || data.refund === true),
        promotionFor: data.promotionfor === "1" ? "rooms" : "extraBed",
        weekType:
          data.allDays === 1
            ? "all"
            : data.weekDay === 1
              ? "weekdays"
              : "weekends",
        bookByDate: convertDateForInput(data.bookDate) || "",
        bookByPriorDays: data.bookDay || "",
        validityList,
        blackoutDates,
        remarks: data.remark || "",
      });
    } catch (error) {
      toast.error("Failed to load Stay & Pay promotion");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      await loadHotelRoomDatas();
      await fetchDropdowns();
    };
    loadData();
  }, [id]);

  useEffect(() => {
    if (editId && hotelRoomsData.length > 0 && markets.length > 0 && !dataLoaded) {
      fetchPromotion();
      setDataLoaded(true);
    }
  }, [editId, hotelRoomsData, markets, dataLoaded]);

  // ✅ Re-populate form when markets and countries are loaded
  useEffect(() => {
    const repopulateFormData = async () => {
      if (!editId || !markets.length || !countries.length || dataLoaded) return;

      try {
        console.log("Re-populating form data with markets and countries");
        const res = await axiosInstance.get(`/api/hotelStaypay/${editId}`);
        const data = res.data;

        // Convert date format from DD-MM-YYYY to YYYY-MM-DD for date inputs
        const convertDateForInput = (dateStr) => {
          if (!dateStr) return "";
          const parts = dateStr.split("-");
          if (parts.length === 3) {
            return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
          }
          return dateStr;
        };

        // Dates
        const validityList =
          data.promotionValidityDTO?.filter((v) => v.isType === "V")?.map((v) => ({
            from: convertDateForInput(v.validityFrom) || "",
            to: convertDateForInput(v.validityTo) || "",
          })) || [{ from: "", to: "" }];

        const blackoutDates =
          data.promotionValidityDTO?.filter((v) => v.isType === "B")?.map((b) => ({
            from: convertDateForInput(b.validityFrom) || "",
            to: convertDateForInput(b.validityTo) || "",
          })) || [{ from: "", to: "" }];

        console.log("Re-populating form with proper labels:");
        console.log("- Market Type IDs:", data.marketype);
        console.log("- Exclude Country IDs:", data.excludeCountry);

        setFormData({
          season: String(data.seasonId || ""),
          rateCode: data.rateCode || "",
          marketType: (data.marketype || []).map((m) => ({
            value: m,
            label: markets.find((x) => x.marketTypeId === m)?.name || `Market ${m}`,
          })),
          // ========================================
          // EXCLUDE NATIONALITY - CURRENT FORMAT (STRING)
          // ========================================
          excludeNationality: (data.excludeCountry ? data.excludeCountry.split(",") : []).map((n) => ({
            value: n,
            label: countries.find((c) => c.id === n)?.name || `Country ${n}`,
          })),
          isRefundable: Boolean(data.refund === 1 || data.refund === "1" || data.refund === true),
          promotionFor: data.promotionfor === "1" ? "rooms" : "extraBed",
          weekType:
            data.allDays === 1
              ? "all"
              : data.weekDay === 1
                ? "weekdays"
                : "weekends",
          bookByDate: convertDateForInput(data.bookDate) || "",
          bookByPriorDays: data.bookDay || "",
          validityList,
          blackoutDates,
          remarks: data.remark || "",
        });

        console.log("Form data re-populated successfully");
        console.log("Final isRefundable value:", data.refund === 1);
        console.log("Final isRefundable type:", typeof (data.refund === 1));
        console.log("Final isRefundable with Boolean wrapper:", Boolean(data.refund === 1 || data.refund === "1" || data.refund === true));
      } catch (err) {
        console.error("Error re-populating form data:", err);
      }
    };

    repopulateFormData();
  }, [editId, markets, countries, dataLoaded]);

  // ✅ Re-populate room data when both room data and promotion data are available
  useEffect(() => {
    const repopulateRoomData = async () => {
      if (!editId || !hotelRoomsData.length || dataLoaded) return;

      try {
        console.log("Re-populating room data with promotion values");
        const res = await axiosInstance.get(`/api/hotelStaypay/${editId}`);
        const data = res.data;

        // Convert hotelRoomsData to Stay Pay format and merge with existing data
        const formatted = hotelRoomsData.map((roomCategory) => ({
          roomCategoryId: roomCategory.rommCategoryId,
          roomCategoryName: roomCategory.roomCategory,
          roomTypes: (roomCategory.roomTypeDetailsDTOs || []).map((roomType) => ({
            roomTypeId: roomType.roomTypeId,
            roomTypeName: roomType.roomTypeName,
            occupancies: (roomType.occupancyDetailsDTOs || []).map((occupancy) => {
              const existing = data.promotionRoomDTO?.find(
                (sp) =>
                  sp.hotelRoomcategoryId === roomCategory.rommCategoryId &&
                  sp.hotelRoomtypeId === roomType.roomTypeId
              );
              return {
                occupancyId: occupancy.id,
                occupancyType: occupancy.occupanyType,
                stay: existing?.noOfstay || 0,
                pay: existing?.noOfpay || 0,
                free: existing?.noOffree || 0,
              };
            }),
          })),
        }));

        console.log("Re-populated room data:", formatted);

        // Check for duplicate keys
        const allKeys = [];
        formatted.forEach((roomCategory, categoryIndex) => {
          roomCategory.roomTypes.forEach((roomType, roomTypeIndex) => {
            const key = `${roomCategory.roomCategoryId}-${roomType.roomTypeId}`;
            if (allKeys.includes(key)) {
              console.warn("Duplicate key found:", key, "Category:", roomCategory.roomCategoryName, "Type:", roomType.roomTypeName);
            }
            allKeys.push(key);
          });
        });

        setRooms(formatted);
      } catch (err) {
        console.error("Error re-populating room data:", err);
      }
    };

    repopulateRoomData();
  }, [editId, hotelRoomsData, dataLoaded]);

  // ✅ Filter countries by selected market
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

  // ✅ Date logic
  const handleAddDate = (field) =>
    setFormData({
      ...formData,
      [field]: [...formData[field], { from: "", to: "" }],
    });

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

  // ✅ Submit update
  const handleUpdate = async (e) => {
    e.preventDefault();

    // Validate form before submission
    if (!validateForm()) {
      return;
    }

    try {
      const formatDate = (date) => {
        if (!date) return "";
        return `${date}:00`;
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
        staypayId: String(editId),
        rateCode: formData.rateCode.trim(),
        // ========================================
        // EXCLUDE NATIONALITY - CURRENT FORMAT (STRING)
        // ========================================
        excludeCountry: formData.excludeNationality.map((n) => n.value).join(","),

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
        remark: formData.remarks || "",
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

      console.log("Stay Pay update payload:", payload);

      const response = await axiosInstance.put(`/api/hotelStaypay/${editId}`, payload);

      if (response.data) {
        toast.success("Stay & Pay Promotion Updated Successfully!");
        navigate(`/hotel-actions/${id}/promotions`);
      }
    } catch (error) {
      console.error("Update error:", error);
      toast.error("Failed to update Stay & Pay promotion");
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
              <Button
                variant="outline-secondary"
                onClick={() => navigate(-1)}
                className="rounded-pill px-3"
              >
                <FaArrowLeft className="me-2" /> Back
              </Button>
              <h4 className="fw-semibold mb-0 text-dark d-flex align-items-center gap-2">
                {isViewMode ? "View" : "Edit"} Stay and Pay Promotion
                <HotelTitleBadge hotelId={id} />
              </h4>
            </div>

            <Card className="p-4 shadow-sm border-0 mb-4 rounded-4">
              {loading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" variant="primary" />
                </div>
              ) : (
                <Form onSubmit={handleUpdate}>
                  <fieldset disabled={isViewMode}>
                  {/* BASIC INFO */}
                  <Row className="mb-3">
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label>Season *</Form.Label>
                        <Form.Select
                          value={formData.season}
                          onChange={(e) => {
                            setFormData({ ...formData, season: e.target.value });
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

                    <Col md={3}>
                      <Form.Group>
                        <Form.Label>Market Type *</Form.Label>
                        <Select
                          isMulti
                          isDisabled={isViewMode}
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
                          className={validationErrors.marketType ? 'is-invalid' : ''}
                          styles={{
                            control: (base, state) => ({
                              ...base,
                              borderColor: validationErrors.marketType ? '#dc3545' : base.borderColor,
                              boxShadow: validationErrors.marketType ? '0 0 0 0.25rem rgba(220, 53, 69, 0.25)' : base.boxShadow,
                            })
                          }}
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
                          value={formData.excludeNationality}
                          onChange={(selected) =>
                            setFormData({
                              ...formData,
                              excludeNationality: selected,
                            })
                          }
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  {/* OPTIONS */}
                  <Row className="align-items-center mb-3">
                    <Col md={2}>
                      <Form.Check
                        type="checkbox"
                        label="Is Refundable"
                        checked={formData.isRefundable}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            isRefundable: e.target.checked,
                          })
                        }
                      />
                    </Col>

                    <Col md={4}>
                      <Form.Label>Promotions For *</Form.Label>
                      <div className="d-flex gap-3">
                        <Form.Check
                          type="radio"
                          label="Rooms"
                          name="promotionFor"
                          checked={formData.promotionFor === "rooms"}
                          onChange={() =>
                            setFormData({ ...formData, promotionFor: "rooms" })
                          }
                        />
                        <Form.Check
                          type="radio"
                          label="Extra Bed"
                          name="promotionFor"
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
                      <Form.Label>Please Select *</Form.Label>
                      <div className="d-flex gap-3">
                        <Form.Check
                          type="radio"
                          label="All Days"
                          name="days"
                          checked={formData.weekType === "all"}
                          onChange={() =>
                            setFormData({ ...formData, weekType: "all" })
                          }
                        />
                        <Form.Check
                          type="radio"
                          label="Week Days"
                          name="days"
                          checked={formData.weekType === "weekdays"}
                          onChange={() =>
                            setFormData({ ...formData, weekType: "weekdays" })
                          }
                        />
                        <Form.Check
                          type="radio"
                          label="Week End Days"
                          name="days"
                          checked={formData.weekType === "weekends"}
                          onChange={() =>
                            setFormData({ ...formData, weekType: "weekends" })
                          }
                        />
                      </div>
                    </Col>

                    <Col md={2}>
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

                    <Col md={2}>
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

                  {/* VALIDITY & BLACKOUT DATES */}
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
                          <Row key={i} className="align-items-center mb-2">
                            <Col>
                              <Form.Control
                                type="datetime-local"
                                value={v.from}
                                onChange={(e) => {
                                  const updated = [...formData.validityList];
                                  updated[i].from = e.target.value;
                                  // Clear Validity To if it becomes invalid (before or equal to From date)
                                  const currentToDate = formData.validityList[i].to;
                                  if (currentToDate && e.target.value && new Date(currentToDate) <= new Date(e.target.value)) {
                                    updated[i].to = "";
                                  }
                                  setFormData({
                                    ...formData,
                                    validityList: updated,
                                  });
                                }}
                              />
                            </Col>
                            <Col>
                              <Form.Control
                                type="datetime-local"
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
                            <Col xs="auto">
                              {i > 0 && (
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
                          <Row key={i} className="align-items-center mb-2">
                            <Col>
                              <Form.Control
                                type="datetime-local"
                                value={b.from}
                                onChange={(e) => {
                                  const updated = [...formData.blackoutDates];
                                  updated[i].from = e.target.value;
                                  // Clear Blackout To if it becomes invalid (before or equal to From date)
                                  const currentToDate = formData.blackoutDates[i].to;
                                  if (currentToDate && e.target.value && new Date(currentToDate) <= new Date(e.target.value)) {
                                    updated[i].to = "";
                                  }
                                  setFormData({
                                    ...formData,
                                    blackoutDates: updated,
                                  });
                                }}
                              />
                            </Col>
                            <Col>
                              <Form.Control
                                type="datetime-local"
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
                            <Col xs="auto">
                              {i > 0 && (
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

                  {/* STAY & PAY TABLE */}
                  <Card className="p-3 border-0 mb-4">
                    <h6 className="fw-bold mb-3 text-primary">
                      Stay and Pay Details
                    </h6>
                    <div className="table-responsive">
                      <Table bordered hover responsive size="sm">
                        <thead className="table-light text-center align-middle">
                          <tr>
                            <th>Room Type</th>
                            <th>Stay</th>
                            <th>Pay</th>
                            <th>Free</th>
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
                                      // min="0"
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

                  {/* REMARKS + BUTTONS */}
                  <Form.Group className="mb-3">
                    <Form.Label>Remarks</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      value={formData.remarks}
                      onChange={(e) =>
                        setFormData({ ...formData, remarks: e.target.value })
                      }
                    />
                  </Form.Group>

                  </fieldset>
                  <div className="d-flex justify-content-end gap-3 mt-3 pt-3 border-top">
                    <Button
                      variant="outline-danger"
                      className="px-4 rounded-pill"
                      onClick={() => navigate(-1)}
                    >
                      {isViewMode ? "Close" : "✖ Cancel"}
                    </Button>
                    {!isViewMode && (
                      <Button
                        type="submit"
                        variant="success"
                        className="px-4 rounded-pill"
                      >
                        <FaSave className="me-2" /> Update Promotion
                      </Button>
                    )}
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
