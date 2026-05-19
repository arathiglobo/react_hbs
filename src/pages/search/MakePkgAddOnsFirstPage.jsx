import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Container,
  Card,
  Form,
  Row,
  Col,
  Button,
  Alert,
  Badge,
  Spinner,
} from "react-bootstrap";
import {
  FaArrowLeft,
  FaArrowRight,
  FaPassport,
  FaHotel,
  FaCar,
  FaUmbrellaBeach,
} from "react-icons/fa";
import { toast } from "react-hot-toast";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import AddOnServicesPanel, {
  readAddOnServices,
  collectEnabledAddOnServices,
} from "../../components/AddOnServicesPanel";

/**
 * Add-Ons-First picker — Make Your Own Package v2 step 2.
 *
 * Flow:
 *   1. Pick which services this booking includes (Hotel / Transfer / Tour
 *      etc.) up-front. The next page (v2 search) will only show tabs for
 *      what was selected here.
 *   2. Pick add-on services (meet & greet, car rental, ...) inline; the
 *      shared AddOnServicesPanel writes selections to sessionStorage and
 *      the booking page reads them on save via `collectEnabledAddOnServices`.
 *   3. Visa here is just Yes/No — the customer reaches out to support if
 *      they need a visa; we capture nothing else on this page.
 *
 * On entry, the existing Make-Your-Own-Package Redis cart is cleared so
 * the v2 flow starts from a clean slate (no stale items from a prior
 * legacy session).
 */

const V2_SERVICES_KEY = "makePkgV2Services";
const V2_VISA_KEY = "makePkgV2VisaRequired";

// Support contact shown when the user says YES to "Visa Required" — the
// operations team handles visas offline.
const SUPPORT_EMAIL = "support@yourdomain.com";
const SUPPORT_PHONE = "+971-XX-XXXXXXX";

const SERVICE_GATES = [
  {
    key: "hotel",
    label: "Hotel Accommodation",
    icon: <FaHotel />,
    description: "Unlock the Hotel tab on the next page.",
  },
  {
    key: "transfer",
    label: "Transfers / Cab",
    icon: <FaCar />,
    description: "Airport, inter-city or hourly transfers.",
  },
  {
    key: "tour",
    label: "Tours & Activities",
    icon: <FaUmbrellaBeach />,
    description: "Sightseeing, day trips, attractions.",
  },
];

