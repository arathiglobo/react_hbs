import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  Form,
  Row,
  Col,
  Table,
  Badge,
  InputGroup,
  Spinner,
  Pagination,
  Button,
  Modal,
  Container,
} from "react-bootstrap";
import {
  FaSearch,
  FaCalendarAlt,
  FaSuitcaseRolling,
  FaEye,
  FaTimes,
  FaExclamationTriangle,
  FaFilePdf,
  FaDownload,
} from "react-icons/fa";
import { toast } from "react-hot-toast";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";

const PER_PAGE_OPTIONS = [10, 25, 50, 100];

const HoneymoonBookingList = () => {
  const [data, setData] = useState({ content: [], totalElements: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [selected, setSelected] = useState(null);
  const [toCancel, setToCancel] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  // ── Voucher modal state ────────────────────────────────────────────
  // Mirrors the meet-and-space voucher flow: click the envelope icon in
  // the actions column → server generates a PDF and returns
  // { status, message, pdfUrl } → the URL is loaded in an inline iframe.
  const [voucherFor, setVoucherFor] = useState(null);
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherPdfUrl, setVoucherPdfUrl] = useState("");

  const openVoucher = async (booking) => {
    setVoucherFor(booking);
    setVoucherLoading(true);
    setVoucherPdfUrl("");
    try {
      const res = await axiosInstance.get(
        `/api/honeymoon/booking/${booking.id}/voucher`
      );
      if (res.data && res.data.status === "SUCCESS" && res.data.pdfUrl) {
        setVoucherPdfUrl(res.data.pdfUrl);
      } else {
        toast.error(res.data?.message || "Failed to generate voucher PDF");
      }
    } catch (e) {
      console.error("Voucher fetch failed", e);
      toast.error(
        e?.response?.data?.message || "Failed to load voucher PDF"
      );
    } finally {
      setVoucherLoading(false);
    }
  };

  const closeVoucher = () => {
    setVoucherFor(null);
    setVoucherPdfUrl("");
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(
        `/api/honeymoon/booking/list?page=${page}&size=${size}&search=${encodeURIComponent(debouncedSearch)}`
      );
      setData(res.data);
    } catch (e) {
      console.error(e);
      setData({ content: [], totalElements: 0, totalPages: 0 });
    } finally {
      setLoading(false);
    }
  };

  // Debounce the search box so we don't fire on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    load();
  }, [page, size, debouncedSearch]); // eslint-disable-line

  const handleCancel = async () => {
    if (!toCancel) return;
    setCancelling(true);
    try {
      await axiosInstance.put(`/api/honeymoon/booking/${toCancel.id}/cancel`, {
        reason: cancelReason || "Cancelled by user",
      });
      toast.success("Booking cancelled");
      setToCancel(null);
      setCancelReason("");
      load();
    } catch (e) {
      toast.error("Failed to cancel");
    } finally {
      setCancelling(false);
    }
  };

  const pageNumbers = useMemo(() => {
    if (!data.totalPages) return [];
    const max = data.totalPages;
    const cur = page;
    const arr = [];
    const start = Math.max(0, cur - 2);
    const end = Math.min(max - 1, cur + 2);
    for (let i = start; i <= end; i++) arr.push(i);
    return arr;
  }, [data.totalPages, page]);

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
            <Card className="shadow-lg border-0 rounded-4">
              <Card.Header className="bg-gradient-primary text-white border-0 rounded-top-4">
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                  <h4 className="mb-0">
                    <FaSuitcaseRolling className="me-2" /> Honeymoon Bookings
                  </h4>
                  <Badge bg="light" text="dark" className="fs-6 px-3 py-2">
                    {data.totalElements || 0} Total
                  </Badge>
                </div>
              </Card.Header>
              <Card.Body className="p-4">
                <Row className="mb-3 g-2 align-items-end">
                  <Col md={4}>
                    <Form.Label className="small mb-1">Search</Form.Label>
                    <InputGroup>
                      <InputGroup.Text><FaSearch /></InputGroup.Text>
                      <Form.Control
                        placeholder="Booking #, package, customer, mobile..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </InputGroup>
                  </Col>
                  <Col md={2}>
                    <Form.Label className="small mb-1">Page size</Form.Label>
                    <Form.Select
                      value={size}
                      onChange={(e) => {
                        setSize(Number(e.target.value));
                        setPage(0);
                      }}
                    >
                      {PER_PAGE_OPTIONS.map((n) => (
                        <option key={n} value={n}>{n} / page</option>
                      ))}
                    </Form.Select>
                  </Col>
                </Row>

                {loading ? (
                  <div className="text-center py-5">
                    <Spinner animation="border" variant="primary" />
                  </div>
                ) : (data.content || []).length === 0 ? (
                  <div className="text-center text-muted py-5">
                    <FaSuitcaseRolling size={48} className="mb-2 opacity-50" />
                    <div>No bookings yet.</div>
                  </div>
                ) : (
                  <Table responsive hover bordered className="align-middle">
                    <thead className="table-light">
                      <tr>
                        <th>#</th>
                        <th>Booking #</th>
                        <th>Package</th>
                        <th><FaCalendarAlt className="me-1" /> Start</th>
                        <th>Pax / Rooms</th>
                        <th>Customer</th>
                        <th>Mobile</th>
                        <th>Base</th>
                        <th>Markup</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th style={{ width: 100 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.content.map((b, i) => (
                        <tr key={b.id}>
                          <td>{page * size + i + 1}</td>
                          <td className="fw-semibold">{b.bookingNumber}</td>
                          <td>{b.packageName}<br /><small className="text-muted">{b.startingFrom} → {b.destination}</small></td>
                          <td>{b.startingDate}</td>
                          <td>{(b.adults || 0) + (b.children || 0)} pax / {b.rooms || 0} room(s)</td>
                          <td>{b.customerName}</td>
                          <td>{b.mobile}</td>
                          <td className="text-end">₹ {Number(b.baseRate || 0).toFixed(2)}</td>
                          <td className="text-end">
                            <Badge bg="info" pill>
                              {Number(b.markupPercent || 0).toFixed(2)}%
                            </Badge>
                            <div className="small text-muted">
                              +₹ {Number(b.markupAmount || 0).toFixed(2)}
                            </div>
                          </td>
                          <td className="fw-semibold">₹ {Number(b.totalAmount || 0).toFixed(2)}</td>
                          <td>
                            {b.isCancelled ? (
                              <Badge bg="danger">Cancelled</Badge>
                            ) : (
                              <Badge bg="success">{b.bookingStatus || "Confirmed"}</Badge>
                            )}
                          </td>
                          <td>
                            <div className="d-flex gap-2 flex-wrap">
                              <Button
                                size="sm"
                                variant="outline-info"
                                onClick={() => setSelected(b)}
                                title="View"
                              >
                                <FaEye />
                              </Button>
                              {/* Voucher — generates a PDF via the backend
                                  and opens it in an iframe modal. */}
                              <Button
                                size="sm"
                                variant="outline-primary"
                                onClick={() => openVoucher(b)}
                                title="Voucher"
                                disabled={b.isCancelled}
                              >
                                <FaFilePdf />
                              </Button>
                              {!b.isCancelled && (
                                <Button
                                  size="sm"
                                  variant="outline-danger"
                                  onClick={() => setToCancel(b)}
                                  title="Cancel"
                                >
                                  <FaTimes />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}

                {data.totalPages > 1 && (
                  <div className="d-flex justify-content-between align-items-center mt-3">
                    <div className="text-muted small">
                      Page {page + 1} of {data.totalPages} · {data.totalElements} total
                    </div>
                    <Pagination className="mb-0">
                      <Pagination.First disabled={page === 0} onClick={() => setPage(0)} />
                      <Pagination.Prev disabled={page === 0} onClick={() => setPage((p) => p - 1)} />
                      {pageNumbers.map((n) => (
                        <Pagination.Item key={n} active={n === page} onClick={() => setPage(n)}>
                          {n + 1}
                        </Pagination.Item>
                      ))}
                      <Pagination.Next
                        disabled={page >= data.totalPages - 1}
                        onClick={() => setPage((p) => p + 1)}
                      />
                      <Pagination.Last
                        disabled={page >= data.totalPages - 1}
                        onClick={() => setPage(data.totalPages - 1)}
                      />
                    </Pagination>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Container>
        </main>
      </div>

      <Modal show={!!selected} onHide={() => setSelected(null)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Booking Details — {selected?.bookingNumber}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selected && (
            <>
              <Row className="g-2 mb-3">
                <Col md={6}><strong>Package:</strong> {selected.packageName}</Col>
                <Col md={6}><strong>Route:</strong> {selected.startingFrom} → {selected.destination}</Col>
                <Col md={6}><strong>Start Date:</strong> {selected.startingDate}</Col>
                <Col md={6}><strong>Nights:</strong> {selected.noOfNights}</Col>
                <Col md={6}><strong>Rooms:</strong> {selected.rooms}</Col>
                <Col md={6}>
                  <strong>Pax:</strong> {selected.adults} Adults
                  {selected.children
                    ? `, ${selected.children} Children${
                        Array.isArray(selected.childAges) && selected.childAges.length
                          ? ` (ages: ${selected.childAges.join(", ")})`
                          : ""
                      }`
                    : ""}
                </Col>
                <Col md={6}><strong>Customer:</strong> {selected.customerName} ({selected.mobile})</Col>
                <Col md={6}><strong>Email:</strong> {selected.email || "-"}</Col>
                <Col md={6}><strong>Agent:</strong> {selected.agentName || "-"}</Col>
                <Col md={6}>
                  <strong>Status:</strong>{" "}
                  {selected.isCancelled ? (
                    <Badge bg="danger">Cancelled</Badge>
                  ) : (
                    <Badge bg="success">{selected.bookingStatus || "Confirmed"}</Badge>
                  )}
                </Col>
                <Col md={6}><strong>Payment Mode:</strong> {selected.paymentMode || "-"}</Col>
                <Col md={6}><strong>Booked on:</strong> {selected.createdDate}</Col>
                {selected.isCancelled && (
                  <>
                    <Col md={6}><strong>Cancelled at:</strong> {selected.cancelledAt}</Col>
                    <Col md={12}><strong>Cancellation reason:</strong> {selected.cancellationReason || "-"}</Col>
                  </>
                )}
                <Col md={12}><strong>Special Request:</strong> {selected.specialRequest || "-"}</Col>
              </Row>
              <Table size="sm" bordered>
                <tbody>
                  <tr><td>Base Rate (per pax)</td><td className="text-end">₹ {Number(selected.baseRate || 0).toFixed(2)}</td></tr>
                  <tr><td>Markup ({selected.markupPercent || 0}%)</td><td className="text-end">₹ {Number(selected.markupAmount || 0).toFixed(2)}</td></tr>
                  <tr><td>Tax ({selected.taxPercent || 0}%)</td><td className="text-end">₹ {Number(selected.taxAmount || 0).toFixed(2)}</td></tr>
                  <tr className="table-light fw-bold">
                    <td>Grand Total</td>
                    <td className="text-end text-success">₹ {Number(selected.totalAmount || 0).toFixed(2)}</td>
                  </tr>
                </tbody>
              </Table>
            </>
          )}
        </Modal.Body>
      </Modal>

      {/* Voucher modal — backend returns { status, message, pdfUrl };
          the pdfUrl is loaded into an inline iframe so the agent can scroll
          through the voucher without leaving the page. */}
      <Modal
        show={!!voucherFor}
        onHide={closeVoucher}
        size="xl"
        centered
        backdrop="static"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <FaFilePdf className="text-danger me-2" />
            Voucher — {voucherFor?.bookingNumber}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {voucherLoading ? (
            <div className="text-center py-5">
              <Spinner animation="border" />
              <div className="mt-2 small text-muted">
                Generating voucher PDF…
              </div>
            </div>
          ) : voucherPdfUrl ? (
            <div
              style={{
                border: "1px solid #dee2e6",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "8px 12px",
                  background: "#f8f9fa",
                  fontWeight: 600,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>Voucher PDF Preview</span>
                <a
                  href={voucherPdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-sm btn-outline-primary"
                >
                  <FaDownload className="me-1" /> Open / Download
                </a>
              </div>
              <iframe
                src={voucherPdfUrl}
                title="Honeymoon Voucher"
                width="100%"
                height="560px"
                style={{ border: "none" }}
              />
            </div>
          ) : (
            <div className="text-muted text-center py-4">
              No voucher available for this booking.
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeVoucher}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={!!toCancel} onHide={() => !cancelling && setToCancel(null)} centered>
        <Modal.Header closeButton={!cancelling}>
          <Modal.Title>
            <FaExclamationTriangle className="text-primary me-2" /> Cancel Booking
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Cancel booking <strong>{toCancel?.bookingNumber}</strong>?
          <Form.Group className="mt-3">
            <Form.Label>Reason (optional)</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" disabled={cancelling} onClick={() => setToCancel(null)}>
            Back
          </Button>
          <Button variant="danger" disabled={cancelling} onClick={handleCancel}>
            {cancelling ? "Cancelling..." : "Confirm Cancel"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default HoneymoonBookingList;
