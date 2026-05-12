import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Card,
  Form,
  Row,
  Col,
  Button,
  Badge,
  Spinner,
  Container,
  Modal,
  Table,
} from "react-bootstrap";
import {
  FaArrowLeft,
  FaSuitcaseRolling,
  FaSave,
  FaCheck,
  FaCheckCircle,
} from "react-icons/fa";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";

const PAYMENT_MODES = ["Cash", "Card", "UPI", "Online", "Net Banking"];

const HoneymoonBooking = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const incoming = location.state || {};
  const pkg = incoming.pkg;
  const sf = incoming.searchForm || {};

  const [form, setForm] = useState({
    startingDate: sf.startingDate || new Date().toISOString().slice(0, 10),
    rooms: sf.rooms || 1,
    adults: sf.adults || 2,
    children: sf.children || 0,
    customerName: "",
    mobile: "",
    email: "",
    specialRequest: "",
    paymentMode: "Online",
  });
  const [errors, setErrors] = useState({});
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!pkg) {
      toast.error("Please select a package first.");
      navigate("/new-booking/honeymoon");
    }
  }, [pkg, navigate]);

  if (!pkg) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    if (errors[name]) setErrors((p) => ({ ...p, [name]: "" }));
  };

  const validate = () => {
    const e = {};
    if (!form.startingDate) e.startingDate = "Starting date is required";
    else if (form.startingDate < new Date().toISOString().slice(0, 10))
      e.startingDate = "Date cannot be in the past";
    if (!form.rooms || Number(form.rooms) < 1) e.rooms = "At least 1 room";
    if (!form.adults || Number(form.adults) < 1) e.adults = "At least 1 adult";
    if (!form.customerName.trim()) e.customerName = "Customer name is required";
    if (!form.mobile.trim()) e.mobile = "Mobile is required";
    else if (!/^[0-9+\-\s]{7,15}$/.test(form.mobile)) e.mobile = "Invalid mobile";
    if (form.email && !/\S+@\S+\.\S+/.test(form.email)) e.email = "Invalid email";
    return e;
  };

  const computeTotals = () => {
    const perPax = Number(pkg.baseRate ?? pkg.perPaxRate ?? 0);
    const pax = Number(form.adults) + Number(form.children);
    const baseTotal = perPax * pax;
    const markupPct = Number(pkg.markupPercent ?? 0);
    const markupAmount = (baseTotal * markupPct) / 100;
    const taxPct = 5;
    const taxable = baseTotal + markupAmount;
    const taxAmount = (taxable * taxPct) / 100;
    const grandTotal = taxable + taxAmount;
    return { perPax, pax, baseTotal, markupPct, markupAmount, taxPct, taxAmount, grandTotal };
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const err = validate();
    setErrors(err);
    if (Object.keys(err).length) {
      toast.error("Please fix the highlighted fields");
      return;
    }
    setSummaryOpen(true);
  };

  const confirmAndSave = async () => {
    setSaving(true);
    try {
      const { perPax, markupPct, taxPct } = computeTotals();
      const payload = {
        packageId: pkg.id,
        startingDate: form.startingDate,
        noOfNights: pkg.noOfNights,
        rooms: Number(form.rooms),
        adults: Number(form.adults),
        children: Number(form.children),
        customerName: form.customerName,
        mobile: form.mobile,
        email: form.email,
        agentId: sf.agentId ? Number(sf.agentId) : null,
        agentName: sf.agentName || null,
        specialRequest: form.specialRequest,
        baseRate: perPax,
        markupPercent: markupPct,
        taxPercent: taxPct,
        paymentMode: form.paymentMode,
      };
      const res = await axiosInstance.post("/api/honeymoon/booking/save", payload);
      setSummaryOpen(false);
      await Swal.fire({
        icon: "success",
        title: "Booking Confirmed!",
        html: `<div>Your booking number is <strong>${res.data?.bookingNumber}</strong></div>`,
        confirmButtonText: "View Bookings",
      });
      navigate("/booking-details/honeymoon-booking-list");
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.message || "Failed to save booking");
    } finally {
      setSaving(false);
    }
  };

  const totals = computeTotals();

  return (
    <div
      className="min-vh-100 d-flex flex-column"
      style={{ background: "#f5f7fb" }}
    >
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Container fluid>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h4 className="mb-0 text-primary">
                <FaSuitcaseRolling className="me-2" /> Honeymoon Booking
              </h4>
              <Button variant="outline-secondary" size="sm" onClick={() => navigate(-1)} className="rounded-pill">
                <FaArrowLeft className="me-1" /> Back
              </Button>
            </div>

            <Form onSubmit={handleSubmit} noValidate>
              <Row>
                <Col lg={8}>
                  <Card className="mb-3 shadow-sm">
                    <Card.Header className="bg-white fw-semibold">Selected Package</Card.Header>
                    <Card.Body>
                      <Row className="g-3 align-items-center">
                        <Col md={3}>
                          <img
                            src={pkg.images?.[0] || "/images/not-available.jpg"}
                            alt={pkg.packageName}
                            style={{
                              width: "100%",
                              height: 120,
                              objectFit: "cover",
                              borderRadius: 6,
                            }}
                          />
                        </Col>
                        <Col md={9}>
                          <h5 className="mb-1 text-primary">{pkg.packageName}</h5>
                          <div className="text-muted small">
                            {pkg.startingFrom} → {pkg.destination} · {pkg.noOfNights}N/{pkg.noOfDays}D
                          </div>
                          <div className="mt-1 d-flex flex-wrap gap-1">
                            {pkg.category && <Badge bg="light" text="dark" className="border">{pkg.category}</Badge>}
                            {pkg.theme && <Badge bg="light" text="dark" className="border">{pkg.theme}</Badge>}
                            {pkg.hotelCategory && <Badge bg="info">{pkg.hotelCategory}</Badge>}
                          </div>
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>

                  <Card className="mb-3 shadow-sm">
                    <Card.Header className="bg-white fw-semibold">Travel Details</Card.Header>
                    <Card.Body>
                      <Row className="g-3">
                        <Col md={4}>
                          <Form.Label>Starting Date *</Form.Label>
                          <Form.Control
                            type="date"
                            name="startingDate"
                            value={form.startingDate}
                            onChange={handleChange}
                            min={new Date().toISOString().slice(0, 10)}
                            isInvalid={!!errors.startingDate}
                          />
                          <Form.Control.Feedback type="invalid">{errors.startingDate}</Form.Control.Feedback>
                        </Col>
                        <Col md={2}>
                          <Form.Label>Rooms *</Form.Label>
                          <Form.Control
                            type="number"
                            min={1}
                            name="rooms"
                            value={form.rooms}
                            onChange={handleChange}
                            isInvalid={!!errors.rooms}
                          />
                          <Form.Control.Feedback type="invalid">{errors.rooms}</Form.Control.Feedback>
                        </Col>
                        <Col md={3}>
                          <Form.Label>Adults *</Form.Label>
                          <Form.Control
                            type="number"
                            min={1}
                            name="adults"
                            value={form.adults}
                            onChange={handleChange}
                            isInvalid={!!errors.adults}
                          />
                          <Form.Control.Feedback type="invalid">{errors.adults}</Form.Control.Feedback>
                        </Col>
                        <Col md={3}>
                          <Form.Label>Children</Form.Label>
                          <Form.Control
                            type="number"
                            min={0}
                            name="children"
                            value={form.children}
                            onChange={handleChange}
                          />
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>

                  <Card className="mb-3 shadow-sm">
                    <Card.Header className="bg-white fw-semibold">Customer Details</Card.Header>
                    <Card.Body>
                      <Row className="g-3">
                        <Col md={4}>
                          <Form.Label>Customer Name *</Form.Label>
                          <Form.Control
                            name="customerName"
                            value={form.customerName}
                            onChange={handleChange}
                            isInvalid={!!errors.customerName}
                          />
                          <Form.Control.Feedback type="invalid">{errors.customerName}</Form.Control.Feedback>
                        </Col>
                        <Col md={4}>
                          <Form.Label>Mobile *</Form.Label>
                          <Form.Control
                            name="mobile"
                            value={form.mobile}
                            onChange={handleChange}
                            isInvalid={!!errors.mobile}
                          />
                          <Form.Control.Feedback type="invalid">{errors.mobile}</Form.Control.Feedback>
                        </Col>
                        <Col md={4}>
                          <Form.Label>Email</Form.Label>
                          <Form.Control
                            type="email"
                            name="email"
                            value={form.email}
                            onChange={handleChange}
                            isInvalid={!!errors.email}
                          />
                          <Form.Control.Feedback type="invalid">{errors.email}</Form.Control.Feedback>
                        </Col>
                        <Col md={6}>
                          <Form.Label>Agent</Form.Label>
                          <Form.Control value={sf.agentName || "-"} readOnly disabled />
                        </Col>
                        <Col md={6}>
                          <Form.Label>Payment Mode</Form.Label>
                          <Form.Select name="paymentMode" value={form.paymentMode} onChange={handleChange}>
                            {PAYMENT_MODES.map((p) => <option key={p}>{p}</option>)}
                          </Form.Select>
                        </Col>
                        <Col md={12}>
                          <Form.Label>Special Request</Form.Label>
                          <Form.Control
                            as="textarea"
                            rows={2}
                            name="specialRequest"
                            value={form.specialRequest}
                            onChange={handleChange}
                          />
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>
                </Col>

                <Col lg={4}>
                  <Card className="shadow-sm sticky-top" style={{ top: 80 }}>
                    <Card.Header className="bg-danger text-white fw-semibold">
                      <FaSuitcaseRolling className="me-2" /> Price Summary
                    </Card.Header>
                    <Card.Body>
                      <h6 className="mb-2">{pkg.packageName}</h6>
                      <div className="small text-muted mb-3">{pkg.destination}</div>
                      <div className="d-flex justify-content-between small">
                        <span>Per pax</span>
                        <span>₹ {totals.perPax.toLocaleString()}</span>
                      </div>
                      <div className="d-flex justify-content-between small">
                        <span>Pax</span>
                        <span>{totals.pax}</span>
                      </div>
                      <hr />
                      <div className="d-flex justify-content-between">
                        <span>Base Total</span>
                        <span>₹ {totals.baseTotal.toLocaleString()}</span>
                      </div>
                      {totals.markupPct > 0 && (
                        <div className="d-flex justify-content-between text-info small">
                          <span>Markup ({totals.markupPct}%)</span>
                          <span>+ ₹ {totals.markupAmount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="d-flex justify-content-between text-muted small">
                        <span>Tax ({totals.taxPct}%)</span>
                        <span>₹ {totals.taxAmount.toFixed(2)}</span>
                      </div>
                      <hr />
                      <div className="d-flex justify-content-between fs-5 fw-bold">
                        <span>Total</span>
                        <span className="text-success">₹ {totals.grandTotal.toFixed(2)}</span>
                      </div>
                    </Card.Body>
                  </Card>
                  <Button type="submit" variant="primary" size="lg" className="w-100 mt-3 rounded-pill" disabled={saving}>
                    <FaCheck className="me-2" /> Review &amp; Submit
                  </Button>
                </Col>
              </Row>
            </Form>
          </Container>
        </main>
      </div>

      <Modal show={summaryOpen} onHide={() => !saving && setSummaryOpen(false)} size="lg" centered backdrop="static">
        <Modal.Header closeButton={!saving}>
          <Modal.Title>
            <FaCheckCircle className="text-success me-2" /> Order Summary
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Row className="g-2 mb-3">
            <Col md={6}><strong>Package:</strong> {pkg.packageName}</Col>
            <Col md={6}><strong>Route:</strong> {pkg.startingFrom} → {pkg.destination}</Col>
            <Col md={6}><strong>Starting Date:</strong> {form.startingDate}</Col>
            <Col md={6}><strong>Nights / Days:</strong> {pkg.noOfNights} / {pkg.noOfDays}</Col>
            <Col md={6}><strong>Rooms:</strong> {form.rooms}</Col>
            <Col md={6}><strong>Pax:</strong> {form.adults} Adult{form.adults != 1 ? "s" : ""}{form.children > 0 ? `, ${form.children} Children` : ""}</Col>
            <Col md={6}><strong>Customer:</strong> {form.customerName} ({form.mobile})</Col>
            <Col md={6}><strong>Agent:</strong> {sf.agentName || "-"}</Col>
            <Col md={12}><strong>Special Request:</strong> {form.specialRequest || "-"}</Col>
          </Row>
          <Table size="sm" bordered>
            <tbody>
              <tr><td>Per pax</td><td className="text-end">₹ {totals.perPax.toLocaleString()}</td></tr>
              <tr><td>Base Total ({totals.pax} pax)</td><td className="text-end">₹ {totals.baseTotal.toLocaleString()}</td></tr>
              {totals.markupPct > 0 && (
                <tr><td>Markup ({totals.markupPct}%)</td><td className="text-end">₹ {totals.markupAmount.toFixed(2)}</td></tr>
              )}
              <tr><td>Tax ({totals.taxPct}%)</td><td className="text-end">₹ {totals.taxAmount.toFixed(2)}</td></tr>
              <tr className="table-light fw-bold">
                <td>Grand Total</td>
                <td className="text-end text-success">₹ {totals.grandTotal.toFixed(2)}</td>
              </tr>
            </tbody>
          </Table>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" disabled={saving} onClick={() => setSummaryOpen(false)}>
            Edit
          </Button>
          <Button variant="primary" disabled={saving} onClick={confirmAndSave}>
            {saving ? <><Spinner size="sm" animation="border" className="me-2" /> Saving...</> : <><FaSave className="me-2" /> Confirm Booking</>}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default HoneymoonBooking;
