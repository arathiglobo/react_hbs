import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Card, Form, Button, Row, Col, Spinner, Alert } from "react-bootstrap";
import { FaArrowLeft } from "react-icons/fa";
import Sidebar from "../../../components/Sidebar";
import Topbar from "../../../components/TopBar";
import axiosInstance from "../../../components/AxiosInstance";
import HotelTitleBadge from "../../../components/HotelTitleBadge";
import { toast } from "react-hot-toast";

/**
 * Hotel24HourCheckinForm
 *
 * One component used for both CREATE and EDIT (mode is decided by whether the
 * route has a :configId param). Posts to:
 *   POST /api/24-hour-checkin/save        (create)
 *   PUT  /api/24-hour-checkin/{id}        (edit)
 *
 * Fields mirror the backend DTO 1:1: validityFrom/To, checkInStartTime/EndTime,
 * percentage, active, remarks.
 */
export default function Hotel24HourCheckinForm({ mode }) {
  const navigate = useNavigate();
  const { id: hotelId, configId } = useParams();
  const isEdit = mode === "edit";

  // View mode — when the URL carries `?mode=view`, the form renders
  // read-only. We reuse this same Edit screen so all the populated
  // fields show with the row's data, just disabled. Mirrors the
  // /occupancy-and-minimumlength view pattern.
  const [searchParams] = useSearchParams();
  const isViewMode = searchParams.get("mode") === "view";

  // Local form state; field names match the backend DTO so submit is trivial.
  const [form, setForm] = useState({
    validityFrom: "",
    validityTo: "",
    checkInStartTime: "00:00",
    checkInEndTime: "23:59",
    percentage: "",
    active: true,
    remarks: "",
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [errors, setErrors] = useState({});

  // Auto-grow Remarks — the textarea defaults to rows={2} which clips
  // longer notes behind a scrollbar. We keep it as a real textarea
  // (the operator needs to edit it), but resize it to its scrollHeight
  // every time the value changes so the full text is always visible
  // without scroll. Mirrors the read-only treatment we use on the
  // view page.
  const remarksRef = useRef(null);
  useEffect(() => {
    const el = remarksRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [form.remarks, loading]);

  // On edit, hydrate from the existing config.
  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        if (isEdit && configId) {
          const res = await axiosInstance.get(`/api/24-hour-checkin/${configId}`);
          const e = res.data;
          setForm({
            validityFrom: e.validityFrom || "",
            validityTo: e.validityTo || "",
            checkInStartTime: e.checkInStartTime || "00:00",
            checkInEndTime: e.checkInEndTime || "23:59",
            percentage: e.percentage ?? "",
            active: e.active !== false,
            remarks: e.remarks || "",
          });
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to load configuration");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [isEdit, configId]);

  const set = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
    setServerError(null);
  };

  // Client-side validation — mirrors what the backend will check.
  const validate = () => {
    const e = {};
    if (!form.validityFrom) e.validityFrom = "Required";
    if (!form.validityTo) e.validityTo = "Required";
    if (form.validityFrom && form.validityTo && form.validityFrom > form.validityTo)
      e.validityTo = "Validity To must be on/after Validity From";
    if (form.percentage === "" || form.percentage == null)
      e.percentage = "Required";
    else if (Number(form.percentage) < 0)
      e.percentage = "Cannot be negative";
    if (form.checkInStartTime && form.checkInEndTime &&
        form.checkInStartTime > form.checkInEndTime)
      e.checkInEndTime = "End time must be after start time";
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const payload = {
      hotelId: Number(hotelId),
      validityFrom: form.validityFrom,
      validityTo: form.validityTo,
      checkInStartTime: form.checkInStartTime,
      checkInEndTime: form.checkInEndTime,
      percentage: Number(form.percentage),
      active: !!form.active,
      remarks: form.remarks?.trim() || null,
    };

    try {
      setSubmitting(true);
      if (isEdit) {
        await axiosInstance.put(`/api/24-hour-checkin/${configId}`, payload);
        toast.success("Updated");
      } else {
        await axiosInstance.post(`/api/24-hour-checkin/save`, payload);
        toast.success("Created");
      }
      navigate(`/hotel-actions/${hotelId}/24-hour-checkin`);
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
            <h5 className="mb-0 d-flex align-items-center gap-2">
              {isViewMode ? "View" : isEdit ? "Edit" : "Add"} 24 Hour Check-In Configuration
              <HotelTitleBadge hotelId={hotelId} />
            </h5>
          </div>

          {loading ? (
            <div className="text-center py-5"><Spinner animation="border" /></div>
          ) : (
            <Card className="shadow-sm">
              <Card.Body>
                <Alert variant="info" className="py-2 mb-3" style={{ fontSize: "0.85rem" }}>
                  Configure the validity range and percentage uplift for 24-hour
                  check-in at this hotel. The markup is applied to the matching
                  contract rate when guests opt in to 24-hour check-in.
                </Alert>

                {serverError && (
                  <Alert variant="danger" className="py-2 mb-3">{serverError}</Alert>
                )}

                <Form onSubmit={handleSubmit} noValidate>
                  <fieldset disabled={isViewMode}>
                  <Row>
                    <Col md={4} className="mb-3">
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
                    <Col md={4} className="mb-3">
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
                    <Col md={4} className="mb-3">
                      <Form.Label>Markup Percentage *</Form.Label>
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
                    <Col md={4} className="mb-3">
                      <Form.Label>Check-In Window — Start</Form.Label>
                      <Form.Control
                        type="time"
                        value={form.checkInStartTime}
                        onChange={(e) => set("checkInStartTime", e.target.value)}
                      />
                      <small className="text-muted">
                        Earliest time of day a 24-hour check-in is allowed.
                      </small>
                    </Col>
                    <Col md={4} className="mb-3">
                      <Form.Label>Check-In Window — End</Form.Label>
                      <Form.Control
                        type="time"
                        value={form.checkInEndTime}
                        isInvalid={!!errors.checkInEndTime}
                        onChange={(e) => set("checkInEndTime", e.target.value)}
                      />
                      <Form.Control.Feedback type="invalid">
                        {errors.checkInEndTime}
                      </Form.Control.Feedback>
                      <small className="text-muted">
                        Latest time of day a 24-hour check-in is allowed.
                      </small>
                    </Col>
                    {/* Active toggle removed from the form — the
                        list page surfaces Active / Inactive via the
                        clickable status badge, so duplicating it here
                        was confusing. `form.active` is still seeded
                        from the loaded record (defaults to true on
                        create) and shipped in the save payload so
                        the row stays Active by default. */}
                  </Row>

                  <Row>
                    <Col md={12} className="mb-3">
                      <Form.Label>Remarks</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={2}
                        ref={remarksRef}
                        value={form.remarks}
                        onChange={(e) => set("remarks", e.target.value)}
                        placeholder="Optional notes about this configuration"
                        // overflow hidden + resize none lets the
                        // useEffect above grow the box to its
                        // scrollHeight on every keystroke without a
                        // scrollbar ever appearing.
                        style={{ overflow: "hidden", resize: "none" }}
                      />
                    </Col>
                  </Row>

                  </fieldset>
                  <div className="d-flex justify-content-end gap-2 mt-3">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => navigate(-1)}
                    >
                      {isViewMode ? "Close" : "Cancel"}
                    </Button>
                    {!isViewMode && (
                      <Button
                        type="submit"
                        disabled={submitting}
                        style={{ backgroundColor: "#0d6efd", border: "none" }}
                      >
                        {submitting ? "Saving…" : isEdit ? "Update" : "Create"}
                      </Button>
                    )}
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