export default function MakePkgAddOnsFirstPage() {
  const navigate = useNavigate();
  const location = useLocation();
  // Search criteria forwarded from /new-booking/make-your-own-package-v2.
  // Fall back to sessionStorage so a hard refresh of /addons doesn't drop
  // destination/nationality (they're needed for the hotel search payload).
  const criteria = (() => {
    if (location.state && Object.keys(location.state).length > 0) {
      try {
        sessionStorage.setItem(
          "makePkgV2Criteria",
          JSON.stringify(location.state)
        );
      } catch {
        /* ignore */
      }
      return location.state;
    }
    try {
      const raw = sessionStorage.getItem("makePkgV2Criteria");
      if (raw) return JSON.parse(raw);
    } catch {
      /* ignore */
    }
    return {};
  })();

  // Service gates — what becomes searchable on the next page.
  const [services, setServices] = useState(() => {
    try {
      const stored = sessionStorage.getItem(V2_SERVICES_KEY);
      if (stored) return { hotel: true, transfer: false, tour: false, ...JSON.parse(stored) };
    } catch {
      /* fall through */
    }
    return { hotel: true, transfer: true, tour: true };
  });

  // Visa — YES/NO only. NO means "no action needed"; YES surfaces a
  // "contact us" panel and is recorded with the booking so the support
  // team can follow up offline.
  const [visaRequired, setVisaRequired] = useState(() => {
    try {
      return sessionStorage.getItem(V2_VISA_KEY) === "YES" ? "YES" : "NO";
    } catch {
      return "NO";
    }
  });

  // Wipe the legacy/Redis cart once on entry so the v2 flow starts clean.
  const [cartCleared, setCartCleared] = useState(false);
  useEffect(() => {
    const agentId =
      sessionStorage.getItem("makeYourOwnPackageAgentId") ||
      localStorage.getItem("makeYourOwnPackageAgentId");
    if (!agentId) {
      setCartCleared(true);
      return;
    }
    axiosInstance
      .post(`/api/makeYourOwnPackageV2/cart/clear?userId=${agentId}`)
      .then(() => {
        try {
          window.dispatchEvent(new Event("cartUpdated"));
        } catch {
          /* ignore */
        }
      })
      .catch(() => {
        /* clearing is best-effort */
      })
      .finally(() => setCartCleared(true));
  }, []);

  const persistAndNext = () => {
    if (!services.hotel && !services.transfer && !services.tour) {
      toast.error("Pick at least one service to continue.");
      return;
    }
    try {
      sessionStorage.setItem(V2_SERVICES_KEY, JSON.stringify(services));
      sessionStorage.setItem(V2_VISA_KEY, visaRequired);
    } catch {
      /* ignore quota / private-mode */
    }
    navigate("/new-booking/make-your-own-package-v2/search", {
      state: { ...criteria, v2Services: services, v2VisaRequired: visaRequired },
    });
  };

  return (
    <div className="min-vh-100 d-flex flex-column" style={{ background: "#f5f7fb" }}>
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-3">
          <Container fluid>
            <Card className="shadow-sm mb-3">
              <Card.Header className="d-flex justify-content-between align-items-center bg-white">
                <span className="fw-semibold">
                  Make Your Own Package — Step 2: Choose Services
                </span>
                <Badge bg="info">v2 flow</Badge>
              </Card.Header>
              <Card.Body>
                {!cartCleared && (
                  <div className="text-muted small mb-2">
                    <Spinner size="sm" animation="border" className="me-2" />
                    Clearing previous cart…
                  </div>
                )}
                <p className="text-muted small mb-3">
                  Pick the services this booking includes. The next page
                  will only show tabs for what's selected here. You can
                  always come back and toggle items later.
                </p>

                <Row className="g-3">
                  {SERVICE_GATES.map((s) => (
                    <Col md={4} key={s.key}>
                      <Card
                        className={`h-100 ${
                          services[s.key] ? "border-primary" : ""
                        }`}
                        style={{ cursor: "pointer" }}
                        onClick={() =>
                          setServices((p) => ({ ...p, [s.key]: !p[s.key] }))
                        }
                      >
                        <Card.Body>
                          <Form.Check
                            type="switch"
                            id={`svc-${s.key}`}
                            label={
                              <span className="fw-semibold">
                                <span className="me-2 text-primary">
                                  {s.icon}
                                </span>
                                {s.label}
                              </span>
                            }
                            checked={!!services[s.key]}
                            onChange={() =>
                              setServices((p) => ({ ...p, [s.key]: !p[s.key] }))
                            }
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="small text-muted mt-2">
                            {s.description}
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </Card.Body>
            </Card>

            {/* Visa — YES / NO only.
            <Card className="shadow-sm mb-3">
              <Card.Header className="bg-white fw-semibold">
                <FaPassport className="me-2 text-primary" />
                Visa Information
              </Card.Header>
              <Card.Body>
                <div className="d-flex gap-4 align-items-center">
                  <span className="me-2">Visa Required?</span>
                  <Form.Check
                    inline
                    type="radio"
                    name="visa"
                    id="visa-yes"
                    label="Yes"
                    checked={visaRequired === "YES"}
                    onChange={() => setVisaRequired("YES")}
                  />
                  <Form.Check
                    inline
                    type="radio"
                    name="visa"
                    id="visa-no"
                    label="No"
                    checked={visaRequired === "NO"}
                    onChange={() => setVisaRequired("NO")}
                  />
                </div>

                {visaRequired === "YES" && (
                  <Alert variant="info" className="mt-3 mb-0">
                    <strong>Our team handles visa arrangements.</strong>{" "}
                    Please contact us with the traveller's details:
                    <ul className="mb-0 mt-2">
                      <li>
                        Email: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
                      </li>
                      <li>Phone: {SUPPORT_PHONE}</li>
                    </ul>
                    <small className="d-block mt-2 text-muted">
                      We'll record this booking with a visa-pending flag so
                      the support team can follow up.
                    </small>
                  </Alert>
                )}
              </Card.Body>
            </Card> */}

            {/* Add-on services panel — reuses the same component the
                legacy booking page uses, with visa hidden because we
                handle that with the YES/NO question above. The panel
                writes its state to sessionStorage; the v2 booking page
                will read it via collectEnabledAddOnServices() on save. */}
            <Card className="shadow-sm mb-3">
              <Card.Header className="bg-white fw-semibold">
                Add-On Services
              </Card.Header>
              <Card.Body>
                <small className="text-muted d-block mb-2">
                  Optional services (meet &amp; greet, car rental, etc.) —
                  toggle any service to add it to the booking.
                </small>
                <AddOnServicesPanel title="Services" />
              </Card.Body>
            </Card>

            <div className="d-flex justify-content-between">
              <Button
                variant="outline-secondary"
                onClick={() => navigate("/new-booking/make-your-own-package-v2")}
              >
                <FaArrowLeft className="me-2" />
                Back
              </Button>
              <Button variant="success" onClick={persistAndNext}>
                Next: Search Inventory
                <FaArrowRight className="ms-2" />
              </Button>
            </div>
          </Container>
        </main>
      </div>
    </div>
  );
}

// Helpers exported for the search + booking pages that come next.
export const readV2Services = () => {
  try {
    const raw = sessionStorage.getItem(V2_SERVICES_KEY);
    if (!raw) return { hotel: true, transfer: true, tour: true };
    return { hotel: true, transfer: false, tour: false, ...JSON.parse(raw) };
  } catch {
    return { hotel: true, transfer: true, tour: true };
  }
};
export const readV2VisaRequired = () => {
  try {
    return sessionStorage.getItem(V2_VISA_KEY) === "YES" ? "YES" : "NO";
  } catch {
    return "NO";
  }
};
export const V2_SUPPORT_EMAIL = SUPPORT_EMAIL;
export const V2_SUPPORT_PHONE = SUPPORT_PHONE;
// Re-export so the booking page can keep a single import path.
export { collectEnabledAddOnServices, readAddOnServices };
