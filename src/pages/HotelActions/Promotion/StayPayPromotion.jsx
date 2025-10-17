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
import { toast } from "react-hot-toast";
import Select from "react-select";


export default function StayPayPromotion() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [loading, setLoading] = useState(false);
  const [rooms, setRooms] = useState([]);
   const [markets, setMarkets] = useState([]);
    const [countries, setCountries] = useState([]);
    const [filteredCountries, setFilteredCountries] = useState([]);

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

  // ✅ Fetch rooms dynamically
 const fetchRooms = async () => {
  try {
    setLoading(true);
    const res = await axiosInstance.get(`/api/hotel/${id}/room-meal-data`);
    const roomList = res.data || [];

    const formatted = roomList.map((room) => ({
      roomId: room.roomId,
      roomName: room.roomName,
      mealPlans: room.mealPlans.map((meal) => ({
        mealPlanId: meal.mealPlanId,
        mealName: meal.mealName,
        stay: 0,
        pay: 0,
        free: 0,
      })),
    }));

    setRooms(formatted);
  } catch (error) {
    toast.error("Failed to load room list");
  } finally {
    setLoading(false);
  }
};




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
  fetchRooms();
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

  // ✅ Handle Stay/Pay table changes
 const handleStayPayChange = (roomIndex, mealIndex, field, value) => {
  const updated = [...rooms];
  updated[roomIndex].mealPlans[mealIndex][field] = value;
  setRooms(updated);
};


  // ✅ Submit handler
 const handleSubmit = async (e) => {
  e.preventDefault();
  try {
    const payload = {
      ...formData,
      hotelId: parseInt(id),
      marketType: formData.marketType.map((m) => m.value),
      excludeNationality: formData.excludeNationality.map((n) => n.value),
      stayPayDTO: rooms.flatMap((room) =>
        room.mealPlans.map((meal) => ({
          hotelRoomId: room.roomId,
          mealPlanId: meal.mealPlanId,
          stay: meal.stay,
          pay: meal.pay,
          free: meal.free,
        }))
      ),
    };

    await axiosInstance.post("/api/staypay/save", payload);
    toast.success("Stay & Pay Promotion Saved Successfully!");
    navigate(`/registration/hotel/${id}/promotion`);
  } catch (error) {
    console.error("Save error:", error);
    toast.error("Failed to save Stay & Pay promotion");
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
              <h4 className="fw-semibold mb-0 text-dark">
                Save Stay and Pay Promotion
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
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              season: e.target.value,
                            })
                          }
                        >
                          <option value="">SELECT</option>
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
                          placeholder="Enter Rate Code"
                        />
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

                  {/* ==================== OPTIONS ==================== */}
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

                  {/* ==================== STAY & PAY TABLE ==================== */}
                  {/* ==================== STAY & PAY TABLE ==================== */}
<Card className="p-3 border-0 mb-4">
  <h6 className="fw-bold mb-3 text-primary">Stay and Pay Details</h6>

  <div className="table-responsive">
    <Table bordered hover responsive size="sm">
      <thead className="table-light text-center align-middle">
        <tr>
          <th>Room Type</th>
          <th>Stay (Nights)</th>
          <th>Pay (Nights)</th>
          <th>Free (Nights)</th>
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
                    min="0"
                    value={meal.stay}
                    onChange={(e) =>
                      handleStayPayChange(
                        roomIndex,
                        mealIndex,
                        "stay",
                        e.target.value
                      )
                    }
                  />
                </td>
                <td>
                  <Form.Control
                    type="number"
                    min="0"
                    value={meal.pay}
                    onChange={(e) =>
                      handleStayPayChange(
                        roomIndex,
                        mealIndex,
                        "pay",
                        e.target.value
                      )
                    }
                  />
                </td>
                <td>
                  <Form.Control
                    type="number"
                    min="0"
                    value={meal.free}
                    onChange={(e) =>
                      handleStayPayChange(
                        roomIndex,
                        mealIndex,
                        "free",
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


                  {/* ==================== REMARKS + BUTTONS ==================== */}
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
