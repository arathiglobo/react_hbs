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
    salutation: "Mr",
    customerName: "",
    mobile: "",
    email: "",
    specialRequest: "",
    paymentMode: "Online",
    // Tourism Dirham — typed amount added on top of the package total. We
    // keep it as a string so the input behaves naturally.
    tourismDirham: "",
  });
  const [errors, setErrors] = useState({});
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Predefined add-on services for a honeymoon — agent ticks any that apply.
  const DEFAULT_ADDONS = [
    { key: "candleLightDinner", label: "Candle Light Dinner", price: 0 },
    { key: "sunsetCruise", label: "Sunset Cruise", price: 0 },
    { key: "couplesSpa", label: "Couples Spa", price: 0 },
    { key: "privatePoolVilla", label: "Private Pool Villa Upgrade", price: 0 },
    { key: "honeymoonCake", label: "Honeymoon Cake & Decoration", price: 0 },
    { key: "airportTransfer", label: "Private Airport Transfer", price: 0 },
  ];
  const [addons, setAddons] = useState(
    DEFAULT_ADDONS.map((a) => ({ ...a, checked: false }))
  );
  // Free-form custom addons — agent can add any extra item with a label
  // and (optional) price; both are added on top of the package total.
  const [extraServices, setExtraServices] = useState([
    { label: "", price: "" },
  ]);

  // Rates + the hotels included in the selected package. Mirrors the
  // /new-booking/package-booking Hotels section: hotels added in
  // HoneyMoonPackageRates show up here, get displayed during booking, and
  // are sent on the save payload so the booking detail view can list them.
  const [rates, setRates] = useState([]);
  const [includedHotels, setIncludedHotels] = useState([]);
  const [selectedRate, setSelectedRate] = useState(pkg?.selectedRate || null);

  useEffect(() => {
    if (!pkg) {
      toast.error("Please select a package first.");
      navigate("/new-booking/honeymoon");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await axiosInstance.get(
          `/api/honeymoon-package-rate?packageId=${pkg.id}`
        );
        const rows = Array.isArray(r.data) ? r.data : [];
        if (cancelled) return;
        setRates(rows);
        if (!selectedRate) {
          const match =
            rows.find(
              (rt) =>
                pkg?.noOfNights &&
                Number(rt.noOfNights) === Number(pkg.noOfNights)
            ) || rows[0] || null;
          setSelectedRate(match);
        }
        // Dedup hotels by hotelId — package-level inclusion list.
        const seen = new Map();
        rows.forEach((row) => {
          (row.hotels || []).forEach((h) => {
            if (!seen.has(h.hotelId)) {
              seen.set(h.hotelId, {
                hotelId: h.hotelId,
                hotelName: h.hotelName || `Hotel #${h.hotelId}`,
                placeName: row.placeName || "",
                countryName: row.countryName || "",
                noOfNights: row.noOfNights || null,
              });
            }
          });
        });
        setIncludedHotels(Array.from(seen.values()));
      } catch {
        if (!cancelled) {
          setRates([]);
          setIncludedHotels([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
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
    if (!form.salutation) e.salutation = "Salutation is required";
    if (!form.customerName.trim()) e.customerName = "Customer name is required";
    if (!form.mobile.trim()) e.mobile = "Mobile is required";
    else if (!/^[0-9+\-\s]{7,15}$/.test(form.mobile)) e.mobile = "Invalid mobile";
    if (form.email && !/\S+@\S+\.\S+/.test(form.email)) e.email = "Invalid email";
    return e;
  };

  const computeTotals = () => {
    const adults = Number(form.adults) || 0;
    const childCount = Number(form.children) || 0;
    const pax = Math.max(1, adults + childCount);

    // Pricing now comes from the package rate row (HoneymoonPackageRate).
    // Fall back to the legacy perPaxRate if no rate row is available.
    let baseTotal;
    let perPax;
    if (selectedRate) {
      const perAdult = Number(selectedRate.perAdultRate || 0);
      const perChild = Number(selectedRate.perChildWithBed || 0);
      baseTotal = perAdult * adults + perChild * childCount;
      perPax = pax > 0 ? baseTotal / pax : perAdult;
    } else {
      perPax = Number(pkg.baseRate ?? pkg.perPaxRate ?? 0);
      baseTotal = perPax * pax;
    }

    const markupPct = Number(pkg.markupPercent ?? 0);
    const markupAmount = (baseTotal * markupPct) / 100;
    const taxPct = 5;
    const taxable = baseTotal + markupAmount;
    const taxAmount = (taxable * taxPct) / 100;

    // Add-on services
    const addonsTotal = addons
      .filter((a) => a.checked)
      .reduce((s, a) => s + (Number(a.price) || 0), 0);
    const extrasTotal = extraServices.reduce(
      (s, e) => s + (Number(e.price) || 0),
      0
    );
    const tourismDirham = Number(form.tourismDirham) || 0;
    const addonsGrand = addonsTotal + extrasTotal + tourismDirham;

    const grandTotal = taxable + taxAmount + addonsGrand;
    return {
      perPax,
      pax,
      baseTotal,
      markupPct,
      markupAmount,
      taxPct,
      taxAmount,
      addonsTotal,
      extrasTotal,
      tourismDirham,
      addonsGrand,
      grandTotal,
    };
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
        salutation: form.salutation,
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
        // Persisted on the booking so the detail view shows which hotels
        // were part of the package the agent booked.
        selectedHotels: includedHotels,
        // Add-on services + tourism dirham — added on top of the package
        // total on the server side too (see HoneymoonBookingServiceImpl).
        addons: addons
          .filter((a) => a.checked)
          .map((a) => ({ label: a.label, price: Number(a.price) || 0 })),
        extraServices: extraServices
          .filter((e) => (e.label || "").trim())
          .map((e) => ({ label: e.label.trim(), price: Number(e.price) || 0 })),
        tourismDirham: Number(form.tourismDirham) || 0,
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

                  {/* Included hotels — mirror of /new-booking/package-booking Hotels section */}
                  <Card className="mb-3 shadow-sm">
                    <Card.Header className="bg-white fw-semibold">
                      Hotels Included in this Package
                    </Card.Header>
                    <Card.Body>
                      {includedHotels.length === 0 ? (
                        <div className="text-muted small">
                          No hotels have been added to this honeymoon package yet.
                          Configure them under Honeymoon → Add Rates.
                        </div>
                      ) : (
                        <Row className="g-3">
                          {includedHotels.map((h) => (
                            <Col key={h.hotelId} md={6}>
                              <div
                                style={{
                                  border: "1px solid #e9ecef",
                                  borderRadius: 8,
                                  padding: 12,
                                  background: "#fafbfd",
                                }}
                              >
                                <div className="d-flex justify-content-between align-items-start">
                                  <h6 className="mb-1">{h.hotelName}</h6>
                                  <Badge bg="success" style={{ fontSize: "0.65rem" }}>
                                    Included
                                  </Badge>
                                </div>
                                <div className="text-muted small">
                                  {[h.placeName, h.countryName]
                                    .filter(Boolean)
                                    .join(", ") || "—"}
                                </div>
                                {h.noOfNights ? (
                                  <Badge bg="light" text="dark" className="mt-2 border">
                                    {h.noOfNights} Night(s)
                                  </Badge>
                                ) : null}
                              </div>
                            </Col>
                          ))}
                        </Row>
                      )}
                    </Card.Body>
                  </Card>

                  <Card className="mb-3 shadow-sm">
                    <Card.Header className="bg-white fw-semibold">Travel Details</Card.Header>
                    <Card.Body>
                      <Row className="g-3">
                        <Col md={4}>
                          <div className="text-muted small mb-1">Starting Date</div>
                          <div className="fw-semibold">
                            {form.startingDate || "—"}
                          </div>
                        </Col>
                        <Col md={2}>
                          <div className="text-muted small mb-1">Rooms</div>
                          <div className="fw-semibold">{form.rooms}</div>
                        </Col>
                        <Col md={3}>
                          <div className="text-muted small mb-1">Adults</div>
                          <div className="fw-semibold">{form.adults}</div>
                        </Col>
                        <Col md={3}>
                          <div className="text-muted small mb-1">Children</div>
                          <div className="fw-semibold">{form.children}</div>
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>

                  <Card className="mb-3 shadow-sm">
                    <Card.Header className="bg-white fw-semibold">Customer Details</Card.Header>
                    <Card.Body>
                      <Row className="g-3">
                        <Col md={2}>
                          <Form.Label>Salutation *</Form.Label>
                          <Form.Select
                            name="salutation"
                            value={form.salutation}
                            onChange={handleChange}
                            isInvalid={!!errors.salutation}
                          >
                            <option value="Mr">Mr</option>
                            <option value="Mrs">Mrs</option>
                            <option value="Ms">Ms</option>
                            <option value="Miss">Miss</option>
                            <option value="Dr">Dr</option>
                            <option value="Mr & Mrs">Mr &amp; Mrs</option>
                          </Form.Select>
                          <Form.Control.Feedback type="invalid">{errors.salutation}</Form.Control.Feedback>
                        </Col>
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
                        <Col md={3}>
                          <Form.Label>Mobile *</Form.Label>
                          <Form.Control
                            name="mobile"
                            value={form.mobile}
                            onChange={handleChange}
                            isInvalid={!!errors.mobile}
                          />
                          <Form.Control.Feedback type="invalid">{errors.mobile}</Form.Control.Feedback>
                        </Col>
                        <Col md={3}>
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

                  {/* Add-on Services card — checkboxes for common honeymoon
                      addons, free-form rows for custom items, and Tourism
                      Dirham. All three contribute to the grand total. */}
                  <Card className="mb-3 shadow-sm">
                    <Card.Header className="bg-white fw-semibold">
                      Add-on Services
                    </Card.Header>
                    <Card.Body>
                      <Row className="g-3">
                        {addons.map((a, idx) => (
                          <Col md={6} key={a.key}>
                            <div className="d-flex align-items-center gap-2">
                              <Form.Check
                                type="checkbox"
                                id={`hm-addon-${a.key}`}
                                label={a.label}
                                checked={a.checked}
                                onChange={(e) =>
                                  setAddons((prev) =>
                                    prev.map((x, i) =>
                                      i === idx
                                        ? { ...x, checked: e.target.checked }
                                        : x
                                    )
                                  )
                                }
                              />
                              <Form.Control
                                type="number"
                                min={0}
                                step="0.01"
                                placeholder="Price"
                                value={a.price}
                                disabled={!a.checked}
                                onChange={(e) =>
                                  setAddons((prev) =>
                                    prev.map((x, i) =>
                                      i === idx
                                        ? { ...x, price: e.target.value }
                                        : x
                                    )
                                  )
                                }
                                style={{ maxWidth: 140 }}
                              />
                            </div>
                          </Col>
                        ))}
                      </Row>

                      <hr />
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <strong>Additional Services</strong>
                        <Button
                          size="sm"
                          variant="outline-success"
                          onClick={() =>
                            setExtraServices((p) => [...p, { label: "", price: "" }])
                          }
                        >
                          + Add Service
                        </Button>
                      </div>
                      {extraServices.map((row, i) => (
                        <Row className="g-2 mb-2 align-items-center" key={i}>
                          <Col md={7}>
                            <Form.Control
                              placeholder="Service name (e.g. Champagne welcome)"
                              value={row.label}
                              onChange={(e) =>
                                setExtraServices((p) =>
                                  p.map((x, idx) =>
                                    idx === i ? { ...x, label: e.target.value } : x
                                  )
                                )
                              }
                            />
                          </Col>
                          <Col md={4}>
                            <Form.Control
                              type="number"
                              min={0}
                              step="0.01"
                              placeholder="Price"
                              value={row.price}
                              onChange={(e) =>
                                setExtraServices((p) =>
                                  p.map((x, idx) =>
                                    idx === i ? { ...x, price: e.target.value } : x
                                  )
                                )
                              }
                            />
                          </Col>
                          <Col md={1} className="text-end">
                            <Button
                              size="sm"
                              variant="outline-danger"
                              disabled={extraServices.length === 1}
                              onClick={() =>
                                setExtraServices((p) =>
                                  p.length === 1
                                    ? p
                                    : p.filter((_, idx) => idx !== i)
                                )
                              }
                            >
                              ×
                            </Button>
                          </Col>
                        </Row>
                      ))}

                      <hr />
                      <Row className="g-2 align-items-center">
                        <Col md={6}>
                          <Form.Label className="mb-0 fw-semibold">
                            Tourism Dirham
                          </Form.Label>
                          <div className="text-muted small">
                            Government tourism fee — added to the package total.
                          </div>
                        </Col>
                        <Col md={6}>
                          <Form.Control
                            type="number"
                            min={0}
                            step="0.01"
                            name="tourismDirham"
                            placeholder="0.00"
                            value={form.tourismDirham}
                            onChange={handleChange}
                          />
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>
                </Col>

                <Col lg={4}>
                  <div className="sticky-top" style={{ top: 80 }}>
                    <Card className="shadow-sm">
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
                        {(totals.addonsTotal > 0 ||
                          totals.extrasTotal > 0 ||
                          totals.tourismDirham > 0) && (
                          <>
                            {totals.addonsTotal > 0 && (
                              <div className="d-flex justify-content-between small text-primary">
                                <span>Add-ons</span>
                                <span>+ ₹ {totals.addonsTotal.toFixed(2)}</span>
                              </div>
                            )}
                            {totals.extrasTotal > 0 && (
                              <div className="d-flex justify-content-between small text-primary">
                                <span>Extra Services</span>
                                <span>+ ₹ {totals.extrasTotal.toFixed(2)}</span>
                              </div>
                            )}
                            {totals.tourismDirham > 0 && (
                              <div className="d-flex justify-content-between small text-primary">
                                <span>Tourism Dirham</span>
                                <span>+ ₹ {totals.tourismDirham.toFixed(2)}</span>
                              </div>
                            )}
                          </>
                        )}
                        <hr />
                        <div className="d-flex justify-content-between fs-5 fw-bold">
                          <span>Total</span>
                          <span className="text-success">₹ {totals.grandTotal.toFixed(2)}</span>
                        </div>
                      </Card.Body>
                    </Card>
                    <Button
                      type="submit"
                      variant="primary"
                      size="lg"
                      className="w-100 mt-3 rounded-pill"
                      disabled={saving}
                    >
                      <FaCheck className="me-2" /> Review &amp; Submit
                    </Button>
                  </div>
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
