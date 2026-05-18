import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Card,
  Tab,
  Tabs,
  Row,
  Col,
  Button,
  Badge,
  Spinner,
  Modal,
  Table,
} from "react-bootstrap";
import {
  FaArrowLeft,
  FaSuitcaseRolling,
  FaImages,
  FaRoute,
  FaInfoCircle,
  FaMapMarkerAlt,
  FaClock,
  FaMoon,
  FaRupeeSign,
  FaStar,
  FaCheck,
  FaTimes,
} from "react-icons/fa";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";

const HoneymoonViewPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [pkg, setPkg] = useState(location.state?.pkg || null);
  const [loading, setLoading] = useState(!location.state?.pkg);
  const [activeTab, setActiveTab] = useState("images");
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    if (pkg) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await axiosInstance.get(`/api/honeymoon/${id}`);
        if (!cancelled) setPkg(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, pkg]);

  const goBack = () => navigate("/honeymoon/list");
  // const goToBook = () =>
  //   navigate("/honeymoon/book", { state: { pkg, searchForm: location.state?.searchForm } });

  if (loading) {
    return (
      <div className="d-flex">
        <Sidebar />
        <div className="flex-grow-1">
          <TopBar />
          <div className="text-center py-5">
            <Spinner animation="border" />
          </div>
        </div>
      </div>
    );
  }

  if (!pkg) {
    return (
      <div className="d-flex">
        <Sidebar />
        <div className="flex-grow-1">
          <TopBar />
          <div className="p-4">
            <Button variant="outline-secondary" size="sm" onClick={goBack}>
              <FaArrowLeft className="me-1" /> Back to Search
            </Button>
            <Card className="mt-3 shadow-sm">
              <Card.Body className="text-center text-muted py-5">Package not found.</Card.Body>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  const images = pkg.images || [];
  const itinerary = pkg.itinerary || [];

  return (
    <div
      className="min-vh-100 d-flex flex-column"
      style={{ background: "#f5f7fb" }}
    >
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
            <div>
              <Button variant="outline-secondary" size="sm" className="mb-2 rounded-pill" onClick={goBack}>
                <FaArrowLeft className="me-1" /> Back to Search
              </Button>
              <h4 className="mb-1 text-primary">
                <FaSuitcaseRolling className="me-2" />
                {pkg.packageName}
              </h4>
              <div className="text-muted small">
                <FaMapMarkerAlt className="me-1 text-primary" />
                {pkg.startingFrom} → {pkg.destination} · <FaMoon className="me-1 text-info" />
                {pkg.noOfNights}N / {pkg.noOfDays}D
                {pkg.rating != null && (
                  <>
                    {" "}
                    · <FaStar className="text-warning me-1" />
                    {Number(pkg.rating).toFixed(1)}
                  </>
                )}
              </div>
            </div>
            <div className="text-end">
              <h4 className="text-success mb-2">
                <FaRupeeSign />
                {Number(pkg.markedUpRate || pkg.perPaxRate || 0).toLocaleString()}
                <small className="text-muted fw-normal"> / pax</small>
              </h4>
              {/* <Button variant="primary" onClick={goToBook} className="rounded-pill">
                <FaSuitcaseRolling className="me-1" /> Book a Table
              </Button> */}
            </div>
          </div>

          <Card className="shadow-sm">
            <Card.Body>
              <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k)} className="mb-3" fill>
                <Tab eventKey="images" title={<span><FaImages className="me-1" /> Images</span>}>
                  {images.length === 0 ? (
                    <div className="text-center text-muted py-5">No images uploaded.</div>
                  ) : (
                    <Row className="g-3">
                      {images.map((src, i) => (
                        <Col key={i} xs={6} md={4} lg={3}>
                          <div
                            style={{
                              position: "relative",
                              paddingTop: "75%",
                              cursor: "pointer",
                              borderRadius: 8,
                              overflow: "hidden",
                              border: "1px solid #e5e7eb",
                            }}
                            onClick={() => setPreviewImage(src)}
                          >
                            <img
                              src={src}
                              alt={`img-${i}`}
                              style={{
                                position: "absolute",
                                inset: 0,
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                              }}
                            />
                          </div>
                        </Col>
                      ))}
                    </Row>
                  )}
                </Tab>

                <Tab eventKey="itinerary" title={<span><FaRoute className="me-1" /> Itinerary</span>}>
                  {itinerary.length === 0 ? (
                    <div className="text-center text-muted py-5">No itinerary defined.</div>
                  ) : (
                    <div className="position-relative">
                      {itinerary.map((d) => (
                        <Card key={d.id || d.dayNumber} className="mb-3 border">
                          <Card.Body>
                            <Row className="g-3 align-items-start">
                              <Col md={2}>
                                <div
                                  className="text-center text-white rounded p-3"
                                  style={{
                                    background:
                                      "linear-gradient(135deg, #d63384 0%, #f06292 100%)",
                                  }}
                                >
                                  <FaClock className="mb-1" size={20} />
                                  <h6 className="mb-0">Day {d.dayNumber}</h6>
                                </div>
                              </Col>
                              <Col md={d.imagePath ? 7 : 10}>
                                {d.heading && <h6 className="text-primary">{d.heading}</h6>}
                                {d.place && (
                                  <div className="small text-muted mb-1">
                                    <FaMapMarkerAlt className="me-1 text-primary" />
                                    {d.place}
                                  </div>
                                )}
                                {d.activities && <p className="mb-0">{d.activities}</p>}
                              </Col>
                              {d.imagePath && (
                                <Col md={3}>
                                  <img
                                    src={d.imagePath}
                                    alt={`day-${d.dayNumber}`}
                                    style={{
                                      width: "100%",
                                      height: 100,
                                      objectFit: "cover",
                                      borderRadius: 6,
                                      cursor: "pointer",
                                    }}
                                    onClick={() => setPreviewImage(d.imagePath)}
                                  />
                                </Col>
                              )}
                            </Row>
                          </Card.Body>
                        </Card>
                      ))}
                    </div>
                  )}
                </Tab>

                <Tab eventKey="details" title={<span><FaInfoCircle className="me-1" /> Details</span>}>
                  <Row className="g-3">
                    <Col md={6}>
                      <Card className="border">
                        <Card.Header className="bg-light fw-semibold">Package Info</Card.Header>
                        <Card.Body>
                          <DetailRow label="Code" value={pkg.packageCode} />
                          <DetailRow label="Category" value={pkg.category} />
                          <DetailRow label="Theme" value={pkg.theme} />
                          <DetailRow label="Hotel Category" value={pkg.hotelCategory} />
                          <DetailRow label="Meal Plan" value={pkg.mealPlan} />
                          <DetailRow label="Validity" value={`${pkg.validityFrom || "-"} → ${pkg.validityTo || "-"}`} />
                          <Row
                            label="Rating"
                            value={
                              pkg.rating != null ? (
                                <span>
                                  <FaStar className="text-warning me-1" />
                                  {Number(pkg.rating).toFixed(1)}
                                </span>
                              ) : null
                            }
                          />
                          <DetailRow label="Status" value={<Badge bg="success">{pkg.status}</Badge>} />
                        </Card.Body>
                      </Card>
                    </Col>

                    <Col md={6}>
                      <Card className="border">
                        <Card.Header className="bg-light fw-semibold">Pricing</Card.Header>
                        <Card.Body>
                          <DetailRow label="Total Rate" value={pkg.totalRate ? `₹ ${Number(pkg.totalRate).toLocaleString()}` : "-"} />
                          <DetailRow label="Per Pax Rate" value={pkg.perPaxRate ? `₹ ${Number(pkg.perPaxRate).toLocaleString()}` : "-"} />
                          {pkg.markedUpRate != null && pkg.markupPercent > 0 && (
                            <>
                              <Row
                                label={`After ${pkg.markupPercent}% markup`}
                                value={<strong className="text-success">₹ {Number(pkg.markedUpRate).toLocaleString()}</strong>}
                              />
                            </>
                          )}
                          <DetailRow label="Currency" value={pkg.currency} />
                        </Card.Body>
                      </Card>
                    </Col>

                    {pkg.overview && (
                      <Col md={12}>
                        <Card className="border">
                          <Card.Header className="bg-light fw-semibold">Overview</Card.Header>
                          <Card.Body>{pkg.overview}</Card.Body>
                        </Card>
                      </Col>
                    )}

                    {pkg.highlights && (
                      <Col md={12}>
                        <Card className="border">
                          <Card.Header className="bg-light fw-semibold">Highlights</Card.Header>
                          <Card.Body style={{ whiteSpace: "pre-wrap" }}>{pkg.highlights}</Card.Body>
                        </Card>
                      </Col>
                    )}

                    <Col md={6}>
                      <Card className="border h-100">
                        <Card.Header className="bg-light fw-semibold">
                          <FaCheck className="text-success me-2" /> Inclusions
                        </Card.Header>
                        <Card.Body style={{ whiteSpace: "pre-wrap" }}>
                          {pkg.inclusions || "-"}
                        </Card.Body>
                      </Card>
                    </Col>

                    <Col md={6}>
                      <Card className="border h-100">
                        <Card.Header className="bg-light fw-semibold">
                          <FaTimes className="text-primary me-2" /> Exclusions
                        </Card.Header>
                        <Card.Body style={{ whiteSpace: "pre-wrap" }}>
                          {pkg.exclusions || "-"}
                        </Card.Body>
                      </Card>
                    </Col>

                    {(pkg.cancellationPolicy || pkg.dateChangePolicy || pkg.termsAndConditions) && (
                      <Col md={12}>
                        <Card className="border">
                          <Card.Header className="bg-light fw-semibold">Policies</Card.Header>
                          <Card.Body>
                            <Block label="Cancellation Policy" value={pkg.cancellationPolicy} />
                            <Block label="Date Change Policy" value={pkg.dateChangePolicy} />
                            <Block label="Terms and Conditions" value={pkg.termsAndConditions} />
                          </Card.Body>
                        </Card>
                      </Col>
                    )}
                  </Row>
                </Tab>
              </Tabs>
            </Card.Body>
          </Card>
        </main>
      </div>

      <Modal show={!!previewImage} onHide={() => setPreviewImage(null)} centered size="lg">
        <Modal.Body className="p-0 bg-dark">
          {previewImage && <img src={previewImage} alt="preview" style={{ width: "100%" }} />}
        </Modal.Body>
      </Modal>
    </div>
  );
};

const DetailRow = ({ label, value }) => {
  if (value == null || value === "") return null;
  return (
    <div className="d-flex justify-content-between py-1 border-bottom">
      <span className="text-muted small">{label}</span>
      <span>{value}</span>
    </div>
  );
};

const Block = ({ label, value }) => {
  if (!value) return null;
  return (
    <div className="mb-3">
      <strong className="d-block mb-1">{label}</strong>
      <div className="text-muted small" style={{ whiteSpace: "pre-wrap" }}>
        {value}
      </div>
    </div>
  );
};

export default HoneymoonViewPage;
