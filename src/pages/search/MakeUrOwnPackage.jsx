import React, { useEffect, useState } from "react";
import {
  Card,
  Button,
  Row,
  Col,
  Form,
  Badge,
  Spinner,
} from "react-bootstrap";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import Select from "react-select";
import axiosInstance from "../../components/AxiosInstance";
import {
  FaSearch,
  FaGlobe,
  FaUser,
  FaCalendarAlt,
  FaMapMarkerAlt,
  FaUsers,
  FaChild,
  FaPlus,
} from "react-icons/fa";

import { useNavigate } from "react-router-dom";

export default function MakeUrOwnPackage() {
  const navigate = useNavigate();
  const [nationalityList, setNationalityList] = useState([]);
  const [selectedNationality, setSelectedNationality] = useState(null);
  const [destinationOptions, setDestinationOptions] = useState([]);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [travelDate, setTravelDate] = useState("");
  const [agent, setAgent] = useState("");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [childAges, setChildAges] = useState([]);
  const [nights, setNights] = useState(1);
  const [agents, setAgents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [isDestinationLoading, setIsDestinationLoading] = useState(false);

  // Debounce utility function
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Debounced city search function
  const debouncedCitySearch = React.useRef(
    debounce(async (searchText = "") => {
      if (!searchText || searchText.length < 2) {
        setDestinationOptions([]);
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
        console.log("axios call error for city list:", error);
        setDestinationOptions([]);
      } finally {
        setIsDestinationLoading(false);
      }
    }, 300)
  ).current;

  const countryList = async () => {
    try {
      const response = await axiosInstance.get("/api/country");
      const options = Array.isArray(response.data)
        ? response.data.map((country) => ({
          value: country.id,
          label: country.name,
          code: country.countryCode,
        }))
        : [];
      setNationalityList(options);
    } catch (error) {
      console.log("error for country list:", error);
      setNationalityList([]);
    }
  };

  const cityList = (searchText = "") => {
    debouncedCitySearch(searchText);
  };

  const loadPopularDestinations = async () => {
    if (destinationOptions.length > 0) return;

    try {
      setIsDestinationLoading(true);
      const response = await axiosInstance.get("/api/province?limit=20");
      const cityApiRes = Array.isArray(response.data) ? response.data : [];
      const options = cityApiRes.map((city) => ({
        value: city.id,
        label: `${city.stateName}, ${city.country}`,
        countryId: city.countryId,
      }));
      setDestinationOptions(options);
    } catch (error) {
      console.log("Error loading popular destinations:", error);
    } finally {
      setIsDestinationLoading(false);
    }
  };

  const agentList = async () => {
    try {
      const response = await axiosInstance.get("/api/agent");
      setAgents(response.data);
    } catch (error) {
      console.log("error for agent axios list:", error);
      setAgents([]);
    }
  };

  useEffect(() => {
    countryList();
    agentList();
  }, []);

  const formatDate = (date) => date.toISOString().split("T")[0];
  const today = formatDate(new Date());

  const validateForm = () => {
    const newErrors = {};

    if (!travelDate) {
      newErrors.travelDate = "Travel Date is required";
    }

    if (!agent) {
      newErrors.agent = "Agent is required";
    }

    if (!selectedNationality) {
      newErrors.nationality = "Native Country of Guest is required";
    }

    if (!selectedDestination) {
      newErrors.destination = "Search Destination is required";
    }

    if (!adults || adults < 1) {
      newErrors.adults = "Number of adults must be at least 1";
    }

    if (children < 0) {
      newErrors.children = "Number of children cannot be negative";
    }

    if (children > 0 && childAges.length !== children) {
      newErrors.childAges = "Please enter age for all children";
    }

    if (children > 0 && childAges.some(age => !age || age < 0 || age > 17)) {
      newErrors.childAges = "Child age must be between 0 and 17";
    }

    if (!nights || nights < 1) {
      newErrors.nights = "Number of nights must be at least 1";
    }

    return newErrors;
  };

  const clearError = (field) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const { [field]: _omit, ...rest } = prev;
      return rest;
    });
  };

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    const formErrors = validateForm();
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }

    if (agent) {
      sessionStorage.setItem("makeYourOwnPackageAgentId", agent);
      localStorage.setItem("makeYourOwnPackageAgentId", agent);
    }

    // Store travel date in sessionStorage for use in booking page
    if (travelDate) {
      sessionStorage.setItem("makePkgTravelDate", travelDate);
    }

    // Navigate to new Package Generation page
    navigate("/new-booking/make-your-own-package/search", {
      state: {
        travelDate,
        agent,
        nationality: selectedNationality,
        destination: selectedDestination,
        adults,
        children,
        childAges: childAges.map(age => parseInt(age) || 0),
        nights,
      },
    });

  };


  // const handleSearchSubmit = async (e) => {
  //   e.preventDefault();
  //   const formErrors = validateForm();
  //   if (Object.keys(formErrors).length > 0) {
  //     setErrors(formErrors);
  //     return;
  //   }
  //   setErrors({});
  //   setIsLoading(true);

  //   try {
  //     // Here you would implement the package search logic
  //     console.log("Package search submitted:", {
  //       travelDate,
  //       agent,
  //       nationality: selectedNationality,
  //       destination: selectedDestination,
  //       adults,
  //       children,
  //       nights,
  //     });

  //     // Simulate API call
  //     await new Promise(resolve => setTimeout(resolve, 2000));

  //     // Navigate to results or show success message
  //     alert("Package search completed! (This is a demo)");
  //   } catch (err) {
  //     console.error("Search failed:", err);
  //   } finally {
  //     setIsLoading(false);
  //   }
  // };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Card className="shadow-sm rounded-xl mb-4" style={{ backgroundColor: '#ffffff' }}>
            <Card.Body className="p-4">
              <div className="d-flex align-items-center mb-4">
                <div className="me-3">
                  <div className="bg-primary rounded p-2">
                    <FaSearch className="text-white" size={24} />
                  </div>
                </div>
                <div>
                  <h2 className="fw-bold text-dark mb-1">
                    Make My Trip
                  </h2>
                  <p className="text-muted mb-0">
                    Plan your perfect vacation package
                  </p>
                </div>
              </div>

              <Form onSubmit={handleSearchSubmit}>
                <Row className="g-4">
                  <Col lg={3} md={6}>
                    <Form.Group>
                      <Form.Label className="fw-semibold text-dark">
                        <FaCalendarAlt className="me-2" />
                        Travel Date <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control
                        type="date"
                        value={travelDate}
                        min={today}
                        onChange={(e) => {
                          setTravelDate(e.target.value);
                          if (e.target.value) clearError("travelDate");
                        }}
                        className="form-control-modern"
                        isInvalid={!!errors.travelDate}
                      />
                      {errors.travelDate && (
                        <div className="text-danger small mt-1">
                          {errors.travelDate}
                        </div>
                      )}
                    </Form.Group>
                  </Col>

                  <Col lg={3} md={6}>
                    <Form.Group>
                      <Form.Label className="fw-semibold text-dark">
                        <FaUser className="me-2" />
                        Agent <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Select
                        value={agent}
                        onChange={(e) => {
                          setAgent(e.target.value);
                          if (e.target.value) clearError("agent");
                        }}
                        className="form-control-modern"
                        isInvalid={!!errors.agent}
                      >
                        <option value="">SELECT</option>
                        {agents.map((agentItem) => (
                          <option key={agentItem.id} value={agentItem.id}>
                            {agentItem.companyName}
                          </option>
                        ))}
                      </Form.Select>
                      {errors.agent && (
                        <div className="text-danger small mt-1">
                          {errors.agent}
                        </div>
                      )}
                    </Form.Group>
                  </Col>

                  <Col lg={3} md={6}>
                    <Form.Group>
                      <Form.Label className="fw-semibold text-dark">
                        <FaGlobe className="me-2" />
                        Native Country of Guest <span className="text-danger">*</span>
                      </Form.Label>
                      <Select
                        options={nationalityList}
                        value={selectedNationality}
                        onChange={(option) => {
                          setSelectedNationality(option);
                          if (option) clearError("nationality");
                        }}
                        placeholder="SELECT"
                        isSearchable
                        isClearable
                        className="modern-select"
                        menuPortalTarget={document.body}
                        styles={{
                          menuPortal: base => ({ ...base, zIndex: 9999 }),
                          control: (base) => ({
                            ...base,
                            minHeight: "42px",
                            border: "1px solid #dee2e6",
                            "&:hover": { borderColor: "#86b7fe" },
                          }),
                        }}
                      />
                      {errors.nationality && (
                        <div className="text-danger small mt-1">
                          {errors.nationality}
                        </div>
                      )}
                    </Form.Group>
                  </Col>

                  <Col lg={3} md={6}>
                    <Form.Group>
                      <Form.Label className="fw-semibold text-dark">
                        <FaUsers className="me-2" />
                        No of adult <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Select
                        value={adults}
                        onChange={(e) => {
                          setAdults(parseInt(e.target.value) || 1);
                          if (e.target.value) clearError("adults");
                        }}
                        className="form-control-modern"
                        isInvalid={!!errors.adults}
                      >
                        {Array.from({ length: 9 }, (_, i) => i + 1).map((num) => (
                          <option key={num} value={num}>
                            {num}
                          </option>
                        ))}
                      </Form.Select>
                      {errors.adults && (
                        <div className="text-danger small mt-1">
                          {errors.adults}
                        </div>
                      )}
                    </Form.Group>
                  </Col>

                  <Col lg={3} md={6}>
                    <Form.Group>
                      <Form.Label className="fw-semibold text-dark">
                        <FaChild className="me-2" />
                        No of Child <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Select
                        value={children}
                        onChange={(e) => {
                          const newChildren = parseInt(e.target.value) || 0;
                          setChildren(newChildren);
                          // Initialize or adjust child ages array
                          if (newChildren > 0) {
                            const newChildAges = Array.from({ length: newChildren }, (_, i) =>
                              childAges[i] || ""
                            );
                            setChildAges(newChildAges);
                          } else {
                            setChildAges([]);
                          }
                          if (e.target.value) clearError("children");
                          clearError("childAges");
                        }}
                        className="form-control-modern"
                        isInvalid={!!errors.children}
                      >
                        {Array.from({ length: 6 }, (_, i) => i).map((num) => (
                          <option key={num} value={num}>
                            {num}
                          </option>
                        ))}
                      </Form.Select>
                      {errors.children && (
                        <div className="text-danger small mt-1">
                          {errors.children}
                        </div>
                      )}
                    </Form.Group>
                  </Col>

                  {/* Child Age Fields */}
                  {children > 0 && (
                    <>
                      {Array.from({ length: children }, (_, i) => (
                        <Col key={i} lg={3} md={4} sm={6}>
                          <Form.Group>
                            <Form.Label className="fw-semibold text-dark">
                              <FaChild className="me-2" />
                              Child {i + 1} Age <span className="text-danger">*</span>
                            </Form.Label>
                            <Form.Control
                              type="number"
                              min="0"
                              max="17"
                              value={childAges[i] || ""}
                              onChange={(e) => {
                                const newAges = [...childAges];
                                newAges[i] = e.target.value;
                                setChildAges(newAges);
                                clearError("childAges");
                              }}
                              placeholder="Enter age"
                              className="form-control-modern"
                              isInvalid={!!errors.childAges}
                            />
                            {errors.childAges && i === 0 && (
                              <div className="text-danger small mt-1">
                                {errors.childAges}
                              </div>
                            )}
                          </Form.Group>
                        </Col>
                      ))}
                    </>
                  )}

                  <Col lg={6} md={6}>
                    <Form.Group>
                      <Form.Label className="fw-semibold text-dark">
                        <FaMapMarkerAlt className="me-2" />
                        Search Destination <span className="text-danger">*</span>
                      </Form.Label>
                      <Select
                        options={destinationOptions}
                        value={selectedDestination}
                        onChange={(option) => {
                          setSelectedDestination(option);
                          if (option) clearError("destination");
                        }}
                        placeholder="Search destinations..."
                        isSearchable
                        isClearable
                        className="modern-select"
                        isLoading={isDestinationLoading}
                        noOptionsMessage={() =>
                          isDestinationLoading
                            ? "Searching destinations..."
                            : "Type to search destinations..."
                        }
                        onMenuOpen={() => {
                          if (destinationOptions.length === 0) {
                            loadPopularDestinations();
                          }
                        }}
                        onInputChange={(inputValue, { action }) => {
                          if (action === "input-change") {
                            cityList(inputValue);
                          }
                        }}
                        menuPortalTarget={document.body}
                        styles={{
                          menuPortal: base => ({ ...base, zIndex: 9999 }),
                          control: (base) => ({
                            ...base,
                            minHeight: "42px",
                            border: "1px solid #dee2e6",
                            "&:hover": { borderColor: "#86b7fe" },
                          }),
                        }}
                      />
                      {errors.destination && (
                        <div className="text-danger small mt-1">
                          {errors.destination}
                        </div>
                      )}
                    </Form.Group>
                  </Col>

                  <Col lg={3} md={6}>
                    <Form.Group>
                      <Form.Label className="fw-semibold text-dark">
                        <FaCalendarAlt className="me-2" />
                        Number of nights <span className="text-danger">*</span>
                      </Form.Label>
                      <div className="d-flex">
                        <Form.Control
                          type="number"
                          min="1"
                          max="30"
                          value={nights}
                          onChange={(e) => {
                            setNights(parseInt(e.target.value) || 1);
                            if (e.target.value) clearError("nights");
                          }}
                          className="form-control-modern"
                          isInvalid={!!errors.nights}
                        />
                        <Button
                          variant="primary"
                          className="ms-2"
                          onClick={() => setNights(prev => prev + 1)}
                        >
                          <FaPlus />
                        </Button>
                      </div>
                      {errors.nights && (
                        <div className="text-danger small mt-1">
                          {errors.nights}
                        </div>
                      )}
                    </Form.Group>
                  </Col>
                </Row>

                <Row className="mt-4">
                  <Col className="d-flex justify-content-center">
                    <Button
                      type="submit"
                      className="btn-warning btn-lg px-5 py-3 rounded-pill"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Spinner
                            animation="border"
                            size="sm"
                            className="me-2"
                          />
                          Creating Package...
                        </>
                      ) : (
                        <>
                          <FaSearch className="me-2" />
                          Make your own trip
                        </>
                      )}
                    </Button>
                  </Col>
                </Row>
              </Form>
            </Card.Body>
          </Card>

          <Card className="shadow-sm rounded-xl">
            <Card.Body className="text-center text-muted py-5">
              <FaSearch className="display-4 text-muted mb-3" />
              <h4>Ready to Create Your Perfect Trip?</h4>
              <p>
                Use the search form above to plan your dream vacation package.
              </p>
            </Card.Body>
          </Card>
        </main>
      </div>
    </div>
  );
}