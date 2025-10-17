import React, { useEffect, useState } from "react";
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

export default function EditSpecialRates() {
  const navigate = useNavigate();
  const { id, rateId } = useParams();

  const [loading, setLoading] = useState(false);
  const [markets, setMarkets] = useState([]);
  const [countries, setCountries] = useState([]);
  const [filteredCountries, setFilteredCountries] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [roomDetails, setRoomDetails] = useState([]);

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
  });

  // ✅ Fetch dropdown data
  useEffect(() => {
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
    fetchDropdowns();
  }, []);

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

  // ✅ Fetch Special Rate + Room + Contract Details
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const [specialRateRes, roomMealRes, roomDetailsRes] = await Promise.all([
          axiosInstance.get(`/api/hotelSpecialRate/${rateId}`),
          axiosInstance.get(`/api/hotel/${id}/room-meal-data`),
          axiosInstance.get(`/api/hotelRoomDetailsController/${id}`),
        ]);

        const specialData = specialRateRes.data;
        const roomData = roomMealRes.data || [];
        const roomDetailsData = roomDetailsRes.data || [];

        // 🟢 Rooms + Meal Plans
        const formattedRooms = roomData.map((room) => ({
          roomId: room.roomId,
          roomName: room.roomName,
          mealPlans: room.mealPlans.map((meal) => ({
            mealPlanId: meal.mealPlanId,
            mealName: meal.mealName,
            single: "",
            double: "",
            extraAdult: "",
            extraChild: "",
          })),
        }));

        // 🟢 Contract Rates
        const formattedRoomDetails = roomDetailsData.map((room) => ({
          id: room.id,
          roomCategory: room.roomCategory,
          occupancies: room.occupancyDetailsDTOs.map((occ) => ({
            id: occ.id,
            occupancyType: occ.occupanyType,
            rate: 0,
          })),
        }));

        setRooms(formattedRooms);
        setRoomDetails(formattedRoomDetails);

        // 🟢 Prefill Form Data
        setFormData({
          season: specialData.seasonId || "",
          rateCode: specialData.rateCode || "",
          marketType:
            specialData.marketype?.map((m) => ({
              value: m,
              label:
                markets.find((x) => x.marketTypeId === m)?.name || `Market ${m}`,
            })) || [],
          excludeNationality:
            specialData.excludeCountrys?.map((id) => ({
              value: id,
              label:
                countries.find((c) => c.id === id)?.name || `Country ${id}`,
            })) || [],
          isRefundable: specialData.isRefund || false,
          weekType:
            specialData.allDays === 1
              ? "all"
              : specialData.weekDay === 1
              ? "weekdays"
              : "weekends",
          bookByDate: specialData.bookDate || "",
          bookByPriorDays: specialData.bookDay || "",
          minimumStay: specialData.lengthStay || 0,
          validityList:
            specialData.specialRateValidityDTO
              ?.filter((v) => v.isType === "V")
              ?.map((v) => ({
                from: v.validityFrom || "",
                to: v.validityTo || "",
              })) || [{ from: "", to: "" }],
          blackoutDates:
            specialData.specialRateValidityDTO
              ?.filter((v) => v.isType === "B")
              ?.map((b) => ({
                from: b.validityFrom || "",
                to: b.validityTo || "",
              })) || [{ from: "", to: "" }],
        });
      } catch (err) {
        console.error(err);
        toast.error("Failed to load special rate details");
      } finally {
        setLoading(false);
      }
    };

    if (id && rateId) fetchData();
  }, [id, rateId, markets, countries]);

  // ✅ Handlers
  const handleMealRateChange = (roomIndex, mealIndex, field, value) => {
    const updated = [...rooms];
    updated[roomIndex].mealPlans[mealIndex][field] = value;
    setRooms(updated);
  };

  const handleContractRateChange = (roomIndex, occIndex, value) => {
    const updated = [...roomDetails];
    updated[roomIndex].occupancies[occIndex].rate = value;
    setRoomDetails(updated);
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

  // ✅ Update Special Rate
  const handleUpdate = async (e) => {
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

      const specialRateRoomDTO = rooms.flatMap((room) =>
        room.mealPlans.map((meal) => ({
          hotelRoomcategoryId: String(room.roomId),
          hotelRoomTypeId: String(room.roomId),
          ocuppancyTypeIid: "15",
          rate: meal.single || meal.double || "0",
          extraBed: !!meal.extraAdult || !!meal.extraChild,
          meal: true,
          adultrate: meal.extraAdult || "",
          childrate: meal.extraChild || "",
        }))
      );

      const payload = {
        markeType: formData.marketType.map((m) => m.value),
        excludeCountry: formData.excludeNationality.map((c) => c.value),
        hotelId: id,
        specialrateId: rateId,
        seasonId: formData.season,
        rateCode: formData.rateCode.trim(),
        weekDay,
        weekEnd,
        allDays,
        isRefund: formData.isRefundable,
        bookDate: formatDate(formData.bookByDate),
        bookDay: String(formData.bookByPriorDays),
        lengthStay: String(formData.minimumStay),
        remark: "Special Rate Updated",
        specialRateValidityDTO: [...validityList, ...blackoutDates],
        promotionCompulsoryDTO: [],
        specialRateRoomDTO,
      };

      console.log("🟢 Update Payload:", payload);

      await axiosInstance.put(`/api/hotelSpecialRate/update/${rateId}`, payload);
      toast.success("Special Rate updated successfully!");
      navigate(`/registration/hotel/${id}/promotion`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update special rate");
    }
  };

  // ✅ UI Rendering
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
              <h4 className="fw-semibold text-dark mb-0">Edit Special Rate</h4>
            </div>

            <Card className="shadow-sm border-0 p-4 rounded-4 bg-white">
              {loading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" variant="primary" />
                </div>
              ) : (
                <Form onSubmit={handleUpdate}>
                  {/* ✅ IDENTICAL UI CONTENT FROM CREATE PAGE STARTS HERE */}

                  {/* Season / Rate / Market / Exclude */}
                  <Row className="mb-4 g-4">
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
                          <option value="1">Peak</option>
                          <option value="2">Mid</option>
                          <option value="3">Low</option>
                          <option value="4">High</option>
                          <option value="5">Shoulder</option>
                          <option value="6">High High</option>
                          <option value="7">Festive</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>

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

                  {/* ✅ Week Type / Refund / Booking */}
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

                  {/* ✅ Validity & Blackout */}
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

                  {/* ✅ Contract Rate Section */}
                 {/* ✅ Contract Rate Section */}
{roomDetails.length > 0 && (
  <Card className="p-3 mb-4 border shadow-sm rounded-4">
    <h6 className="fw-bold text-primary mb-3">Contract Rate Details</h6>

    {roomDetails.map((room, roomIndex) => (
      <div key={room.id} className="mb-3">
        <h6 className="text-dark mb-2">{room.roomCategory}</h6>

        {room.occupancies.map((occ, occIndex) => (
          <Row key={occ.id} className="align-items-center mb-2">
            <Col md={3}>
              <Form.Label className="text-muted small">
                {occ.occupancyType}
              </Form.Label>
            </Col>

            <Col md={3}>
              <Form.Control
                type="number"
                placeholder="Enter rate"
                value={occ.rate}
                onChange={(e) =>
                  handleContractRateChange(
                    roomIndex,
                    occIndex,
                    e.target.value
                  )
                }
              />
            </Col>
          </Row>
        ))}
      </div>
    ))}
  </Card>
)}


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
                      <FaSave className="me-2" /> Update Special Rate
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
