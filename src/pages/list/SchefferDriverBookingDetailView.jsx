/**
 * SchefferDriverBookingDetailView.jsx
 *
 * Full-page detail view for a single Scheffer Driver booking. Replaces
 * the modal-based "View" that used to live in SchefferDriverBookingList.
 * Per-row Cancel / Voucher / Record-actual-usage icons now sit at the
 * bottom-left of this page as buttons. All endpoints / behavior are
 * unchanged:
 *   - Booking detail:  GET    /api/scheffer/booking/{id}
 *   - Voucher PDF:     GET    /api/scheffer/{id}/voucher          (blob)
 *   - Cancel:          DELETE /api/scheffer/delete/{id}
 *   - Record usage:    PUT    /api/scheffer/{id}/usage
 *
 * Booking summary is passed via location.state when the user clicks the
 * eye icon; on hard refresh we re-fetch from /booking/{id}.
 */
import React, { useEffect, useState } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Table,
  Badge,
  Spinner,
  Form,
  Modal,
  Button,
} from "react-bootstrap";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  FaCar,
  FaTrash,
  FaFileAlt,
  FaRoad,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaEnvelope,
  FaIdCard,
} from "react-icons/fa";
import { toast } from "react-hot-toast";
import axiosInstance from "../../components/AxiosInstance";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";

const API_BASE = "/api/scheffer";

const BUTTON_STYLE = {
  color: "#fff",
  border: "none",
  borderRadius: "3px",
  padding: "6px 14px",
  fontSize: "0.78rem",
  fontWeight: "600",
  cursor: "pointer",
  letterSpacing: "0.4px",
  whiteSpace: "nowrap",
};

const fmtDate = (d) => (d ? String(d).split("T")[0] : "-");
const FaUserAltIcon = () => (
  <i className="fas fa-user" style={{ marginRight: 4 }} />
);

