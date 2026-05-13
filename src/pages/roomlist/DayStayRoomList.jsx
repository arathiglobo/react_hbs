import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  Button,
  Row,
  Col,
  Table,
  Badge,
  Spinner,
} from "react-bootstrap";
import { FaArrowLeft, FaClock } from "react-icons/fa";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";

/**
 * DayStayRoomList — opens in a new tab from DayStaySearch.
 *
 * Reads dayStayRoomListPayload from sessionStorage and renders the available
 * day-stay rates for the chosen hotel + contract. The rate is the contract's
 * day-stay rate (with markup already applied in search). The user can pick a
 * row and continue to the booking page.
 */
export default function DayStayRoomList() {
  const navigate = useNavigate();
  const [payload, setPayload] = useState(null);
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = sessionStorage.getItem("dayStayRoomListPayload");
    if (!raw) {
      setLoading(false);
      return;
    }
    try {
      const p = JSON.parse(raw);
      setPayload(p);
      if (p?.contractId) {
        axiosInstance
          .get(`/api/day-stay-contract/${p.contractId}`)
          .then((res) => setContract(res.data))
          .catch(() => setContract(null))
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }, []);

  const adjustedCheckOut = useMemo(() => {
    if (!payload || !contract) return payload?.checkOutTime || "";
    if (!payload.checkOutTime) return contract.checkInEndTime;
    return payload.checkOutTime > contract.checkInEndTime
      ? contract.checkInEndTime
      : payload.checkOutTime;
  }, [payload, contract]);

  const rateRows = useMemo(() => {
    if (!contract) return [];
    const rooms = contract.rooms || [];
    if (rooms.length === 0) {
      return [
        {
          key: "base",
          label: "Day Stay Standard",
          dayStayRate: contract.dayStayRate,
          meal: false,
          refundable: true,
        },
      ];
    }
    return rooms.map((r, i) => ({
      key: r.id || i,
      label: [r.roomCategoryName, r.roomTypeName].filter(Boolean).join(" / ") ||
        `Room ${i + 1}`,
      dayStayRate: r.dayStayRate || contract.dayStayRate,
      adultRate: r.adultRate,
      childRate: r.childRate,
      meal: r.meal,
      refundable: r.refundable,
      roomCategoryName: r.roomCategoryName,
      roomTypeName: r.roomTypeName,
    }));
  }, [contract]);

  const handleBook = (row) => {
    const pct = Number(payload?.basePctRate || 0);
    const base = Number(row.dayStayRate || 0);
    const totalAmount =
      base > 0
        ? +(
            base *
            (1 + pct / 100) *
            (Number(payload?.rooms) || 1)
          ).toFixed(2)
        : 0;
    const bookingPayload = {
      ...payload,
      checkOutTime: adjustedCheckOut,
      roomCategory: row.roomCategoryName || null,
      roomType: row.roomTypeName || row.label,
      rateRow: row,
      totalAmount,
    };
    sessionStorage.setItem(
      "dayStayBookingPayload",
      JSON.stringify(bookingPayload)
    );
    navigate("/day-stay-booking-page");
  };

  if (loading) {
    return (
      <div className="min-vh-100 bg-light d-flex flex-column">
        <TopBar />
        <div className="d-flex flex-grow-1">
          <Sidebar />
          <main className="flex-grow-1 p-4 text-center">
            <Spinner animation="border" />
          </main>
        </div>
      </div>
    );
  }

  if (!payload || !contract) {
    return (
      <div className="min-vh-100 bg-light d-flex flex-column">
        <TopBar />
        <div className="d-flex flex-grow-1">
          <Sidebar />
          <main className="flex-grow-1 p-4">
            <Card className="shadow-sm">
              <Card.Body className="text-center text-muted py-5">
                <h5>Day Stay information missing</h5>
                <p>Please go back to Day Stay search and try again.</p>
                <Button onClick={() => navigate("/new-booking/day-stay")}>
                  Back to Search
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
              onClick={() => window.close()}
              className="d-flex align-items-center gap-2"
            >
              <FaArrowLeft /> Close
            </Button>
            <h5 className="mb-0">Day Stay Rooms — {payload.hotelName}</h5>
          </div>

          <Card className="shadow-sm mb-3">
            <Card.Body>
              <Row>
                <Col md={6}>
                  <p className="mb-1">
                    <strong>📍 Address:</strong>{" "}
                    {payload.hotelAddress || "—"}
                  </p>
                  <p className="mb-1">
                    <strong>Date:</strong> {payload.checkInDate}
                  </p>
                </Col>
                <Col md={6}>
                  <p className="mb-1">
                    <FaClock className="me-1 text-primary" />
                    <strong>Check-in:</strong> {payload.checkInTime}{" "}
                    <strong className="ms-2">Check-out:</strong>{" "}
                    {adjustedCheckOut}
                  </p>
                  <p className="mb-1">
                    <Badge bg="info">
                      Hotel window: {contract.checkInStartTime} –{" "}
                      {contract.checkInEndTime}
                    </Badge>
                    {payload.checkOutTime !== adjustedCheckOut && (
                      <Badge bg="warning" text="dark" className="ms-2">
                        Check-out auto-capped to window end ({adjustedCheckOut})
                      </Badge>
                    )}
                  </p>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          <Card className="shadow-sm">
            <Card.Body>
              <Table bordered hover responsive size="sm">
                <thead style={{ backgroundColor: "#f8f8f8" }}>
                  <tr>
                    <th>Room / Plan</th>
                    <th>Day Stay Rate</th>
                    <th>Meal</th>
                    <th>Refundable</th>
                    <th style={{ width: 120 }}>Book</th>
                  </tr>
                </thead>
                <tbody>
                  {rateRows.map((row) => {
                    const pct = Number(payload?.basePctRate || 0);
                    const base = Number(row.dayStayRate || 0);
                    const finalRate =
                      base > 0
                        ? +(base * (1 + pct / 100)).toFixed(2)
                        : null;
                    return (
                      <tr key={row.key}>
                        <td>{row.label}</td>
                        <td>
                          {finalRate != null
                            ? `AED ${finalRate.toLocaleString()}`
                            : "—"}
                          {pct > 0 && (
                            <small className="text-muted ms-1">
                              (incl. {pct}%)
                            </small>
                          )}
                        </td>
                        <td>
                          {row.meal ? (
                            <Badge bg="success">Included</Badge>
                          ) : (
                            <Badge bg="secondary">No</Badge>
                          )}
                        </td>
                        <td>
                          {row.refundable ? (
                            <Badge bg="success">Yes</Badge>
                          ) : (
                            <Badge bg="secondary">No</Badge>
                          )}
                        </td>
                        <td>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleBook(row)}
                          >
                            Book
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </main>
      </div>
    </div>
  );
}
