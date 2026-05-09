import React, { useState, useRef, useEffect } from "react";
import {
  Card,
  Row,
  Col,
  Form,
  Button,
  Spinner,
  Table,
  Modal,
  Badge,
} from "react-bootstrap";
import { FaTicketAlt, FaSearch, FaStar, FaUsers, FaEye } from "react-icons/fa";
import { useLocation, useNavigate } from "react-router-dom";
import Select from "react-select";
import axiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import Sidebar from "../../../components/Sidebar";
import TopBar from "../../../components/TopBar";
import AgentBalanceDisplay from "../../../components/AgentBalanceDisplay";

function LazyImage({ src, alt, className }) {
  const containerRef = useRef(null);
  const [inView, setInView] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
          }
        });
      });
      observer.observe(el);
      return () => observer.disconnect();
    } else {
      setInView(true);
    }
  }, []);

  const imageSrc = src || "https://via.placeholder.com/480x270";

  return (
    <div
      ref={containerRef}
      className={`ratio ratio-16x9 rounded-top overflow-hidden ${
        className || ""
      }`}
      style={{ height: "100%", width: "100%", position: "relative" }}
    >
      {!loaded && (
        <div 
           className="skeleton w-100 h-100" 
           style={{ backgroundColor: '#e0e0e0', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} 
        />
      )}
      {inView && (
        <img
          src={imageSrc}
          loading="lazy"
          alt={alt}
          onLoad={() => setLoaded(true)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.3s ease-in-out'
          }}
        />
      )}
    </div>
  );
}

