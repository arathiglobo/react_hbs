import React, { useState, useEffect } from "react";
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
} from "react-bootstrap";
import { FaArrowLeft, FaPlus } from "react-icons/fa";
import Select from "react-select";
import Sidebar from "../../../components/Sidebar";
import Topbar from "../../../components/TopBar";
import axiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";

export default function CreateContractRate() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [formData, setFormData] = useState({
    seasonId: "",
    rateCode: "",
    marketType: [],
    excludeCountry: [],
    daySelection: "allDays", // "allDays", "weekDays", "weekendDays"
    validityList: [{ validityFrom: "", validityTo: "" }],
    roomRates: [],
    baseRates: [], // New field for base rates per room category
  });

  const [markets, setMarkets] = useState([]);
  const [countries, setCountries] = useState([]);
  const [filteredCountries, setFilteredCountries] = useState([]);
  const [hotelRooms, setHotelRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [roomLoading, setRoomLoading] = useState(false);
  const [seasonTypes, setSeasonTypes] = useState([]);
  const [validationErrors, setValidationErrors] = useState({});

  // ✅ Helper function to get minimum date for Validity To (From date + 1 day)
  const getMinValidityToDate = (fromDate) => {
    if (!fromDate) return "";
    const date = new Date(fromDate);
    date.setDate(date.getDate() + 1);
    return date.toISOString().split("T")[0];
  };

  // ✅ Fetch dropdowns
  useEffect(() => {
    const fetchDropdowns = async () => {
      try {
        setLoading(true);
        const [marketRes, countryRes, seasonTypeRes] = await Promise.all([
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
        setSeasonTypes(seasonTypeRes.data || []);
      } catch {
        toast.error("Failed to load dropdown data");
      } finally {
        setLoading(false);
      }
    };
    fetchDropdowns();
  }, []);

  // ✅ Fetch hotel rooms
  useEffect(() => {
    const fetchHotelRooms = async () => {
      if (!id) return;
      try {
        setRoomLoading(true);
        const res = await axiosInstance.get(
          `/api/hotelRoomDetailsController/${id}`
        );
        if (res.data) {
          const mappedRooms = res.data.map((room) => {
            // Remove duplicate occupancy entries based on id
            const uniqueOccupancy = room.occupancyDetailsDTOs.reduce((acc, current) => {
              const existingIndex = acc.findIndex(item => item.id === current.id && item.occupanyType === current.occupanyType);
              if (existingIndex === -1) {
                acc.push(current);
              }
              return acc;
            }, []);

            return {
              hotelRoomcategoryId: room.rommCategoryId || room.hotelRoomcategoryId,
              roomCategory: room.roomCategory,
              occupancyDetailsDTOs: uniqueOccupancy,
              roomTypeDetailsDTOs: room.roomTypeDetailsDTOs || [],
            };
          });
          setHotelRooms(mappedRooms);
        }
      } catch {
        toast.error("Failed to load hotel room details");
      } finally {
        setRoomLoading(false);
      }
    };
    fetchHotelRooms();
  }, [id]);

  // ✅ Filter countries based on market
  // useEffect(() => {
  //   if (formData.marketType.length === 0) setFilteredCountries(countries);
  //   else {
  //     const selectedIds = formData.marketType.map((m) => m.value);
  //     const filtered = countries.filter((c) =>
  //       selectedIds.includes(c.marketTypeId)
  //     );
  //     setFilteredCountries(filtered);
  //   }
  // }, [formData.marketType, countries]);

  // ✅ Add/remove validity
  const addValidity = () =>
    setFormData({
      ...formData,
      validityList: [
        ...formData.validityList,
        { validityFrom: "", validityTo: "" },
      ],
    });

  const removeValidity = (index) => {
    const updated = formData.validityList.filter((_, i) => i !== index);
    setFormData({ ...formData, validityList: updated });
  };

  // ✅ Handle refundable toggle
  const handleRefundableChange = (roomId, checked) => {
    setFormData((prev) => {
      const updatedRates = [...prev.roomRates];
      updatedRates.forEach((r) => {
        if (r.hotelRoomcategoryId === String(roomId)) r.refundable = checked;
      });
      return { ...prev, roomRates: updatedRates };
    });
  };

  // ✅ Validation
  const validateForm = () => {
    const errors = {};

    if (!formData.seasonId) {
      errors.seasonId = "Please select a season.";
    }

    if (!formData.rateCode.trim()) {
      errors.rateCode = "Please enter a rate code.";
    }

    if (!formData.marketType.length) {
      errors.marketType = "Please select at least one market type.";
    }

    if (!formData.validityList.length) {
      errors.validityList = "Please add a validity period.";
    } else {
      formData.validityList.forEach((v, index) => {
        if (!v.validityFrom || !v.validityTo) {
          errors[`validityFrom_${index}`] = "Please fill both validity dates.";
        } else if (new Date(v.validityFrom) >= new Date(v.validityTo)) {
          errors[`validityTo_${index}`] = "Validity To must be after Validity From.";
        }
      });
    }

    // Validate room rates
    if (formData.roomRates.length === 0) {
      errors.roomRates = "Please add at least one room rate.";
    } else {
      // Check if any room rate has valid data
      const hasValidRates = formData.roomRates.some(
        (rate) => rate.rate > 0 || rate.adultRate > 0 || rate.childRate > 0
      );

      if (!hasValidRates) {
        errors.roomRates = "Please enter at least one valid rate (rate, adult rate, or child rate).";
      }
    }

    return errors;
  };

  // ✅ Handle base rate change
  const handleBaseRateChange = (roomId, value) => {
    setFormData((prev) => {
      const updated = [...prev.baseRates];
      const idx = updated.findIndex(
        (r) => r.hotelRoomcategoryId === String(roomId)
      );

      if (idx !== -1) {
        updated[idx].baseRate = Number(value);
      } else {
        updated.push({
          hotelRoomcategoryId: String(roomId),
          baseRate: Number(value),
        });
      }

      return { ...prev, baseRates: updated };
    });
  };

  // ✅ Handle rate input change
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
        // Update extraBed based on adultRate or childRate
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

  // ✅ Save Contract Rate
  const handleSave = async () => {
    try {
      const errors = validateForm();
      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        return;
      }
      
      setValidationErrors({}); // Clear errors if validation passes

      // Set day values based on radio button selection
      let allDays = 0, weekDay = 0, weekEndDay = 0;
      
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
        markeType: formData.marketType.map((m) => m.value),
        excludeCountry: formData.excludeCountry.map((c) => c.value),
        hotelId: String(id),
        seasonId: String(formData.seasonId),
        contractrateId: "",
        rateCode: formData.rateCode.trim(),
        weekDay: weekDay,
        weekEndDay: weekEndDay,
        allDays: allDays,
        contractRateValidityDTO: formData.validityList.map((v) => ({
          contractValidityId: "",
          validityFrom: v.validityFrom,
          validityTo: v.validityTo,
        })),
        contractRateRoomDTO: formData.roomRates.map((r) => ({
          hotelRoomcategoryId: String(r.hotelRoomcategoryId),
          hotelRoomtypeId: String(r.hotelRoomtypeId),
          refundable: Boolean(r.refundable),
          ocuppancytypeId: Number(r.ocuppancytypeId),
          rate: String(r.rate || "0"),
          extraBed: Boolean(r.extraBed),
          meal: Boolean(r.meal),
          adultRate: String(r.adultRate || "0"),
          childRate: String(r.childRate || "0"),
        })),
        // contractRateBaseDTO: formData.baseRates.map((r) => ({
        //   hotelRoomcategoryId: String(r.hotelRoomcategoryId),
        //   baseRate: String(r.baseRate || "0"),
        // })),
      };

      const res = await axiosInstance.post(
        "/api/hotelContractRate/save",
        payload
      );
      console.log("✅ API Response:", res);

      if (res.status === 200 || res.status === 201) {
        toast.success("Contract Rate saved successfully!");
        navigate(`/hotel-actions/${id}/contract-rate`);
      }
    } catch (err) {
     
      toast.error(
        `Failed to save contract rate: ${
          err.response?.data?.message || err.message
        }`
      );
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
              <h4 className="fw-semibold text-dark mb-0">
                Create Contract Rate
              </h4>
           
            </div>

            <Card className="shadow-sm border-0 rounded-4 p-4">
              {loading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" />
                </div>
              ) : (
                <>
                  {/* ✅ Top Form Fields */}
                  <Row className="mb-4 g-4">
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label>Season</Form.Label>
                        <Form.Select
                          value={formData.seasonId}
                          isInvalid={!!validationErrors.seasonId}
                          onChange={(e) => {
                            setFormData({
                              ...formData,
                              seasonId: e.target.value,
                            });
                            // Clear validation error when user makes selection
                            if (validationErrors.seasonId) {
                              setValidationErrors(prev => ({
                                ...prev,
                                seasonId: ""
                              }));
                            }
                          }}
                        >
                          <option value="">Select Season Type</option>
                          {seasonTypes && seasonTypes.length > 0 && seasonTypes.map((season) => (
                            <option
                              key={season.seasonTypeId}
                              value={season.seasonTypeId}
                            >
                              {season.season}
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
                            // Clear validation error when user starts typing
                            if (validationErrors.rateCode) {
                              setValidationErrors(prev => ({
                                ...prev,
                                rateCode: ""
                              }));
                            }
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
                          options={markets.map((m) => ({
                            value: m.marketTypeId,
                            label: m.name,
                          }))}
                          value={formData.marketType}
                          onChange={(selected) => {
                            setFormData({ ...formData, marketType: selected });
                            // Clear validation error when user makes selection
                            if (validationErrors.marketType) {
                              setValidationErrors(prev => ({
                                ...prev,
                                marketType: ""
                              }));
                            }
                          }}
                          className={validationErrors.marketType ? "is-invalid" : ""}
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
                          options={filteredCountries.map((c) => ({
                            value: c.id,
                            label: `${c.name} (${c.marketType})`,
                          }))}
                          value={formData.excludeCountry}
                          onChange={(selected) =>
                            setFormData({
                              ...formData,
                              excludeCountry: selected,
                            })
                          }
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  {/* ✅ Day Selection Radio Buttons */}
                  <Row className="mb-4">
                    <Col md={12}>
                      <Card className="p-3 bg-light border-0 rounded-3">
                        <h6 className="fw-bold text-primary mb-3">Day Selection</h6>
                        <Form.Group>
                          <div className="d-flex gap-4">
                            <Form.Check
                              type="radio"
                              id="allDays"
                              name="daySelection"
                              label="All Days"
                              value="allDays"
                              checked={formData.daySelection === "allDays"}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  daySelection: e.target.value,
                                })
                              }
                            />
                            <Form.Check
                              type="radio"
                              id="weekDays"
                              name="daySelection"
                              label="Week Days"
                              value="weekDays"
                              checked={formData.daySelection === "weekDays"}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  daySelection: e.target.value,
                                })
                              }
                            />
                            <Form.Check
                              type="radio"
                              id="weekendDays"
                              name="daySelection"
                              label="Weekend Days"
                              value="weekendDays"
                              checked={formData.daySelection === "weekendDays"}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  daySelection: e.target.value,
                                })
                              }
                            />
                          </div>
                        </Form.Group>
                      </Card>
                    </Col>
                  </Row>

                  {/* ✅ Validity Section */}
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
                            type="date"
                            value={v.validityFrom}
                            isInvalid={!!validationErrors[`validityFrom_${index}`]}
                            onChange={(e) => {
                              const updated = [...formData.validityList];
                              updated[index].validityFrom = e.target.value;
                              
                              // Clear Validity To if it becomes invalid (before or equal to From date)
                              const currentToDate = formData.validityList[index].validityTo;
                              if (currentToDate && e.target.value && new Date(currentToDate) <= new Date(e.target.value)) {
                                updated[index].validityTo = "";
                              }
                              
                              setFormData({
                                ...formData,
                                validityList: updated,
                              });
                              
                              // Clear validation error when user makes selection
                              if (validationErrors[`validityFrom_${index}`]) {
                                setValidationErrors(prev => ({
                                  ...prev,
                                  [`validityFrom_${index}`]: ""
                                }));
                              }
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
                            type="date"
                            value={v.validityTo}
                            min={getMinValidityToDate(v.validityFrom)}
                            isInvalid={!!validationErrors[`validityTo_${index}`]}
                            onChange={(e) => {
                              const updated = [...formData.validityList];
                              updated[index].validityTo = e.target.value;
                              setFormData({
                                ...formData,
                                validityList: updated,
                              });
                              
                              // Clear validation error when user makes selection
                              if (validationErrors[`validityTo_${index}`]) {
                                setValidationErrors(prev => ({
                                  ...prev,
                                  [`validityTo_${index}`]: ""
                                }));
                              }
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

                  {/* ✅ Room Rate Section */}
                  <Card className="p-3 bg-light border-0 rounded-3">
                    <h6 className="fw-bold mb-3 text-primary">
                      Contract Rate Details
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
                            <div className="d-flex align-items-center gap-3">
                              {/* <div className="d-flex align-items-center gap-2">
                                <Form.Label className="mb-0 fw-semibold text-primary">
                                  Base Rate:
                                </Form.Label>
                                <Form.Control
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder="0.00"
                                  style={{ width: "120px" }}
                                  value={
                                    formData.baseRates.find(
                                      (r) => r.hotelRoomcategoryId === String(room.hotelRoomcategoryId)
                                    )?.baseRate || ""
                                  }
                                  onChange={(e) =>
                                    handleBaseRateChange(
                                      room.hotelRoomcategoryId,
                                      e.target.value
                                    )
                                  }
                                />
                              </div> */}
                              <Form.Check
                                label="Is Refundable"
                                onChange={(e) =>
                                  handleRefundableChange(
                                    room.hotelRoomcategoryId,
                                    e.target.checked
                                  )
                                }
                              />
                            </div>
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
                              {room.occupancyDetailsDTOs.length > 0 && room.roomTypeDetailsDTOs.length > 0 ? (
                                room.occupancyDetailsDTOs.map((occ) =>
                                  room.roomTypeDetailsDTOs.map((roomType) => (
                                  <tr key={`${occ.id}-${roomType.roomTypeId}`}>
                                    <td>{occ.occupanyType}</td>
                                    <td>{roomType.roomTypeName}</td>
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
                                                    String(roomType.roomTypeId)
                                              )?.[field] || ""
                                            }
                                            onChange={(e) =>
                                              handleRateChange(
                                                room.hotelRoomcategoryId,
                                                occ.id,
                                                roomType.roomTypeId,
                                                roomType.roomTypeName,
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

                  {/* ✅ Footer */}
                  <div className="d-flex justify-content-between mt-4">
                    <Button
                      variant="outline-danger"
                      onClick={() => navigate(-1)}
                    >
                      Cancel
                    </Button>
                    <Button variant="success" onClick={handleSave}>
                      Save
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
