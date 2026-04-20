import React, { useEffect, useRef, useState } from "react";
import {
  Card,
  Button,
  Row,
  Col,
  Form,
  Spinner,
} from "react-bootstrap";
import Sidebar from "../../../components/Sidebar";
import TopBar from "../../../components/TopBar";
import Select from "react-select";
import axiosInstance from "../../../components/AxiosInstance";
import { FaClock, FaSearch } from "react-icons/fa";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import "../../../styles/PackageSearch.css";

const PackageSearch = () => {
  const [agents, setAgents] = useState([]);
  const [agentId, setAgentId] = useState("");
  const [destinationOptions, setDestinationOptions] = useState([]);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [isDestinationLoading, setIsDestinationLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [results, setResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(null);
  const navigate = useNavigate();

  // ─────────────────────────────────────────────
  // Helper: Debounce function
  // ─────────────────────────────────────────────
  const debounce = (func, wait) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  };

  // ─────────────────────────────────────────────
  // Progress Bar Helpers
  // ─────────────────────────────────────────────
  const startProgress = () => {
    setProgress(0);
    let current = 0;
    progressRef.current = setInterval(() => {
      current += Math.random() * 8 + 2;
      if (current >= 90) {
        current = 90;
        clearInterval(progressRef.current);
      }
      setProgress(Math.min(current, 90));
    }, 200);
  };

  const completeProgress = () => {
    clearInterval(progressRef.current);
    setProgress(100);
    setTimeout(() => setProgress(0), 600);
  };

  // ─────────────────────────────────────────────
  // API: Fetch Agents
  // ─────────────────────────────────────────────
  const fetchAgents = async () => {
    try {
      const response = await axiosInstance.get("/api/agent");
      setAgents(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Error fetching agents:", error);
      setAgents([]);
    }
  };

  // ─────────────────────────────────────────────
  // API: Fetch Destinations (Initial & Search)
  // ─────────────────────────────────────────────
  const loadInitialDestinations = async () => {
    try {
      setIsDestinationLoading(true);
      const response = await axiosInstance.get("/api/province?limit=50");
      const cityApiRes = Array.isArray(response.data) ? response.data : [];
      const options = cityApiRes.map((city) => ({
        value: city.id,
        label: `${city.stateName}, ${city.country}`,
        countryId: city.countryId,
      }));
      setDestinationOptions(options);
    } catch (error) {
      console.error("Error loading initial destinations:", error);
    } finally {
      setIsDestinationLoading(false);
    }
  };

  const debouncedCitySearch = useRef(
    debounce(async (searchText = "") => {
      if (!searchText || searchText.length < 2) {
        loadInitialDestinations();
        return;
      }
      setIsDestinationLoading(true);
      try {
        const response = await axiosInstance.get(
          `/api/province?search=${searchText}`
        );
        const cityApiRes = Array.isArray(response.data) ? response.data : [];
        const options = cityApiRes.slice(0, 50).map((city) => ({
          value: city.id,
          label: `${city.stateName}, ${city.country}`,
          countryId: city.countryId,
        }));
        setDestinationOptions(options);
      } catch (error) {
        console.error("Error searching cities:", error);
        setDestinationOptions([]);
      } finally {
        setIsDestinationLoading(false);
      }
    }, 300)
  ).current;

  useEffect(() => {
    fetchAgents();
    loadInitialDestinations();
  }, []);

  // ─────────────────────────────────────────────
  // Form Submission
  // ─────────────────────────────────────────────
  const validateForm = () => {
    const newErrors = {};
    if (!selectedDestination) newErrors.destination = "Destination is required";
    if (!agentId) newErrors.agent = "Agent is required";
    return newErrors;
  };

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    const formErrors = validateForm();
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }

    setErrors({});
    setIsLoading(true);
    startProgress();
    setHasSearched(true);
    setResults([]);

    try {
      const payload = {
        countryId: selectedDestination.countryId || "",
        cityId: selectedDestination.value || "",
        agentId: agentId || "",
      };

      console.log("Package search payload:", payload);
      const response = await axiosInstance.post("/api/v1/package-booking/search", payload);

      console.log("Package search response:", response.data);
      setResults(Array.isArray(response.data) ? response.data : []);

      if (response.data.length > 0) {
        toast.success(`Found ${response.data.length} packages!`);
      } else {
        toast.error("No packages found for the selected criteria.");
      }
    } catch (error) {
      console.error("Package search failed:", error);
      toast.error(error.response?.data?.message || "Package search failed");
      setResults([]);
    } finally {
      setIsLoading(false);
      completeProgress();
    }
  };

  const handleBookNow = (packageId) => {
    navigate(`/new-booking/package-booking/${packageId}`, {
      state: {
        agentId: agentId || "",
        destinationCountryId: selectedDestination?.countryId || "",
      },
    });
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 package-search-container">
          <Card className="search-card-modern shadow-sm border-0">
            <Card.Body>
              <div className="mb-4">
                <h2 className="fw-bold text-primary mb-1">Package Search</h2>
                <p className="text-muted">Find the best travel packages for your clients</p>
              </div>

              <Form onSubmit={handleSearchSubmit}>
                <Row className="g-4">
                  {/* Destination Dropdown */}
                  <Col lg={6} md={12}>
                    <Form.Group>
                      <Form.Label>Destination</Form.Label>
                      <Select
                        className="modern-select"
                        classNamePrefix="react-select"
                        options={destinationOptions}
                        value={selectedDestination}
                        isLoading={isDestinationLoading}
                        onInputChange={(val) => debouncedCitySearch(val)}
                        onChange={(option) => {
                          setSelectedDestination(option);
                          if (option) setErrors(prev => ({ ...prev, destination: null }));
                        }}
                        placeholder="Search for Country or City..."
                        isSearchable
                        isClearable
                      />
                      {errors.destination && (
                        <div className="text-danger small mt-1">{errors.destination}</div>
                      )}
                    </Form.Group>
                  </Col>

                  {/* Agent Dropdown */}
                  <Col lg={6} md={12}>
                    <Form.Group>
                      <Form.Label>Agent</Form.Label>
                      <Form.Select
                        className="form-control-modern"
                        value={agentId}
                        onChange={(e) => {
                          setAgentId(e.target.value);
                          if (e.target.value) setErrors(prev => ({ ...prev, agent: null }));
                        }}
                      >
                        <option value="">Select Agent</option>
                        {agents.map((agent) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.companyName}
                          </option>
                        ))}
                      </Form.Select>
                      {errors.agent && (
                        <div className="text-danger small mt-1">{errors.agent}</div>
                      )}
                    </Form.Group>
                  </Col>
                </Row>

                <div className="d-flex justify-content-center mt-5">
                  <Button
                    type="submit"
                    className="btn-search-modern d-flex align-items-center gap-2"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Spinner animation="border" size="sm" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <FaSearch size={18} />
                        SEARCH PACKAGES
                      </>
                    )}
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>

          {/* Progress Bar */}
          {progress > 0 && (
            <div className="progress-bar-wrap">
              <div
                className="progress-bar-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {/* Results / Empty State */}
          {!hasSearched ? (
            <Card className="empty-state-card mt-5 text-center py-5">
              <Card.Body>
                <div className="empty-state-icon">
                  <FaSearch />
                </div>
                <h4 className="fw-bold text-dark mb-2">Ready to Search?</h4>
                <p className="text-muted mx-auto" style={{ maxWidth: "500px" }}>
                  Select a destination and an agent to discover available travel packages and special offers.
                </p>
              </Card.Body>
            </Card>
          ) : results.length > 0 ? (
            <div className="mt-4">
              {/* Results Header */}
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="fw-bold mb-0 text-dark">Search Results</h5>
                <span className="text-muted fw-medium">{results.length} Packages Found</span>
              </div>

              {/* Card Grid */}
              <Row className="g-3">
                {results.map((pkg) => (
                  <Col key={pkg.packageId} xl={4} lg={4} md={6}>
                    <div className="result-card-wrap">
                      <Card className="result-card border-0">
                        {/* Image */}
                        <div className="package-image-wrap">
                          <img
                            src={pkg.packageImage || "https://via.placeholder.com/400x300?text=Package+Image"}
                            alt={pkg.packageName}
                            className="package-image"
                          />
                          <div className="duration-badge">
                            <FaClock className="me-1 mb-1" size={11} />
                            {pkg.duration} Night(s)
                          </div>
                        </div>

                        {/* Body */}
                        <Card.Body className="d-flex flex-column p-3">
                          <span className="package-type-tag">{pkg.packageType}</span>
                          <h6 className="package-name">{pkg.packageName}</h6>
                          <p className="text-muted mb-3" style={{ fontSize: "0.78rem" }}>
                            {pkg.packageCategory}
                          </p>

                          {/* Price + Book */}
                          <div className="price-box d-flex justify-content-between align-items-center mt-auto">
                            <div>
                              <span className="price-currency">AED </span>
                              <span className="price-value">{pkg.rate}</span>
                              <span className="price-unit">/{pkg.rateType}</span>
                            </div>
                            <Button
                              variant="primary"
                              size="sm"
                              className="rounded-pill px-3 fw-bold"
                              style={{ fontSize: "0.78rem" }}
                              onClick={() => handleBookNow(pkg.packageId)}
                            >
                              Book Now
                            </Button>
                          </div>
                        </Card.Body>
                      </Card>
                    </div>
                  </Col>
                ))}
              </Row>
            </div>
          ) : (
            <Card className="empty-state-card mt-5 text-center py-5">
              <Card.Body>
                <div className="empty-state-icon text-muted opacity-50">
                  <FaSearch />
                </div>
                <h4 className="fw-bold text-dark mb-2">No Packages Found</h4>
                <p className="text-muted mx-auto" style={{ maxWidth: "500px" }}>
                  We couldn't find any packages matching your selection. Try adjusting your destination or agent.
                </p>
                <Button
                  variant="outline-primary"
                  className="mt-3 rounded-pill"
                  onClick={() => {
                    setHasSearched(false);
                    setResults([]);
                  }}
                >
                  Clear Search
                </Button>
              </Card.Body>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
};

export default PackageSearch;