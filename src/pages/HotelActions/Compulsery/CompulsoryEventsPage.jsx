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
  Card,
  Pagination,
} from "react-bootstrap";
import { FaArrowLeft, FaPlus, FaEdit, FaTrash, FaCopy } from "react-icons/fa";
import axiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";
import Sidebar from "../../../components/Sidebar";
import Topbar from "../../../components/TopBar";
import Select from "react-select";

const CompulsoryEventsPage = () => {
  const { id } = useParams(); // hotelId
  const navigate = useNavigate();

  // Helper function to convert date from DD-MM-YYYY to YYYY-MM-DD
  const convertDateFormat = (dateString) => {
    if (!dateString) return "";
    const parts = dateString.split("-");
    if (parts.length === 3) {
      const [day, month, year] = parts;
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
    return dateString;
  };

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [marketTypes, setMarketTypes] = useState([]);
  const [masterOccupancies, setMasterOccupancy] = useState([]);
  const [hotelRoomsData, setHotelRoomsData] = useState([]);
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editEvent, setEditEvent] = useState(null);

  // Search + pagination
  const [searchTerm, setSearchTerm] = useState("");
  const itemsPerPage = 8;
  const [currentPage, setCurrentPage] = useState(1);

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
    validityFrom: "",
    validityTo: "",
  });

  // Fetch compulsory events
  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(`/api/compulsoryEvent`);
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
      validityFrom: "",
      validityTo: "",
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
          ? event.compulsorySupplymentsRateDTO.map(rate => ({
              ...rate,
              uniqueId: rate.uniqueId || Date.now() + Math.random()
            }))
          : [
              {
                supplymentrateId: "",
                hotelRoomcategoryId: "",
                ocuppancytypeId: "",
                rate: "",
                rateAdult: "",
                rateChild: "",
                uniqueId: Date.now() + Math.random(),
              },
            ],
      compulsorySupplyValidityDTO:
        event.compulsorySupplyValidityDTO?.length > 0
          ? event.compulsorySupplyValidityDTO.map(validity => ({
              ...validity,
              validityFrom: validity.validityFrom ? convertDateFormat(validity.validityFrom) : "",
              validityTo: validity.validityTo ? convertDateFormat(validity.validityTo) : ""
            }))
          : [{ supplymentValidityId: "", validityFrom: "", validityTo: "" }],
    });
    setFormErrors({
      supplymentCode: "",
      supplyments: "",
      marketypeIds: "",
      validityFrom: "",
      validityTo: "",
    });
    setShowModal(true);
  };

  // Open modal for copy
  const openCopy = (event) => {
    setEditEvent(null); // Set to null for create mode
    setFormData({
      supplymentId: "", // Clear ID for new record
      supplymentCode: event.supplymentCode ? `${event.supplymentCode}_COPY` : "",
      supplyments: event.supplyments || "",
      marketypeIds: event.marketypeIds || [],
      compulsorySupplymentsRateDTO:
        event.compulsorySupplymentsRateDTO?.length > 0
          ? event.compulsorySupplymentsRateDTO.map(rate => ({
              ...rate,
              supplymentrateId: "", // Clear ID for new record
              uniqueId: Date.now() + Math.random(), // New unique ID for copy
            }))
          : [
              {
                supplymentrateId: "",
                hotelRoomcategoryId: "",
                ocuppancytypeId: "",
                rate: "",
                rateAdult: "",
                rateChild: "",
                uniqueId: Date.now() + Math.random(),
              },
            ],
      compulsorySupplyValidityDTO:
        event.compulsorySupplyValidityDTO?.length > 0
          ? event.compulsorySupplyValidityDTO.map(validity => ({
              ...validity,
              supplymentValidityId: "", // Clear ID for new record
              validityFrom: validity.validityFrom ? convertDateFormat(validity.validityFrom) : "",
              validityTo: validity.validityTo ? convertDateFormat(validity.validityTo) : ""
            }))
          : [{ supplymentValidityId: "", validityFrom: "", validityTo: "" }],
    });
    setFormErrors({
      supplymentCode: "",
      supplyments: "",
      marketypeIds: "",
      validityFrom: "",
      validityTo: "",
    });
    setShowModal(true);
  };

  // Handle delete
  const handleDelete = (event) => {
    Swal.fire({
      title: `Are you sure? You want to delete ${event.supplyments}`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
      customClass: {
        popup: "swal-small",
        title: "swal-small-title",
        htmlContainer: "swal-small-text",
      },
    }).then((result) => {
      if (result.isConfirmed) {
        axiosInstance
          .delete(`/api/compulsoryEvent/${event.supplymentId}`)
          .then(() => {
            toast.success("Event deleted successfully");
            fetchEvents();
          })
          .catch(() => {
            toast.error("Sorry!! Event not deleted");
          });
      }
    });
  };

  // Validate form data
  const validateForm = () => {
    const errors = {
      supplymentCode: "",
      supplyments: "",
      marketypeIds: "",
      validityFrom: "",
      validityTo: "",
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

    // Validate only the first validity period
    if (formData.compulsorySupplyValidityDTO.length === 0) {
      errors.validityFrom = "At least one validity period is required";
      errors.validityTo = "At least one validity period is required";
      isValid = false;
    } else {
      const firstValidity = formData.compulsorySupplyValidityDTO[0];
      if (!firstValidity.validityFrom) {
        errors.validityFrom = "Validity From is required";
        isValid = false;
      }
      if (!firstValidity.validityTo) {
        errors.validityTo = "Validity To is required";
        isValid = false;
      }
      if (firstValidity.validityFrom && firstValidity.validityTo) {
        const fromDate = new Date(firstValidity.validityFrom);
        const toDate = new Date(firstValidity.validityTo);
        if (toDate <= fromDate) {
          errors.validityTo = "Validity To must be after Validity From";
          isValid = false;
        }
      }
    }

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
            supplymentValidityId: validity.supplymentValidityId || null,
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
        supplymentId: null,
        supplymentCode: formData.supplymentCode,
        supplyments: formData.supplyments,
        hotelId: parseInt(id),
        marketypeIds: formData.marketypeIds.map(Number),
        compulsorySupplymentsRateDTO: formData.compulsorySupplymentsRateDTO
          .filter(rate => 
            rate.hotelRoomcategoryId && 
            rate.hotelRoomcategoryId !== "" && 
            parseInt(rate.hotelRoomcategoryId) > 0
          )
          .map((rate) => ({
            supplymentrateId: rate.supplymentrateId || null,
            hotelRoomcategoryId: parseInt(rate.hotelRoomcategoryId),
            ocuppancytypeId: parseInt(rate.ocuppancytypeId) || 0,
            rate: parseFloat(rate.rate) || 0,
            rateAdult: parseFloat(rate.rateAdult) || 0,
            rateChild: parseFloat(rate.rateChild) || 0,
          })),
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
            supplymentValidityId: validity.supplymentValidityId || null,
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
        supplymentId: editEvent?.supplymentId || null,
        supplymentCode: formData.supplymentCode,
        supplyments: formData.supplyments,
        hotelId: parseInt(id),
        marketypeIds: formData.marketypeIds.map(Number),
        compulsorySupplymentsRateDTO: formData.compulsorySupplymentsRateDTO
          .filter(rate => 
            rate.hotelRoomcategoryId && 
            rate.hotelRoomcategoryId !== "" && 
            parseInt(rate.hotelRoomcategoryId) > 0
          )
          .map((rate) => ({
            supplymentrateId: rate.supplymentrateId || null,
            hotelRoomcategoryId: parseInt(rate.hotelRoomcategoryId),
            ocuppancytypeId: parseInt(rate.ocuppancytypeId) || 0,
            rate: parseFloat(rate.rate) || 0,
            rateAdult: parseFloat(rate.rateAdult) || 0,
            rateChild: parseFloat(rate.rateChild) || 0,
          })),
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

  // ---- Search & Pagination derived data ----
  const filteredEvents = events.filter((ev) =>
    ev.supplyments?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredEvents.length / itemsPerPage) || 1;
  const currentData = filteredEvents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePageChange = (pageNumber) => {
    if (pageNumber < 1 || pageNumber > totalPages) return;
    setCurrentPage(pageNumber);
  };

  // reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, events.length]);

  // ---- UI ----
  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Container fluid className="px-0">
            <Card className="shadow-sm border-0 rounded-4">
              {/* ================= Header ================= */}
              <Card.Header className="bg-white border-bottom py-3 px-4 d-flex align-items-center justify-content-between">
                <div className="fw-semibold fs-6 text-dark">
                  Compulsory Events / Supplements
                </div>

                <div className="d-flex align-items-center gap-2 flex-grow-1 justify-content-end">
                  <div
                    className="position-relative"
                    style={{
                      width: "260px",
                      maxWidth: "100%",
                      marginRight: "270px",
                    }}
                  >
                    <Form.Control
                      type="text"
                      placeholder="Search supplements..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="rounded-pill ps-3 text-dark"
                      style={{
                        fontSize: "0.9rem",
                        height: "38px",
                        borderColor: "#dee2e6",
                      }}
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        className="btn btn-link position-absolute top-50 end-0 translate-middle-y"
                        style={{
                          border: "none",
                          background: "none",
                          color: "#6c757d",
                          padding: "0 10px",
                          fontSize: "1rem",
                        }}
                        onClick={() => {
                          setSearchTerm("");
                          setCurrentPage(1);
                        }}
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    )}
                  </div>

                  <Button
                    className="ms-2 btn-green rounded-pill px-4 fw-semibold"
                    onClick={handleCreate}
                    style={{
                      fontSize: "0.9rem",
                      height: "38px",
                      lineHeight: "1.2",
                    }}
                  >
                    + Create
                  </Button>
                </div>
              </Card.Header>

              {/* ================= Table ================= */}
              <Card.Body className="p-0">
                <Table
                  responsive
                  hover
                  striped
                  className="mb-0 align-middle text-center"
                >
                  <thead className="table-light align-middle">
                    <tr>
                      <th style={{ width: "80px" }}>S/N</th>
                      <th>Supplement Code</th>
                      <th>Tagline</th>
                      <th>Status</th>
                      <th style={{ width: "160px" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="text-center py-5 text-muted">
                          <Spinner
                            animation="border"
                            size="sm"
                            className="me-2"
                          />
                          Loading events...
                        </td>
                      </tr>
                    ) : currentData.length > 0 ? (
                      currentData.map((ev, idx) => (
                        <tr
                          key={ev.supplymentId}
                          style={{
                            backgroundColor:
                              idx % 2 === 0 ? "#f9f9f9" : "#ffffff",
                          }}
                        >
                          <td>{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                          <td className="text-capitalize">
                            {ev.supplymentCode}
                          </td>
                          <td className="text-capitalize">{ev.supplyments}</td>
                          <td>
                            <Badge
                              bg="success"
                              className="px-3 py-2 rounded-pill fw-normal"
                            >
                              Active
                            </Badge>
                          </td>
                          <td>
                            <div className="d-flex justify-content-center gap-3">
                              <FaCopy
                                className="text-info"
                                style={{ cursor: "pointer", fontSize: "18px" }}
                                onClick={() => openCopy(ev)}
                                title="Copy"
                              />
                              <FaEdit
                                className="text-warning"
                                style={{ cursor: "pointer", fontSize: "18px" }}
                                onClick={() => openEdit(ev)}
                                title="Edit"
                              />
                              <FaTrash
                                className="text-danger"
                                style={{ cursor: "pointer", fontSize: "18px" }}
                                onClick={() => handleDelete(ev)}
                                title="Delete"
                              />
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="text-center py-5 text-muted">
                          No events found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </Table>

                {/* ================= Pagination ================= */}
                {filteredEvents.length > itemsPerPage && (
                  <div className="d-flex justify-content-between align-items-center p-3 border-top bg-white rounded-bottom-4">
                    <small className="text-muted">
                      Showing{" "}
                      <strong>{(currentPage - 1) * itemsPerPage + 1}</strong> to{" "}
                      <strong>
                        {Math.min(currentPage * itemsPerPage, filteredEvents.length)}
                      </strong>{" "}
                      of <strong>{filteredEvents.length}</strong> events
                    </small>
                    <Pagination className="mb-0">
                      <Pagination.Prev
                        disabled={currentPage === 1}
                        onClick={() => handlePageChange(currentPage - 1)}
                      />
                      {[...Array(totalPages)].map((_, i) => (
                        <Pagination.Item
                          key={i}
                          active={currentPage === i + 1}
                          onClick={() => handlePageChange(i + 1)}
                        >
                          {i + 1}
                        </Pagination.Item>
                      ))}
                      <Pagination.Next
                        disabled={currentPage === totalPages}
                        onClick={() => handlePageChange(currentPage + 1)}
                      />
                    </Pagination>
                  </div>
                )}
              </Card.Body>
            </Card>

            {/* ================= Modal ================= */}
            <Modal
              show={showModal}
              onHide={() => {}} // Prevent closing on outside click
              centered
              size="lg"
              backdrop="static"
              keyboard={false}
            >
              <Modal.Header className="bg-primary text-white">
                <Modal.Title>
                  {editEvent ? "Edit Compulsory Event" : "Create Compulsory Event"}
                </Modal.Title>
                <Button
                  variant="link"
                  className="text-white p-0 ms-auto"
                  onClick={() => {
                    setShowModal(false);
                    setFormErrors({
                      supplymentCode: "",
                      supplyments: "",
                      marketypeIds: "",
                      validityFrom: "",
                      validityTo: "",
                    });
                  }}
                  style={{ fontSize: '1.5rem', textDecoration: 'none' }}
                >
                  ×
                </Button>
              </Modal.Header>
              <Modal.Body>
                <Form>
                  <Row className="mb-3">
                    <Col md={4}>
                      <Form.Group>
                        <Form.Label className="fw-semibold small">
                          Supplement Code <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                          type="text"
                          value={formData.supplymentCode}
                          onChange={(e) => {
                            setFormData({
                              ...formData,
                              supplymentCode: e.target.value,
                            });
                            if (formErrors.supplymentCode) {
                              setFormErrors(prev => ({ ...prev, supplymentCode: "" }));
                            }
                          }}
                          placeholder="Enter code"
                          className={`rounded-3 ${formErrors.supplymentCode ? 'is-invalid' : ''}`}
                        />
                        {formErrors.supplymentCode && (
                          <div className="invalid-feedback">{formErrors.supplymentCode}</div>
                        )}
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group>
                        <Form.Label className="fw-semibold small">
                          Tagline <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                          type="text"
                          value={formData.supplyments}
                          onChange={(e) => {
                            setFormData({
                              ...formData,
                              supplyments: e.target.value,
                            });
                            if (formErrors.supplyments) {
                              setFormErrors(prev => ({ ...prev, supplyments: "" }));
                            }
                          }}
                          placeholder="Enter tagline"
                          className={`rounded-3 ${formErrors.supplyments ? 'is-invalid' : ''}`}
                        />
                        {formErrors.supplyments && (
                          <div className="invalid-feedback">{formErrors.supplyments}</div>
                        )}
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group>
                        <Form.Label className="fw-semibold small">
                          Market Type <span className="text-danger">*</span>
                        </Form.Label>
                        <Select
                          isMulti
                          options={marketTypes.map((m) => ({
                            value: m.marketTypeId,
                            label: m.name,
                          }))}
                          value={marketTypes
                            .filter((m) =>
                              formData.marketypeIds.includes(m.marketTypeId)
                            )
                            .map((m) => ({
                              value: m.marketTypeId,
                              label: m.name,
                            }))}
                          onChange={(selected) => {
                            setFormData({
                              ...formData,
                              marketypeIds: selected.map((s) => s.value),
                            });
                            if (formErrors.marketypeIds) {
                              setFormErrors(prev => ({ ...prev, marketypeIds: "" }));
                            }
                          }}
                          className={formErrors.marketypeIds ? 'is-invalid' : ''}
                        />
                        {formErrors.marketypeIds && (
                          <div className="invalid-feedback">{formErrors.marketypeIds}</div>
                        )}
                      </Form.Group>
                    </Col>
                  </Row>

                  {/* Rates Section */}
                  <h5 className="mt-3">Rates</h5>
                  <div className="mb-3 p-3 border rounded bg-light">
                    {hotelRoomsData.map((room, roomIdx) => (
                      <div key={roomIdx} className="mb-4">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                          <h6 className="fw-bold text-primary mb-0">
                            {room.roomCategory?.toUpperCase() || "CATEGORY"}
                          </h6>
                          <Button
                            size="sm"
                            variant="success"
                            onClick={() => {
                              const newRate = {
                                supplymentrateId: "",
                                hotelRoomcategoryId: room.rommCategoryId || room.roomCategoryId,
                                ocuppancytypeId: "",
                                rate: "",
                                rateAdult: "",
                                rateChild: "",
                                uniqueId: Date.now() + Math.random(), // Add unique identifier
                              };
                              setFormData({
                                ...formData,
                                compulsorySupplymentsRateDTO: [
                                  ...formData.compulsorySupplymentsRateDTO,
                                  newRate,
                                ],
                              });
                              // toast.success("Rate added successfully");
                            }}
                          >
                            + Add Rate
                          </Button>
                        </div>

                        {/* Room Type Details */}
                        {room.roomTypeDetailsDTOs && room.roomTypeDetailsDTOs.length > 0 && (
                          <div className="mb-3">
                            <small className="text-muted">
                              <strong>Room Types:</strong> {room.roomTypeDetailsDTOs.map(rt => rt.roomTypeName).join(", ")}
                            </small>
                          </div>
                        )}

                        <Table striped bordered hover responsive className="mt-2">
                          <thead className="table-white">
                            <tr>
                              <th>Occupancy Type</th>
                              <th>Rate</th>
                              <th>Adult Rate</th>
                              <th>Child Rate</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {formData.compulsorySupplymentsRateDTO
                              .filter(
                                (rate) =>
                                  Number(rate.hotelRoomcategoryId) ===
                                  Number(room.rommCategoryId || room.roomCategoryId)
                              )
                              .map((rate, idx) => (
                                <tr key={idx}>
                                  <td>
                                    <Form.Select
                                      value={rate.ocuppancytypeId}
                                      onChange={(e) => {
                                        const newRates = [...formData.compulsorySupplymentsRateDTO];
                                        const targetIdx = newRates.findIndex(
                                          (r) =>
                                            r.hotelRoomcategoryId === rate.hotelRoomcategoryId &&
                                            r.ocuppancytypeId === rate.ocuppancytypeId
                                        );
                                        if (targetIdx > -1) {
                                          newRates[targetIdx].ocuppancytypeId = e.target.value;
                                        } else {
                                          newRates[idx].ocuppancytypeId = e.target.value;
                                        }
                                        setFormData({
                                          ...formData,
                                          compulsorySupplymentsRateDTO: newRates,
                                        });
                                      }}
                                    >
                                      <option value="">Select Occupancy Type</option>
                                      {room.occupancyDetailsDTOs?.map((occupancy) => (
                                        <option
                                          key={occupancy.id}
                                          value={occupancy.id}
                                        >
                                          {occupancy.occupanyType}
                                        </option>
                                      ))}
                                    </Form.Select>
                                  </td>
                                  <td>
                                    <Form.Control
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={rate.rate}
                                      onChange={(e) => {
                                        const newRates = [...formData.compulsorySupplymentsRateDTO];
                                        const targetIdx = newRates.findIndex(
                                          (r) =>
                                            r.hotelRoomcategoryId === rate.hotelRoomcategoryId &&
                                            r.ocuppancytypeId === rate.ocuppancytypeId
                                        );
                                        if (targetIdx > -1) newRates[targetIdx].rate = e.target.value;
                                        else newRates[idx].rate = e.target.value;
                                        setFormData({
                                          ...formData,
                                          compulsorySupplymentsRateDTO: newRates,
                                        });
                                      }}
                                      placeholder="0.00"
                                    />
                                  </td>
                                  <td>
                                    <Form.Control
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={rate.rateAdult}
                                      onChange={(e) => {
                                        const newRates = [...formData.compulsorySupplymentsRateDTO];
                                        const targetIdx = newRates.findIndex(
                                          (r) =>
                                            r.hotelRoomcategoryId === rate.hotelRoomcategoryId &&
                                            r.ocuppancytypeId === rate.ocuppancytypeId
                                        );
                                        if (targetIdx > -1) newRates[targetIdx].rateAdult = e.target.value;
                                        else newRates[idx].rateAdult = e.target.value;
                                        setFormData({
                                          ...formData,
                                          compulsorySupplymentsRateDTO: newRates,
                                        });
                                      }}
                                      placeholder="0.00"
                                    />
                                  </td>
                                  <td>
                                    <Form.Control
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={rate.rateChild}
                                      onChange={(e) => {
                                        const newRates = [...formData.compulsorySupplymentsRateDTO];
                                        const targetIdx = newRates.findIndex(
                                          (r) =>
                                            r.hotelRoomcategoryId === rate.hotelRoomcategoryId &&
                                            r.ocuppancytypeId === rate.ocuppancytypeId
                                        );
                                        if (targetIdx > -1) newRates[targetIdx].rateChild = e.target.value;
                                        else newRates[idx].rateChild = e.target.value;
                                        setFormData({
                                          ...formData,
                                          compulsorySupplymentsRateDTO: newRates,
                                        });
                                      }}
                                      placeholder="0.00"
                                    />
                                  </td>
                                  <td>
                                    <Button
                                      variant="danger"
                                      size="sm"
                                      onClick={() => {
                                        // Remove rate by unique identifier
                                        const newRates = formData.compulsorySupplymentsRateDTO.filter(
                                          (r) => r.uniqueId !== rate.uniqueId
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
                            {formData.compulsorySupplymentsRateDTO.filter(
                              (rate) =>
                                Number(rate.hotelRoomcategoryId) ===
                                Number(room.rommCategoryId || room.roomCategoryId)
                            ).length === 0 && (
                              <tr>
                                <td colSpan={5} className="text-center text-muted py-3">
                                  No rates added for this room category. Click "Add Rate" to add rates.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </Table>
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
                                      newValidity[idx].validityFrom = e.target.value;
                                      // If validityTo is before new validityFrom, reset validityTo
                                      if (newValidity[idx].validityTo && newValidity[idx].validityTo <= e.target.value) {
                                        newValidity[idx].validityTo = "";
                                      }
                                      setFormData({
                                        ...formData,
                                        compulsorySupplyValidityDTO: newValidity,
                                      });
                                      // Clear error when user starts typing
                                      if (idx === 0 && formErrors.validityFrom) {
                                        setFormErrors(prev => ({ ...prev, validityFrom: "" }));
                                      }
                                    }}
                                    className={idx === 0 && formErrors.validityFrom ? 'is-invalid' : ''}
                                  />
                                  {idx === 0 && formErrors.validityFrom && (
                                    <div className="invalid-feedback">{formErrors.validityFrom}</div>
                                  )}
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
                                      newValidity[idx].validityTo = e.target.value;
                                      setFormData({
                                        ...formData,
                                        compulsorySupplyValidityDTO: newValidity,
                                      });
                                      // Clear error when user starts typing
                                      if (idx === 0 && formErrors.validityTo) {
                                        setFormErrors(prev => ({ ...prev, validityTo: "" }));
                                      }
                                    }}
                                    className={idx === 0 && formErrors.validityTo ? 'is-invalid' : ''}
                                  />
                                  {idx === 0 && formErrors.validityTo && (
                                    <div className="invalid-feedback">{formErrors.validityTo}</div>
                                  )}
                                </td>
                                <td>
                                  <Button
                                    variant="danger"
                                    size="sm"
                                    onClick={() => {
                                      const newValidity = formData.compulsorySupplyValidityDTO.filter(
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
                <Button
                  variant="outline-secondary"
                  className="px-4 rounded-pill"
                  onClick={() => {
                    setShowModal(false);
                    setFormErrors({
                      supplymentCode: "",
                      supplyments: "",
                      marketypeIds: "",
                      validityFrom: "",
                      validityTo: "",
                    });
                  }}
                >
                  ✖ Cancel
                </Button>
                <Button
                  variant="success"
                  className="px-4 rounded-pill"
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
