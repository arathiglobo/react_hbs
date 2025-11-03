import React, { useEffect, useRef, useState } from "react";
import { Card, Row, Col, Form, Button, Tabs, Tab } from "react-bootstrap";
import {
  FaSearch,
  FaHotel,
  FaCar,
  FaTicketAlt,
  FaMapMarkerAlt,
  FaStar,
} from "react-icons/fa";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import { useLocation } from "react-router-dom";
import axiosInstance from "../../components/AxiosInstance";

export default function MakePkgCombineSearch() {
  const location = useLocation();
  const searchCriteria = location.state;
  const {
    travelDate,
    agent,
    nationality,
    destination,
    adults,
    children,
    nights,
  } = searchCriteria || {};

  const [checkIn, setCheckIn] = useState(travelDate || "");
  const [checkOut, setCheckOut] = useState("");
  const [nightsCount, setNightsCount] = useState(nights || 1);
  const [adultCount, setAdultCount] = useState(adults || 1);
  const [childCount, setChildCount] = useState(children || 0);
  const [destinationLabel] = useState(destination?.label || "");
  const [agentId, setAgentId] = useState(agent || "");
  const [activeTab, setActiveTab] = useState("accommodation");
  const [roomsOpen, setRoomsOpen] = useState(false);
  const [rooms, setRooms] = useState([{ adults: 1, children: 0, childAges: [] }]);
  const [childAges, setChildAges] = useState([]);
  const [allResults, setAllResults] = useState([]);
  const [hasSearchResult, setHasSearchResult] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize] = useState(10);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [pollStatus, setPollStatus] = useState("IDLE");
  const [searchId, setSearchId] = useState(null);
  const resultsRef = useRef(null);
   const [hasSearched, setHasSearched] = useState(false);
   const [sortBy, setSortBy] = useState("priceAsc");
    const [starRating, setStarRating] = useState([]);
    const [hotelType, setHotelType] = useState([]);
      const [channelType, setChannelType] = useState([]);
      const [isInitialResultsLoaded, setIsInitialResultsLoaded] = useState(false);
      const [hotelSearchTerm, setHotelSearchTerm] = useState("");
      const [errors, setErrors] = useState({});
      const [clickedHotelIds, setClickedHotelIds] = useState([]);

  useEffect(() => {
    if (checkIn && nightsCount) {
      const inDate = new Date(checkIn);
      const outDate = new Date(inDate);
      outDate.setDate(inDate.getDate() + parseInt(nightsCount));
      setCheckOut(outDate.toISOString().split("T")[0]);
    }
  }, [checkIn, nightsCount]);

  const handleChildAgeChange = (index, value) => {
    const updatedAges = [...childAges];
    updatedAges[index] = value;
    setChildAges(updatedAges);
  };

  const fetchHotels = async (page, searchId, agentId) => {
    try {
      const params = { agentId: agentId || agent || 1, page, pageSize };
      const res = await axiosInstance.get(`/hotel-search/results/${searchId}`, { params });

      const mappedResults = Array.isArray(res.data.result)
        ? res.data.result.map((hotel, index) => ({
            id: hotel.hotelCode
              ? `${searchId}-${hotel.hotelCode}`
              : `${searchId}-h${index + 1}`,
            searchId,
            name: hotel.hotelName || "Unknown Hotel",
            address: hotel.hotelAddress || "",
            city: hotel.hotelAddress
              ? hotel.hotelAddress.split(", ").pop() || "Unknown City"
              : "Unknown City",
            price: hotel.baseRate || null,
            badge: hotel.baseRate ? "Rate Available" : "Rate Unavailable",
            image:
              hotel.hotelImage ||
              "https://b2b.choosenfly.com/assets/details/profilepic/hotel/hoteldefault.jpg",
            rating: hotel.starRating || 0,
            channelType: hotel.apiType?.toUpperCase() || "IWTX",
          }))
        : [];

      setAllResults(mappedResults);
      setTotalElements(Number(res.data.totalResults) || mappedResults.length);
      setTotalPages(
        Math.max(
          1,
          Math.ceil(
            (Number(res.data.totalResults) || mappedResults.length) / pageSize
          )
        )
      );
      setHasSearchResult(true);
      return res.data;
    } catch (err) {
      console.error("Fetch hotels failed:", err);
      setPollStatus("ERROR");
    }
  };

  const pollUntilComplete = async (url, params, checkComplete, onUpdate) => {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const interval = setInterval(async () => {
        try {
          const res = await axiosInstance.get(url, { params });
          if (onUpdate) onUpdate(res.data);
          if (checkComplete(res.data)) {
            clearInterval(interval);
            resolve(res.data);
          }
          if (Date.now() - startTime > 25000) {
            clearInterval(interval);
            reject("Timeout");
          }
        } catch (err) {
          clearInterval(interval);
          reject(err);
        }
      }, 4000);
    });
  };

  // Show results during polling if we have partial data
  const showResultsDuringPolling =
    hasSearchResult &&
    isInitialResultsLoaded &&
    (pollStatus === "IN_PROGRESS" || pollStatus === "COMPLETED");

   useEffect(() => {
      if (!searchId || !hasSearched) return;
  
      setIsLoading(true);
      fetchHotels(pageIndex, searchId, agent).finally(() => setIsLoading(false));
    }, [
      pageIndex,
      sortBy,
      starRating,
      channelType,
      searchId,
      agent,
      hasSearched,
    ]);

     useEffect(() => {
        const style = document.createElement("style");
        style.textContent = `
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fadeIn {
            animation: fadeIn 0.5s ease-in;
          }
        `;
        document.head.appendChild(style);
        return () => document.head.removeChild(style);
      }, []);
    


  const handleHotelSearchSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setHasSearchResult(false);
    setAllResults([]);
    setPageIndex(0);
    setTotalElements(0);
    setTotalPages(1);

    try {
      const agentIdFinal = agentId || agent || 1;
      const roomConfigurations = rooms.map((room, index) => ({
        roomNo: (index + 1).toString(),
        adultCount: (room.adults || 1).toString(),
        childCount: (room.children || 0).toString(),
        childAges: room.childAges?.length ? room.childAges : [],
      }));

      const payload = {
        nationalityId: nationality?.value || "",
        nationalityCode: nationality?.code || "",
        destinationCityId: destination?.value || "",
        destinationCountryId: destination?.countryId || "",
        checkIn,
        checkOut,
        noOfRooms: rooms.length.toString(),
        roomConfigurations,
        agentId: agentIdFinal,
      };

      const res = await axiosInstance.post("/hotel-search/search", payload);
      const searchIdRes = res.data.searchId;
      if (!searchIdRes) throw new Error("No searchId returned");

      setSearchId(searchIdRes);

      const params = { agentId: agentIdFinal, page: 0, pageSize };
      await pollUntilComplete(
        `/hotel-search/results/${searchIdRes}`,
        params,
        (data) => data.finalStatus === "COMPLETED",
        (data) => {
          if (Array.isArray(data.result)) {
            const mappedResults = data.result.map((hotel, index) => ({
              id: hotel.hotelCode
                ? `${searchIdRes}-${hotel.hotelCode}`
                : `${searchIdRes}-h${index + 1}`,
              searchId: searchIdRes,
              name: hotel.hotelName || "Unknown Hotel",
              address: hotel.hotelAddress || "",
              city: hotel.hotelAddress
                ? hotel.hotelAddress.split(", ").pop() || "Unknown City"
                : "Unknown City",
              price: hotel.baseRate || null,
              badge: hotel.baseRate ? "Rate Available" : "Rate Unavailable",
              image:
                hotel.hotelImage ||
                "https://b2b.choosenfly.com/assets/details/profilepic/hotel/hoteldefault.jpg",
              rating: hotel.starRating || 0,
              channelType: hotel.apiType?.toUpperCase() || "IWTX",
            }));
            setAllResults(mappedResults);
            setTotalElements(data.totalResults || mappedResults.length);
            setTotalPages(Math.ceil((data.totalResults || 1) / pageSize));
            setHasSearchResult(true);
          }
        }
      );
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePageChange = async (page) => {
    if (page < 0 || page >= totalPages) return;
    setPageIndex(page);
    setIsLoading(true);
    try {
      await fetchHotels(page, searchId, agentId);
    } finally {
      setIsLoading(false);
    }
  };

  const getPageNumbers = () => {
    const maxPagesToShow = 5;
    const start = Math.max(0, pageIndex - Math.floor(maxPagesToShow / 2));
    const end = Math.min(totalPages, start + maxPagesToShow);
    return Array.from({ length: end - start }, (_, i) => start + i);
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Card className="shadow-sm rounded-xl mb-4">
            <Card.Body>
              
              <h4 className="fw-bold mb-4">
                Create My Trip <span className="text-muted">- {destinationLabel}</span>
              </h4>

              <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k)} className="mb-3 nav-tabs-custom">
                {/* --------------- Accommodation Tab ---------------- */}
                <Tab eventKey="accommodation" title={<><FaHotel className="me-2" /> Accommodation</>}>
                  <Card className="border-0 shadow-sm">
                    <Card.Body>
                      <h5 className="fw-bold text-primary mb-3">Hotel Search</h5>
                      <Form>
                        <Row className="g-3">
                          <Col md={3}>
                            <Form.Group>
                              <Form.Label>Check In</Form.Label>
                              <Form.Control type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
                            </Form.Group>
                          </Col>
                          <Col md={3}>
                            <Form.Group>
                              <Form.Label>Check Out</Form.Label>
                              <Form.Control type="date" value={checkOut} readOnly />
                            </Form.Group>
                          </Col>
                          <Col md={2}>
                            <Form.Group>
                              <Form.Label>Nights</Form.Label>
                              <Form.Control type="number" min="1" value={nightsCount} onChange={(e) => setNightsCount(e.target.value)} />
                            </Form.Group>
                          </Col>
                          <Col lg={4} md={6}>
                            <Form.Label className="fw-semibold text-dark">👥 Rooms & Guests</Form.Label>
                            <Button variant="outline-primary" className="w-100 text-start" type="button" onClick={() => setRoomsOpen(!roomsOpen)}>
                              {adultCount} adults{childCount ? `, ${childCount} child` : ""} · {rooms.length} room
                              <span className="float-end">{roomsOpen ? "▴" : "▾"}</span>
                            </Button>
                          </Col>
                        </Row>

                        <div className="text-center mt-4">
                          <Button variant="warning" className="px-4 py-2" onClick={handleHotelSearchSubmit}>
                            <FaSearch className="me-2" />
                            Search
                          </Button>
                        </div>
                      </Form>

                     {hasSearched && !showResultsDuringPolling && (
            <Card className="shadow-sm rounded-xl mb-4">
              <Card.Body className="text-center py-5">
                <div className="results-loader">
                  <div className="loader-ring">
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <h4 className="text-primary fw-bold mt-3 mb-1">
                    Fetching Best Results...
                  </h4>
                  <p className="text-muted small mb-0">
                    Comparing rates across multiple providers
                  </p>
                </div>
              </Card.Body>
            </Card>
          )}

          {!hasSearched && !hasSearchResult && (
            <Card className="shadow-sm rounded-xl">
              <Card.Body className="text-center text-muted py-5">
                <FaSearch className="display-4 text-muted mb-3" />
                <h4>Ready to Find Your Perfect Stay?</h4>
                <p>
                  Use the search form above to discover amazing hotels and
                  exclusive deals.
                </p>
              </Card.Body>
            </Card>
          )}

          {hasSearched && (
            <div ref={resultsRef}>
              {/* Progress bar for channels */}
              {/* {pollStatus === "IN_PROGRESS" && (
                <Card className="shadow-sm rounded-xl mb-3">
                  <Card.Body className="p-3">
                    <div className="d-flex align-items-center">
                      <ProgressBar
                        now={(completedChannels.size / 4) * 100} // Assuming 4 channels
                        className="flex-grow-1 me-3"
                        variant="primary"
                      />
                      <small className="text-muted">
                        {progressMessage}
                      </small>
                    </div>
                  </Card.Body>
                </Card>
              )} */}

              <Card className="shadow-sm rounded-xl mb-3 filtersection">
                <Card.Body className="p-3">
                  <div className="d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between mb-3">
                    <h6 className="mb-2 mb-md-0 fw-bold text-primary">
                      <FaSearch className="me-2" />
                      {/* Filters & Sort ({completedChannels.size} channels complete) */}
                      Filters & Sort
                    </h6>
                    <div className="d-flex flex-wrap gap-2">
                      <ButtonGroup size="sm">
                        <ToggleButton
                          id="view-card"
                          type="radio"
                          variant={
                            view === "card" ? "primary" : "outline-secondary"
                          }
                          checked={view === "card"}
                          value="card"
                          onChange={() => setView("card")}
                        >
                          <FaBuilding className="me-1" />
                          Cards
                        </ToggleButton>
                        <ToggleButton
                          id="view-map"
                          type="radio"
                          variant={
                            view === "map" ? "primary" : "outline-secondary"
                          }
                          checked={view === "map"}
                          value="map"
                          onChange={() => setView("map")}
                          disabled
                        >
                          🗺️ Map
                        </ToggleButton>
                      </ButtonGroup>
                    </div>
                  </div>

                  <Row className="g-3">
                    <Col lg={3} md={4} sm={6}>
                      <Form.Group>
                        <Form.Label className="mb-1 small fw-semibold text-dark">
                          <FaSearch className="me-1 text-info" />
                          Hotel Name
                        </Form.Label>
                        <Form.Control
                          type="text"
                          placeholder="Search hotels..."
                          className="form-control-modern-sm"
                          value={hotelSearchTerm}
                          onChange={(e) => setHotelSearchTerm(e.target.value)}
                        />
                      </Form.Group>
                    </Col>

                    <Col lg={3} md={4} sm={6}>
                      <Form.Group>
                        <Form.Label className="mb-1 small fw-semibold text-dark">
                          <FaStar className="me-1 text-warning" />
                          Star Rating
                        </Form.Label>
                        <Select
                          isMulti
                          options={starOptions}
                          value={starRating}
                          onChange={setStarRating}
                          placeholder="All Stars"
                          className="modern-select-sm"
                          menuPosition="absolute"
                          menuPlacement="auto"
                           menuPortalTarget={document.body}   // 👈 force portal
                           styles={{
                            menuPortal: base => ({ ...base, zIndex: 9999 }), // 👈 keep menu on top
                            control: (base) => ({
                              ...base,
                              minHeight: "36px",
                              border: "1px solid #dee2e6",
                              borderRadius: "6px",
                              fontSize: "0.875rem",
                              "&:hover": {
                                borderColor: "#86b7fe",
                              },
                            }),
                            menu: (base) => ({
                              ...base,
                              zIndex: 99999,
                              position: "absolute",
                              marginTop: "2px",
                              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                              border: "1px solid #dee2e6",
                              borderRadius: "6px",
                            }),
                          }}
                        />
                      </Form.Group>
                    </Col>

                    <Col lg={3} md={4} sm={6}>
                      <Form.Group>
                        <Form.Label className="mb-1 small fw-semibold text-dark">
                          <FaBuilding className="me-1 text-info" />
                          Hotel Type
                        </Form.Label>
                        <Select
                          isMulti
                          options={hotelTypeOptions}
                          value={hotelType}
                          onChange={setHotelType}
                          placeholder="All Types"
                          className="modern-select-sm"
                          menuPosition="absolute"
                          menuPlacement="auto"
                           menuPortalTarget={document.body}  
                          styles={{
                             menuPortal: base => ({ ...base, zIndex: 9999 }), // 👈 keep menu on top
                            control: (base) => ({
                              ...base,
                              minHeight: "36px",
                              border: "1px solid #dee2e6",
                              borderRadius: "6px",
                              fontSize: "0.875rem",
                              "&:hover": {
                                borderColor: "#86b7fe",
                              },
                            }),
                            menu: (base) => ({
                              ...base,
                              zIndex: 99999,
                              position: "absolute",
                              marginTop: "2px",
                              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                              border: "1px solid #dee2e6",
                              borderRadius: "6px",
                            }),
                          }}
                        />
                      </Form.Group>
                    </Col>

                    <Col lg={3} md={4} sm={6}>
                      <Form.Group>
                        <Form.Label className="mb-1 small fw-semibold text-dark">
                          <FaGlobe className="me-1 text-success" />
                          Channel
                        </Form.Label>
                        <Select
                          isMulti
                          options={channelTypeOptions}
                          value={channelType}
                          onChange={setChannelType}
                          placeholder="All Channels"
                          className="modern-select-sm"
                          menuPosition="absolute"
                          menuPlacement="auto"
                           menuPortalTarget={document.body}  
                          styles={{
                             menuPortal: base => ({ ...base, zIndex: 9999 }), // 👈 keep menu on top
                            control: (base) => ({
                              ...base,
                              minHeight: "36px",
                              border: "1px solid #dee2e6",
                              borderRadius: "6px",
                              fontSize: "0.875rem",
                              "&:hover": {
                                borderColor: "#86b7fe",
                              },
                            }),
                            menu: (base) => ({
                              ...base,
                              zIndex: 99999,
                              position: "absolute",
                              marginTop: "2px",
                              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                              border: "1px solid #dee2e6",
                              borderRadius: "6px",
                              maxHeight: "300px", // Increased from 200px
                              overflowY: "auto", // Enable scrolling if needed
                            }),
                            option: (base, state) => ({
                              ...base,
                              backgroundColor: state.isFocused
                                ? "#f8f9fa"
                                : "white",
                              color: state.isSelected ? "white" : "#212529",
                              "&:active": {
                                backgroundColor: "#0d6efd",
                              },
                            }),
                          }}
                        />
                      </Form.Group>
                    </Col>

                    <Col lg={2} md={4} sm={6}>
                      <Form.Group>
                        <Form.Label className="mb-1 small fw-semibold text-dark">
                          <FaSort className="me-1 text-secondary" />
                          Sort By
                        </Form.Label>
                        <Form.Select
                          size="sm"
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value)}
                          className="form-control-modern-sm"
                        >
                          <option value="priceAsc">Price: Low to High</option>
                          <option value="priceDesc">Price: High to Low</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>

                    <Col
                      lg={2}
                      md={4}
                      sm={6}
                      className="d-flex align-items-end"
                    >
                      <Button
                        variant="outline-primary"
                        size="sm"
                        className="w-100"
                        onClick={() => {
                          setStarRating([]);
                          setHotelType([]);
                          setChannelType([]);
                          setSortBy("priceAsc");
                          setHotelSearchTerm("");
                        }}
                      >
                        Clear
                      </Button>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>

                  {/* New Pagination Section After Filters */}
              {hasSearched && (
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4">
                  <small className="text-muted fw-semibold">
                    {filteredResults.length > 0 ? (
                      <>
                        Showing{" "}
                        {pageIndex * pageSize + 1}-
                        {(hotelSearchTerm || hotelType.length > 0
                          ? Math.min(
                              pageIndex * pageSize + pageSize,
                              filteredResults.length
                            )
                          : Math.min(
                              pageIndex * pageSize + pageSize,
                              totalElements
                            ))}{" "}
                        of{" "}
                        {(hotelSearchTerm || hotelType.length > 0
                          ? filteredResults.length
                          : totalElements)}{" "}
                        results{" "}
                        {pollStatus === "IN_PROGRESS" ? "(updating...)" : ""}
                      </>
                    ) : (
                      <>
                        No results found{" "}
                        {pollStatus === "IN_PROGRESS" ? "(updating...)" : ""}
                      </>
                    )}
                  </small>
                  {filteredResults.length > 0 && !(hotelSearchTerm || hotelType.length > 0) && (
                    <Pagination className="mb-0 pagination-modern">
                      <Pagination.Prev
                        disabled={pageIndex === 0}
                        onClick={() => goToPage(pageIndex - 1)}
                      />
                      {pageNumbers.map((n) =>
                        typeof n === "number" ? (
                          <Pagination.Item
                            key={n}
                            active={n === pageIndex + 1}
                            onClick={() => goToPage(n - 1)}
                          >
                            {n}
                          </Pagination.Item>
                        ) : (
                          <Pagination.Ellipsis key={n} disabled />
                        )
                      )}
                      <Pagination.Next
                        disabled={pageIndex >= effectiveTotalPages - 1}
                        onClick={() => goToPage(pageIndex + 1)}
                      />
                    </Pagination>
                  )}
                </div>
              )}

              {isLoading && (
                <Card className="shadow-sm rounded-xl mb-4">
                  <Card.Body className="text-center py-5">
                    <div className="loading-animation mb-3">
                      <Spinner animation="border" variant="primary" size="lg" />
                    </div>
                    <h4 className="text-primary fw-bold">
                      Searching the Best Results...
                    </h4>
                    <p className="text-muted">
                      Please wait while we find the perfect hotels for you
                    </p>
                  </Card.Body>
                </Card>
              )}

              <div>
                {view === "card" && (
        <Row xs={1} sm={2} md={3} lg={3} xl={3} className="g-4">
          
          
          {filteredResults.length > 0 ? (
            filteredResults.map((hotel, index) => {
              // console.log('Hotel data:', hotel);
              // console.log('Rendering hotel index:', index, 'Hotel name:', hotel.name);
              return (
                        <Col key={hotel.id}>
                          
                          <div style={{
                            backgroundColor: 'white',
                            border: '1px solid #dee2e6',
                            borderRadius: '12px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                            marginBottom: '20px',
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              position: 'relative',
                              height: '200px',
                              overflow: 'hidden'
                            }}>
                              <LazyImage src={hotel.image} alt={hotel.name} />
                              <div style={{
                                position: 'absolute',
                                top: '10px',
                                right: '10px',
                                backgroundColor: 'rgba(0,0,0,0.7)',
                                color: 'white',
                                padding: '5px 10px',
                                borderRadius: '15px',
                                fontSize: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px'
                              }}>
                                <FaStar className="text-warning me-1" />
                                {hotel.rating}
                                <span style={{marginLeft: '5px', backgroundColor: '#6c757d', padding: '2px 6px', borderRadius: '10px'}}>
                                  {hotel.channelType.toUpperCase()}
                                </span>
                              </div>
                            </div>
                            
                            <div style={{
                              padding: '16px',
                              backgroundColor: 'white'
                            }}>
                              <h6 style={{
                                fontSize: '1.3rem',
                                fontWeight: '600',
                                marginBottom: '8px',
                                color: '#333',
                                lineHeight: '1.3'
                              }}>
                                {hotel.name || 'Hotel Name Not Available'}
                              </h6>
                              
                              <p style={{
                                fontSize: '0.875rem',
                                color: '#666',
                                marginBottom: '8px',
                                lineHeight: '1.4'
                              }}>
                                📍 {hotel.address || 'Address Not Available'}
                              </p>
                              
                              <div style={{
                                backgroundColor: '#28a745',
                                color: 'white',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: '500',
                                display: 'inline-block',
                                marginBottom: '12px'
                              }}>
                                {hotel.badge}
                              </div>
                              
                              <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginTop: '12px',
                                paddingTop: '12px',
                                borderTop: '1px solid #eee'
                              }}>
                                <div style={{
                                  fontSize: '1.5rem',
                                  fontWeight: '600',
                                  color: '#333'
                                }}>
                                  {hotel.price ? `AED ${hotel.price.toLocaleString()}` : 'Price on request'}
                                </div>

                                 <Button
                                  className="btn-view-rooms"
                                  size="sm"
                                  //  disabled={clickedHotelIds.includes(hotel.id)}
                                  variant={clickedHotelIds.includes(hotel.id) ? "secondary" : "primary"}
                                  onClick={() => {

                                     // Add hotel ID to clickedHotelIds
                                    setClickedHotelIds((prev) => [...prev, hotel.id]);
                                    
                                    const nationalityValue =
                                      selectedNationality?.value;

                                   const nationalityCode =
                                      (selectedNationality?.code || "")
                                        .length === 2
                                        ? selectedNationality.code
                                        : " ";

                                    const agentIdToUse = agent; // Use selected agent or default to 1

                                    // console.log("rooms before mapping::", rooms);
                                    const roomsPayload = rooms.map((r) => ({
                                      adults: r.adults || 1,
                                      children: r.children || 0,
                                      childAges:r.childAges || [],
                                      adultAges: Array.from(
                                        { length: r.adults || 1 },
                                        () => 30
                                      ),
                                    }));

                                    // Dynamic apiId based on channelType
                                    const apiIdMapping = {
                                      jumeirah: 10,
                                      iwtx: 12,
                                      x3: 15,
                                      inhouse: 1,
                                      ratehawk: 14,
                                      darina: 16,
                                    };
                                    
                                    const apiId = apiIdMapping[hotel.channelType?.toLowerCase()] || 0;


                                    const payload = {
                                      checkInDate: checkIn,
                                      checkOutDate: checkOut,
                                      hotelCode:
                                        hotel.hotelCode ||
                                        hotel.id
                                          ?.split("-")
                                          .slice(1)
                                          .join("-") ||
                                        "",
                                      nationality: nationalityCode,
                                      agentId: String(agentIdToUse),
                                      apiId: apiId,
                                      rooms: roomsPayload,
                                    };
                                    const meta = {
                                      hotelName: hotel.name,
                                      address: hotel.address || hotel.city,
                                      starRating: hotel.rating || 0,
                                      phone: "",
                                      hotelImage: hotel.image,
                                    };

                                    // console.log("payload::", payload);
                                    // console.log("meta::", meta);
                                    try {
                                      sessionStorage.setItem(
                                        "roomListPayload",
                                        JSON.stringify({ payload, meta })
                                      );
                                      setTimeout(() => {
                                        window.open("/room-list", "_blank");
                                      }, 50);

                                      // navigate("/room-list", { state: { payload, meta } });
                                    } catch {}

                                  }}
                                >
                                  View Rooms
                                </Button>
                             
                              </div>
                            </div>
                          </div>
                        </Col>
                        );
                      })
                    ) : (
                      <Col xs={12}>
                        <Card className="shadow-sm rounded-xl">
                          <Card.Body className="text-center text-muted py-5">
                            <FaSearch className="display-4 text-muted mb-3" />
                            <h5>No results found</h5>
                            <p>
                              {channelType.length > 0
                                ? `No hotels found for the selected channel${channelType.length > 1 ? 's' : ''}: ${channelType.map(c => c.label).join(', ')}. Try selecting different channels or clearing the channel filter.`
                                : hotelSearchTerm ||
                                  starRating.length > 0 ||
                                  hotelType.length > 0
                                ? "No hotels match your current filters. Try adjusting your search criteria or clearing some filters."
                                : "Try adjusting your filters or search criteria."}
                            </p>
                            {(hotelSearchTerm ||
                              starRating.length > 0 ||
                              hotelType.length > 0 ||
                              channelType.length > 0) && (
                              <Button
                                variant="outline-primary"
                                size="sm"
                                onClick={() => {
                                  setStarRating([]);
                                  setHotelType([]);
                                  setChannelType([]);
                                  setSortBy("priceAsc");
                                  setHotelSearchTerm("");
                                }}
                              >
                                Clear All Filters
                              </Button>
                            )}
                          </Card.Body>
                        </Card>
                      </Col>
                    )}
                  </Row>
                )}

                {hasSearched &&
                  (() => {
                    if (filteredResults.length === 0) {
                      return null; // Don't show pagination when no results
                    }
                    
                    const hasClientOnlyFilters =
                      Boolean(hotelSearchTerm) || hotelType.length > 0;
                    const showingStart = pageIndex * pageSize + 1;
                    const showingEnd = hasClientOnlyFilters
                      ? Math.min(
                          pageIndex * pageSize + pageSize,
                          filteredResults.length
                        )
                      : Math.min(
                          pageIndex * pageSize + pageSize,
                          totalElements
                        );
                    const totalCount = hasClientOnlyFilters
                      ? filteredResults.length
                      : totalElements;
                    return (
                      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-4">
                        <small className="text-muted fw-semibold">
                          Showing {showingStart}-{showingEnd} of {totalCount}{" "}
                          results{" "}
                          {pollStatus === "IN_PROGRESS" ? "(updating...)" : ""}
                        </small>
                        {!hasClientOnlyFilters && (
                          <Pagination className="mb-0 pagination-modern">
                            <Pagination.Prev
                              disabled={pageIndex === 0}
                              onClick={() => goToPage(pageIndex - 1)}
                            />
                            {pageNumbers.map((n) =>
                              typeof n === "number" ? (
                                <Pagination.Item
                                  key={n}
                                  active={n === pageIndex + 1}
                                  onClick={() => goToPage(n - 1)}
                                >
                                  {n}
                                </Pagination.Item>
                              ) : (
                                <Pagination.Ellipsis key={n} disabled />
                              )
                            )}
                            <Pagination.Next
                              disabled={pageIndex >= effectiveTotalPages - 1}
                              onClick={() => goToPage(pageIndex + 1)}
                            />
                          </Pagination>
                        )}
                      </div>
                    );
                  })()}
              </div>
            </div>
          )}

                        

                    
                    </Card.Body>
                  </Card>
                </Tab>

                {/* --------------- Transfer Tab ---------------- */}
                <Tab eventKey="transfer" title={<><FaCar className="me-2" /> Transfer</>}>
                  <Card className="border-0 shadow-sm rounded-4">
                    <Card.Body>
                      <h5 className="fw-bold text-primary mb-3">Transfer Search</h5>
                      <Form>
                        <Row className="g-3">
                          <Col md={4}>
                            <Form.Label>Pickup Date</Form.Label>
                            <Form.Control type="date" value={travelDate} readOnly />
                          </Col>
                          <Col md={4}>
                            <Form.Label>Dropoff Date</Form.Label>
                            <Form.Control type="date" value={checkOut} readOnly />
                          </Col>
                          <Col md={4} className="d-flex align-items-end">
                            <Button variant="warning" className="w-100 py-2">
                              <FaSearch className="me-2" /> Search
                            </Button>
                          </Col>
                        </Row>
                      </Form>

                      <div className="text-center text-muted mt-5">
                        <FaCar className="fs-1 mb-3 text-secondary" />
                        <h6>No transfer results yet. Run a search to view available transfers.</h6>
                      </div>
                    </Card.Body>
                  </Card>
                </Tab>

                {/* --------------- Tours Tab ---------------- */}
                <Tab eventKey="tours" title={<><FaTicketAlt className="me-2" /> Tours & Activities</>}>
                  <Card className="border-0 shadow-sm rounded-4">
                    <Card.Body>
                      <h5 className="fw-bold text-primary mb-3">Tours & Activities Search</h5>
                      <Form>
                        <Row className="g-3">
                          <Col md={4}>
                            <Form.Label>Tour Date</Form.Label>
                            <Form.Control type="date" value={travelDate} readOnly />
                          </Col>
                          <Col md={4} className="d-flex align-items-end">
                            <Button variant="warning" className="w-100 py-2">
                              <FaSearch className="me-2" /> Search
                            </Button>
                          </Col>
                        </Row>
                      </Form>

                      <div className="text-center text-muted mt-5">
                        <FaTicketAlt className="fs-1 mb-3 text-secondary" />
                        <h6>No tour activities yet. Search to view available tours.</h6>
                      </div>
                    </Card.Body>
                  </Card>
                </Tab>
              </Tabs>
            </Card.Body>
          </Card>
        </main>
      </div>
    </div>
  );
}
