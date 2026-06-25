import React, { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  Container,
  Row,
  Col,
  Form,
  Button,
  Table,
  Card,
  Spinner,
  Overlay,
  Popover,
} from "react-bootstrap";
import { FaArrowLeft, FaSave } from "react-icons/fa";
import Sidebar from "../../../components/Sidebar";
import Topbar from "../../../components/TopBar";
import HotelTitleBadge from "../../../components/HotelTitleBadge";
import axiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";

export default function CopyContractRate() {
  const navigate = useNavigate();
  const { id, rateId } = useParams();
  // Reused under /hotel-actions (admin) and /extranet (hotel login).
  const { pathname } = useLocation();
  const isExtranet = pathname.startsWith("/extranet");

  const [formData, setFormData] = useState({
    seasonId: "",
    rateCode: "",
    marketType: [],
    excludeCountry: [],
    validityList: [{ validityFrom: "", validityTo: "" }],
    roomRates: [],
  });

  const [markets, setMarkets] = useState([]);
  const [countries, setCountries] = useState([]);
  const [hotelRooms, setHotelRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [roomLoading, setRoomLoading] = useState(false);

  // Cell confirmation popup state
  const [showCellConfirm, setShowCellConfirm] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [confirmData, setConfirmData] = useState(null);

  // ✅ Helper function to get minimum date for Validity To (From date + 1 day)
  const getMinValidityToDate = (fromDate) => {
    if (!fromDate) return "";
    const date = new Date(fromDate);
    date.setDate(date.getDate() + 1);
    return date.toISOString().split("T")[0];
  };

  // ✅ Fetch Market & Country Data
  useEffect(() => {
    const fetchDropdowns = async () => {
      try {
        const [marketRes, countryRes] = await Promise.all([
          axiosInstance.get("/api/marketType"),
          axiosInstance.get("/api/country"),
        ]);

          // Add "All" option with value -1 at the beginning
        const marketsWithAll = [
          { marketTypeId: 100, name: "All" },
          ...(marketRes.data || [])
        ];
        setMarkets(marketsWithAll);
        setCountries(countryRes.data || []);
      } catch {
        toast.error("Failed to load dropdown data");
      }
    };
    fetchDropdowns();
  }, []);

  // ✅ Fetch Room Details
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        setRoomLoading(true);
        const res = await axiosInstance.get(`/api/hotelRoomDetailsController/${id}`);
        setHotelRooms(
          (res.data || []).map((r) => ({
            ...r,
            hotelRoomcategoryId: String(r.rommCategoryId || r.hotelRoomcategoryId),
          }))
        );
      } catch {
        toast.error("Failed to load hotel room details");
      } finally {
        setRoomLoading(false);
      }
    };
    if (id) fetchRooms();
  }, [id]);

  // ✅ Fetch Contract Rate (after markets, countries, and rooms are loaded)
  useEffect(() => {
    const fetchContractRate = async () => {
      try {
        setLoading(true);
        const res = await axiosInstance.get(`/api/hotelContractRate/${rateId}`);
        const data = res.data;

        // Normalize contractRateRoomDTO
        const normalized = (data?.contractRateRoomDTO || []).map((r) => ({
          hotelRoomcategoryId: String(r.hotelRoomcategoryId),
          hotelRoomtypeId: String(r.hotelRoomtypeId || "1"),
          ocuppancytypeId: String(r.ocuppancytypeId || "15"),
          mealType: r.meal ? "Room with Breakfast" : "Room Only",
          hotelMealId: r.meal ? 1 : 0,
          rateSingle: Number(r.rateSingle || r.rate || 0),
          rateDouble: Number(r.rateDouble || r.rate || 0),
          adultRate: Number(r.adultRate || 0),
          childRate: Number(r.childRate || 0),
          extraBed:
            Number(r.adultRate || 0) > 0 || Number(r.childRate || 0) > 0,
          isRefundable: !!r.isRefundable,
        }));

        // Ensure both meal types exist for each room
        const mergedRates = [];
        hotelRooms.forEach((room) => {
          ["Room with Breakfast", "Room Only"].forEach((mealType) => {
            const match = normalized.find(
              (r) =>
                r.hotelRoomcategoryId === String(room.hotelRoomcategoryId) &&
                r.mealType === mealType
            );
            mergedRates.push(
              match || {
                hotelRoomcategoryId: String(room.hotelRoomcategoryId),
                hotelRoomtypeId: "1",
                ocuppancytypeId: "15",
                mealType,
                hotelMealId: mealType === "Room with Breakfast" ? 1 : 0,
                rateSingle: 0,
                rateDouble: 0,
                adultRate: 0,
                childRate: 0,
                extraBed: false,
                isRefundable: false,
              }
            );
          });
        });

        // ✅ Set full form data
        setFormData({
          seasonId: data.seasonId || "",
          rateCode: data.rateCode || "",
          marketType: (data.markeType || []).map((id) => ({
            value: id,
            label:
              markets.find((m) => m.marketTypeId === id)?.name ||
              `Market ${id}`,
          })),
          excludeCountry: (data.excludeCountry || []).map((id) => ({
            value: id,
            label:
              countries.find((c) => c.id === id)?.name || `Country ${id}`,
          })),
          validityList: (data.contractRateValidityDTO || []).map((v) => ({
            validityFrom: v.validityFrom
              ? new Date(v.validityFrom).toISOString().split("T")[0]
              : "",
            validityTo: v.validityTo
              ? new Date(v.validityTo).toISOString().split("T")[0]
              : "",
          })),
          roomRates: mergedRates,
        });
      } catch (err) {
        console.error("❌ Fetch Error:", err);
        toast.error("Failed to load contract rate");
      } finally {
        setLoading(false);
      }
    };

    if (markets.length && countries.length && hotelRooms.length)
      fetchContractRate();
  }, [markets, countries, hotelRooms, rateId]);

  // ✅ Handle Rate Changes
  const handleRateChange = (categoryId, type, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.roomRates];
      const idx = updated.findIndex(
        (r) =>
          r.hotelRoomcategoryId === String(categoryId) && r.mealType === type
      );

      if (idx !== -1) {
        updated[idx][field] = Number(value);
      } else {
        updated.push({
          hotelRoomcategoryId: String(categoryId),
          hotelRoomtypeId: "1",
          ocuppancytypeId: "15",
          mealType: type,
          hotelMealId: type === "Room with Breakfast" ? 1 : 0,
          [field]: Number(value),
          rateSingle: 0,
          rateDouble: 0,
          adultRate: 0,
          childRate: 0,
          extraBed: false,
          isRefundable: false,
        });
      }

      return { ...prev, roomRates: updated };
    });
  };

  // ✅ Handle onBlur for inline cell confirmation
  const handleBlur = (e, categoryId, mealType, field, value) => {
    if (value && Number(value) > 0) {
      const target = e.target;
      // Delay to ensure click events that caused the blur don't immediately trigger rootClose
      setTimeout(() => {
        setConfirmTarget(target);
        setConfirmData({
           categoryId,
           mealType,
           field,
           value,
           occName: "15", // Default occupancy for CopyRate since it's simplified
           roomTypeName: mealType
        });
        setShowCellConfirm(true);
      }, 150);
    } else {
      setShowCellConfirm(false);
    }
  };

  // ✅ Save Updates
  const handleSave = async () => {
    try {
      const payload = {
        markeType: formData.marketType.map((m) => m.value),
        excludeCountry: formData.excludeCountry.map((c) => c.value),
        hotelId: String(id),
        seasonId: String(formData.seasonId),
        contractrateId: rateId,
        rateCode: formData.rateCode.trim(),
        weekDay: Number(formData.weekDay || 0),
        weekEndDay: Number(formData.weekEndDay || 0),
        allDays: Number(formData.allDays || 1),
        contractRateValidityDTO: formData.validityList.map((v) => ({
          contractValidityId: v.contractValidityId || "",
          validityFrom: v.validityFrom,
          validityTo: v.validityTo,
        })),
        contractRateRoomDTO: formData.roomRates.map((r) => ({
          hotelRoomcategoryId: String(r.hotelRoomcategoryId),
          hotelRoomtypeId: String(r.hotelRoomtypeId || "1"),
          ocuppancytypeId: Number(r.ocuppancytypeId),
          rate: String(r.rate || "0"),
          adultRate: String(r.adultRate || "0"),
          childRate: String(r.childRate || "0"),
          extraBed: Boolean(r.extraBed),
          meal: Boolean(r.meal),
          isRefundable: Boolean(r.isRefundable),
        })),
      };

      console.log("🧾 Final Payload:", payload);
      const res = await axiosInstance.put(`/api/hotelContractRate/${rateId}`, payload);

      if (res.status === 200) {
        toast.success("Contract Rate updated successfully!");
        navigate(
          isExtranet
            ? `/extranet/${id}/contract-rate`
            : `/registration/hotel/${id}/contract-rate`,
        );
      }
    } catch (err) {
      console.error("❌ Update Error:", err);
      toast.error("Failed to update contract rate");
    }
  };

  // ✅ Render
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
              <h4 className="fw-semibold text-dark mb-0">Edit Contract Rate<HotelTitleBadge hotelId={id} className="ms-2" /></h4>
              <Button variant="success" onClick={handleSave}>
                <FaSave className="me-1" /> Save
              </Button>
            </div>

            <Card className="shadow-sm border-0 rounded-4 p-4">
              {loading || roomLoading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" />
                </div>
              ) : (
                <>
                  {/* 🔹 Validity Periods */}
                  <Card className="p-3 bg-light border-0 mb-4 rounded-3">
                    <div className="d-flex justify-content-between mb-3">
                      <h6 className="fw-bold text-primary mb-0">Validity Periods</h6>
                      <Button
                        size="sm"
                        variant="outline-primary"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            validityList: [
                              ...formData.validityList,
                              { validityFrom: "", validityTo: "" },
                            ],
                          })
                        }
                      >
                        + Add
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
                              
                              // Clear Validity To if it becomes invalid (before or equal to From date)
                              const currentToDate = formData.validityList[index].validityTo;
                              if (currentToDate && e.target.value && new Date(currentToDate) <= new Date(e.target.value)) {
                                updated[index].validityTo = "";
                              }
                              
                              setFormData({ ...formData, validityList: updated });
                            }}
                          />
                        </Col>
                        <Col md={4}>
                          <Form.Control
                            type="date"
                            value={v.validityTo}
                            min={getMinValidityToDate(v.validityFrom)}
                            onChange={(e) => {
                              const updated = [...formData.validityList];
                              updated[index].validityTo = e.target.value;
                              setFormData({ ...formData, validityList: updated });
                            }}
                          />
                        </Col>
                        <Col md="auto">
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => {
                              const updated = formData.validityList.filter(
                                (_, i) => i !== index
                              );
                              setFormData({ ...formData, validityList: updated });
                            }}
                          >
                            ✖
                          </Button>
                        </Col>
                      </Row>
                    ))}
                  </Card>

                  {/* 🔹 Contract Rate Details */}
                  <Card className="p-3 bg-light border-0 rounded-3">
                    <h6 className="fw-bold mb-3 text-primary">Contract Rate Details</h6>
                    {hotelRooms.map((room) => (
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
                            checked={formData.roomRates.some(
                              (r) =>
                                r.hotelRoomcategoryId ===
                                  String(room.hotelRoomcategoryId) &&
                                r.isRefundable
                            )}
                            onChange={(e) => {
                              const updated = [...formData.roomRates];
                              updated.forEach((r) => {
                                if (
                                  r.hotelRoomcategoryId ===
                                  String(room.hotelRoomcategoryId)
                                )
                                  r.isRefundable = e.target.checked;
                              });
                              setFormData({ ...formData, roomRates: updated });
                            }}
                          />
                        </div>

                        <Table bordered hover responsive size="sm">
                          <thead className="table-light">
                            <tr>
                              <th>Meal Type</th>
                              <th>Single</th>
                              <th>Double</th>
                              <th>Extra Adult</th>
                              <th>Extra Child</th>
                            </tr>
                          </thead>
                          <tbody>
                            {["Room with Breakfast", "Room Only"].map((mealType) => {
                              const data =
                                formData.roomRates.find(
                                  (r) =>
                                    r.hotelRoomcategoryId ===
                                      String(room.hotelRoomcategoryId) &&
                                    r.mealType === mealType
                                ) || {};
                              return (
                                <tr key={mealType}>
                                  <td className="fw-semibold text-start">
                                    {mealType}
                                  </td>
                                  {[
                                    "rateSingle",
                                    "rateDouble",
                                    "adultRate",
                                    "childRate",
                                  ].map((field) => (
                                    <td key={field}>
                                      <Form.Control
                                        type="number"
                                        min="0"
                                        value={data[field] || ""}
                                        onChange={(e) =>
                                          handleRateChange(
                                            room.hotelRoomcategoryId,
                                            mealType,
                                            field,
                                            e.target.value
                                          )
                                        }
                                        onBlur={(e) =>
                                          handleBlur(
                                            e,
                                            room.hotelRoomcategoryId,
                                            mealType,
                                            field,
                                            e.target.value
                                          )
                                        }
                                      />
                                    </td>
                                  ))}
                                </tr>
                              );
                            })}
                          </tbody>
                        </Table>
                      </div>
                    ))}
                  </Card>
                </>
              )}
            </Card>

            {/* ✅ Inline cell confirmation popup */}
            <Overlay show={showCellConfirm} target={confirmTarget} placement="top" rootClose rootCloseEvent="mousedown" onHide={() => setShowCellConfirm(false)}>
              <Popover id="popover-confirm-rate-copy">
                <Popover.Header as="h6" className="py-1 bg-warning text-dark">Confirm Rate</Popover.Header>
                <Popover.Body className="p-2">
                  <div className="mb-2 text-center text-dark" style={{ fontSize: "0.9rem" }}>
                    Verify {confirmData?.field === "rateSingle" || confirmData?.field === "rateDouble" ? "Rate" : confirmData?.field === "adultRate" ? "Extra Adult" : "Extra Child"} of <strong>{confirmData?.value}</strong> with <strong>{confirmData?.mealType}</strong>?
                  </div>
                  <div className="d-flex justify-content-center gap-2">
                    <Button size="sm" variant="success" onClick={(e) => { e.stopPropagation(); setShowCellConfirm(false); }}>
                      Yes
                    </Button>
                    <Button size="sm" variant="danger" onClick={(e) => {
                      e.stopPropagation();
                      handleRateChange(confirmData.categoryId, confirmData.mealType, confirmData.field, "");
                      setShowCellConfirm(false);
                    }}>
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
