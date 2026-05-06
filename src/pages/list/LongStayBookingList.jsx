import React, { useEffect, useState } from "react";
import {
  Card,
  Table,
  Spinner,
  Badge,
  Button,
  Pagination,
} from "react-bootstrap";
import axiosInstance from "../../components/AxiosInstance";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";

export default function LongStayBookingList() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const fetchBookings = async (p = 0) => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(
        `/api/longStayBooking?page=${p}&size=10`
      );
      setBookings(res.data.content || []);
      setTotalPages(res.data.totalPages || 0);
      setPage(res.data.number || 0);
    } catch {
      toast.error("Failed to load Long Stay bookings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings(0);
  }, []);

  const handleCancel = async (b) => {
    const r = await Swal.fire({
      title: "Cancel booking?",
      text: `Cancel ${b.bookingCode} for ${b.primaryGuestName}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Yes, cancel",
    });
    if (!r.isConfirmed) return;
    try {
      await axiosInstance.post(`/api/longStayBooking/${b.longStayBookingId}/cancel`);
      toast.success("Booking cancelled");
      fetchBookings(page);
    } catch {
      toast.error("Cancel failed");
    }
  };

  return (
    <div className="d-flex">
      <Sidebar />
      <div className="flex-grow-1">
        <Topbar />
        <div className="p-4">
          <h4 className="mb-3">Long Stay Bookings</h4>
          <Card>
            <Card.Body>
              <Table bordered hover responsive>
                <thead className="table-light">
                  <tr>
                    <th>S/N</th>
                    <th>Booking Code</th>
                    <th>Hotel</th>
                    <th>Guest</th>
                    <th>Stay</th>
                    <th>Nights</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="text-center py-4">
                        <Spinner animation="border" variant="primary" />
                      </td>
                    </tr>
                  ) : bookings.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center text-muted py-4">
                        No Long Stay bookings yet
                      </td>
                    </tr>
                  ) : (
                    bookings.map((b, i) => (
                      <tr key={b.longStayBookingId}>
                        <td>{i + 1 + page * 10}</td>
                        <td>{b.bookingCode}</td>
                        <td>{b.hotelName}</td>
                        <td>
                          {b.primaryGuestName}
                          <br />
                          <small className="text-muted">
                            {b.primaryGuestEmail}
                          </small>
                        </td>
                        <td>
                          {b.checkInDate} → {b.checkOutDate}
                        </td>
                        <td>{b.totalNights}</td>
                        <td>{b.totalAmount}</td>
                        <td>
                          <Badge
                            bg={
                              b.bookingStatus === "CONFIRMED"
                                ? "success"
                                : b.bookingStatus === "CANCELLED"
                                  ? "danger"
                                  : "secondary"
                            }
                          >
                            {b.bookingStatus}
                          </Badge>
                        </td>
                        <td>
                          {b.bookingStatus !== "CANCELLED" && (
                            <Button
                              size="sm"
                              variant="outline-danger"
                              onClick={() => handleCancel(b)}
                            >
                              Cancel
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>

              {totalPages > 1 && (
                <Pagination className="justify-content-center">
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <Pagination.Item
                      key={i}
                      active={i === page}
                      onClick={() => fetchBookings(i)}
                    >
                      {i + 1}
                    </Pagination.Item>
                  ))}
                </Pagination>
              )}
            </Card.Body>
          </Card>
        </div>
      </div>
    </div>
  );
}
