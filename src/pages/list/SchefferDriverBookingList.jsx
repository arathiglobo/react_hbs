import React, { useEffect, useMemo, useState } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Form,
  Table,
  Badge,
  InputGroup,
  Spinner,
  Modal,
} from "react-bootstrap";
import {
  FaSearch,
  FaTrash,
  FaEye,
  FaCar,
  FaFileAlt,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaEnvelope,
  FaIdCard,
} from "react-icons/fa";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import toast from "react-hot-toast";

/**
 * Booking list for the Scheffer Driver new-booking flow.
 *
 *   GET   /api/scheffer/grouped-list   — upcoming / completed / cancelled tabs
 *   DELETE /api/scheffer/delete/{id}    — cancel a booking
 *   GET   /api/scheffer/{id}/voucher    — PDF voucher (application/pdf)
 *
 * View action opens a details modal sourced from the same row object.
 * Voucher action streams the PDF as a Blob, builds an object URL and
 * shows it in an <iframe> inside a modal (same UX as
 * /booking-details/offline-booking-list).
 */
const SchefferDriverBookingList = ({
  apiBase = "/api/scheffer",
  pageTitle = "Scheffer Driver & Limousine Bookings",
  fileLabel = "scheffer-driver",
}) => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("upcoming");
  const [search, setSearch] = useState("");
  const [data, setData] = useState({ upcoming: [], completed: [], cancelled: [] });
  const [totals, setTotals] = useState({ upcomingTotal: 0, completedTotal: 0, cancelledTotal: 0 });

  // Cancel modal
  const [showCancel, setShowCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [selected, setSelected] = useState(null);

  // View modal
  const [showDetails, setShowDetails] = useState(false);
  const [details, setDetails] = useState(null);

  // Voucher (PDF) modal
  const [showPdf, setShowPdf] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loadingPdf, setLoadingPdf] = useState(false);

  const fetchList = async () => {
    setLoading(true);
    try {
      const role = (localStorage.getItem("currentActiveRole") || "").toLowerCase();
      const params = {
        upcomingPage: 0,
        upcomingSize: 50,
        completedPage: 0,
        completedSize: 50,
        cancelledPage: 0,
        cancelledSize: 50,
      };
      if (role === "agent") {
        const agentId = localStorage.getItem("agentId");
        if (agentId && agentId !== "null") params.agentId = agentId;
      }
      const res = await axiosInstance.get(`${apiBase}/grouped-list`, { params });
      const d = res.data || {};
      setData({
        upcoming: d.upcoming || [],
        completed: d.completed || [],
        cancelled: d.cancelled || [],
      });
      setTotals({
        upcomingTotal: d.upcomingTotal || 0,
        completedTotal: d.completedTotal || 0,
        cancelledTotal: d.cancelledTotal || 0,
      });
    } catch (e) {
      console.error("Error loading bookings:", e);
      toast.error("Failed to load bookings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, [apiBase]); // eslint-disable-line

  const rows = useMemo(() => {
    const arr = data[status] || [];
    if (!search.trim()) return arr;
    const q = search.toLowerCase();
    return arr.filter((b) => {
      const blob = [
        b.bookingCode,
        b.packageBookCode,
        b.cabName,
        b.cabProviderName,
        b.transporter,
        b.custFirstName,
        b.custLastName,
        b.pickupName,
        b.dropoffName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [data, status, search]);

  const onCancelClick = (b) => {
    setSelected(b);
    setShowCancel(true);
  };
  const doCancel = async () => {
    if (!selected) return;
    const id = selected.id || selected.custombookingId;
    if (!id) return;
    setCancelling(true);
    try {
      await axiosInstance.delete(`${apiBase}/delete/${id}`);
      toast.success("Booking cancelled");
      setShowCancel(false);
      setSelected(null);
      fetchList();
    } catch (e) {
      console.error("Cancel error:", e);
      toast.error("Failed to cancel booking");
    } finally {
      setCancelling(false);
    }
  };

  const onView = (b) => {
    setDetails(b);
    setShowDetails(true);
  };

  const onVoucher = async (b) => {
    const id = b.id || b.custombookingId;
    if (!id) return;
    setShowPdf(true);
    setLoadingPdf(true);
    setPdfUrl(null);
    try {
      const res = await axiosInstance.get(`${apiBase}/${id}/voucher`, {
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

  const fmtDate = (d) => (d ? String(d).split("T")[0] : "-");

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-3">
          <Container fluid>
            <Card className="shadow-sm mb-3">
              <Card.Header className="d-flex justify-content-between align-items-center">
                <span className="fw-semibold">
                  <FaCar className="me-2 text-success" />
                  {pageTitle}
                </span>
                <Button variant="outline-primary" size="sm" onClick={fetchList} disabled={loading}>
                  {loading ? "Refreshing..." : "Refresh"}
                </Button>
              </Card.Header>
              <Card.Body>
                <Row className="g-2 mb-3">
                  <Col md={6}>
                    <InputGroup>
                      <InputGroup.Text>
                        <FaSearch />
                      </InputGroup.Text>
                      <Form.Control
                        placeholder="Search by Booking Code, Cab, Customer..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </InputGroup>
                  </Col>
                  <Col md={6}>
                    <div className="d-flex gap-3 align-items-center">
                      <Form.Check
                        type="radio"
                        label={`Upcoming (${totals.upcomingTotal})`}
                        name="status"
                        checked={status === "upcoming"}
                        onChange={() => setStatus("upcoming")}
                      />
                      <Form.Check
                        type="radio"
                        label={`Completed (${totals.completedTotal})`}
                        name="status"
                        checked={status === "completed"}
                        onChange={() => setStatus("completed")}
                      />
                      <Form.Check
                        type="radio"
                        label={`Cancelled (${totals.cancelledTotal})`}
                        name="status"
                        checked={status === "cancelled"}
                        onChange={() => setStatus("cancelled")}
                      />
                    </div>
                  </Col>
                </Row>

                <Table bordered hover responsive className="align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>S/N</th>
                      <th>Booking</th>
                      <th>Customer</th>
                      <th>Cab</th>
                      <th>Travel</th>
                      <th>Pax</th>
                      <th>Amount</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr>
                        <td colSpan="8" className="text-center py-4">
                          <Spinner size="sm" /> Loading...
                        </td>
                      </tr>
                    )}
                    {!loading && rows.length === 0 && (
                      <tr>
                        <td colSpan="8" className="text-center text-muted py-4">
                          No bookings found.
                        </td>
                      </tr>
                    )}
                    {!loading &&
                      rows.map((b, i) => (
                        <tr key={b.id || b.custombookingId || i}>
                          <td>{i + 1}</td>
                          <td>
                            <div className="fw-semibold">{b.bookingCode || b.packageBookCode || "-"}</div>
                            <small className="text-muted">
                              {b.createdAt ? new Date(b.createdAt).toLocaleDateString() : ""}
                            </small>
                          </td>
                          <td>
                            <div>
                              {[b.custSalutation, b.custFirstName, b.custLastName].filter(Boolean).join(" ") || "-"}
                            </div>
                            <small className="text-muted">{b.custEmail || b.custPhone || ""}</small>
                          </td>
                          <td>
                            <div className="fw-semibold">{b.cabName || `Cab #${b.cabId || "-"}`}</div>
                            <small className="text-muted">{b.cabProviderName || ""}</small>
                          </td>
                          <td>
                            <div>
                              <FaMapMarkerAlt className="text-success me-1" />
                              {b.pickupName || "-"} {b.pickupTime ? `@ ${b.pickupTime}` : ""}
                            </div>
                            <div>
                              <FaMapMarkerAlt className="text-danger me-1" />
                              {b.dropoffName || "-"} {b.dropoffTime ? `@ ${b.dropoffTime}` : ""}
                            </div>
                            <small className="text-muted">
                              {fmtDate(b.pickupDate)}
                              {b.dropOffDate ? ` → ${fmtDate(b.dropOffDate)}` : ""}
                            </small>
                          </td>
                          <td>
                            <Badge bg="info">
                              {(b.noOfAdult || 0)}A / {(b.noOfChild || 0)}C
                            </Badge>
                          </td>
                          <td>
                            <div className="fw-semibold">AED {b.totalPrice || b.totalRate || "-"}</div>
                          </td>
                          <td>
                            <div className="d-flex gap-2 align-items-center">
                              <FaEye
                                title="View"
                                role="button"
                                className="text-primary"
                                onClick={() => onView(b)}
                              />
                              {status === "upcoming" && (
                                <FaTrash
                                  title="Cancel"
                                  role="button"
                                  className="text-danger"
                                  onClick={() => onCancelClick(b)}
                                />
                              )}
                              <FaFileAlt
                                title="Voucher"
                                role="button"
                                className="text-info"
                                onClick={() => onVoucher(b)}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>

            {/* Cancel confirmation */}
            <Modal show={showCancel} onHide={() => setShowCancel(false)} centered>
              <Modal.Header closeButton>
                <Modal.Title>Cancel Booking</Modal.Title>
              </Modal.Header>
              <Modal.Body>
                Are you sure you want to cancel booking{" "}
                <strong>{selected?.bookingCode || selected?.packageBookCode}</strong>?
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={() => setShowCancel(false)} disabled={cancelling}>
                  No
                </Button>
                <Button variant="danger" onClick={doCancel} disabled={cancelling}>
                  {cancelling ? "Cancelling..." : "Yes, Cancel"}
                </Button>
              </Modal.Footer>
            </Modal>

            {/* Details (View) modal */}
            <Modal show={showDetails} onHide={() => setShowDetails(false)} size="lg" scrollable centered>
              <Modal.Header closeButton className="bg-light">
                <Modal.Title>
                  <FaCar className="me-2" />
                  Booking Details {details?.bookingCode && <Badge bg="success" className="ms-2">{details.bookingCode}</Badge>}
                </Modal.Title>
              </Modal.Header>
              <Modal.Body>
                {details && (
                  <>
                    <Table size="sm" borderless>
                      <tbody>
                        <tr>
                          <th style={{ width: 180 }}>Booking Code</th>
                          <td>{details.bookingCode || details.packageBookCode || "-"}</td>
                        </tr>
                        <tr>
                          <th>Status</th>
                          <td>
                            <Badge bg={details.status === "CANCELLED" ? "danger" : "success"}>
                              {details.status || "CONFIRMED"}
                            </Badge>
                          </td>
                        </tr>
                        <tr>
                          <th>Cab</th>
                          <td>{details.cabName || "-"} ({details.cabProviderName || "-"})</td>
                        </tr>
                        <tr>
                          <th>Pickup</th>
                          <td>
                            {fmtDate(details.pickupDate)} — {details.pickupName || "-"}{" "}
                            {details.pickupTime ? `@ ${details.pickupTime}` : ""}
                          </td>
                        </tr>
                        <tr>
                          <th>Dropoff</th>
                          <td>
                            {fmtDate(details.dropOffDate)} — {details.dropoffName || "-"}{" "}
                            {details.dropoffTime ? `@ ${details.dropoffTime}` : ""}
                          </td>
                        </tr>
                        <tr>
                          <th>Hours</th>
                          <td>{details.hourDetails ?? "-"}</td>
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
                              {details.contactNumber && <> · <FaPhoneAlt size={10} /> {details.contactNumber}</>}
                              {details.driverName && <> · {details.driverName}</>}
                              {details.driverContact && <> · <FaPhoneAlt size={10} /> {details.driverContact}</>}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </Table>

                    <h6 className="mt-3">Passengers ({(details.noOfAdult || 0) + (details.noOfChild || 0)})</h6>
                    {details.guests && details.guests.length > 0 ? (
                      <Table size="sm" bordered>
                        <thead>
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
                                <Badge bg={g.isChild ? "warning" : "primary"}>{g.isChild ? "Child" : "Adult"}</Badge>
                              </td>
                              <td>{[g.salutation, g.firstName, g.middleName, g.lastName].filter(Boolean).join(" ")}</td>
                              <td>{g.age ?? "-"}</td>
                              <td>{g.passportNo || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    ) : (
                      <p className="text-muted small">No passenger manifest recorded.</p>
                    )}

                    <h6 className="mt-3">Primary Contact</h6>
                    <Table size="sm" borderless>
                      <tbody>
                        <tr>
                          <th style={{ width: 180 }}>
                            <FaUserAltIcon /> Name
                          </th>
                          <td>
                            {[details.custSalutation, details.custFirstName, details.custMiddleName, details.custLastName]
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

                    <h6 className="mt-3">Pricing</h6>
                    <Table size="sm" borderless>
                      <tbody>
                        {details.sellingPrice && (
                          <tr>
                            <th style={{ width: 180 }}>Selling Price</th>
                            <td>AED {details.sellingPrice}</td>
                          </tr>
                        )}
                        {details.totalRate != null && details.totalRate !== details.totalPrice && (
                          <tr>
                            <th>Total Rate</th>
                            <td>AED {details.totalRate}</td>
                          </tr>
                        )}
                        {details.tourismDirham && Number(details.tourismDirham) > 0 && (
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
                            <strong>AED {details.totalPrice || details.totalRate || "-"}</strong>
                          </td>
                        </tr>
                      </tbody>
                    </Table>
                  </>
                )}
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={() => setShowDetails(false)}>
                  Close
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
                  Voucher {selected?.bookingCode ? "- " + selected.bookingCode : ""}
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
                    title={`${fileLabel}-voucher`}
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
                  <Button variant="primary" onClick={() => window.open(pdfUrl, "_blank")}>
                    Download
                  </Button>
                )}
                <Button variant="secondary" onClick={closePdf}>
                  Close
                </Button>
              </Modal.Footer>
            </Modal>
          </Container>
        </main>
      </div>
    </div>
  );
};

// Lightweight icon used inline above (avoid re-import noise)
const FaUserAltIcon = () => <i className="fas fa-user" style={{ marginRight: 4 }} />;

export default SchefferDriverBookingList;
