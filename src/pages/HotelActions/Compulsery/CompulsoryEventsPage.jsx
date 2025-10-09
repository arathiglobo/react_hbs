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

const CompulsoryEventsPage = () => {
  const { id } = useParams(); // hotelId
  const navigate = useNavigate();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [marketTypes, setMarketTypes] = useState([]);
  const [masterOccupancies, setMasterOccupancy] = useState([]);
  const [hotelRoomsData, setHotelRoomsData] = useState([]);
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
    loadMasterOcccupancies();
    loadHotelRoomDatas();
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
    setFormErrors({
      supplymentCode: "",
      supplyments: "",
      marketypeIds: "",
    });
    setShowModal(true);
  };

  // Open modal for edit
  const openEdit = (event) => {
    setEditEvent(event);
    setFormData({
      supplymentId: event?.supplymentId || "",
      supplymentCode: event.supplymentCode || "",
      supplyments: event.supplyments || "",
      marketypeIds: event.marketypeIds || [],
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
    setFormErrors({
      supplymentCode: "",
      supplyments: "",
      marketypeIds: "",
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

  // Validate form data
  const validateForm = () => {
    const errors = {
      supplymentCode: "",
      supplyments: "",
      marketypeIds: "",
    };
    let isValid = true;

    if (!formData.supplymentCode.trim()) {
      errors.supplymentCode = "Supplement Code is required";
      isValid = false;
    }
    if (!formData.supplyments.trim()) {
      errors.supplyments = "Tagline is required";
      isValid = false;
    }
    if (formData.marketypeIds.length === 0) {
      errors.marketypeIds = "At least one Market Type is required";
      isValid = false;
    }

    // Validate validity periods
    formData.compulsorySupplyValidityDTO.forEach((validity, index) => {
      if (!validity.validityFrom) {
        toast.error(`Validity ${index + 1}: Validity From is required`);
        isValid = false;
      }
      if (!validity.validityTo) {
        toast.error(`Validity ${index + 1}: Validity To is required`);
        isValid = false;
      }
      if (validity.validityFrom && validity.validityTo) {
        const fromDate = new Date(validity.validityFrom);
        const toDate = new Date(validity.validityTo);
        if (toDate <= fromDate) {
          toast.error(
            `Validity ${index + 1}: Validity To must be after Validity From`
          );
          isValid = false;
        }
      }
    });

    setFormErrors(errors);
    return isValid;
  };

  // Save (create)
  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      // Format validity dates to DD-MM-YYYY
      const formattedValidityDTO = formData.compulsorySupplyValidityDTO.map(
        (validity) => {
          const fromDate = new Date(validity.validityFrom);
          const toDate = new Date(validity.validityTo);
          return {
            supplymentValidityId: validity.supplymentValidityId || "",
            validityFrom: `${fromDate.getDate().toString().padStart(2, "0")}-${(
              fromDate.getMonth() + 1
            )
              .toString()
              .padStart(2, "0")}-${fromDate.getFullYear()}`,
            validityTo: `${toDate.getDate().toString().padStart(2, "0")}-${(
              toDate.getMonth() + 1
            )
              .toString()
              .padStart(2, "0")}-${toDate.getFullYear()}`,
          };
        }
      );

      const payload = {
        supplymentId: "",
        supplymentCode: formData.supplymentCode,
        supplyments: formData.supplyments,
        hotelId: parseInt(id),
        marketypeIds: formData.marketypeIds.map(Number),
        compulsorySupplymentsRateDTO: formData.compulsorySupplymentsRateDTO.map(
          (rate) => ({
            supplymentrateId: rate.supplymentrateId || "",
            hotelRoomcategoryId: parseInt(rate.hotelRoomcategoryId) || 0,
            ocuppancytypeId: parseInt(rate.ocuppancytypeId) || 0,
            rate: parseFloat(rate.rate) || 0,
            rateAdult: parseFloat(rate.rateAdult) || 0,
            rateChild: parseFloat(rate.rateChild) || 0,
          })
        ),
        compulsorySupplyValidityDTO: formattedValidityDTO,
      };

      console.log("Compulsory Event Save Payload:", payload);
      const response = await axiosInstance.post(
        "/api/compulsoryEvent/save",
        payload
      );
      console.log("Compulsory Event Save Response:", response.data);
      if (response.data) {
        toast.success("Event created successfully");
        setShowModal(false);
        fetchEvents();
      }
    } catch (error) {
      console.error("Save error:", error);
      toast.error(error.response?.data?.message || "Failed to save event");
    }
  };

  // Update (edit)
  const handleEdit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      // Format validity dates to DD-MM-YYYY
      const formattedValidityDTO = formData.compulsorySupplyValidityDTO.map(
        (validity) => {
          const fromDate = new Date(validity.validityFrom);
          const toDate = new Date(validity.validityTo);
          return {
            supplymentValidityId: validity.supplymentValidityId || "",
            validityFrom: `${fromDate.getDate().toString().padStart(2, "0")}-${(
              fromDate.getMonth() + 1
            )
              .toString()
              .padStart(2, "0")}-${fromDate.getFullYear()}`,
            validityTo: `${toDate.getDate().toString().padStart(2, "0")}-${(
              toDate.getMonth() + 1
            )
              .toString()
              .padStart(2, "0")}-${toDate.getFullYear()}`,
          };
        }
      );

      const payload = {
        supplymentId: editEvent?.supplymentId || "",
        supplymentCode: formData.supplymentCode,
        supplyments: formData.supplyments,
        hotelId: parseInt(id),
        marketypeIds: formData.marketypeIds.map(Number),
        compulsorySupplymentsRateDTO: formData.compulsorySupplymentsRateDTO.map(
          (rate) => ({
            supplymentrateId: rate.supplymentrateId || "",
            hotelRoomcategoryId: parseInt(rate.hotelRoomcategoryId) || 0,
            ocuppancytypeId: parseInt(rate.ocuppancytypeId) || 0,
            rate: parseFloat(rate.rate) || 0,
            rateAdult: parseFloat(rate.rateAdult) || 0,
            rateChild: parseFloat(rate.rateChild) || 0,
          })
        ),
        compulsorySupplyValidityDTO: formattedValidityDTO,
      };

      console.log("Compulsory Event Update Payload:", payload);
      const response = await axiosInstance.put(
        `/api/compulsoryEvent/${editEvent.supplymentId}`,
        payload
      );
      console.log("Compulsory Event Update Response:", response.data);
      toast.success("Event updated successfully");
      setShowModal(false);
      fetchEvents();
    } catch (error) {
      console.error("Update error:", error);
      toast.error(error.response?.data?.message || "Failed to update event");
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

  const loadMasterOcccupancies = async () => {
    try {
      const response = await axiosInstance.get(`/api/occupancyType`);
      setMasterOccupancy(response.data || []);
    } catch (error) {
      toast.error("Failed to load Master Occupancy");
    }
  };

  const loadHotelRoomDatas = async () => {
    try {
      const response = await axiosInstance.get(
        `/api/hotelRoomDetailsController/${id}`
      );
      setHotelRoomsData(response.data || []);
    } catch (error) {
      toast.error("Failed to load Hotel Rooms Data");
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox" ? checked : type === "file" ? files[0] : value,
    }));
  };

  // Handle react-select change for marketypeIds
  const handleMarketTypeChange = (selectedOptions) => {
    const selectedIds = selectedOptions
      ? selectedOptions.map((option) => option.value)
      : [];
    setFormData((prev) => ({
      ...prev,
      marketypeIds: selectedIds,
    }));
    if (selectedIds.length > 0 && formErrors.marketypeIds) {
      setFormErrors((prev) => ({ ...prev, marketypeIds: "" }));
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
                          name="marketypeIds"
                          options={marketTypes.map((market) => ({
                            value: market.marketTypeId,
                            label: market.name,
                          }))}
                          value={marketTypes
                            .filter((market) =>
                              formData.marketypeIds.includes(market.marketTypeId)
                            )
                            .map((market) => ({
                              value: market.marketTypeId,
                              label: market.name,
                            }))}
                          onChange={handleMarketTypeChange}
                          className={formErrors.marketypeIds ? "is-invalid" : ""}
                        />
                        {formErrors.marketypeIds && (
                          <div className="text-danger small">
                            {formErrors.marketypeIds}
                          </div>
                        )}
                      </Form.Group>
                    </Col>
                  </Row>

                  {/* Rates Section */}
                  <h5>Rates</h5>
                  <div className="mb-3 p-3 border rounded bg-light">
                    {hotelRoomsData.map((room, roomIdx) => (
                      <div key={roomIdx} className="mb-3">
                        <label>
                          {room.roomCategory.toUpperCase()} -{" "}
                          {room.roomTypeDetailsDTOs
                            .map((rt) => rt.roomTypeName)
                            .join(", ")}
                        </label>

                        <Table striped bordered hover responsive>
                          <thead>
                            <tr>
                              <th>Occupancy type</th>
                              <th>Base Rate</th>
                              <th>Adult Rate</th>
                              <th>Child Rate</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {formData.compulsorySupplymentsRateDTO
                              .filter(
                                (rate) =>
                                  rate.hotelRoomcategoryId ===
                                  room.roomCategoryId
                              )
                              .map((rate, idx) => (
                                <tr key={idx}>
                                  <td>
                                    <Form.Select
                                      value={rate.ocuppancytypeId}
                                      onChange={(e) => {
                                        const newRates = [
                                          ...formData.compulsorySupplymentsRateDTO,
                                        ];
                                        newRates[
                                          formData.compulsorySupplymentsRateDTO.findIndex(
                                            (r) =>
                                              r.hotelRoomcategoryId ===
                                                rate.hotelRoomcategoryId &&
                                              r.ocuppancytypeId ===
                                                rate.ocuppancytypeId
                                          )
                                        ].ocuppancytypeId = e.target.value;
                                        setFormData({
                                          ...formData,
                                          compulsorySupplymentsRateDTO: newRates,
                                        });
                                      }}
                                    >
                                      <option value="">
                                        Select Occupancy Type
                                      </option>
                                      {masterOccupancies.map((type) => (
                                        <option
                                          key={type.occupancyTypeId}
                                          value={type.occupancyTypeId}
                                        >
                                          {type.occupancy}
                                        </option>
                                      ))}
                                    </Form.Select>
                                  </td>
                                  <td>
                                    <Form.Control
                                      type="number"
                                      value={rate.rate}
                                      onChange={(e) => {
                                        const newRates = [
                                          ...formData.compulsorySupplymentsRateDTO,
                                        ];
                                        newRates[
                                          formData.compulsorySupplymentsRateDTO.findIndex(
                                            (r) =>
                                              r.hotelRoomcategoryId ===
                                                rate.hotelRoomcategoryId &&
                                              r.ocuppancytypeId ===
                                                rate.ocuppancytypeId
                                          )
                                        ].rate = e.target.value;
                                        setFormData({
                                          ...formData,
                                          compulsorySupplymentsRateDTO: newRates,
                                        });
                                      }}
                                      placeholder="Base Rate"
                                    />
                                  </td>
                                  <td>
                                    <Form.Control
                                      type="number"
                                      value={rate.rateAdult}
                                      onChange={(e) => {
                                        const newRates = [
                                          ...formData.compulsorySupplymentsRateDTO,
                                        ];
                                        newRates[
                                          formData.compulsorySupplymentsRateDTO.findIndex(
                                            (r) =>
                                              r.hotelRoomcategoryId ===
                                                rate.hotelRoomcategoryId &&
                                              r.ocuppancytypeId ===
                                                rate.ocuppancytypeId
                                          )
                                        ].rateAdult = e.target.value;
                                        setFormData({
                                          ...formData,
                                          compulsorySupplymentsRateDTO: newRates,
                                        });
                                      }}
                                      placeholder="Adult Rate"
                                    />
                                  </td>
                                  <td>
                                    <Form.Control
                                      type="number"
                                      value={rate.rateChild}
                                      onChange={(e) => {
                                        const newRates = [
                                          ...formData.compulsorySupplymentsRateDTO,
                                        ];
                                        newRates[
                                          formData.compulsorySupplymentsRateDTO.findIndex(
                                            (r) =>
                                              r.hotelRoomcategoryId ===
                                                rate.hotelRoomcategoryId &&
                                              r.ocuppancytypeId ===
                                                rate.ocuppancytypeId
                                          )
                                        ].rateChild = e.target.value;
                                        setFormData({
                                          ...formData,
                                          compulsorySupplymentsRateDTO: newRates,
                                        });
                                      }}
                                      placeholder="Child Rate"
                                    />
                                  </td>
                                  <td>
                                    <Button
                                      variant="danger"
                                      size="sm"
                                      onClick={() => {
                                        const newRates =
                                          formData.compulsorySupplymentsRateDTO.filter(
                                            (r) =>
                                              !(
                                                r.hotelRoomcategoryId ===
                                                  rate.hotelRoomcategoryId &&
                                                r.ocuppancytypeId ===
                                                  rate.ocuppancytypeId
                                              )
                                          );
                                        setFormData({
                                          ...formData,
                                          compulsorySupplymentsRateDTO: newRates,
                                        });
                                      }}
                                    >
                                      Remove
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </Table>
                        <Button
                          size="sm"
                          onClick={() =>
                            setFormData({
                              ...formData,
                              compulsorySupplymentsRateDTO: [
                                ...formData.compulsorySupplymentsRateDTO,
                                {
                                  supplymentrateId: "",
                                  hotelRoomcategoryId: room.roomCategoryId,
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
                      </div>
                    ))}
                  </div>

                  {/* Validity Periods Section in a box */}
                  <h5 className="mt-3">Validity Periods</h5>
                  <div className="mb-3 p-3 border rounded bg-light">
                    <Table striped bordered hover responsive>
                      <thead>
                        <tr>
                          <th>Validity From</th>
                          <th>Validity To</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.compulsorySupplyValidityDTO.map(
                          (validity, idx) => {
                            // Calculate min date for validityTo (one day after validityFrom)
                            let minToDate = "";
                            if (validity.validityFrom) {
                              const fromDate = new Date(validity.validityFrom);
                              fromDate.setDate(fromDate.getDate() + 1);
                              minToDate = fromDate.toISOString().split("T")[0];
                            }
                            return (
                              <tr key={idx}>
                                <td>
                                  <Form.Control
                                    type="date"
                                    value={validity.validityFrom}
                                    onChange={(e) => {
                                      const newValidity = [
                                        ...formData.compulsorySupplyValidityDTO,
                                      ];
                                      newValidity[idx].validityFrom =
                                        e.target.value;
                                      // If validityTo is before new validityFrom, reset validityTo
                                      if (
                                        newValidity[idx].validityTo &&
                                        newValidity[idx].validityTo <=
                                          e.target.value
                                      ) {
                                        newValidity[idx].validityTo = "";
                                      }
                                      setFormData({
                                        ...formData,
                                        compulsorySupplyValidityDTO: newValidity,
                                      });
                                    }}
                                  />
                                </td>
                                <td>
                                  <Form.Control
                                    type="date"
                                    value={validity.validityTo}
                                    min={minToDate}
                                    onChange={(e) => {
                                      const newValidity = [
                                        ...formData.compulsorySupplyValidityDTO,
                                      ];
                                      newValidity[idx].validityTo =
                                        e.target.value;
                                      setFormData({
                                        ...formData,
                                        compulsorySupplyValidityDTO: newValidity,
                                      });
                                    }}
                                  />
                                </td>
                                <td>
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
                                </td>
                              </tr>
                            );
                          }
                        )}
                      </tbody>
                    </Table>
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
                  </div>
                </Form>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button
                  variant="success"
                  onClick={() => {
                    if (editEvent) {
                      handleEdit(); // Update case
                    } else {
                      handleSave(); // Create case
                    }
                  }}
                >
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