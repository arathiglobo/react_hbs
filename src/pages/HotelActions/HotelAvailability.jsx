import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  Card,
  Button,
  Table,
  Modal,
  Form,
  Row,
  Col,
  Badge,
  Pagination,
  Tabs,
  Tab,
} from "react-bootstrap";
import { FaEdit, FaEye, FaTrash } from "react-icons/fa";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";
import axiosInstance from "../../components/AxiosInstance";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";

const HotelAvailability = () => {
  const { id } = useParams();

  // State for data
  const [items, setItems] = useState([]);
  const [marketTypes, setMarketTypes] = useState([]);
  const [roomCategories, setRoomCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // State for modal
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isViewMode, setIsViewMode] = useState(false);

  // State for form data
  const [formData, setFormData] = useState({
    marketTypeId: "",
    roomCategoryId: "",
    totalRooms: "",
    type: "Free-Sale", // Free-Sale, Pre Buy, Room Allocation
    validityList: [
      {
        validityFrom: "",
        validityTo: "",
      },
    ],
  });

  // State for validation
  const [validationErrors, setValidationErrors] = useState({});

  // State for pagination and search
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");
  const [searchTimeout, setSearchTimeout] = useState(null);

  // State for live status modal
  const [showLiveStatusModal, setShowLiveStatusModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  // State for tabs
  const [activeTab, setActiveTab] = useState("availability");

  // State for Block Checkin Checkout
  const [blockItems, setBlockItems] = useState([]);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [editingBlock, setEditingBlock] = useState(null);
  const [isViewModeBlock, setIsViewModeBlock] = useState(false);
  const [formDataBlock, setFormDataBlock] = useState({
    marketTypeId: "",
    type: "CheckIn", // CheckIn or CheckOut
    validityList: [{ validityFrom: "", validityTo: "" }],
  });
  const [validationErrorsBlock, setValidationErrorsBlock] = useState({});

  // State for Stop Sale
  const [stopSaleItems, setStopSaleItems] = useState([]);
  const [showStopSaleModal, setShowStopSaleModal] = useState(false);
  const [editingStopSale, setEditingStopSale] = useState(null);
  const [isViewModeStopSale, setIsViewModeStopSale] = useState(false);
  const [formDataStopSale, setFormDataStopSale] = useState({
    marketTypeId: "",
    roomCategoryId: "",
    type: "Room Allocation", // Room Allocation, Block, Free-Sale
    validityList: [{ validityFrom: "", validityTo: "" }],
  });
  const [validationErrorsStopSale, setValidationErrorsStopSale] = useState({});

  // Load market types and room categories
  useEffect(() => {
    loadMarketTypes();
    loadRoomCategories();
    fetchAvailabilityList();
  }, []);

  // Search functionality
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    const timeout = setTimeout(() => {
      fetchAvailabilityList(0, search);
    }, 500);
    setSearchTimeout(timeout);
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [search]);

  const loadMarketTypes = async () => {
    try {
      const response = await axiosInstance.get("/api/marketType");
      setMarketTypes(response.data || []);
    } catch (error) {
      console.error("Failed to load market types:", error);
      toast.error("Failed to load market types");
    }
  };

  const loadRoomCategories = async () => {
    try {
      const response = await axiosInstance.get(`/api/hotelRoomDetailsController/${id}`);
      console.log("Hotel Rooms Data:", response.data);
      setRoomCategories(response.data || []);
    } catch (error) {
      console.error("Failed to load room categories:", error);
      toast.error("Failed to load room categories");
    }
  };

  const fetchAvailabilityList = async (pageNum = 0, searchTerm = search) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: "10",
      });
      if (searchTerm && searchTerm.trim()) {
        params.append("search", searchTerm.trim());
      }
      const response = await axiosInstance.get(`/api/hotels/${id}/availabilities`, {
        params,
      });
      if (response.data && Array.isArray(response.data)) {
        setItems(response.data);
        if (response.data.length < 10) {
          setTotalPages(pageNum + 1);
        } else {
          setTotalPages(Math.max(totalPages, pageNum + 2));
        }
        setPage(pageNum);
      } else {
        setItems([]);
        setTotalPages(0);
        setPage(0);
      }
    } catch (error) {
      console.error("Failed to load availability list:", error);
      toast.error("Failed to load availability list");
      setItems([]);
      setTotalPages(0);
      setPage(0);
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingItem(null);
    setIsViewMode(false);
    setFormData({
      marketTypeId: "",
      roomCategoryId: "",
      totalRooms: "",
      type: "Free-Sale",
      validityList: [
        {
          validityFrom: "",
          validityTo: "",
        },
      ],
    });
    setValidationErrors({});
    setShowModal(true);
  };

  const openEditModal = async (item) => {
    try {
      setIsLoading(true);
      const response = await axiosInstance.get(
        `/api/hotels/${id}/availabilities/${item.id}`
      );
      const data = response.data;

      setEditingItem(data);
      setIsViewMode(false);
      setFormData({
        marketTypeId: data.marketTypeId || "",
        roomCategoryId: data.roomCategoryId || "",
        totalRooms: data.totalRooms || "",
        type: data.type || "Free-Sale",
        validityList: data.validityList || [
          {
            validityFrom: "",
            validityTo: "",
          },
        ],
      });
      setValidationErrors({});
      setShowModal(true);
    } catch (error) {
      console.error("Failed to load availability for edit:", error);
      toast.error("Failed to load availability data for editing");
    } finally {
      setIsLoading(false);
    }
  };

  const openViewModal = async (item) => {
    try {
      setIsLoading(true);
      const response = await axiosInstance.get(
        `/api/hotels/${id}/availabilities/${item.id}`
      );
      const data = response.data;

      setEditingItem(data);
      setIsViewMode(true);
      setFormData({
        marketTypeId: data.marketTypeId || "",
        roomCategoryId: data.roomCategoryId || "",
        totalRooms: data.totalRooms || "",
        type: data.type || "Free-Sale",
        validityList: data.validityList || [
          {
            validityFrom: "",
            validityTo: "",
          },
        ],
      });
      setValidationErrors({});
      setShowModal(true);
    } catch (error) {
      console.error("Failed to load availability for view:", error);
      toast.error("Failed to load availability data for viewing");
    } finally {
      setIsLoading(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingItem(null);
    setIsViewMode(false);
    setFormData({
      marketTypeId: "",
      roomCategoryId: "",
      totalRooms: "",
      type: "Free-Sale",
      validityList: [
        {
          validityFrom: "",
          validityTo: "",
        },
      ],
    });
    setValidationErrors({});
  };

  const validateForm = (data) => {
    const newErrors = {};
    
    if (!data.marketTypeId) newErrors.marketTypeId = "Market Type is required";
    if (!data.roomCategoryId) newErrors.roomCategoryId = "Room Category is required";
    if (!data.totalRooms || data.totalRooms <= 0) newErrors.totalRooms = "Total Rooms must be greater than 0";
    if (!data.type) newErrors.type = "Type is required";
    
    if (!data.validityList || data.validityList.length === 0) {
      newErrors.validityList = "At least one validity period is required";
    } else {
      data.validityList.forEach((period, index) => {
        if (!period.validityFrom) {
          newErrors[`validityFrom_${index}`] = `Validity From is required for period ${index + 1}`;
        }
        if (!period.validityTo) {
          newErrors[`validityTo_${index}`] = `Validity To is required for period ${index + 1}`;
        }
      });
    }
    
    return newErrors;
  };

  const saveAvailability = async (e) => {
    e.preventDefault();
    const errors = validateForm(formData);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    try {
      setIsLoading(true);
      const payload = {
        hotelId: id,
        type: formData.type,
        marketTypeId: formData.marketTypeId,
        roomCategoryId: formData.roomCategoryId,
        totalRooms: Number(formData.totalRooms),
        validityList: formData.validityList.map((period) => ({
          validityFrom: period.validityFrom,
          validityTo: period.validityTo,
        })),
      };

      console.log("Save Availability Payload:", payload);
      const response = await axiosInstance.post(
        `/api/hotels/${id}/availabilities`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data) {
        toast.success("Hotel Availability created successfully!");
        setValidationErrors({});
        await fetchAvailabilityList(page, search);
        closeModal();
      }
    } catch (error) {
      console.error("Save availability error:", error);
      toast.error(
        `Failed to save availability: ${
          error.response?.data?.message || error.message
        }`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const updateAvailability = async () => {
    const errors = validateForm(formData);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    if (!editingItem) return;

    try {
      setIsLoading(true);
      const payload = {
        hotelId: id,
        type: formData.type,
        marketTypeId: formData.marketTypeId,
        roomCategoryId: formData.roomCategoryId,
        totalRooms: Number(formData.totalRooms),
        validityList: formData.validityList.map((period) => ({
          validityFrom: period.validityFrom,
          validityTo: period.validityTo,
        })),
      };

      console.log("Update Availability Payload:", payload);
      const response = await axiosInstance.put(
        `/api/hotels/${id}/availabilities/${editingItem.id}`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data) {
        toast.success("Hotel Availability updated successfully!");
        setValidationErrors({});
        await fetchAvailabilityList(page, search);
        closeModal();
      }
    } catch (error) {
      console.error("Update availability error:", error);
      toast.error(
        `Failed to update availability: ${
          error.response?.data?.message || error.message
        }`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = (item) => {
    Swal.fire({
      title: "Are you sure?",
      text: `You want to delete this availability record`,
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
          .delete(`/api/hotels/${id}/availabilities/${item.id}`)
          .then(() => {
            toast.success("Availability deleted successfully");
            fetchAvailabilityList(page, search);
          })
          .catch(() => {
            toast.error("Failed to delete availability");
          });
      }
    });
  };

  const addValidityPeriod = () => {
    setFormData({
      ...formData,
      validityList: [
        ...formData.validityList,
        {
          validityFrom: "",
          validityTo: "",
        },
      ],
    });
  };

  const removeValidityPeriod = (index) => {
    if (formData.validityList.length > 1) {
      const newValidityList = formData.validityList.filter((_, i) => i !== index);
      setFormData({
        ...formData,
        validityList: newValidityList,
      });
    }
  };

  const resetForm = () => {
    setFormData({
      marketTypeId: "",
      roomCategoryId: "",
      totalRooms: "",
      type: "Free-Sale",
      validityList: [
        {
          validityFrom: "",
          validityTo: "",
        },
      ],
    });
    setValidationErrors({});
  };

  const handleLiveStatus = async (item) => {
    setSelectedItem(item);
    setShowLiveStatusModal(true);
  };

  const confirmLiveStatusChange = async () => {
    if (!selectedItem) return;
    try {
      setIsLoading(true);
      const payload = {
        isLive: !selectedItem.isLive,
      };
      const res = await axiosInstance.patch(
        `/api/hotels/${id}/availabilities/${selectedItem.id}/status`,
        payload
      );
      toast.success(
        `Availability ${
          selectedItem.isLive ? "deactivated" : "activated"
        } successfully`
      );
      await fetchAvailabilityList(page, search);
      setShowLiveStatusModal(false);
      setSelectedItem(null);
    } catch (error) {
      console.error("Error updating live status:", error);
      toast.error(
        `Failed to update status: ${
          error.response?.data?.message || error.message
        }`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const closeLiveStatusModal = () => {
    setShowLiveStatusModal(false);
    setSelectedItem(null);
  };

  const handleTabSelect = (key) => {
    setActiveTab(key);
  };

  // Block Checkin Checkout functions
  const openCreateBlock = () => {
    setEditingBlock(null);
    setIsViewModeBlock(false);
    setFormDataBlock({
      marketTypeId: "",
      type: "CheckIn",
      validityList: [{ validityFrom: "", validityTo: "" }],
    });
    setValidationErrorsBlock({});
    setShowBlockModal(true);
  };

  const closeBlockModal = () => {
    setShowBlockModal(false);
    setEditingBlock(null);
    setIsViewModeBlock(false);
    setFormDataBlock({
      marketTypeId: "",
      type: "CheckIn",
      validityList: [{ validityFrom: "", validityTo: "" }],
    });
    setValidationErrorsBlock({});
  };

  const addBlockValidityPeriod = () => {
    setFormDataBlock({
      ...formDataBlock,
      validityList: [...formDataBlock.validityList, { validityFrom: "", validityTo: "" }],
    });
  };

  const removeBlockValidityPeriod = (index) => {
    if (formDataBlock.validityList.length > 1) {
      const newValidityList = formDataBlock.validityList.filter((_, i) => i !== index);
      setFormDataBlock({ ...formDataBlock, validityList: newValidityList });
    }
  };

  // Stop Sale functions
  const openCreateStopSale = () => {
    setEditingStopSale(null);
    setIsViewModeStopSale(false);
    setFormDataStopSale({
      marketTypeId: "",
      roomCategoryId: "",
      type: "Room Allocation",
      validityList: [{ validityFrom: "", validityTo: "" }],
    });
    setValidationErrorsStopSale({});
    setShowStopSaleModal(true);
  };

  const closeStopSaleModal = () => {
    setShowStopSaleModal(false);
    setEditingStopSale(null);
    setIsViewModeStopSale(false);
    setFormDataStopSale({
      marketTypeId: "",
      roomCategoryId: "",
      type: "Room Allocation",
      validityList: [{ validityFrom: "", validityTo: "" }],
    });
    setValidationErrorsStopSale({});
  };

  const addStopSaleValidityPeriod = () => {
    setFormDataStopSale({
      ...formDataStopSale,
      validityList: [...formDataStopSale.validityList, { validityFrom: "", validityTo: "" }],
    });
  };

  const removeStopSaleValidityPeriod = (index) => {
    if (formDataStopSale.validityList.length > 1) {
      const newValidityList = formDataStopSale.validityList.filter((_, i) => i !== index);
      setFormDataStopSale({ ...formDataStopSale, validityList: newValidityList });
    }
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <h3>Hotel Availability</h3>
          <Tabs
            activeKey={activeTab}
            onSelect={handleTabSelect}
            id="availability-tabs"
            className="mb-3"
          >
            <Tab eventKey="availability" title="Hotel Availability">
              <Card className="shadow-sm rounded-xl mb-3">
                <Card.Header className="d-flex justify-content-between align-items-center text-white">
                  <span className="fw-semibold cursor-pointer text-primary" style={{ padding: "10px" }}>
                    Hotel Availability
                  </span>
                  <Form.Group className="hotel-search-bar position-relative">
                    <Form.Control
                      type="text"
                      placeholder="Search availability..."
                      className="form-control-modern-sm"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </Form.Group>
                  <Button
                    className="btn-green create-btn"
                    onClick={openCreateModal}
                  >
                    + Create
                  </Button>
                </Card.Header>
                <Card.Body className="p-0">

              <Table striped bordered hover responsive className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th style={{ width: 100 }}>S/N</th>
                    <th>Market Type</th>
                    <th>Room Category</th>
                    <th>Total Rooms</th>
                    <th>Type</th>
                     <th>Status</th>
                    <th style={{ width: 160 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                      {items.map((item, index) => (
                        <tr key={item.id}>
                          <td>{index + 1 + page * 10}</td>
                          <td>{item.marketName || item.marketTypeName}</td>
                          <td>{item.roomCategoryName || item.roomCategory}</td>
                          <td>{item.totalRooms}</td>
                          <td>
                            <Badge
                              bg={
                                item.type === "Free-Sale"
                                  ? "success"
                                  : item.type === "Pre Buy"
                                  ? "info"
                                  : "warning"
                              }
                            >
                              {item.type}
                            </Badge>
                          </td>
                          <td>
                            {item.isLive ? (
                              <Badge
                                bg="danger"
                                style={{ cursor: "pointer" }}
                                onClick={() => handleLiveStatus(item)}
                              >
                                Inactive
                              </Badge>
                            ) : (
                              <Badge
                                bg="success"
                                style={{ cursor: "pointer" }}
                                onClick={() => handleLiveStatus(item)}
                              >
                                Active
                              </Badge>
                            )}
                          </td>
                      <td>
                        <div className="d-flex gap-2">
                          <FaEdit
                            className="text-primary"
                            style={{ cursor: "pointer", fontSize: "18px" }}
                            onClick={() => openEditModal(item)}
                            title="Edit"
                          />
                          <FaEye
                            className="text-info"
                            style={{ cursor: "pointer", fontSize: "18px" }}
                            onClick={() => openViewModal(item)}
                            title="View"
                          />
                          <FaTrash
                            className="text-danger"
                            style={{ cursor: "pointer", fontSize: "18px" }}
                            onClick={() => handleDelete(item)}
                            title="Delete"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {isLoading && (
                    <tr>
                      <td
                        colSpan={8}
                        className="text-center text-muted py-4"
                      >
                        <div
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                        >
                          <span className="visually-hidden">
                            Loading...
                          </span>
                        </div>
                        Loading availability records...
                      </td>
                    </tr>
                  )}
                  {items.length === 0 && !isLoading && (
                    <tr>
                      <td
                        colSpan={8}
                        className="text-center text-muted py-4"
                      >
                        No availability records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>

              {totalPages > 1 && (
                <div className="d-flex justify-content-between align-items-center p-3 border-top">
                  <div>
                    <small className="text-muted">
                      Showing {items.length > 0 ? page * 10 + 1 : 0} to{" "}
                      {page * 10 + items.length} of {totalPages * 10} entries
                    </small>
                  </div>
                  <div>
                    <Pagination className="mb-0">
                      <Pagination.Prev
                        disabled={page === 0}
                        onClick={() => fetchAvailabilityList(page - 1, search)}
                      />
                      {[...Array(totalPages)].map((_, i) => (
                        <Pagination.Item
                          key={i}
                          active={i === page}
                          onClick={() => fetchAvailabilityList(i, search)}
                        >
                          {i + 1}
                        </Pagination.Item>
                      ))}
                      <Pagination.Next
                        disabled={page === totalPages - 1}
                        onClick={() => fetchAvailabilityList(page + 1, search)}
                      />
                    </Pagination>
                  </div>
                </div>
              )}
                </Card.Body>
              </Card>
            </Tab>
            <Tab eventKey="block-checkin" title="Block Checkin Checkout">
              <Card className="shadow-sm rounded-xl mb-3">
                <Card.Header className="d-flex justify-content-between align-items-center text-white">
                  <span className="fw-semibold cursor-pointer text-primary" style={{ padding: "10px" }}>
                    Block Checkin Checkout
                  </span>
                  <Form.Group className="hotel-search-bar position-relative">
                    <Form.Control
                      type="text"
                      placeholder="Search block checkin..."
                      className="form-control-modern-sm"
                    />
                  </Form.Group>
                  <Button
                    className="btn-green create-btn"
                    onClick={openCreateBlock}
                  >
                    + Create
                  </Button>
                </Card.Header>
                <Card.Body className="p-0">
                  <Table striped bordered hover responsive className="mb-0 align-middle">
                    <thead>
                      <tr>
                        <th style={{ width: 100 }}>S/N</th>
                        <th>Market</th>
                        <th>Block</th>
                        <th>Status</th>
                        <th style={{ width: 160 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {blockItems.map((item, index) => (
                        <tr key={item.id}>
                          <td>{index + 1}</td>
                          <td>{item.marketName || item.marketTypeName}</td>
                          <td>
                            <Badge
                              bg={item.type === "CheckIn" ? "success" : "info"}
                            >
                              {item.type}
                            </Badge>
                          </td>
                          <td>
                            <Badge bg={item.isActive ? "success" : "danger"}>
                              {item.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </td>
                          <td>
                            <div className="d-flex gap-2">
                              <FaEdit
                                className="text-primary"
                                style={{ cursor: "pointer", fontSize: "18px" }}
                                title="Edit"
                              />
                              <FaEye
                                className="text-info"
                                style={{ cursor: "pointer", fontSize: "18px" }}
                                title="View"
                              />
                              <FaTrash
                                className="text-danger"
                                style={{ cursor: "pointer", fontSize: "18px" }}
                                title="Delete"
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                      {blockItems.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center text-muted py-4">
                            No block checkin records found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            </Tab>
            <Tab eventKey="stop-sale" title="Stop Sale">
              <Card className="shadow-sm rounded-xl mb-3">
                <Card.Header className="d-flex justify-content-between align-items-center text-white">
                  <span className="fw-semibold cursor-pointer text-primary" style={{ padding: "10px" }}>
                    Stop Sale
                  </span>
                  <Form.Group className="hotel-search-bar position-relative">
                    <Form.Control
                      type="text"
                      placeholder="Search stop sale..."
                      className="form-control-modern-sm"
                    />
                  </Form.Group>
                  <Button
                    className="btn-green create-btn"
                    onClick={openCreateStopSale}
                  >
                    + Create
                  </Button>
                </Card.Header>
                <Card.Body className="p-0">
                  <Table striped bordered hover responsive className="mb-0 align-middle">
                    <thead>
                      <tr>
                        <th style={{ width: 100 }}>S/N</th>
                        <th>Market</th>
                        <th>Room Category</th>
                        <th>Stop Sale</th>
                        <th>Status</th>
                        <th style={{ width: 160 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stopSaleItems.map((item, index) => (
                        <tr key={item.id}>
                          <td>{index + 1}</td>
                          <td>{item.marketName || item.marketTypeName}</td>
                          <td>{item.roomCategoryName || item.roomCategory}</td>
                          <td>
                            <Badge
                              bg={
                                item.type === "Room Allocation"
                                  ? "primary"
                                  : item.type === "Block"
                                  ? "warning"
                                  : "info"
                              }
                            >
                              {item.type}
                            </Badge>
                          </td>
                          <td>
                            <Badge bg={item.isActive ? "success" : "danger"}>
                              {item.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </td>
                          <td>
                            <div className="d-flex gap-2">
                              <FaEdit
                                className="text-primary"
                                style={{ cursor: "pointer", fontSize: "18px" }}
                                title="Edit"
                              />
                              <FaEye
                                className="text-info"
                                style={{ cursor: "pointer", fontSize: "18px" }}
                                title="View"
                              />
                              <FaTrash
                                className="text-danger"
                                style={{ cursor: "pointer", fontSize: "18px" }}
                                title="Delete"
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                      {stopSaleItems.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center text-muted py-4">
                            No stop sale records found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            </Tab>
          </Tabs>
        </main>
      </div>

      {/* Create/Edit/View Modal */}
      <Modal
        show={showModal}
        onHide={closeModal}
        centered
        size="lg"
        backdrop="static"
        keyboard={false}
      >
        <Modal.Header closeButton={!isLoading}>
          <Modal.Title>
            {isViewMode
              ? "View Hotel Availability"
              : editingItem
              ? "Update Hotel Availability"
              : "Create Hotel Availability"}
          </Modal.Title>
          <span className="text-muted small ms-auto">* mandatory fields</span>
        </Modal.Header>
        <Modal.Body>

          <Form>
            {/* Type Selection */}
            <Row className="mb-3">
              <Col md={12}>
                <Form.Group>
                  <Form.Label>Type <span className="text-danger">*</span></Form.Label>
                  <div className="d-flex gap-3">
                    <Form.Check
                      type="radio"
                      label="Free-Sale"
                      name="type"
                      value="Free-Sale"
                      checked={formData.type === "Free-Sale"}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          type: e.target.value,
                        })
                      }
                      disabled={isViewMode}
                    />
                    <Form.Check
                      type="radio"
                      label="Pre Buy"
                      name="type"
                      value="Pre Buy"
                      checked={formData.type === "Pre Buy"}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          type: e.target.value,
                        })
                      }
                      disabled={isViewMode}
                    />
                    <Form.Check
                      type="radio"
                      label="Room Allocation"
                      name="type"
                      value="Room Allocation"
                      checked={formData.type === "Room Allocation"}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          type: e.target.value,
                        })
                      }
                      disabled={isViewMode}
                    />
                  </div>
                </Form.Group>
              </Col>
            </Row>

            {/* Main Fields */}
            <Row className="mb-3">
              <Col md={4}>
                <Form.Group>
                  <Form.Label>
                    MarketType <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Select
                    value={formData.marketTypeId}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        marketTypeId: e.target.value,
                      })
                    }
                    disabled={isViewMode}
                    isInvalid={!!validationErrors.marketTypeId}
                  >
                    <option value="">SELECT</option>
                    {marketTypes.map((market) => (
                      <option key={market.marketTypeId} value={market.marketTypeId}>
                        {market.name || market.marketTypeName}
                      </option>
                    ))}
                  </Form.Select>
                  {validationErrors.marketTypeId && (
                    <Form.Control.Feedback type="invalid">
                      {validationErrors.marketTypeId}
                    </Form.Control.Feedback>
                  )}
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>
                    Room Category <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Select
                    value={formData.roomCategoryId}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        roomCategoryId: e.target.value,
                      })
                    }
                    disabled={isViewMode}
                    isInvalid={!!validationErrors.roomCategoryId}
                  >
                    <option value="">SELECT</option>
                    {roomCategories.map((category) => (
                      <option key={category.rommCategoryId} value={category.rommCategoryId}>
                        {category.roomCategory}
                      </option>
                    ))}
                  </Form.Select>
                  {validationErrors.roomCategoryId && (
                    <Form.Control.Feedback type="invalid">
                      {validationErrors.roomCategoryId}
                    </Form.Control.Feedback>
                  )}
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>
                    Total Rooms <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    type="number"
                    value={formData.totalRooms}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        totalRooms: e.target.value,
                      })
                    }
                    disabled={isViewMode}
                    isInvalid={!!validationErrors.totalRooms}
                  />
                  {validationErrors.totalRooms && (
                    <Form.Control.Feedback type="invalid">
                      {validationErrors.totalRooms}
                    </Form.Control.Feedback>
                  )}
                </Form.Group>
              </Col>
            </Row>

            {/* Validity List */}
            <Card className="mb-3">
              <Card.Header>Validity List</Card.Header>
              <Card.Body>
                {formData.validityList.map((period, index) => (
                  <Row key={index} className="mb-3">
                    <Col md={5}>
                      <Form.Group>
                        <Form.Label>
                          Validity From <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                          type="datetime-local"
                          value={period.validityFrom || ""}
                          onChange={(e) => {
                            const newValidityList = [...formData.validityList];
                            newValidityList[index].validityFrom = e.target.value;
                            setFormData({
                              ...formData,
                              validityList: newValidityList,
                            });
                          }}
                          disabled={isViewMode}
                          isInvalid={!!validationErrors[`validityFrom_${index}`]}
                        />
                        {validationErrors[`validityFrom_${index}`] && (
                          <Form.Control.Feedback type="invalid">
                            {validationErrors[`validityFrom_${index}`]}
                          </Form.Control.Feedback>
                        )}
                      </Form.Group>
                    </Col>
                    <Col md={5}>
                      <Form.Group>
                        <Form.Label>
                          Validity To <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                          type="datetime-local"
                          value={period.validityTo || ""}
                          onChange={(e) => {
                            const newValidityList = [...formData.validityList];
                            newValidityList[index].validityTo = e.target.value;
                            setFormData({
                              ...formData,
                              validityList: newValidityList,
                            });
                          }}
                          disabled={isViewMode}
                          isInvalid={!!validationErrors[`validityTo_${index}`]}
                        />
                        {validationErrors[`validityTo_${index}`] && (
                          <Form.Control.Feedback type="invalid">
                            {validationErrors[`validityTo_${index}`]}
                          </Form.Control.Feedback>
                        )}
                      </Form.Group>
                    </Col>
                    {!isViewMode && formData.validityList.length > 1 && (
                      <Col md={2} className="d-flex align-items-end pb-2">
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => removeValidityPeriod(index)}
                        >
                          <FaTrash size={10} />
                        </Button>
                      </Col>
                    )}
                  </Row>
                ))}
                {!isViewMode && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={addValidityPeriod}
                    className="mb-3"
                  >
                    + Add Validity
                  </Button>
                )}
              </Card.Body>
            </Card>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={closeModal}
            disabled={isLoading}
          >
            {isViewMode ? "Close" : "Cancel"}
          </Button>
          {!isViewMode && (
            <Button
              variant="primary"
              onClick={editingItem ? updateAvailability : saveAvailability}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  ></span>
                  {editingItem ? "Updating..." : "Saving..."}
                </>
              ) : editingItem ? (
                "Update"
              ) : (
                "Save"
              )}
            </Button>
          )}
          {!isViewMode && (
            <Button variant="info" onClick={resetForm}>
              <i className="fas fa-refresh me-2"></i>
              Reset
            </Button>
          )}
        </Modal.Footer>
      </Modal>

      {/* Live Status Modal */}
      <Modal
        show={showLiveStatusModal}
        onHide={closeLiveStatusModal}
        centered
        size="sm"
        backdrop="static"
        keyboard={false}
      >
        <Modal.Header closeButton={!isLoading}>
          <Modal.Title>Confirm Status Change</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Are you sure you want to{" "}
            {selectedItem?.isLive ? "deactivate" : "activate"} this
            availability?
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={closeLiveStatusModal}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={confirmLiveStatusChange}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                  aria-hidden="true"
                ></span>
                Processing...
              </>
            ) : (
              "Confirm"
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Block Checkin Checkout Modal */}
      <Modal
        show={showBlockModal}
        onHide={closeBlockModal}
        centered
        size="lg"
        backdrop="static"
        keyboard={false}
      >
        <Modal.Header closeButton={!isLoading}>
          <Modal.Title>
            {isViewModeBlock
              ? "View Hotel Block Checkin Checkout"
              : editingBlock
              ? "Update Hotel Block Checkin Checkout"
              : "Create Hotel Block Checkin Checkout"}
          </Modal.Title>
          <span className="text-muted small ms-auto">* mandatory fields</span>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    MarketType <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Select
                    value={formDataBlock.marketTypeId}
                    onChange={(e) =>
                      setFormDataBlock({
                        ...formDataBlock,
                        marketTypeId: e.target.value,
                      })
                    }
                    disabled={isViewModeBlock}
                    isInvalid={!!validationErrorsBlock.marketTypeId}
                  >
                    <option value="">SELECT</option>
                    {marketTypes.map((market) => (
                      <option key={market.marketTypeId} value={market.marketTypeId}>
                        {market.name || market.marketTypeName}
                      </option>
                    ))}
                  </Form.Select>
                  {validationErrorsBlock.marketTypeId && (
                    <Form.Control.Feedback type="invalid">
                      {validationErrorsBlock.marketTypeId}
                    </Form.Control.Feedback>
                  )}
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    Type <span className="text-danger">*</span>
                  </Form.Label>
                  <div className="d-flex gap-3">
                    <Form.Check
                      type="radio"
                      label="CheckIn"
                      name="type"
                      value="CheckIn"
                      checked={formDataBlock.type === "CheckIn"}
                      onChange={(e) =>
                        setFormDataBlock({ ...formDataBlock, type: e.target.value })
                      }
                      disabled={isViewModeBlock}
                    />
                    <Form.Check
                      type="radio"
                      label="CheckOut"
                      name="type"
                      value="CheckOut"
                      checked={formDataBlock.type === "CheckOut"}
                      onChange={(e) =>
                        setFormDataBlock({ ...formDataBlock, type: e.target.value })
                      }
                      disabled={isViewModeBlock}
                    />
                  </div>
                </Form.Group>
              </Col>
            </Row>

            {/* Validity List */}
            <Card className="mb-3">
              <Card.Header>Validity List</Card.Header>
              <Card.Body>
                {formDataBlock.validityList.map((period, index) => (
                  <Row key={index} className="mb-3">
                    <Col md={5}>
                      <Form.Group>
                        <Form.Label>
                          Validity From <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                          type="datetime-local"
                          value={period.validityFrom || ""}
                          onChange={(e) => {
                            const newValidityList = [...formDataBlock.validityList];
                            newValidityList[index].validityFrom = e.target.value;
                            setFormDataBlock({
                              ...formDataBlock,
                              validityList: newValidityList,
                            });
                          }}
                          disabled={isViewModeBlock}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={5}>
                      <Form.Group>
                        <Form.Label>
                          Validity To <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                          type="datetime-local"
                          value={period.validityTo || ""}
                          onChange={(e) => {
                            const newValidityList = [...formDataBlock.validityList];
                            newValidityList[index].validityTo = e.target.value;
                            setFormDataBlock({
                              ...formDataBlock,
                              validityList: newValidityList,
                            });
                          }}
                          disabled={isViewModeBlock}
                        />
                      </Form.Group>
                    </Col>
                    {!isViewModeBlock && formDataBlock.validityList.length > 1 && (
                      <Col md={2} className="d-flex align-items-end pb-2">
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => removeBlockValidityPeriod(index)}
                        >
                          <FaTrash size={10} />
                        </Button>
                      </Col>
                    )}
                  </Row>
                ))}
                {!isViewModeBlock && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={addBlockValidityPeriod}
                    className="mb-3"
                  >
                    + Add Validity
                  </Button>
                )}
              </Card.Body>
            </Card>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={closeBlockModal}
            disabled={isLoading}
          >
            {isViewModeBlock ? "Close" : "Cancel"}
          </Button>
          {!isViewModeBlock && (
            <Button
              variant="primary"
              onClick={() => {
                // TODO: Implement save functionality
                toast.success("Block Checkin Checkout created successfully!");
                closeBlockModal();
              }}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  ></span>
                  Creating...
                </>
              ) : (
                "Create"
              )}
            </Button>
          )}
          {!isViewModeBlock && (
            <Button
              variant="info"
              onClick={() => {
                setFormDataBlock({
                  marketTypeId: "",
                  type: "CheckIn",
                  validityList: [{ validityFrom: "", validityTo: "" }],
                });
                setValidationErrorsBlock({});
              }}
            >
              <i className="fas fa-refresh me-2"></i>
              Reset
            </Button>
          )}
        </Modal.Footer>
      </Modal>

      {/* Stop Sale Modal */}
      <Modal
        show={showStopSaleModal}
        onHide={closeStopSaleModal}
        centered
        size="lg"
        backdrop="static"
        keyboard={false}
      >
        <Modal.Header closeButton={!isLoading}>
          <Modal.Title>
            {isViewModeStopSale
              ? "View Hotel Stop Sale"
              : editingStopSale
              ? "Update Hotel Stop Sale"
              : "Create Hotel Stop Sale"}
          </Modal.Title>
          <span className="text-muted small ms-auto">* mandatory fields</span>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    MarketType <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Select
                    value={formDataStopSale.marketTypeId}
                    onChange={(e) =>
                      setFormDataStopSale({
                        ...formDataStopSale,
                        marketTypeId: e.target.value,
                      })
                    }
                    disabled={isViewModeStopSale}
                    isInvalid={!!validationErrorsStopSale.marketTypeId}
                  >
                    <option value="">SELECT</option>
                    {marketTypes.map((market) => (
                      <option key={market.marketTypeId} value={market.marketTypeId}>
                        {market.name || market.marketTypeName}
                      </option>
                    ))}
                  </Form.Select>
                  {validationErrorsStopSale.marketTypeId && (
                    <Form.Control.Feedback type="invalid">
                      {validationErrorsStopSale.marketTypeId}
                    </Form.Control.Feedback>
                  )}
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    Room Category <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Select
                    value={formDataStopSale.roomCategoryId}
                    onChange={(e) =>
                      setFormDataStopSale({
                        ...formDataStopSale,
                        roomCategoryId: e.target.value,
                      })
                    }
                    disabled={isViewModeStopSale}
                    isInvalid={!!validationErrorsStopSale.roomCategoryId}
                  >
                    <option value="">SELECT</option>
                    {roomCategories.map((category) => (
                      <option key={category.rommCategoryId} value={category.rommCategoryId}>
                        {category.roomCategory}
                      </option>
                    ))}
                  </Form.Select>
                  {validationErrorsStopSale.roomCategoryId && (
                    <Form.Control.Feedback type="invalid">
                      {validationErrorsStopSale.roomCategoryId}
                    </Form.Control.Feedback>
                  )}
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={12}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    Type <span className="text-danger">*</span>
                  </Form.Label>
                  <div className="d-flex gap-3">
                    <Form.Check
                      type="radio"
                      label="Room Allocation"
                      name="type"
                      value="Room Allocation"
                      checked={formDataStopSale.type === "Room Allocation"}
                      onChange={(e) =>
                        setFormDataStopSale({ ...formDataStopSale, type: e.target.value })
                      }
                      disabled={isViewModeStopSale}
                    />
                    <Form.Check
                      type="radio"
                      label="Block"
                      name="type"
                      value="Block"
                      checked={formDataStopSale.type === "Block"}
                      onChange={(e) =>
                        setFormDataStopSale({ ...formDataStopSale, type: e.target.value })
                      }
                      disabled={isViewModeStopSale}
                    />
                    <Form.Check
                      type="radio"
                      label="Free-Sale"
                      name="type"
                      value="Free-Sale"
                      checked={formDataStopSale.type === "Free-Sale"}
                      onChange={(e) =>
                        setFormDataStopSale({ ...formDataStopSale, type: e.target.value })
                      }
                      disabled={isViewModeStopSale}
                    />
                  </div>
                </Form.Group>
              </Col>
            </Row>

            {/* Validity List */}
            <Card className="mb-3">
              <Card.Header>Validity List</Card.Header>
              <Card.Body>
                {formDataStopSale.validityList.map((period, index) => (
                  <Row key={index} className="mb-3">
                    <Col md={5}>
                      <Form.Group>
                        <Form.Label>
                          Validity From <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                          type="datetime-local"
                          value={period.validityFrom || ""}
                          onChange={(e) => {
                            const newValidityList = [...formDataStopSale.validityList];
                            newValidityList[index].validityFrom = e.target.value;
                            setFormDataStopSale({
                              ...formDataStopSale,
                              validityList: newValidityList,
                            });
                          }}
                          disabled={isViewModeStopSale}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={5}>
                      <Form.Group>
                        <Form.Label>
                          Validity To <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                          type="datetime-local"
                          value={period.validityTo || ""}
                          onChange={(e) => {
                            const newValidityList = [...formDataStopSale.validityList];
                            newValidityList[index].validityTo = e.target.value;
                            setFormDataStopSale({
                              ...formDataStopSale,
                              validityList: newValidityList,
                            });
                          }}
                          disabled={isViewModeStopSale}
                        />
                      </Form.Group>
                    </Col>
                    {!isViewModeStopSale && formDataStopSale.validityList.length > 1 && (
                      <Col md={2} className="d-flex align-items-end pb-2">
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => removeStopSaleValidityPeriod(index)}
                        >
                          <FaTrash size={10} />
                        </Button>
                      </Col>
                    )}
                  </Row>
                ))}
                {!isViewModeStopSale && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={addStopSaleValidityPeriod}
                    className="mb-3"
                  >
                    + Add Validity
                  </Button>
                )}
              </Card.Body>
            </Card>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={closeStopSaleModal}
            disabled={isLoading}
          >
            {isViewModeStopSale ? "Close" : "Cancel"}
          </Button>
          {!isViewModeStopSale && (
            <Button
              variant="primary"
              onClick={() => {
                // TODO: Implement save functionality
                toast.success("Stop Sale created successfully!");
                closeStopSaleModal();
              }}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  ></span>
                  Creating...
                </>
              ) : (
                "Create"
              )}
            </Button>
          )}
          {!isViewModeStopSale && (
            <Button
              variant="info"
              onClick={() => {
                setFormDataStopSale({
                  marketTypeId: "",
                  roomCategoryId: "",
                  type: "Room Allocation",
                  validityList: [{ validityFrom: "", validityTo: "" }],
                });
                setValidationErrorsStopSale({});
              }}
            >
              <i className="fas fa-refresh me-2"></i>
              Reset
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default HotelAvailability;