const ActivitySearch = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Try to use state from previous page if available
  const searchCriteria = location.state || {};
  
  // Form State
  const [nationality, setNationality] = useState(searchCriteria.nationality || null);
  const [destination, setDestination] = useState(searchCriteria.destination || null);
  
  const [tourDate, setTourDate] = useState(searchCriteria.travelDate || "");
  const [tourAdults, setTourAdults] = useState(searchCriteria.adults || 1);
  const [tourChildren, setTourChildren] = useState(searchCriteria.children || 0);
  const [tourChildAges, setTourChildAges] = useState(searchCriteria.childAges || []);
  
  // Results State
  const [tourResults, setTourResults] = useState([]);
  const [tourLoading, setTourLoading] = useState(false);
  const [hasTourSearched, setHasTourSearched] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(null);

  // ── Agent selector (mirrors HotelSearch.jsx pattern) ─────────────────
  const [agent, setAgent] = useState("");
  const [agents, setAgents] = useState([]);

  const loadAgents = async () => {
    try {
      const res = await axiosInstance.get("/api/agent");
      setAgents(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load agents:", err);
      setAgents([]);
    }
  };

  useEffect(() => {
    loadAgents();
  }, []);

  // Country & Destination state
  const [nationalityList, setNationalityList] = useState([]);
  const [destinationOptions, setDestinationOptions] = useState([]);
  const [isDestinationLoading, setIsDestinationLoading] = useState(false);
  const [isNationalityLoading, setIsNationalityLoading] = useState(false);

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
  const debouncedCitySearch = useRef(
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
          type: "State"
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
        type: "State"
      }));
      setDestinationOptions(options);
    } catch (error) {
      console.log("Error loading popular destinations:", error);
    } finally {
      setIsDestinationLoading(false);
    }
  };

  // Fetch initial master data
  useEffect(() => {
    countryList();
  }, []);

  // Update tour child ages when number of children changes
  useEffect(() => {
    if (tourChildren > 0) {
      setTourChildAges((prevAges) => {
        const currentAges = [...prevAges];
        while (currentAges.length < tourChildren) {
          currentAges.push(5); // Default age
        }
        if (currentAges.length > tourChildren) {
          currentAges.splice(tourChildren);
        }
        return currentAges;
      });
    } else {
      setTourChildAges([]);
    }
  }, [tourChildren]);

  const handleTourChildAgeChange = (index, value) => {
    const updatedAges = [...tourChildAges];
    updatedAges[index] = parseInt(value) || 5;
    setTourChildAges(updatedAges);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handleTourSearchSubmit = async (e) => {
    e.preventDefault();
    
    if (!nationality) {
      toast.error("Please select a nationality.");
      return;
    }
    
    if (!destination) {
      toast.error("Please select a destination.");
      return;
    }
    
    if (!tourDate) {
      toast.error("Please select a tour date.");
      return;
    }
    
    setTourLoading(true);
    setHasTourSearched(true);
    setTourResults([]);

    try {
      const agentId = (agent && String(agent))
                   || sessionStorage.getItem("makeYourOwnPackageAgentId")
                   || localStorage.getItem("makeYourOwnPackageAgentId")
                   || "1";

      const activityPayload = {
        activityDate: formatDate(tourDate),
        nativeCountryId: nationality.value ? String(nationality.value) : "",
        destinationCountryId: destination.countryId || "",
        destinationCityId: destination.value || "",
        searchCorCtype: destination.type || "State",
        agentId: String(agentId),
        childAge: tourChildAges && tourChildAges.length > 0
            ? tourChildAges.map((age) => String(parseInt(age) || 0))
            : tourChildren > 0
              ? Array(tourChildren).fill("0")
              : [],
        adult: String(tourAdults || 1),
        child: String(tourChildren || 0),
      };

      const response = await axiosInstance.post(
        "/api/makeYourOwnPackage/getActivityInhouse",
        activityPayload
      );

      const mappedResults = Array.isArray(response.data)
        ? response.data.map((activity, index) => ({
          id: activity.activityId || `activity-${index}`,
          activityName: activity.activityname || "",
          activityDetails: activity.activityDetails || "",
          starRating: activity.starRating || 0,
          totalRate: activity.totalRate || activity.activityRate || 0,
          totalRateWithoutMrk: activity.totalRateWithoutmrk || activity.activityRate || 0,
          activityImage: activity.activityImage || "https://via.placeholder.com/400x225?text=Activity",
          childMax: activity.childMax || 0,
          childMin: activity.childMin || 0,
          adultRate: activity.adultRate || 0,
          childRate: activity.childRate || 0,
          activityType: activity.activityType || 1,
          maxPax: activity.maxPax || 0,
          minPaxsic: activity.minPaxsic || 0,
          currency: activity.currencyCode || "AED",
          duration: activity.viatorActivityDurationFrom && activity.viatorActivityDurationTo
              ? `${activity.viatorActivityDurationFrom} - ${activity.viatorActivityDurationTo}`
              : null,
          apiType: activity.apiType || null,
          viatorProductCode: activity.viatorProductCode || null,
        }))
        : [];

      setTourResults(mappedResults);
    } catch (err) {
      console.error("Activity search failed:", err);
      toast.error("Failed to search for activities.");
      setTourResults([]);
    } finally {
      setTourLoading(false);
    }
  };

  const handleBookNow = (activity) => {
    // Navigate to ActivityBookingPage and carry over search data and selected activity data
    navigate("/new-booking/tours-and-activities/booking", {
      state: {
        activity,
        searchCriteria: {
          nationality,
          destination,
          tourDate,
          adults: tourAdults,
          children: tourChildren,
          childAges: tourChildAges,
        }
      }
    });
  };

  const renderStars = (rating) => {
    return Array.from({ length: Math.floor(rating || 0) }, (_, i) => (
      <FaStar key={i} className="text-warning" size={14} />
    ));
  };

    const customSelectStyles = {
  control: (base) => ({
    ...base,
    minHeight: "46px",
    height: "46px",
    borderRadius: "0.375rem", // matches bootstrap
  }),
  valueContainer: (base) => ({
    ...base,
    height: "46px",
    padding: "0 8px",
  }),
  indicatorsContainer: (base) => ({
    ...base,
    height: "46px",
  }),
};

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Card className="shadow-sm rounded-xl mb-4 border-0">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-start mb-4">
                <h4 className="fw-bold text-primary mb-0">
                  Tours & Activities Search
                </h4>
                <div style={{ minWidth: 260 }}>
                  <Form.Label className="fw-semibold text-dark mb-1 small">
                    Agent
                  </Form.Label>
                  <Form.Select
                    style={{ height: "42px" }}
                    className="form-control-modern"
                    value={agent}
                    onChange={(e) => setAgent(e.target.value)}
                  >
                    <option value="">Select Agent</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.companyName}
                      </option>
                    ))}
                  </Form.Select>
                  <AgentBalanceDisplay agentId={agent} />
                </div>
              </div>

              <Card className="border-0 shadow-sm rounded-4 bg-white mb-4">
               <Card.Body>
  <Form onSubmit={handleTourSearchSubmit}>

    {/* 🔷 Row 1 */}
    <Row className="g-3 mb-3">
      <Col md={6}>
        <Form.Label className="fw-semibold">Nationality</Form.Label>
        <Select
          options={nationalityList}
          value={nationality}
          onChange={setNationality}
          onInputChange={handleCountryInputChange}
          isLoading={isNationalityLoading}
          placeholder="Search Nationality"
          isSearchable
          isClearable
          className="modern-select-sm"
          menuPortalTarget={document.body}
          styles={{
            ...customSelectStyles,
            menuPortal: base => ({ ...base, zIndex: 9999 }),
          }}
        />
      </Col>

      <Col md={6}>
        <Form.Label className="fw-semibold">Destination</Form.Label>
        <Select
          options={destinationOptions}
          value={destination}
          onChange={setDestination}
          placeholder="Search destinations..."
          isSearchable
          isClearable
          className="modern-select-sm"
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
            ...customSelectStyles,
            menuPortal: base => ({ ...base, zIndex: 9999 }),
          }}
        />
      </Col>

     
    </Row>

    {/* 🔷 Row 2 */}
    <Row className="g-3 align-items-end">
       <Col md={4}>
        <Form.Label className="fw-semibold">Tour Date</Form.Label>
        <Form.Control
        style={{height:"46px"}}
          type="date"
          value={tourDate}
          onChange={(e) => setTourDate(e.target.value)}
          min={new Date().toISOString().split("T")[0]}
        />
      </Col>
      <Col md={4}>
        <Form.Label className="fw-semibold">Adults</Form.Label>
        <Form.Select
        style={{height:"46px"}}
          value={tourAdults}
          onChange={(e) => setTourAdults(parseInt(e.target.value) || 1)}
        >
          {Array.from({ length: 9 }, (_, i) => i + 1).map((num) => (
            <option key={num} value={num}>
              {num}
            </option>
          ))}
        </Form.Select>
      </Col>

      <Col md={4}>
        <Form.Label className="fw-semibold">Children</Form.Label>
        <Form.Select
        style={{height:"46px"}}
          value={tourChildren}
          onChange={(e) => setTourChildren(parseInt(e.target.value) || 0)}
        >
          {Array.from({ length: 6 }, (_, i) => i).map((num) => (
            <option key={num} value={num}>
              {num}
            </option>
          ))}
        </Form.Select>
      </Col>

      {/* Button aligned nicely */}
   
    </Row>
   <Row className="mt-4">
  <Col md={12} className="d-flex justify-content-center">
    <Button
      variant="warning"
      className="px-4 fw-bold"
      type="submit"
      disabled={tourLoading}
      style={{ height: "38px" }}
    >
      {tourLoading ? (
        <>
          <Spinner animation="border" size="sm" className="me-2" />
          Searching...
        </>
      ) : (
        <>
          <FaSearch className="me-2" /> Search Activities
        </>
      )}
    </Button>
  </Col>
