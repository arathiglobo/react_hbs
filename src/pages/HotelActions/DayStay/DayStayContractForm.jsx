import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Card,
  Form,
  Button,
  Row,
  Col,
  Spinner,
  Alert,
  Table,
} from "react-bootstrap";
import { FaArrowLeft } from "react-icons/fa";
import Sidebar from "../../../components/Sidebar";
import Topbar from "../../../components/TopBar";
import axiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";

/**
 * DayStayContractForm — used for both CREATE and EDIT.
 *
 * Day Stay contracts mirror Contract Rate / 24-hour fields:
 *   - rateCode, validityFrom/To
 *   - check-in window (start/end) — the daily time band during which day-stay
 *     check-ins are accepted
 *   - dayStayRate, percentage markup, active, remarks
 *   - per-room rate rows (category/type/occupancy + day-stay rate)
 *
 * POST /api/day-stay-contract/save
 * PUT  /api/day-stay-contract/{id}
 */
export default function DayStayContractForm({ mode }) {
  const navigate = useNavigate();
  const { id: hotelId, contractId } = useParams();
  const isEdit = mode === "edit";

  const [form, setForm] = useState({
    rateCode: "",
    validityFrom: "",
    validityTo: "",
    checkInStartTime: "08:00",
    checkInEndTime: "17:00",
    dayStayRate: "",
    percentage: "",
    active: true,
    remarks: "",
    rooms: [],
  });

  const [hotelRooms, setHotelRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [errors, setErrors] = useState({});

  // Load hotel rooms for the rates table, plus existing contract on edit.
  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const roomRes = await axiosInstance
          .get(`/api/hotelRoomDetailsController/${hotelId}`)
          .catch(() => ({ data: [] }));
        const mappedRooms = (roomRes.data || []).map((room) => {
          const seenOcc = new Set();
          const uniqueOcc = (room.occupancyDetailsDTOs || []).filter((o) => {
            if (seenOcc.has(o.id)) return false;
            seenOcc.add(o.id);
            return true;
          });
          return {
            hotelRoomCategoryId:
              room.rommCategoryId || room.hotelRoomcategoryId,
            roomCategory: room.roomCategory,
            occupancyDetailsDTOs: uniqueOcc,
            roomTypeDetailsDTOs: room.roomTypeDetailsDTOs || [],
          };
        });
        setHotelRooms(mappedRooms);

        if (isEdit && contractId) {
          const res = await axiosInstance.get(
            `/api/day-stay-contract/${contractId}`
          );
          const e = res.data;
          setForm({
            rateCode: e.rateCode || "",
            validityFrom: e.validityFrom || "",
            validityTo: e.validityTo || "",
            checkInStartTime: e.checkInStartTime || "08:00",
            checkInEndTime: e.checkInEndTime || "17:00",
            dayStayRate: e.dayStayRate ?? "",
            percentage: e.percentage ?? "",
            active: e.active !== false,
            remarks: e.remarks || "",
            rooms: (e.rooms || []).map((r) => ({
              hotelRoomCategoryId: r.hotelRoomCategoryId,
              hotelRoomTypeId: r.hotelRoomTypeId,
              occupancyTypeId: r.occupancyTypeId,
              hotelMealId: r.hotelMealId || 0,
              dayStayRate: Number(r.dayStayRate || 0),
              adultRate: Number(r.adultRate || 0),
              childRate: Number(r.childRate || 0),
              extraBed: !!r.extraBed,
              meal: !!r.meal,
              refundable: !!r.refundable,
            })),
          });
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to load Day Stay contract");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [isEdit, contractId, hotelId]);

  const set = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
    setServerError(null);
  };

  const setRoomField = (
    roomCategoryId,
    occupancyId,
    roomTypeId,
    roomTypeName,
    field,
    value
  ) => {
    setForm((prev) => {
      const updated = [...prev.rooms];
      const idx = updated.findIndex(
        (r) =>
          Number(r.hotelRoomCategoryId) === Number(roomCategoryId) &&
          Number(r.occupancyTypeId) === Number(occupancyId) &&
          Number(r.hotelRoomTypeId) === Number(roomTypeId)
      );
      const numeric = Number(value);
      if (idx !== -1) {
        updated[idx][field] = numeric;
        if (field === "adultRate" || field === "childRate") {
          updated[idx].extraBed = numeric > 0;
        }
      } else {
        updated.push({
          hotelRoomCategoryId: Number(roomCategoryId),
          hotelRoomTypeId: Number(roomTypeId),
          occupancyTypeId: Number(occupancyId),
          hotelMealId: (roomTypeName || "").toLowerCase().includes("breakfast")
            ? 1
            : 0,
          dayStayRate: field === "dayStayRate" ? numeric : 0,
          adultRate: field === "adultRate" ? numeric : 0,
          childRate: field === "childRate" ? numeric : 0,
          extraBed:
            field === "adultRate" || field === "childRate"
              ? numeric > 0
              : false,
          meal: (roomTypeName || "").toLowerCase().includes("breakfast"),
          refundable: false,
        });
      }
      return { ...prev, rooms: updated };
    });
  };

  const getRoomValue = (catId, occId, rtId, field) => {
    const r = form.rooms.find(
      (x) =>
        Number(x.hotelRoomCategoryId) === Number(catId) &&
        Number(x.occupancyTypeId) === Number(occId) &&
        Number(x.hotelRoomTypeId) === Number(rtId)
    );
    if (!r) return "";
    return r[field] || "";
  };

  const validate = () => {
    const e = {};
    if (!form.validityFrom) e.validityFrom = "Required";
    if (!form.validityTo) e.validityTo = "Required";
    if (
      form.validityFrom &&
      form.validityTo &&
      form.validityFrom > form.validityTo
    )
      e.validityTo = "Validity To must be on/after Validity From";
    if (!form.checkInStartTime) e.checkInStartTime = "Required";
    if (!form.checkInEndTime) e.checkInEndTime = "Required";
    if (
      form.checkInStartTime &&
      form.checkInEndTime &&
      form.checkInStartTime >= form.checkInEndTime
    )
      e.checkInEndTime = "End time must be after start time";
    if (form.dayStayRate !== "" && Number(form.dayStayRate) < 0)
      e.dayStayRate = "Cannot be negative";
    if (form.percentage !== "" && Number(form.percentage) < 0)
      e.percentage = "Cannot be negative";
    return e;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const payload = {
      hotelId: Number(hotelId),
      rateCode: form.rateCode?.trim() || null,
      validityFrom: form.validityFrom,
      validityTo: form.validityTo,
      checkInStartTime: form.checkInStartTime,
      checkInEndTime: form.checkInEndTime,
      dayStayRate: form.dayStayRate === "" ? null : Number(form.dayStayRate),
      percentage: form.percentage === "" ? null : Number(form.percentage),
      active: !!form.active,
      remarks: form.remarks?.trim() || null,
      rooms: form.rooms
        .filter(
          (r) =>
            r.dayStayRate > 0 || r.adultRate > 0 || r.childRate > 0
        )
        .map((r) => ({
          hotelRoomCategoryId: Number(r.hotelRoomCategoryId),
          hotelRoomTypeId: Number(r.hotelRoomTypeId),
          occupancyTypeId: Number(r.occupancyTypeId),
          hotelMealId: Number(r.hotelMealId || 0),
          dayStayRate: Number(r.dayStayRate || 0),
          adultRate: Number(r.adultRate || 0),
          childRate: Number(r.childRate || 0),
          extraBed: !!r.extraBed,
          meal: !!r.meal,
          refundable: !!r.refundable,
        })),
    };

    try {
      setSubmitting(true);
      if (isEdit) {
        await axiosInstance.put(
          `/api/day-stay-contract/${contractId}`,
          payload
        );
        toast.success("Updated");
      } else {
        await axiosInstance.post(`/api/day-stay-contract/save`, payload);
        toast.success("Created");
      }
      navigate(`/hotel-actions/${hotelId}/day-stay-contract`);
    } catch (err) {
      const msg = err?.response?.data?.message || "Save failed";
      setServerError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4" style={{ overflow: "auto" }}>
          <div className="d-flex align-items-center gap-2 mb-3">
            <Button
              variant="light"
              onClick={() => navigate(-1)}
              className="d-flex align-items-center gap-2"
            >
              <FaArrowLeft /> Back
            </Button>
            <h5 className="mb-0">
              {isEdit ? "Edit" : "Add"} Day Stay Contract
            </h5>
          </div>

          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" />
            </div>
          ) : (
            <Card className="shadow-sm">
              <Card.Body>
                <Alert
                  variant="info"
                  className="py-2 mb-3"
                  style={{ fontSize: "0.85rem" }}
                >
                  Day Stay differs from 24-hour check-in: define the daily
                  window (e.g. 08:00–17:00). Guests checking in inside the
                  window may stay until the window ends.
                </Alert>

                {serverError && (
                  <Alert variant="danger" className="py-2 mb-3">
                    {serverError}
                  </Alert>
                )}

                <Form onSubmit={handleSubmit} noValidate>
                  <Row>
                    <Col md={3} className="mb-3">
                      <Form.Label>Rate Code</Form.Label>
                      <Form.Control
                        type="text"
                        value={form.rateCode}
                        onChange={(e) => set("rateCode", e.target.value)}
                        placeholder="e.g. DS-VIP"
                      />
                    </Col>
                    <Col md={3} className="mb-3">
                      <Form.Label>Validity From *</Form.Label>
                      <Form.Control
                        type="date"
                        value={form.validityFrom}
                        isInvalid={!!errors.validityFrom}
                        onChange={(e) => set("validityFrom", e.target.value)}
                      />
                      <Form.Control.Feedback type="invalid">
                        {errors.validityFrom}
                      </Form.Control.Feedback>
                    </Col>
                    <Col md={3} className="mb-3">
                      <Form.Label>Validity To *</Form.Label>
                      <Form.Control
                        type="date"
                        value={form.validityTo}
                        min={form.validityFrom || undefined}
                        isInvalid={!!errors.validityTo}
                        onChange={(e) => set("validityTo", e.target.value)}
                      />
                      <Form.Control.Feedback type="invalid">
                        {errors.validityTo}
                      </Form.Control.Feedback>
                    </Col>
                    <Col md={3} className="mb-3 d-flex align-items-end">
                      <Form.Check
                        type="switch"
                        id="day-stay-active-switch"
                        label="Active"
                        checked={!!form.active}
                        onChange={(e) => set("active", e.target.checked)}
                      />
                    </Col>
                  </Row>

                  <Row>
                    <Col md={3} className="mb-3">
                      <Form.Label>Check-In Window — Start *</Form.Label>
                      <Form.Control
                        type="time"
                        value={form.checkInStartTime}
                        isInvalid={!!errors.checkInStartTime}
                        onChange={(e) =>
                          set("checkInStartTime", e.target.value)
                        }
                      />
                      <small className="text-muted">
                        Earliest day-stay check-in time.
                      </small>
                    </Col>
                    <Col md={3} className="mb-3">
                      <Form.Label>Check-In Window — End *</Form.Label>
                      <Form.Control
                        type="time"
                        value={form.checkInEndTime}
                        isInvalid={!!errors.checkInEndTime}
                        onChange={(e) =>
                          set("checkInEndTime", e.target.value)
                        }
                      />
                      <Form.Control.Feedback type="invalid">
                        {errors.checkInEndTime}
                      </Form.Control.Feedback>
                      <small className="text-muted">
                        Latest check-in & day-stay end time.
                      </small>
                    </Col>
                    <Col md={3} className="mb-3">
                      <Form.Label>Day Stay Base Rate</Form.Label>
                      <Form.Control
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="e.g. 150.00"
                        value={form.dayStayRate}
                        isInvalid={!!errors.dayStayRate}
                        onChange={(e) => set("dayStayRate", e.target.value)}
                      />
                      <Form.Control.Feedback type="invalid">
                        {errors.dayStayRate}
                      </Form.Control.Feedback>
                    </Col>
                    <Col md={3} className="mb-3">
                      <Form.Label>Markup %</Form.Label>
                      <Form.Control
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="e.g. 10.00"
                        value={form.percentage}
                        isInvalid={!!errors.percentage}
                        onChange={(e) => set("percentage", e.target.value)}
                      />
                      <Form.Control.Feedback type="invalid">
                        {errors.percentage}
                      </Form.Control.Feedback>
                    </Col>
                  </Row>

                  <Row>
                    <Col md={12} className="mb-3">
                      <Form.Label>Remarks</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={2}
                        value={form.remarks}
                        onChange={(e) => set("remarks", e.target.value)}
                        placeholder="Optional notes"
                      />
                    </Col>
                  </Row>

                  {hotelRooms.length > 0 && (
                    <div className="mt-3">
                      <h6 className="fw-bold mb-2">
                        Per-Room Day Stay Rates (optional)
                      </h6>
                      <small className="text-muted d-block mb-2">
                        Leave blank to use the base Day Stay rate. Rows without
                        any rate are ignored.
                      </small>
                      <Table bordered size="sm" responsive>
                        <thead style={{ backgroundColor: "#f8f8f8" }}>
                          <tr>
                            <th>Room Category</th>
                            <th>Occupancy</th>
                            <th>Room Type</th>
                            <th>Day Rate</th>
                            <th>Adult Rate (extra bed)</th>
                            <th>Child Rate (extra bed)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {hotelRooms.flatMap((cat) =>
                            (cat.occupancyDetailsDTOs || []).flatMap((occ) =>
                              (cat.roomTypeDetailsDTOs || []).map((rt) => (
                                <tr
                                  key={`${cat.hotelRoomCategoryId}-${occ.id}-${rt.hotelRoomtypeId || rt.hotelRoomTypeId || rt.id}`}
                                >
                                  <td>{cat.roomCategory}</td>
                                  <td>{occ.name || occ.occupancyType}</td>
                                  <td>{rt.roomType || rt.name}</td>
                                  <td>
                                    <Form.Control
                                      size="sm"
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={getRoomValue(
                                        cat.hotelRoomCategoryId,
                                        occ.id,
                                        rt.hotelRoomtypeId ||
                                          rt.hotelRoomTypeId ||
                                          rt.id,
                                        "dayStayRate"
                                      )}
                                      onChange={(e) =>
                                        setRoomField(
                                          cat.hotelRoomCategoryId,
                                          occ.id,
                                          rt.hotelRoomtypeId ||
                                            rt.hotelRoomTypeId ||
                                            rt.id,
                                          rt.roomType || rt.name,
                                          "dayStayRate",
                                          e.target.value
                                        )
                                      }
                                    />
                                  </td>
                                  <td>
                                    <Form.Control
                                      size="sm"
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={getRoomValue(
                                        cat.hotelRoomCategoryId,
                                        occ.id,
                                        rt.hotelRoomtypeId ||
                                          rt.hotelRoomTypeId ||
                                          rt.id,
                                        "adultRate"
                                      )}
                                      onChange={(e) =>
                                        setRoomField(
                                          cat.hotelRoomCategoryId,
                                          occ.id,
                                          rt.hotelRoomtypeId ||
                                            rt.hotelRoomTypeId ||
                                            rt.id,
                                          rt.roomType || rt.name,
                                          "adultRate",
                                          e.target.value
                                        )
                                      }
                                    />
                                  </td>
                                  <td>
                                    <Form.Control
                                      size="sm"
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={getRoomValue(
                                        cat.hotelRoomCategoryId,
                                        occ.id,
                                        rt.hotelRoomtypeId ||
                                          rt.hotelRoomTypeId ||
                                          rt.id,
                                        "childRate"
                                      )}
                                      onChange={(e) =>
                                        setRoomField(
                                          cat.hotelRoomCategoryId,
                                          occ.id,
                                          rt.hotelRoomtypeId ||
                                            rt.hotelRoomTypeId ||
                                            rt.id,
                                          rt.roomType || rt.name,
                                          "childRate",
                                          e.target.value
                                        )
                                      }
                                    />
                                  </td>
                                </tr>
                              ))
                            )
                          )}
                        </tbody>
                      </Table>
                    </div>
                  )}

                  <div className="d-flex gap-2 mt-3">
                    <Button
                      type="submit"
                      disabled={submitting}
                      style={{ backgroundColor: "#0d6efd", border: "none" }}
                    >
                      {submitting ? "Saving…" : isEdit ? "Update" : "Create"}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => navigate(-1)}
                    >
                      Cancel
                    </Button>
                  </div>
                </Form>
              </Card.Body>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}
