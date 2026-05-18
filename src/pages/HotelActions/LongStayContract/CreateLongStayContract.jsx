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

export default function CreateLongStayContract() {
  const navigate = useNavigate();
  const { id } = useParams(); // hotel id

  const [formData, setFormData] = useState({
    rateCode: "",
    additionalCostType: "DAY_WISE", // DAY_WISE | WEEKLY
    validityFrom: "",
    validityTo: "",
    isLive: false,
    maxBookingDays: "", // empty = no cap
    rooms: [],
  });

  const [hotelRooms, setHotelRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const fetchRooms = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const res = await axiosInstance.get(
          `/api/hotelRoomDetailsController/${id}`
        );
        const mapped = (res.data || []).map((room) => {
          const seenOcc = new Set();
          const uniqueOcc = (room.occupancyDetailsDTOs || []).filter((o) => {
            if (seenOcc.has(o.id)) return false;
            seenOcc.add(o.id);
            return true;
          });
          return {
            hotelRoomcategoryId: room.rommCategoryId || room.hotelRoomcategoryId,
            roomCategory: room.roomCategory,
            occupancyDetailsDTOs: uniqueOcc,
            roomTypeDetailsDTOs: room.roomTypeDetailsDTOs || [],
          };
        });
        setHotelRooms(mapped);
      } catch {
        toast.error("Failed to load hotel rooms");
      } finally {
        setLoading(false);
      }
    };
    fetchRooms();
  }, [id]);

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
    if (!formData.additionalCostType)
      e.additionalCostType = "Select cost type";
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
    } else {
      const hasAny = formData.rooms.some(
        (r) => r.monthlyRate > 0 || r.dayRate > 0 || r.weeklyRate > 0
      );
      if (!hasAny)
        e.rooms = "Enter at least one Monthly / Day / Weekly rate";
      // Day rate is always needed (used for sub-week remainder when weekly).
      const missingDayRate = formData.rooms.some(
        (r) => r.monthlyRate > 0 && (!r.dayRate || r.dayRate <= 0)
      );
      if (missingDayRate) {
        e.rooms = "Day Rate is required wherever a Monthly Rate is set (it is also used for sub-week remainders in WEEKLY mode)";
      }
      if (formData.additionalCostType === "WEEKLY") {
        const missingWeekly = formData.rooms.some(
          (r) => r.monthlyRate > 0 && (!r.weeklyRate || r.weeklyRate <= 0)
        );
        if (missingWeekly) {
          e.rooms = "WEEKLY mode requires a Weekly Rate for every priced row";
        }
      }
    }
    if (
      formData.maxBookingDays !== "" &&
      formData.maxBookingDays !== null &&
      Number(formData.maxBookingDays) <= 0
    ) {
      e.maxBookingDays = "Must be a positive number (or leave empty for no cap)";
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
      const res = await axiosInstance.post(
        "/api/longStayContract/save",
        payload
      );
      if (res.status === 200 || res.status === 201) {
        toast.success("Long Stay Contract saved");
        navigate(`/hotel-actions/${id}/long-stay-contract`);
      }
    } catch (err) {
      toast.error(
        `Save failed: ${err.response?.data?.message || err.message}`
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
            <h4 className="m-0">Create Long Stay Contract</h4>
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
                      {errors.rateCode && (
                        <Form.Control.Feedback type="invalid">
                          {errors.rateCode}
                        </Form.Control.Feedback>
                      )}
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
                      {errors.validityFrom && (
                        <Form.Control.Feedback type="invalid">
                          {errors.validityFrom}
                        </Form.Control.Feedback>
                      )}
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
                      {errors.validityTo && (
                        <Form.Control.Feedback type="invalid">
                          {errors.validityTo}
                        </Form.Control.Feedback>
                      )}
                    </Form.Group>
                  </Col>
                  <Col md={3} className="d-flex align-items-end">
                    <Form.Check
                      type="switch"
                      id="isLive"
                      label="Activate immediately"
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
                        isInvalid={!!errors.maxBookingDays}
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
                      {errors.maxBookingDays && (
                        <Form.Control.Feedback type="invalid">
                          {errors.maxBookingDays}
                        </Form.Control.Feedback>
                      )}
                    </Form.Group>
                  </Col>
                </Row>

                <Row className="mb-4">
                  <Col md={12}>
                    <Card className="p-3 bg-light border-0">
                      <h6 className="fw-bold text-primary mb-3">
                        Additional Cost Type *
                      </h6>
                      <p className="text-muted small mb-2">
                        Long-stay rate uses Monthly Rate as the base (1 month =
                        30 days). Stays beyond the contracted month are charged
                        using the policy selected below — Day-wise charges every
                        extra day at Day Rate; Weekly charges full 7-day blocks
                        at Weekly Rate and any sub-week residual days at Day
                        Rate.
                      </p>
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
                      {errors.additionalCostType && (
                        <div className="invalid-feedback d-block">
                          {errors.additionalCostType}
                        </div>
                      )}
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
                      "Save"
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
