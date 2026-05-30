/**
 * SeniorCitizenBookingDetailView.jsx
 *
 * Detail view for a single senior-citizen booking. Surfaces the
 * verification block + uploaded ID preview link, room split, and
 * pricing summary.
 */

import React, { useEffect, useState } from "react";
import { Card, Row, Col, Button, Spinner, Badge, Table } from "react-bootstrap";
import { FaArrowLeft, FaDownload, FaUserClock } from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import toast from "react-hot-toast";

export default function SeniorCitizenBookingDetailView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await axiosInstance.get(`/api/senior-citizen-booking/${id}`);
        if (data?.success === false) {
          toast.error(data?.message || "Not found");
          setData(null);
        } else { setData(data); }
      } catch (e) { toast.error("Failed to load booking"); }
      finally { setLoading(false); }
    })();
  }, [id]);

  const handleVoucher = async () => {
    try {
      const res = await axiosInstance.get(
        `/api/senior-citizen-booking/${id}/voucher`, { responseType: "blob" }
      );
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url; a.download = `senior-citizen-voucher-${id}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { toast.error("Voucher download failed"); }
  };

  if (loading) return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <div className="text-center py-5"><Spinner animation="border" /></div>
        </main>
      </div>
    </div>
  );
  if (!data) return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <div className="text-center text-muted py-5">Booking not found.</div>
        </main>
      </div>
    </div>
  );

  // Build a compact discount summary in either backend shape.
  const discountSummary = (() => {
    if (data.discountType === "PERCENTAGE" && data.discountValue) return `${data.discountValue}%`;
    if (data.discountType === "AMOUNT"     && data.discountValue) return `flat ${data.discountValue}`;
    const out = [];
    if (data.discountPercent) out.push(`${data.discountPercent}%`);
    if (data.discountAmount) out.push(`flat ${data.discountAmount}`);
    return out.join(" + ");
  })();

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Card className="shadow-sm border-0">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <Button variant="link" className="p-0 me-2" onClick={() => navigate(-1)}>
                    <FaArrowLeft /> Back
                  </Button>
                  <h5 className="d-inline">
                    <FaUserClock className="me-2 text-primary" /> Senior Citizen Booking
                  </h5>
                  <div className="text-muted small mt-1">
                    Code: <strong>{data.bookingCode}</strong>
                    {data.referenceNumber ? <> · Ref: {data.referenceNumber}</> : null}
                  </div>
                </div>
                <div>
                  {data.cancelled
                    ? <Badge bg="danger" className="me-2 p-2">Cancelled</Badge>
                    : <Badge bg="info" className="me-2 p-2">
                        {data.confirmationStatus || data.roomStatus || "CONFIRMED"}
                      </Badge>}
                  <Button variant="outline-success" size="sm" onClick={handleVoucher}>
                    <FaDownload className="me-1" /> Voucher
                  </Button>
                </div>
              </div>

              <h6>Hotel</h6>
              <Row className="g-2 mb-3">
                <Col md={6}><strong>{data.hotelName}</strong></Col>
                <Col md={6}>{data.address}</Col>
                <Col md={4}>Check-In: <strong>{(data.checkInDate || "").slice(0, 16)}</strong></Col>
                <Col md={4}>Check-Out: <strong>{(data.checkOutDate || "").slice(0, 16)}</strong></Col>
                <Col md={4}>Nights: <strong>{data.nights}</strong></Col>
              </Row>

              <h6>Senior Citizen Qualification</h6>
              <Row className="g-2 mb-3">
                <Col md={12}>
                  <div className="text-muted small">
                    Qualified by age — markup applied to rooms where at least one adult is 60+.
                    {discountSummary && (
                      <> Configured discount: <Badge bg="success">{discountSummary}</Badge></>
                    )}
                  </div>
                </Col>
                {(data.rooms || []).map((r) => (
                  <Col md={4} key={r.roomBookingId || r.roomNo}>
                    Room {r.roomNo} adult ages:{" "}
                    <strong>
                      {Array.isArray(r.adultAges) && r.adultAges.length
                        ? r.adultAges.join(", ")
                        : "-"}
                    </strong>
                  </Col>
                ))}
              </Row>

              {data.customer && (
                <>
                  <h6>Primary Guest</h6>
                  <Row className="g-2 mb-3">
                    <Col md={4}>
                      {data.customer.salutation} {data.customer.firstName} {data.customer.lastName}
                    </Col>
                    <Col md={4}>{data.customer.email}</Col>
                    <Col md={4}>{data.customer.phone}</Col>
                  </Row>
                </>
              )}

              <h6>Rooms</h6>
              <Table size="sm" bordered>
                <thead className="table-light">
                  <tr>
                    <th>#</th><th>Category</th><th>Meal</th>
                    <th>Adults</th><th>Children</th>
                    <th>Before</th><th>After</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.rooms || []).map((r) => (
                    <tr key={r.roomBookingId || r.roomNo}>
                      <td>{r.roomNo}</td>
                      <td>{r.roomCategory}</td>
                      <td>{r.mealPlan}</td>
                      <td>{r.adults}</td>
                      <td>{r.children}</td>
                      <td className="text-decoration-line-through">{r.rateBeforeDiscount ?? "-"}</td>
                      <td><strong className="text-success">{r.rate ?? "-"}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              <Card className="bg-light border-0 mt-3">
                <Card.Body>
                  <Row>
                    <Col md={4}>Total Before Discount:
                      <div className="text-decoration-line-through">{data.totalRateBeforeDiscount ?? "-"}</div>
                    </Col>
                    <Col md={4}>Discount Applied:
                      <div>
                        {data.discountPercent ? `${data.discountPercent}%` : ""}
                        {data.discountAmount ? ` + flat ${data.discountAmount}` : ""}
                      </div>
                    </Col>
                    <Col md={4}>Total Payable:
                      <div className="h5 text-success">{data.totalRate ?? "-"}</div>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>

              {data.cancelled && (
                <div className="mt-3 text-danger small">
                  Cancelled at {data.cancelledAt} · Reason: {data.cancellationReason}
                </div>
              )}
            </Card.Body>
          </Card>
        </main>
      </div>
    </div>
  );
}