</Row>

    {/* 🔷 Child Ages */}
    {tourChildren > 0 && (
      <Row className="mt-3">
        <Col md={12}>
          <Form.Label className="fw-semibold">Child Ages</Form.Label>

          <div className="d-flex flex-wrap gap-2">
            {tourChildAges.map((age, index) => (
              <Form.Control
                key={index}
                type="number"
                min="0"
                max="17"
                placeholder="Age"
                value={age}
                style={{ width: "80px" }}
                onChange={(e) =>
                  handleTourChildAgeChange(index, e.target.value)
                }
              />
            ))}
          </div>
        </Col>
      </Row>
    )}

  </Form>
</Card.Body>
              </Card>

              {/* Loading State */}
              {tourLoading && (
                <Card className="shadow-sm rounded-xl mb-4 mt-4 border-0">
                  <Card.Body className="text-center py-5">
                    <Spinner animation="border" variant="primary" style={{ width: '3rem', height: '3rem' }} />
                    <h5 className="text-primary fw-bold mt-3 mb-1">
                      Searching Activities...
                    </h5>
                    <p className="text-muted small mb-0">
                      Finding available activities for you
                    </p>
                  </Card.Body>
                </Card>
              )}

              {/* Empty State */}
              {!hasTourSearched && !tourLoading && (
                <div className="text-center text-muted mt-5 py-5 bg-white rounded-4 shadow-sm border-0">
                  <FaTicketAlt className="display-4 text-secondary mb-3 opacity-50" />
                  <h5>Ready to book an activity?</h5>
                  <p>Run a search to view available activities and options.</p>
                </div>
              )}

              {/* Results Display */}
              {hasTourSearched && !tourLoading && tourResults.length > 0 && (
                <div className="mt-4">
                  <h5 className="fw-bold mb-3 text-dark">
                    Activity Results <span className="text-muted fs-6 fw-normal">({tourResults.length} found)</span>
                  </h5>
                  <Row className="g-4">
                    {tourResults.map((activity) => (
                      <Col key={activity.id} xs={12} md={11} lg={10} xl={10} className="mx-auto">
                        <Card className="shadow-sm border-0" style={{ borderRadius: "12px", overflow: 'hidden' }}>
                          <Card.Body className="p-0">
                            <Row className="g-0">
                              <Col md={3} sm={4} className="bg-light">
                                <div style={{ height: "100%", minHeight: "110px" }}>
                                  <LazyImage src={activity.activityImage} alt={activity.activityName} />
                                </div>
                              </Col>
                              <Col md={9} sm={8} className="p-3 d-flex flex-column">
                                <div className="mb-3">
                                  <div className="d-flex justify-content-between align-items-start">
                                    <h4 className="fw-bold mb-1 text-dark">
                                      {activity.activityName || "Activity"}
                                    </h4>
                                    <div className="text-end">
                                        <div className="fs-5 fw-bold text-dark mb-1">
                                          {activity.currency} {activity.totalRate?.toLocaleString() || "0"}
                                        </div>
                                    </div>
                                  </div>
                                  {activity.starRating > 0 && (
                                    <div className="mb-2">
                                      {renderStars(activity.starRating)}
                                    </div>
                                  )}
                                  {activity.activityDetails && (
                                    <p className="text-secondary mb-0 mt-2" style={{ fontSize: "0.9rem" }} dangerouslySetInnerHTML={{ __html: activity.activityDetails.substring(0, 150) + (activity.activityDetails.length > 150 ? "..." : "") }}>
                                    </p>
                                  )}
                                  
                                </div>
                                
                                <div className="mt-auto pt-2 d-flex justify-content-between align-items-center border-top">
                                  <div className="text-secondary">
                                      {activity.duration && <span className="me-3"><i className="bi bi-clock"></i> Duration: {activity.duration} hrs</span>}
                                      <span><FaUsers className="me-1"/> Max: {activity.maxPax || "N/A"}</span>
                                  </div>
                                  <div className="d-flex gap-2">
                                    <Button
                                      variant="info"
                                      className="rounded-pill d-flex align-items-center justify-content-center text-white"
                                      style={{ width: "40px", height: "40px", padding: 0 }}
                                      onClick={() => {
                                        setSelectedActivity(activity);
                                        setShowActivityModal(true);
                                      }}
                                      title="View Details"
                                    >
                                      <FaEye size={16} />
                                    </Button>
                                    <Button
                                      variant="primary"
                                      className="px-4 rounded-pill fw-medium shadow-sm transition-all"
                                      onClick={() => handleBookNow(activity)}
                                    >
                                      Book Now
                                    </Button>
                                  </div>
                                </div>
                              </Col>
                            </Row>
                          </Card.Body>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                </div>
              )}

              {hasTourSearched && !tourLoading && tourResults.length === 0 && (
                <div className="text-center text-muted mt-5 py-5 bg-white rounded-4 shadow-sm border-0">
                  <FaTicketAlt className="display-4 text-warning mb-3 opacity-75" />
                  <h5 className="text-dark">No activities found</h5>
                  <p>Try selecting different dates or destinations for your search.</p>
                </div>
              )}
            </Card.Body>
          </Card>

          {/* Activity Details Modal */}
          <Modal
            show={showActivityModal}
            onHide={() => {
              setShowActivityModal(false);
              setSelectedActivity(null);
            }}
            size="lg"
            centered
          >
            <Modal.Header closeButton>
              <Modal.Title>Activity Details</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              {selectedActivity && (
                <>
                  <div className="mb-4">
                    <img
                      src={selectedActivity.activityImage}
                      alt={selectedActivity.activityName}
                      style={{
                        width: "100%",
                        height: "300px",
                        objectFit: "cover",
                        borderRadius: "8px",
                      }}
                      onError={(e) => {
                        e.target.src =
                          "https://via.placeholder.com/800x300?text=Activity+Image";
                      }}
                    />
                  </div>

                  <div className="mb-3">
                    <h4 className="fw-bold">
                      {selectedActivity.activityName || "Activity Name"}
                    </h4>
                    {selectedActivity.starRating > 0 && (
                      <div className="d-flex align-items-center mb-2">
                        <FaStar className="text-warning me-1" />
                        <span>{selectedActivity.starRating} Star Rating</span>
                      </div>
                    )}
                  </div>

                  {selectedActivity.activityDetails && (
                    <div className="mb-3">
                      <h6 className="fw-semibold mb-2">Description</h6>
                      <p
                        className="text-muted"
                        style={{ whiteSpace: "pre-wrap" }}
                        dangerouslySetInnerHTML={{ __html: selectedActivity.activityDetails }}
                      >
                      </p>
                    </div>
                  )}

                  <Row className="g-3 mb-3">
                    {selectedActivity.minPaxsic > 0 && (
                      <Col md={6}>
                        <div>
                          <strong>Min Pax:</strong> {selectedActivity.minPaxsic}
                        </div>
                      </Col>
                    )}
                    {selectedActivity.maxPax > 0 && (
                      <Col md={6}>
                        <div>
                          <strong>Max Pax:</strong> {selectedActivity.maxPax}
                        </div>
                      </Col>
                    )}
                    {selectedActivity.childMin > 0 && (
                      <Col md={6}>
                        <div>
                          <strong>Child Age Range:</strong>{" "}
                          {selectedActivity.childMin} -{" "}
                          {selectedActivity.childMax} years
                        </div>
                      </Col>
                    )}
                    {selectedActivity.duration && (
                      <Col md={6}>
                        <div>
                          <FaTicketAlt className="me-2" />
                          <strong>Duration:</strong> {selectedActivity.duration}
                        </div>
                      </Col>
                    )}
                    {selectedActivity.adultRate > 0 && (
                      <Col md={6}>
                        <div>
                          <strong>Adult Rate:</strong>{" "}
                          {selectedActivity.currency}{" "}
                          {selectedActivity.adultRate.toLocaleString()}
                        </div>
                      </Col>
                    )}
                    {selectedActivity.childRate > 0 && (
                      <Col md={6}>
                        <div>
                          <strong>Child Rate:</strong>{" "}
                          {selectedActivity.currency}{" "}
                          {selectedActivity.childRate.toLocaleString()}
                        </div>
                      </Col>
                    )}
                    {selectedActivity.apiType && (
                      <Col md={6}>
                        <div>
                          <strong>API Type:</strong> {selectedActivity.apiType}
                        </div>
                      </Col>
                    )}
                  </Row>

                  <div className="mt-4 p-3 bg-light rounded">
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <h5 className="mb-0">
                          {selectedActivity.totalRate > 0
                            ? `${selectedActivity.currency} ${selectedActivity.totalRate.toLocaleString()}`
                            : "Price on request"}
                        </h5>
                        {selectedActivity.totalRateWithoutMrk > 0 &&
                          selectedActivity.totalRateWithoutMrk !==
                          selectedActivity.totalRate && (
                            <small className="text-muted">
                              Without markup: {selectedActivity.currency}{" "}
                              {selectedActivity.totalRateWithoutMrk.toLocaleString()}
                            </small>
                          )}
                      </div>
                      <Badge
                        bg={
                          selectedActivity.totalRate > 0
                            ? "success"
                            : "secondary"
                        }
                      >
                        {selectedActivity.totalRate > 0
                          ? "Rate Available"
                          : "Rate on Request"}
                      </Badge>
                    </div>
                  </div>
                </>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowActivityModal(false);
                  setSelectedActivity(null);
                }}
              >
                Close
              </Button>
            </Modal.Footer>
          </Modal>
        </main>
      </div>
    </div>
  );
};

export default ActivitySearch;