import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Button, Spinner, Table, Badge } from "react-bootstrap";
import axiosInstance from "../components/AxiosInstance";
import { toast } from "react-hot-toast";

export default function LongStayRoomList() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = sessionStorage.getItem("longStayRoomListPayload");
    if (!raw) {
      toast.error("No search context — please search again");
      window.close();
      return;
    }
    const parsed = JSON.parse(raw);
    setDraft(parsed);

    const load = async () => {
      try {
        setLoading(true);
        const res = await axiosInstance.get(
          `/api/longStayContract?hotelId=${parsed.payload.hotelId}&page=0&size=50`
        );
        const cIn = new Date(parsed.payload.checkInDate);
        const cOut = new Date(parsed.payload.checkOutDate);
        const valid = (res.data.content || []).filter(
          (c) =>
            c.isLive &&
            new Date(c.validityFrom) <= cIn &&
            new Date(c.validityTo) >= cOut
        );
        setContracts(valid);
      } catch {
        toast.error("Failed to load long stay contracts");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleBook = (contract, room) => {
    const ci = new Date(draft.payload.checkInDate);
    const co = new Date(draft.payload.checkOutDate);
    const totalNights = Math.max(0, Math.round((co - ci) / 86400000));
    if (contract.maxBookingDays && totalNights > contract.maxBookingDays) {
      toast.error(
        `Selected contract caps stays at ${contract.maxBookingDays} nights — your dates are ${totalNights}.`
      );
      return;
    }
    sessionStorage.setItem(
      "longStayBookingDraft",
      JSON.stringify({
        hotelId: draft.payload.hotelId,
        hotelName: draft.meta.hotelName,
        checkIn: draft.payload.checkInDate,
        checkOut: draft.payload.checkOutDate,
        contract,
        room,
      })
    );
    // Open booking page in same window so the existing tab continues the flow
    navigate("/long-stay-booking-page");
  };

  if (!draft) return null;

  return (
    <div className="p-4 bg-light min-vh-100">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="m-0">{draft.meta.hotelName}</h4>
        <Button variant="outline-secondary" size="sm" onClick={() => window.close()}>
          Close
        </Button>
      </div>

      <Card className="p-3 mb-3">
        <div className="d-flex flex-wrap gap-3">
          <span>
            <strong>Address:</strong> {draft.meta.address || "—"}
          </span>
          <span>
            <strong>Stars:</strong> {draft.meta.starRating || "—"}
          </span>
          <span>
            <strong>Check-in:</strong> {draft.payload.checkInDate}
          </span>
          <span>
            <strong>Check-out:</strong> {draft.payload.checkOutDate}
          </span>
        </div>
      </Card>

      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
        </div>
      ) : contracts.length === 0 ? (
        <Card className="p-5 text-center text-muted">
          No active Long Stay contracts cover these dates.
        </Card>
      ) : (
        contracts.map((c) => (
          <Card key={c.longStayContractId} className="p-3 mb-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h5 className="m-0">
                {c.rateCode}{" "}
                <Badge bg="info" className="ms-2">
                  {c.additionalCostType === "WEEKLY" ? "Weekly" : "Day-wise"}
                </Badge>
              </h5>
              <small className="text-muted">
                Validity: {c.validityFrom} → {c.validityTo}
              </small>
            </div>
            {c.maxBookingDays && (
              <div className="mb-2 small text-muted">
                Max booking: <strong>{c.maxBookingDays}</strong> nights
              </div>
            )}
            <Table bordered hover responsive size="sm">
              <thead className="table-light">
                <tr>
                  <th>Room ID</th>
                  <th>Occupancy</th>
                  <th>Monthly Rate</th>
                  <th>Day Rate</th>
                  {c.additionalCostType === "WEEKLY" && <th>Weekly Rate</th>}
                  <th>Extra Adult</th>
                  <th>Extra Child</th>
                  <th>Refundable</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {(c.rooms || []).map((r) => (
                  <tr key={r.longStayRoomId}>
                    <td>#{r.longStayRoomId}</td>
                    <td>Occ-{r.occupancyTypeId}</td>
                    <td>{r.monthlyRate}</td>
                    <td>{r.dayRate || "—"}</td>
                    {c.additionalCostType === "WEEKLY" && (
                      <td>{r.weeklyRate || "—"}</td>
                    )}
                    <td>{r.adultRate || "—"}</td>
                    <td>{r.childRate || "—"}</td>
                    <td>
                      {r.refundable ? (
                        <Badge bg="success">Yes</Badge>
                      ) : (
                        <Badge bg="secondary">No</Badge>
                      )}
                    </td>
                    <td>
                      <Button size="sm" variant="success" onClick={() => handleBook(c, r)}>
                        Book
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        ))
      )}
    </div>
  );
}
