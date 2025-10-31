import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, Row, Col, Form, Button, Tabs, Tab } from "react-bootstrap";
import { FaSearch, FaHotel, FaCar, FaTicketAlt } from "react-icons/fa";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import { useLocation } from "react-router-dom";
import axiosInstance from "../../components/AxiosInstance";

export default function MakePkgCombineSearch() {
  const location = useLocation();
  const searchCriteria = location.state;
  console.log("Search Criteria:", searchCriteria);
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
  const [checkOut, setCheckOut] = useState(""); // can auto-calculate later
  const [nightsCount, setNightsCount] = useState(nights || 1);
  const [adultCount, setAdultCount] = useState(adults || 1);
  const [destinationLabel, setDestinationLabel] = useState(
    destination?.label || ""
  );
  const [nationalityLabel, setNationalityLabel] = useState(
    nationality?.label || ""
  );
  const [agentId, setAgentId] = useState(agent || "");

  const [activeTab, setActiveTab] = useState("accommodation");
  const [roomsOpen, setRoomsOpen] = useState(false);
  const [rooms, setRooms] = useState([
    { adults: 1, children: 0, childAges: [] },
  ]);
  const [childCount, setChildCount] = useState(0);
  const [childAges, setChildAges] = useState([]);
  const [allResults, setAllResults] = useState([]);
  const [agents, setAgents] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState("card");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize] = useState(10);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [hasSearchResult, setHasSearchResult] = useState(false);
  const [pollStatus, setPollStatus] = useState("IDLE");
  const [completedChannels, setCompletedChannels] = useState(new Set()); // Track completed channels
  const [searchId, setSearchId] = useState(null);
  const [isDestinationLoading, setIsDestinationLoading] = useState(false);
  const resultsRef = useRef(null);
  const [isInitialResultsLoaded, setIsInitialResultsLoaded] = useState(false);

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

  function RoomGuestSelector({ value, onChange }) {
    const [rooms, setRooms] = useState(value);

    const update = (next) => {
      setRooms(next);
      onChange && onChange(next);
    };

    const addRoom = () =>
      update([...rooms, { adults: 2, children: 0, childAges: [] }]);
    const removeRoom = (index) => update(rooms.filter((_, i) => i !== index));

    const setAdults = (index, adults) => {
      const next = rooms.map((r, i) => (i === index ? { ...r, adults } : r));
      update(next);
    };
    const setChildren = (index, children) => {
      const next = rooms.map((r, i) =>
        i === index
          ? {
              ...r,
              children,
              childAges: Array.from(
                { length: children },
                (_, j) => r.childAges[j] || 5
              ),
            }
          : r
      );
      update(next);
    };
    const setChildAge = (roomIdx, childIdx, age) => {
      const next = rooms.map((r, i) => {
        if (i !== roomIdx) return r;
        const ages = [...r.childAges];
        ages[childIdx] = age;
        return { ...r, childAges: ages };
      });
      update(next);
    };

    return (
      <div className="room-guest-selector">
        {rooms.map((room, i) => (
          <Card key={i} className="mb-2 shadow-sm">
            <Card.Body className="py-2">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <div className="fw-semibold">Room {i + 1}</div>
                {rooms.length > 1 && (
                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={() => removeRoom(i)}
                  >
                    Remove
                  </Button>
                )}
              </div>
              <div className="d-flex flex-wrap gap-3 align-items-end">
                <Form.Group>
                  <Form.Label>Adults</Form.Label>
                  <Form.Select
                    value={room.adults}
                    onChange={(e) => setAdults(i, parseInt(e.target.value))}
                  >
                    {[1, 2, 3, 4].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
                <Form.Group>
                  <Form.Label>Children</Form.Label>
                  <Form.Select
                    value={room.children}
                    onChange={(e) => setChildren(i, parseInt(e.target.value))}
                  >
                    {[0, 1, 2, 3, 4].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
                {Array.from({ length: room.children }).map((_, idx) => (
                  <Form.Group key={idx}>
                    <Form.Label>Child {idx + 1} Age</Form.Label>
                    <Form.Select
                      value={room.childAges[idx] || 5}
                      onChange={(e) =>
                        setChildAge(i, idx, parseInt(e.target.value))
                      }
                    >
                      {Array.from({ length: 17 }).map((__, age) => (
                        <option key={age} value={age}>
                          {age}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                ))}
              </div>
            </Card.Body>
          </Card>
        ))}
        <Button variant="outline-primary" size="sm" onClick={addRoom}>
          + Add Room
        </Button>
      </div>
    );
  }

  const fetchHotels = async (page, searchId, agentId) => {
    try {
      const params = {
        agentId: agentId || agent || 1, // Use passed agentId, or state agent, or default to 1
        page,
        pageSize,
        sortBy:
          sortBy === "priceAsc" || sortBy === "priceDesc" ? "baseRate" : sortBy,
        sortOrder:
          sortBy === "priceAsc" ||
          sortBy === "ratingAsc" ||
          sortBy === "nameAsc"
            ? "asc"
            : "desc",
        starRating: starRating.map((s) => s.value).join(",") || undefined,
        apiType:
          channelType.map((c) => c.value.toUpperCase()).join(",") || undefined,
      };

      const res = await axiosInstance.get(`/hotel-search/results/${searchId}`, {
        params,
      });

      const mappedResults = Array.isArray(res.data.result)
        ? res.data.result.map((hotel, index) => ({
            id: hotel.hotelCode
              ? `${searchId}-${hotel.hotelCode}`
              : `${searchId}-h${index + 1}`,
            searchId,
            hotelCode: hotel.hotelCode || null,
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
            hotelType: "hotel",
            channelType: hotel.apiType?.toLowerCase() || "inhouse",
          }))
        : [];

      // Clear previous results and set new results for the current page
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
      throw err;
    }
  };

  const pollUntilComplete = async (
    url,
    params,
    checkComplete,
    onUpdate,
    intervalMs = 4000,
    timeoutMs = 20000,
    initialDelay = 2000
  ) => {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let localPollCount = 0;

      const poll = async () => {
        try {
          localPollCount++;
          const res = await axiosInstance.get(url, { params });

          if (onUpdate) {
            onUpdate(res.data, localPollCount);
          }

          if (checkComplete(res.data)) {
            setPollStatus("COMPLETED");
            return resolve(res.data);
          }

          if (Date.now() - startTime >= timeoutMs) {
            setPollStatus("TIMEOUT");
            return reject(new Error("Polling timed out"));
          }

          setTimeout(poll, intervalMs);
        } catch (err) {
          console.error("Poll failed:", err);
          setPollStatus("ERROR");
          reject(err);
        }
      };

      setPollStatus("IN_PROGRESS");
      setTimeout(poll, initialDelay);
    });
  };

  const resetForm = () => {
    setSelectedNationality(null);
    setSelectedDestination(null);
    setCheckIn("");
    setCheckOut("");
    setNights(1);
    setAgent("");
    setRooms([{ adults: 1, children: 0, childAges: [] }]);
    setRoomsOpen(false);
    setErrors({});
    setAllResults([]);
    setHasSearched(false);
    setHasSearchResult(false);
    setPageIndex(0);
    setTotalElements(0);
    setTotalPages(1);
    setPollStatus("IDLE");
    setSearchId(null);
    setCompletedChannels(new Set());
  };

  const handleHotelSearchSubmit = async (e) => {
    e.preventDefault();

    // Reset state before starting
    setIsLoading(true);
    setHasSearched(true);
    setHasSearchResult(false);
    setAllResults([]);
    setPollStatus("IDLE");
    setCompletedChannels(new Set());
    setPageIndex(0);
    setTotalElements(0);
    setTotalPages(1);

    try {
      // ---- ✅ Extract values safely ----
      const nationalityId = nationality?.value || "";
      const nationalityCode = nationality?.code || "";
      const destinationCityId = destination?.value || "";
      const destinationCountryId = destination?.countryId || "";
      const agentIdFinal = agentId || agent || 1;
      const noOfRooms = rooms.length.toString();

      // ---- ✅ Build room configurations dynamically ----
      const roomConfigurations = rooms.map((room, index) => ({
        roomNo: (index + 1).toString(),
        adultCount: (room.adults || 1).toString(),
        childCount: (room.children || 0).toString(),
        childAges: room.childAges?.length ? room.childAges : [],
        adultAges: Array.from({ length: room.adults || 1 }, () => 25),
      }));

      // ---- ✅ Final payload structure ----
      const searchPayloadReq = {
        nationalityId,
        nationalityCode,
        destinationCityId,
        destinationCountryId,
        checkIn,
        checkOut,
        noOfRooms,
        roomConfigurations,
        agentId: agentIdFinal,
      };

      console.log("🔹 Sending payload:", searchPayloadReq);

      // ---- ✅ API Call ----
      const searchKeyRes = await axiosInstance.post(
        "/hotel-search/search",
        searchPayloadReq
      );

      const searchId = searchKeyRes.data.searchId;
      if (!searchId) throw new Error("No searchId returned from response");

      setSearchId(searchId);

      // ---- ✅ Prepare params for polling ----
      const params = {
        agentId: agentIdFinal,
        page: 0,
        pageSize,
      };

      // ---- ✅ Polling logic ----
      await pollUntilComplete(
        `/hotel-search/results/${searchId}`,
        params,
        (data) => data.finalStatus === "COMPLETED",
        (data) => {
          if (Array.isArray(data.result)) {
            const mappedResults = data.result.map((hotel, index) => ({
              id: hotel.hotelCode
                ? `${searchId}-${hotel.hotelCode}`
                : `${searchId}-h${index + 1}`,
              searchId,
              hotelCode: hotel.hotelCode || null,
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
              hotelType: "hotel",
              channelType: hotel.apiType?.toLowerCase(),
            }));
            setAllResults(mappedResults);
            setHasSearchResult(true);
          }
        },
        4000,
        20000,
        2000
      );
    } catch (err) {
      console.error("Search failed:", err);
      setHasSearched(false);
      setPollStatus("ERROR");
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ Handle page change
const handlePageChange = async (newPage) => {
  if (newPage < 0 || newPage >= totalPages) return;
  setPageIndex(newPage);
  setIsLoading(true);
  try {
    await fetchHotels(newPage, searchId, agentId);
  } catch (err) {
    console.error("Pagination fetch failed:", err);
  } finally {
    setIsLoading(false);
  }
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
                Create My Trip{" "}
                <span className="text-muted">
                  - Dubai, United Arab Emirates
                </span>
              </h4>

              <Tabs
                activeKey={activeTab}
                onSelect={(k) => setActiveTab(k)}
                className="mb-3 nav-tabs-custom"
              >
                <Tab
                  eventKey="accommodation"
                  title={
                    <>
                      <FaHotel className="me-2" /> Accommodation
                    </>
                  }
                >
                  {/* Accommodation (Hotel Search Form) */}
                  <Card className="border-0 shadow-sm">
                    <Card.Body>
                      <h5 className="fw-bold text-primary mb-3">
                        Hotel Search
                      </h5>
                      <Form>
                        <Row className="g-3">
                          <Col md={3}>
                            <Form.Group>
                              <Form.Label>Check In</Form.Label>
                              <Form.Control
                                type="date"
                                value={checkIn}
                                onChange={(e) => setCheckIn(e.target.value)}
                              />
                            </Form.Group>
                          </Col>
                          <Col md={3}>
                            <Form.Group>
                              <Form.Label>Check Out</Form.Label>
                              <Form.Control
                                type="date"
                                value={checkOut}
                                readOnly
                              />
                            </Form.Group>
                          </Col>
                          <Col md={2}>
                            <Form.Group>
                              <Form.Label>Nights</Form.Label>
                              <Form.Control
                                type="number"
                                min="1"
                                value={nightsCount}
                                onChange={(e) => setNightsCount(e.target.value)}
                              />
                            </Form.Group>
                          </Col>
                          <Col lg={4} md={6}>
                            <Form.Label className="fw-semibold text-dark">
                              👥 Rooms & Guests
                            </Form.Label>
                            <Button
                              variant="outline-primary"
                              className="w-100 text-start"
                              type="button"
                              onClick={() => setRoomsOpen((o) => !o)}
                            >
                              {adultCount} adults
                              {childCount ? `, ${childCount} child` : ""} · 1
                              room
                              <span className="float-end">
                                {roomsOpen ? "▴" : "▾"}
                              </span>
                            </Button>
                          </Col>
                        </Row>
                      {roomsOpen && (
  <>
    <Row className="g-3 mt-3">
      <Col md={12}>
        <RoomGuestSelector value={rooms} onChange={setRooms} />
      </Col>
    </Row>

    {/* ✅ Pagination Controls */}
    {totalPages > 1 && (
      <div className="d-flex justify-content-center align-items-center mt-4 gap-2">
        <Button
          variant="outline-secondary"
          size="sm"
          disabled={pageIndex === 0 || isLoading}
          onClick={() => handlePageChange(pageIndex - 1)}
        >
          Previous
        </Button>

        <span className="fw-semibold">
          Page {pageIndex + 1} of {totalPages}
        </span>

        <Button
          variant="outline-secondary"
          size="sm"
          disabled={pageIndex + 1 >= totalPages || isLoading}
          onClick={() => handlePageChange(pageIndex + 1)}
        >
          Next
        </Button>
      </div>
    )}
  </>
)}



                        <div className="text-center mt-4">
                          <Button
                            variant="warning"
                            className="px-4 py-2 hotel-search"
                            onClick={handleHotelSearchSubmit}
                          >
                            <FaSearch className="me-2" />
                            Search
                          </Button>
                        </div>
                      </Form>

                      {hasSearchResult && allResults.length > 0 && (
                        <div className="mt-4">
                          <h5 className="fw-bold mb-3 text-primary">
                            Search Results
                          </h5>
                          <Row className="g-3">
                            {allResults.map((hotel) => (
                              <Col md={4} key={hotel.id}>
                                <Card className="shadow-sm h-100">
                                  <Card.Img
                                    variant="top"
                                    src={hotel.image}
                                    alt={hotel.name}
                                    style={{
                                      height: "180px",
                                      objectFit: "cover",
                                    }}
                                  />
                                  <Card.Body>
                                    <Card.Title className="fw-semibold text-dark">
                                      {hotel.name}
                                    </Card.Title>
                                    <Card.Text className="text-muted mb-2">
                                      <small>{hotel.city}</small>
                                    </Card.Text>
                                    <div className="d-flex justify-content-between align-items-center">
                                      <span className="fw-bold text-success">
                                        {hotel.price
                                          ? `AED ${hotel.price}`
                                          : "Rate not available"}
                                      </span>
                                      <Button
                                        variant="outline-warning"
                                        size="sm"
                                      >
                                        View Details
                                      </Button>
                                    </div>
                                  </Card.Body>
                                </Card>
                              </Col>
                            ))}
                          </Row>
                        </div>
                      )}

                      {hasSearchResult && allResults.length === 0 && (
                        <div className="text-center text-muted mt-4">
                          <p>No hotels found for the selected criteria.</p>
                        </div>
                      )}

                      {isLoading && (
                        <div className="text-center mt-4">
                          <div
                            className="spinner-border text-warning"
                            role="status"
                          >
                            <span className="visually-hidden">Loading...</span>
                          </div>
                          <p className="mt-2 text-muted">Searching hotels...</p>
                        </div>
                      )}
                    </Card.Body>
                  </Card>
                </Tab>

                <Tab
                  eventKey="transfer"
                  title={
                    <>
                      <FaCar className="me-2" /> Transfer
                    </>
                  }
                >
                  <Card className="border-0 shadow-sm">
                    <Card.Body>
                      <h5 className="fw-bold text-primary mb-3">
                        Transfer Search
                      </h5>
                      <Form>
                        <Row className="g-3 align-items-end">
                          {/* Pickup date */}
                          <Col md={3}>
                            <Form.Group>
                              <Form.Label>Pickup Date</Form.Label>
                              <Form.Control
                                type="date"
                                value={travelDate}
                                readOnly
                              />
                            </Form.Group>
                          </Col>

                          {/* Dropoff date */}
                          <Col md={3}>
                            <Form.Group>
                              <Form.Label>Dropoff Date</Form.Label>
                              <Form.Control
                                type="date"
                                value={checkOut}
                                readOnly
                              />
                            </Form.Group>
                          </Col>

                          {/* Adult count */}
                          <Col md={2}>
                            <Form.Group>
                              <Form.Label>Adult</Form.Label>
                              <Form.Select value={adultCount} disabled>
                                {[1, 2, 3, 4, 5].map((n) => (
                                  <option key={n} value={n}>
                                    {n}
                                  </option>
                                ))}
                              </Form.Select>
                            </Form.Group>
                          </Col>

                          {/* Child count (dynamic age selector below) */}
                          <Col md={2}>
                            <Form.Group>
                              <Form.Label>Child</Form.Label>
                              <Form.Select value={childCount} disabled>
                                {[0, 1, 2, 3, 4].map((n) => (
                                  <option key={n} value={n}>
                                    {n}
                                  </option>
                                ))}
                              </Form.Select>
                            </Form.Group>
                          </Col>

                          {/* Search button */}
                          <Col md={2} className="text-end">
                            <Button
                              variant="warning"
                              className="w-100 mt-3 cab-search"
                            >
                              <FaSearch className="me-2" />
                              Search
                            </Button>
                          </Col>
                        </Row>

                        {/* Dynamic Children Age fields */}
                        {childCount > 0 && (
                          <Row className="mt-3">
                            <Col md={12}>
                              <Form.Label>Children Age</Form.Label>
                              <div className="d-flex gap-2 flex-wrap">
                                {Array.from({ length: childCount }).map(
                                  (_, i) => (
                                    <Form.Select
                                      key={i}
                                      style={{ width: "100px" }}
                                      value={childAges[i] || ""}
                                      onChange={(e) =>
                                        handleChildAgeChange(i, e.target.value)
                                      }
                                    >
                                      <option value="">Age</option>
                                      {Array.from({ length: 17 }).map(
                                        (_, age) => (
                                          <option key={age} value={age}>
                                            {age}
                                          </option>
                                        )
                                      )}
                                    </Form.Select>
                                  )
                                )}
                              </div>
                            </Col>
                          </Row>
                        )}
                      </Form>
                    </Card.Body>
                  </Card>
                </Tab>

                {/* <Tab
                  eventKey="tours"
                  title={
                    <>
                      <FaTicketAlt className="me-2" /> Tours & Activities
                    </>
                  }
                >
                  <Card className="border-0 shadow-sm">
                    <Card.Body className="text-center text-muted py-5">
                      <FaTicketAlt className="display-6 text-secondary mb-3" />
                      <h5>Tours & Activities Search Section</h5>
                      <p>Here you’ll display tour activity search filters.</p>
                    </Card.Body>
                  </Card>
                </Tab> */}
                <Tab
                  eventKey="tours"
                  title={
                    <>
                      <FaTicketAlt className="me-2" /> Tours & Activities
                    </>
                  }
                >
                  <Card className="border-0 shadow-sm">
                    <Card.Body>
                      <h5 className="fw-bold text-primary mb-3">
                        Tour & Activity Search
                      </h5>
                      <Form>
                        <Row className="g-3 align-items-end">
                          {/* Tour Date */}
                          <Col md={3}>
                            <Form.Group>
                              <Form.Label>Tour Date</Form.Label>
                              <Form.Control
                                type="date"
                                value={travelDate}
                                readOnly
                              />
                            </Form.Group>
                          </Col>

                          {/* Adult Count */}
                          <Col md={2}>
                            <Form.Group>
                              <Form.Label>Adult</Form.Label>
                              <Form.Select value={adultCount} disabled>
                                {[1, 2, 3, 4, 5].map((n) => (
                                  <option key={n} value={n}>
                                    {n}
                                  </option>
                                ))}
                              </Form.Select>
                            </Form.Group>
                          </Col>

                          {/* Children Count */}
                          <Col md={2}>
                            <Form.Group>
                              <Form.Label>Children</Form.Label>
                              <Form.Select value={childCount} disabled>
                                {[0, 1, 2, 3, 4].map((n) => (
                                  <option key={n} value={n}>
                                    {n}
                                  </option>
                                ))}
                              </Form.Select>
                            </Form.Group>
                          </Col>
                          {/* Search Button */}
                          <Col md={2}>
                            <Button
                              variant="warning"
                              className="w-100 mt-3"
                              type="submit"
                            >
                              <FaSearch className="me-2 activity-search" />
                              Search
                            </Button>
                          </Col>
                        </Row>

                        {/* Dynamic Children Age Fields */}
                        {childCount > 0 && (
                          <Row className="mt-3">
                            <Col md={12}>
                              <Form.Label>Children Age</Form.Label>
                              <div className="d-flex gap-2 flex-wrap">
                                {Array.from({ length: childCount }).map(
                                  (_, i) => (
                                    <Form.Select
                                      key={i}
                                      style={{ width: "100px" }}
                                      value={childAges[i] || ""}
                                      onChange={(e) =>
                                        handleChildAgeChange(i, e.target.value)
                                      }
                                    >
                                      <option value="">Age</option>
                                      {Array.from({ length: 17 }).map(
                                        (_, age) => (
                                          <option key={age} value={age}>
                                            {age}
                                          </option>
                                        )
                                      )}
                                    </Form.Select>
                                  )
                                )}
                              </div>
                            </Col>
                          </Row>
                        )}
                      </Form>
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
