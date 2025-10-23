import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
import { FaArrowLeft, FaEdit, FaEye, FaTrash } from "react-icons/fa";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";
import axiosInstance from "../../../components/AxiosInstance";
import Sidebar from "../../../components/Sidebar";
import Topbar from "../../../components/TopBar";

const HotelAvailability = () => {
  const { id } = useParams();
  const navigate = useNavigate();

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
    hotelRoomId: "",
    noOfRooms: "",
    releaseDay: "",
    availabilityType: "FREE_SALE", // FREE_SALE, PRE_BUY, ROOM_ALLOCATION
    availabilityValidities: [
      {
        validityFrom: "",
        validityTo: "",
      },
    ],
    checkinAllowedDays: [
      "SUNDAY",
      "MONDAY",
      "TUESDAY",
      "WEDNESDAY",
      "THURSDAY",
      "FRIDAY",
      "SATURDAY",
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
  const [isLoadingBlock, setIsLoadingBlock] = useState(false);
  const [pageBlock, setPageBlock] = useState(0);
  const [totalPagesBlock, setTotalPagesBlock] = useState(0);
  const [searchBlock, setSearchBlock] = useState("");

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
  const [isLoadingStopSale, setIsLoadingStopSale] = useState(false);
  const [pageStopSale, setPageStopSale] = useState(0);
  const [totalPagesStopSale, setTotalPagesStopSale] = useState(0);
  const [searchStopSale, setSearchStopSale] = useState("");

  // Load market types and room categories
  useEffect(() => {
    loadMarketTypes();
    loadRoomCategories();
    fetchAvailabilityList();
    fetchBlockList();
    fetchStopSaleList();
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

  // Block search functionality
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    const timeout = setTimeout(() => {
      fetchBlockList(0, searchBlock);
    }, 500);
    setSearchTimeout(timeout);
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchBlock]);

  // Stop Sale search functionality
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    const timeout = setTimeout(() => {
      fetchStopSaleList(0, searchStopSale);
    }, 500);
    setSearchTimeout(timeout);
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchStopSale]);

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
      const response = await axiosInstance.get(
        `/api/hotelRoomDetailsController/${id}`
      );
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
      const response = await axiosInstance.get(
        `/api/hotels/${id}/availabilities`,
        {
          params,
        }
      );
      if (response.data && Array.isArray(response.data)) {
        console.log("Hotel Availability API Response:", response.data);
        setItems(response.data);
        if (response.data.length < 10) {
          setTotalPages(pageNum + 1);
        } else {
          setTotalPages(Math.max(totalPages, pageNum + 2));
        }
        setPage(pageNum);
      } else {
        console.log(
          "Hotel Availability API Response (no data):",
          response.data
        );
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
      hotelRoomId: "",
      noOfRooms: "",
      releaseDay: "",
      availabilityType: "FREE_SALE",
      availabilityValidities: [
        {
          validityFrom: "",
          validityTo: "",
        },
      ],
      checkinAllowedDays: [
        "SUNDAY",
        "MONDAY",
        "TUESDAY",
        "WEDNESDAY",
        "THURSDAY",
        "FRIDAY",
        "SATURDAY",
      ],
    });
    setValidationErrors({});
    setShowModal(true);
  };

  const openEditModal = async (item) => {
    console.log("Opening edit modal for item:", item);
    try {
      setIsLoading(true);
      const response = await axiosInstance.get(
        `/api/hotels/${id}/availabilities/${item.availabilityId}`
      );
      const data = response.data;

      setEditingItem(data);
      setIsViewMode(false);
      setFormData({
        marketTypeId: data.marketTypeId || "",
        hotelRoomId: data.hotelRoomId || "",
        noOfRooms: data.noOfRooms || "",
        releaseDay: data.releaseDay || "",
        availabilityType: data.availabilityType || "FREE_SALE",
        availabilityValidities: data.availabilityValidities || [
          {
            validityFrom: "",
            validityTo: "",
          },
        ],
        checkinAllowedDays: data.checkinAllowedDays || [
          "SUNDAY",
          "MONDAY",
          "TUESDAY",
          "WEDNESDAY",
          "THURSDAY",
          "FRIDAY",
          "SATURDAY",
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
        `/api/hotels/${id}/availabilities/${item.availabilityId}`
      );
      const data = response.data;

      setEditingItem(data);
      setIsViewMode(true);
      setFormData({
        marketTypeId: data.marketTypeId || "",
        hotelRoomId: data.hotelRoomId || "",
        noOfRooms: data.noOfRooms || "",
        releaseDay: data.releaseDay || "",
        availabilityType: data.availabilityType || "FREE_SALE",
        availabilityValidities: data.availabilityValidities || [
          {
            validityFrom: "",
            validityTo: "",
          },
        ],
        checkinAllowedDays: data.checkinAllowedDays || [
          "SUNDAY",
          "MONDAY",
          "TUESDAY",
          "WEDNESDAY",
          "THURSDAY",
          "FRIDAY",
          "SATURDAY",
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
      hotelRoomId: "",
      noOfRooms: "",
      releaseDay: "",
      availabilityType: "FREE_SALE",
      availabilityValidities: [
        {
          validityFrom: "",
          validityTo: "",
        },
      ],
      checkinAllowedDays: [
        "SUNDAY",
        "MONDAY",
        "TUESDAY",
        "WEDNESDAY",
        "THURSDAY",
        "FRIDAY",
        "SATURDAY",
      ],
    });
    setValidationErrors({});
  };

  const validateForm = (data) => {
    const newErrors = {};

    if (!data.marketTypeId) newErrors.marketTypeId = "Market Type is required";
    if (!data.hotelRoomId) newErrors.hotelRoomId = "Room Category is required";
    if (!data.noOfRooms || data.noOfRooms <= 0)
      newErrors.noOfRooms = "Number of Rooms must be greater than 0";
    if (!data.releaseDay || data.releaseDay < 0)
      newErrors.releaseDay = "Release Day must be 0 or greater";
    if (!data.availabilityType)
      newErrors.availabilityType = "Availability Type is required";

    if (
      !data.availabilityValidities ||
      data.availabilityValidities.length === 0
    ) {
      newErrors.availabilityValidities =
        "At least one validity period is required";
    } else {
      data.availabilityValidities.forEach((period, index) => {
        if (!period.validityFrom) {
          newErrors[
            `validityFrom_${index}`
          ] = `Validity From is required for period ${index + 1}`;
        }
        if (!period.validityTo) {
          newErrors[
            `validityTo_${index}`
          ] = `Validity To is required for period ${index + 1}`;
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
        marketTypeId: formData.marketTypeId,
        hotelRoomId: formData.hotelRoomId,
        noOfRooms: Number(formData.noOfRooms),
        releaseDay: Number(formData.releaseDay),
        availabilityType: formData.availabilityType,
        availabilityValidities: formData.availabilityValidities.map(
          (period) => ({
            validityFrom: period.validityFrom,
            validityTo: period.validityTo,
          })
        ),
        checkinAllowedDays: formData.checkinAllowedDays,
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

    console.log("Editing Item:", editingItem);

    try {
      setIsLoading(true);
      const payload = {
        hotelId: Number(id),
        marketTypeId: Number(formData.marketTypeId),
        hotelRoomId: Number(formData.hotelRoomId),
        noOfRooms: Number(formData.noOfRooms),
        releaseDay: Number(formData.releaseDay),
        availabilityType: formData.availabilityType,
        availabilityValidities: formData.availabilityValidities.map(
          (period) => ({
            validityFrom: period.validityFrom,
            validityTo: period.validityTo,
          })
        ),
        checkinAllowedDays: formData.checkinAllowedDays,
      };

      console.log("Update Availability Payload:", payload);
      console.log("Editing Item ID:", editingItem.id);
      console.log("Hotel ID:", id);
      console.log(
        "API Endpoint:",
        `/api/hotels/${id}/availabilities/${editingItem.id}`
      );
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
      console.error("Error response:", error.response);
      console.error("Error status:", error.response?.status);
      console.error("Error data:", error.response?.data);
      toast.error(
        `Failed to update availability: ${
          error.response?.data?.message ||
          error.response?.data?.error ||
          error.message
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
          .delete(`/api/hotels/${id}/availabilities/${item.availabilityId}`)
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
      availabilityValidities: [
        ...formData.availabilityValidities,
        {
          validityFrom: "",
          validityTo: "",
        },
      ],
    });
  };

  const removeValidityPeriod = (index) => {
    if (formData.availabilityValidities.length > 1) {
      const newValidityList = formData.availabilityValidities.filter(
        (_, i) => i !== index
      );
      setFormData({
        ...formData,
        availabilityValidities: newValidityList,
      });
    }
  };

  const resetForm = () => {
    setFormData({
      marketTypeId: "",
      hotelRoomId: "",
      noOfRooms: "",
      releaseDay: "",
      availabilityType: "FREE_SALE",
      availabilityValidities: [
        {
          validityFrom: "",
          validityTo: "",
        },
      ],
      checkinAllowedDays: [
        "SUNDAY",
        "MONDAY",
        "TUESDAY",
        "WEDNESDAY",
        "THURSDAY",
        "FRIDAY",
        "SATURDAY",
      ],
    });
    setValidationErrors({});
  };

  const handleLiveStatus = async (item) => {
    setSelectedItem(item);
    setShowLiveStatusModal(true);
  };

  const confirmLiveStatusChange = async () => {
    console.log("=== CONFIRM LIVE STATUS CHANGE ===");
    console.log("Toggling live status for:", selectedItem);
    console.log("Current status:", selectedItem?.status);
    console.log("Hotel ID from params:", id);
    console.log("Availability ID:", selectedItem?.availabilityId);

    if (!selectedItem) {
      console.error("No selected item found!");
      return;
    }

    try {
      setIsLoading(true);

      // Create payload matching the backend DTO structure
      const payload = {
        isLive: !selectedItem.status, // Toggle the current status
      };

      console.log("Sending payload:", payload);
      const res = await axiosInstance.patch(
        `/api/hotels/${id}/availabilities/${selectedItem.availabilityId}/status`,
        payload
      );

      console.log("✅ API call successful!");
      console.log("API response:", res.data);

      // Show success message based on the API response status
      if (res.data.isLive === true || res.data.isLive === "true") {
        toast.success("Availability activated successfully");
      } else {
        toast.success("Availability deactivated successfully");
      }

      // Refresh the availability list to show updated data
      await fetchAvailabilityList(page, search);
      setShowLiveStatusModal(false);
      setSelectedItem(null);
    } catch (error) {
      console.error("Error updating live status:", error);
      console.error("Error response:", error.response);
      console.error("Error status:", error.response?.status);
      console.error("Error data:", error.response?.data);

      // Handle different types of errors
      if (error.response?.status === 404) {
        toast.error("API endpoint not found. Please check the backend routes.");
      } else if (error.response?.status === 500) {
        toast.error("Server error. Please check the backend logs.");
      } else {
        toast.error(
          `Failed to update status: ${
            error.response?.data?.message || error.message
          }`
        );
      }
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

  const addBlockValidityPeriod = () => {
    setFormDataBlock({
      ...formDataBlock,
      validityList: [
        ...formDataBlock.validityList,
        { validityFrom: "", validityTo: "" },
      ],
    });
  };

  const removeBlockValidityPeriod = (index) => {
    if (formDataBlock.validityList.length > 1) {
      const newValidityList = formDataBlock.validityList.filter(
        (_, i) => i !== index
      );
      setFormDataBlock({ ...formDataBlock, validityList: newValidityList });
    }
  };

  const addStopSaleValidityPeriod = () => {
    setFormDataStopSale({
      ...formDataStopSale,
      validityList: [
        ...formDataStopSale.validityList,
        { validityFrom: "", validityTo: "" },
      ],
    });
  };

  const removeStopSaleValidityPeriod = (index) => {
    if (formDataStopSale.validityList.length > 1) {
      const newValidityList = formDataStopSale.validityList.filter(
        (_, i) => i !== index
      );
      setFormDataStopSale({
        ...formDataStopSale,
        validityList: newValidityList,
      });
    }
  };

  // Block Checkin Checkout CRUD Functions
  const fetchBlockList = async (pageNum = 0, searchTerm = searchBlock) => {
    setIsLoadingBlock(true);
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: "10",
      });
      if (searchTerm && searchTerm.trim()) {
        params.append("search", searchTerm.trim());
      }
      const response = await axiosInstance.get(
        `/api/hotels/${id}/blockCheckInCheckout`,
        {
          params,
        }
      );
      if (response.data && Array.isArray(response.data)) {
        setBlockItems(response.data);
        if (response.data.length < 10) {
          setTotalPagesBlock(pageNum + 1);
        } else {
          setTotalPagesBlock(Math.max(totalPagesBlock, pageNum + 2));
        }
        setPageBlock(pageNum);
      } else {
        setBlockItems([]);
        setTotalPagesBlock(0);
        setPageBlock(0);
      }
    } catch (error) {
      console.error("Failed to load block list:", error);
      toast.error("Failed to load block list");
      setBlockItems([]);
      setTotalPagesBlock(0);
      setPageBlock(0);
    } finally {
      setIsLoadingBlock(false);
    }
  };

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

  const openEditBlock = async (item) => {
    try {
      setIsLoadingBlock(true);
      const response = await axiosInstance.get(
        `/api/hotels/${id}/blockCheckInCheckout/${item.id}`
      );
      const data = response.data;

      setEditingBlock(data);
      setIsViewModeBlock(false);
      setFormDataBlock({
        marketTypeId: data.marketTypeId || "",
        type: data.isCheckin ? "CheckIn" : "CheckOut",
        validityList: data.validityList || [
          {
            validityFrom: "",
            validityTo: "",
          },
        ],
      });
      setValidationErrorsBlock({});
      setShowBlockModal(true);
    } catch (error) {
      console.error("Failed to load block for edit:", error);
      toast.error("Failed to load block data for editing");
    } finally {
      setIsLoadingBlock(false);
    }
  };

  const openViewBlock = async (item) => {
    try {
      setIsLoadingBlock(true);
      const response = await axiosInstance.get(
        `/api/hotels/${id}/blockCheckInCheckout/${item.id}`
      );
      const data = response.data;

      setEditingBlock(data);
      setIsViewModeBlock(true);
      setFormDataBlock({
        marketTypeId: data.marketTypeId || "",
        type: data.isCheckin ? "CheckIn" : "CheckOut",
        validityList: data.validityList || [
          {
            validityFrom: "",
            validityTo: "",
          },
        ],
      });
      setValidationErrorsBlock({});
      setShowBlockModal(true);
    } catch (error) {
      console.error("Failed to load block for view:", error);
      toast.error("Failed to load block data for viewing");
    } finally {
      setIsLoadingBlock(false);
    }
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

  const validateBlockForm = (data) => {
    const newErrors = {};

    if (!data.marketTypeId) newErrors.marketTypeId = "Market Type is required";
    if (!data.type) newErrors.type = "Type is required";

    if (!data.validityList || data.validityList.length === 0) {
      newErrors.validityList = "At least one validity period is required";
    } else {
      data.validityList.forEach((period, index) => {
        if (!period.validityFrom) {
          newErrors[
            `validityFrom_${index}`
          ] = `Validity From is required for period ${index + 1}`;
        }
        if (!period.validityTo) {
          newErrors[
            `validityTo_${index}`
          ] = `Validity To is required for period ${index + 1}`;
        }
      });
    }

    return newErrors;
  };

  const saveBlock = async (e) => {
    e.preventDefault();
    const errors = validateBlockForm(formDataBlock);
    if (Object.keys(errors).length > 0) {
      setValidationErrorsBlock(errors);
      return;
    }

    try {
      setIsLoadingBlock(true);
      const payload = {
        hotelId: Number(id),
        marketTypeId: Number(formDataBlock.marketTypeId),
        isCheckin: formDataBlock.type === "CheckIn",
        isCheckOut: formDataBlock.type === "CheckOut",
        validityList: formDataBlock.validityList.map((period) => ({
          validityFrom: period.validityFrom,
          validityTo: period.validityTo,
        })),
      };

      console.log("Save Block Payload:", payload);
      const response = await axiosInstance.post(
        `/api/hotels/${id}/blockCheckInCheckout`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data) {
        toast.success("Block Checkin Checkout created successfully!");
        setValidationErrorsBlock({});
        await fetchBlockList(pageBlock, searchBlock);
        closeBlockModal();
      }
    } catch (error) {
      console.error("Save block error:", error);
      toast.error(
        `Failed to save block: ${
          error.response?.data?.message || error.message
        }`
      );
    } finally {
      setIsLoadingBlock(false);
    }
  };

  const updateBlock = async () => {
    const errors = validateBlockForm(formDataBlock);
    if (Object.keys(errors).length > 0) {
      setValidationErrorsBlock(errors);
      return;
    }

    if (!editingBlock) return;

    try {
      setIsLoadingBlock(true);
      const payload = {
        hotelId: Number(id),
        marketTypeId: Number(formDataBlock.marketTypeId),
        isCheckin: formDataBlock.type === "CheckIn",
        isCheckOut: formDataBlock.type === "CheckOut",
        validityList: formDataBlock.validityList.map((period) => ({
          validityFrom: period.validityFrom,
          validityTo: period.validityTo,
        })),
      };
      console.log("editingBlock:", editingBlock);
      console.log("Update Block Payload:", payload);
      const response = await axiosInstance.put(
        `/api/hotels/${id}/blockCheckInCheckout/${editingBlock.id}`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data) {
        toast.success("Block Checkin Checkout updated successfully!");
        setValidationErrorsBlock({});
        await fetchBlockList(pageBlock, searchBlock);
        closeBlockModal();
      }
    } catch (error) {
      console.error("Update block error:", error);
      toast.error(
        `Failed to update block: ${
          error.response?.data?.message || error.message
        }`
      );
    } finally {
      setIsLoadingBlock(false);
    }
  };

  const handleDeleteBlock = (item) => {
    Swal.fire({
      title: "Are you sure?",
      text: `You want to delete this block record`,
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
          .delete(`/api/hotels/${id}/blockCheckInCheckout/${item.id}`)
          .then(() => {
            toast.success("Block deleted successfully");
            fetchBlockList(pageBlock, searchBlock);
          })
          .catch(() => {
            toast.error("Failed to delete block");
          });
      }
    });
  };

  // Stop Sale CRUD Functions
  const fetchStopSaleList = async (
    pageNum = 0,
    searchTerm = searchStopSale
  ) => {
    setIsLoadingStopSale(true);
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: "10",
      });
      if (searchTerm && searchTerm.trim()) {
        params.append("search", searchTerm.trim());
      }
      const response = await axiosInstance.get("/api/hotelStopSale", {
        params,
      });
      if (response.data && Array.isArray(response.data)) {
        setStopSaleItems(response.data);
        if (response.data.length < 10) {
          setTotalPagesStopSale(pageNum + 1);
        } else {
          setTotalPagesStopSale(Math.max(totalPagesStopSale, pageNum + 2));
        }
        setPageStopSale(pageNum);
      } else {
        setStopSaleItems([]);
        setTotalPagesStopSale(0);
        setPageStopSale(0);
      }
    } catch (error) {
      console.error("Failed to load stop sale list:", error);
      toast.error("Failed to load stop sale list");
      setStopSaleItems([]);
      setTotalPagesStopSale(0);
      setPageStopSale(0);
    } finally {
      setIsLoadingStopSale(false);
    }
  };

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

  const openEditStopSale = async (item) => {
    console.log("Editing Stop Sale:", item);
    try {
      setIsLoadingStopSale(true);
      const response = await axiosInstance.get(
        `/api/hotelStopSale/${item.stopSaleId}`
      );
      const data = response.data;

      setEditingStopSale(data);
      setIsViewModeStopSale(false);
      setFormDataStopSale({
        marketTypeId: data.marketTypeId || "",
        roomCategoryId: data.roomCategoryId || "",
        type: data.roomAllocation
          ? "Room Allocation"
          : data.block
          ? "Block"
          : "Free-Sale",
        validityList: data.stopSaleValidityDTO || [
          {
            validityFrom: "",
            validityTo: "",
          },
        ],
      });
      setValidationErrorsStopSale({});
      setShowStopSaleModal(true);
    } catch (error) {
      console.error("Failed to load stop sale for edit:", error);
      toast.error("Failed to load stop sale data for editing");
    } finally {
      setIsLoadingStopSale(false);
    }
  };

  const openViewStopSale = async (item) => {
    try {
      setIsLoadingStopSale(true);
      const response = await axiosInstance.get(
        `/api/hotelStopSale/${item.stopSaleId}`
      );
      const data = response.data;

      setEditingStopSale(data);
      setIsViewModeStopSale(true);
      setFormDataStopSale({
        marketTypeId: data.marketTypeId || "",
        roomCategoryId: data.roomCategoryId || "",
        type: data.roomAllocation
          ? "Room Allocation"
          : data.block
          ? "Block"
          : "Free-Sale",
        validityList: data.stopSaleValidityDTO || [
          {
            validityFrom: "",
            validityTo: "",
          },
        ],
      });
      setValidationErrorsStopSale({});
      setShowStopSaleModal(true);
    } catch (error) {
      console.error("Failed to load stop sale for view:", error);
      toast.error("Failed to load stop sale data for viewing");
    } finally {
      setIsLoadingStopSale(false);
    }
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

  const validateStopSaleForm = (data) => {
    const newErrors = {};

    if (!data.marketTypeId) newErrors.marketTypeId = "Market Type is required";
    if (!data.roomCategoryId)
      newErrors.roomCategoryId = "Room Category is required";
    if (!data.type) newErrors.type = "Type is required";

    if (!data.validityList || data.validityList.length === 0) {
      newErrors.validityList = "At least one validity period is required";
    } else {
      data.validityList.forEach((period, index) => {
        if (!period.validityFrom) {
          newErrors[
            `validityFrom_${index}`
          ] = `Validity From is required for period ${index + 1}`;
        }
        if (!period.validityTo) {
          newErrors[
            `validityTo_${index}`
          ] = `Validity To is required for period ${index + 1}`;
        }
      });
    }

    return newErrors;
  };

  const saveStopSale = async (e) => {
    e.preventDefault();
    const errors = validateStopSaleForm(formDataStopSale);
    if (Object.keys(errors).length > 0) {
      setValidationErrorsStopSale(errors);
      return;
    }

    try {
      setIsLoadingStopSale(true);
      const payload = {
        hotelId: Number(id),
        marketTypeId: Number(formDataStopSale.marketTypeId),
        roomCategoryId: Number(formDataStopSale.roomCategoryId),
        roomAllocation: formDataStopSale.type === "Room Allocation",
        block: formDataStopSale.type === "Block",
        freeSale: formDataStopSale.type === "Free-Sale",
        stopSaleValidityDTO: formDataStopSale.validityList.map((period) => ({
          validityFrom: period.validityFrom,
          validityTo: period.validityTo,
        })),
      };

      console.log("Save Stop Sale Payload:", payload);
      const response = await axiosInstance.post(
        "/api/hotelStopSale/save",
        payload,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data) {
        toast.success("Stop Sale created successfully!");
        setValidationErrorsStopSale({});
        await fetchStopSaleList(pageStopSale, searchStopSale);
        closeStopSaleModal();
      }
    } catch (error) {
      console.error("Save stop sale error:", error);
      toast.error(
        `Failed to save stop sale: ${
          error.response?.data?.message || error.message
        }`
      );
    } finally {
      setIsLoadingStopSale(false);
    }
  };

  const updateStopSale = async () => {
    const errors = validateStopSaleForm(formDataStopSale);
    if (Object.keys(errors).length > 0) {
      setValidationErrorsStopSale(errors);
      return;
    }

    console.log("Editing Stop Sale:", editingStopSale);
    if (!editingStopSale) return;

    try {
      setIsLoadingStopSale(true);
      const payload = {
        hotelId: Number(id),
        marketTypeId: Number(formDataStopSale.marketTypeId),
        roomCategoryId: Number(formDataStopSale.roomCategoryId),
        roomAllocation: formDataStopSale.type === "Room Allocation",
        block: formDataStopSale.type === "Block",
        freeSale: formDataStopSale.type === "Free-Sale",
        stopSaleValidityDTO: formDataStopSale.validityList.map((period) => ({
          validityFrom: period.validityFrom,
          validityTo: period.validityTo,
        })),
      };

      console.log("Update Stop Sale Payload:", payload);
      const response = await axiosInstance.put(
        `/api/hotelStopSale/${editingStopSale.stopSaleId}`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data) {
        toast.success("Stop Sale updated successfully!");
        setValidationErrorsStopSale({});
        await fetchStopSaleList(pageStopSale, searchStopSale);
        closeStopSaleModal();
      }
    } catch (error) {
      console.error("Update stop sale error:", error);
      toast.error(
        `Failed to update stop sale: ${
          error.response?.data?.message || error.message
        }`
      );
    } finally {
      setIsLoadingStopSale(false);
    }
  };

  const handleDeleteStopSale = (item) => {
    console.log("Deleting Stop Sale:", item);
    Swal.fire({
      title: "Are you sure?",
      text: `You want to delete this stop sale record`,
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
          .delete(`/api/hotelStopSale/${item.stopSaleId}`)
          .then(() => {
            toast.success("Stop Sale deleted successfully");
            fetchStopSaleList(pageStopSale, searchStopSale);
          })
          .catch(() => {
            toast.error("Failed to delete stop sale");
          });
      }
    });
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <div className="d-flex align-items-center gap-3 mb-3">
            <Button
              variant="outline-primary"
              onClick={() => navigate(`/hotel-details/${id}`)}
              className="d-flex align-items-center btn-sm gap-2"
            >
              <FaArrowLeft />
              Back
            </Button>
            <h3 className="mb-0">Hotel Availability</h3>
          </div>

          <Tabs
            activeKey={activeTab}
            onSelect={handleTabSelect}
            id="availability-tabs"
            className="mb-3"
          >
            <Tab eventKey="availability" title="Hotel Availability">
              <Card className="shadow-sm rounded-xl mb-3">
                <Card.Header className="d-flex justify-content-between align-items-center text-white">
                  <span
                    className="fw-semibold cursor-pointer text-primary"
                    style={{ padding: "10px" }}
                  >
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
                  <Table
                    striped
                    bordered
                    hover
                    responsive
                    className="mb-0 align-middle"
                  >
                    <thead>
                      <tr>
                        <th style={{ width: 100 }}>S/N</th>
                        <th>Market Type</th>
                        <th>Room Category</th>
                        <th>No of Rooms</th>
                        <th>Availability Type</th>
                        <th>Status</th>
                        <th style={{ width: 160 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, index) => (
                        <tr key={item.id}>
                          <td>{index + 1 + page * 10}</td>
                          <td>{item.marketTypeName || item.marketName}</td>
                          <td>{item.roomCategoryName || item.roomCategory}</td>
                          <td>{item.noOfRooms}</td>
                          <td>
                            <Badge
                              bg={
                                item.availabilityType === "FREE_SALE" ||
                                item.availabilityType === "PRE_BUY" ||
                                item.availabilityType === "ROOM_ALLOCATION"
                                  ? "info"
                                  : "warning"
                              }
                            >
                              {item.availabilityType}
                            </Badge>
                          </td>
                          <td>
                            {item.status === true || item.status === "true" ? (
                              <Badge
                                bg="success"
                                style={{ cursor: "pointer" }}
                                onClick={() => handleLiveStatus(item)}
                              >
                                Active
                              </Badge>
                            ) : (
                              <Badge
                                bg="danger"
                                style={{ cursor: "pointer" }}
                                onClick={() => handleLiveStatus(item)}
                              >
                                Inactive
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
                          {page * 10 + items.length} of {totalPages * 10}{" "}
                          entries
                        </small>
                      </div>
                      <div>
                        <Pagination className="mb-0">
                          <Pagination.Prev
                            disabled={page === 0}
                            onClick={() =>
                              fetchAvailabilityList(page - 1, search)
                            }
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
                            onClick={() =>
                              fetchAvailabilityList(page + 1, search)
                            }
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
                  <span
                    className="fw-semibold cursor-pointer text-primary"
                    style={{ padding: "10px" }}
                  >
                    Block Checkin Checkout
                  </span>
                  <Form.Group className="hotel-search-bar position-relative">
                    <Form.Control
                      type="text"
                      placeholder="Search block checkin..."
                      className="form-control-modern-sm"
                      value={searchBlock}
                      onChange={(e) => setSearchBlock(e.target.value)}
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
                  <Table
                    striped
                    bordered
                    hover
                    responsive
                    className="mb-0 align-middle"
                  >
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
                          <td>{index + 1 + pageBlock * 10}</td>
                          <td>{item.marketTypeName || item.marketName}</td>
                          <td>
                            <Badge bg="light" text="dark" className="border">
                              {item.isCheckin ? "Check In" : "Check Out"}
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
                                onClick={() => openEditBlock(item)}
                                title="Edit"
                              />
                              <FaEye
                                className="text-info"
                                style={{ cursor: "pointer", fontSize: "18px" }}
                                onClick={() => openViewBlock(item)}
                                title="View"
                              />
                              <FaTrash
                                className="text-danger"
                                style={{ cursor: "pointer", fontSize: "18px" }}
                                onClick={() => handleDeleteBlock(item)}
                                title="Delete"
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                      {isLoadingBlock && (
                        <tr>
                          <td
                            colSpan={5}
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
                            Loading block records...
                          </td>
                        </tr>
                      )}
                      {blockItems.length === 0 && !isLoadingBlock && (
                        <tr>
                          <td
                            colSpan={5}
                            className="text-center text-muted py-4"
                          >
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
                  <span
                    className="fw-semibold cursor-pointer text-primary"
                    style={{ padding: "10px" }}
                  >
                    Stop Sale
                  </span>
                  <Form.Group className="hotel-search-bar position-relative">
                    <Form.Control
                      type="text"
                      placeholder="Search stop sale..."
                      className="form-control-modern-sm"
                      value={searchStopSale}
                      onChange={(e) => setSearchStopSale(e.target.value)}
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
                  <Table
                    striped
                    bordered
                    hover
                    responsive
                    className="mb-0 align-middle"
                  >
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
                          <td>{index + 1 + pageStopSale * 10}</td>
                          <td>{item.marketTypeName || item.marketName}</td>
                          <td>{item.roomCategoryName || item.roomCategory}</td>
                          <td>
                            {item.roomAllocation
                              ? "Room Allocation"
                              : item.block
                              ? "Block"
                              : "Free-Sale"}
                          </td>

                          <td>
                            <Badge bg={item.isLive ? "success" : "danger"}>
                              {item.isLive ? "Active" : "Inactive"}
                            </Badge>
                          </td>
                          <td>
                            <div className="d-flex gap-2">
                              <FaEdit
                                className="text-primary"
                                style={{ cursor: "pointer", fontSize: "18px" }}
                                onClick={() => openEditStopSale(item)}
                                title="Edit"
                              />
                              <FaEye
                                className="text-info"
                                style={{ cursor: "pointer", fontSize: "18px" }}
                                onClick={() => openViewStopSale(item)}
                                title="View"
                              />
                              <FaTrash
                                className="text-danger"
                                style={{ cursor: "pointer", fontSize: "18px" }}
                                onClick={() => handleDeleteStopSale(item)}
                                title="Delete"
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                      {isLoadingStopSale && (
                        <tr>
                          <td
                            colSpan={6}
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
                            Loading stop sale records...
                          </td>
                        </tr>
                      )}
                      {stopSaleItems.length === 0 && !isLoadingStopSale && (
                        <tr>
                          <td
                            colSpan={6}
                            className="text-center text-muted py-4"
                          >
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
            {/* Availability Type Selection */}
            <Row className="mb-3">
              <Col md={12}>
                <Form.Group>
                  <Form.Label>
                    Availability Type <span className="text-danger">*</span>
                  </Form.Label>
                  <div className="d-flex gap-3">
                    <Form.Check
                      type="radio"
                      label="FREE_SALE"
                      name="availabilityType"
                      value="FREE_SALE"
                      checked={formData.availabilityType === "FREE_SALE"}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          availabilityType: e.target.value,
                        })
                      }
                      disabled={isViewMode}
                    />
                    <Form.Check
                      type="radio"
                      label="PRE_BUY"
                      name="availabilityType"
                      value="PRE_BUY"
                      checked={formData.availabilityType === "PRE_BUY"}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          availabilityType: e.target.value,
                        })
                      }
                      disabled={isViewMode}
                    />
                    <Form.Check
                      type="radio"
                      label="ROOM_ALLOCATION"
                      name="availabilityType"
                      value="ROOM_ALLOCATION"
                      checked={formData.availabilityType === "ROOM_ALLOCATION"}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          availabilityType: e.target.value,
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
              <Col md={3}>
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
                      <option
                        key={market.marketTypeId}
                        value={market.marketTypeId}
                      >
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
              <Col md={3}>
                <Form.Group>
                  <Form.Label>
                    Room Category <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Select
                    value={formData.hotelRoomId}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        hotelRoomId: e.target.value,
                      })
                    }
                    disabled={isViewMode}
                    isInvalid={!!validationErrors.hotelRoomId}
                  >
                    <option value="">SELECT</option>
                    {roomCategories.map((category) => (
                      <option
                        key={category.rommCategoryId}
                        value={category.rommCategoryId}
                      >
                        {category.roomCategory}
                      </option>
                    ))}
                  </Form.Select>
                  {validationErrors.hotelRoomId && (
                    <Form.Control.Feedback type="invalid">
                      {validationErrors.hotelRoomId}
                    </Form.Control.Feedback>
                  )}
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group>
                  <Form.Label>
                    No of Rooms <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    type="number"
                    value={formData.noOfRooms}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        noOfRooms: e.target.value,
                      })
                    }
                    disabled={isViewMode}
                    isInvalid={!!validationErrors.noOfRooms}
                  />
                  {validationErrors.noOfRooms && (
                    <Form.Control.Feedback type="invalid">
                      {validationErrors.noOfRooms}
                    </Form.Control.Feedback>
                  )}
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group>
                  <Form.Label>
                    Release Day <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    type="number"
                    value={formData.releaseDay}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        releaseDay: e.target.value,
                      })
                    }
                    disabled={isViewMode}
                    isInvalid={!!validationErrors.releaseDay}
                  />
                  {validationErrors.releaseDay && (
                    <Form.Control.Feedback type="invalid">
                      {validationErrors.releaseDay}
                    </Form.Control.Feedback>
                  )}
                </Form.Group>
              </Col>
            </Row>

            {/* Validity List */}
            <Card className="mb-3">
              <Card.Header>Validity List</Card.Header>
              <Card.Body>
                {formData.availabilityValidities.map((period, index) => (
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
                            const newValidityList = [
                              ...formData.availabilityValidities,
                            ];
                            newValidityList[index].validityFrom =
                              e.target.value;
                            setFormData({
                              ...formData,
                              availabilityValidities: newValidityList,
                            });
                          }}
                          disabled={isViewMode}
                          isInvalid={
                            !!validationErrors[`validityFrom_${index}`]
                          }
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
                            const newValidityList = [
                              ...formData.availabilityValidities,
                            ];
                            newValidityList[index].validityTo = e.target.value;
                            setFormData({
                              ...formData,
                              availabilityValidities: newValidityList,
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
                    {!isViewMode &&
                      formData.availabilityValidities.length > 1 && (
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

            {/* Days of the Week Checkboxes */}
            <Card className="mb-3">
              <Card.Header>
                <Form.Label className="mb-0">
                  Checkin is allowed the given days{" "}
                  <span className="text-danger">*</span>
                </Form.Label>
              </Card.Header>
              <Card.Body>
                <Row>
                  <Col md={12}>
                    <div className="d-flex flex-wrap gap-3">
                      {[
                        { key: "SUNDAY", label: "Sunday" },
                        { key: "MONDAY", label: "Monday" },
                        { key: "TUESDAY", label: "Tuesday" },
                        { key: "WEDNESDAY", label: "Wednesday" },
                        { key: "THURSDAY", label: "Thursday" },
                        { key: "FRIDAY", label: "Friday" },
                        { key: "SATURDAY", label: "Saturday" },
                      ].map((day) => (
                        <Form.Check
                          key={day.key}
                          type="checkbox"
                          id={`day-${day.key}`}
                          label={day.label}
                          checked={formData.checkinAllowedDays.includes(
                            day.key
                          )}
                          onChange={(e) => {
                            let newAllowedDays;
                            if (e.target.checked) {
                              newAllowedDays = [
                                ...formData.checkinAllowedDays,
                                day.key,
                              ];
                            } else {
                              newAllowedDays =
                                formData.checkinAllowedDays.filter(
                                  (d) => d !== day.key
                                );
                            }
                            setFormData({
                              ...formData,
                              checkinAllowedDays: newAllowedDays,
                            });
                          }}
                          disabled={isViewMode}
                          className="me-3"
                        />
                      ))}
                    </div>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeModal} disabled={isLoading}>
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
            {selectedItem?.status === true || selectedItem?.status === "true" ? "deactivate" : "activate"} this
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
        <Modal.Header closeButton={!isLoadingBlock}>
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
                      <option
                        key={market.marketTypeId}
                        value={market.marketTypeId}
                      >
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
                        setFormDataBlock({
                          ...formDataBlock,
                          type: e.target.value,
                        })
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
                        setFormDataBlock({
                          ...formDataBlock,
                          type: e.target.value,
                        })
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
                            const newValidityList = [
                              ...formDataBlock.validityList,
                            ];
                            newValidityList[index].validityFrom =
                              e.target.value;
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
                            const newValidityList = [
                              ...formDataBlock.validityList,
                            ];
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
                    {!isViewModeBlock &&
                      formDataBlock.validityList.length > 1 && (
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
            disabled={isLoadingBlock}
          >
            {isViewModeBlock ? "Close" : "Cancel"}
          </Button>
          {!isViewModeBlock && (
            <Button
              variant="primary"
              onClick={editingBlock ? updateBlock : saveBlock}
              disabled={isLoadingBlock}
            >
              {isLoadingBlock ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  ></span>
                  {editingBlock ? "Updating..." : "Creating..."}
                </>
              ) : editingBlock ? (
                "Update"
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
        <Modal.Header closeButton={!isLoadingStopSale}>
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
                      <option
                        key={market.marketTypeId}
                        value={market.marketTypeId}
                      >
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
                      <option
                        key={category.rommCategoryId}
                        value={category.rommCategoryId}
                      >
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
                        setFormDataStopSale({
                          ...formDataStopSale,
                          type: e.target.value,
                        })
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
                        setFormDataStopSale({
                          ...formDataStopSale,
                          type: e.target.value,
                        })
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
                        setFormDataStopSale({
                          ...formDataStopSale,
                          type: e.target.value,
                        })
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
                            const newValidityList = [
                              ...formDataStopSale.validityList,
                            ];
                            newValidityList[index].validityFrom =
                              e.target.value;
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
                            const newValidityList = [
                              ...formDataStopSale.validityList,
                            ];
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
                    {!isViewModeStopSale &&
                      formDataStopSale.validityList.length > 1 && (
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
            disabled={isLoadingStopSale}
          >
            {isViewModeStopSale ? "Close" : "Cancel"}
          </Button>
          {!isViewModeStopSale && (
            <Button
              variant="primary"
              onClick={editingStopSale ? updateStopSale : saveStopSale}
              disabled={isLoadingStopSale}
            >
              {isLoadingStopSale ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  ></span>
                  {editingStopSale ? "Updating..." : "Creating..."}
                </>
              ) : editingStopSale ? (
                "Update"
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
