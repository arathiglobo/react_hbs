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
  Image,
  Table,
  Modal,
} from "react-bootstrap";
import {
  FaArrowLeft,
  FaUtensils,
  FaImages,
  FaInfoCircle,
  FaMapMarkerAlt,
  FaClock,
  FaPhone,
  FaEnvelope,
  FaGlobe,
  FaStar,
  FaRupeeSign,
  FaCheck,
  FaTimes,
  FaFilePdf,
  FaExternalLinkAlt,
  FaDownload,
} from "react-icons/fa";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";

/**
 * Tabbed view page for a single restaurant.
 *
 * Routed from the search results card "View" button. The card passes the
 * restaurant via router state for an instant render; if the user lands here
 * directly (e.g. via deep link / refresh) the page falls back to fetching
 * /api/restaurant/{id}.
 *
 * Three tabs: Images · Menu · Other Details.
 * "Back" returns to the search page.
 */
const RestaurantViewPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Seed from router state for an instant first paint, but ALWAYS refresh
  // from /api/restaurant/{id} on mount so we get the latest menu PDFs and
  // any newly-saved fields that may not have been included in the search
  // response. The search results carry the cuisineTypes / images but not
  // always every detail field.
  const [restaurant, setRestaurant] = useState(location.state?.restaurant || null);
  const [loading, setLoading] = useState(!location.state?.restaurant);
  const [activeTab, setActiveTab] = useState("images");
  const [previewImage, setPreviewImage] = useState(null);
  /** Currently-previewed menu PDF in the Menu tab (open in modal/iframe). */
  const [previewPdf, setPreviewPdf] = useState(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await axiosInstance.get(`/api/restaurant/${id}`);
        if (!cancelled) setRestaurant(res.data);
      } catch (e) {
        console.error("Failed to load restaurant", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const goBack = () => navigate("/new-booking/restaurant");

  const goToBook = () =>
    navigate("/new-booking/restaurant/booking", { state: { restaurant } });

  if (loading) {
    return (
      <div className="min-vh-100 bg-light d-flex flex-column">
        <TopBar />
        <div className="d-flex flex-grow-1">
          <Sidebar />
          <main className="flex-grow-1" style={{ minWidth: 0, overflowX: "hidden" }}>
          <div className="text-center py-5">
            <Spinner animation="border" />
          </div>
          </main>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-vh-100 bg-light d-flex flex-column">
        <TopBar />
        <div className="d-flex flex-grow-1">
          <Sidebar />
          <main className="flex-grow-1" style={{ minWidth: 0, overflowX: "hidden" }}>
          <div className="p-4">
            <Button variant="outline-secondary" size="sm" onClick={goBack}>
              <FaArrowLeft className="me-1" /> Back to Search
            </Button>
            <Card className="mt-3 shadow-sm">
              <Card.Body className="text-center text-muted py-5">
                Restaurant not found.
              </Card.Body>
            </Card>
          </div>
          </main>
        </div>
      </div>
    );
  }

  const images = restaurant.images || [];
  // The Menu tab now surfaces the uploaded menu PDFs (replaces the old
  // row-by-row menu list captured on the registration form). Restaurants
  // saved before the PDF feature landed may still have entries in
  // `menuList` — we surface those as a fallback table.
  const menuPdfs = Array.isArray(restaurant.menuPdfs) ? restaurant.menuPdfs : [];
  const menus = restaurant.menuList || [];

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1" style={{ minWidth: 0, overflowX: "hidden" }}>
        <div
          className="p-3 p-md-4"
          style={{ background: "#f5f7fb", minHeight: "calc(100vh - 60px)" }}
        >
          {/* Header */}
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
            <div>
              <Button variant="outline-secondary" size="sm" className="mb-2" onClick={goBack}>
                <FaArrowLeft className="me-1" /> Back to Search
              </Button>
              <h4 className="mb-1">
                <FaUtensils className="me-2 text-warning" />
                {restaurant.restaurantName}
              </h4>
              <div className="text-muted small">
                <FaMapMarkerAlt className="me-1 text-danger" />
                {restaurant.place}
                {restaurant.address ? ` · ${restaurant.address}` : ""}
              </div>
            </div>
            <Button variant="primary" onClick={goToBook}>
              <FaUtensils className="me-1" /> Book a Table
            </Button>
          </div>

          <Card className="shadow-sm">
            <Card.Body>
              <Tabs
                activeKey={activeTab}
                onSelect={(k) => setActiveTab(k)}
                className="mb-3"
                fill
              >
                {/* ── Images Tab ───────────────────────────────────────── */}
                <Tab
                  eventKey="images"
                  title={
                    <span>
                      <FaImages className="me-1" /> Images
                    </span>
                  }
                >
                  {images.length === 0 ? (
                    <div className="text-center text-muted py-5">
                      No images uploaded for this restaurant.
                    </div>
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

                {/* ── Menu Tab ────────────────────────────────────────── */}
                <Tab
                  eventKey="menu"
                  title={
                    <span>
                      <FaUtensils className="me-1" /> Menu
                    </span>
                  }
                >
                  {menuPdfs.length === 0 && menus.length === 0 ? (
                    <div className="text-center text-muted py-5">
                      <FaFilePdf size={36} className="mb-2 opacity-50" />
                      <div>No menu PDFs uploaded for this restaurant.</div>
                    </div>
                  ) : (
                    <>
                      {/* Menu PDFs — primary surface. Each card embeds the
                          PDF in an inline <iframe> preview, with a button to
                          open the full PDF in a new tab and a download link. */}
                      {menuPdfs.length > 0 && (
                        <Row className="g-3">
                          {menuPdfs.map((p, i) => {
                            const name =
                              p.displayName ||
                              (p.fileUrl ? p.fileUrl.split("/").pop() : `Menu ${i + 1}`);
                            return (
                              <Col key={p.id || i} md={6} lg={6}>
                                <Card className="h-100 border shadow-sm">
                                  <Card.Header className="bg-white d-flex justify-content-between align-items-center">
                                    <span
                                      className="text-truncate fw-semibold"
                                      style={{ maxWidth: 240 }}
                                      title={name}
                                    >
                                      <FaFilePdf className="text-danger me-2" />
                                      {name}
                                    </span>
                                    <div className="d-flex gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline-primary"
                                        onClick={() => setPreviewPdf(p)}
                                        title="Preview full size"
                                      >
                                        <FaExternalLinkAlt />
                                      </Button>
                                      {p.fileUrl && (
                                        <a
                                          href={p.fileUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="btn btn-sm btn-outline-secondary"
                                          title="Open / Download"
                                          download
                                        >
                                          <FaDownload />
                                        </a>
                                      )}
                                    </div>
                                  </Card.Header>
                                  <div
                                    style={{
                                      height: 460,
                                      background: "#f3f4f6",
                                      overflow: "hidden",
                                    }}
                                  >
                                    {p.fileUrl ? (
                                      <iframe
                                        src={p.fileUrl}
                                        title={name}
                                        width="100%"
                                        height="100%"
                                        style={{ border: "none" }}
                                      />
                                    ) : (
                                      <div className="d-flex align-items-center justify-content-center h-100 text-muted">
                                        Preview unavailable
                                      </div>
                                    )}
                                  </div>
                                </Card>
                              </Col>
                            );
                          })}
                        </Row>
                      )}

                      {/* Legacy fallback — older restaurants saved before the
                          PDF feature landed still have row-by-row menu items.
                          Show them below the PDF cards so nothing is lost. */}
                      {menus.length > 0 && (
                        <>
                          {menuPdfs.length > 0 && <hr className="my-4" />}
                          <h6 className="mb-3 text-muted">
                            <FaUtensils className="me-2" />
                            Menu Items (legacy)
                          </h6>
                          <Row className="g-3">
                            {menus.map((m) => (
                              <Col key={m.id || m.menuName} md={6} lg={4}>
                                <Card className="h-100 border">
                                  {m.image ? (
                                    <div
                                      style={{
                                        height: 140,
                                        backgroundImage: `url(${m.image})`,
                                        backgroundSize: "cover",
                                        backgroundPosition: "center",
                                      }}
                                    />
                                  ) : (
                                    <div
                                      style={{
                                        height: 140,
                                        background: "#f3f4f6",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: "#9ca3af",
                                      }}
                                    >
                                      <FaUtensils size={40} />
                                    </div>
                                  )}
                                  <Card.Body>
                                    <div className="d-flex justify-content-between align-items-start">
                                      <div>
                                        <h6 className="mb-1">{m.menuName}</h6>
                                        <Badge bg="light" text="dark" className="border">
                                          {m.category}
                                        </Badge>
                                      </div>
                                      <div className="text-end">
                                        <Badge bg={m.isVeg ? "success" : "danger"}>
                                          {m.isVeg ? "Veg" : "Non-Veg"}
                                        </Badge>
                                      </div>
                                    </div>
                                    {m.description && (
                                      <p className="small text-muted mt-2 mb-2">{m.description}</p>
                                    )}
                                    <div className="fw-semibold text-success">
                                      <FaRupeeSign className="me-1" />
                                      {Number(m.price).toFixed(2)}
                                    </div>
                                  </Card.Body>
                                </Card>
                              </Col>
                            ))}
                          </Row>
                        </>
                      )}
                    </>
                  )}
                </Tab>

                {/* ── Other Details Tab ───────────────────────────────── */}
                <Tab
                  eventKey="details"
                  title={
                    <span>
                      <FaInfoCircle className="me-1" /> Other Details
                    </span>
                  }
                >
                  <Row className="g-3">
                    <Col md={6}>
                      <Card className="border">
                        <Card.Header className="bg-light fw-semibold">Contact</Card.Header>
                        <Card.Body>
                          <DetailRow
                            icon={<FaPhone className="text-success" />}
                            label="Contact Number"
                            value={restaurant.contactNumber}
                          />
                          <DetailRow
                            icon={<FaPhone className="text-success" />}
                            label="Alternate Number"
                            value={restaurant.alternateNumber}
                          />
                          <DetailRow
                            icon={<FaEnvelope className="text-primary" />}
                            label="Email"
                            value={restaurant.email}
                          />
                          <DetailRow
                            icon={<FaGlobe className="text-info" />}
                            label="Website"
                            value={restaurant.website}
                          />
                          <DetailRow
                            icon={<FaMapMarkerAlt className="text-danger" />}
                            label="Address"
                            value={restaurant.address}
                          />
                          <DetailRow
                            icon={<FaClock className="text-warning" />}
                            label="Open - Close"
                            value={`${String(restaurant.openTime || "").slice(0, 5)} - ${String(
                              restaurant.closeTime || ""
                            ).slice(0, 5)}`}
                          />
                        </Card.Body>
                      </Card>
                    </Col>

                    <Col md={6}>
                      <Card className="border">
                        <Card.Header className="bg-light fw-semibold">About</Card.Header>
                        <Card.Body>
                          <DetailRow label="Description" value={restaurant.description} block />
                          <DetailRow label="Food Type" value={restaurant.foodType} />
                          <DetailRow
                            label="Cuisines"
                            value={(restaurant.cuisineTypes || []).join(", ")}
                          />
                          <DetailRow
                            label="Avg Cost For Two"
                            value={
                              restaurant.averageCostForTwo
                                ? `₹ ${restaurant.averageCostForTwo}`
                                : null
                            }
                          />
                          <DetailRow
                            label="Rating"
                            value={
                              restaurant.rating != null ? (
                                <span>
                                  <FaStar className="text-warning me-1" />
                                  {Number(restaurant.rating).toFixed(1)}
                                </span>
                              ) : null
                            }
                          />
                          <DetailRow label="Dress Code" value={restaurant.dressCode} />
                          <DetailRow label="Status" value={restaurant.status} />
                        </Card.Body>
                      </Card>
                    </Col>

                    <Col md={6}>
                      <Card className="border">
                        <Card.Header className="bg-light fw-semibold">Capacity</Card.Header>
                        <Card.Body>
                          <DetailRow label="Seating Capacity" value={restaurant.seatingCapacity} />
                          <DetailRow label="Number of Tables" value={restaurant.numberOfTables} />
                          <DetailRow label="Tax %" value={restaurant.taxPercent} />
                          <DetailRow label="GST Number" value={restaurant.gstNumber} />
                        </Card.Body>
                      </Card>
                    </Col>

                    <Col md={6}>
                      <Card className="border">
                        <Card.Header className="bg-light fw-semibold">Facilities</Card.Header>
                        <Card.Body>
                          <Table size="sm" borderless className="mb-0">
                            <tbody>
                              {[
                                ["Parking", restaurant.hasParking],
                                ["WiFi", restaurant.hasWifi],
                                ["AC", restaurant.hasAc],
                                ["Outdoor Seating", restaurant.hasOutdoorSeating],
                                ["Live Music", restaurant.hasLiveMusic],
                                ["Serves Alcohol", restaurant.servesAlcohol],
                                ["Pure Veg", restaurant.isPureVeg],
                                ["Family Friendly", restaurant.isFamilyFriendly],
                                ["Pet Friendly", restaurant.petFriendly],
                                ["Home Delivery", restaurant.homeDelivery],
                                ["Take Away", restaurant.takeAway],
                              ].map(([label, val]) => (
                                <tr key={label}>
                                  <td className="ps-0">{label}</td>
                                  <td className="text-end pe-0">
                                    {val ? (
                                      <FaCheck className="text-success" />
                                    ) : (
                                      <FaTimes className="text-muted" />
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        </Card.Body>
                      </Card>
                    </Col>

                    {(restaurant.reservationPolicy || restaurant.cancellationPolicy) && (
                      <Col md={12}>
                        <Card className="border">
                          <Card.Header className="bg-light fw-semibold">Policies</Card.Header>
                          <Card.Body>
                            <DetailRow
                              label="Reservation Policy"
                              value={restaurant.reservationPolicy}
                              block
                            />
                            <DetailRow
                              label="Cancellation Policy"
                              value={restaurant.cancellationPolicy}
                              block
                            />
                          </Card.Body>
                        </Card>
                      </Col>
                    )}
                  </Row>
                </Tab>
              </Tabs>
            </Card.Body>
          </Card>
        </div>
        </main>
      </div>

      <Modal show={!!previewImage} onHide={() => setPreviewImage(null)} centered size="lg">
        <Modal.Body className="p-0 bg-dark">
          {previewImage && (
            <img src={previewImage} alt="preview" style={{ width: "100%", display: "block" }} />
          )}
        </Modal.Body>
      </Modal>

      {/* Menu-PDF preview modal — opens when the user clicks the "expand"
          icon on a menu-PDF card. Renders the PDF in a full-size iframe. */}
      <Modal
        show={!!previewPdf}
        onHide={() => setPreviewPdf(null)}
        centered
        size="xl"
        backdrop="static"
      >
        <Modal.Header closeButton>
          <Modal.Title className="text-truncate" style={{ maxWidth: "70%" }}>
            <FaFilePdf className="text-danger me-2" />
            {previewPdf?.displayName ||
              (previewPdf?.fileUrl
                ? previewPdf.fileUrl.split("/").pop()
                : "Menu PDF")}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0">
          {previewPdf?.fileUrl ? (
            <iframe
              src={previewPdf.fileUrl}
              title="Menu PDF preview"
              width="100%"
              height="640px"
              style={{ border: "none" }}
            />
          ) : (
            <div className="text-muted text-center py-5">
              Preview unavailable.
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          {previewPdf?.fileUrl && (
            <a
              href={previewPdf.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-outline-primary"
            >
              <FaDownload className="me-1" /> Open / Download
            </a>
          )}
          <Button variant="secondary" onClick={() => setPreviewPdf(null)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

const DetailRow = ({ icon, label, value, block }) => {
  if (value == null || value === "" || value === "null") return null;
  if (block) {
    return (
      <div className="mb-2">
        <div className="small text-muted">{label}</div>
        <div>{value}</div>
      </div>
    );
  }
  return (
    <div className="d-flex justify-content-between py-1 border-bottom">
      <span className="text-muted small">
        {icon && <span className="me-1">{icon}</span>}
        {label}
      </span>
      <span className="text-end">{value}</span>
    </div>
  );
};

export default RestaurantViewPage;
