import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Card,
  Button,
  Form,
  Row,
  Col,
  Spinner,
  Table,
} from "react-bootstrap";
import { FaArrowLeft } from "react-icons/fa";
import axiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import Sidebar from "../../../components/Sidebar";
import Topbar from "../../../components/TopBar";

export default function EditLongStayContract() {
  const navigate = useNavigate();
  const { id, contractId } = useParams(); // hotel id, long stay contract id

  const [formData, setFormData] = useState({
    rateCode: "",
    additionalCostType: "DAY_WISE",
    validityFrom: "",
    validityTo: "",
    isLive: false,
    maxBookingDays: "",
    rooms: [],
  });

  const [hotelRooms, setHotelRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [roomsRes, contractRes] = await Promise.all([
          axiosInstance.get(`/api/hotelRoomDetailsController/${id}`),
          axiosInstance.get(`/api/longStayContract/${contractId}`),
        ]);

        const mappedRooms = (roomsRes.data || []).map((r) => {
          const seen = new Set();
          const uniq = (r.occupancyDetailsDTOs || []).filter((o) => {
            if (seen.has(o.id)) return false;
            seen.add(o.id);
            return true;
          });
          return {
            hotelRoomcategoryId: r.rommCategoryId || r.hotelRoomcategoryId,
            roomCategory: r.roomCategory,
            occupancyDetailsDTOs: uniq,
            roomTypeDetailsDTOs: r.roomTypeDetailsDTOs || [],
          };
        });
        setHotelRooms(mappedRooms);

        const data = contractRes.data;
        const rooms = (data.rooms || []).map((room) => ({
          longStayRoomId: room.longStayRoomId,
          hotelRoomCategoryId: String(room.hotelRoomCategoryId),
          hotelRoomTypeId: String(room.hotelRoomTypeId),
          occupancyTypeId: String(room.occupancyTypeId),
          hotelMealId: room.hotelMealId || 0,
          monthlyRate: room.monthlyRate || 0,
          dayRate: room.dayRate || 0,
          weeklyRate: room.weeklyRate || 0,
          adultRate: room.adultRate || 0,
          childRate: room.childRate || 0,
          meal: Boolean(room.meal),
          extraBed: Boolean(room.extraBed),
          refundable: Boolean(room.refundable),
        }));

        setFormData({
          rateCode: data.rateCode || "",
          additionalCostType: data.additionalCostType || "DAY_WISE",
          validityFrom: data.validityFrom || "",
          validityTo: data.validityTo || "",
          isLive: Boolean(data.isLive),
          maxBookingDays:
            data.maxBookingDays === null || data.maxBookingDays === undefined
              ? ""
              : String(data.maxBookingDays),
          rooms,
        });
      } catch {
        toast.error("Failed to load contract");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, contractId]);

  const setRateField = (
    roomCategoryId,
    occupancyId,
    roomTypeId,
    roomTypeName,
    field,
    value
  ) => {
    setFormData((prev) => {
      const updated = [...prev.rooms];
      const idx = updated.findIndex(
        (r) =>
          r.hotelRoomCategoryId === String(roomCategoryId) &&
          r.occupancyTypeId === String(occupancyId) &&
          r.hotelRoomTypeId === String(roomTypeId)
      );
      if (idx !== -1) {
        updated[idx][field] = Number(value);
        if (field === "adultRate" || field === "childRate") {
          updated[idx].extraBed = Number(value) > 0;
        }
      } else {
        updated.push({
          hotelRoomCategoryId: String(roomCategoryId),
          hotelRoomTypeId: String(roomTypeId),
          occupancyTypeId: String(occupancyId),
          mealType: roomTypeName,
          hotelMealId: roomTypeName.toLowerCase().includes("breakfast") ? 1 : 0,
          monthlyRate: field === "monthlyRate" ? Number(value) : 0,
          dayRate: field === "dayRate" ? Number(value) : 0,
          weeklyRate: field === "weeklyRate" ? Number(value) : 0,
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
      return { ...prev, rooms: updated };
    });
  };

  const setRefundableForCategory = (roomCategoryId, refundable) => {
    setFormData((prev) => {
      const updated = prev.rooms.map((r) =>
        r.hotelRoomCategoryId === String(roomCategoryId)
          ? { ...r, refundable }
          : r
      );
      return { ...prev, rooms: updated };
    });
  };

  const validate = () => {
    const e = {};
    if (!formData.rateCode.trim()) e.rateCode = "Rate code is required";
    if (!formData.validityFrom) e.validityFrom = "Validity From is required";
    if (!formData.validityTo) e.validityTo = "Validity To is required";
    if (
      formData.validityFrom &&
      formData.validityTo &&
      new Date(formData.validityFrom) > new Date(formData.validityTo)
    ) {
      e.validityTo = "Validity To must be after Validity From";
    }
    if (formData.rooms.length === 0) {
      e.rooms = "Please enter at least one rate";
    }
    return e;
  };

  const submit = async () => {
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const payload = {
        longStayContractId: Number(contractId),
        rateCode: formData.rateCode.trim(),
        hotelId: Number(id),
        additionalCostType: formData.additionalCostType,
        validityFrom: formData.validityFrom,
        validityTo: formData.validityTo,
        isLive: Boolean(formData.isLive),
        maxBookingDays:
          formData.maxBookingDays === "" || formData.maxBookingDays === null
            ? null
            : Number(formData.maxBookingDays),
        rooms: formData.rooms.map((r) => ({
          hotelRoomCategoryId: Number(r.hotelRoomCategoryId),
          hotelRoomTypeId: Number(r.hotelRoomTypeId),
          occupancyTypeId: Number(r.occupancyTypeId),
          hotelMealId: Number(r.hotelMealId || 0),
          monthlyRate: Number(r.monthlyRate || 0),
          dayRate: Number(r.dayRate || 0),
          weeklyRate: Number(r.weeklyRate || 0),
          adultRate: Number(r.adultRate || 0),
          childRate: Number(r.childRate || 0),
          meal: Boolean(r.meal),
          extraBed: Boolean(r.extraBed),
          refundable: Boolean(r.refundable),
        })),
      };
      await axiosInstance.put(
        `/api/longStayContract/${contractId}`,
        payload
      );
      toast.success("Long Stay Contract updated");
      navigate(`/hotel-actions/${id}/long-stay-contract`);
    } catch (err) {
      toast.error(
        `Update failed: ${err.response?.data?.message || err.message}`
      );
    } finally {
      setSubmitting(false);
    }
  };

  const isWeekly = formData.additionalCostType === "WEEKLY";

  return (
    <div className="d-flex">
      <Sidebar />
      <div className="flex-grow-1">
        <Topbar />
        <div className="p-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <Button variant="outline-secondary" onClick={() => navigate(-1)}>
              <FaArrowLeft className="me-2" />
              Back
            </Button>
            <h4 className="m-0">Edit Long Stay Contract</h4>
            <span />
          </div>

          <Card className="p-4">
            {loading ? (
              <div className="text-center py-5">
                <Spinner animation="border" variant="primary" />
              </div>
            ) : (
              <>
                <Row className="mb-3">
                  <Col md={3}>
                    <Form.Group>
                      <Form.Label>Rate Code *</Form.Label>
                      <Form.Control
                        value={formData.rateCode}
                        isInvalid={!!errors.rateCode}
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
                      <Form.Label>Validity From *</Form.Label>
                      <Form.Control
                        type="date"
                        value={formData.validityFrom}
                        isInvalid={!!errors.validityFrom}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            validityFrom: e.target.value,
                          })
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group>
                      <Form.Label>Validity To *</Form.Label>
                      <Form.Control
                        type="date"
                        value={formData.validityTo}
                        isInvalid={!!errors.validityTo}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            validityTo: e.target.value,
                          })
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col md={3} className="d-flex align-items-end">
                    <Form.Check
                      type="switch"
                      id="isLive"
                      label="Active"
                      checked={formData.isLive}
                      onChange={(e) =>
                        setFormData({ ...formData, isLive: e.target.checked })
                      }
                    />
                  </Col>
                </Row>

                <Row className="mb-3">
                  <Col md={3}>
                    <Form.Group>
                      <Form.Label>Max Booking Days</Form.Label>
                      <Form.Control
                        type="number"
                        min="1"
                        placeholder="No cap"
                        value={formData.maxBookingDays}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            maxBookingDays: e.target.value,
                          })
                        }
                      />
                      <Form.Text className="text-muted">
                        Agent bookings cannot exceed this many total nights.
                        Leave blank for no limit.
                      </Form.Text>
                    </Form.Group>
                  </Col>
                </Row>


                <Row className="mb-4">
                  <Col md={12}>
                    <Card className="p-3 bg-light border-0">
                      <h6 className="fw-bold text-primary mb-3">
                        Additional Cost Type *
                      </h6>
                      <div className="d-flex gap-4">
                        <Form.Check
                          type="radio"
                          id="costType_dayWise"
                          name="additionalCostType"
                          label="Day-wise (extra days × day rate)"
                          value="DAY_WISE"
                          checked={formData.additionalCostType === "DAY_WISE"}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              additionalCostType: e.target.value,
                            })
                          }
                        />
                        <Form.Check
                          type="radio"
                          id="costType_weekly"
                          name="additionalCostType"
                          label="Weekly (rounded to 7-day blocks)"
                          value="WEEKLY"
                          checked={formData.additionalCostType === "WEEKLY"}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              additionalCostType: e.target.value,
                            })
                          }
                        />
                      </div>
                    </Card>
                  </Col>
                </Row>

                {errors.rooms && (
                  <div className="alert alert-danger">{errors.rooms}</div>
                )}

                {hotelRooms.map((room) => (
                  <div key={room.hotelRoomcategoryId} className="mb-4">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <h6 className="fw-bold mb-0">{room.roomCategory}</h6>
                      <Form.Check
                        label="Is Refundable"
                        checked={
                          formData.rooms.some(
                            (r) =>
                              r.hotelRoomCategoryId ===
                                String(room.hotelRoomcategoryId) &&
                              r.refundable
                          ) || false
                        }
                        onChange={(e) =>
                          setRefundableForCategory(
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
                          <th>Room Type / Meal</th>
                          <th>Monthly Rate</th>
                          <th>Day Rate</th>
                          {isWeekly && <th>Weekly Rate</th>}
                          <th>Extra Adult</th>
                          <th>Extra Child</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(room.occupancyDetailsDTOs || []).length > 0 &&
                        (room.roomTypeDetailsDTOs || []).length > 0 ? (
                          room.occupancyDetailsDTOs.map((occ) =>
                            room.roomTypeDetailsDTOs.map((rt) => (
                              <tr key={`${occ.id}-${rt.roomTypeId}`}>
                                <td>{occ.occupanyType}</td>
                                <td>{rt.roomTypeName}</td>
                                {(isWeekly
                                  ? [
                                      "monthlyRate",
                                      "dayRate",
                                      "weeklyRate",
                                      "adultRate",
                                      "childRate",
                                    ]
                                  : [
                                      "monthlyRate",
                                      "dayRate",
                                      "adultRate",
                                      "childRate",
                                    ]
                                ).map((field) => (
                                  <td key={field}>
                                    <Form.Control
                                      type="number"
                                      min="0"
                                      value={
                                        formData.rooms.find(
                                          (r) =>
                                            r.hotelRoomCategoryId ===
                                              String(
                                                room.hotelRoomcategoryId
                                              ) &&
                                            r.occupancyTypeId ===
                                              String(occ.id) &&
                                            r.hotelRoomTypeId ===
                                              String(rt.roomTypeId)
                                        )?.[field] || ""
                                      }
                                      onChange={(e) =>
                                        setRateField(
                                          room.hotelRoomcategoryId,
                                          occ.id,
                                          rt.roomTypeId,
                                          rt.roomTypeName,
                                          field,
                                          e.target.value
                                        )
                                      }
                                    />
                                  </td>
                                ))}
                              </tr>
                            ))
                          )
                        ) : (
                          <tr>
                            <td
                              colSpan={isWeekly ? 7 : 6}
                              className="text-center text-muted py-3"
                            >
                              No room types or occupancy details available
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </Table>
                  </div>
                ))}

                <div className="d-flex justify-content-between mt-4">
                  <Button
                    variant="outline-danger"
                    onClick={() => navigate(-1)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="success"
                    onClick={submit}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <Spinner size="sm" animation="border" />
                    ) : (
                      "Update"
                    )}
                  </Button>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
