import React, { useEffect, useState, useRef } from "react";
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
  const [isDestinationLoading, setIsDestinationLoading] = useState(false);
  const [isNationalityLoading, setIsNationalityLoading] = useState(false);

  const [itinerary, setItinerary] = useState([
    { id: Date.now(), selectedDestination: null, nights: 1 }
  ]);
  const [travelDate, setTravelDate] = useState("");
  const [agent, setAgent] = useState("");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [childAges, setChildAges] = useState([]);
  const [agents, setAgents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

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

  // Debounced country search function
  const debouncedCountrySearch = useRef(
    debounce(async (search) => {
      try {
        setIsNationalityLoading(true);
        const response = await axiosInstance.get(`/api/country?search=${search}`);
        const options = Array.isArray(response.data)
          ? response.data.map((country) => ({
            value: country.id,
            label: country.name,
            code: country.countryCode,
          }))
          : [];
        setNationalityList(options);
      } catch (error) {
        console.log("axios call error for country list:", error);
        setNationalityList([]);
      } finally {
        setIsNationalityLoading(false);
      }
    }, 300)
  ).current;

  const countryList = async (search = "") => {
    if (search) {
      debouncedCountrySearch(search);
    } else {
      try {
        setIsNationalityLoading(true);
        const response = await axiosInstance.get("/api/country?limit=50");
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
      } finally {
        setIsNationalityLoading(false);
      }
    }
  };

  const handleCountryInputChange = (inputValue) => {
    if (inputValue.length >= 2) {
      debouncedCountrySearch(inputValue);
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

  const addDestination = () => {
    setItinerary([...itinerary, { id: Date.now(), selectedDestination: null, nights: 1 }]);
  };

  const removeDestination = (id) => {
    if (itinerary.length > 1) {
      setItinerary(itinerary.filter(item => item.id !== id));
    }
  };

  const updateDestination = (id, destination) => {
    setItinerary(itinerary.map(item => 
      item.id === id ? { ...item, selectedDestination: destination } : item
    ));
    if (destination) clearError(`destination_${id}`);
  };

  const updateNights = (id, nights) => {
    setItinerary(itinerary.map(item => 
      item.id === id ? { ...item, nights: parseInt(nights) || 1 } : item
    ));
    if (nights) clearError(`nights_${id}`);
  };

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

    if (children > 0 && childAges.some(age => !age || age < 0 || age > 17)) {
      newErrors.childAges = "Child age must be between 0 and 17";
    }

    itinerary.forEach((item, index) => {
      if (!item.selectedDestination) {
        newErrors[`destination_${item.id}`] = "Destination is required";
      }
      if (!item.nights || item.nights < 1) {
        newErrors[`nights_${item.id}`] = "Nights must be at least 1";
      }
    });

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
        itinerary, // Pass the entire itinerary array
        adults,
        children,
        childAges: childAges.map(age => parseInt(age) || 0),
        // Pass the first destination and total nights for backward compatibility if needed
        destination: itinerary[0].selectedDestination,
        nights: itinerary.reduce((acc, curr) => acc + curr.nights, 0),
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
                    Make Your Own Package
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
                        onInputChange={handleCountryInputChange}
                        isLoading={isNationalityLoading}
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

                  {itinerary.map((item, index) => (
                    <React.Fragment key={item.id}>
                      <Col lg={6} md={6}>
                        <Form.Group>
                          <Form.Label className="fw-semibold text-dark">
                            <FaMapMarkerAlt className="me-2" />
                            Search Destination {itinerary.length > 1 ? `#${index + 1}` : ""} <span className="text-danger">*</span>
                          </Form.Label>
                          <div className="d-flex align-items-center gap-2">
                            <div className="flex-grow-1">
                              <Select
                                options={destinationOptions}
                                value={item.selectedDestination}
                                onChange={(option) => updateDestination(item.id, option)}
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
                            </div>
                            <Button 
                              variant="primary" 
                              className="rounded-circle d-flex align-items-center justify-content-center"
                              style={{ width: "42px", height: "42px", minWidth: "42px" }}
                              onClick={addDestination}
                              title="Add another destination"
                            >
                              <FaPlus />
                            </Button>
                            {itinerary.length > 1 && (
                              <Button 
                                variant="outline-danger" 
                                className="rounded-circle d-flex align-items-center justify-content-center"
                                style={{ width: "42px", height: "42px", minWidth: "42px" }}
                                onClick={() => removeDestination(item.id)}
                                title="Remove destination"
                              >
                                <span className="fw-bold">×</span>
                              </Button>
                            )}
                          </div>
                          {errors[`destination_${item.id}`] && (
                            <div className="text-danger small mt-1">
                              {errors[`destination_${item.id}`]}
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
                          <Form.Control
                            type="number"
                            min="1"
                            max="30"
                            value={item.nights}
                            onChange={(e) => updateNights(item.id, e.target.value)}
                            className="form-control-modern"
                            isInvalid={!!errors[`nights_${item.id}`]}
                          />
                          {errors[`nights_${item.id}`] && (
                            <div className="text-danger small mt-1">
                              {errors[`nights_${item.id}`]}
                            </div>
                          )}
                        </Form.Group>
                      </Col>
                      <Col lg={3} className="d-none d-lg-block"></Col> {/* Spacer for alignment */}
                    </React.Fragment>
                  ))}
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