export default function SchefferDriverBookingDetailView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Booking summary — location.state.booking when navigating from list,
  // re-fetched from /booking/{id} on hard refresh.
  const [details, setDetails] = useState(location.state?.booking || null);
  const [loading, setLoading] = useState(!details);

  // Cancel modal
  const [showCancel, setShowCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Voucher (PDF) modal
  const [showPdf, setShowPdf] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loadingPdf, setLoadingPdf] = useState(false);

  // Actual-usage modal
  const [showUsage, setShowUsage] = useState(false);
  const [savingUsage, setSavingUsage] = useState(false);
  const [usageForm, setUsageForm] = useState({
    actualHoursUsed: "",
    actualKmUsed: "",
    intercityFromCityId: "",
    intercityToCityId: "",
  });
  const [cityList, setCityList] = useState([]);

  const fetchBooking = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(`${API_BASE}/booking/${id}`);
      setDetails(res.data);
    } catch (e) {
      console.error("Failed to load booking", e);
      toast.error("Failed to load booking");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!details) fetchBooking();
    // eslint-disable-next-line
  }, [id]);

  // Cities used by the Record-Actual-Usage modal's intercity selects.
  useEffect(() => {
    (async () => {
      try {
        const r = await axiosInstance.get("/api/province", {
          params: { limit: 500 },
        });
        const items = Array.isArray(r.data) ? r.data : r.data?.content || [];
        setCityList(
          items.map((it) => ({
            id: it.id ?? it.stateId ?? it.placeid ?? it.provinceId,
            name: it.name ?? it.stateName ?? it.placeName ?? it.provinceName,
          })),
        );
      } catch (e) {
        console.error("Error loading cities:", e);
      }
    })();
  }, []);

  const cityName = (cid) => {
    const c = cityList.find((x) => String(x.id) === String(cid));
    return c ? c.name : "";
  };

  const isCancelled = details?.status === "CANCELLED";

  // ── Cancel ──────────────────────────────────────────────────────
  const doCancel = async () => {
    if (!details) return;
    const bid = details.id || details.custombookingId;
    if (!bid) return;
    setCancelling(true);
    try {
      await axiosInstance.delete(`${API_BASE}/delete/${bid}`);
      toast.success("Booking cancelled");
      setShowCancel(false);
      fetchBooking();
    } catch (e) {
      console.error("Cancel error:", e);
      toast.error("Failed to cancel booking");
    } finally {
      setCancelling(false);
    }
  };

  // ── Voucher PDF ─────────────────────────────────────────────────
  const onVoucher = async () => {
    if (!details) return;
    const bid = details.id || details.custombookingId;
    if (!bid) return;
    setShowPdf(true);
    setLoadingPdf(true);
    setPdfUrl(null);
    try {
      const res = await axiosInstance.get(`${API_BASE}/${bid}/voucher`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/pdf" });
      setPdfUrl(URL.createObjectURL(blob));
    } catch (e) {
      console.error("Voucher error:", e);
      toast.error("Failed to generate voucher");
    } finally {
      setLoadingPdf(false);
    }
  };

  const closePdf = () => {
    setShowPdf(false);
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(null);
  };

  // ── Record Actual Usage ─────────────────────────────────────────
  const openUsage = () => {
    if (!details) return;
    setUsageForm({
      actualHoursUsed:
        details.actualHoursUsed != null ? details.actualHoursUsed : "",
      actualKmUsed:
        details.actualKmUsed != null ? details.actualKmUsed : "",
      intercityFromCityId: "",
      intercityToCityId: "",
    });
    setShowUsage(true);
  };

  const saveUsage = async () => {
    if (!details) return;
    const bid = details.id || details.custombookingId;
    setSavingUsage(true);
    try {
      const payload = {
        actualHoursUsed:
          usageForm.actualHoursUsed === ""
            ? null
            : Number(usageForm.actualHoursUsed),
        actualKmUsed:
          usageForm.actualKmUsed === ""
            ? null
            : Number(usageForm.actualKmUsed),
        intercityFromCityId: usageForm.intercityFromCityId
          ? Number(usageForm.intercityFromCityId)
          : null,
        intercityFromCity: usageForm.intercityFromCityId
          ? cityName(usageForm.intercityFromCityId)
          : null,
        intercityToCityId: usageForm.intercityToCityId
          ? Number(usageForm.intercityToCityId)
          : null,
        intercityToCity: usageForm.intercityToCityId
          ? cityName(usageForm.intercityToCityId)
          : null,
      };
      await axiosInstance.put(`${API_BASE}/${bid}/usage`, payload);
      toast.success("Usage updated — final amount recalculated");
      setShowUsage(false);
      fetchBooking();
    } catch (e) {
      console.error("Usage update error:", e);
      toast.error("Failed to update usage");
    } finally {
      setSavingUsage(false);
    }
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4" style={{ overflow: "auto" }}>
          <Container fluid style={{ maxWidth: "1100px" }}>
            {/* Header */}
            <div className="mb-3 d-flex align-items-center flex-wrap gap-2">
              <button
                style={{ ...BUTTON_STYLE, backgroundColor: "#555" }}
                onClick={() => navigate(-1)}
              >
                ← Back
              </button>
              <span
                className="d-flex align-items-center"
                style={{
                  marginLeft: "12px",
                  fontWeight: "700",
                  fontSize: "1.1rem",
                  color: "#333",
                }}
              >
                <FaCar className="me-2 text-success" />
                Booking Details
                {details?.bookingCode && (
                  <Badge bg="success" className="ms-3 fw-semibold">
                    {details.bookingCode}
                  </Badge>
                )}
              </span>
            </div>

            {loading ? (
              <div className="text-center py-5">
                <Spinner animation="border" />
                <p className="mt-3 text-muted">Loading booking details...</p>
              </div>
            ) : !details ? (
              <div className="text-center py-5 text-muted">
                Booking not found.
              </div>
            ) : (
              <>
                {/* Trip Information */}
                <Card className="mb-3">
                  <Card.Header
                    className="fw-semibold"
                    style={{ backgroundColor: "#f1f3f5" }}
                  >
                    Trip Information
                  </Card.Header>
                  <Card.Body>
                    <Table size="sm" borderless className="mb-0">
                      <tbody>
                        <tr>
                          <th style={{ width: 180 }}>Booking Code</th>
                          <td>
                            {details.bookingCode ||
                              details.packageBookCode ||
                              "-"}
                          </td>
                        </tr>
                        <tr>
                          <th>Status</th>
                          <td>
                            <Badge
                              bg={isCancelled ? "danger" : "success"}
                            >
                              {details.status || "CONFIRMED"}
                            </Badge>
                          </td>
                        </tr>
                        <tr>
                          <th>Cab</th>
                          <td>
                            {details.cabName || "-"} (
                            {details.cabProviderName || "-"})
                          </td>
                        </tr>
                        <tr>
                          <th>
                            <FaMapMarkerAlt className="text-success me-1" />
                            Pickup
                          </th>
                          <td>
                            {fmtDate(details.pickupDate)} —{" "}
                            {details.pickupName || "-"}{" "}
                            {details.pickupTime
                              ? `@ ${details.pickupTime}`
                              : ""}
                          </td>
                        </tr>
                        <tr>
                          <th>
                            <FaMapMarkerAlt className="text-danger me-1" />
                            Dropoff
                          </th>
                          <td>
                            {fmtDate(details.dropOffDate)} —{" "}
                            {details.dropoffName || "-"}{" "}
                            {details.dropoffTime
                              ? `@ ${details.dropoffTime}`
                              : ""}
                          </td>
                        </tr>
                        <tr>
                          <th>Hours</th>
                          <td>{details.hourDetails ?? "-"}</td>
                        </tr>
                        <tr>
                          <th>Pax</th>
                          <td>
                            
                              {details.noOfAdult || 0} ADT /{" "}
                              {details.noOfChild || 0} CHD
                           
                          </td>
                        </tr>
                        <tr>
                          <th>Luggage</th>
                          <td>{details.luggage ? "Yes" : "No"}</td>
                        </tr>
                        {(details.transporter || details.driverName) && (
                          <tr>
                            <th>Transporter / Driver</th>
                            <td>
                              {details.transporter || "-"}
                              {details.contactNumber && (
                                <>
                                  {" "}
                                  · <FaPhoneAlt size={10} />{" "}
                                  {details.contactNumber}
                                </>
                              )}
                              {details.driverName && (
                                <> · {details.driverName}</>
                              )}
                              {details.driverContact && (
                                <>
                                  {" "}
                                  · <FaPhoneAlt size={10} />{" "}
                                  {details.driverContact}
                                </>
                              )}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </Table>
                  </Card.Body>
                </Card>

                {/* Passengers */}
                <Card className="mb-3">
                  <Card.Header
                    className="fw-semibold"
                    style={{ backgroundColor: "#f1f3f5" }}
                  >
                    Passengers (
                    {(details.noOfAdult || 0) + (details.noOfChild || 0)})
                  </Card.Header>
                  <Card.Body className="p-0">
                    {details.guests && details.guests.length > 0 ? (
                      <Table size="sm" bordered className="mb-0">
                        <thead className="bg-light">
                          <tr>
                            <th>#</th>
                            <th>Type</th>
                            <th>Name</th>
                            <th>Age</th>
                            <th>Passport</th>
                          </tr>
                        </thead>
                        <tbody>
                          {details.guests.map((g, idx) => (
                            <tr key={g.id || idx}>
                              <td>{idx + 1}</td>
                              <td>
                                <Badge
                                  bg={g.isChild ? "warning" : "primary"}
                                >
                                  {g.isChild ? "Child" : "Adult"}
                                </Badge>
                              </td>
                              <td>
                                {[
                                  g.salutation,
                                  g.firstName,
                                  g.middleName,
                                  g.lastName,
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                              </td>
                              <td>{g.age ?? "-"}</td>
                              <td>{g.passportNo || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    ) : (
                      <p className="text-muted small m-3">
                        No passenger manifest recorded.
                      </p>
                    )}
                  </Card.Body>
                </Card>

                {/* Primary Contact */}
                <Card className="mb-3">
                  <Card.Header
                    className="fw-semibold"
                    style={{ backgroundColor: "#f1f3f5" }}
                  >
                    Primary Contact
                  </Card.Header>
                  <Card.Body>
                    <Table size="sm" borderless className="mb-0">
                      <tbody>
                        <tr>
                          <th style={{ width: 180 }}>
                            <FaUserAltIcon /> Name
                          </th>
                          <td>
                            {[
                              details.custSalutation,
                              details.custFirstName,
                              details.custMiddleName,
                              details.custLastName,
                            ]
                              .filter(Boolean)
                              .join(" ") || "-"}
                          </td>
                        </tr>
                        <tr>
                          <th>
                            <FaPhoneAlt /> Phone
                          </th>
                          <td>{details.custPhone || "-"}</td>
                        </tr>
                        <tr>
                          <th>
                            <FaEnvelope /> Email
                          </th>
                          <td>{details.custEmail || "-"}</td>
                        </tr>
                        <tr>
                          <th>
                            <FaIdCard /> Passport
                          </th>
                          <td>{details.custPassport || "-"}</td>
                        </tr>
                        {details.custAgentLpo && (
                          <tr>
                            <th>Agent LPO</th>
                            <td>{details.custAgentLpo}</td>
                          </tr>
                        )}
                      </tbody>
                    </Table>
                  </Card.Body>
                </Card>

                {/* Rental Package (only when present) */}
                {details.packageName && (
                  <Card className="mb-3">
                    <Card.Header
                      className="fw-semibold"
                      style={{ backgroundColor: "#f1f3f5" }}
                    >
                      Rental Package
                    </Card.Header>
                    <Card.Body>
                      <Table size="sm" borderless className="mb-0">
                        <tbody>
                          <tr>
                            <th style={{ width: 180 }}>City / Cab Type</th>
                            <td>
                              {details.cityName || "-"} ·{" "}
                              {details.cabType || "-"}
                            </td>
                          </tr>
                          <tr>
                            <th>Package</th>
                            <td>{details.packageName}</td>
                          </tr>
                          <tr>
                            <th>Included</th>
                            <td>
                              {details.includedHours ?? "-"} hrs ·{" "}
                              {details.includedKm ?? "-"} km
                            </td>
                          </tr>
                          <tr>
                            <th>Extra Rates</th>
                            <td>
                              Hour: AED {details.extraHourRate ?? "-"} · KM:
                              AED {details.extraKmRate ?? "-"}
                            </td>
                          </tr>
                          <tr>
                            <th>Actual Used</th>
                            <td>
                              {details.actualHoursUsed != null
                                ? `${details.actualHoursUsed} hrs`
                                : "—"}
                              {details.actualKmUsed != null
                                ? ` · ${details.actualKmUsed} km`
                                : ""}
                            </td>
                          </tr>
                          {(details.extraHoursCharge > 0 ||
                            details.extraKmCharge > 0 ||
                            details.intercityCharge > 0) && (
                            <tr>
                              <th>Extra Charges</th>
                              <td>
                                {details.extraHoursCharge > 0 && (
                                  <span className="me-2">
                                    Hours: AED {details.extraHoursCharge}
                                  </span>
                                )}
                                {details.extraKmCharge > 0 && (
                                  <span className="me-2">
                                    KM: AED {details.extraKmCharge}
                                  </span>
                                )}
                                {details.intercityCharge > 0 && (
                                  <span>
                                    Intercity: AED{" "}
                                    {details.intercityCharge}
                                    {details.intercityFromCity &&
                                    details.intercityToCity
                                      ? ` (${details.intercityFromCity} → ${details.intercityToCity})`
                                      : ""}
                                  </span>
                                )}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </Table>
                    </Card.Body>
                  </Card>
                )}

                {/* Pricing */}
                <Card className="mb-3">
                  <Card.Header
                    className="fw-semibold"
                    style={{ backgroundColor: "#f1f3f5" }}
                  >
                    Pricing
                  </Card.Header>
                  <Card.Body>
                    <Table size="sm" borderless className="mb-0">
                      <tbody>
                        {details.sellingPrice && (
                          <tr>
                            <th style={{ width: 180 }}>Selling Price</th>
                            <td>AED {details.sellingPrice}</td>
                          </tr>
                        )}
                        {details.totalRate != null &&
                          details.totalRate !== details.totalPrice && (
                            <tr>
                              <th>Total Rate</th>
                              <td>AED {details.totalRate}</td>
                            </tr>
                          )}
                        {details.tourismDirham &&
                          Number(details.tourismDirham) > 0 && (
                            <tr>
                              <th>Tourism Dirham</th>
                              <td>AED {details.tourismDirham}</td>
                            </tr>
                          )}
                        <tr>
                          <th>
                            <strong>Total Price</strong>
                          </th>
                          <td>
                            <strong>
                              AED{" "}
                              {details.totalPrice ||
                                details.totalRate ||
                                "-"}
                            </strong>
                          </td>
                        </tr>
                        {details.finalAmount != null && (
                          <tr>
                            <th>
                              <strong className="text-success">
                                Final Amount
                              </strong>
                            </th>
                            <td>
                              <strong className="text-success">
                                AED {details.finalAmount}
                              </strong>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </Table>
                  </Card.Body>
                </Card>

                {/* Bottom action buttons (left-aligned) */}
                <div
                  className="d-flex gap-2 justify-content-start flex-wrap"
                  style={{ marginTop: "16px", marginBottom: "20px" }}
                >
                  <button
                    style={{ ...BUTTON_STYLE, backgroundColor: "#0dcaf0" }}
                    onClick={onVoucher}
                    title="Voucher"
                  >
                    <FaFileAlt style={{ marginRight: "6px" }} />
                    Voucher
                  </button>
                  {details.packageName && !isCancelled && (
                    <button
                      style={{ ...BUTTON_STYLE, backgroundColor: "#f39c12" }}
                      onClick={openUsage}
                      title="Record actual usage"
                    >
                      <FaRoad style={{ marginRight: "6px" }} />
                      Record Usage
                    </button>
                  )}
                  {!isCancelled && (
                    <button
                      style={{ ...BUTTON_STYLE, backgroundColor: "#dc3545" }}
                      onClick={() => setShowCancel(true)}
                      title="Cancel"
                    >
                      <FaTrash style={{ marginRight: "6px" }} />
                      Cancel
                    </button>
                  )}
                </div>
              </>
            )}
          </Container>
        </main>
      </div>

      {/* Cancel confirmation */}
      <Modal show={showCancel} onHide={() => setShowCancel(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Cancel Booking</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Are you sure you want to cancel booking{" "}
          <strong>
            {details?.bookingCode || details?.packageBookCode}
          </strong>
          ?
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowCancel(false)}
            disabled={cancelling}
          >
            No
          </Button>
          <Button
            variant="danger"
            onClick={doCancel}
            disabled={cancelling}
          >
            {cancelling ? "Cancelling..." : "Yes, Cancel"}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Voucher PDF modal */}
      <Modal
        show={showPdf}
        onHide={closePdf}
        size="xl"
        centered
        scrollable
        backdrop="static"
        keyboard={false}
      >
        <Modal.Header className="bg-light" closeButton>
          <Modal.Title className="fw-bold">
            Voucher{" "}
            {details?.bookingCode ? "- " + details.bookingCode : ""}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0" style={{ height: "70vh" }}>
          {loadingPdf ? (
            <div className="h-100 d-flex flex-column align-items-center justify-content-center">
              <Spinner animation="border" variant="primary" />
              <p className="mt-2 text-muted">Generating Voucher...</p>
            </div>
          ) : pdfUrl ? (
            <iframe
              src={`${pdfUrl}#toolbar=0`}
              width="100%"
              height="100%"
              title="scheffer-driver-voucher"
              style={{ border: "none" }}
            />
          ) : (
            <div className="h-100 d-flex align-items-center justify-content-center">
              <p className="text-danger">Failed to load PDF.</p>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          {pdfUrl && (
            <Button
              variant="primary"
              onClick={() => window.open(pdfUrl, "_blank")}
            >
              Download
            </Button>
          )}
          <Button variant="secondary" onClick={closePdf}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Actual usage modal */}
      <Modal show={showUsage} onHide={() => setShowUsage(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            <FaRoad className="me-2 text-warning" />
            Record Actual Usage
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {details && (
            <>
              <p className="text-muted small mb-3">
                Package <strong>{details.packageName}</strong> —{" "}
                {details.includedHours ?? "-"} hrs /{" "}
                {details.includedKm ?? "-"} km included. Extra hour: AED{" "}
                {details.extraHourRate ?? "-"}, Extra km: AED{" "}
                {details.extraKmRate ?? "-"}.
              </p>
              <Row className="g-3">
                <Col md={6}>
                  <Form.Label>Actual Hours Used</Form.Label>
                  <Form.Control
                    type="number"
                    min="0"
                    value={usageForm.actualHoursUsed}
                    onChange={(e) =>
                      setUsageForm((p) => ({
                        ...p,
                        actualHoursUsed: e.target.value,
                      }))
                    }
                  />
                </Col>
                <Col md={6}>
                  <Form.Label>Actual KM Used</Form.Label>
                  <Form.Control
                    type="number"
                    min="0"
                    value={usageForm.actualKmUsed}
                    onChange={(e) =>
                      setUsageForm((p) => ({
                        ...p,
                        actualKmUsed: e.target.value,
                      }))
                    }
                  />
                </Col>
                <Col md={12}>
                  <hr className="my-2" />
                  <small className="text-muted">
                    Intercity leg (optional — adds surcharge)
                  </small>
                </Col>
                <Col md={6}>
                  <Form.Label>From City</Form.Label>
                  <Form.Select
                    value={usageForm.intercityFromCityId}
                    onChange={(e) =>
                      setUsageForm((p) => ({
                        ...p,
                        intercityFromCityId: e.target.value,
                      }))
                    }
                  >
                    <option value="">None</option>
                    {cityList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
                <Col md={6}>
                  <Form.Label>To City</Form.Label>
                  <Form.Select
                    value={usageForm.intercityToCityId}
                    onChange={(e) =>
                      setUsageForm((p) => ({
                        ...p,
                        intercityToCityId: e.target.value,
                      }))
                    }
                  >
                    <option value="">None</option>
                    {cityList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
              </Row>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowUsage(false)}
            disabled={savingUsage}
          >
            Cancel
          </Button>
          <Button
            variant="success"
            onClick={saveUsage}
            disabled={savingUsage}
          >
            {savingUsage ? "Saving..." : "Save & Recalculate"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
