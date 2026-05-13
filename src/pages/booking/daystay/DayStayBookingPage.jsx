import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  Form,
  Button,
  Row,
  Col,
  Alert,
  Badge,
} from "react-bootstrap";
import { FaArrowLeft, FaCheckCircle } from "react-icons/fa";
import Sidebar from "../../../components/Sidebar";
import TopBar from "../../../components/TopBar";
import axiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";

/**
 * DayStayBookingPage — confirms guest details and persists a Day Stay booking
 * through POST /api/day-stay-booking/save.
 */
export default function DayStayBookingPage() {
  const navigate = useNavigate();
  const [payload, setPayload] = useState(null);
  const [form, setForm] = useState({
    primaryGuestName: "",
    primaryGuestEmail: "",
    primaryGuestPhone: "",
    remarks: "",
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [savedBooking, setSavedBooking] = useState(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("dayStayBookingPayload");
    if (!raw) return;
    try {
      setPayload(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  const set = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!form.primaryGuestName.trim()) e.primaryGuestName = "Required";
    if (!form.primaryGuestEmail.trim()) e.primaryGuestEmail = "Required";
    else if (!/^\S+@\S+\.\S+$/.test(form.primaryGuestEmail))
      e.primaryGuestEmail = "Invalid email";
    if (!form.primaryGuestPhone.trim()) e.primaryGuestPhone = "Required";
    return e;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!payload) {
      toast.error("Booking context missing — restart the flow.");
      return;
    }
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const body = {
      hotelId: payload.hotelId,
      agentId: Number(payload.agentId) || null,
      contractId: payload.contractId,
      checkInDate: payload.checkInDate,
      checkInTime: payload.checkInTime,
      checkOutTime: payload.checkOutTime,
      primaryGuestName: form.primaryGuestName.trim(),
      primaryGuestEmail: form.primaryGuestEmail.trim(),
      primaryGuestPhone: form.primaryGuestPhone.trim(),
      nationality: payload.nationality || null,
      totalAdults: Number(payload.adults) || 1,
      totalChildren: Number(payload.children) || 0,
      noOfRooms: Number(payload.rooms) || 1,
      roomCategory: payload.roomCategory,
      roomType: payload.roomType,
      totalAmount: payload.totalAmount,
      remarks: form.remarks?.trim() || null,
    };

    try {
      setSubmitting(true);
      const res = await axiosInstance.post(
        "/api/day-stay-booking/save",
        body
      );
      toast.success("Day Stay booking confirmed");
      setSavedBooking(res.data);
      sessionStorage.removeItem("dayStayBookingPayload");
    } catch (err) {
      const msg = err?.response?.data?.message || "Booking failed";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!payload && !savedBooking) {
    return (
      <div className="min-vh-100 bg-light d-flex flex-column">
        <TopBar />
        <div className="d-flex flex-grow-1">
          <Sidebar />
          <main className="flex-grow-1 p-4">
            <Card className="shadow-sm">
              <Card.Body className="text-center text-muted py-5">
                <h5>No booking in progress</h5>
                <Button
                  className="mt-2"
                  onClick={() => navigate("/new-booking/day-stay")}
                >
                  Go to Day Stay Search
                </Button>
              </Card.Body>
            </Card>
          </main>
        </div>
      </div>
    );
  }

  if (savedBooking) {
    return (
      <div className="min-vh-100 bg-light d-flex flex-column">
        <TopBar />
        <div className="d-flex flex-grow-1">
          <Sidebar />
          <main className="flex-grow-1 p-4">
            <Card className="shadow-sm">
              <Card.Body className="text-center py-5">
                <FaCheckCircle
                  size={48}
                  className="text-success mb-3"
                />
                <h4>Day Stay Booking Confirmed</h4>
                <p className="text-muted mb-2">
                  Reference:{" "}
                  <strong>{savedBooking.bookingCode || savedBooking.id}</strong>
                </p>
                <p className="mb-1">
                  {savedBooking.hotelName} — {savedBooking.checkInDate}
                </p>
                <p className="mb-1">
                  Check-in {savedBooking.checkInTime} → Check-out{" "}
                  {savedBooking.checkOutTime}
                </p>
                {savedBooking.totalAmount != null && (
                  <p className="mb-3">
                    Total:{" "}
                    <strong>
                      AED {Number(savedBooking.totalAmount).toLocaleString()}
                    </strong>
                  </p>
                )}
                <Button onClick={() => navigate("/new-booking/day-stay")}>
                  Make Another Day Stay Booking
                </Button>
              </Card.Body>
            </Card>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <div className="d-flex align-items-center gap-2 mb-3">
            <Button
              variant="light"
              onClick={() => navigate(-1)}
              className="d-flex align-items-center gap-2"
            >
              <FaArrowLeft /> Back
            </Button>
            <h5 className="mb-0">Confirm Day Stay Booking</h5>
          </div>

          <Row className="g-3">
            <Col lg={7}>
              <Card className="shadow-sm">
                <Card.Body>
                  <h6 className="fw-bold">Guest Details</h6>
                  <Form onSubmit={handleSubmit} noValidate>
                    <Row>
                      <Col md={12} className="mb-3">
                        <Form.Label>Primary Guest Name *</Form.Label>
                        <Form.Control
                          value={form.primaryGuestName}
                          isInvalid={!!errors.primaryGuestName}
                          onChange={(e) =>
                            set("primaryGuestName", e.target.value)
                          }
                        />
                        <Form.Control.Feedback type="invalid">
                          {errors.primaryGuestName}
                        </Form.Control.Feedback>
                      </Col>
                      <Col md={6} className="mb-3">
                        <Form.Label>Email *</Form.Label>
                        <Form.Control
                          type="email"
                          value={form.primaryGuestEmail}
                          isInvalid={!!errors.primaryGuestEmail}
                          onChange={(e) =>
                            set("primaryGuestEmail", e.target.value)
                          }
                        />
                        <Form.Control.Feedback type="invalid">
                          {errors.primaryGuestEmail}
                        </Form.Control.Feedback>
                      </Col>
                      <Col md={6} className="mb-3">
                        <Form.Label>Phone *</Form.Label>
                        <Form.Control
                          value={form.primaryGuestPhone}
                          isInvalid={!!errors.primaryGuestPhone}
                          onChange={(e) =>
                            set("primaryGuestPhone", e.target.value)
                          }
                        />
                        <Form.Control.Feedback type="invalid">
                          {errors.primaryGuestPhone}
                        </Form.Control.Feedback>
                      </Col>
                      <Col md={12} className="mb-3">
                        <Form.Label>Remarks</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={2}
                          value={form.remarks}
                          onChange={(e) => set("remarks", e.target.value)}
                        />
                      </Col>
                    </Row>

                    <Button
                      type="submit"
                      style={{ backgroundColor: "#0d6efd", border: "none" }}
                      disabled={submitting}
                    >
                      {submitting ? "Saving…" : "Confirm Booking"}
                    </Button>
                  </Form>
                </Card.Body>
              </Card>
            </Col>

            <Col lg={5}>
              <Card className="shadow-sm">
                <Card.Body>
                  <h6 className="fw-bold mb-3">Booking Summary</h6>
                  <p className="mb-2">
                    <strong>{payload.hotelName}</strong>
                  </p>
                  <p className="mb-1 text-muted small">
                    📍 {payload.hotelAddress || "—"}
                  </p>
                  <hr />
                  <p className="mb-1">
                    <strong>Date:</strong> {payload.checkInDate}
                  </p>
                  <p className="mb-1">
                    <strong>Check-in:</strong> {payload.checkInTime}
                  </p>
                  <p className="mb-1">
                    <strong>Check-out:</strong> {payload.checkOutTime}
                  </p>
                  <p className="mb-1">
                    <Badge bg="info">
                      Hotel window: {payload.windowStart} – {payload.windowEnd}
                    </Badge>
                  </p>
                  <hr />
                  <p className="mb-1">
                    <strong>Adults:</strong> {payload.adults} ·{" "}
                    <strong>Children:</strong> {payload.children} ·{" "}
                    <strong>Rooms:</strong> {payload.rooms}
                  </p>
                  {payload.roomType && (
                    <p className="mb-1">
                      <strong>Room:</strong> {payload.roomType}
                    </p>
                  )}
                  <hr />
                  <h5 className="mb-0 text-primary">
                    Total: AED {Number(payload.totalAmount || 0).toLocaleString()}
                  </h5>
                  <Alert variant="info" className="mt-3 py-2 small mb-0">
                    Day-stay check-outs may be auto-capped to the hotel's
                    window end on the server.
                  </Alert>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </main>
      </div>
    </div>
  );
}
