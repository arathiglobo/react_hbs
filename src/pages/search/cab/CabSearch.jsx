import React, { useState, useRef, useEffect } from "react";
import {
  Card,
  Row,
  Col,
  Form,
  Button,
  Spinner,
  Table,
} from "react-bootstrap";
import { FaCar, FaSearch } from "react-icons/fa";
import { useLocation, useNavigate } from "react-router-dom";
import Select from "react-select";
import axiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import Sidebar from "../../../components/Sidebar";
import TopBar from "../../../components/TopBar";

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

export const CabSearch = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Try to use state from previous page if available
  const searchCriteria = location.state || {};
  
  // Form State
  const [nationality, setNationality] = useState(searchCriteria.nationality || null);
  const [destination, setDestination] = useState(searchCriteria.destination || null);
  
  const [transferPickupDate, setTransferPickupDate] = useState(searchCriteria.travelDate || "");
  const [transferDropoffDate, setTransferDropoffDate] = useState(searchCriteria.travelDate || "");
  const [transferAdults, setTransferAdults] = useState(searchCriteria.adults || 1);
  const [transferChildren, setTransferChildren] = useState(searchCriteria.children || 0);
  const [transferChildAges, setTransferChildAges] = useState(searchCriteria.childAges || []);
  
  // Results State
  const [transferResults, setTransferResults] = useState([]);
  const [transferLoading, setTransferLoading] = useState(false);
  const [hasTransferSearched, setHasTransferSearched] = useState(false);

  // Country & Destination state
  const [nationalityList, setNationalityList] = useState([]);
  const [destinationOptions, setDestinationOptions] = useState([]);
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

  // Fetch initial master data
  useEffect(() => {
    countryList();
  }, []);

  // Update transfer child ages when number of children changes
  useEffect(() => {
    if (transferChildren > 0) {
      setTransferChildAges((prevAges) => {
        const currentAges = [...prevAges];
        while (currentAges.length < transferChildren) {
          currentAges.push(5); // Default age
        }
        if (currentAges.length > transferChildren) {
          currentAges.splice(transferChildren);
        }
        return currentAges;
      });
    } else {
      setTransferChildAges([]);
    }
  }, [transferChildren]);

  const handleTransferChildAgeChange = (index, value) => {
    const updatedAges = [...transferChildAges];
    updatedAges[index] = parseInt(value) || 5;
    setTransferChildAges(updatedAges);
  };

  const handleTransferSearchSubmit = async (e) => {
    e.preventDefault();
    
    if (!nationality) {
      toast.error("Please select a nationality.");
      return;
    }
    
    if (!destination) {
      toast.error("Please select a destination.");
      return;
    }
    
    if (!transferPickupDate) {
      toast.error("Please select a pickup date.");
      return;
    }
    
    setTransferLoading(true);
    setHasTransferSearched(true);
    setTransferResults([]);

    try {
      const agentId = sessionStorage.getItem("makeYourOwnPackageAgentId") 
                   || localStorage.getItem("makeYourOwnPackageAgentId")
                   || "1";

      const transferPayload = {
        checkIn: transferPickupDate,
        checkOut: transferDropoffDate || transferPickupDate,
        nativeCountryId: nationality.value ? Number(nationality.value) : null,
        destinationCountryId: destination.countryId || "",
        destinationCityId: destination.value || "",
        searchCorCtype: "city", 
        agentid: String(agentId),
        childAge: transferChildAges && transferChildAges.length > 0
            ? transferChildAges.map((age) => parseInt(age) || 0)
            : transferChildren > 0
              ? Array(transferChildren).fill(0)
              : [],
        adult: transferAdults || 1,
        child: transferChildren || 0,
      };

      const response = await axiosInstance.post(
        "/api/makeYourOwnPackage/getTransferInhouse",
        transferPayload
      );

      const ensureHttpImage = (imageUrl) => {
        if (!imageUrl) {
          return "https://via.placeholder.com/400x225?text=Transfer";
        }
        if (/^https?:\/\//i.test(imageUrl)) {
          return imageUrl;
        }
        if (typeof imageUrl === "string") {
          const fileName = imageUrl.split(/[/\\]/).pop();
          if (fileName) {
            return `https://b2b.choosenfly.com/assets/details/profilepic/hotel/${fileName}`;
          }
        }
        return "https://via.placeholder.com/400x225?text=Transfer";
      };

      const mappedResults = Array.isArray(response.data)
        ? response.data.map((cab, index) => ({
          cabid: cab.cabid || cab.cabId || `cab-${index}`,
          cabname: cab.cabname || cab.cabName || "Transfer Vehicle",
          cabdetails: cab.cabdetails || "",
          cabpic: ensureHttpImage(cab.cabpic || cab.cabPic),
          noOfCabs: cab.noOfCabs || 1,
          searchCabDetailsDTO: Array.isArray(cab.searchCabDetailsDTO)
            ? cab.searchCabDetailsDTO
            : [],
        }))
        : [];

      setTransferResults(mappedResults);
    } catch (err) {
      console.error("Transfer search failed:", err);
      toast.error("Failed to search for transfers.");
      setTransferResults([]);
    } finally {
      setTransferLoading(false);
    }
  };

  const handleBookNow = (cab, cabDetail) => {
    // Navigate to CabBookingPage and carry over search data and selected cab data
    navigate("/cab-booking-page", {
      state: {
        cab,
        selectedOption: cabDetail,
        searchCriteria: {
          nationality,
          destination,
          pickupDate: transferPickupDate,
          dropoffDate: transferDropoffDate,
          adults: transferAdults,
          children: transferChildren,
          childAges: transferChildAges,
        }
      }
    });
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Card className="shadow-sm rounded-xl mb-4 border-0">
            <Card.Body>
              <h4 className="fw-bold mb-4 text-primary">
                Cab Search
              </h4>

              <Card className="border-0 shadow-sm rounded-4 bg-white mb-4">
                <Card.Body>
                  <Form onSubmit={handleTransferSearchSubmit}>
                    <Row className="g-3 mb-3">
                      <Col md={3}>
                        <Form.Label className="fw-semibold">Nationality</Form.Label>
                        <Select
                          options={nationalityList}
                          value={nationality}
                          onChange={setNationality}
                          placeholder="Search Nationality"
                          isSearchable
                          isClearable
                          className="modern-select-sm"
                          menuPortalTarget={document.body}
                          styles={{
                            menuPortal: base => ({ ...base, zIndex: 9999 }),
                          }}
                        />
                      </Col>
                      <Col md={3}>
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
                            menuPortal: base => ({ ...base, zIndex: 9999 }),
                          }}
                        />
                      </Col>
                    </Row>
                    
                    <Row className="g-3">
                      <Col md={2}>
                        <Form.Label className="fw-semibold">Pickup Date</Form.Label>
                        <Form.Control
                          type="date"
                          value={transferPickupDate}
                          onChange={(e) => setTransferPickupDate(e.target.value)}
                          min={new Date().toISOString().split("T")[0]}
                        />
                      </Col>
                      <Col md={2}>
                        <Form.Label className="fw-semibold">Dropoff Date</Form.Label>
                        <Form.Control
                          type="date"
                          value={transferDropoffDate}
                          onChange={(e) => setTransferDropoffDate(e.target.value)}
                          min={transferPickupDate || undefined}
                        />
                      </Col>
                      <Col md={2}>
                        <Form.Label className="fw-semibold">Adults</Form.Label>
                        <Form.Select
                          value={transferAdults}
                          onChange={(e) => setTransferAdults(parseInt(e.target.value) || 1)}
                        >
                          {Array.from({ length: 9 }, (_, i) => i + 1).map((num) => (
                            <option key={num} value={num}>
                              {num}
                            </option>
                          ))}
                        </Form.Select>
                      </Col>
                      <Col md={2}>
                        <Form.Label className="fw-semibold">Children</Form.Label>
                        <Form.Select
                          value={transferChildren}
                          onChange={(e) => setTransferChildren(parseInt(e.target.value) || 0)}
                        >
                          {Array.from({ length: 6 }, (_, i) => i).map((num) => (
                            <option key={num} value={num}>
                              {num}
                            </option>
                          ))}
                        </Form.Select>
                      </Col>
                      
                      {transferChildren > 0 && (
                        <Col md={4}>
                          <Form.Label className="mb-2 fw-semibold">Child Ages</Form.Label>
                          <Row className="g-2">
                            {transferChildAges.map((age, index) => (
                              <Col key={index} md={3} sm={4} xs={6}>
                                <Form.Control
                                  type="number"
                                  min="0"
                                  max="17"
                                  placeholder={`Age`}
                                  value={age}
                                  onChange={(e) =>
                                    handleTransferChildAgeChange(index, e.target.value)
                                  }
                                />
                              </Col>
                            ))}
                          </Row>
                        </Col>
                      )}
                      
                      <Col md={12} className="d-flex justify-content-end mt-4">
                        <Button
                          variant="warning"
                          className="px-5 py-2 fw-bold"
                          type="submit"
                          disabled={transferLoading}
                        >
                          {transferLoading ? (
                            <>
                              <Spinner animation="border" size="sm" className="me-2" />
                              Searching...
                            </>
                          ) : (
                            <>
                              <FaSearch className="me-2" /> Search Cabs
                            </>
                          )}
                        </Button>
                      </Col>
                    </Row>
                  </Form>
                </Card.Body>
              </Card>

              {/* Loading State */}
              {transferLoading && (
                <Card className="shadow-sm rounded-xl mb-4 mt-4 border-0">
                  <Card.Body className="text-center py-5">
                    <Spinner animation="border" variant="primary" style={{ width: '3rem', height: '3rem' }} />
                    <h5 className="text-primary fw-bold mt-3 mb-1">
                      Searching Transfers...
                    </h5>
                    <p className="text-muted small mb-0">
                      Finding available transfer options for you
                    </p>
                  </Card.Body>
                </Card>
              )}

              {/* Empty State */}
              {!hasTransferSearched && !transferLoading && (
                <div className="text-center text-muted mt-5 py-5 bg-white rounded-4 shadow-sm border-0">
                  <FaCar className="display-4 text-secondary mb-3 opacity-50" />
                  <h5>Ready to book a transfer?</h5>
                  <p>Run a search to view available cabs and options.</p>
                </div>
              )}

              {/* Results Display */}
              {hasTransferSearched && !transferLoading && transferResults.length > 0 && (
                <div className="mt-4">
                  <h5 className="fw-bold mb-3 text-dark">
                    Transfer Results <span className="text-muted fs-6 fw-normal">({transferResults.length} found)</span>
                  </h5>
                  <Row className="g-4">
                    {transferResults.map((cab) => (
                      <Col key={cab.cabid} lg={12} xl={10}>
                        <Card className="shadow-sm border-0" style={{ borderRadius: "12px", overflow: 'hidden' }}>
                          <Card.Body className="p-0">
                            <Row className="g-0">
                              <Col md={3} sm={4} className="bg-light">
                                <div style={{ height: "100%", minHeight: "200px" }}>
                                  <LazyImage src={cab.cabpic} alt={cab.cabname} />
                                </div>
                              </Col>
                              <Col md={9} sm={8} className="p-4 d-flex flex-column">
                                <div className="mb-3">
                                  <h4 className="fw-bold mb-2 text-dark">
                                    {cab.cabname || "Transfer Vehicle"}
                                  </h4>
                                  {cab.cabdetails && (
                                    <p className="text-secondary mb-0" style={{ fontSize: "0.95rem" }}>
                                      {cab.cabdetails}
                                    </p>
                                  )}
                                  <div className="mt-2">
                                    <span className="badge bg-primary-subtle text-primary rounded-pill px-3 py-2">
                                      <FaCar className="me-2" /> Capacity: {cab.noOfCabs || "1"} Vehicle
                                    </span>
                                  </div>
                                </div>
                                
                                <div className="mt-auto pt-3">
                                  {cab.searchCabDetailsDTO && cab.searchCabDetailsDTO.length > 0 ? (
                                    <div className="table-responsive">
                                      <Table className="mb-0 text-nowrap" hover>
                                        <thead className="table-light">
                                          <tr>
                                            <th className="py-3 px-3 text-secondary border-bottom border-top-0 border-end-0 border-start-0">Transfer Option</th>
                                            <th className="py-3 px-3 text-secondary border-bottom border-top-0 border-end-0 border-start-0">Share Type</th>
                                            <th className="py-3 px-3 text-secondary border-bottom border-top-0 border-end-0 border-start-0 text-end">Total Price</th>
                                            <th className="py-3 px-3 border-bottom border-top-0 border-end-0 border-start-0 w-100px text-center">Action</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {cab.searchCabDetailsDTO.map((detail, idx) => {
                                            const rate = detail.types === "SIC" ? detail.sicRate : detail.privateRate;
                                            const totalRate = detail.totalRateWithoutMrk || rate || 0;
                                            
                                            return (
                                              <tr key={idx} className="align-middle border-bottom">
                                                <td className="py-3 px-3 fw-medium">
                                                  {detail.location || "N/A"} <span className="text-muted mx-1">→</span> {detail.dropOff || "N/A"}
                                                </td>
                                                <td className="py-3 px-3">
                                                  <span className={`badge ${detail.types === 'Private' ? 'bg-success' : 'bg-info'} bg-opacity-10 text-${detail.types === 'Private' ? 'success' : 'info'} border border-${detail.types === 'Private' ? 'success' : 'info'} border-opacity-25 px-2 py-1`}>
                                                    {detail.types}
                                                  </span>
                                                </td>
                                                <td className="py-3 px-3 text-end">
                                                  <span className="fs-5 fw-bold text-dark">AED {totalRate.toLocaleString()}</span>
                                                </td>
                                                <td className="py-3 px-3 text-center">
                                                  <Button
                                                    variant="primary"
                                                    size="sm"
                                                    className="px-3 rounded-pill fw-medium shadow-sm transition-all"
                                                    onClick={() => handleBookNow(cab, detail)}
                                                  >
                                                    Book Now
                                                  </Button>
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </Table>
                                    </div>
                                  ) : (
                                    <div className="text-muted fst-italic py-2 border-top">No specific options found for this vehicle.</div>
                                  )}
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

              {/* No Results State */}
              {hasTransferSearched && !transferLoading && transferResults.length === 0 && (
                <div className="text-center text-muted mt-5 py-5 bg-white rounded-4 shadow-sm border-0">
                  <FaCar className="display-4 text-warning mb-3 opacity-75" />
                  <h5 className="text-dark">No transfers found</h5>
                  <p>Try selecting different dates or destinations for your search.</p>
                </div>
              )}
            </Card.Body>
          </Card>
        </main>
      </div>
    </div>
  );
};
