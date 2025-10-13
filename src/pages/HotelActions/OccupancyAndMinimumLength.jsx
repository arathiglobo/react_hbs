import React, { useEffect, useState } from "react";
import {
  Card,
  Button,
  Table,
  Modal,
  Form,
  Pagination,
  Row,
  Col,
  Badge,
  Tabs,
  Tab,
} from "react-bootstrap";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";
import { FaEdit, FaTrash, FaEye, FaSignInAlt } from "react-icons/fa";
import { useParams } from "react-router-dom";

// SearchableSelect Component
const SearchableSelect = ({
  options,
  value,
  onChange,
  placeholder,
  className,
  isInvalid,
  name,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredOptions, setFilteredOptions] = useState(options || []);

  useEffect(() => {
    if (!options || !Array.isArray(options)) {
      setFilteredOptions([]);
      return;
    }
    if (searchTerm) {
      const filtered = options.filter((option) => {
        const optionName =
          option.name || option.marketTypeName || String(option);
        return optionName.toLowerCase().includes(searchTerm.toLowerCase());
      });
      setFilteredOptions(filtered);
    } else {
      setFilteredOptions(options);
    }
  }, [searchTerm, options]);

  const handleSelect = (option) => {
    try {
      onChange({
        target: {
          name: name,
          value: option.marketTypeId, // Use marketTypeId as per your data
        },
      });
      setIsOpen(false);
      setSearchTerm("");
    } catch (error) {
      console.error("Error in handleSelect:", error);
    }
  };

  const selectedOption = options?.find(
    (option) => String(option.marketTypeId) === String(value)
  );

  return (
    <div className="position-relative">
      <Form.Control
        type="text"
        value={
          isOpen
            ? searchTerm
            : selectedOption?.name || selectedOption?.marketTypeName || ""
        }
        onChange={(e) => {
          if (disabled) return;
          if (isOpen) {
            setSearchTerm(e.target.value);
          } else {
            setIsOpen(true);
            setSearchTerm(e.target.value);
          }
        }}
        onFocus={() => !disabled && setIsOpen(true)}
        placeholder={placeholder}
        className={`form-input ${isInvalid ? "is-invalid" : ""} ${
          className || ""
        }`}
        disabled={disabled}
        readOnly={disabled}
        autoComplete="off"
      />
      {isOpen && !disabled && (
        <div
          className="position-absolute w-100 bg-white border border-top-0 rounded-bottom shadow-lg"
          style={{
            zIndex: 1050,
            maxHeight: "200px",
            overflowY: "auto",
            top: "100%",
          }}
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <div
                key={option.marketTypeId} // Use marketTypeId as key
                className="px-3 py-2 cursor-pointer"
                style={{ cursor: "pointer", borderBottom: "1px solid #eee" }}
                onMouseEnter={(e) =>
                  (e.target.style.backgroundColor = "#f8f9fa")
                }
                onMouseLeave={(e) => (e.target.style.backgroundColor = "white")}
                onClick={() => handleSelect(option)}
              >
                {option.name || option.marketTypeName || String(option)}
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-muted">No options found</div>
          )}
        </div>
      )}
      {isOpen && (
        <div
          className="position-fixed"
          style={{ top: 0, left: 0, right: 0, bottom: 0, zIndex: 1040 }}
          onClick={() => {
            setIsOpen(false);
            setSearchTerm("");
          }}
        />
      )}
    </div>
  );
};

