import React, { useState } from "react";
import { Card, Row, Col, Form, Button, Tabs, Tab } from "react-bootstrap";
import { FaSearch, FaHotel, FaCar, FaTicketAlt } from "react-icons/fa";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";

export default function MakePkgCombineSearch() {
  const [activeTab, setActiveTab] = useState("accommodation");
  const [roomsOpen, setRoomsOpen] = useState(false);
  const [rooms, setRooms] = useState([
    { adults: 2, children: 0, childAges: [] },
  ]);
  const [childCount, setChildCount] = useState(0);
  const [childAges, setChildAges] = useState([]);

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
                              <Form.Control type="date" />
                            </Form.Group>
                          </Col>
                          <Col md={3}>
                            <Form.Group>
                              <Form.Label>Check Out</Form.Label>
                              <Form.Control type="date" />
                            </Form.Group>
                          </Col>
                          <Col md={2}>
                            <Form.Group>
                              <Form.Label>Nights</Form.Label>
                              <Form.Control type="number" min="1" />
                            </Form.Group>
                          </Col>
                          <Col lg={4} md={6}>
                            <Form.Label className="fw-semibold text-dark">
                              👥 Rooms & Guests
                            </Form.Label>
                            <Button
                              variant="outline-primary"
                              className="w-100 text-start rooms-summary-btn-modern"
                              type="button"
                              onClick={() => setRoomsOpen((o) => !o)}
                            >
                              {rooms.reduce((a, r) => a + r.adults, 0)} adults
                              {rooms.reduce((a, r) => a + r.children, 0)
                                ? `, ${rooms.reduce(
                                    (a, r) => a + r.children,
                                    0
                                  )} child`
                                : ""}{" "}
                              · {rooms.length} room{rooms.length > 1 ? "s" : ""}
                              <span className="float-end">
                                {roomsOpen ? "▴" : "▾"}
                              </span>
                            </Button>
                          </Col>
                        </Row>
                        {roomsOpen && (
                          <Row className="g-3 mt-3">
                            <Col md={12}>
                              <RoomGuestSelector
                                value={rooms}
                                onChange={setRooms}
                              />
                            </Col>
                          </Row>
                        )}

                        <div className="text-center mt-4">
                          <Button variant="warning" className="px-4 py-2">
                            <FaSearch className="me-2" />
                            Search
                          </Button>
                        </div>
                      </Form>
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
                              <Form.Control type="date" />
                            </Form.Group>
                          </Col>

                          {/* Dropoff date */}
                          <Col md={3}>
                            <Form.Group>
                              <Form.Label>Dropoff Date</Form.Label>
                              <Form.Control type="date" />
                            </Form.Group>
                          </Col>

                          {/* Adult count */}
                          <Col md={2}>
                            <Form.Group>
                              <Form.Label>Adult</Form.Label>
                              <Form.Select>
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
                              <Form.Select
                                value={childCount}
                                onChange={(e) =>
                                  setChildCount(parseInt(e.target.value))
                                }
                              >
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
                            <Button variant="warning" className="w-100 mt-3">
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
      <h5 className="fw-bold text-primary mb-3">Tour & Activity Search</h5>
      <Form>
        <Row className="g-3 align-items-end">
          {/* Tour Date */}
          <Col md={3}>
            <Form.Group>
              <Form.Label>Tour Date</Form.Label>
              <Form.Control type="date" />
            </Form.Group>
          </Col>

          {/* Adult Count */}
          <Col md={2}>
            <Form.Group>
              <Form.Label>Adult</Form.Label>
              <Form.Select>
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
              <Form.Select
                value={childCount}
                onChange={(e) => setChildCount(parseInt(e.target.value))}
              >
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
              <FaSearch className="me-2" />
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
                {Array.from({ length: childCount }).map((_, i) => (
                  <Form.Select
                    key={i}
                    style={{ width: "100px" }}
                    value={childAges[i] || ""}
                    onChange={(e) => handleChildAgeChange(i, e.target.value)}
                  >
                    <option value="">Age</option>
                    {Array.from({ length: 17 }).map((_, age) => (
                      <option key={age} value={age}>
                        {age}
                      </option>
                    ))}
                  </Form.Select>
                ))}
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
