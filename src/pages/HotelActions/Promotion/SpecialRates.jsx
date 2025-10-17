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

  // ✅ Fetch room data
  useEffect(() => {
    const fetchRoomRates = async () => {
      try {
        setLoading(true);
        const res = await axiosInstance.get(`/api/hotel/${id}/room-meal-data`);
        const roomData = res.data || [];

        const formatted = roomData.map((room) => ({
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

        setRooms(formatted);
      } catch {
        toast.error("Failed to load room details");
      } finally {
        setLoading(false);
      }
    };
    fetchRoomRates();
  }, [id]);

 useEffect(() => {
  const fetchRoomDetails = async () => {
    try {
      const res = await axiosInstance.get(`/api/hotelRoomDetailsController/${id}`);
      const data = res.data || [];

      const formatted = data.map((room) => ({
        id: room.id,
        roomCategory: room.roomCategory,
        occupancies: room.occupancyDetailsDTOs.map((occ) => ({
          id: occ.id,
          occupancyType: occ.occupanyType,
          rateSingle: 0,
          rateDouble: 0,
          rateExtraAdult: 0,
          rateExtraChild: 0,
        })),
      }));

      setRoomDetails(formatted);
    } catch (error) {
      toast.error("Failed to fetch room contract details");
    }
  };

  if (id) fetchRoomDetails();
}, [id]);
const handleRoomRateChange = (roomIndex, occIndex, field, value) => {
  const updated = [...roomDetails];
  updated[roomIndex].occupancies[occIndex][field] = value;
  setRoomDetails(updated);
};



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

  const handleContractRateChange = (roomIndex, occIndex, value) => {
  const updated = [...roomDetails];
  updated[roomIndex].occupancies[occIndex].rate = value;
  setRoomDetails(updated);
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

      const specialRateRoomDTO = rooms.flatMap((room) =>
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


      const payload = {
        markeType: formData.marketType.map((m) => m.value),
        excludeCountry: formData.excludeNationality.map((c) => c.value),
        hotelId: id,
        seasonId: formData.season,
        specialrateId: "",
        rateCode: formData.rateCode.trim(),
        weekDay,
        weekEnd,
        allDays,
        isRefund: formData.isRefundable,
        bookDate: formatDate(formData.bookByDate),
        bookDay: String(formData.bookByPriorDays),
        lengthStay: String(formData.minimumStay),
        remark: "Special Rate Creation",
        specialRateValidityDTO: [...validityList, ...blackoutDates],
        promotionCompulsoryDTO: [],
        specialRateRoomDTO,
      };

      console.log("Payload:", payload);

      await axiosInstance.post("/api/hotelSpecialRate/save", payload);
      toast.success("Special Rate Saved Successfully!");
      navigate(`/registration/hotel/${id}/promotion`);
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
{roomDetails.length > 0 && (
  <Card className="p-3 mb-4 border shadow-sm rounded-4">
    <h6 className="fw-bold text-primary mb-3">Contract Rate Details</h6>

    {roomDetails.map((room, roomIndex) => (
      <div key={room.id} className="mb-3">
        <h6 className="text-dark mb-2">{room.roomCategory}</h6>
        {room.occupancies.map((occ, occIndex) => (
          <Row key={occ.occupancyId} className="align-items-center mb-2">
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
                  handleContractRateChange(roomIndex, occIndex, e.target.value)
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






// import React, { useEffect, useState } from "react";
// import { useParams, useNavigate } from "react-router-dom";
// import {
//   Container,
//   Table,
//   Button,
//   Modal,
//   Form,
//   Spinner,
//   Badge,
//   Card,
// } from "react-bootstrap";
// import { FaArrowLeft, FaPlus, FaEdit, FaTrash } from "react-icons/fa";
// import axiosInstance from "../../../components/AxiosInstance";
// import { toast } from "react-hot-toast";
// import Sidebar from "../../../components/Sidebar";
// import Topbar from "../../../components/TopBar";

// const Promotion = () => {
//   const { id } = useParams(); // hotelId
//   const navigate = useNavigate();

//   const [promotions, setPromotions] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [showModal, setShowModal] = useState(false);
//   const [searchTerm, setSearchTerm] = useState("");

//   const [formData, setFormData] = useState({
//     type: "", // selected promotion type
//   });

//   // ✅ Fetch all promotions
//   const fetchPromotions = async () => {
//     try {
//       setLoading(true);
//       const res = await axiosInstance.get(`/api/hotelPromotions/${id}`);
//       setPromotions(res.data || []);
//     } catch (error) {
//       console.error("Error fetching promotions:", error);
//       toast.error("Failed to load promotions");
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     if (id) fetchPromotions();
//   }, [id]);

//   // ✅ Create button → open modal
//   const handleCreate = () => {
//     setFormData({ type: "" });
//     setShowModal(true);
//   };

//   // ✅ Delete promotion
//   const handleDelete = async (promo) => {
//     if (!window.confirm("Are you sure you want to delete this promotion?")) return;

//     let endpoint = "";

//     // ✅ Match each working backend endpoint exactly
//     switch (promo.promotionType) {
//       case "Special Rates":
//         endpoint = `/api/hotelSpecialRate/${promo.id}`;
//         break;

//       case "Discount":
//       case "Discount Promotion":
//         endpoint = `/api/discount/${promo.id}`;
//         break;

//       case "StayPay":
//       case "Stay Pay Promotion":
//         endpoint = `/api/hotelStaypay/${promo.id}`;
//         break;

//       default:
//         toast.error("Unknown promotion type");
//         return;
//     }

//     try {
//       console.log("🟢 Deleting:", endpoint);
//       const res = await axiosInstance.delete(endpoint);
//       console.log("✅ Delete success:", res.status);
//       toast.success(`${promo.promotionType} deleted successfully`);
//       fetchPromotions(); // Refresh list after delete
//     } catch (error) {
//       console.error("❌ Delete Error:", error.response || error);
//       if (error?.response?.status === 403) {
//         toast.error("Forbidden: Check backend role permissions");
//       } else {
//         toast.error("Failed to delete promotion");
//       }
//     }
//   };

//   // ✅ Handle navigation for creation
//   const handleGo = () => {
//     if (!formData.type) return toast.error("Please select a promotion type");

//     switch (formData.type) {
//       case "special-rates":
//         navigate(`/registration/hotel/${id}/promotion/special`);
//         break;
//       case "discount-promotion":
//         navigate(`/registration/hotel/${id}/promotion/discount`);
//         break;
//       case "stay-pay-promotion":
//         navigate(`/registration/hotel/${id}/promotion/staypay`);
//         break;
//       default:
//         break;
//     }
//     setShowModal(false);
//   };

//   // ✅ Render Validity Periods
//   const renderValidity = (promo) => {
//     const { discountValidities = [], blackOutValidities = [] } =
//       promo.promotionValidityDTO || {};

//     return (
//       <>
//         {discountValidities.length > 0 ? (
//           <>
//             <strong>Discount:</strong>
//             <ul className="mb-1">
//               {discountValidities.map((v, i) => (
//                 <li key={i}>
//                   {v.validityFrom} → {v.validityTo}
//                 </li>
//               ))}
//             </ul>
//           </>
//         ) : (
//           <span className="text-muted">—</span>
//         )}

//         {blackOutValidities.length > 0 && (
//           <>
//             <strong>Blackout:</strong>
//             <ul>
//               {blackOutValidities.map((b, i) => (
//                 <li key={i}>
//                   {b.blackOutFrom} → {b.blackOutTo}
//                 </li>
//               ))}
//             </ul>
//           </>
//         )}
//       </>
//     );
//   };

//   // ✅ Filter promotions by name
//   const filteredPromotions = promotions.filter((promo) =>
//     promo.promotionName?.toLowerCase().includes(searchTerm.toLowerCase())
//   );

//   return (
//     <div className="min-vh-100 bg-light d-flex flex-column">
//       <Topbar />
//       <div className="d-flex flex-grow-1">
//         <Sidebar />

//         <main className="flex-grow-1 p-4">
//           <Container fluid>
//             <Card className="shadow-sm rounded-xl">
//               <Card.Header className="d-flex justify-content-between align-items-center">
//                 <div className="d-flex align-items-center gap-2">
//                   <Button
//                     variant="link"
//                     className="text-decoration-none text-dark"
//                     onClick={() => navigate(-1)}
//                   >
//                     <FaArrowLeft /> Back
//                   </Button>
//                   <h5 className="fw-semibold mb-0">Promotions</h5>
//                 </div>

//                 {/* Search bar */}
//                 <Form.Group className="position-relative w-25">
//                   <Form.Control
//                     type="text"
//                     placeholder="Search promotion by name..."
//                     value={searchTerm}
//                     onChange={(e) => setSearchTerm(e.target.value)}
//                   />
//                   {searchTerm && (
//                     <button
//                       type="button"
//                       className="btn btn-link position-absolute top-50 end-0 translate-middle-y"
//                       style={{
//                         border: "none",
//                         background: "none",
//                         color: "#6c757d",
//                         padding: "0 12px",
//                       }}
//                       onClick={() => setSearchTerm("")}
//                       title="Clear search"
//                     >
//                       <i className="fas fa-times"></i>
//                     </button>
//                   )}
//                 </Form.Group>

//                 <Button className="btn-green" onClick={handleCreate}>
//                   + Create
//                 </Button>
//               </Card.Header>

//               <Card.Body className="p-0">
//                 {loading ? (
//                   <div className="text-center py-5">
//                     <Spinner animation="border" variant="primary" />
//                   </div>
//                 ) : (
//                   <Table responsive hover striped className="mb-0 align-middle">
//                     <thead className="table-light">
//                       <tr>
//                         <th>#</th>
//                         <th>Type</th>
//                         <th>Name</th>
//                         <th>Validity</th>
//                         <th>Promotion Code</th>
//                         <th>Day Type</th>
//                         <th>Status</th>
//                         <th>Actions</th>
//                       </tr>
//                     </thead>
//                     <tbody>
//                       {filteredPromotions.length > 0 ? (
//                         filteredPromotions.map((promo, index) => (
//                           <tr key={`${promo.id}-${index}`}>
//                             <td>{index + 1}</td>
//                             <td>{promo.promotionType || "—"}</td>
//                             <td>{promo.promotionName || "—"}</td>
//                             <td>{renderValidity(promo)}</td>
//                             <td>{promo.promotionCode || "—"}</td>
//                             <td>{promo.dayType || "—"}</td>
//                             <td>
//                               <Badge bg={promo.status ? "success" : "secondary"}>
//                                 {promo.status ? "Active" : "Inactive"}
//                               </Badge>
//                             </td>
//                             <td>
//                               <div className="d-flex gap-2">
//                                 <FaEdit
//                                   className="text-primary"
//                                   style={{ cursor: "pointer", fontSize: "18px" }}
//                                   onClick={() =>
//                                     navigate(
//                                       `/registration/hotel/${id}/promotion/${promo.id}/edit`
//                                     )
//                                   }
//                                   title="Edit"
//                                 />
//                                 <FaTrash
//                                   className="text-danger"
//                                   style={{ cursor: "pointer", fontSize: "18px" }}
//                                   onClick={() => handleDelete(promo)}
//                                   title="Delete"
//                                 />
//                               </div>
//                             </td>
//                           </tr>
//                         ))
//                       ) : (
//                         <tr>
//                           <td colSpan={8} className="text-center text-muted py-3">
//                             No promotions found
//                           </td>
//                         </tr>
//                       )}
//                     </tbody>
//                   </Table>
//                 )}
//               </Card.Body>
//             </Card>

//             {/* Modal for selecting promotion type */}
//             <Modal show={showModal} onHide={() => setShowModal(false)} centered>
//               <Modal.Header className="bg-primary text-white">
//                 <Modal.Title>Select Promotion Type</Modal.Title>
//               </Modal.Header>

//               <Modal.Body>
//                 <Form>
//                   <Form.Label className="fw-semibold text-danger">
//                     * Choose one:
//                   </Form.Label>
//                   <div className="mt-2">
//                     <Form.Check
//                       type="radio"
//                       id="specialRates"
//                       name="promotionType"
//                       label="Special Rates"
//                       value="special-rates"
//                       checked={formData.type === "special-rates"}
//                       onChange={(e) =>
//                         setFormData({ ...formData, type: e.target.value })
//                       }
//                       className="mb-2"
//                     />
//                     <Form.Check
//                       type="radio"
//                       id="discountPromotion"
//                       name="promotionType"
//                       label="Discount Promotion"
//                       value="discount-promotion"
//                       checked={formData.type === "discount-promotion"}
//                       onChange={(e) =>
//                         setFormData({ ...formData, type: e.target.value })
//                       }
//                       className="mb-2"
//                     />
//                     <Form.Check
//                       type="radio"
//                       id="stayPayPromotion"
//                       name="promotionType"
//                       label="Stay Pay Promotion"
//                       value="stay-pay-promotion"
//                       checked={formData.type === "stay-pay-promotion"}
//                       onChange={(e) =>
//                         setFormData({ ...formData, type: e.target.value })
//                       }
//                     />
//                   </div>
//                 </Form>
//               </Modal.Body>

//               <Modal.Footer className="justify-content-between">
//                 <Button variant="danger" onClick={() => setShowModal(false)}>
//                   ✖ Cancel
//                 </Button>
//                 <Button variant="success" onClick={handleGo}>
//                   Go →
//                 </Button>
//               </Modal.Footer>
//             </Modal>
//           </Container>
//         </main>
//       </div>
//     </div>
//   );
// };

// export default Promotion;