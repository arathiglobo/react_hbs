/**
 * GovEmployeeBookingDetailView.jsx
 *
 * "View" page for a single gov-employee booking. Reached from the
 * booking-list view button. Mirrors the standard
 * BookingDetailedView.jsx but reads from
 * /api/gov-employee-booking/{id} and surfaces the discount fields.
 */

import React, { useEffect, useState } from "react";
import { Card, Row, Col, Button, Spinner, Badge, Table } from "react-bootstrap";
import { FaArrowLeft, FaDownload } from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import toast from "react-hot-toast";

export default function GovEmployeeBookingDetailView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await axiosInstance.get(`/api/gov-employee-booking/${id}`);
        if (data?.success === false) {
          toast.error(data?.message || "Not found");
          setData(null);
        } else {
          setData(data);
        }
      } catch (e) {
        toast.error("Failed to load booking");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleVoucher = async () => {
    try {
      const res = await axiosInstance.get(`/api/gov-employee-booking/${id}/voucher`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `gov-employee-voucher-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error("Voucher download failed");
    }
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
                <h5 className="d-inline">Government Employee Booking</h5>
                <div className="text-muted small mt-1">
                  Code: <strong>{data.bookingCode}</strong> · Ref: {data.referenceNumber}
                </div>
              </div>
              <div>
                {data.cancelled ? (
                  <Badge bg="danger" className="me-2 p-2">Cancelled</Badge>
                ) : (
                  <Badge bg="info" className="me-2 p-2">{data.confirmationStatus || "-"}</Badge>
                )}
                <Button variant="outline-success" size="sm" onClick={handleVoucher}>
                  <FaDownload className="me-1" /> Voucher
                </Button>
              </div>
            </div>

            {/* Hotel */}
            <h6>Hotel</h6>
            <Row className="g-2 mb-3">
              <Col md={6}><strong>{data.hotelName}</strong></Col>
              <Col md={6}>{data.address}</Col>
              <Col md={4}>Check-In: <strong>{data.checkInDate?.slice(0, 10)}</strong></Col>
              <Col md={4}>Check-Out: <strong>{data.checkOutDate?.slice(0, 10)}</strong></Col>
              <Col md={4}>Nights: <strong>{data.nights}</strong></Col>
            </Row>

            {/* Government Employee — verification info captured at booking time */}
            <h6>Government Employee Verification</h6>
            <Row className="g-2 mb-3">
              <Col md={4}>
                Method:{" "}
                <Badge bg={data.verificationMethod === "GOVT_ID_UPLOAD" ? "info" : "primary"}>
                  {data.verificationMethod === "GOVT_ID_UPLOAD" ? "Government ID Upload" : "Employee Code"}
                </Badge>
              </Col>
              {data.verificationMethod === "GOVT_ID_UPLOAD" ? (
                <Col md={8}>
                  Document:{" "}
                  {data.govtIdFilePath ? (
                    <a
                      href={`${axiosInstance.defaults.baseURL || ""}/api/gov-employee-id-upload/preview?path=${encodeURIComponent(data.govtIdFilePath)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {data.govtIdFileName || "View uploaded ID"}
                    </a>
                  ) : "-"}
                </Col>
              ) : (
                <Col md={8}>Code: <strong>{data.govEmployeeCode || "-"}</strong></Col>
              )}
              <Col md={6}>Name: <strong>{data.govEmployeeName || "-"}</strong></Col>
              <Col md={6}>Department: <strong>{data.govEmployeeDepartment || "-"}</strong></Col>
            </Row>

            {/* Customer */}
            {data.customer && (
              <>
                <h6>Primary Guest</h6>
                <Row className="g-2 mb-3">
                  <Col md={4}>{data.customer.salutation} {data.customer.firstName} {data.customer.lastName}</Col>
                  <Col md={4}>{data.customer.email}</Col>
                  <Col md={4}>{data.customer.phone}</Col>
                </Row>
              </>
            )}

            {/* Rooms */}
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
                  <tr key={r.roomBookingId}>
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

            {/* Totals */}
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
