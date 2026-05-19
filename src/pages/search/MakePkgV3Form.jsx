import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Card,
  Row,
  Col,
  Form,
  Button,
  Spinner,
  Badge,
  InputGroup,
} from "react-bootstrap";
import Select from "react-select";
import { toast } from "react-hot-toast";
import {
  FaHotel,
  FaCar,
  FaUmbrellaBeach,
  FaPassport,
  FaShieldAlt,
  FaConciergeBell,
  FaSimCard,
  FaPlus,
  FaTrash,
  FaSearch,
} from "react-icons/fa";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";

/**
 * v3 Make-Your-Own-Package — Step 1: unified criteria.
 *
 * One form captures everything (trip basics + module gates + add-on
 * YES/NOs) and one submit fires POST /api/makeYourOwnPackageV2/combined-search
 * which returns hotels/transfers/activities in a single response. The
 * /v3/results page then renders that response as a multi-select inventory.
 */

const V3_FLOW = "v3";
const V3_CRITERIA_KEY = "makePkgV3Criteria";
const V3_RESULTS_KEY = "makePkgV3Results";

const todayStr = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const MakePkgV3Form = () => {
  const navigate = useNavigate();

  // Trip basics
  const [travelDate, setTravelDate] = useState(todayStr());
  const [agentList, setAgentList] = useState([]);
  const [agentId, setAgentId] = useState(
    localStorage.getItem("makeYourOwnPackageAgentId") || ""
  );

  // Nationality
  const [nationalityList, setNationalityList] = useState([]);
  const [nationality, setNationality] = useState(null);

  // Destinations (multi-leg)
  const [destOptions, setDestOptions] = useState([]);
  const [itinerary, setItinerary] = useState([
    { id: Date.now(), selectedDestination: null, nights: 1 },
  ]);

  // Pax
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [childAges, setChildAges] = useState([]);

  // Modules
  const [modules, setModules] = useState({
    hotel: true,
    transfer: true,
    activity: true,
  });

  // Add-ons (YES/NO only)
  const [addOns, setAddOns] = useState({
    visa: "NO",
    insurance: "NO",
    meetGreet: "NO",
    simForex: "NO",
  });

  const [searching, setSearching] = useState(false);

  useEffect(() => {
    // Mark this flow so TopBar can hide the legacy cart icon.
    sessionStorage.setItem("makePkgFlow", V3_FLOW);

    // Load agents
    axiosInstance
      .get("/api/agent")
      .then((r) => setAgentList(Array.isArray(r.data) ? r.data : []))
      .catch(() => setAgentList([]));

    // Load destinations (cities)
    axiosInstance
      .get("/api/master/city?limit=500")
      .then((r) => {
        const opts = (r.data || []).map((c) => ({
          value: c.id,
          label: c.name,
          countryId: c.countryId,
          countryName: c.countryName,
        }));
        setDestOptions(opts);
      })
      .catch(() => setDestOptions([]));

    // Load nationalities (countries)
    axiosInstance
      .get("/api/master/country?limit=500")
      .then((r) => {
        const opts = (r.data || []).map((c) => ({
          value: c.id,
          label: c.name,
          code: c.countryCode,
        }));
        setNationalityList(opts);
      })
      .catch(() => setNationalityList([]));
  }, []);

  // Keep child-age array in lockstep with `children`.
  useEffect(() => {
    const n = Number(children) || 0;
    setChildAges((prev) => {
      const next = [...prev];
      while (next.length < n) next.push(0);
      next.length = n;
      return next;
    });
  }, [children]);

  // ── itinerary helpers ───────────────────────────────────────────────
  const addLeg = () =>
    setItinerary((p) => [
      ...p,
      { id: Date.now() + Math.random(), selectedDestination: null, nights: 1 },
    ]);
  const removeLeg = (id) =>
    setItinerary((p) => (p.length === 1 ? p : p.filter((x) => x.id !== id)));
  const updateLeg = (id, field, value) =>
    setItinerary((p) =>
      p.map((x) => (x.id === id ? { ...x, [field]: value } : x))
    );

  const totalNights = itinerary.reduce(
    (s, x) => s + (Number(x.nights) || 0),
    0
  );
  const checkOutStr = (() => {
    if (!travelDate) return "";
    const d = new Date(travelDate);
    d.setDate(d.getDate() + Math.max(1, totalNights));
    return d.toISOString().slice(0, 10);
  })();

  // ── submit ──────────────────────────────────────────────────────────
  const onSubmit = async (e) => {
    e.preventDefault();
    if (!agentId) return toast.error("Pick an agent");
    if (!nationality) return toast.error("Pick a nationality");
    if (
      itinerary.some(
        (x) => !x.selectedDestination || !x.selectedDestination.value
      )
    ) {
      return toast.error("Each itinerary leg needs a destination");
    }
    if (itinerary.some((x) => !Number(x.nights) || Number(x.nights) < 1)) {
      return toast.error("Each leg needs at least 1 night");
    }
    if (Number(adults) < 1) return toast.error("At least 1 adult");

    sessionStorage.setItem("makeYourOwnPackageAgentId", agentId);

    const criteria = {
      agentId: Number(agentId),
      nationalityId: nationality.value,
      nationalityCode: nationality.code,
      checkIn: travelDate,
      checkOut: checkOutStr,
      destinations: itinerary.map((x) => ({
        cityId: x.selectedDestination?.value,
        countryId: x.selectedDestination?.countryId,
        cityName: x.selectedDestination?.label,
        countryName: x.selectedDestination?.countryName,
        nights: Number(x.nights) || 1,
      })),
      rooms: [
        {
          roomNo: 1,
          adultCount: Number(adults),
          childCount: Number(children) || 0,
          adultAges: Array(Number(adults) || 1).fill(25),
          childAges: childAges.map((a) => Number(a) || 0),
        },
      ],
      modules,
      addOns,
    };
    sessionStorage.setItem(V3_CRITERIA_KEY, JSON.stringify(criteria));

    setSearching(true);
    try {
      const res = await axiosInstance.post(
        "/api/makeYourOwnPackageV2/combined-search",
        criteria
      );
      try {
        sessionStorage.setItem(V3_RESULTS_KEY, JSON.stringify(res.data));
      } catch {
        /* quota — non-fatal */
      }
      navigate("/new-booking/make-your-own-package-v3/results", {
        state: { criteria, results: res.data },
      });
    } catch (err) {
      console.error("Combined search failed:", err);
      toast.error("Combined search failed");
    } finally {
      setSearching(false);
    }
  };

  const SectionTitle = ({ children }) => (
    <h6 className="fw-bold text-secondary mb-3 mt-1">{children}</h6>
  );

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-3" style={{ width: "100%" }}>
          <Container fluid className="px-0">
            <Card
              className="shadow-sm border-0 mb-3"
              style={{ borderRadius: 8 }}
            >
              <Card.Body>
                <div className="d-flex justify-content-between align-items-center">
                  <h3 className="fw-bold text-dark mb-0">
                    Make Your Own Package
                    <Badge bg="info" className="ms-2 align-middle">
                      v3 — unified search
                    </Badge>
                  </h3>
                  <small className="text-muted">
                    One search → pick from all modules at once.
                  </small>
                </div>
              </Card.Body>
            </Card>

            <Form onSubmit={onSubmit}>
              {/* ── Trip basics ───────────────────────────────────── */}
              <Card
                className="shadow-sm border-0 mb-3"
                style={{ borderRadius: 8 }}
              >
                <Card.Body>
                  <SectionTitle>Trip basics</SectionTitle>
                  <Row className="g-3">
                    <Col md={3}>
                      <Form.Label>
                        Agent <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Select
                        value={agentId}
                        onChange={(e) => setAgentId(e.target.value)}
                      >
                        <option value="">SELECT</option>
                        {agentList.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.companyName || a.name || `Agent #${a.id}`}
                          </option>
                        ))}
                      </Form.Select>
                    </Col>
                    <Col md={3}>
                      <Form.Label>
                        Nationality <span className="text-danger">*</span>
                      </Form.Label>
                      <Select
                        options={nationalityList}
                        value={nationality}
                        onChange={setNationality}
                        placeholder="Country of guest"
                        isClearable
                      />
                    </Col>
                    <Col md={3}>
                      <Form.Label>
                        Check-in <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control
                        type="date"
                        value={travelDate}
                        min={todayStr()}
                        onChange={(e) => setTravelDate(e.target.value)}
                      />
                    </Col>
                    <Col md={3}>
                      <Form.Label>Check-out (auto)</Form.Label>
                      <Form.Control
                        type="date"
                        value={checkOutStr}
                        readOnly
                        className="bg-light"
                      />
                      <small className="text-muted">
                        Driven by total nights ({totalNights}) below.
                      </small>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>

              {/* ── Itinerary (multi-leg destinations) ────────────── */}
              <Card
                className="shadow-sm border-0 mb-3"
                style={{ borderRadius: 8 }}
              >
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <SectionTitle>Destinations</SectionTitle>
                    <Button
                      size="sm"
                      variant="outline-primary"
                      onClick={(e) => {
                        e.preventDefault();
                        addLeg();
                      }}
                    >
                      <FaPlus className="me-1" />
                      Add destination
                    </Button>
                  </div>
                  {itinerary.map((leg, idx) => (
                    <Row key={leg.id} className="g-3 mb-2 align-items-end">
                      <Col md={1}>
                        <Form.Label className="small text-muted">#</Form.Label>
                        <Form.Control
                          value={idx + 1}
                          readOnly
                          className="text-center bg-light"
                        />
                      </Col>
                      <Col md={7}>
                        <Form.Label className="small">
                          Destination <span className="text-danger">*</span>
                        </Form.Label>
                        <Select
                          options={destOptions}
                          value={leg.selectedDestination}
                          onChange={(val) =>
                            updateLeg(leg.id, "selectedDestination", val)
                          }
                          placeholder="City / Place"
                          isClearable
                        />
                      </Col>
                      <Col md={2}>
                        <Form.Label className="small">Nights</Form.Label>
                        <Form.Control
                          type="number"
                          min={1}
                          value={leg.nights}
                          onChange={(e) =>
                            updateLeg(leg.id, "nights", e.target.value)
                          }
                        />
                      </Col>
                      <Col md={2}>
                        {itinerary.length > 1 && (
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              removeLeg(leg.id);
                            }}
                          >
                            <FaTrash className="me-1" />
                            Remove
                          </Button>
                        )}
                      </Col>
                    </Row>
                  ))}
                </Card.Body>
              </Card>

              {/* ── Pax ──────────────────────────────────────────── */}
              <Card
                className="shadow-sm border-0 mb-3"
                style={{ borderRadius: 8 }}
              >
                <Card.Body>
                  <SectionTitle>Passengers</SectionTitle>
                  <Row className="g-3">
                    <Col md={3}>
                      <Form.Label>Adults</Form.Label>
                      <Form.Control
                        type="number"
                        min={1}
                        max={9}
                        value={adults}
                        onChange={(e) => setAdults(e.target.value)}
                      />
                    </Col>
                    <Col md={3}>
                      <Form.Label>Children</Form.Label>
                      <Form.Control
                        type="number"
                        min={0}
                        max={9}
                        value={children}
                        onChange={(e) => setChildren(e.target.value)}
                      />
                    </Col>
                    {Number(children) > 0 && (
                      <Col md={6}>
                        <Form.Label>Child Ages</Form.Label>
                        <div className="d-flex flex-wrap gap-2">
                          {Array.from(
                            { length: Number(children) },
                            (_, i) => (
                              <InputGroup key={i} style={{ width: 110 }}>
                                <InputGroup.Text>#{i + 1}</InputGroup.Text>
                                <Form.Control
                                  type="number"
                                  min={0}
                                  max={17}
                                  value={childAges[i] ?? ""}
                                  onChange={(e) => {
                                    const v =
                                      e.target.value === ""
                                        ? 0
                                        : Number(e.target.value);
                                    setChildAges((prev) => {
                                      const next = [...prev];
                                      next[i] = v;
                                      return next;
                                    });
                                  }}
                                />
                              </InputGroup>
                            )
                          )}
                        </div>
                      </Col>
                    )}
                  </Row>
                </Card.Body>
              </Card>

              {/* ── Core modules (gates) ──────────────────────────── */}
              <Card
                className="shadow-sm border-0 mb-3"
                style={{ borderRadius: 8 }}
              >
                <Card.Body>
                  <SectionTitle>Core booking modules</SectionTitle>
                  <Row className="g-3">
                    <Col md={4}>
                      <Card
                        className={`h-100 ${modules.hotel ? "border-primary" : ""}`}
                      >
                        <Card.Body>
                          <Form.Check
                            type="switch"
                            id="mod-hotel"
                            label={
                              <span className="fw-semibold">
                                <FaHotel className="me-2 text-primary" />
                                Hotel
                                <Badge bg="secondary" className="ms-2">
                                  always on
                                </Badge>
                              </span>
                            }
                            checked
                            disabled
                          />
                          <small className="text-muted d-block mt-2">
                            Hotels are mandatory for a package.
                          </small>
                        </Card.Body>
                      </Card>
                    </Col>
                    <Col md={4}>
                      <Card
                        className={`h-100 ${modules.transfer ? "border-primary" : ""}`}
                      >
                        <Card.Body>
                          <Form.Check
                            type="switch"
                            id="mod-transfer"
                            label={
                              <span className="fw-semibold">
                                <FaCar className="me-2 text-info" />
                                Transfer / Cab
                              </span>
                            }
                            checked={modules.transfer}
                            onChange={(e) =>
                              setModules((p) => ({
                                ...p,
                                transfer: e.target.checked,
                              }))
                            }
                          />
                          <small className="text-muted d-block mt-2">
                            Airport, inter-city or hourly transfers.
                          </small>
                        </Card.Body>
                      </Card>
                    </Col>
                    <Col md={4}>
                      <Card
                        className={`h-100 ${modules.activity ? "border-primary" : ""}`}
                      >
                        <Card.Body>
                          <Form.Check
                            type="switch"
                            id="mod-activity"
                            label={
                              <span className="fw-semibold">
                                <FaUmbrellaBeach className="me-2 text-warning" />
                                Tours & Activities
                              </span>
                            }
                            checked={modules.activity}
                            onChange={(e) =>
                              setModules((p) => ({
                                ...p,
                                activity: e.target.checked,
                              }))
                            }
                          />
                          <small className="text-muted d-block mt-2">
                            Sightseeing, day trips, attractions.
                          </small>
                        </Card.Body>
                      </Card>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>

              {/* ── Optional add-ons (YES/NO) ─────────────────────── */}
              <Card
                className="shadow-sm border-0 mb-3"
                style={{ borderRadius: 8 }}
              >
                <Card.Body>
                  <SectionTitle>Optional add-ons</SectionTitle>
                  <Row className="g-3">
                    {[
                      { key: "visa", label: "Visa", icon: <FaPassport /> },
                      {
                        key: "insurance",
                        label: "Insurance",
                        icon: <FaShieldAlt />,
                      },
                      {
                        key: "meetGreet",
                        label: "Meet & Greet",
                        icon: <FaConciergeBell />,
                      },
                      {
                        key: "simForex",
                        label: "SIM / Forex",
                        icon: <FaSimCard />,
                      },
                    ].map((row) => (
                      <Col md={3} key={row.key}>
                        <Card className="h-100">
                          <Card.Body className="d-flex flex-column">
                            <div className="fw-semibold mb-2">
                              <span className="me-2 text-primary">
                                {row.icon}
                              </span>
                              {row.label}
                            </div>
                            <div className="d-flex gap-3 mt-auto">
                              <Form.Check
                                inline
                                type="radio"
                                name={`addon-${row.key}`}
                                id={`addon-${row.key}-yes`}
                                label="Yes"
                                checked={addOns[row.key] === "YES"}
                                onChange={() =>
                                  setAddOns((p) => ({ ...p, [row.key]: "YES" }))
                                }
                              />
                              <Form.Check
                                inline
                                type="radio"
                                name={`addon-${row.key}`}
                                id={`addon-${row.key}-no`}
                                label="No"
                                checked={addOns[row.key] !== "YES"}
                                onChange={() =>
                                  setAddOns((p) => ({ ...p, [row.key]: "NO" }))
                                }
                              />
                            </div>
                          </Card.Body>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                </Card.Body>
              </Card>

              {/* ── Submit ──────────────────────────────────────── */}
              <div className="text-end">
                <Button
                  type="submit"
                  variant="success"
                  size="lg"
                  disabled={searching}
                >
                  {searching ? (
                    <>
                      <Spinner size="sm" animation="border" className="me-1" />
                      Searching…
                    </>
                  ) : (
                    <>
                      <FaSearch className="me-2" />
                      Search Package
                    </>
                  )}
                </Button>
              </div>
            </Form>
          </Container>
        </main>
      </div>
    </div>
  );
};

export default MakePkgV3Form;
