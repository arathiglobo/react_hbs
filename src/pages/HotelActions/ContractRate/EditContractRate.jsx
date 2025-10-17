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
import { FaArrowLeft, FaSave, FaPlus } from "react-icons/fa";
import Select from "react-select";
import Sidebar from "../../../components/Sidebar";
import Topbar from "../../../components/TopBar";
import axiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";

export default function EditContractRate() {
  const navigate = useNavigate();
  const { id, contractRateId } = useParams(); // id = hotelId, contractRateId = contract rate ID

  const [formData, setFormData] = useState({
    seasonId: "",
    rateCode: "",
    marketType: [],
    excludeCountry: [],
    daySelection: "allDays", // "allDays", "weekDays", "weekendDays"
    validityList: [{ validityFrom: "", validityTo: "" }],
    roomRates: [],
  });

  const [markets, setMarkets] = useState([]);
  const [countries, setCountries] = useState([]);
  const [filteredCountries, setFilteredCountries] = useState([]);
  const [hotelRooms, setHotelRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [roomLoading, setRoomLoading] = useState(false);
  const [seasonTypes, setSeasonTypes] = useState([]);
  const [fetchingData, setFetchingData] = useState(true);

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
        setMarkets(marketRes.data || []);
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

  // ✅ Fetch existing contract rate data
  useEffect(() => {
    const fetchContractRateData = async () => {
      if (!contractRateId) return;
      try {
        setFetchingData(true);
        const res = await axiosInstance.get(`/api/hotelContractRate/${contractRateId}`);
        
        if (res.data) {
          const data = res.data;
          
          // Map market types
          const selectedMarkets = data.markeType?.map(market => ({
            value: market.marketTypeId || market.id,
            label: market.name
          })) || [];

          // Map exclude countries
          const selectedCountries = data.excludeCountry?.map(country => ({
            value: country.id,
            label: `${country.name} (${country.marketType || ''})`
          })) || [];

          // Determine day selection
          let daySelection = "allDays";
          if (data.allDays === 1) {
            daySelection = "allDays";
          } else if (data.weekDay === 1) {
            daySelection = "weekDays";
          } else if (data.weekEndDay === 1) {
            daySelection = "weekendDays";
          }

          // Map validity periods
          const validityList = data.contractRateValidityDTO?.map(validity => ({
            validityFrom: validity.validityFrom,
            validityTo: validity.validityTo
          })) || [{ validityFrom: "", validityTo: "" }];

          // Map room rates
          const roomRates = data.contractRateRoomDTO?.map(room => ({
            hotelRoomcategoryId: String(room.hotelRoomcategoryId),
            hotelRoomtypeId: String(room.hotelRoomtypeId),
            ocuppancytypeId: String(room.ocuppancytypeId),
            mealType: room.mealType || "Room Only",
            hotelMealId: room.hotelMealId || 0,
            rate: room.rate || 0,
            adultRate: room.adultRate || 0,
            childRate: room.childRate || 0,
            meal: Boolean(room.meal),
            extraBed: Boolean(room.extraBed),
            isRefundable: Boolean(room.isRefundable),
          })) || [];

          setFormData({
            seasonId: String(data.seasonId || ""),
            rateCode: data.rateCode || "",
            marketType: selectedMarkets,
            excludeCountry: selectedCountries,
            daySelection: daySelection,
            validityList: validityList,
            roomRates: roomRates,
          });

          // Update filtered countries based on selected markets
          if (selectedMarkets.length > 0) {
            const selectedMarketIds = selectedMarkets.map(m => m.value);
            const filtered = countries.filter(c => 
              selectedMarketIds.includes(c.marketTypeId)
            );
            setFilteredCountries(filtered);
          }
        }
      } catch (error) {
        console.error("Error fetching contract rate data:", error);
        toast.error("Failed to load contract rate data");
      } finally {
        setFetchingData(false);
      }
    };
    fetchContractRateData();
  }, [contractRateId, countries]);

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
  useEffect(() => {
    if (formData.marketType.length === 0) setFilteredCountries(countries);
    else {
      const selectedIds = formData.marketType.map((m) => m.value);
      const filtered = countries.filter((c) =>
        selectedIds.includes(c.marketTypeId)
      );
      setFilteredCountries(filtered);
    }
  }, [formData.marketType, countries]);

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
        if (r.hotelRoomcategoryId === String(roomId)) r.isRefundable = checked;
      });
      return { ...prev, roomRates: updatedRates };
    });
  };

  // ✅ Validation
  const validateForm = () => {
    if (!formData.seasonId) return "Please select a season.";
    if (!formData.rateCode.trim()) return "Please enter a rate code.";
    if (!formData.marketType.length)
      return "Please select at least one market type.";
    if (!formData.validityList.length) return "Please add a validity period.";
    for (const v of formData.validityList) {
      if (!v.validityFrom || !v.validityTo)
        return "Please fill both validity dates.";
      if (new Date(v.validityFrom) >= new Date(v.validityTo))
        return "Validity To must be after Validity From.";
    }

    // Validate room rates
    if (formData.roomRates.length === 0) {
      return "Please add at least one room rate.";
    }

    // Check if any room rate has valid data
    const hasValidRates = formData.roomRates.some(
      (rate) => rate.rate > 0 || rate.adultRate > 0 || rate.childRate > 0
    );

    if (!hasValidRates) {
      return "Please enter at least one valid rate (rate, adult rate, or child rate).";
    }

    return null;
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
          isRefundable: false,
        });
      }

      return { ...prev, roomRates: updated };
    });
  };

  // ✅ Update Contract Rate
  const handleUpdate = async () => {
    try {
      const errorMsg = validateForm();
      if (errorMsg) return toast.error(errorMsg);

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
        contractrateId: String(contractRateId),
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
          isRefundable: Boolean(r.isRefundable),
          ocuppancytypeId: Number(r.ocuppancytypeId),
          rate: String(r.rate || "0"),
          extraBed: Boolean(r.extraBed),
          meal: Boolean(r.meal),
          adultRate: String(r.adultRate || "0"),
          childRate: String(r.childRate || "0"),
        })),
      };

      console.log("✅ Day Selection:", formData.daySelection);
      console.log("✅ Day Values - allDays:", allDays, "weekDay:", weekDay, "weekEndDay:", weekEndDay);
      console.log("✅ Update Payload:", JSON.stringify(payload, null, 2));
      console.log("✅ Form Data:", formData);
      console.log("✅ Room Rates:", formData.roomRates);

      const res = await axiosInstance.put(
        `/api/hotelContractRate/${contractRateId}`,
        payload
      );
      console.log("✅ Update Response:", res);

      if (res.status === 200 || res.status === 201) {
        toast.success("Contract Rate updated successfully!");
        navigate(`/hotel-actions/hotel/${id}/contract-rate`);
      }
    } catch (err) {
      console.error("❌ Update Error:", err);
      toast.error(
        `Failed to update contract rate: ${
          err.response?.data?.message || err.message
        }`
      );
    }
  };

  if (fetchingData) {
    return (
      <div className="min-vh-100 bg-light d-flex flex-column">
        <Topbar />
        <div className="d-flex flex-grow-1">
          <Sidebar />
          <main className="flex-grow-1 p-4">
            <div className="d-flex justify-content-center align-items-center" style={{ height: '50vh' }}>
              <Spinner animation="border" variant="primary" />
              <span className="ms-3">Loading contract rate data...</span>
            </div>
          </main>
        </div>
      </div>
    );
  }

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
                Edit Contract Rate
              </h4>
              <Button variant="success" onClick={handleUpdate}>
                <FaSave className="me-1" /> Update
              </Button>
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
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              seasonId: e.target.value,
                            })
                          }
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
                      </Form.Group>
                    </Col>

                    <Col md={3}>
                      <Form.Group>
                        <Form.Label>Rate Code</Form.Label>
                        <Form.Control
                          value={formData.rateCode}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              rateCode: e.target.value,
                            })
                          }
                        />
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
                            onChange={(e) => {
                              const updated = [...formData.validityList];
                              updated[index].validityFrom = e.target.value;
                              setFormData({
                                ...formData,
                                validityList: updated,
                              });
                            }}
                          />
                        </Col>
                        <Col md={4}>
                          <Form.Control
                            type="date"
                            value={v.validityTo}
                            onChange={(e) => {
                              const updated = [...formData.validityList];
                              updated[index].validityTo = e.target.value;
                              setFormData({
                                ...formData,
                                validityList: updated,
                              });
                            }}
                          />
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
                                  (r) => r.hotelRoomcategoryId === String(room.hotelRoomcategoryId)
                                )?.isRefundable || false
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
                    <Button variant="success" onClick={handleUpdate}>
                      Update
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
