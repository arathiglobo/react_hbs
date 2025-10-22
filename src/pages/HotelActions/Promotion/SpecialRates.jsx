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
} from "react-bootstrap";
import { FaArrowLeft, FaSave, FaPlus, FaTrash } from "react-icons/fa";
import Select from "react-select";
import Sidebar from "../../../components/Sidebar";
import Topbar from "../../../components/TopBar";
import axiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";

const SpecialRates = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  const [loading, setLoading] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [markets, setMarkets] = useState([]);
  const [countries, setCountries] = useState([]);
  const [filteredCountries, setFilteredCountries] = useState([]);
  const [roomDetails, setRoomDetails] = useState([]);
  const [hotelRoomsData, setHotelRoomsData] = useState([]);
  const [roomRates, setRoomRates] = useState({});
  const [hotelPromotions, setHotelPromotions] = useState([]);
  const [seasonData, setSeasonData] = useState([]);

  const [formData, setFormData] = useState({
    season: "",
    rateCode: "",
    marketType: [],
    excludeNationality: [],
    isRefundable: false,
    weekType: "all",
    bookByDate: "",
    bookByPriorDays: "",
    minimumStay: 0,
    validityList: [{ from: "", to: "" }],
    blackoutDates: [{ from: "", to: "" }],
    remarks: "",
    combinedStayPay: "",
    combinedDiscount: "",
  });

  // ✅ Load hotel room data dynamically
  const loadHotelRoomDatas = async () => {
    try {
      const response = await axiosInstance.get(
        `/api/hotelRoomDetailsController/${id}`
      );
      console.log("Hotel Rooms Data:", response.data);
      setHotelRoomsData(response.data || []);
    } catch (error) {
      toast.error("Failed to load Hotel Rooms Data");
    }
  };

  // ✅ Fetch dropdown data

  const fetchDropdowns = async () => {
    try {
      const [marketRes, countryRes] = await Promise.all([
        axiosInstance.get("/api/marketType"),
        axiosInstance.get("/api/country"),
      ]);
      setMarkets(marketRes.data || []);
      setCountries(countryRes.data || []);
      setFilteredCountries(countryRes.data || []);
    } catch {
      toast.error("Failed to load dropdown data");
    }
  };

  // ✅ Filter countries based on selected markets
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

  // ✅ Fetch room data

  const fetchHotelPromotions = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(`api/hotelPromotions/${id}`);
      const hotelPromotionsData = res.data || [];
      setHotelPromotions(hotelPromotionsData);
    } catch {
      toast.error("Failed to load hotelpromotions");
    } finally {
      setLoading(false);
    }
  };

    const seasonList = async () => {
    try {
      setLoading(true);
      const seasonRes = await axiosInstance.get(`api/seasonType`);
      console.log("seasonRes::",seasonRes.data);
      if(seasonRes.data){
         setSeasonData(seasonRes.data);
      }
     
    } catch {
      toast.error("Failed to load seasons");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDropdowns();
    loadHotelRoomDatas();
    fetchHotelPromotions();
    seasonList();
  }, []);

  // ✅ Handlers
  const handleMealRateChange = (roomIndex, mealIndex, field, value) => {
    const updated = [...rooms];
    updated[roomIndex].mealPlans[mealIndex][field] = value;
    setRooms(updated);
  };

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

  // ✅ Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const formatDate = (date) => {
        if (!date) return "";
        const d = new Date(date);
        return `${String(d.getDate()).padStart(2, "0")}-${String(
          d.getMonth() + 1
        ).padStart(2, "0")}-${d.getFullYear()}`;
      };

      const weekDay = formData.weekType === "weekdays" ? 1 : 0;
      const weekEnd = formData.weekType === "weekends" ? 1 : 0;
      const allDays = formData.weekType === "all" ? 1 : 0;

      const validityList = formData.validityList.map((v) => ({
        promoValidityId: "",
        validityFrom: formatDate(v.from),
        validityTo: formatDate(v.to),
        isType: "V",
      }));

      const blackoutDates = formData.blackoutDates.map((b) => ({
        promoValidityId: "",
        validityFrom: formatDate(b.from),
        validityTo: formatDate(b.to),
        isType: "B",
      }));

      // Create special rate room DTO from dynamic hotel rooms data
      const specialRateRoomDTO = hotelRoomsData.flatMap(
        (roomCategory) =>
          roomCategory.roomTypeDetailsDTOs?.flatMap(
            (roomType) =>
              roomCategory.occupancyDetailsDTOs?.map((occupancy) => {
                const rateKey = `${roomCategory.rommCategoryId}_${roomType.roomTypeId}_${occupancy.id}`;
                const rate = roomRates[rateKey] || "0";
                return {
                  hotelRoomcategoryId: String(roomCategory.rommCategoryId),
                  hotelRoomTypeId: String(roomType.roomTypeId),
                  ocuppancyTypeIid: String(occupancy.id),
                  rate: rate,
                  extraBed: false, // Set based on occupancy type if needed
                  meal: false, // This is for room rates, not meal rates
                  adultrate: "",
                  childrate: "",
                };
              }) || []
          ) || []
      );

      // Also include meal plan rates if they exist
      const mealRateDTO = rooms.flatMap((room) =>
        room.mealPlans.map((meal) => ({
          hotelRoomcategoryId: String(room.roomId),
          hotelRoomTypeId: String(room.roomId),
          ocuppancyTypeIid: String(meal.occupancyId),
          rate: meal.single || meal.double || "0",
          extraBed: !!meal.extraAdult || !!meal.extraChild,
          meal: true,
          adultrate: meal.extraAdult || "",
          childrate: meal.extraChild || "",
        }))
      );

      // Combine both room and meal rates
      const allSpecialRateRoomDTO = [...specialRateRoomDTO, ...mealRateDTO];

      const specialratesaveReq = {
        marketype: formData.marketType.map((m) => m.value),
        excludeCountrys: formData.excludeNationality.map((c) => c.value),
        promotypeArray: null,
        hotelId: String(id),
        seasonId: String(formData.season),
        specialrateId: "",
        rateCode: formData.rateCode.trim(),
        weekDay,
        weekEnd,
        allDays,
        isRefund: formData.isRefundable,
        bookDate: formatDate(formData.bookByDate),
        bookDay: String(formData.bookByPriorDays),
        lengthStay: String(formData.minimumStay),
        remark: formData.remarks || "",
        combinedPromoId: formData.combinedStayPay || formData.combinedDiscount || "",
        promotype: formData.combinedStayPay ? "SAP" : formData.combinedDiscount ? "DSR" : "",
        specialRateValidityDTO: [...validityList, ...blackoutDates],
        promotionCompulsoryDTO: [],
        specialRateRoomDTO: allSpecialRateRoomDTO,
      };

      console.log("Payload specialratesaveReq:", specialratesaveReq);
     
      const response = await axiosInstance.post(
        "/api/hotelSpecialRate/save",
        specialratesaveReq
      );

      if (response.data) {
        toast.success("Special Rate Saved Successfully!");
        navigate(`/hotel-actions/${id}/promotions`);
      }
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save special rate");
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
            <div className="d-flex justify-content-between align-items-center mb-4 border-bottom pb-2">
              <Button
                variant="outline-secondary"
                className="rounded-pill px-3"
                onClick={() => navigate(-1)}
              >
                <FaArrowLeft className="me-2" /> Back
              </Button>
              <h4 className="fw-semibold text-dark mb-0">Save Special Rate</h4>
            </div>

            <Card className="shadow-sm border-0 p-4 rounded-4 bg-white">
              {loading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" variant="primary" />
                </div>
              ) : (
                <Form onSubmit={handleSubmit}>
                  {/* ✅ Basic Info */}
                  <Row className="mb-4 g-4">
                    {/* Season */}
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label>Season *</Form.Label>
                        <Form.Select
                          value={formData.season}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              season: e.target.value,
                            })
                          }
                          className="rounded-pill"
                        >
                            <option value="">Select Season</option>
                            {seasonData?.map(
                                       (season) => (
                                         <option key={season.seasonTypeId} value={season.seasonTypeId}>
                                           {season.season}
                                         </option>
                                       )
                                     )}
                        </Form.Select>
                      </Form.Group>
                    </Col>

                    {/* Rate Code */}
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label>Rate Code *</Form.Label>
                        <Form.Control
                          value={formData.rateCode}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              rateCode: e.target.value,
                            })
                          }
                          placeholder="Enter rate code"
                        />
                      </Form.Group>
                    </Col>

                    {/* Market */}
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
                          onChange={(selected) =>
                            setFormData({ ...formData, marketType: selected })
                          }
                          classNamePrefix="react-select"
                          placeholder="Select Market Type"
                        />
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
                          onChange={(selected) =>
                            setFormData({
                              ...formData,
                              excludeNationality: selected,
                            })
                          }
                          classNamePrefix="react-select"
                          placeholder="Select Countries"
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  {/* ✅ Week Type / Refund / Booking Fields */}
                  <Row className="align-items-center mb-4">
                    <Col md={4}>
                      <Form.Label>Day Type:</Form.Label>
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
                          label="Weekdays"
                          name="days"
                          checked={formData.weekType === "weekdays"}
                          onChange={() =>
                            setFormData({ ...formData, weekType: "weekdays" })
                          }
                        />
                        <Form.Check
                          type="radio"
                          label="Weekends"
                          name="days"
                          checked={formData.weekType === "weekends"}
                          onChange={() =>
                            setFormData({ ...formData, weekType: "weekends" })
                          }
                        />
                      </div>
                    </Col>
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
                    <Col md={2}>
                      <Form.Group>
                        <Form.Label>Book By Date</Form.Label>
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
                        <Form.Label>Prior Days</Form.Label>
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
                    <Col md={2}>
                      <Form.Group>
                        <Form.Label>Min Stay</Form.Label>
                        <Form.Control
                          type="number"
                          value={formData.minimumStay}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              minimumStay: e.target.value,
                            })
                          }
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  {/* ✅ Validity & Blackout Sections */}
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
                                type="date"
                                value={v.from}
                                onChange={(e) =>
                                  handleDateChange(
                                    "validityList",
                                    i,
                                    "from",
                                    e.target.value
                                  )
                                }
                              />
                            </Col>
                            <Col>
                              <Form.Control
                                type="date"
                                value={v.to}
                                min={v.from || ""}
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
                          <strong>Blackout Dates</strong>
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
                                type="date"
                                value={b.from}
                                onChange={(e) =>
                                  handleDateChange(
                                    "blackoutDates",
                                    i,
                                    "from",
                                    e.target.value
                                  )
                                }
                              />
                            </Col>
                            <Col>
                              <Form.Control
                                type="date"
                                value={b.to}
                                min={b.from || ""}
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

                  {/* ✅ Room / Meal Rates */}
                  {rooms.map((room, roomIndex) => (
                    <Card
                      key={room.roomId}
                      className="p-3 mb-4 border shadow-sm rounded-4"
                    >
                      <h6 className="fw-bold text-primary mb-3">
                        <Form.Check
                          type="checkbox"
                          defaultChecked
                          label={room.roomName}
                        />
                      </h6>

                      {room.mealPlans.map((meal, mealIndex) => (
                        <Row
                          key={meal.mealPlanId}
                          className="align-items-center py-2 border-bottom"
                        >
                          <Col md={3}>
                            <Form.Label className="text-muted small">
                              {meal.mealName}
                            </Form.Label>
                          </Col>
                          <Col md={2}>
                            <Form.Control
                              type="number"
                              placeholder="Single"
                              value={meal.single}
                              onChange={(e) =>
                                handleMealRateChange(
                                  roomIndex,
                                  mealIndex,
                                  "single",
                                  e.target.value
                                )
                              }
                            />
                          </Col>
                          <Col md={2}>
                            <Form.Control
                              type="number"
                              placeholder="Double"
                              value={meal.double}
                              onChange={(e) =>
                                handleMealRateChange(
                                  roomIndex,
                                  mealIndex,
                                  "double",
                                  e.target.value
                                )
                              }
                            />
                          </Col>
                          <Col md={2}>
                            <Form.Control
                              type="number"
                              placeholder="Extra Adult"
                              value={meal.extraAdult}
                              onChange={(e) =>
                                handleMealRateChange(
                                  roomIndex,
                                  mealIndex,
                                  "extraAdult",
                                  e.target.value
                                )
                              }
                            />
                          </Col>
                          <Col md={2}>
                            <Form.Control
                              type="number"
                              placeholder="Extra Child"
                              value={meal.extraChild}
                              onChange={(e) =>
                                handleMealRateChange(
                                  roomIndex,
                                  mealIndex,
                                  "extraChild",
                                  e.target.value
                                )
                              }
                            />
                          </Col>
                        </Row>
                      ))}
                    </Card>
                  ))}

                  {/* ✅ Contract Rate Details Section */}
                  {hotelRoomsData.length > 0 && (
                    <Card className="p-3 mb-4 border shadow-sm rounded-4">
                      <h6 className="fw-bold text-primary mb-3">
                        Contract Rate Details
                      </h6>

                      {hotelRoomsData.map((roomCategory, roomIndex) => (
                        <Card
                          key={roomCategory.rommCategoryId}
                          className="mb-3 border"
                        >
                          <Card.Header className="bg-light">
                            <Form.Check
                              type="checkbox"
                              id={`room-category-${roomCategory.rommCategoryId}`}
                              label={`${roomCategory.roomCategory?.toUpperCase()}`}
                              defaultChecked
                              className="fw-bold text-primary"
                            />
                          </Card.Header>
                          <Card.Body>
                            {/* Room Types and Occupancy Rates Table */}
                            <div className="table-responsive">
                              <table className="table table-bordered">
                                <thead className="table-light">
                                  <tr>
                                    <th>Room Type</th>
                                    {roomCategory.occupancyDetailsDTOs?.map(
                                      (occupancy) => (
                                        <th key={occupancy.id}>
                                          {occupancy.occupanyType}
                                        </th>
                                      )
                                    )}
                                  </tr>
                                </thead>
                                <tbody>
                                  {roomCategory.roomTypeDetailsDTOs?.map(
                                    (roomType, roomTypeIndex) => (
                                      <tr key={roomType.roomTypeId}>
                                        <td className="fw-semibold">
                                          {roomType.roomTypeName}
                                        </td>
                                        {roomCategory.occupancyDetailsDTOs?.map(
                                          (occupancy, occIndex) => (
                                            <td key={occupancy.id}>
                                              <Form.Control
                                                type="number"
                                                placeholder="0"
                                                value={
                                                  roomRates[
                                                    `${roomCategory.rommCategoryId}_${roomType.roomTypeId}_${occupancy.id}`
                                                  ] || ""
                                                }
                                                onChange={(e) => {
                                                  const key = `${roomCategory.rommCategoryId}_${roomType.roomTypeId}_${occupancy.id}`;
                                                  setRoomRates((prev) => ({
                                                    ...prev,
                                                    [key]: e.target.value,
                                                  }));
                                                }}
                                                size="sm"
                                              />
                                            </td>
                                          )
                                        )}
                                      </tr>
                                    )
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </Card.Body>
                        </Card>
                      ))}
                    </Card>
                  )}

                  {/* ✅ Additional Fields Section */}
                  <Card className="p-3 mb-4 border shadow-sm rounded-4">
                    <h6 className="fw-bold text-primary mb-3">
                      Additional Details
                    </h6>
                    <Row className="g-3">
                      {/* Remarks */}
                      <Col md={6}>
                        <Form.Group>
                          <Form.Label>Remarks</Form.Label>
                          <Form.Control
                            as="textarea"
                            rows={3}
                            placeholder="Enter remarks..."
                            value={formData.remarks || ""}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                remarks: e.target.value,
                              })
                            }
                          />
                        </Form.Group>
                      </Col>

                      {/* Combined with Stay Pay */}
                      <Col md={3}>
                        <Form.Group>
                          <Form.Label>Combined with Stay Pay</Form.Label>
                          <Form.Select
                            value={formData.combinedStayPay || ""}
                            onChange={(e) => {
                              const selectedValue = e.target.value;
                              setFormData({
                                ...formData,
                                combinedStayPay: selectedValue,
                                // Clear the other field when this one is selected
                                combinedDiscount: selectedValue ? "" : formData.combinedDiscount,
                              });
                            }}
                          >
                            <option value="">SELECT</option>
                            {Array.isArray(hotelPromotions) &&
                              hotelPromotions
                                .filter(
                                  (promo) => promo.promotionType === "StayPay"
                                )
                                .map((promo) => (
                                  <option key={promo.id} value={promo.id}>
                                    {promo.promotionCode}
                                  </option>
                                ))}
                          </Form.Select>
                        </Form.Group>
                      </Col>

                      {/* Combined with Discount */}
                      <Col md={3}>
                        <Form.Group>
                          <Form.Label>Combined with Discount</Form.Label>
                          <Form.Select
                            value={formData.combinedDiscount || ""}
                            onChange={(e) => {
                              const selectedValue = e.target.value;
                              setFormData({
                                ...formData,
                                combinedDiscount: selectedValue,
                                // Clear the other field when this one is selected
                                combinedStayPay: selectedValue ? "" : formData.combinedStayPay,
                              });
                            }}
                          >
                            <option value="">SELECT</option>
                            {Array.isArray(hotelPromotions) &&
                              hotelPromotions
                                .filter(
                                  (promo) => promo.promotionType === "Discount"
                                )
                                .map((promo) => (
                                  <option key={promo.id} value={promo.id}>
                                    {promo.promotionCode}
                                  </option>
                                ))}
                          </Form.Select>
                        </Form.Group>
                      </Col>
                    </Row>
                  </Card>

                  {/* ✅ Buttons */}
                  <div className="d-flex justify-content-end gap-3 mt-4 pt-3 border-top">
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
                      <FaSave className="me-2" /> Save Special Rate
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
};

export default SpecialRates;
