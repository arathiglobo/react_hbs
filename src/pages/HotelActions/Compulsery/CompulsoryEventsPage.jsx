import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Container,
  Table,
  Button,
  Badge,
  Modal,
  Form,
  Row,
  Col,
  Spinner,
} from "react-bootstrap";
import { FaArrowLeft, FaPlus, FaEdit, FaTrash } from "react-icons/fa";
import axiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import Sidebar from "../../../components/Sidebar";
import Topbar from "../../../components/TopBar";
import Select from "react-select";
// import "react-select/dist/react-select.css"; // Removed: not exported by react-select

const CompulsoryEventsPage = () => {
  const { id } = useParams(); // hotelId
  const navigate = useNavigate();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [marketTypes, setMarketTypes] = useState([]);
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editEvent, setEditEvent] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    supplymentCode: "",
    supplyments: "",
    marketypeIds: [],
    compulsorySupplymentsRateDTO: [
      {
        supplymentrateId: "",
        hotelRoomcategoryId: "",
        ocuppancytypeId: "",
        rate: "",
        rateAdult: "",
        rateChild: "",
      },
    ],
    compulsorySupplyValidityDTO: [
      { supplymentValidityId: "", validityFrom: "", validityTo: "" },
    ],
  });

  // Form errors state
  const [formErrors, setFormErrors] = useState({
    supplymentCode: "",
    supplyments: "",
    marketypeIds: "",
  });

  // Fetch compulsory events
  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(`/api/compulsoryEvent/${id}`);
      setEvents(res.data || []);
    } catch (error) {
      console.error("Error fetching events:", error);
      toast.error("Failed to load compulsory events");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    loadMarketTypes();
  }, [id]);

  // Open modal for create
  const handleCreate = () => {
    setEditEvent(null);
    setFormData({
      supplymentCode: "",
      supplyments: "",
      marketypeIds: [],
      compulsorySupplymentsRateDTO: [
        {
          supplymentrateId: "",
          hotelRoomcategoryId: "",
          ocuppancytypeId: "",
          rate: "",
          rateAdult: "",
          rateChild: "",
        },
      ],
      compulsorySupplyValidityDTO: [
        { supplymentValidityId: "", validityFrom: "", validityTo: "" },
      ],
    });
    setShowModal(true);
  };

  // Open modal for edit
  const openEdit = (event) => {
    setEditEvent(event);
    setFormData({
      supplymentCode: event.supplymentCode || "",
      supplyments: event.supplyments || "",
      marketypeIds: event.marketypeIds || event.marketypeIds || [],
      compulsorySupplymentsRateDTO:
        event.compulsorySupplymentsRateDTO?.length > 0
          ? event.compulsorySupplymentsRateDTO
          : [
              {
                supplymentrateId: "",
                hotelRoomcategoryId: "",
                ocuppancytypeId: "",
                rate: "",
                rateAdult: "",
                rateChild: "",
              },
            ],
      compulsorySupplyValidityDTO:
        event.compulsorySupplyValidityDTO?.length > 0
          ? event.compulsorySupplyValidityDTO
          : [{ supplymentValidityId: "", validityFrom: "", validityTo: "" }],
    });
    setShowModal(true);
  };

  // Handle delete
  const handleDelete = async (eventId) => {
    if (!window.confirm("Are you sure you want to delete this event?")) return;
    try {
      await axiosInstance.delete(`/api/compulsoryEvent/${eventId}`);
      toast.success("Event deleted successfully");
      fetchEvents();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete event");
    }
  };

  // Save (create)
  const handleSave = async () => {
    try {
      const payload = {
        ...formData,
        hotelId: parseInt(id),
      };
      await axiosInstance.post("/api/compulsoryEvent/save", payload);
      toast.success("Event created successfully");
      setShowModal(false);
      fetchEvents();
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save event");
    }
  };

  // Update (edit)
  const handleEdit = async () => {
    try {
      const payload = {
        ...formData,
        hotelId: parseInt(id),
        supplymentId: editEvent?.supplymentId || "",
      };
      await axiosInstance.put(
        `/api/compulsoryEvent/${editEvent.supplymentId}`,
        payload
      );
      toast.success("Event updated successfully");
      setShowModal(false);
      fetchEvents();
    } catch (error) {
      console.error("Update error:", error);
      toast.error("Failed to update event");
    }
  };

  const loadMarketTypes = async () => {
    try {
      const response = await axiosInstance.get("/api/marketType");
      console.log("Market Types response:", response.data);
      setMarketTypes(response.data || []);
    } catch (error) {
      console.error("Error loading market types:", error);
      toast.error("Failed to load market types");
    }
  };

  return (
    <div
      className="min-vh-100 bg-gradient-light d-flex flex-column"
      style={{
        background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
      }}
    >
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Container fluid>
            {/* Header Section */}
            <div className="d-flex justify-content-between align-items-center mb-4">
              <Button variant="link" onClick={() => navigate(-1)}>
                <FaArrowLeft /> Back
              </Button>
              <h3 className="mb-0">Compulsory Events / Supplements</h3>
              <Button variant="primary" onClick={handleCreate}>
                <FaPlus /> Create
              </Button>
            </div>

            {/* Events Table */}
            {loading ? (
              <div className="text-center">
                <Spinner animation="border" variant="primary" />
                <p className="mt-2">Loading events...</p>
              </div>
            ) : (
              <Table striped bordered hover responsive>
                <thead>
                  <tr>
                    <th>S.N</th>
                    <th>Supplement Code</th>
                    <th>Tagline</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {events.length > 0 ? (
                    events.map((ev, idx) => (
                      <tr key={ev.supplymentId}>
                        <td>{idx + 1}</td>
                        <td>{ev.supplymentCode}</td>
                        <td>{ev.supplyments}</td>
                        <td>
                          <Badge bg="success">Active</Badge>
                        </td>
                        <td>
                          <Button
                            size="sm"
                            variant="warning"
                            onClick={() => openEdit(ev)}
                          >
                            <FaEdit /> Edit
                          </Button>{" "}
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleDelete(ev.supplymentId)}
                          >
                            <FaTrash /> Delete
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-center">
                        No compulsory events found
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            )}

            {/* Create/Edit Modal */}
            <Modal
              show={showModal}
              onHide={() => setShowModal(false)}
              size="lg"
            >
              <Modal.Header closeButton>
                <Modal.Title>
                  {editEvent
                    ? "Update Supplement or Event"
                    : "Create Supplement or Event"}
                </Modal.Title>
              </Modal.Header>
              <Modal.Body>
                <Form>
                  <Row>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>
                          Supplement Code <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                          type="text"
                          value={formData.supplymentCode}
                          isInvalid={!!formErrors.supplymentCode}
                          onChange={(e) => {
                            setFormData({
                              ...formData,
                              supplymentCode: e.target.value,
                            });
                            if (formErrors.supplymentCode) {
                              setFormErrors({
                                ...formErrors,
                                supplymentCode: "",
                              });
                            }
                          }}
                        />
                        <Form.Control.Feedback type="invalid">
                          {formErrors.supplymentCode}
                        </Form.Control.Feedback>
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>
                          Tagline <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                          type="text"
                          value={formData.supplyments}
                          isInvalid={!!formErrors.supplyments}
                          onChange={(e) => {
                            setFormData({
                              ...formData,
                              supplyments: e.target.value,
                            });
                            if (formErrors.supplyments) {
                              setFormErrors({ ...formErrors, supplyments: "" });
                            }
                          }}
                        />
                        <Form.Control.Feedback type="invalid">
                          {formErrors.supplyments}
                        </Form.Control.Feedback>
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>
                          Market Type <span className="text-danger">*</span>
                        </Form.Label>
                        <Select
                          isMulti
                          options={marketTypes.map((market) => ({
                            value: market.id,
                            label: market.name,
                          }))}
                          value={formData.marketypeIds
                            .map((id) => {
                              const market = marketTypes.find(
                                (m) => m.id === id
                              );
                              return market
                                ? { value: market.id, label: market.name }
                                : null;
                            })
                            .filter(Boolean)}
                          onChange={(selected) => {
                            setFormData({
                              ...formData,
                              marketypeIds: selected
                                ? selected.map((opt) => opt.value)
                                : [],
                            });
                            if (formErrors.marketypeIds) {
                              setFormErrors({
                                ...formErrors,
                                marketypeIds: "",
                              });
                            }
                          }}
                          className={
                            formErrors.marketypeIds ? "is-invalid" : ""
                          }
                          closeMenuOnSelect={false}
                          menuIsOpen={undefined} // Let react-select control menu open state
                        />
                        {formErrors.marketypeIds && (
                          <div className="invalid-feedback d-block">
                            {formErrors.marketypeIds}
                          </div>
                        )}
                      </Form.Group>
                    </Col>
                  </Row>

                  {/* Rates Section */}

                  <h5>Rates</h5>
                  {formData.compulsorySupplymentsRateDTO.map((rate, idx) => (
                    <Row key={idx} className="mb-3">
                      <Col md={2}>
                        <Form.Control
                          placeholder="RoomCat ID"
                          value={rate.hotelRoomcategoryId}
                          onChange={(e) => {
                            const newRates = [
                              ...formData.compulsorySupplymentsRateDTO,
                            ];
                            newRates[idx].hotelRoomcategoryId = e.target.value;
                            setFormData({
                              ...formData,
                              compulsorySupplymentsRateDTO: newRates,
                            });
                          }}
                        />
                      </Col>
                      <Col md={2}>
                        <Form.Control
                          placeholder="Occupancy ID"
                          value={rate.ocuppancytypeId}
                          onChange={(e) => {
                            const newRates = [
                              ...formData.compulsorySupplymentsRateDTO,
                            ];
                            newRates[idx].ocuppancytypeId = e.target.value;
                            setFormData({
                              ...formData,
                              compulsorySupplymentsRateDTO: newRates,
                            });
                          }}
                        />
                      </Col>
                      <Col md={2}>
                        <Form.Control
                          placeholder="Rate"
                          value={rate.rate}
                          onChange={(e) => {
                            const newRates = [
                              ...formData.compulsorySupplymentsRateDTO,
                            ];
                            newRates[idx].rate = e.target.value;
                            setFormData({
                              ...formData,
                              compulsorySupplymentsRateDTO: newRates,
                            });
                          }}
                        />
                      </Col>
                      <Col md={2}>
                        <Form.Control
                          placeholder="Adult Rate"
                          value={rate.rateAdult}
                          onChange={(e) => {
                            const newRates = [
                              ...formData.compulsorySupplymentsRateDTO,
                            ];
                            newRates[idx].rateAdult = e.target.value;
                            setFormData({
                              ...formData,
                              compulsorySupplymentsRateDTO: newRates,
                            });
                          }}
                        />
                      </Col>
                      <Col md={2}>
                        <Form.Control
                          placeholder="Child Rate"
                          value={rate.rateChild}
                          onChange={(e) => {
                            const newRates = [
                              ...formData.compulsorySupplymentsRateDTO,
                            ];
                            newRates[idx].rateChild = e.target.value;
                            setFormData({
                              ...formData,
                              compulsorySupplymentsRateDTO: newRates,
                            });
                          }}
                        />
                      </Col>
                      <Col md={2}>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => {
                            const newRates =
                              formData.compulsorySupplymentsRateDTO.filter(
                                (_, i) => i !== idx
                              );
                            setFormData({
                              ...formData,
                              compulsorySupplymentsRateDTO: newRates,
                            });
                          }}
                        >
                          Remove
                        </Button>
                      </Col>
                    </Row>
                  ))}
                  <Button
                    size="sm"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        compulsorySupplymentsRateDTO: [
                          ...formData.compulsorySupplymentsRateDTO,
                          {
                            supplymentrateId: "",
                            hotelRoomcategoryId: "",
                            ocuppancytypeId: "",
                            rate: "",
                            rateAdult: "",
                            rateChild: "",
                          },
                        ],
                      })
                    }
                  >
                    + Add Rate
                  </Button>

                  {/* Validity Section */}
                  <h5 className="mt-3">Validity Periods</h5>
                  {formData.compulsorySupplyValidityDTO.map((validity, idx) => (
                    <Row key={idx} className="mb-3">
                      <Col md={5}>
                        <Form.Control
                          type="date"
                          value={validity.validityFrom}
                          onChange={(e) => {
                            const newValidity = [
                              ...formData.compulsorySupplyValidityDTO,
                            ];
                            newValidity[idx].validityFrom = e.target.value;
                            setFormData({
                              ...formData,
                              compulsorySupplyValidityDTO: newValidity,
                            });
                          }}
                        />
                      </Col>
                      <Col md={5}>
                        <Form.Control
                          type="date"
                          value={validity.validityTo}
                          onChange={(e) => {
                            const newValidity = [
                              ...formData.compulsorySupplyValidityDTO,
                            ];
                            newValidity[idx].validityTo = e.target.value;
                            setFormData({
                              ...formData,
                              compulsorySupplyValidityDTO: newValidity,
                            });
                          }}
                        />
                      </Col>
                      <Col md={2}>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => {
                            const newValidity =
                              formData.compulsorySupplyValidityDTO.filter(
                                (_, i) => i !== idx
                              );
                            setFormData({
                              ...formData,
                              compulsorySupplyValidityDTO: newValidity,
                            });
                          }}
                        >
                          Remove
                        </Button>
                      </Col>
                    </Row>
                  ))}
                  <Button
                    size="sm"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        compulsorySupplyValidityDTO: [
                          ...formData.compulsorySupplyValidityDTO,
                          {
                            supplymentValidityId: "",
                            validityFrom: "",
                            validityTo: "",
                          },
                        ],
                      })
                    }
                  >
                    + Add Validity
                  </Button>
                </Form>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button variant="success" onClick={handleSave}>
                  {editEvent ? "Update" : "Create"}
                </Button>
              </Modal.Footer>
            </Modal>
          </Container>
        </main>
      </div>
    </div>
  );
};

export default CompulsoryEventsPage;
