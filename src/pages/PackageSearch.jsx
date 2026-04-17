import React, { useEffect, useRef, useState } from "react";
import {
  Card,
  Button,
  Row,
  Col,
  Form,
  Spinner,
} from "react-bootstrap";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import Select from "react-select";
import axiosInstance from "../components/AxiosInstance";
import { FaSearch } from "react-icons/fa";
import { toast } from "react-hot-toast";
import "../styles/PackageSearch.css";

const PackageSearch = () => {
  const [agents, setAgents] = useState([]);
  const [agentId, setAgentId] = useState("");
  const [destinationOptions, setDestinationOptions] = useState([]);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [isDestinationLoading, setIsDestinationLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

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

    try {
      const payload = {
        countryId: selectedDestination.countryId || "",
        cityId: selectedDestination.value || "",
        agentId: agentId || "",
      };

      console.log("Package search payload:", payload);
      const response = await axiosInstance.post("/api/packageSearch", payload);
      
      console.log("Package search response:", response.data);
      toast.success("Search completed successfully!");
      // Handle response data here (e.g., setResults(response.data))
    } catch (error) {
      console.error("Package search failed:", error);
      toast.error(error.response?.data?.message || "Package search failed");
    } finally {
      setIsLoading(false);
    }
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

          {/* Empty State / Search Guide */}
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
        </main>
      </div>
    </div>
  );
};

export default PackageSearch;