const OccupancyAndMinimumLength = () => {
  const { id } = useParams(); // hotelId
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [itemsOcc, setItemsOcc] = useState([]);
  const [showModalOcc, setShowModalOcc] = useState(false);
  const [editingOcc, setEditingOcc] = useState(null);
  const [isViewModeOcc, setIsViewModeOcc] = useState(false);
  const [formDataOcc, setFormDataOcc] = useState({
    marketTypeId: "", // Single ID as per your backend
    validityPeriods: [
      {
        validityFrom: "",
        validityTo: "",
      },
    ],
    hotelRooms: [
      {
        id: "", // Backend expects 'id' instead of roomCategoryId
        roomOccupancies: [
          {
            occupancyTypeId: "",
            totalAdult: 0,
            totalChild: 0,
            extraAdult: 0,
            extraChild: 0,
          },
        ],
      },
    ],
    live: false,
  });
  const [validationErrorsOcc, setValidationErrorsOcc] = useState({});
  const [pageOcc, setPageOcc] = useState(0);
  const [totalPagesOcc, setTotalPagesOcc] = useState(0);
  const [searchOcc, setSearchOcc] = useState("");
  const [searchTimeoutOcc, setSearchTimeoutOcc] = useState(null);
  const [showLiveStatusModalOcc, setShowLiveStatusModalOcc] = useState(false);
  const [selectedItemOcc, setSelectedItemOcc] = useState(null);
  const [itemsMin, setItemsMin] = useState([]);
  const [showModalMin, setShowModalMin] = useState(false);
  const [editingMin, setEditingMin] = useState(null);
  const [isViewModeMin, setIsViewModeMin] = useState(false);
  const [formDataMin, setFormDataMin] = useState({
    market: "",
    minLength: "",
  });
  const [validationErrorsMin, setValidationErrorsMin] = useState({});
  const [pageMin, setPageMin] = useState(0);
  const [totalPagesMin, setTotalPagesMin] = useState(0);
  const [searchMin, setSearchMin] = useState("");
  const [searchTimeoutMin, setSearchTimeoutMin] = useState(null);
  const [showLiveStatusModalMin, setShowLiveStatusModalMin] = useState(false);
  const [selectedItemMin, setSelectedItemMin] = useState(null);
  const [activeTab, setActiveTab] = useState("occupancy");
  const [showAllOccModal, setShowAllOccModal] = useState(false);
  const [showAllMinModal, setShowAllMinModal] = useState(false);
  const [marketTypes, setMarketTypes] = useState([]);
  const [roomCategories, setRoomCategories] = useState([]);
  const [occupancyTypes, setOccupancyTypes] = useState([]);
  const [hotelRoomsData, setHotelRoomsData] = useState([]);

  const getFormControlPropsOcc = (
    fieldName,
    onChangeHandler,
    additionalProps = {}
  ) => {
    return {
      ...additionalProps,
      readOnly: isViewModeOcc,
      onChange: isViewModeOcc ? undefined : onChangeHandler,
      className: `${additionalProps.className || ""} ${
        isViewModeOcc ? "bg-light" : ""
      }`.trim(),
      autoFocus: isViewModeOcc ? false : additionalProps.autoFocus,
    };
  };

  const loadMarketTypes = async () => {
    try {
      const response = await axiosInstance.get("/api/marketType");
      console.log("Market Types Data:", response.data); // Debug log
      setMarketTypes(response.data || []);
    } catch (error) {
      console.error("Error loading market types:", error);
      toast.error("Failed to load market types");
    }
  };

  const loadRoomCategories = async () => {
    try {
      const response = await axiosInstance.get("/api/roomCategories");
      setRoomCategories(response.data || []);
    } catch (error) {
      console.error("Error loading room categories:", error);
      toast.error("Failed to load room categories");
    }
  };

  const loadOccupancyTypes = async () => {
    try {
      const response = await axiosInstance.get("/api/occupancyType");
      setOccupancyTypes(response.data || []);
    } catch (error) {
      console.error("Error loading occupancy types:", error);
      toast.error("Failed to load occupancy types");
    }
  };

  const loadHotelRoomDatas = async () => {
    try {
      const response = await axiosInstance.get(
        `/api/hotelRoomDetailsController/${id}`
      );
      console.log("Hotel Rooms Data:", response.data);
      setHotelRoomsData(response.data || []);
    } catch (error) {
      toast.error("Failed to load Hotel Rooms Data");
    }
  };

  useEffect(() => {
    loadMarketTypes();
    loadRoomCategories();
    loadOccupancyTypes();
    loadHotelRoomDatas();
  }, []);

  useEffect(() => {
    if (hotelRoomsData.length > 0) {
      setFormDataOcc((prev) => ({
        ...prev,
        hotelRooms: hotelRoomsData.map((room) => ({
          id: room.rommCategoryId || "",
          roomOccupancies: room.occupancyDetailsDTOs.map((occ) => ({
            occupancyTypeId: occ.id || "",
            totalAdult: 0,
            totalChild: 0,
            extraAdult: 0,
            extraChild: 0,
          })),
        })),
      }));
    }
  }, [hotelRoomsData]);

  const fetchOccupancyList = async (pageNum = 0, searchTerm = searchOcc) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: "10",
      });
      if (searchTerm && searchTerm.trim()) {
        params.append("search", searchTerm.trim());
      }
      const res = await axiosInstance.get(`/api/hotels/${id}/occupancies`, {
        params,
      });
      if (res.data && Array.isArray(res.data)) {
        setItemsOcc(res.data);
        if (res.data.length < 10) {
          setTotalPagesOcc(pageNum + 1);
        } else {
          setTotalPagesOcc(Math.max(totalPagesOcc, pageNum + 2));
        }
        setPageOcc(pageNum);
      } else {
        setItemsOcc([]);
        setTotalPagesOcc(0);
        setPageOcc(0);
      }
    } catch (err) {
      toast.error("Failed to load occupancies");
      setItemsOcc([]);
      setTotalPagesOcc(0);
      setPageOcc(0);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOccupancyList();
  }, []);

  const validateOccupancyForm = (data) => {
    const newErrors = {};
    if (!data.marketTypeId) {
      newErrors.marketTypeId = "Market type is required";
    }
    if (!data.validityPeriods || data.validityPeriods.length === 0) {
      newErrors.validityPeriods = "At least one validity period is required";
    } else {
      data.validityPeriods.forEach((period, index) => {
        if (!period.validityFrom) {
          newErrors.validityFrom = `Validity From is required for period ${
            index + 1
          }`;
        }
        if (!period.validityTo) {
          newErrors.validityTo = `Validity To is required for period ${
            index + 1
          }`;
        }
      });
    }
    if (!data.hotelRooms || data.hotelRooms.length === 0) {
      newErrors.hotelRooms = "At least one room is required";
    } else {
      data.hotelRooms.forEach((room, index) => {
        console.log("Validating room:", room);
        if (!room.id) {
          newErrors.roomId = `Room ID is required for room ${index + 1}`;
        }
        if (!room.roomOccupancies || room.roomOccupancies.length === 0) {
          newErrors.roomOccupancies = `At least one occupancy is required for room ${
            index + 1
          }`;
        } else {
          room.roomOccupancies.forEach((occ, occIndex) => {
            console.log("Validating occupancy:", occ);
            if (!occ.occupancyTypeId) {
              newErrors.occupancyTypeId = `Occupancy Type is required for occupancy ${
                occIndex + 1
              } in room ${index + 1}`;
            }
          });
        }
      });
    }
    return newErrors;
  };

  const saveOccupancy = async (e) => {
    console.log("save occupancy fn::", formDataOcc);
    e.preventDefault();
    const errors = validateOccupancyForm(formDataOcc);
    if (Object.keys(errors).length > 0) {
      setValidationErrorsOcc(errors);
      return;
    }
    try {
      setIsLoading(true);
      const payload = {
        hotelId: id,
        marketTypeId: formDataOcc.marketTypeId || null,
        validityPeriods: formDataOcc.validityPeriods.map((period) => ({
          validityFrom: period.validityFrom,
          validityTo: period.validityTo,
        })),
        hotelRooms: formDataOcc.hotelRooms.map((room) => ({
          id: room.id, // Use the mapped rommCategoryId
          roomOccupancies: room.roomOccupancies.map((occ) => ({
            occupancyTypeId: occ.occupancyTypeId,
            totalAdult: Number(occ.totalAdult) || 0,
            totalChild: Number(occ.totalChild) || 0,
            extraAdult: Number(occ.extraAdult) || 0,
            extraChild: Number(occ.extraChild) || 0,
          })),
        })),
      };
      console.log("Final Occupancy Payload:", payload);
      const response = await axiosInstance.post(
        `/api/hotels/${id}/occupancies`,
        payload,
        {
          headers: { "Content-Type": "application/json" },
        }
      );
      if (response.data) {
        toast.success("Occupancy added successfully!");
        setValidationErrorsOcc({});
        await fetchOccupancyList(pageOcc, searchOcc);
        closeModalOcc();
      }
    } catch (error) {
      console.error("Save occupancy error:", error);
      setError("Failed to save occupancy data");
      toast.error(
        `Failed to save occupancy data: ${
          error.response?.data?.message || error.message
        }`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditOcc = async () => {
    const errors = validateOccupancyForm(formDataOcc);
    if (Object.keys(errors).length > 0) {
      setValidationErrorsOcc(errors);
      return;
    }
    if (!editingOcc) return;
    try {
      setIsLoading(true);
      const payload = {
        hotelId: id,
        marketTypeId: formDataOcc.marketTypeId || null,
        validityPeriods: formDataOcc.validityPeriods.map((period) => ({
          validityFrom: period.validityFrom,
          validityTo: period.validityTo,
        })),
        hotelRooms: formDataOcc.hotelRooms.map((room) => ({
          id: room.id, // Use the mapped rommCategoryId
          roomOccupancies: room.roomOccupancies.map((occ) => ({
            occupancyTypeId: occ.occupancyTypeId,
            totalAdult: Number(occ.totalAdult) || 0,
            totalChild: Number(occ.totalChild) || 0,
            extraAdult: Number(occ.extraAdult) || 0,
            extraChild: Number(occ.extraChild) || 0,
          })),
        })),
      };
      console.log("Edit Occupancy Payload:", payload);
      const response = await axiosInstance.put(
        `/api/hotels/${id}/occupancies/${editingOcc.occupancyId}`,
        payload,
        {
          headers: { "Content-Type": "application/json" },
        }
      );
      if (response.data) {
        toast.success("Occupancy updated successfully!");
        setValidationErrorsOcc({});
        await fetchOccupancyList(pageOcc, searchOcc);
        closeModalOcc();
      }
    } catch (error) {
      console.error("Edit occupancy error:", error);
      setError("Failed to update occupancy");
      toast.error(
        `Failed to update occupancy: ${
          error.response?.data?.message || error.message
        }`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const closeModalOcc = () => {
    setShowModalOcc(false);
    setEditingOcc(null);
    setIsViewModeOcc(false);
    setFormDataOcc({
      marketTypeId: "",
      validityPeriods: [{ validityFrom: "", validityTo: "" }],
      hotelRooms: [
        {
          id: "",
          roomOccupancies: [
            {
              occupancyTypeId: "",
              totalAdult: 0,
              totalChild: 0,
              extraAdult: 0,
              extraChild: 0,
            },
          ],
        },
      ],
      live: false,
    });
    setValidationErrorsOcc({});
    setError("");
  };

  useEffect(() => {
    if (searchTimeoutOcc) {
      clearTimeout(searchTimeoutOcc);
    }
    const timeout = setTimeout(() => {
      fetchOccupancyList(0, searchOcc);
    }, 500);
    setSearchTimeoutOcc(timeout);
    return () => {
      if (searchTimeoutOcc) {
        clearTimeout(searchTimeoutOcc);
      }
    };
  }, [searchOcc]);

  const handleDeleteOcc = (item) => {
    Swal.fire({
      title: `Are you sure? You want to delete occupancy ${item.occupancyId}`,
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
          .delete(`/api/hotels/${id}/occupancies/${item.occupancyId}`)
          .then(() => {
            toast.success("Occupancy deleted successfully");
            fetchOccupancyList(pageOcc, searchOcc);
          })
          .catch(() => {
            toast.error("Sorry!! Occupancy not deleted");
          });
      }
    });
  };

  const openEditOcc = async (item) => {
    try {
      const editRes = await axiosInstance.get(
        `/api/hotels/${id}/occupancies/${item.occupancyId}`
      );
      console.log("edit res::", editRes.data);
      const data = editRes.data;

      // Transform rooms to match save structure
      const hotelRooms = [];
      const roomMap = {};
      (data.rooms || []).forEach((room) => {
        if (!roomMap[room.roomId]) {
          roomMap[room.roomId] = {
            id: room.roomId,
            roomOccupancies: [],
          };
        }
        roomMap[room.roomId].roomOccupancies.push({
          occupancyTypeId: room.occupancyTypeId,
          totalAdult: room.totalAdult || 0,
          totalChild: room.totalChild || 0,
          extraAdult: room.extraAdult || 0,
          extraChild: room.extraChild || 0,
        });
      });
      Object.values(roomMap).forEach((room) => hotelRooms.push(room));

      // Transform validity list
      const validityPeriods = (data.validityList || []).map((v) => ({
        validityFrom: v.validityFrom,
        validityTo: v.validityTo,
      }));

      // Map marketName to marketTypeId if needed
      const marketTypeId = marketTypes.find(
        (mt) => mt.name === data.marketName || mt.marketTypeName === data.marketName
      )?.marketTypeId || data.marketTypeId || "";

      setEditingOcc(data);
      setIsViewModeOcc(false);
      setFormDataOcc({
        marketTypeId: marketTypeId,
        validityPeriods: validityPeriods.length
          ? validityPeriods
          : [{ validityFrom: "", validityTo: "" }],
        hotelRooms: hotelRooms.length
          ? hotelRooms
          : [
              {
                id: "",
                roomOccupancies: [
                  {
                    occupancyTypeId: "",
                    totalAdult: 0,
                    totalChild: 0,
                    extraAdult: 0,
                    extraChild: 0,
                  },
                ],
              },
            ],
        live: data.live || false,
      });
      setValidationErrorsOcc({});
      setShowModalOcc(true);
    } catch (error) {
      console.error("Failed to load occupancy for edit:", error);
      toast.error("Failed to load occupancy data");
    }
  };

  const handleViewOcc = async (item) => {
    setEditingOcc(item);
    setIsViewModeOcc(true);
    setFormDataOcc({
      marketTypeId: item.marketTypeId || "",
      validityPeriods: item.validityPeriods || [{ validityFrom: "", validityTo: "" }],
      hotelRooms: item.hotelRooms || [
        {
          id: "",
          roomOccupancies: [
            {
              occupancyTypeId: "",
              totalAdult: 0,
              totalChild: 0,
              extraAdult: 0,
              extraChild: 0,
            },
          ],
        },
      ],
      live: item.live || false,
    });
    setValidationErrorsOcc({});
    setShowModalOcc(true);
  };

  const handleLiveStatusOcc = async (item) => {
    setSelectedItemOcc(item);
    setShowLiveStatusModalOcc(true);
  };

  const confirmLiveStatusChangeOcc = async () => {
    if (!selectedItemOcc) return;
    try {
      setIsLoading(true);
      const payload = {
        isLive: !selectedItemOcc.isLive,
      };
      const res = await axiosInstance.patch(
        `/api/hotels/${id}/occupancies/${selectedItemOcc.occupancyId}/status`,
        payload
      );
      toast.success(
        `Occupancy ${
          selectedItemOcc.isLive ? "deactivated" : "activated"
        } successfully`
      );
      await fetchOccupancyList(pageOcc, searchOcc);
      setShowLiveStatusModalOcc(false);
      setSelectedItemOcc(null);
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

  const closeLiveStatusModalOcc = () => {
    setShowLiveStatusModalOcc(false);
    setSelectedItemOcc(null);
  };

  const openCreateMin = () => {
    setEditingMin(null);
    setFormDataMin({
      market: "",
      minLength: "",
    });
    setValidationErrorsMin({});
    setError("");
    setShowModalMin(true);
  };

  const openEditMin = async (item) => {
    setEditingMin(item);
    setIsViewModeMin(false);
    setFormDataMin({
      market: item.market || "",
      minLength: item.minLength || "",
    });
    setValidationErrorsMin({});
    setShowModalMin(true);
  };

  const handleEditMin = async () => {
    const errors = validateMinForm(formDataMin);
    if (Object.keys(errors).length > 0) {
      setValidationErrorsMin(errors);
      return;
    }
    if (!editingMin) return;
    try {
      setIsLoading(true);
      const payload = {
        market: formDataMin.market,
        minLength: formDataMin.minLength,
      };
      const editRes = await axiosInstance.put(
        `/api/hotels/${id}/minlengths/${editingMin.id}`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      if (editRes.data) {
        toast.success("Minimum Length Updated Successfully!");
        setValidationErrorsMin({});
        await fetchMinLengthList(pageMin, searchMin);
        closeModalMin();
      }
    } catch (error) {
      console.error("Edit min length error:", error);
      setError("Failed to update min length");
      toast.error(
        `Failed to update min length: ${
          error.response?.data?.message || error.message
        }`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const closeModalMin = () => {
    setShowModalMin(false);
    setEditingMin(null);
    setIsViewModeMin(false);
    setFormDataMin({
      market: "",
      minLength: "",
    });
    setValidationErrorsMin({});
    setError("");
  };

  const fetchMinLengthList = async (pageNum = 0, searchTerm = searchMin) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: "10",
      });
      if (searchTerm && searchTerm.trim()) {
        params.append("search", searchTerm.trim());
      }
      const res = await axiosInstance.get(`/api/hotels/${id}/minlengths`, {
        params,
      });
      if (res.data && Array.isArray(res.data)) {
        setItemsMin(res.data);
        if (res.data.length < 10) {
          setTotalPagesMin(pageNum + 1);
        } else {
          setTotalPagesMin(Math.max(totalPagesMin, pageNum + 2));
        }
        setPageMin(pageNum);
      } else {
        setItemsMin([]);
        setTotalPagesMin(0);
        setPageMin(0);
      }
    } catch (err) {
      toast.error("Failed to load min lengths");
      setItemsMin([]);
      setTotalPagesMin(0);
      setPageMin(0);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMinLengthList();
  }, []);

  const validateMinForm = (data) => {
    const newErrors = {};
    if (!data.market.trim()) newErrors.market = "Market is required";
    if (!data.minLength.trim()) newErrors.minLength = "Min Length is required";
    else if (isNaN(data.minLength))
      newErrors.minLength = "Min Length must be a number";
    return newErrors;
  };

  const saveMinLength = async (e) => {
    e.preventDefault();
    const errors = validateMinForm(formDataMin);
    if (Object.keys(errors).length > 0) {
      setValidationErrorsMin(errors);
      return;
    }
    try {
      setIsLoading(true);
      const payload = {
        market: formDataMin.market,
        minLength: formDataMin.minLength,
      };
      const response = await axiosInstance.post(
        `/api/hotels/${id}/minlengths`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      if (response.data) {
        toast.success("Min Length added Successfully!");
        setValidationErrorsMin({});
        await fetchMinLengthList(pageMin, searchMin);
        closeModalMin();
      }
    } catch (error) {
      console.error("Save min length error:", error);
      setError("Sorry! Data not saved to db..");
      toast.error(
        `Failed to save min length data: ${
          error.response?.data?.message || error.message
        }`
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (searchTimeoutMin) {
      clearTimeout(searchTimeoutMin);
    }
    const timeout = setTimeout(() => {
      fetchMinLengthList(0, searchMin);
    }, 500);
    setSearchTimeoutMin(timeout);
    return () => {
      if (searchTimeoutMin) {
        clearTimeout(searchTimeoutMin);
      }
    };
  }, [searchMin]);

  const handleDeleteMin = (item) => {
    Swal.fire({
      title: `Are you sure? You want to delete ${item.market}`,
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
          .delete(`/api/hotels/${id}/minlengths/${item.id}`)
          .then(() => {
            toast.success("Min Length deleted successfully");
            fetchMinLengthList(pageMin, searchMin);
          })
          .catch(() => {
            toast.error("Sorry!! Min Length not deleted");
          });
      }
    });
  };

  const handleViewMin = async (item) => {
    setEditingMin(item);
    setIsViewModeMin(true);
    setFormDataMin({
      market: item.market || "",
      minLength: item.minLength || "",
    });
    setValidationErrorsMin({});
    setShowModalMin(true);
  };

  const handleLiveStatusMin = async (item) => {
    setSelectedItemMin(item);
    setShowLiveStatusModalMin(true);
  };

  const confirmLiveStatusChangeMin = async () => {
    if (!selectedItemMin) return;
    try {
      setIsLoading(true);
      const payload = {
        isLive: !selectedItemMin.isLive,
      };
      const res = await axiosInstance.patch(
        `/api/hotels/${id}/minlengths/${selectedItemMin.id}/status`,
        payload
      );
      toast.success(
        `Min Length ${
          selectedItemMin.isLive ? "deactivated" : "activated"
        } successfully`
      );
      await fetchMinLengthList(pageMin, searchMin);
      setShowLiveStatusModalMin(false);
      setSelectedItemMin(null);
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

  const closeLiveStatusModalMin = () => {
    setShowLiveStatusModalMin(false);
    setSelectedItemMin(null);
  };

  const handleTabSelect = (key) => {
    setActiveTab(key);
  };

  const openAllOccupancy = () => {
    setShowAllOccModal(true);
  };

  const openAllMinLength = () => {
    setShowAllMinModal(true);
  };

  const closeAllOccModal = () => {
    setShowAllOccModal(false);
  };

  const closeAllMinModal = () => {
    setShowAllMinModal(false);
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <h3>Occupancy And Minimum Length</h3>
          <Tabs
            activeKey={activeTab}
            onSelect={handleTabSelect}
            id="occupancy-tabs"
            className="mb-3"
          >
            <Tab eventKey="occupancy" title="Hotel Occupancy">
              <Card className="shadow-sm rounded-xl mb-3">
                <Card.Header className="d-flex justify-content-between align-items-center text-white">
                  <span
                    className="fw-semibold cursor-pointer text-primary"
                    onClick={openAllOccupancy}
                    style={{ padding: "10px" }}
                  >
                    Occupancy
                  </span>
                  <Form.Group className="hotel-search-bar position-relative">
                    <Form.Control
                      type="text"
                      placeholder="Search occupancy..."
                      className="form-control-modern-sm"
                      value={searchOcc}
                      onChange={(e) => setSearchOcc(e.target.value)}
                    />
                  </Form.Group>
                  <Button
                    className="btn-green create-btn"
                    onClick={() => {
                      setEditingOcc(null);
                      setIsViewModeOcc(false);
                      setShowModalOcc(true);
                    }}
                  >
                    + Create
                  </Button>
                </Card.Header>
                <Card.Body className="p-0">
                  <Table responsive hover striped className="mb-0 align-middle">
                    <thead>
                      <tr>
                        <th style={{ width: 100 }}>S/N</th>
                        <th>Hotel Name</th>
                        <th>Market Type</th>
                        <th>Status</th>
                        <th style={{ width: 160 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemsOcc.map((item, index) => (
                        <tr key={item.occupancyId}>
                          <td>{index + 1 + pageOcc * 10}</td>
                          <td>{item.hotelName}</td>
                          <td>{item.marketTypeName}</td>
                          <td>
                            {item.isLive ? (
                              <Badge
                                bg="danger"
                                style={{ cursor: "pointer" }}
                                onClick={() => handleLiveStatusOcc(item)}
                              >
                                Inactive
                              </Badge>
                            ) : (
                              <Badge
                                bg="success"
                                style={{ cursor: "pointer" }}
                                onClick={() => handleLiveStatusOcc(item)}
                              >
                                Active
                              </Badge>
                            )}
                          </td>
                          <td>
                            <div className="d-flex gap-2">
                              <FaEdit
                                className="text-primary occupancyEdit"
                                style={{ cursor: "pointer", fontSize: "18px" }}
                                onClick={() => openEditOcc(item)}
                                title="Edit"
                              />
                              <FaEye
                                className="text-info view occupancyView"
                                style={{ cursor: "pointer", fontSize: "18px" }}
                                onClick={() => handleViewOcc(item)}
                                title="View"
                              />
                              <FaTrash
                                className="text-danger delete occupancyDelete"
                                style={{ cursor: "pointer", fontSize: "18px" }}
                                onClick={() => handleDeleteOcc(item)}
                                title="Delete"
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                      {isLoading && (
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
                            Loading available occupancies...
                          </td>
                        </tr>
                      )}
                      {itemsOcc.length === 0 && !isLoading && (
                        <tr>
                          <td
                            colSpan={5}
                            className="text-center text-muted py-4"
                          >
                            No occupancies found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                  {totalPagesOcc > 1 && (
                    <div className="d-flex justify-content-between align-items-center p-3 border-top">
                      <div>
                        <small className="text-muted">
                          Showing {itemsOcc.length} of {totalPagesOcc * 10}{" "}
                          occupancies
                        </small>
                      </div>
                      <div>
                        <Pagination className="mb-0">
                          <Pagination.Prev
                            disabled={pageOcc === 0}
                            onClick={() =>
                              fetchOccupancyList(pageOcc - 1, searchOcc)
                            }
                          />
                          {[...Array(totalPagesOcc).keys()].map((num) => (
                            <Pagination.Item
                              key={num}
                              active={num === pageOcc}
                              onClick={() => fetchOccupancyList(num, searchOcc)}
                            >
                              {num + 1}
                            </Pagination.Item>
                          ))}
                          <Pagination.Next
                            disabled={pageOcc === totalPagesOcc - 1}
                            onClick={() =>
                              fetchOccupancyList(pageOcc + 1, searchOcc)
                            }
                          />
                        </Pagination>
                      </div>
                    </div>
                  )}
                </Card.Body>
              </Card>
              <Modal
                show={showAllOccModal}
                onHide={closeAllOccModal}
                centered
                size="xl"
              >
                <Modal.Header closeButton>
                  <Modal.Title>All Occupancies</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                  <Table striped bordered hover responsive>
                    <thead>
                      <tr>
                        <th>S/N</th>
                        <th>Occupancy ID</th>
                        <th>Hotel Name</th>
                        <th>Market Type</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemsOcc.map((item, index) => (
                        <tr key={item.occupancyId}>
                          <td>{index + 1 + pageOcc * 10}</td>
                          <td>{item.occupancyId}</td>
                          <td>{item.hotelName}</td>
                          <td>{item.marketTypeName}</td>
                          <td>{item.isLive ? "Active" : "Inactive"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Modal.Body>
                <Modal.Footer>
                  <Button variant="secondary" onClick={closeAllOccModal}>
                    Close
                  </Button>
                </Modal.Footer>
              </Modal>
              <Modal
                show={showModalOcc}
                onHide={closeModalOcc}
                centered
                size="lg"
              >
                <Modal.Header closeButton={!isLoading}>
                  <Modal.Title>
                    {isViewModeOcc
                      ? "View Occupancy"
                      : editingOcc
                      ? "Update Occupancy"
                      : "Create Occupancy"}
                  </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                  <Form>
                    <Row>
                      <Col md={4}>
                        <Form.Group className="mb-3">
                          <Form.Label>
                            Market Type <span className="text-danger">*</span>
                          </Form.Label>
                          <SearchableSelect
                            options={marketTypes}
                            value={formDataOcc.marketTypeId || ""}
                            onChange={(e) =>
                              setFormDataOcc({
                                ...formDataOcc,
                                marketTypeId: e.target.value,
                              })
                            }
                            placeholder="Select market type"
                            name="marketTypeId"
                            isInvalid={!!validationErrorsOcc.marketTypeId}
                            disabled={isViewModeOcc}
                          />
                          {validationErrorsOcc.marketTypeId && (
                            <Form.Control.Feedback type="invalid">
                              {validationErrorsOcc.marketTypeId}
                            </Form.Control.Feedback>
                          )}
                        </Form.Group>
                      </Col>
                    </Row>
                    {/* Validity Periods Section */}
                    <Card className="mb-3">
                      <Card.Header>Validity Periods</Card.Header>
                      <Card.Body>
                        {formDataOcc.validityPeriods.map((period, index) => (
                          <Row key={index} className="mb-3">
                            <Col md={5}>
                              <Form.Group>
                                <Form.Label>
                                  Validity From{" "}
                                  <span className="text-danger">*</span>
                                </Form.Label>
                                <Form.Control
                                  type="datetime-local"
                                  value={period.validityFrom || ""}
                                  onChange={(e) => {
                                    const newPeriods = [
                                      ...formDataOcc.validityPeriods,
                                    ];
                                    newPeriods[index].validityFrom =
                                      e.target.value;
                                    setFormDataOcc({
                                      ...formDataOcc,
                                      validityPeriods: newPeriods,
                                    });
                                  }}
                                  disabled={isViewModeOcc}
                                  isInvalid={!!validationErrorsOcc.validityFrom}
                                />
                                {validationErrorsOcc.validityFrom && (
                                  <Form.Control.Feedback type="invalid">
                                    {validationErrorsOcc.validityFrom}
                                  </Form.Control.Feedback>
                                )}
                              </Form.Group>
                            </Col>
                            <Col md={5}>
                              <Form.Group>
                                <Form.Label>
                                  Validity To{" "}
                                  <span className="text-danger">*</span>
                                </Form.Label>
                                <Form.Control
                                  type="datetime-local"
                                  value={period.validityTo || ""}
                                  onChange={(e) => {
                                    const newPeriods = [
                                      ...formDataOcc.validityPeriods,
                                    ];
                                    newPeriods[index].validityTo =
                                      e.target.value;
                                    setFormDataOcc({
                                      ...formDataOcc,
                                      validityPeriods: newPeriods,
                                    });
                                  }}
                                  disabled={isViewModeOcc}
                                  isInvalid={!!validationErrorsOcc.validityTo}
                                />
                                {validationErrorsOcc.validityTo && (
                                  <Form.Control.Feedback type="invalid">
                                    {validationErrorsOcc.validityTo}
                                  </Form.Control.Feedback>
                                )}
                              </Form.Group>
                            </Col>
                            {!isViewModeOcc &&
                              formDataOcc.validityPeriods.length > 1 && (
                                <Col
                                  md={2}
                                  className="d-flex align-items-end pb-2"
                                >
                                  <Button
                                    variant="danger"
                                    size="sm"
                                    onClick={() => {
                                      const newPeriods =
                                        formDataOcc.validityPeriods.filter(
                                          (_, i) => i !== index
                                        );
                                      setFormDataOcc({
                                        ...formDataOcc,
                                        validityPeriods: newPeriods,
                                      });
                                    }}
                                  >
                                    Remove
                                  </Button>
                                </Col>
                              )}
                          </Row>
                        ))}
                        {!isViewModeOcc && (
                          <Button
                            className="mb-3 addValidityBtn"
                            variant="primary"
                            size="sm"
                            onClick={() =>
                              setFormDataOcc({
                                ...formDataOcc,
                                validityPeriods: [
                                  ...formDataOcc.validityPeriods,
                                  { validityFrom: "", validityTo: "" },
                                ],
                              })
                            }
                          >
                            Add Validity Period
                          </Button>
                        )}
                      </Card.Body>
                    </Card>
                    {/* Hotel Rooms Section */}
                    {formDataOcc.hotelRooms.map((room, roomIndex) => (
                      <Card className="mb-3" key={roomIndex}>
                        <Card.Header>
                          {hotelRoomsData[roomIndex]?.roomCategory
                            ? hotelRoomsData[roomIndex].roomCategory.toUpperCase()
                            : `Room ${roomIndex + 1}`}
                        </Card.Header>
                        <Card.Body>
                          {(room.roomOccupancies || []).map((occ, occIndex) => (
                            <Row key={occIndex} className="mb-3">
                              {/* Occupancy Type */}
                              <Col md={2}>
                                <Form.Group>
                                  <Form.Label>Occupancy Type</Form.Label>
                                  <Form.Select
                                    value={occ.occupancyTypeId || ""}
                                    onChange={(e) => {
                                      const newRooms = [...formDataOcc.hotelRooms];
                                      newRooms[roomIndex].roomOccupancies[
                                        occIndex
                                      ].occupancyTypeId = e.target.value;
                                      setFormDataOcc({
                                        ...formDataOcc,
                                        hotelRooms: newRooms,
                                      });
                                    }}
                                    name="occupancyTypeId"
                                    isInvalid={
                                      !!validationErrorsOcc.occupancyTypeId
                                    }
                                    disabled={isViewModeOcc}
                                  >
                                    <option value="">Select</option>
                                    {occupancyTypes.map((type) => (
                                      <option
                                        key={type.occupancyTypeId}
                                        value={type.occupancyTypeId}
                                      >
                                        {type.occupancy}
                                      </option>
                                    ))}
                                  </Form.Select>
                                  {validationErrorsOcc.occupancyTypeId && (
                                    <Form.Control.Feedback type="invalid">
                                      {validationErrorsOcc.occupancyTypeId}
                                    </Form.Control.Feedback>
                                  )}
                                </Form.Group>
                              </Col>
                              {/* Total Adults */}
                              <Col md={2}>
                                <Form.Group>
                                  <Form.Label>Total Adults</Form.Label>
                                  <Form.Control
                                    type="number"
                                    value={occ.totalAdult || 0}
                                    onChange={(e) => {
                                      const newRooms = [...formDataOcc.hotelRooms];
                                      newRooms[roomIndex].roomOccupancies[
                                        occIndex
                                      ].totalAdult = e.target.value;
                                      setFormDataOcc({
                                        ...formDataOcc,
                                        hotelRooms: newRooms,
                                      });
                                    }}
                                    disabled={isViewModeOcc}
                                  />
                                </Form.Group>
                              </Col>
                              {/* Total Children */}
                              <Col md={2}>
                                <Form.Group>
                                  <Form.Label>Total Children</Form.Label>
                                  <Form.Control
                                    type="number"
                                    value={occ.totalChild || 0}
                                    onChange={(e) => {
                                      const newRooms = [...formDataOcc.hotelRooms];
                                      newRooms[roomIndex].roomOccupancies[
                                        occIndex
                                      ].totalChild = e.target.value;
                                      setFormDataOcc({
                                        ...formDataOcc,
                                        hotelRooms: newRooms,
                                      });
                                    }}
                                    disabled={isViewModeOcc}
                                  />
                                </Form.Group>
                              </Col>
                              {/* Extra Adults */}
                              <Col md={2}>
                                <Form.Group>
                                  <Form.Label>Extra Adults</Form.Label>
                                  <Form.Control
                                    type="number"
                                    value={occ.extraAdult || 0}
                                    onChange={(e) => {
                                      const newRooms = [...formDataOcc.hotelRooms];
                                      newRooms[roomIndex].roomOccupancies[
                                        occIndex
                                      ].extraAdult = e.target.value;
                                      setFormDataOcc({
                                        ...formDataOcc,
                                        hotelRooms: newRooms,
                                      });
                                    }}
                                    disabled={isViewModeOcc}
                                  />
                                </Form.Group>
                              </Col>
                              {/* Extra Children */}
                              <Col md={2}>
                                <Form.Group>
                                  <Form.Label>Extra Children</Form.Label>
                                  <Form.Control
                                    type="number"
                                    value={occ.extraChild || 0}
                                    onChange={(e) => {
                                      const newRooms = [...formDataOcc.hotelRooms];
                                      newRooms[roomIndex].roomOccupancies[
                                        occIndex
                                      ].extraChild = e.target.value;
                                      setFormDataOcc({
                                        ...formDataOcc,
                                        hotelRooms: newRooms,
                                      });
                                    }}
                                    disabled={isViewModeOcc}
                                  />
                                </Form.Group>
                              </Col>
                              {/* Remove Occupancy Button */}
                              {!isViewModeOcc &&
                                room.roomOccupancies.length > 1 && (
                                  <Col
                                    md={1}
                                    className="d-flex align-items-end pb-2"
                                  >
                                    <Button
                                      variant="danger"
                                      size="sm"
                                      onClick={() => {
                                        const newRooms = [...formDataOcc.hotelRooms];
                                        newRooms[roomIndex].roomOccupancies =
                                          newRooms[roomIndex].roomOccupancies.filter(
                                            (_, i) => i !== occIndex
                                          );
                                        setFormDataOcc({
                                          ...formDataOcc,
                                          hotelRooms: newRooms,
                                        });
                                      }}
                                    >
                                      Remove
                                    </Button>
                                  </Col>
                                )}
                            </Row>
                          ))}
                          {/* Add Occupancy Button */}
                          {!isViewModeOcc && (
                            <Button
                              className="mt-2"
                              variant="primary"
                              size="sm"
                              onClick={() => {
                                const newRooms = [...formDataOcc.hotelRooms];
                                newRooms[roomIndex].roomOccupancies.push({
                                  occupancyTypeId: "",
                                  totalAdult: 0,
                                  totalChild: 0,
                                  extraAdult: 0,
                                  extraChild: 0,
                                });
                                setFormDataOcc({
                                  ...formDataOcc,
                                  hotelRooms: newRooms,
                                });
                              }}
                            >
                              Add Occupancy
                            </Button>
                          )}
                        </Card.Body>
                      </Card>
                    ))}
                  </Form>
                  {error && <div className="text-danger mt-3">{error}</div>}
                </Modal.Body>
                <Modal.Footer>
                  <Button
                    variant="secondary"
                    onClick={closeModalOcc}
                    disabled={isLoading}
                  >
                    {isViewModeOcc ? "Close" : "Cancel"}
                  </Button>
                  {!isViewModeOcc && (
                    <Button
                      variant="primary"
                      onClick={editingOcc ? handleEditOcc : saveOccupancy}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <span
                            className="spinner-border spinner-border-sm me-2"
                            role="status"
                            aria-hidden="true"
                          ></span>
                          {editingOcc ? "Updating..." : "Saving..."}
                        </>
                      ) : editingOcc ? (
                        "Update"
                      ) : (
                        "Save"
                      )}
                    </Button>
                  )}
                </Modal.Footer>
              </Modal>
              <Modal
                show={showLiveStatusModalOcc}
                onHide={closeLiveStatusModalOcc}
                centered
                size="sm"
              >
                <Modal.Header closeButton={!isLoading}>
                  <Modal.Title>Confirm Status Change</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                  <p>
                    Are you sure you want to{" "}
                    {selectedItemOcc?.isLive ? "deactivate" : "activate"} this
                    occupancy?
                  </p>
                </Modal.Body>
                <Modal.Footer>
                  <Button
                    variant="secondary"
                    onClick={closeLiveStatusModalOcc}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={confirmLiveStatusChangeOcc}
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
            </Tab>
            <Tab eventKey="minlength" title="Minimum Length">
              <Card className="shadow-sm rounded-xl mb-3">
                <Card.Header className="d-flex justify-content-between align-items-center text-white">
                  <span
                    className="fw-semibold cursor-pointer text-primary"
                    onClick={openAllMinLength}
                    style={{ padding: "10px" }}
                  >
                    Minimum Length
                  </span>
                  <Form.Group className="hotel-search-bar position-relative">
                    <Form.Control
                      type="text"
                      placeholder="Search minimum length..."
                      value={searchMin}
                      onChange={(e) => setSearchMin(e.target.value)}
                      className="d-inline-block w-auto"
                    />
                  </Form.Group>
                  <Button
                    className="btn-green create-btn"
                    onClick={openCreateMin}
                  >
                    + Create
                  </Button>
                </Card.Header>
                <Card.Body className="p-0">
                  <Table striped bordered hover responsive>
                    <thead>
                      <tr>
                        <th>S.N</th>
                        <th>Market</th>
                        <th>Min Length</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemsMin.map((item, index) => (
                        <tr key={item.id}>
                          <td>{index + 1 + pageMin * 10}</td>
                          <td>{item.market}</td>
                          <td>{item.minLength}</td>
                          <td>
                            <span
                              style={{
                                width: "10px",
                                height: "10px",
                                borderRadius: "50%",
                                backgroundColor: item.isLive ? "green" : "red",
                                display: "inline-block",
                                cursor: "pointer",
                              }}
                              onClick={() => handleLiveStatusMin(item)}
                            />
                          </td>
                          <td>
                            <FaEye
                              onClick={() => handleViewMin(item)}
                              className="me-2"
                              style={{ cursor: "pointer", fontSize: "18px" }}
                            />
                            <FaEdit
                              onClick={() => openEditMin(item)}
                              className="me-2"
                              style={{ cursor: "pointer", fontSize: "18px" }}
                            />
                            <FaTrash
                              onClick={() => handleDeleteMin(item)}
                              style={{ cursor: "pointer", fontSize: "18px" }}
                            />
                          </td>
                        </tr>
                      ))}
                      {isLoading && (
                        <tr>
                          <td colSpan={5} className="text-center">
                            Loading...
                          </td>
                        </tr>
                      )}
                      {itemsMin.length === 0 && !isLoading && (
                        <tr>
                          <td colSpan={5} className="text-center">
                            No data found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                  <div className="d-flex justify-content-between mt-3">
                    <small>
                      Showing 1 to {itemsMin.length} of {totalPagesMin * 10}{" "}
                      entries
                    </small>
                    <Pagination>
                      <Pagination.Prev
                        disabled={pageMin === 0}
                        onClick={() => fetchMinLengthList(pageMin - 1)}
                      />
                      {[...Array(totalPagesMin).keys()].map((num) => (
                        <Pagination.Item
                          key={num}
                          active={num === pageMin}
                          onClick={() => fetchMinLengthList(num)}
                        >
                          {num + 1}
                        </Pagination.Item>
                      ))}
                      <Pagination.Next
                        disabled={pageMin === totalPagesMin - 1}
                        onClick={() => fetchMinLengthList(pageMin + 1)}
                      />
                    </Pagination>
                  </div>
                </Card.Body>
              </Card>
              <Modal
                show={showAllMinModal}
                onHide={closeAllMinModal}
                centered
                size="lg"
              >
                <Modal.Header closeButton>
                  <Modal.Title>All Minimum Lengths</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                  <Table striped bordered hover responsive>
                    <thead>
                      <tr>
                        <th>S/N</th>
                        <th>Market</th>
                        <th>Min Length</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemsMin.map((item, index) => (
                        <tr key={item.id}>
                          <td>{index + 1 + pageMin * 10}</td>
                          <td>{item.market}</td>
                          <td>{item.minLength}</td>
                          <td>{item.isLive ? "Active" : "Inactive"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Modal.Body>
                <Modal.Footer>
                  <Button variant="secondary" onClick={closeAllMinModal}>
                    Close
                  </Button>
                </Modal.Footer>
              </Modal>
              <Modal show={showModalMin} onHide={closeModalMin} centered>
                <Modal.Header closeButton>
                  <Modal.Title>
                    {isViewModeMin
                      ? "View Min Length"
                      : editingMin
                      ? "Update Min Length"
                      : "Create Min Length"}
                  </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                  <Form>
                    <Form.Group className="mb-3">
                      <Form.Label>Market</Form.Label>
                      <Form.Control
                        value={formDataMin.market}
                        onChange={(e) =>
                          setFormDataMin({
                            ...formDataMin,
                            market: e.target.value,
                          })
                        }
                        isInvalid={!!validationErrorsMin.market}
                        readOnly={isViewModeMin}
                      />
                      <Form.Control.Feedback type="invalid">
                        {validationErrorsMin.market}
                      </Form.Control.Feedback>
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label>Min Length</Form.Label>
                      <Form.Control
                        type="number"
                        value={formDataMin.minLength}
                        onChange={(e) =>
                          setFormDataMin({
                            ...formDataMin,
                            minLength: e.target.value,
                          })
                        }
                        isInvalid={!!validationErrorsMin.minLength}
                        readOnly={isViewModeMin}
                      />
                      <Form.Control.Feedback type="invalid">
                        {validationErrorsMin.minLength}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Form>
                </Modal.Body>
                <Modal.Footer>
                  <Button variant="secondary" onClick={closeModalMin}>
                    {isViewModeMin ? "Close" : "Cancel"}
                  </Button>
                  {!isViewModeOcc && (
                    <Button
                      variant="primary"
                      onClick={editingMin ? handleEditMin : saveMinLength}
                    >
                      {editingMin ? "Update" : "Create"}
                    </Button>
                  )}
                </Modal.Footer>
              </Modal>
              <Modal
                show={showLiveStatusModalMin}
                onHide={closeLiveStatusModalMin}
                centered
                size="sm"
              >
                <Modal.Header closeButton={!isLoading}>
                  <Modal.Title>Confirm Status Change</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                  <p>
                    Are you sure you want to{" "}
                    {selectedItemMin?.isLive ? "deactivate" : "activate"} this
                    min length?
                  </p>
                </Modal.Body>
                <Modal.Footer>
                  <Button
                    variant="secondary"
                    onClick={closeLiveStatusModalMin}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={confirmLiveStatusChangeMin}
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
            </Tab>
          </Tabs>
        </main>
      </div>
    </div>
  );
};

export default OccupancyAndMinimumLength;