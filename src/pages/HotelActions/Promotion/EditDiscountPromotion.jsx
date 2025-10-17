import React, { useState, useEffect } from "react";
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
import { toast } from "react-hot-toast";
import Select from "react-select";

export default function EditDiscountPromotion() {
  const navigate = useNavigate();
  const { id, promoId } = useParams();

  const [loading, setLoading] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [markets, setMarkets] = useState([]);
  const [countries, setCountries] = useState([]);
  const [filteredCountries, setFilteredCountries] = useState([]);
  const [roomDetails, setRoomDetails] = useState([]);

  const [formData, setFormData] = useState({
    season: "",
    rateCode: "",
    marketType: [],
    excludeNationality: [],
    isRefundable: false,
    weekType: "all",
    discountForRooms: true,
    discountForExtraBed: false,
    bookByDate: "",
    bookByPriorDays: "",
    validityList: [{ from: "", to: "" }],
    blackoutDates: [{ from: "", to: "" }],
    remarks: "",
  });

  // ✅ Fetch dropdowns
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

  // ✅ Fetch Room & Meal Data
  const fetchRooms = async () => {
    try {
      const res = await axiosInstance.get(`/api/hotel/${id}/room-meal-data`);
      const roomData = res.data || [];

      return roomData.map((room) => ({
        roomId: room.roomId,
        roomName: room.roomName,
        mealPlans: room.mealPlans.map((meal) => ({
          mealPlanId: meal.mealPlanId,
          mealName: meal.mealName,
          discountPercent: 0,
          discountValue: 0,
          minStay: 0,
        })),
      }));
    } catch {
      toast.error("Failed to load rooms");
      return [];
    }
  };

  // ✅ Fetch contract rate details
  const fetchRoomDetails = async () => {
    try {
      const res = await axiosInstance.get(`/api/hotelRoomDetailsController/${id}`);
      const data = res.data || [];
      setRoomDetails(
        data.map((room) => ({
          id: room.id,
          roomCategory: room.roomCategory,
          occupancies: room.occupancyDetailsDTOs.map((occ) => ({
            id: occ.id,
            occupancyType: occ.occupanyType,
            rateSingle: occ.rateSingle || 0,
            rateDouble: occ.rateDouble || 0,
            rateExtraAdult: occ.rateExtraAdult || 0,
            rateExtraChild: occ.rateExtraChild || 0,
          })),
        }))
      );
    } catch {
      toast.error("Failed to load contract rate details");
    }
  };

  // ✅ Fetch existing promotion data
  const fetchPromotion = async (roomData) => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(`/api/discount/${promoId}`);
      const data = res.data;

      // ✅ Map validity and blackout
      const validityList =
        data.validityList?.map((v) => ({
          from: v.validityFrom || "",
          to: v.validityTo || "",
        })) || [{ from: "", to: "" }];

      const blackoutDates =
        data.blackoutDates?.map((b) => ({
          from: b.validityFrom || "",
          to: b.validityTo || "",
        })) || [{ from: "", to: "" }];

      // ✅ Map rooms & meals discount
      const updatedRooms = roomData.map((room) => ({
        ...room,
        mealPlans: room.mealPlans.map((meal) => {
          const existing = data.discountRoomDTO?.find(
            (d) =>
              d.hotelRoomId === room.roomId &&
              d.mealPlanId === meal.mealPlanId
          );
          return {
            ...meal,
            discountPercent: existing?.discountPercent || 0,
            discountValue: existing?.discountValue || 0,
            minStay: existing?.minStay || 0,
          };
        }),
      }));

      setRooms(updatedRooms);

      setFormData({
        season: data.seasonId || "",
        rateCode: data.rateCode || "",
        marketType: (data.marketTypeDTOList || []).map((m) => ({
          value: m.marketTypeId,
          label: m.name,
        })),
        excludeNationality: (data.excludeNationalityDTOList || []).map((n) => ({
          value: n.id,
          label: `${n.name} (${n.marketType})`,
        })),
        isRefundable: data.isRefundable || false,
        weekType:
          data.allDays === 1
            ? "all"
            : data.weekDay === 1
            ? "weekdays"
            : "weekends",
        discountForRooms: data.discountForRooms ?? true,
        discountForExtraBed: data.discountForExtraBed ?? false,
        bookByDate: data.bookByDate || "",
        bookByPriorDays: data.bookByPriorDays || "",
        validityList,
        blackoutDates,
        remarks: data.remarks || "",
      });
    } catch (error) {
      toast.error("Failed to load promotion details");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      const [roomData] = await Promise.all([
        fetchRooms(),
        fetchDropdowns(),
        fetchRoomDetails(),
      ]);
      await fetchPromotion(roomData);
    })();
  }, [id, promoId]);

  // ✅ Filter countries by market
  useEffect(() => {
    if (!formData.marketType?.length) {
      setFilteredCountries(countries);
    } else {
      const selectedIds = formData.marketType.map((m) => m.value);
      setFilteredCountries(
        countries.filter((c) => selectedIds.includes(c.marketTypeId))
      );
    }
  }, [formData.marketType, countries]);

  // ✅ Handle date lists
  const handleAddDate = (field) =>
    setFormData({
      ...formData,
      [field]: [...formData[field], { from: "", to: "" }],
    });

  const handleRemoveDate = (field, i) => {
    const updated = [...formData[field]];
    updated.splice(i, 1);
    setFormData({ ...formData, [field]: updated });
  };

  const handleDateChange = (field, i, key, value) => {
    const updated = [...formData[field]];
    updated[i][key] = value;
    setFormData({ ...formData, [field]: updated });
  };

  // ✅ Handle contract rate input change
  const handleContractRateChange = (rIndex, oIndex, field, value) => {
    const updated = [...roomDetails];
    updated[rIndex].occupancies[oIndex][field] = value;
    setRoomDetails(updated);
  };

  // ✅ Submit update
  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        hotelId: parseInt(id),
        marketType: formData.marketType.map((m) => m.value),
        excludeNationality: formData.excludeNationality.map((n) => n.value),
        discountRoomDTO: rooms.flatMap((room) =>
          room.mealPlans.map((meal) => ({
            hotelRoomId: room.roomId,
            mealPlanId: meal.mealPlanId,
            discountPercent: meal.discountPercent,
            discountValue: meal.discountValue,
            minStay: meal.minStay,
          }))
        ),
      };

      await axiosInstance.put(`/api/discount/update/${promoId}`, payload);
      toast.success("Discount Promotion Updated Successfully!");
      navigate(`/registration/hotel/${id}/promotion`);
    } catch (error) {
      console.error("Update error:", error);
      toast.error("Failed to update discount promotion");
    }
  };

  // ✅ UI rendering
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
              <h4 className="fw-semibold mb-0 text-dark">
                Edit Discount Promotion
              </h4>
            </div>

            <Card className="p-4 shadow-sm border-0 mb-4 rounded-4">
              {loading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" variant="primary" />
                </div>
              ) : (
                <Form onSubmit={handleUpdate}>
                  {/* ================= BASIC INFO ================= */}
                  <Row className="mb-4 g-3">
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
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  {/* ================= VALIDITY ================= */}
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
                                  handleDateChange("validityList", i, "from", e.target.value)
                                }
                              />
                            </Col>
                            <Col>
                              <Form.Control
                                type="date"
                                value={v.to}
                                onChange={(e) =>
                                  handleDateChange("validityList", i, "to", e.target.value)
                                }
                              />
                            </Col>
                            <Col xs="auto">
                              {i > 0 && (
                                <Button
                                  size="sm"
                                  variant="outline-danger"
                                  onClick={() => handleRemoveDate("validityList", i)}
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
                                  handleDateChange("blackoutDates", i, "from", e.target.value)
                                }
                              />
                            </Col>
                            <Col>
                              <Form.Control
                                type="date"
                                value={b.to}
                                onChange={(e) =>
                                  handleDateChange("blackoutDates", i, "to", e.target.value)
                                }
                              />
                            </Col>
                            <Col xs="auto">
                              {i > 0 && (
                                <Button
                                  size="sm"
                                  variant="outline-danger"
                                  onClick={() => handleRemoveDate("blackoutDates", i)}
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

                  {/* ================= DISCOUNT TABLE ================= */}
                  <Card className="p-3 border-0 mb-4">
                    <h6 className="fw-bold mb-3 text-primary">DISCOUNT DETAILS</h6>
                    <div className="table-responsive">
                      <Table bordered hover size="sm">
                        <thead className="table-light text-center align-middle">
                          <tr>
                            <th>Room Type</th>
                            <th>Discount (%)</th>
                            <th>Discount (Value)</th>
                            <th>Min Stay</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rooms.map((room, roomIndex) => (
                            <React.Fragment key={room.roomId}>
                              <tr className="bg-light fw-bold text-primary">
                                <td colSpan={4}>{room.roomName}</td>
                              </tr>
                              {room.mealPlans.map((meal, mealIndex) => (
                                <tr key={meal.mealPlanId}>
                                  <td className="ps-4">{meal.mealName}</td>
                                  <td>
                                    <Form.Control
                                      type="number"
                                      value={meal.discountPercent}
                                      onChange={(e) => {
                                        const updated = [...rooms];
                                        updated[roomIndex].mealPlans[mealIndex].discountPercent =
                                          e.target.value;
                                        setRooms(updated);
                                      }}
                                    />
                                  </td>
                                  <td>
                                    <Form.Control
                                      type="number"
                                      value={meal.discountValue}
                                      onChange={(e) => {
                                        const updated = [...rooms];
                                        updated[roomIndex].mealPlans[mealIndex].discountValue =
                                          e.target.value;
                                        setRooms(updated);
                                      }}
                                    />
                                  </td>
                                  <td>
                                    <Form.Control
                                      type="number"
                                      value={meal.minStay}
                                      onChange={(e) => {
                                        const updated = [...rooms];
                                        updated[roomIndex].mealPlans[mealIndex].minStay =
                                          e.target.value;
                                        setRooms(updated);
                                      }}
                                    />
                                  </td>
                                </tr>
                              ))}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                  </Card>

                  {/* ================= CONTRACT RATE BOX ================= */}
                  <Card className="p-3 border-0 mb-4">
                    <h6 className="fw-bold mb-3 text-primary">CONTRACT RATE DETAILS</h6>
                    <div className="table-responsive">
                      <Table bordered hover size="sm">
                        <thead className="table-light text-center align-middle">
                          <tr>
                            <th>Room Category</th>
                            <th>Occupancy Type</th>
                            <th>Rate (Single)</th>
                            <th>Rate (Double)</th>
                            <th>Extra Adult</th>
                            <th>Extra Child</th>
                          </tr>
                        </thead>
                        <tbody>
                          {roomDetails.map((room, rIndex) => (
                            <React.Fragment key={room.id}>
                              <tr className="bg-light fw-bold text-primary">
                                <td colSpan={6}>{room.roomCategory}</td>
                              </tr>
                              {room.occupancies.map((occ, oIndex) => (
                                <tr key={occ.id}>
                                  <td></td>
                                  <td>{occ.occupancyType}</td>
                                  <td>
                                    <Form.Control
                                      type="number"
                                      value={occ.rateSingle}
                                      onChange={(e) =>
                                        handleContractRateChange(
                                          rIndex,
                                          oIndex,
                                          "rateSingle",
                                          e.target.value
                                        )
                                      }
                                    />
                                  </td>
                                  <td>
                                    <Form.Control
                                      type="number"
                                      value={occ.rateDouble}
                                      onChange={(e) =>
                                        handleContractRateChange(
                                          rIndex,
                                          oIndex,
                                          "rateDouble",
                                          e.target.value
                                        )
                                      }
                                    />
                                  </td>
                                  <td>
                                    <Form.Control
                                      type="number"
                                      value={occ.rateExtraAdult}
                                      onChange={(e) =>
                                        handleContractRateChange(
                                          rIndex,
                                          oIndex,
                                          "rateExtraAdult",
                                          e.target.value
                                        )
                                      }
                                    />
                                  </td>
                                  <td>
                                    <Form.Control
                                      type="number"
                                      value={occ.rateExtraChild}
                                      onChange={(e) =>
                                        handleContractRateChange(
                                          rIndex,
                                          oIndex,
                                          "rateExtraChild",
                                          e.target.value
                                        )
                                      }
                                    />
                                  </td>
                                </tr>
                              ))}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                  </Card>

                  {/* ================= REMARKS + BUTTONS ================= */}
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
                      <FaSave className="me-2" /> Update Promotion
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

