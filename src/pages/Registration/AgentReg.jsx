import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  Button,
  Table,
  Modal,
  Form,
  Pagination,
  Row,
  Col,
} from "react-bootstrap";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";
import {
  FaEdit,
  FaTrash,
  FaEye,
  FaSignInAlt,
  FaCreditCard,
  FaBan,
} from "react-icons/fa";

// SearchableSelect Component
const SearchableSelect = ({ 
  options, 
  value, 
  onChange, 
  placeholder, 
  className, 
  isInvalid,
  name,
  disabled = false 
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
      const filtered = options.filter(option => {
        // Handle different possible data structures
        const optionName = option.name || option.countryName || option.stateName || option.placeName || String(option);
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
          value: option.id
        }
      });
      setIsOpen(false);
      setSearchTerm("");
    } catch (error) {
      console.error("Error in handleSelect:", error);
    }
  };

  const selectedOption = options?.find(option => String(option.id) === String(value));

  return (
    <div className="position-relative">
      <Form.Control
        type="text"
        value={isOpen ? searchTerm : (selectedOption?.name || selectedOption?.countryName || selectedOption?.stateName || selectedOption?.placeName || "")}
        onChange={(e) => {
          if (disabled) return;
          if (isOpen) {
            setSearchTerm(e.target.value);
          } else {
            // If not open, open dropdown and set search term
            setIsOpen(true);
            setSearchTerm(e.target.value);
          }
        }}
        onFocus={() => !disabled && setIsOpen(true)}
        placeholder={placeholder}
        className={`form-input ${isInvalid ? "is-invalid" : ""}`}
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
            top: "100%"
          }}
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <div
                key={option.id}
                className="px-3 py-2 cursor-pointer"
                style={{
                  cursor: "pointer",
                  borderBottom: "1px solid #eee"
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = "#f8f9fa";
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = "white";
                }}
                onClick={() => handleSelect(option)}
              >
                {option.name || option.countryName || option.stateName || option.placeName || String(option)}
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-muted">No options found</div>
          )}
        </div>
      )}
      
      {/* Overlay to close dropdown when clicking outside */}
      {isOpen && (
        <div
          className="position-fixed"
          style={{
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1040
          }}
          onClick={() => {
            setIsOpen(false);
            setSearchTerm("");
          }}
        />
      )}
    </div>
  );
};

const AgentReg = () => {
  const [items, setItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [isViewMode, setIsViewMode] = useState(false);

  // Helper function to get form control props based on view mode
  const getFormControlProps = (fieldName, onChangeHandler, additionalProps = {}) => {
    return {
      ...additionalProps,
      readOnly: isViewMode,
      onChange: isViewMode ? undefined : onChangeHandler,
      className: `${additionalProps.className || ""} ${isViewMode ? "bg-light" : ""}`.trim(),
      autoFocus: isViewMode ? false : additionalProps.autoFocus,
    };
  };
  const [agentCategoryies, setAgentCategoryies] = useState([]);
  const [countries, setCountries] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [places, setPlaces] = useState([]);
  const [markup, setMarkup] = useState([]);
  const [currency, setCurrency] = useState([]);
  const [formData, setFormData] = useState({
    companyName: "",
    shortName: "",
    businessType: "",
    agentCategoryId: "",
    companyCode: "",
    agentUrl: "",
    firstName: "",
    lastName: "",
    personalEmail: "",
    zipCode: "",
    mobileNumber: "",
    telephoneNumber: "",
    contactPerson: "",
    countryId: "",
    provinceId: "",
    placeId: "",
    address: "",
    markup: "",
    currency: "",
    status: "",
    agentLogo: null,
    agentGSTDetailsDTO: {
      agentClassification: "",
      agentGstIn: "",
      agentProvisionalGstno: "",
      agentCorrespondmail: "",
      agentRegisterstatus: "",
      agentHsncode: "",
      agentStatus: "",
    },
    financeManagerName: "",
    financeManagerContactNo: "",
    financeManagerEmail: "",
    gmName: "",
    gmContactNo: "",
    gmEmail: "",
    preferredClaimMethod: "",
    bankAccountHolderName: "",
    bankName: "",
    bankAccountNumber: "",
    bankIfscCode: "",
    bankBranchName: "",
  });

  const mapAgentToForm = (data) => ({
    companyName: data?.companyName || "",
    shortName: data?.shortName || "",
    businessType: data?.businessType || "",
    agentCategoryId: String(data?.agentCategoryId || ""),
    companyCode: data?.companyCode || "",
    agentUrl: data?.agentUrl || "",
    firstName: data?.firstName || "",
    lastName: data?.lastName || "",
    personalEmail: data?.personalEmail || "",
    zipCode: data?.zipCode || "",
    mobileNumber: data?.mobileNumber || "",
    telephoneNumber: data?.telephoneNumber || "",
    contactPerson: data?.contactPerson || "",
    countryId: String(data?.countryId || ""),
    provinceId: String(data?.provinceId || ""),
    placeId: String(data?.placeId || ""),
    address: data?.address || "",
    markup: String(data?.markup || ""),
    currency: String(data?.currency || ""),
    status: data?.status || "",
    agentLogo: null,
    financeManagerName: data?.financeManagerName || "",
    financeManagerContactNo: data?.financeManagerContactNo || "",
    financeManagerEmail: data?.financeManagerEmail || "",
    gmName: data?.gmName || "",
    gmContactNo: data?.gmContactNo || "",
    gmEmail: data?.gmEmail || "",
    preferredClaimMethod: data?.preferredClaimMethod || "",
    bankAccountHolderName: data?.bankAccountHolderName || "",
    bankName: data?.bankName || "",
    bankAccountNumber: data?.bankAccountNumber || "",
    bankIfscCode: data?.bankIfscCode || "",
    bankBranchName: data?.bankBranchName || "",
    agentGSTDetailsDTO: {
      agentClassification:
        data?.agentClassification ||
        data?.agentGSTDetailsDTO?.agentClassification ||
        "",
      agentGstIn:
        data?.agentGstIn ||
        data?.agentGSTDetailsDTO?.agentGstIn ||
        "",
      agentProvisionalGstno:
        data?.agentProvisionalGstno ||
        data?.agentGSTDetailsDTO?.agentProvisionalGstno ||
        "",
      agentCorrespondmail:
        data?.agentCorrespondmail ||
        data?.agentGSTDetailsDTO?.agentCorrespondmail ||
        "",
      agentRegisterstatus:
        data?.agentRegisterstatus ||
        data?.agentGSTDetailsDTO?.agentRegisterstatus ||
        "",
      agentHsncode:
        data?.agentHsncode ||
        data?.agentGSTDetailsDTO?.agentHsncode ||
        "",
      agentStatus:
        data?.agentStatus ||
        data?.agentGSTDetailsDTO?.agentStatus ||
        "",
    },
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [validationErrors, setValidationErrors] = useState({});
  const [gstinError, setGstinError] = useState("");
  const [currentStep, setCurrentStep] = useState(1);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRolesDropdown, setShowRolesDropdown] = useState(false);
  const [rolesList, setUserRolesList] = useState([]);
  const [loginModalKey, setLoginModalKey] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showRePassword, setShowRePassword] = useState(false);
  const [loginFormData, setLoginFormData] = useState({
    username: "",
    password: "",
    repassword: "",
    userroles: [], // Changed to array for multiple selection
  });
  const [loginErrors, setLoginErrors] = useState({
    username: "",
    password: "",
    repassword: "",
    userroles: "",
  });

  const [showCreditLimitModal, setShowCreditLimitModal] = useState(false);
  const [creditLimitType, setCreditLimitType] = useState("initial"); // "initial" or "update"
  const [hasInitialCredit, setHasInitialCredit] = useState(false);
  const [creditLimitFormData, setCreditLimitFormData] = useState({
    addCreditLimit: "",
    remarks: "",
    totalCreditLimit: "",
    availableCreditLimit: "",
    usedCreditLimit: "",
  });
  const [creditLimitErrors, setCreditLimitErrors] = useState({
    addCreditLimit: "",
    remarks: "",
  });
  const [showExclusionModal, setShowExclusionModal] = useState(false);
  const [exclusionFormData, setExclusionFormData] = useState({
    nationality: "",
    externalApi: [], // Changed to array for multiple selection
  });
  const [exclusionErrors, setExclusionErrors] = useState({
    nationality: "",
    externalApi: "",
  });
  const [showApiDropdown, setShowApiDropdown] = useState(false);

  // Static data for external APIs
  const externalApis = [
    { code: "Select", name: "Select" },
    // { code: "IWTX", name: "IWTX" },
    // { code: "X3", name: "X3" },
    { code: "INHOUSE", name: "INHOUSE" },
    // { code: "DARINA", name: "DARINA" },
    // { code: "RATEHAWK", name: "RATEHAWK" },
    // { code: "ATHARVA", name: "ATHARVA" },
    // { code: "JUMEIRAH", name: "JUMEIRAH" },
  ];


  // Helper function to convert file to base64
  const convertToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  const openCreate = () => {
    setEditing(null);
    setFormData({
      companyName: "",
      shortName: "",
      businessType: "",
      agentCategoryId: "",
      companyCode: "",
      agentUrl: "",
      firstName: "",
      lastName: "",
      personalEmail: "",
      zipCode: "",
      mobileNumber: "",
      telephoneNumber: "",
      contactPerson: "",
      countryId: "",
      provinceId: "",
      placeId: "",
      address: "",
      markup: "",
      currency: "",
      status: "",
      agentLogo: null,
      // GST Details as nested object to match AgentGSTDetailsDTO
      agentGSTDetailsDTO: {
        agentClassification: "",
        agentGstIn: "",
        agentProvisionalGstno: "",
        agentCorrespondmail: "",
        agentRegisterstatus: "",
        agentHsncode: "",
        agentStatus: "",
      },
      financeManagerName: "",
      financeManagerContactNo: "",
      financeManagerEmail: "",
      gmName: "",
      gmContactNo: "",
      gmEmail: "",
      preferredClaimMethod: "",
      bankAccountHolderName: "",
      bankName: "",
      bankAccountNumber: "",
      bankIfscCode: "",
      bankBranchName: "",
    });
    setProvinces([]);
    setPlaces([]);
    setValidationErrors({});
    setError("");
    setShowModal(true);
  };

  const openEdit = async (item) => {
    setIsViewMode(false);

    try {
      const res = await axiosInstance.get(`/api/agent/${item.id}`);
      const data = res.data;

      setEditing(data);
      setFormData(mapAgentToForm(data));

      if (data.countryId) {
        await provinceList(data.countryId);
        if (data.provinceId) {
          await cityList(data.provinceId);
        }
      }

      setValidationErrors({});
      setShowModal(true);
    } catch (error) {
      console.error("Error in openEdit:", error);
      toast.error("Failed to load agent details");
    }
  };

  const userRolesList = async () => {
    try {
      const rolesRes = await axiosInstance.get("/api/userRoles");
     // console.log("rolesRes::", rolesRes);
      setUserRolesList(rolesRes.data);
    } catch (error) {
     // console.log("User roles  api call error::", error);
    }
  };

  const agentCategoryList = async () => {
    try {
      const agentCatResponse = await axiosInstance.get("/api/agentCategory");
      setAgentCategoryies(agentCatResponse.data);
    } catch (error) {
     // console.log("agent category api call error::", error);
    }
  };

  const countryList = async () => {
    try {
      const response = await axiosInstance.get("/api/country");
     // console.log("Countries loaded:", response.data);
      setCountries(response.data);
    } catch (error) {
     // console.log("error for country list :", error);
    }
  };

  const provinceList = async (countryId) => {
    try {
      const response = await axiosInstance.get(
        `/api/province/getByCountryId/${countryId}`
      );
      setProvinces(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
     // console.log("axios call error for province list : ", error);
    }
  };

  const cityList = async (stateId) => {
    try {
      const response = await axiosInstance.get(`/api/destination/getplaces/${stateId}`);
      setPlaces(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
     // console.log("axios call error for city list : ", error);
    }
  };

  const markupList = async () => {
    try {
      const response = await axiosInstance.get(`/api/markupType`);
      setMarkup(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
     // console.log("axios call error for markup list : ", error);
    }
  };

  const currencyList = async () => {
    try {
      const response = await axiosInstance.get(`/api/currency`);
      setCurrency(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
     // console.log("axios call error for currency list : ", error);
    }
  };

  useEffect(() => {
    // Only clear provinces/cities if we're not in edit mode or if country actually changed
    if (formData.countryId) {
      // Don't clear if we're in edit mode and just opened the modal
      if (!editing) {
        setProvinces([]);
        setPlaces([]);
        setFormData((prev) => ({
          ...prev,
          provinceId: "",
          placeId: "",
        }));
      }
      provinceList(formData.countryId);
    } else {
      setProvinces([]);
      setPlaces([]);
      setFormData((prev) => ({
        ...prev,
        provinceId: "",
        placeId: "",
      }));
    }
  }, [formData.countryId]);

  useEffect(() => {
    // Only clear cities if we're not in edit mode or if province actually changed
    if (formData.provinceId) {
      // Don't clear if we're in edit mode and just opened the modal
      if (!editing) {
        setPlaces([]);
        setFormData((prev) => ({
          ...prev,
          placeId: "",
        }));
      }
      cityList(formData.provinceId);
    } else {
      setPlaces([]);
      setFormData((prev) => ({
        ...prev,
        placeId: "",
      }));
    }
  }, [formData.provinceId]);

  const handleEdit = async () => {
    const errors = validateAgentForm(formData);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    if (!editing) return;

    try {
      setIsLoading(true);

      // Prepare the payload - convert image to base64 if present
      const agentPayload = { ...formData };

      // Handle image upload - convert to base64 if present
      if (agentPayload.agentLogo && agentPayload.agentLogo instanceof File) {
        try {
          const base64 = await convertToBase64(agentPayload.agentLogo);
          agentPayload.agentLogo = base64;
        } catch (error) {
          console.error("Error converting image to base64:", error);
          toast.error("Error processing image file");
          return;
        }
      } else {
        // If no new image is selected, remove the agentLogo field
        // The backend will keep the existing image
        delete agentPayload.agentLogo;
      }

      // Ensure numeric fields are properly converted
      if (agentPayload.countryId) {
        agentPayload.countryId = parseInt(agentPayload.countryId);
      }
      if (agentPayload.provinceId) {
        agentPayload.provinceId = parseInt(agentPayload.provinceId);
      }
      if (agentPayload.placeId) {
        agentPayload.placeId = parseInt(agentPayload.placeId);
      }
      if (agentPayload.agentCategoryId) {
        agentPayload.agentCategoryId = parseInt(agentPayload.agentCategoryId);
      }
      if (agentPayload.markup) {
        agentPayload.markup = parseInt(agentPayload.markup);
      }
      if (agentPayload.currency) {
        agentPayload.currency = parseInt(agentPayload.currency);
      }

     // console.log("Edit payload:", agentPayload);
     // console.log("Editing agent ID:", editing?.id);

      const editRes = await axiosInstance.put(
        `/api/agent/${editing?.id}`,
        agentPayload
      );

     // console.log("Edit response:", editRes);

      if (editRes.data) {
        toast.success("Agent Updated Successfully!");
        setValidationErrors({});
        await fetchAgentList(page, search);
        closeModal();
      }
    } catch (error) {
      console.error("Edit agent error:", error);
      console.error("Error details:", error.response?.data);
      setError("Failed to update agent");
      toast.error(
        `Failed to update agent: ${
          error.response?.data?.message || error.message
        }`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setIsViewMode(false); // Reset view mode
    setFormData({
      companyName: "",
      shortName: "",
      businessType: "",
      agentCategoryId: "",
      companyCode: "",
      agentUrl: "",
      firstName: "",
      lastName: "",
      personalEmail: "",
      zipCode: "",
      mobileNumber: "",
      telephoneNumber: "",
      contactPerson: "",
      countryId: "",
      provinceId: "",
      placeId: "",
      address: "",
      markup: "",
      currency: "",
      status: "",
      agentClassification: "",
      agentGstIn: "",
      agentProvisionalGstno: "",
      agentCorrespondmail: "",
      agentRegisterstatus: "",
      agentHsncode: "",
      agentLogo: null,
      financeManagerName: "",
      financeManagerContactNo: "",
      financeManagerEmail: "",
      gmName: "",
      gmContactNo: "",
      gmEmail: "",
      preferredClaimMethod: "",
      bankAccountHolderName: "",
      bankName: "",
      bankAccountNumber: "",
      bankIfscCode: "",
      bankBranchName: "",
    });
    setProvinces([]);
    setPlaces([]);
    setValidationErrors({});
    setGstinError("");
    setError("");
  };

  const fetchAgentList = async (pageNum = 0, searchTerm = search) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: "10",
      });

      if (searchTerm && searchTerm.trim()) {
        params.append("search", searchTerm.trim());
      }

      const res = await axiosInstance.get(`/api/agent?${params.toString()}`);

      if (res.data && Array.isArray(res.data)) {
        setItems(res.data);
        if (res.data.length < 10) {
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
    } catch (err) {
      toast.error("Failed to load agents");
      setItems([]);
      setTotalPages(0);
      setPage(0);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAgentList();
    countryList();
    userRolesList();
    agentCategoryList();
    markupList();
    currencyList();
  }, []);

  // Close roles dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showRolesDropdown && !event.target.closest(".position-relative")) {
        setShowRolesDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showRolesDropdown]);

  // Close API dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showApiDropdown && !event.target.closest(".api-dropdown-container")) {
        setShowApiDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showApiDropdown]);


  // Validation function
  const validateAgentForm = (data) => {
       const newErrors = {};

    // Helper function to safely get string value
    const getStringValue = (value) => {
      return value ? String(value).trim() : "";
    };

    // Required field validations
    if (!getStringValue(data.companyName))
      newErrors.companyName = "Company Name is required";
    if (!getStringValue(data.businessType))
      newErrors.businessType = "Business Type is required";
    if (!data.agentCategoryId)
      newErrors.agentCategoryId = "Company Type or Agent category is required";
    if (!getStringValue(data.firstName))
      newErrors.firstName = "First Name is required";
    if (!getStringValue(data.lastName))
      newErrors.lastName = "Last Name is required";
    if (!getStringValue(data.mobileNumber))
      newErrors.mobileNumber = "Mobile Number is required";
    if (!getStringValue(data.personalEmail))
      newErrors.personalEmail = "Email ID is required";
    if (!data.countryId) newErrors.countryId = "Country is required";
    if (!data.provinceId) newErrors.provinceId = "Province is required";
    if (!data.placeId) newErrors.placeId = "City is required";
    if (!getStringValue(data.address))
      newErrors.address = "Address is required";
    if (!data.markup) newErrors.markup = "Markup is required";
    if (!data.currency) newErrors.currency = "Currency is required";
    if (!getStringValue(data.status)) newErrors.status = "Status is required";

    // Finance Manager validations
    if (!getStringValue(data.financeManagerName))
      newErrors.financeManagerName = "Finance Manager Name is required";
    if (!getStringValue(data.financeManagerContactNo))
      newErrors.financeManagerContactNo = "Finance Manager Contact No is required";
    if (!getStringValue(data.financeManagerEmail))
      newErrors.financeManagerEmail = "Finance Manager Email is required";

    // GM validations
    if (!getStringValue(data.gmName))
      newErrors.gmName = "GM Name is required";
    if (!getStringValue(data.gmContactNo))
      newErrors.gmContactNo = "GM Contact No is required";
    if (!getStringValue(data.gmEmail))
      newErrors.gmEmail = "GM Email is required";

    // Additional format validations
    const emailValue = getStringValue(data.personalEmail);
    if (emailValue && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue))
      newErrors.personalEmail = "Invalid email format";

    const fmEmail = getStringValue(data.financeManagerEmail);
    if (fmEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fmEmail))
      newErrors.financeManagerEmail = "Invalid Finance Manager email format";

    const gmEmailVal = getStringValue(data.gmEmail);
    if (gmEmailVal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(gmEmailVal))
      newErrors.gmEmail = "Invalid GM email format";

    const mobileValue = getStringValue(data.mobileNumber);
    if (mobileValue && !/^\+?\d{10,15}$/.test(mobileValue.replace(/\s/g, "")))
      newErrors.mobileNumber = "Mobile Number must be 10-15 digits";

    // Incentive claim method + bank details validation
    if (data.preferredClaimMethod === "BANK_TRANSFER") {
      if (!getStringValue(data.bankAccountHolderName))
        newErrors.bankAccountHolderName = "Account Holder Name is required";
      if (!getStringValue(data.bankName))
        newErrors.bankName = "Bank Name is required";
      if (!getStringValue(data.bankAccountNumber))
        newErrors.bankAccountNumber = "Account Number is required";
      if (!getStringValue(data.bankIfscCode))
        newErrors.bankIfscCode = "IFSC Code is required";
      if (!getStringValue(data.bankBranchName))
        newErrors.bankBranchName = "Branch Name is required";
    }

    // GST fields validation (only if country is India)
    if (String(data?.countryId) === "1") {
      const gstDetails = data?.agentGSTDetailsDTO;
      const gstInValue = getStringValue(gstDetails?.agentGstIn);
      const isRegistered = gstDetails?.agentClassification === "registered";

      if (isRegistered && !gstInValue) {
        newErrors["agentGSTDetailsDTO.agentGstIn"] =
          "GSTIN is required for Registered agents";
      } else if (gstInValue && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstInValue)) {
        newErrors["agentGSTDetailsDTO.agentGstIn"] = "Invalid GSTIN format";
      }

      const correspondMail = gstDetails?.agentCorrespondmail;
      if (isRegistered && (!correspondMail || !/\S+@\S+\.\S+/.test(correspondMail))) {
        newErrors["agentGSTDetailsDTO.agentCorrespondmail"] =
          "Valid Correspondent Email is required";
      }
    } else {
     // console.log("GST validation skipped - country is not India:", data.countryId );
    }

   // console.log("Final validation errors:", newErrors);
    return newErrors;
  };

  const saveAgent = async (e) => {
   // console.log("formdata::", formData);
    e.preventDefault();
    const errors = validateAgentForm(formData);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors); // keep errors in state to show on UI
      return;
    }

    try {
      setIsLoading(true);

      // Prepare the payload - convert image to base64 if present
      const agentPayload = { ...formData };

      // Handle image upload - convert to base64 if present
      if (agentPayload.agentLogo && agentPayload.agentLogo instanceof File) {
        try {
          const base64 = await convertToBase64(agentPayload.agentLogo);
          agentPayload.agentLogo = base64;
        } catch (error) {
          console.error("Error converting image to base64:", error);
          toast.error("Error processing image file");
          return;
        }
      } else {
        // Remove the file object if no file is selected
        delete agentPayload.agentLogo;
      }

      // Ensure numeric fields are properly converted
      if (agentPayload.countryId) {
        agentPayload.countryId = parseInt(agentPayload.countryId);
      }
      if (agentPayload.provinceId) {
        agentPayload.provinceId = parseInt(agentPayload.provinceId);
      }
      if (agentPayload.placeId) {
        agentPayload.placeId = parseInt(agentPayload.placeId);
      }
      if (agentPayload.agentCategoryId) {
        agentPayload.agentCategoryId = parseInt(agentPayload.agentCategoryId);
      }
      if (agentPayload.markup) {
        agentPayload.markup = parseInt(agentPayload.markup);
      }
      if (agentPayload.currency) {
        agentPayload.currency = parseInt(agentPayload.currency);
      }

     // console.log("agentPayload::", agentPayload);

      const agentSaveRes = await axiosInstance.post(
        "/api/agent/register",
        agentPayload
      );

      if (agentSaveRes.data !== 0) {
        toast.success("Agent added Successfully!");
        setValidationErrors({});
        await fetchAgentList(page, search);
        closeModal();
      }
    } catch (error) {
      console.error("Save agent error:", error);
      console.error("Error details:", error.response?.data);
      setError("Sorry! Data not saved to db..");
      toast.error(
        `Failed to save agent data: ${
          error.response?.data?.message || error.message
        }`
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchAgentList(0, search);
    }, 500);

    return () => clearTimeout(delayDebounce);
  }, [search]);

  const handleDelete = (item) => {
    Swal.fire({
      title: `Are you sure? You want to delete ${item.companyName}`,
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
          .delete(`/api/agent/${item.id}`)
          .then(() => {
            toast.success("Agent deleted successfully");
            fetchAgentList(page, search);
          })
          .catch(() => {
            toast.error("Sorry!! Agent not deleted");
          });
      }
    });
  };

  const handleView = async (item) => {
    setIsViewMode(true);

    try {
      const res = await axiosInstance.get(`/api/agent/${item.id}`);
      const data = res.data;

      setEditing(data);
      setFormData(mapAgentToForm(data));

      if (data.countryId) {
        await provinceList(data.countryId);
        if (data.provinceId) {
          await cityList(data.provinceId);
        }
      }

      setValidationErrors({});
      setShowModal(true);
    } catch (error) {
      console.error("Error in handleView:", error);
      toast.error("Failed to load agent details");
    }
  };

  const handleLogin = async (item) => {
   // console.log("=== LOGIN MODAL OPENED ===");
   // console.log("Agent clicked:", item);
   // console.log("Timestamp:", new Date().toISOString());

    setEditing(item);

    // Reset form data first
    setLoginFormData({
      username: "",
      password: "",
      repassword: "",
      userroles: [],
    });

    setLoginErrors({
      username: "",
      password: "",
      repassword: "",
      userroles: "",
    });

    setShowRolesDropdown(false);
    setShowPassword(false);
    setShowRePassword(false);

    // Fetch existing login data for this agent
    try {
     // console.log("Fetching existing login data for agent:", item.id);
      const response = await axiosInstance.post(
        `/auth/checkRegisteredUserExist/${item.id}`
      );

      if (response.data) {
       // console.log("Existing login data found:", response.data);

        // Safely check both key variations
        const userNameValue = response.data.userName || response.data.username || "";

       // console.log("username:", userNameValue);

        // Populate form with existing data
        setLoginFormData({
          username: userNameValue,     // actual username
          password: "",                // don't set this from username
          repassword: "",              // same here
          userroles: [],               // fetch separately if needed
        });

       // console.log("Form populated with existing data");
      } else {
       // console.log("No existing login data found for agent:", item.id);
      }
    } catch (error) {
     // console.log("No existing login data found or error fetching:", error);
      // This is normal for agents with no existing login credentials
    }

    // Force modal re-render with new key
    setLoginModalKey((prev) => prev + 1);

    // Show modal
    setShowLoginModal(true);
   // console.log("Modal opened with data loaded");
  };

  const handleLoginSubmit = async () => {
    let isValid = true;
    const errors = {
      username: "",
      password: "",
      repassword: "",
      userroles: "",
    };

    if (!loginFormData.username.trim()) {
      errors.username = "Username is required";
      isValid = false;
    } else if (loginFormData.username.length < 4) {
      errors.username = "Username must be at least 4 characters long";
      isValid = false;
    } else if (!/^[a-zA-Z0-9_]+$/.test(loginFormData.username)) {
      errors.username =
        "Username can only contain letters, numbers, and underscores";
      isValid = false;
    }

    if (!loginFormData.password) {
      errors.password = "Password is required";
      isValid = false;
    } else if (loginFormData.password.length < 8) {
      errors.password = "Password must be at least 8 characters long";
      isValid = false;
    } else if (!/(?=.*[A-Z])(?=.*[0-9])/.test(loginFormData.password)) {
      errors.password =
        "Password must contain at least one uppercase letter and one number";
      isValid = false;
    }

    if (!loginFormData.repassword) {
      errors.repassword = "Please confirm your password";
      isValid = false;
    } else if (loginFormData.password !== loginFormData.repassword) {
      errors.repassword = "Passwords do not match";
      isValid = false;
    }

    if (!loginFormData.userroles || loginFormData.userroles.length === 0) {
      errors.userroles = "At least one user role is required";
      isValid = false;
    }

    setLoginErrors(errors);

    if (isValid) {
      try {
        setIsLoading(true);

        let activeUserRole = localStorage.getItem("currentActiveRole");
       // console.log("currentActiveRole::", activeUserRole);
        console.log("roleslist::", rolesList);

        let activeRoleObj = rolesList.find((role) => role.roleName === "AGENT");

        let loginPayload = null;

        if (activeRoleObj) {
         // console.log("Active role exists in rolesList:", activeUserRole);
         // console.log("activeRoleObj:", activeRoleObj);

          loginPayload = {
            userId: editing?.id,   // Agent ID
            userTypeId: activeRoleObj.id,
            userName: loginFormData.username,
            userRoleIds: loginFormData.userroles,
          };

          if (loginFormData.password) {
            loginPayload.password = loginFormData.password;
          }

       
        } else {
         // console.log("Active role not found in rolesList");
        }

        const response = await axiosInstance.post(
          "/auth/register",
          loginPayload
        );
       // console.log("login register success::", response);

        if (response.data) {
          toast.success("Login credentials saved successfully!");
          setLoginErrors({});
          closeLoginModal();
          await fetchAgentList(page, search);
        } else {
          toast.error(
            "Something went wrong!!Failed to save login credentials."
          );
        }
      } catch (error) {
        console.error("Login submission failed:", error);
        toast.error(
          `Failed to save login credentials: ${
            error.response?.data?.message || error.message
          }`
        );
      } finally {
        setIsLoading(false);
      }
    } else {
      toast.error("Please fix the errors in the form");
    }
  };

  const handleLoginChange = (e) => {
    const { name, value } = e.target;

    // Map the new field names back to the original state properties
    let fieldName = name;
    if (name === "login-username") fieldName = "username";
    else if (name === "login-password") fieldName = "password";
    else if (name === "login-repassword") fieldName = "repassword";

    setLoginFormData((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  };

  const toggleRole = (roleId) => {
    setLoginFormData((prev) => ({
      ...prev,
      userroles: prev.userroles.includes(roleId)
        ? prev.userroles.filter((id) => id !== roleId)
        : [...prev.userroles, roleId],
    }));

    // Close dropdown after selecting a role
    setShowRolesDropdown(false);
  };

  const removeRole = (roleId) => {
    setLoginFormData((prev) => ({
      ...prev,
      userroles: prev.userroles.filter((id) => id !== roleId),
    }));
  };

  // Toggle password visibility
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleRePasswordVisibility = () => {
    setShowRePassword(!showRePassword);
  };

  const closeLoginModal = () => {
    setShowLoginModal(false);
    setShowRolesDropdown(false);
    setShowPassword(false);
    setShowRePassword(false);
    setLoginModalKey((prev) => prev + 1); // Reset modal key
    setLoginFormData({
      username: "",
      password: "",
      repassword: "",
      userroles: [],
    });
    setLoginErrors({
      username: "",
      password: "",
      repassword: "",
      userroles: "",
    });
  };

  const handleCreditLimit = async (item) => {
   // console.log("Manage credit limit for agent:", item.companyName);
    setEditing(item);

    // Set default values for credit limit form
    setCreditLimitFormData({
      addCreditLimit: "",
      remarks: "",
      totalCreditLimit: "0",
      availableCreditLimit: "0",
      usedCreditLimit: "0",
    });

    setCreditLimitErrors({
      addCreditLimit: "",
      remarks: "",
    });

    // Fetch existing credit limit data
    try {
      const response = await axiosInstance.get(
        `/api/agent-credit-limit/agent/${item.id}`
      );
      const creditData = response.data;

      if (creditData && Number(creditData.totalCreditLimit) > 0) {
        // ✅ Existing credit
        setHasInitialCredit(true);
        setCreditLimitType("update");
        setCreditLimitFormData((prev) => ({
          ...prev,
          totalCreditLimit: creditData.totalCreditLimit || "0",
          availableCreditLimit: creditData.availableCreditLimit || "0",
          usedCreditLimit: creditData.usedCreditLimit || "0",
        }));
      } else {
        // ✅ New agent (no credit)
        setHasInitialCredit(false);
        setCreditLimitType("initial");
        setCreditLimitFormData({
          addCreditLimit: "",
          remarks: "",
          totalCreditLimit: "0",
          availableCreditLimit: "0",
          usedCreditLimit: "0",
        });
      }
    } catch (error) {
      console.error("Failed to fetch credit limit data:", error);
      // If no credit limit exists, we'll create one when adding credit
      setHasInitialCredit(false);
      setCreditLimitType("initial");
    }

    setShowCreditLimitModal(true);
  };

  const validateCreditLimitForm = (data, type) => {
    const newErrors = {};

    if (!data.addCreditLimit.trim()) {
      newErrors.addCreditLimit =
        type === "initial"
          ? "Add Credit Limit is required"
          : "Add-on Credit Limit is required";
    } else if (
      isNaN(data.addCreditLimit)
    ) {
      newErrors.addCreditLimit =
        type === "initial"
          ? "Add Credit Limit must be a number"
          : "Add-on Credit Limit must be a number";
    }

    // Only require remarks for update type
    if (type === "update" && !data.remarks.trim()) {
      newErrors.remarks = "Remarks is required";
    }

    return newErrors;
  };

  const handleCreditLimitSubmit = async () => {
    const errors = validateCreditLimitForm(
      creditLimitFormData,
      creditLimitType
    );
    if (Object.keys(errors).length > 0) {
      setCreditLimitErrors(errors);
      return;
    }

    try {
      setIsLoading(true);

      const addAmount = parseFloat(creditLimitFormData.addCreditLimit);
      let response;

      if (creditLimitType === "initial") {
        // Create initial credit limit
        const createPayload = {
          agentId: editing?.id,
          totalCreditLimit: addAmount,
        };

       // console.log("Creating initial credit limit:", createPayload);
        response = await axiosInstance.post(
          "/api/agent-credit-limit/create",
          null,
          {
            params: createPayload,
          }
        );
      } else {
        // Add to existing credit limit
        const addCreditPayload = {
          agentId: editing?.id,
          additionalCredit: addAmount,
          remarks: creditLimitFormData.remarks,
          totalCreditLimit: creditLimitFormData.totalCreditLimit,
          availableCreditLimit: creditLimitFormData.availableCreditLimit
         
        };

       console.log("Adding credit:", addCreditPayload);
        response = await axiosInstance.put(
          "/api/agent-credit-limit/update",
          addCreditPayload
        );
        
      }

      if (response.data) {
        const successMessage =
          creditLimitType === "initial"
            ? "Initial credit limit created successfully!"
            : "Credit limit updated successfully!";
        toast.success(successMessage);
        setCreditLimitErrors({});
        setHasInitialCredit(true); // Mark that initial credit now exists
        closeCreditLimitModal();
        // Refresh the agent list to show updated credit information
        await fetchAgentList(page, search);
      }
    } catch (error) {
      console.error("Credit limit update failed:", error);
      toast.error("Failed to update credit limit");
    } finally {
      setIsLoading(false);
    }
  };

  const closeCreditLimitModal = () => {
    setShowCreditLimitModal(false);
    setCreditLimitType("initial");
    setCreditLimitFormData({
      addCreditLimit: "",
      remarks: "",
      totalCreditLimit: "",
      availableCreditLimit: "",
      usedCreditLimit: "",
    });
    setCreditLimitErrors({
      addCreditLimit: "",
      remarks: "",
    });
  };

  const handleCreditLimitChange = (e) => {
    const { name, value } = e.target;
    setCreditLimitFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear error when user starts typing
    if (creditLimitErrors[name]) {
      setCreditLimitErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const handleCreditLimitTypeChange = (e) => {
    setCreditLimitType(e.target.value);
    // Clear form data when switching types
    setCreditLimitFormData((prev) => ({
      ...prev,
      addCreditLimit: "",
      remarks: "",
    }));
    // Clear errors
    setCreditLimitErrors({
      addCreditLimit: "",
      remarks: "",
    });
  };

  // Ensure countryId is always treated as a string
  const handleCountryChange = (e) => {
    try {
      const value = e.target.value;
      const selectedCountry = countries.find(country => String(country.id) === String(value));
      const countryName = selectedCountry?.name || selectedCountry?.countryName || "Unknown";
      
     setFormData((prev) => ({
        ...prev,
        countryId: String(value), // Explicitly convert to string
        provinceId: "", // Reset province when country changes
        placeId: "", // Reset city when country changes
      }));
      
      // Clear validation error when user makes selection
      if (validationErrors.countryId) {
        setValidationErrors(prev => ({
          ...prev,
          countryId: ""
        }));
      }
    } catch (error) {
      console.error("Error in handleCountryChange:", error);
    }
  };

  // Handle GSTIN input validation
  const handleGstinChange = (e) => {
    const value = e.target.value;

    // Check if Agent Classification is selected first
    if (!formData?.agentGSTDetailsDTO?.agentClassification) {
      setGstinError("Please select Agent Classification first.");
      return; // Don't update the form data
    }

    // Clear the error if classification is selected
    setGstinError("");

    // Update the form data with nested structure
    setFormData({
      ...formData,
      agentGSTDetailsDTO: {
        ...formData.agentGSTDetailsDTO,
        agentGstIn: value,
      },
    });

    // Clear validation error when user starts typing
    if (validationErrors["agentGSTDetailsDTO.agentGstIn"]) {
      setValidationErrors(prev => ({
        ...prev,
        "agentGSTDetailsDTO.agentGstIn": ""
      }));
    }
  };

  // Handle Agent Classification change
  const handleAgentClassificationChange = (e) => {
    const value = e.target.value;

    setFormData({
      ...formData,
      agentGSTDetailsDTO: {
        ...formData.agentGSTDetailsDTO,
        agentClassification: value,
      },
    });

    // Clear GSTIN error when classification is selected
    if (value) {
      setGstinError("");
    }
  };

  // Handle Agent Exclude function
  const handleAgentExclude = async (item) => {
   // console.log("Exclude agent:", item.companyName);
   // console.log("item:", item);
    setEditing(item);

    // Reset form data first
    setExclusionFormData({
      nationality: "",
      externalApi: [],
    });
    setExclusionErrors({
      nationality: "",
      externalApi: "",
    });

    // Fetch existing exclusions for this agent
    try {
     // console.log("Fetching existing exclusions for agent:", item.id);
      const response = await axiosInstance.get(
        `/api/agent-api-exclusion/agent/${item.id}`
      );

      if (response.data && Array.isArray(response.data)) {
        // Extract API codes from existing exclusions
        const existingApiCodes = response.data
          .map((exclusion) => exclusion.apiCode)
          .filter(Boolean);
       // console.log("Existing API exclusions found:", existingApiCodes);

        setExclusionFormData((prev) => ({
          ...prev,
          externalApi: existingApiCodes,
        }));
      } else {
       // console.log("No existing exclusions found for agent:", item.id);
      }
    } catch (error) {
     // console.log("No existing exclusions found or error fetching:", error);
      // This is normal for agents with no existing exclusions
    }

    setShowExclusionModal(true);
  };

  // Handle exclusion form change
  const handleExclusionChange = (e) => {
    const { name, value } = e.target;
    setExclusionFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear error when user starts typing
    if (exclusionErrors[name]) {
      setExclusionErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  // Handle API multi-select functionality
  const toggleApi = (apiCode) => {
    setExclusionFormData((prev) => ({
      ...prev,
      externalApi: prev.externalApi.includes(apiCode)
        ? prev.externalApi.filter((code) => code !== apiCode)
        : [...prev.externalApi, apiCode],
    }));

    // Clear error when user selects an API
    if (exclusionErrors.externalApi) {
      setExclusionErrors((prev) => ({
        ...prev,
        externalApi: "",
      }));
    }

    // Close dropdown after selecting an API
    setShowApiDropdown(false);
  };

  const removeApi = (apiCode) => {
    // Remove from form data
    setExclusionFormData((prev) => ({
      ...prev,
      externalApi: prev.externalApi.filter((code) => code !== apiCode),
    }));
  };

  // Validate exclusion form
  const validateExclusionForm = (data) => {
    const newErrors = {};

    // if (!data.nationality.trim()) {
    //   newErrors.nationality = "Nationality is required";
    // }

    // if (!data.externalApi || data.externalApi.length === 0) {
    //   newErrors.externalApi = "At least one External API is required";
    // }

    return newErrors;
  };

  // Handle exclusion form submit
  const handleExclusionSubmit = async () => {
    const errors = validateExclusionForm(exclusionFormData);
    if (Object.keys(errors).length > 0) {
      setExclusionErrors(errors);
      return;
    }

    try {
      setIsLoading(true);

      // Fetch existing exclusions to determine additions and deletions
      let existingApiCodes = [];
      try {
        const existingResponse = await axiosInstance.get(
          `/api/agent-api-exclusion/agent/${editing?.id}`
        );
        if (existingResponse.data && Array.isArray(existingResponse.data)) {
          existingApiCodes = existingResponse.data
            .map((exclusion) => exclusion.apiCode)
            .filter(Boolean);
        }
      } catch (error) {
        console.log("No existing exclusions found or error fetching:", error);
      }

      // APIs to add (in selection but not in backend)
      const newApiCodes = exclusionFormData.externalApi.filter(
        (apiCode) => !existingApiCodes.includes(apiCode)
      );

      // APIs to remove (in backend but not in selection)
      const removedApiCodes = existingApiCodes.filter(
        (apiCode) => !exclusionFormData.externalApi.includes(apiCode)
      );

      if (newApiCodes.length === 0 && removedApiCodes.length === 0) {
        toast.info("No changes made to API exclusions.");
        setIsLoading(false);
        return;
      }

      const promises = [];

      // Add POST promises for new exclusions
      newApiCodes.forEach((apiCode) => {
        const exclusionPayload = {
          agentId: editing?.id,
          nationality: exclusionFormData.nationality,
          apiCode: apiCode,
        };
        promises.push(
          axiosInstance.post("/api/agent-api-exclusion/exclude", exclusionPayload)
        );
      });

      // Add DELETE promises for removed exclusions
      removedApiCodes.forEach((apiCode) => {
        promises.push(
          axiosInstance.delete(
            `/api/agent-api-exclusion/agent/${editing?.id}/api/${apiCode}`
          )
        );
      });

      await Promise.all(promises);

      toast.success("API exclusions updated successfully!", {
        duration: 1000,
      });

      setExclusionErrors({});
      closeExclusionModal();
      // Refresh the agent list
      await fetchAgentList(page, search);
    } catch (error) {
      console.error("Exclusion submission failed:", error);
      toast.error("Failed to update API exclusions. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Close exclusion modal
  const closeExclusionModal = () => {
    setShowExclusionModal(false);
    setExclusionFormData({
      nationality: "",
      externalApi: [],
    });
    setExclusionErrors({
      nationality: "",
      externalApi: "",
    });
    setShowApiDropdown(false);
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Card className="shadow-sm rounded-xl">
            <Card.Header className="d-flex justify-content-between align-items-center">
              <span className="fw-semibold">Agent</span>
              <Form.Group className="hotel-search-bar">
                <Form.Control
                  type="text"
                  placeholder="Search agent by name..."
                  className="form-control-modern-sm"
                  value={searchTerm}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSearchTerm(value);
                    setSearch(value);
                  }}
                />
              </Form.Group>
              <Button className="btn-green" onClick={openCreate}>
                + Create
              </Button>
            </Card.Header>
            <Card.Body className="p-0">
              <Table responsive hover striped className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th style={{ width: 100 }}>S/N</th>
                    <th>Agent Name</th>
                    <th>Business Type</th>
                    <th style={{ width: 160 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.id}>
                      <td>{index + 1 + page * 10}</td>
                      <td>{item.companyName}</td>
                      <td>{item.businessType}</td>
                      <td>
                        <div className="d-flex gap-2">
                          <FaEdit
                            className="text-primary edit"
                            style={{ cursor: "pointer", fontSize: "18px" }}
                            onClick={() => openEdit(item)}
                            title="Edit"
                          />
                          <FaEye
                            className="text-info view"
                            style={{ cursor: "pointer", fontSize: "18px" }}
                            onClick={() => handleView(item)}
                            title="View"
                          />

                          <FaCreditCard
                            className="text-warning creditlimit"
                            style={{ cursor: "pointer", fontSize: "18px" }}
                            onClick={() => handleCreditLimit(item)}
                            title="Credit Limit"
                          />

                          <FaBan
                            className="text-secondary agentexclude"
                            style={{ cursor: "pointer", fontSize: "18px" }}
                            onClick={() => handleAgentExclude(item)}
                            title="Agent Exclude"
                          />

                          <FaTrash
                            className="text-danger delete"
                            style={{ cursor: "pointer", fontSize: "18px" }}
                            onClick={() => handleDelete(item)}
                            title="Delete"
                          />
                          <FaSignInAlt
                            className="text-success login"
                            style={{ cursor: "pointer", fontSize: "18px" }}
                            onClick={() => handleLogin(item)}
                            title="Login"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {isLoading && (
                    <tr>
                      <td colSpan={4} className="text-center text-muted py-4">
                        <div
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                        >
                          <span className="visually-hidden">Loading...</span>
                        </div>
                        Loading available agents...
                      </td>
                    </tr>
                  )}
                  {items.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan={4} className="text-center text-muted py-4">
                        No agents found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>

              {totalPages > 1 && (
                <div className="d-flex justify-content-between align-items-center p-3 border-top">
                  <div>
                    <small className="text-muted">
                      Showing {items.length} of {totalPages * 10} agents
                    </small>
                  </div>
                  <div>
                    <Pagination className="mb-0">
                      <Pagination.Prev
                        disabled={page === 0}
                        onClick={() => fetchAgentList(page - 1, search)}
                      />
                      {[...Array(totalPages).keys()].map((num) => (
                        <Pagination.Item
                          key={num}
                          active={num === page}
                          onClick={() => fetchAgentList(num, search)}
                        >
                          {num + 1}
                        </Pagination.Item>
                      ))}
                      <Pagination.Next
                        disabled={page === totalPages - 1}
                        onClick={() => fetchAgentList(page + 1, search)}
                      />
                    </Pagination>
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>

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
                {isViewMode ? "View Details" : (editing ? "Update Agent" : "Create Agent")}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form>
                <Card className="mb-3">
                  <Card.Header>Agent Details</Card.Header>
                  <Card.Body>
                    <Row>
                      <Col md={3}>
                        <Form.Group className="mb-3">
                          <Form.Label>Company Name</Form.Label>
                          <Form.Control
                            value={formData.companyName}
                            placeholder="Enter company name"
                            isInvalid={!!validationErrors.companyName}
                            {...getFormControlProps(
                              "companyName",
                              (e) => {
                                setFormData({
                                  ...formData,
                                  companyName: e.target.value,
                                });
                                // Clear validation error when user starts typing
                                if (validationErrors.companyName) {
                                  setValidationErrors(prev => ({
                                    ...prev,
                                    companyName: ""
                                  }));
                                }
                              },
                              {
                                className: `form-input ${
                                  validationErrors.companyName ? "is-invalid" : ""
                                }`,
                                autoFocus: true,
                              }
                            )}
                          />
                          {validationErrors.companyName && (
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.companyName}
                            </Form.Control.Feedback>
                          )}
                        </Form.Group>
                      </Col>
                      <Col md={3}>
                        <Form.Group className="mb-3">
                          <Form.Label>Short Name</Form.Label>
                          <Form.Control
                            value={formData.shortName}
                            placeholder="Enter short name"
                            isInvalid={!!validationErrors.shortName}
                            {...getFormControlProps(
                              "shortName",
                              (e) =>
                                setFormData({
                                  ...formData,
                                  shortName: e.target.value,
                                }),
                              {
                                className: `form-input ${
                                  validationErrors.shortName ? "is-invalid" : ""
                                }`,
                              }
                            )}
                          />
                          {validationErrors.shortName && (
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.shortName}
                            </Form.Control.Feedback>
                          )}
                        </Form.Group>
                      </Col>
                      <Col md={3}>
                        <Form.Group className="mb-3">
                          <Form.Label>Business Type</Form.Label>
                          <Form.Control
                            value={formData.businessType}
                            placeholder="Enter business name"
                            isInvalid={!!validationErrors.businessType}
                            {...getFormControlProps(
                              "businessType",
                              (e) => {
                                setFormData({
                                  ...formData,
                                  businessType: e.target.value,
                                });
                                // Clear validation error when user starts typing
                                if (validationErrors.businessType) {
                                  setValidationErrors(prev => ({
                                    ...prev,
                                    businessType: ""
                                  }));
                                }
                              },
                              {
                                className: `form-input ${
                                  validationErrors.businessType ? "is-invalid" : ""
                                }`,
                              }
                            )}
                          />
                          {validationErrors.businessType && (
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.businessType}
                            </Form.Control.Feedback>
                          )}
                        </Form.Group>
                      </Col>
                      <Col md={3}>
                        <Form.Group className="mb-3">
                          <Form.Label>Company Type</Form.Label>
                          <Form.Select
                            value={formData.agentCategoryId}
                            onChange={isViewMode ? undefined : (e) => {
                              setFormData({
                                ...formData,
                                agentCategoryId: e.target.value,
                              });
                              // Clear validation error when user makes selection
                              if (validationErrors.agentCategoryId) {
                                setValidationErrors(prev => ({
                                  ...prev,
                                  agentCategoryId: ""
                                }));
                              }
                            }}
                            className={`form-input ${
                              validationErrors.agentCategoryId
                                ? "is-invalid"
                                : ""
                            } ${isViewMode ? "bg-light" : ""}`}
                            isInvalid={!!validationErrors.agentCategoryId}
                            disabled={isViewMode}
                          >
                            <option value="">Select company type</option>
                            {agentCategoryies.map((agent) => (
                              <option
                                key={agent.agentCategoryId}
                                value={agent.agentCategoryId}
                              >
                                {agent.name}
                              </option>
                            ))}
                          </Form.Select>
                          {validationErrors.agentCategoryId && (
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.agentCategoryId}
                            </Form.Control.Feedback>
                          )}
                        </Form.Group>
                      </Col>
                    </Row>
                    <Row>
                      <Col md={3}>
                        <Form.Group className="mb-3">
                          <Form.Label>Company Code</Form.Label>
                          <Form.Control
                            value={formData.companyCode}
                            placeholder="Enter company code"
                            isInvalid={!!validationErrors.companyCode}
                            {...getFormControlProps(
                              "companyCode",
                              (e) =>
                                setFormData({
                                  ...formData,
                                  companyCode: e.target.value,
                                }),
                              {
                                className: `form-input ${
                                  validationErrors.companyCode ? "is-invalid" : ""
                                }`,
                              }
                            )}
                          />
                          {validationErrors.companyCode && (
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.companyCode}
                            </Form.Control.Feedback>
                          )}
                        </Form.Group>
                      </Col>
                      <Col md={3}>
                        <Form.Group className="mb-3">
                          <Form.Label>Agent URL</Form.Label>
                          <Form.Control
                            value={formData.agentUrl}
                            placeholder="Enter agent URL"
                            isInvalid={!!validationErrors.agentUrl}
                            {...getFormControlProps(
                              "agentUrl",
                              (e) =>
                                setFormData({
                                  ...formData,
                                  agentUrl: e.target.value,
                                }),
                              {
                                className: `form-input ${
                                  validationErrors.agentUrl ? "is-invalid" : ""
                                }`,
                              }
                            )}
                          />
                          {validationErrors.agentUrl && (
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.agentUrl}
                            </Form.Control.Feedback>
                          )}
                        </Form.Group>
                      </Col>
                      <Col md={3}>
                        <Form.Group className="mb-3">
                          <Form.Label>Company Logo</Form.Label>
                          <Form.Control
                            type="file"
                            accept="image/*"
                            onChange={isViewMode ? undefined : (e) =>
                              setFormData({
                                ...formData,
                                agentLogo: e.target.files[0],
                              })
                            }
                            disabled={isViewMode}
                            className={isViewMode ? "bg-light" : ""}
                          />
                        </Form.Group>
                      </Col>
                      <Col md={3}>
                        <Form.Group className="mb-3">
                          <Form.Label>First Name</Form.Label>
                          <Form.Control
                            value={formData.firstName}
                            placeholder="Enter first name"
                            isInvalid={!!validationErrors.firstName}
                            {...getFormControlProps(
                              "firstName",
                              (e) => {
                                setFormData({
                                  ...formData,
                                  firstName: e.target.value,
                                });
                                // Clear validation error when user starts typing
                                if (validationErrors.firstName) {
                                  setValidationErrors(prev => ({
                                    ...prev,
                                    firstName: ""
                                  }));
                                }
                              },
                              {
                                className: `form-input ${
                                  validationErrors.firstName ? "is-invalid" : ""
                                }`,
                              }
                            )}
                          />
                          {validationErrors.firstName && (
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.firstName}
                            </Form.Control.Feedback>
                          )}
                        </Form.Group>
                      </Col>
                      <Col md={3}>
                        <Form.Group className="mb-3">
                          <Form.Label>Last Name</Form.Label>
                          <Form.Control
                            value={formData.lastName}
                            placeholder="Enter last name"
                            isInvalid={!!validationErrors.lastName}
                            {...getFormControlProps(
                              "lastName",
                              (e) => {
                                setFormData({
                                  ...formData,
                                  lastName: e.target.value,
                                });
                                // Clear validation error when user starts typing
                                if (validationErrors.lastName) {
                                  setValidationErrors(prev => ({
                                    ...prev,
                                    lastName: ""
                                  }));
                                }
                              },
                              {
                                className: `form-input ${
                                  validationErrors.lastName ? "is-invalid" : ""
                                }`,
                              }
                            )}
                          />
                          {validationErrors.lastName && (
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.lastName}
                            </Form.Control.Feedback>
                          )}
                        </Form.Group>
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>

                <Row>
                  <Col md={8}>
                    <Card className="mb-3">
                      <Card.Header>Contact Details</Card.Header>
                      <Card.Body>
                        <Row>
                          <Col md={6}>
                            <Form.Group className="mb-3">
                              <Form.Label>Agent Email</Form.Label>
                              <Form.Control
                                value={formData.personalEmail}
                                placeholder="Enter email"
                                isInvalid={!!validationErrors.personalEmail}
                                {...getFormControlProps(
                                  "personalEmail",
                                  (e) => {
                                    setFormData({
                                      ...formData,
                                      personalEmail: e.target.value,
                                    });
                                    // Clear validation error when user starts typing
                                    if (validationErrors.personalEmail) {
                                      setValidationErrors(prev => ({
                                        ...prev,
                                        personalEmail: ""
                                      }));
                                    }
                                  },
                                  {
                                    className: `form-input ${
                                      validationErrors.personalEmail
                                        ? "is-invalid"
                                        : ""
                                    }`,
                                  }
                                )}
                              />

                              {validationErrors.personalEmail && (
                                <Form.Control.Feedback type="invalid">
                                  {validationErrors.personalEmail}
                                </Form.Control.Feedback>
                              )}
                            </Form.Group>
                          </Col>
                          <Col md={6}>
                            <Form.Group className="mb-3">
                              <Form.Label>Zip Code</Form.Label>
                              <Form.Control
                                value={formData.zipCode}
                                placeholder="Enter zip code"
                                {...getFormControlProps(
                                  "zipCode",
                                  (e) =>
                                    setFormData({
                                      ...formData,
                                      zipCode: e.target.value,
                                    }),
                                  {}
                                )}
                              />
                            </Form.Group>
                          </Col>
                        </Row>

                        <Row>
                          <Col md={6}>
                            <Form.Group className="mb-3">
                              <Form.Label>Mobile Number</Form.Label>
                              <Form.Control
                                value={formData.mobileNumber}
                                placeholder="Enter mobile number"
                                isInvalid={!!validationErrors.mobileNumber}
                                {...getFormControlProps(
                                  "mobileNumber",
                                  (e) => {
                                    setFormData({
                                      ...formData,
                                      mobileNumber: e.target.value,
                                    });
                                    // Clear validation error when user starts typing
                                    if (validationErrors.mobileNumber) {
                                      setValidationErrors(prev => ({
                                        ...prev,
                                        mobileNumber: ""
                                      }));
                                    }
                                  },
                                  {
                                    className: `form-input ${
                                      validationErrors.mobileNumber
                                        ? "is-invalid"
                                        : ""
                                    }`,
                                  }
                                )}
                              />

                              {validationErrors.mobileNumber && (
                                <Form.Control.Feedback type="invalid">
                                  {validationErrors.mobileNumber}
                                </Form.Control.Feedback>
                              )}
                            </Form.Group>
                          </Col>
                          <Col md={6}>
                            <Form.Group className="mb-3">
                              <Form.Label>Telephone Number</Form.Label>
                              <Form.Control
                                value={formData.telephoneNumber}
                                placeholder="Enter telephone number"
                                {...getFormControlProps(
                                  "telephoneNumber",
                                  (e) =>
                                    setFormData({
                                      ...formData,
                                      telephoneNumber: e.target.value,
                                    }),
                                  {}
                                )}
                              />
                            </Form.Group>
                          </Col>
                        </Row>
                        <Row>
                          <Col md={6}>
                            <Form.Group className="mb-3">
                              <Form.Label>Contact Person</Form.Label>
                              <Form.Control
                                value={formData.contactPerson}
                                placeholder="Enter contact person"
                                {...getFormControlProps(
                                  "contactPerson",
                                  (e) =>
                                    setFormData({
                                      ...formData,
                                      contactPerson: e.target.value,
                                    }),
                                  {}
                                )}
                              />
                            </Form.Group>
                          </Col>
                          <Col md={6}>
                            <Form.Group className="mb-3">
                              <Form.Label>Country</Form.Label>
                              <SearchableSelect
                                name="countryId"
                                value={formData.countryId}
                                onChange={handleCountryChange}
                                placeholder="Search and select country"
                                options={countries}
                                isInvalid={!!validationErrors.countryId}
                                disabled={isViewMode}
                              />
                              {validationErrors.countryId && (
                                <Form.Control.Feedback type="invalid">
                                  {validationErrors.countryId}
                                </Form.Control.Feedback>
                              )}
                            </Form.Group>
                          </Col>
                        </Row>
                        <Row>
                          <Col md={6}>
                            <Form.Group className="mb-3">
                              <Form.Label>Province</Form.Label>
                              <SearchableSelect
                                name="provinceId"
                                value={formData.provinceId}
                                onChange={(e) => {
                                  setFormData({
                                    ...formData,
                                    provinceId: e.target.value,
                                  });
                                  // Clear validation error when user makes selection
                                  if (validationErrors.provinceId) {
                                    setValidationErrors(prev => ({
                                      ...prev,
                                      provinceId: ""
                                    }));
                                  }
                                }}
                                placeholder="Search and select province/state"
                                options={Array.isArray(provinces) ? provinces.map(province => ({ id: province.id, name: province.stateName })) : []}
                                isInvalid={!!validationErrors.provinceId}
                                disabled={isViewMode || !formData.countryId}
                              />
                              {validationErrors.provinceId && (
                                <Form.Control.Feedback type="invalid">
                                  {validationErrors.provinceId}
                                </Form.Control.Feedback>
                              )}
                            </Form.Group>
                          </Col>
                          <Col md={6}>
                            <Form.Group className="mb-3">
                              <Form.Label>City</Form.Label>
                              <SearchableSelect
                                name="placeId"
                                value={formData.placeId}
                                onChange={(e) => {
                                  setFormData({
                                    ...formData,
                                    placeId: e.target.value,
                                  });
                                  // Clear validation error when user makes selection
                                  if (validationErrors.placeId) {
                                    setValidationErrors(prev => ({
                                      ...prev,
                                      placeId: ""
                                    }));
                                  }
                                }}
                                placeholder="Search and select city"
                                options={Array.isArray(places) ? places.map(place => ({ id: place.id, name: place.name })) : []}
                                isInvalid={!!validationErrors.placeId}
                                disabled={isViewMode || !formData.provinceId}
                              />
                              {validationErrors.placeId && (
                                <Form.Control.Feedback type="invalid">
                                  {validationErrors.placeId}
                                </Form.Control.Feedback>
                              )}
                            </Form.Group>
                          </Col>
                        </Row>
                        <Col md={12}>
                          <Form.Group className="mb-3">
                            <Form.Label>Address</Form.Label>
                            <Form.Control
                              as="textarea"
                              rows={3}
                              value={formData.address}
                              placeholder="Enter address"
                              isInvalid={!!validationErrors.address}
                              {...getFormControlProps(
                                "address",
                                (e) => {
                                  setFormData({
                                    ...formData,
                                    address: e.target.value,
                                  });
                                  // Clear validation error when user starts typing
                                  if (validationErrors.address) {
                                    setValidationErrors(prev => ({
                                      ...prev,
                                      address: ""
                                    }));
                                  }
                                },
                                {
                                  className: `form-input ${
                                    validationErrors.address ? "is-invalid" : ""
                                  }`,
                                }
                              )}
                            />
                            {validationErrors.address && (
                              <Form.Control.Feedback type="invalid">
                                {validationErrors.address}
                              </Form.Control.Feedback>
                            )}
                          </Form.Group>
                        </Col>

                        {/* Step 4: GST Details (India only) */}
                        {formData.countryId === "1" && (
                          <div
                            className="gstdetails"
                            style={{
                              border: "2px solid #007bff",
                              padding: "15px",
                              margin: "15px 0",
                              borderRadius: "5px",
                            }}
                          >
                            <div className="step-header">
                              <h3 className="step-title">
                                <svg
                                  width="24"
                                  height="24"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                  className="step-icon"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                GST Information
                              </h3>
                              <p className="step-description">
                                Tax registration details for Indian businesses
                              </p>
                            </div>

                            <Row className="g-3">
                              <Col md={6}>
                                <Form.Group>
                                  <Form.Label className="form-label">
                                    Agency Classification
                                  </Form.Label>
                                  <Form.Select
                                    name="agentClassification"
                                    value={
                                      formData.agentGSTDetailsDTO
                                        .agentClassification
                                    }
                                    onChange={isViewMode ? undefined : (e) =>
                                      setFormData({
                                        ...formData,
                                        agentGSTDetailsDTO: {
                                          ...formData.agentGSTDetailsDTO,
                                          agentClassification: e.target.value,
                                        },
                                      })
                                    }
                                    className={`form-input ${isViewMode ? "bg-light" : ""}`}
                                    disabled={isViewMode}
                                  >
                                    <option value="">
                                      Select classification
                                    </option>
                                    <option value="registered">
                                      Registered
                                    </option>
                                    <option value="unregistered">
                                      Unregistered
                                    </option>
                                  </Form.Select>
                                </Form.Group>
                              </Col>

                              <Col md={6}>
                                <Form.Group>
                                  <Form.Label className="form-label">
                                    GSTIN <span className="text-danger">*</span>
                                  </Form.Label>
                                  <Form.Control
                                    type="text"
                                    name="agentGstIn"
                                    value={
                                      formData.agentGSTDetailsDTO.agentGstIn
                                    }
                                    onChange={isViewMode ? undefined : handleGstinChange}
                                    placeholder="Enter 15-digit GSTIN"
                                    className={`form-input ${
                                      validationErrors[
                                        "agentGSTDetailsDTO.agentGstIn"
                                      ] || gstinError
                                        ? "is-invalid"
                                        : ""
                                    } ${isViewMode ? "bg-light" : ""}`}
                                    isInvalid={
                                      !!(
                                        validationErrors[
                                          "agentGSTDetailsDTO.agentGstIn"
                                        ] || gstinError
                                      )
                                    }
                                    maxLength={15}
                                    readOnly={isViewMode}
                                  />
                                  {(validationErrors[
                                    "agentGSTDetailsDTO.agentGstIn"
                                  ] ||
                                    gstinError) && (
                                    <Form.Control.Feedback type="invalid">
                                      {gstinError ||
                                        validationErrors[
                                          "agentGSTDetailsDTO.agentGstIn"
                                        ]}
                                    </Form.Control.Feedback>
                                  )}
                                </Form.Group>
                              </Col>

                              <Col md={6}>
                                <Form.Group>
                                  <Form.Label className="form-label">
                                    Provisional GST Number
                                  </Form.Label>
                                  <Form.Control
                                    type="text"
                                    name="agentProvisionalGstno"
                                    value={
                                      formData.agentGSTDetailsDTO
                                        .agentProvisionalGstno
                                    }
                                    onChange={isViewMode ? undefined : (e) =>
                                      setFormData({
                                        ...formData,
                                        agentGSTDetailsDTO: {
                                          ...formData.agentGSTDetailsDTO,
                                          agentProvisionalGstno: e.target.value,
                                        },
                                      })
                                    }
                                    placeholder="Enter provisional GST number"
                                    className={`form-input ${isViewMode ? "bg-light" : ""}`}
                                    maxLength={30}
                                    readOnly={isViewMode}
                                  />
                                </Form.Group>
                              </Col>

                              <Col md={6}>
                                <Form.Group>
                                  <Form.Label className="form-label">
                                    Correspondence Email
                                  </Form.Label>
                                  <Form.Control
                                    type="email"
                                    name="agentCorrespondmail"
                                    value={
                                      formData.agentGSTDetailsDTO
                                        .agentCorrespondmail
                                    }
                                    onChange={isViewMode ? undefined : (e) => {
                                      setFormData({
                                        ...formData,
                                        agentGSTDetailsDTO: {
                                          ...formData.agentGSTDetailsDTO,
                                          agentCorrespondmail: e.target.value,
                                        },
                                      });
                                      // Clear validation error when user starts typing
                                      if (validationErrors["agentGSTDetailsDTO.agentCorrespondmail"]) {
                                        setValidationErrors(prev => ({
                                          ...prev,
                                          "agentGSTDetailsDTO.agentCorrespondmail": ""
                                        }));
                                      }
                                    }}
                                    placeholder="Enter correspondence email"
                                    className={`form-input ${
                                      validationErrors[
                                        "agentGSTDetailsDTO.agentCorrespondmail"
                                      ]
                                        ? "is-invalid"
                                        : ""
                                    } ${isViewMode ? "bg-light" : ""}`}
                                    isInvalid={
                                      !!validationErrors[
                                        "agentGSTDetailsDTO.agentCorrespondmail"
                                      ]
                                    }
                                    readOnly={isViewMode}
                                  />
                                  {validationErrors[
                                    "agentGSTDetailsDTO.agentCorrespondmail"
                                  ] && (
                                    <Form.Control.Feedback type="invalid">
                                      {
                                        validationErrors[
                                          "agentGSTDetailsDTO.agentCorrespondmail"
                                        ]
                                      }
                                    </Form.Control.Feedback>
                                  )}
                                </Form.Group>
                              </Col>

                              <Col md={6}>
                                <Form.Group>
                                  <Form.Label className="form-label">
                                    GST Registration Status
                                  </Form.Label>
                                  <Form.Control
                                    type="text"
                                    name="agentRegisterstatus"
                                    value={
                                      formData.agentGSTDetailsDTO
                                        .agentRegisterstatus
                                    }
                                    onChange={isViewMode ? undefined : (e) =>
                                      setFormData({
                                        ...formData,
                                        agentGSTDetailsDTO: {
                                          ...formData.agentGSTDetailsDTO,
                                          agentRegisterstatus: e.target.value,
                                        },
                                      })
                                    }
                                    placeholder="Enter registration status"
                                    className={`form-input ${isViewMode ? "bg-light" : ""}`}
                                    maxLength={30}
                                    readOnly={isViewMode}
                                  />
                                </Form.Group>
                              </Col>

                              <Col md={6}>
                                <Form.Group>
                                  <Form.Label className="form-label">
                                    HSN/SAC Code
                                  </Form.Label>
                                  <Form.Control
                                    type="text"
                                    name="agentHsncode"
                                    value={
                                      formData.agentGSTDetailsDTO.agentHsncode
                                    }
                                    onChange={isViewMode ? undefined : (e) =>
                                      setFormData({
                                        ...formData,
                                        agentGSTDetailsDTO: {
                                          ...formData.agentGSTDetailsDTO,
                                          agentHsncode: e.target.value,
                                        },
                                      })
                                    }
                                    placeholder="Enter HSN/SAC code"
                                    className={`form-input ${isViewMode ? "bg-light" : ""}`}
                                    maxLength={30}
                                    readOnly={isViewMode}
                                  />
                                </Form.Group>
                              </Col>

                              <Col md={6}>
                                <Form.Group>
                                  <Form.Label className="form-label">
                                    Agent Status
                                  </Form.Label>
                                  <Form.Select
                                    name="agentStatus"
                                    value={
                                      formData.agentGSTDetailsDTO.agentStatus
                                    }
                                    onChange={isViewMode ? undefined : (e) =>
                                      setFormData({
                                        ...formData,
                                        agentGSTDetailsDTO: {
                                          ...formData.agentGSTDetailsDTO,
                                          agentStatus: e.target.value,
                                        },
                                      })
                                    }
                                    className={`form-input ${isViewMode ? "bg-light" : ""}`}
                                    disabled={isViewMode}
                                  >
                                    <option value="">Select Status</option>
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                    <option value="suspended">Suspended</option>
                                  </Form.Select>
                                </Form.Group>
                              </Col>
                            </Row>
                          </div>
                        )}
                      </Card.Body>
                    </Card>

                    {/* Finance Manager & GM Section */}
                    <Card className="mb-3">
                      <Card.Header>Finance Manager &amp; GM Details</Card.Header>
                      <Card.Body>
                        <h6 className="mb-3 text-primary">Finance Manager</h6>
                        <Row>
                          <Col md={6}>
                            <Form.Group className="mb-3">
                              <Form.Label>Name <span className="text-danger">*</span></Form.Label>
                              <Form.Control
                                value={formData.financeManagerName}
                                placeholder="Enter finance manager name"
                                isInvalid={!!validationErrors.financeManagerName}
                                {...getFormControlProps(
                                  "financeManagerName",
                                  (e) => {
                                    setFormData({ ...formData, financeManagerName: e.target.value });
                                    if (validationErrors.financeManagerName) {
                                      setValidationErrors(prev => ({ ...prev, financeManagerName: "" }));
                                    }
                                  },
                                  { className: `form-input ${validationErrors.financeManagerName ? "is-invalid" : ""}` }
                                )}
                              />
                              {validationErrors.financeManagerName && (
                                <Form.Control.Feedback type="invalid">
                                  {validationErrors.financeManagerName}
                                </Form.Control.Feedback>
                              )}
                            </Form.Group>
                          </Col>
                          <Col md={6}>
                            <Form.Group className="mb-3">
                              <Form.Label>Contact No <span className="text-danger">*</span></Form.Label>
                              <Form.Control
                                value={formData.financeManagerContactNo}
                                placeholder="Enter contact number"
                                isInvalid={!!validationErrors.financeManagerContactNo}
                                {...getFormControlProps(
                                  "financeManagerContactNo",
                                  (e) => {
                                    setFormData({ ...formData, financeManagerContactNo: e.target.value });
                                    if (validationErrors.financeManagerContactNo) {
                                      setValidationErrors(prev => ({ ...prev, financeManagerContactNo: "" }));
                                    }
                                  },
                                  { className: `form-input ${validationErrors.financeManagerContactNo ? "is-invalid" : ""}` }
                                )}
                              />
                              {validationErrors.financeManagerContactNo && (
                                <Form.Control.Feedback type="invalid">
                                  {validationErrors.financeManagerContactNo}
                                </Form.Control.Feedback>
                              )}
                            </Form.Group>
                          </Col>
                        </Row>
                        <Row>
                          <Col md={12}>
                            <Form.Group className="mb-3">
                              <Form.Label>Email <span className="text-danger">*</span></Form.Label>
                              <Form.Control
                                value={formData.financeManagerEmail}
                                placeholder="Enter finance manager email"
                                isInvalid={!!validationErrors.financeManagerEmail}
                                {...getFormControlProps(
                                  "financeManagerEmail",
                                  (e) => {
                                    setFormData({ ...formData, financeManagerEmail: e.target.value });
                                    if (validationErrors.financeManagerEmail) {
                                      setValidationErrors(prev => ({ ...prev, financeManagerEmail: "" }));
                                    }
                                  },
                                  { className: `form-input ${validationErrors.financeManagerEmail ? "is-invalid" : ""}` }
                                )}
                              />
                              {validationErrors.financeManagerEmail && (
                                <Form.Control.Feedback type="invalid">
                                  {validationErrors.financeManagerEmail}
                                </Form.Control.Feedback>
                              )}
                            </Form.Group>
                          </Col>
                        </Row>

                        <hr />
                        <h6 className="mb-3 text-primary">GM (General Manager)</h6>
                        <Row>
                          <Col md={6}>
                            <Form.Group className="mb-3">
                              <Form.Label>Name <span className="text-danger">*</span></Form.Label>
                              <Form.Control
                                value={formData.gmName}
                                placeholder="Enter GM name"
                                isInvalid={!!validationErrors.gmName}
                                {...getFormControlProps(
                                  "gmName",
                                  (e) => {
                                    setFormData({ ...formData, gmName: e.target.value });
                                    if (validationErrors.gmName) {
                                      setValidationErrors(prev => ({ ...prev, gmName: "" }));
                                    }
                                  },
                                  { className: `form-input ${validationErrors.gmName ? "is-invalid" : ""}` }
                                )}
                              />
                              {validationErrors.gmName && (
                                <Form.Control.Feedback type="invalid">
                                  {validationErrors.gmName}
                                </Form.Control.Feedback>
                              )}
                            </Form.Group>
                          </Col>
                          <Col md={6}>
                            <Form.Group className="mb-3">
                              <Form.Label>Contact No <span className="text-danger">*</span></Form.Label>
                              <Form.Control
                                value={formData.gmContactNo}
                                placeholder="Enter GM contact number"
                                isInvalid={!!validationErrors.gmContactNo}
                                {...getFormControlProps(
                                  "gmContactNo",
                                  (e) => {
                                    setFormData({ ...formData, gmContactNo: e.target.value });
                                    if (validationErrors.gmContactNo) {
                                      setValidationErrors(prev => ({ ...prev, gmContactNo: "" }));
                                    }
                                  },
                                  { className: `form-input ${validationErrors.gmContactNo ? "is-invalid" : ""}` }
                                )}
                              />
                              {validationErrors.gmContactNo && (
                                <Form.Control.Feedback type="invalid">
                                  {validationErrors.gmContactNo}
                                </Form.Control.Feedback>
                              )}
                            </Form.Group>
                          </Col>
                        </Row>
                        <Row>
                          <Col md={12}>
                            <Form.Group className="mb-3">
                              <Form.Label>Email <span className="text-danger">*</span></Form.Label>
                              <Form.Control
                                value={formData.gmEmail}
                                placeholder="Enter GM email"
                                isInvalid={!!validationErrors.gmEmail}
                                {...getFormControlProps(
                                  "gmEmail",
                                  (e) => {
                                    setFormData({ ...formData, gmEmail: e.target.value });
                                    if (validationErrors.gmEmail) {
                                      setValidationErrors(prev => ({ ...prev, gmEmail: "" }));
                                    }
                                  },
                                  { className: `form-input ${validationErrors.gmEmail ? "is-invalid" : ""}` }
                                )}
                              />
                              {validationErrors.gmEmail && (
                                <Form.Control.Feedback type="invalid">
                                  {validationErrors.gmEmail}
                                </Form.Control.Feedback>
                              )}
                            </Form.Group>
                          </Col>
                        </Row>
                      </Card.Body>
                    </Card>

                    {/* Incentive Claim Preferences */}
                    <Card className="mb-3">
                      <Card.Header>Incentive Claim Preferences</Card.Header>
                      <Card.Body>
                        <Row>
                          <Col md={6}>
                            <Form.Group className="mb-3">
                              <Form.Label>Preferred Incentive Claim Method</Form.Label>
                              <Form.Select
                                value={formData.preferredClaimMethod || ""}
                                onChange={
                                  isViewMode
                                    ? undefined
                                    : (e) => {
                                        const v = e.target.value;
                                        setFormData({
                                          ...formData,
                                          preferredClaimMethod: v,
                                          // Clear bank fields when switching away from BANK_TRANSFER
                                          ...(v !== "BANK_TRANSFER"
                                            ? {}
                                            : {}),
                                        });
                                      }
                                }
                                className={`form-input ${isViewMode ? "bg-light" : ""}`}
                                disabled={isViewMode}
                              >
                                <option value="">Select method</option>
                                <option value="CREDIT_LIMIT">
                                  Add to Credit Limit
                                </option>
                                <option value="BANK_TRANSFER">
                                  Transfer to Bank Account
                                </option>
                              </Form.Select>
                            </Form.Group>
                          </Col>
                        </Row>

                        {formData.preferredClaimMethod === "BANK_TRANSFER" && (
                          <div
                            style={{
                              border: "2px solid #28a745",
                              padding: "15px",
                              margin: "10px 0",
                              borderRadius: "5px",
                            }}
                          >
                            <h6 className="mb-3 text-success">Bank Details</h6>
                            <Row>
                              <Col md={6}>
                                <Form.Group className="mb-3">
                                  <Form.Label>
                                    Account Holder Name{" "}
                                    <span className="text-danger">*</span>
                                  </Form.Label>
                                  <Form.Control
                                    value={formData.bankAccountHolderName || ""}
                                    placeholder="Enter account holder name"
                                    isInvalid={!!validationErrors.bankAccountHolderName}
                                    {...getFormControlProps(
                                      "bankAccountHolderName",
                                      (e) => {
                                        setFormData({
                                          ...formData,
                                          bankAccountHolderName: e.target.value,
                                        });
                                        if (validationErrors.bankAccountHolderName) {
                                          setValidationErrors((prev) => ({
                                            ...prev,
                                            bankAccountHolderName: "",
                                          }));
                                        }
                                      },
                                      {
                                        className: `form-input ${
                                          validationErrors.bankAccountHolderName
                                            ? "is-invalid"
                                            : ""
                                        }`,
                                      }
                                    )}
                                  />
                                  {validationErrors.bankAccountHolderName && (
                                    <Form.Control.Feedback type="invalid">
                                      {validationErrors.bankAccountHolderName}
                                    </Form.Control.Feedback>
                                  )}
                                </Form.Group>
                              </Col>
                              <Col md={6}>
                                <Form.Group className="mb-3">
                                  <Form.Label>
                                    Bank Name{" "}
                                    <span className="text-danger">*</span>
                                  </Form.Label>
                                  <Form.Control
                                    value={formData.bankName || ""}
                                    placeholder="Enter bank name"
                                    isInvalid={!!validationErrors.bankName}
                                    {...getFormControlProps(
                                      "bankName",
                                      (e) => {
                                        setFormData({
                                          ...formData,
                                          bankName: e.target.value,
                                        });
                                        if (validationErrors.bankName) {
                                          setValidationErrors((prev) => ({
                                            ...prev,
                                            bankName: "",
                                          }));
                                        }
                                      },
                                      {
                                        className: `form-input ${
                                          validationErrors.bankName ? "is-invalid" : ""
                                        }`,
                                      }
                                    )}
                                  />
                                  {validationErrors.bankName && (
                                    <Form.Control.Feedback type="invalid">
                                      {validationErrors.bankName}
                                    </Form.Control.Feedback>
                                  )}
                                </Form.Group>
                              </Col>
                              <Col md={6}>
                                <Form.Group className="mb-3">
                                  <Form.Label>
                                    Account Number{" "}
                                    <span className="text-danger">*</span>
                                  </Form.Label>
                                  <Form.Control
                                    value={formData.bankAccountNumber || ""}
                                    placeholder="Enter account number"
                                    isInvalid={!!validationErrors.bankAccountNumber}
                                    {...getFormControlProps(
                                      "bankAccountNumber",
                                      (e) => {
                                        setFormData({
                                          ...formData,
                                          bankAccountNumber: e.target.value,
                                        });
                                        if (validationErrors.bankAccountNumber) {
                                          setValidationErrors((prev) => ({
                                            ...prev,
                                            bankAccountNumber: "",
                                          }));
                                        }
                                      },
                                      {
                                        className: `form-input ${
                                          validationErrors.bankAccountNumber
                                            ? "is-invalid"
                                            : ""
                                        }`,
                                      }
                                    )}
                                  />
                                  {validationErrors.bankAccountNumber && (
                                    <Form.Control.Feedback type="invalid">
                                      {validationErrors.bankAccountNumber}
                                    </Form.Control.Feedback>
                                  )}
                                </Form.Group>
                              </Col>
                              <Col md={6}>
                                <Form.Group className="mb-3">
                                  <Form.Label>
                                    IFSC Code <span className="text-danger">*</span>
                                  </Form.Label>
                                  <Form.Control
                                    value={formData.bankIfscCode || ""}
                                    placeholder="Enter IFSC code"
                                    isInvalid={!!validationErrors.bankIfscCode}
                                    {...getFormControlProps(
                                      "bankIfscCode",
                                      (e) => {
                                        setFormData({
                                          ...formData,
                                          bankIfscCode: e.target.value.toUpperCase(),
                                        });
                                        if (validationErrors.bankIfscCode) {
                                          setValidationErrors((prev) => ({
                                            ...prev,
                                            bankIfscCode: "",
                                          }));
                                        }
                                      },
                                      {
                                        className: `form-input ${
                                          validationErrors.bankIfscCode
                                            ? "is-invalid"
                                            : ""
                                        }`,
                                      }
                                    )}
                                  />
                                  {validationErrors.bankIfscCode && (
                                    <Form.Control.Feedback type="invalid">
                                      {validationErrors.bankIfscCode}
                                    </Form.Control.Feedback>
                                  )}
                                </Form.Group>
                              </Col>
                              <Col md={12}>
                                <Form.Group className="mb-3">
                                  <Form.Label>
                                    Branch Name <span className="text-danger">*</span>
                                  </Form.Label>
                                  <Form.Control
                                    value={formData.bankBranchName || ""}
                                    placeholder="Enter branch name"
                                    isInvalid={!!validationErrors.bankBranchName}
                                    {...getFormControlProps(
                                      "bankBranchName",
                                      (e) => {
                                        setFormData({
                                          ...formData,
                                          bankBranchName: e.target.value,
                                        });
                                        if (validationErrors.bankBranchName) {
                                          setValidationErrors((prev) => ({
                                            ...prev,
                                            bankBranchName: "",
                                          }));
                                        }
                                      },
                                      {
                                        className: `form-input ${
                                          validationErrors.bankBranchName
                                            ? "is-invalid"
                                            : ""
                                        }`,
                                      }
                                    )}
                                  />
                                  {validationErrors.bankBranchName && (
                                    <Form.Control.Feedback type="invalid">
                                      {validationErrors.bankBranchName}
                                    </Form.Control.Feedback>
                                  )}
                                </Form.Group>
                              </Col>
                            </Row>
                          </div>
                        )}
                      </Card.Body>
                    </Card>
                  </Col>

                  <Col md={4}>
                    <Card className="mb-3">
                      <Card.Header>Settings</Card.Header>
                      <Card.Body>
                        <Form.Group className="mb-3">
                          <Form.Label>Markup</Form.Label>
                          <Form.Select
                            value={formData.markup}
                            className={`form-input ${
                              validationErrors.markup ? "is-invalid" : ""
                            } ${isViewMode ? "bg-light" : ""}`}
                            onChange={isViewMode ? undefined : (e) => {
                              setFormData({
                                ...formData,
                                markup: e.target.value,
                              });
                              // Clear validation error when user makes selection
                              if (validationErrors.markup) {
                                setValidationErrors(prev => ({
                                  ...prev,
                                  markup: ""
                                }));
                              }
                            }}
                            disabled={isViewMode}
                          >
                            <option value="">Select Markup</option>
                            {Array.isArray(markup) &&
                              markup.map((mar) => (
                                <option key={mar.id} value={mar.id}>
                                  {mar.name}
                                </option>
                              ))}
                          </Form.Select>
                          {validationErrors.markup && (
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.markup}
                            </Form.Control.Feedback>
                          )}
                        </Form.Group>
                        <Form.Group className="mb-3">
                          <Form.Label>Currency</Form.Label>
                          <Form.Select
                            value={formData.currency}
                            className={`form-input ${
                              validationErrors.currency ? "is-invalid" : ""
                            } ${isViewMode ? "bg-light" : ""}`}
                            onChange={isViewMode ? undefined : (e) => {
                              setFormData({
                                ...formData,
                                currency: e.target.value,
                              });
                              // Clear validation error when user makes selection
                              if (validationErrors.currency) {
                                setValidationErrors(prev => ({
                                  ...prev,
                                  currency: ""
                                }));
                              }
                            }}
                            disabled={isViewMode}
                          >
                            <option value="">Select Currency</option>
                            {Array.isArray(currency) &&
                              currency.map((curr) => (
                                <option
                                  key={curr.currencyId}
                                  value={curr.currencyId}
                                >
                                  {curr.name}
                                </option>
                              ))}
                          </Form.Select>
                          {validationErrors.currency && (
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.currency}
                            </Form.Control.Feedback>
                          )}
                        </Form.Group>
                        <Form.Group className="mb-3">
                          <Form.Label>Status</Form.Label>
                          <Form.Select
                            value={formData.status}
                            className={`form-input ${
                              validationErrors.status ? "is-invalid" : ""
                            } ${isViewMode ? "bg-light" : ""}`}
                            onChange={isViewMode ? undefined : (e) => {
                              setFormData({
                                ...formData,
                                status: e.target.value,
                              });
                              // Clear validation error when user makes selection
                              if (validationErrors.status) {
                                setValidationErrors(prev => ({
                                  ...prev,
                                  status: ""
                                }));
                              }
                            }}
                            disabled={isViewMode}
                          >
                            <option value="">SELECT</option>
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                          </Form.Select>
                          {validationErrors.status && (
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.status}
                            </Form.Control.Feedback>
                          )}
                        </Form.Group>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
                {error && (
                  <Form.Control.Feedback type="invalid">
                    {error}
                  </Form.Control.Feedback>
                )}
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
                  className="btn-indigo"
                  onClick={editing ? handleEdit : saveAgent}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                        aria-hidden="true"
                      ></span>
                      {editing ? "Updating..." : "Saving..."}
                    </>
                  ) : editing ? (
                    "Update"
                  ) : (
                    "Save"
                  )}
                </Button>
              )}
            </Modal.Footer>
          </Modal>

          <Modal
            show={showLoginModal}
            onHide={closeLoginModal}
            centered
            key={loginModalKey}
            backdrop="static"
            keyboard={false}
          >
            <Modal.Header closeButton>
              <Modal.Title>
                {loginFormData.username && loginFormData.username.trim() !== ""
                  ? "Update"
                  : "Create"}{" "}
                Login for Agent: {editing?.companyName || editing?.agentName}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              {loginFormData.username &&
                loginFormData.username.trim() !== "" && (
                  <div className="alert alert-info mb-3">
                    <small>
                      <i className="fas fa-info-circle me-2"></i>
                      Existing login credentials found. You can update the
                      username and password.
                    </small>
                  </div>
                )}
              <Form className="loginForm">
                <Form.Group className="mb-3">
                  <Form.Label>Username</Form.Label>
                  <Form.Control
                    type="text"
                    name="login-username"
                    value={loginFormData.username}
                    onChange={handleLoginChange}
                    isInvalid={!!loginErrors.username}
                    placeholder="Enter username"
                    autoComplete="new-password"
                    autoFill="off"
                  />

                  <Form.Control.Feedback type="invalid">
                    {loginErrors.username}
                  </Form.Control.Feedback>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Password</Form.Label>
                  <div className="position-relative">
                    <Form.Control
                      type={showPassword ? "text" : "password"}
                      name="login-password"
                      value={loginFormData.password}
                      onChange={handleLoginChange}
                      isInvalid={!!loginErrors.password}
                      placeholder="Enter password"
                      autoComplete="new-password"
                      autoFill="off"
                      style={{ paddingRight: "40px" }}
                    />
                    <button
                      type="button"
                      className="btn btn-link position-absolute top-50 end-0 translate-middle-y"
                      style={{
                        border: "none",
                        background: "none",
                        color: "#6c757d",
                        padding: "0 12px",
                        zIndex: 10,
                      }}
                      onClick={togglePasswordVisibility}
                    >
                      {showPassword ? (
                        <i className="fas fa-eye-slash"></i>
                      ) : (
                        <i className="fas fa-eye"></i>
                      )}
                    </button>
                  </div>
                  <Form.Control.Feedback type="invalid">
                    {loginErrors.password}
                  </Form.Control.Feedback>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Re-enter Password</Form.Label>
                  <div className="position-relative">
                    <Form.Control
                      type={showRePassword ? "text" : "password"}
                      name="login-repassword"
                      value={loginFormData.repassword}
                      onChange={handleLoginChange}
                      isInvalid={!!loginErrors.repassword}
                      placeholder="Re-enter password"
                      autoComplete="new-password"
                      autoFill="off"
                      style={{ paddingRight: "40px" }}
                    />
                    <button
                      type="button"
                      className="btn btn-link position-absolute top-50 end-0 translate-middle-y"
                      style={{
                        border: "none",
                        background: "none",
                        color: "#6c757d",
                        padding: "0 12px",
                        zIndex: 10,
                      }}
                      onClick={toggleRePasswordVisibility}
                    >
                      {showRePassword ? (
                        <i className="fas fa-eye-slash"></i>
                      ) : (
                        <i className="fas fa-eye"></i>
                      )}
                    </button>
                  </div>
                  <Form.Control.Feedback type="invalid">
                    {loginErrors.repassword}
                  </Form.Control.Feedback>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>User Roles</Form.Label>
                  <div className="position-relative">
                    <div
                      className="form-control d-flex flex-wrap align-items-center"
                      style={{
                        minHeight: "38px",
                        padding: "4px 8px",
                        cursor: "pointer",
                      }}
                      onClick={() => {
                       // console.log("Clicking dropdown, current state:",showRolesDropdown);
                        setShowRolesDropdown(!showRolesDropdown);
                      }}
                    >
                      {console.log("rolesList length:::", rolesList.length)}
                      {loginFormData.userroles.length > 0 ? (
                        loginFormData.userroles.map((roleId) => {
                          const role = rolesList.find((r) => r.id === roleId);
                          return role ? (
                            <span
                              key={roleId}
                              className="badge bg-primary me-1 mb-1 d-flex align-items-center"
                              style={{ fontSize: "12px" }}
                            >
                              {role.roleName}
                              <button
                                type="button"
                                className="btn-close btn-close-white ms-1"
                                style={{ fontSize: "8px" }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeRole(roleId);
                                }}
                              ></button>
                            </span>
                          ) : null;
                        })
                      ) : (
                        <span className="text-muted">Select roles...</span>
                      )}
                    </div>

                    {showRolesDropdown && (
                      <div
                        className="position-absolute w-100 bg-white border rounded shadow-lg"
                        style={{
                          bottom: "100%",
                          left: 0,
                          zIndex: 9999,
                          maxHeight: "200px",
                          overflowY: "auto",
                          minHeight: "120px",
                          border: "2px solid #007bff",
                          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                          marginBottom: "2px",
                        }}
                      >
                        {console.log(
                          "Rendering dropdown with rolesList:",
                          rolesList
                        )}
                        {rolesList.map((role) => {
                          const isSelected = loginFormData.userroles.includes(
                            role.id
                          );
                         // console.log( "Rendering role:",role.id,role.);
                          return (
                            <div
                              key={role.id}
                              className={`px-3 py-2 ${
                                isSelected ? "bg-light text-muted" : ""
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRole(role.id);
                              }}
                              style={{
                                cursor: "pointer",
                                borderBottom: "1px solid #eee",
                              }}
                              onMouseEnter={(e) => {
                                if (!isSelected) {
                                  e.target.style.backgroundColor = "#f8f9fa";
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected) {
                                  e.target.style.backgroundColor = "";
                                }
                              }}
                            >
                              {role.roleName}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {/* <Form.Text className="text-muted">
                    Click to select multiple roles (Dropdown state: {showRolesDropdown ? 'Open' : 'Closed'})
                  </Form.Text> */}
                  {loginErrors.userroles && (
                    <div className="text-danger small mt-1">
                      {loginErrors.userroles}
                    </div>
                  )}
                </Form.Group>
              </Form>
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="secondary"
                onClick={closeLoginModal}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleLoginSubmit}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    ></span>
                    Saving...
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </Modal.Footer>
          </Modal>

          {/* Credit Limit Modal */}
          <Modal
            show={showCreditLimitModal}
            onHide={closeCreditLimitModal}
            centered
            size="md"
            backdrop="static"
            keyboard={false}
          >
            <Modal.Header closeButton={!isLoading}>
              <Modal.Title>
                Manage Credit Limit - {editing?.companyName}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form>
                {/* Radio Buttons for Credit Limit Type */}
                <Form.Group className="mb-4">
                  <Form.Label className="fw-bold">Select Action:</Form.Label>
                  <Row>
                    <Col xs="auto">
                      <Form.Check
                        type="radio"
                        id="initial-credit"
                        name="creditLimitType"
                        value="initial"
                        label="Add Initial Credit Limit"
                        checked={creditLimitType === "initial"}
                        onChange={handleCreditLimitTypeChange}
                        disabled={hasInitialCredit}
                        className="mb-2"
                      />
                    </Col>
                    <Col xs="auto">
                      <Form.Check
                        type="radio"
                        id="update-credit"
                        name="creditLimitType"
                        value="update"
                        label="Update Credit Limit"
                        checked={creditLimitType === "update"}
                        onChange={handleCreditLimitTypeChange}
                        disabled={!hasInitialCredit}
                        className="mb-2"
                      />
                    </Col>
                  </Row>
                </Form.Group>

                <hr className="my-3" />

                {/* Conditional Fields based on selected type */}
                {creditLimitType === "initial" ? (
                  // Add Initial Credit Limit Fields
                  <Row>
                    <Col md={12}>
                      <Form.Group className="mb-3">
                        <Form.Label>
                          <span className="text-danger">*</span>Add Credit Limit
                        </Form.Label>
                        <Form.Control
                          type="number"
                          name="addCreditLimit"
                          value={creditLimitFormData.addCreditLimit}
                          onChange={handleCreditLimitChange}
                          placeholder="Enter initial credit limit amount"
                          className={`form-input ${
                            creditLimitErrors.addCreditLimit ? "is-invalid" : ""
                          }`}
                          isInvalid={!!creditLimitErrors.addCreditLimit}
                          min="0"
                          step="0.01"
                        />
                        {creditLimitErrors.addCreditLimit && (
                          <Form.Control.Feedback type="invalid">
                            {creditLimitErrors.addCreditLimit}
                          </Form.Control.Feedback>
                        )}
                      </Form.Group>
                    </Col>
                  </Row>
                ) : (
                  // Update Credit Limit Fields
                  <>
                    <Row>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>
                            <span className="text-danger">*</span>Add-on Credit
                            Limit
                          </Form.Label>
                          <Form.Control
                            type="number"
                            name="addCreditLimit"
                            value={creditLimitFormData.addCreditLimit}
                            onChange={handleCreditLimitChange}
                            placeholder="Enter amount to add"
                            className={`form-input ${
                              creditLimitErrors.addCreditLimit
                                ? "is-invalid"
                                : ""
                            }`}
                            isInvalid={!!creditLimitErrors.addCreditLimit}
                            min="0"
                            step="0.01"
                          />
                          {creditLimitErrors.addCreditLimit && (
                            <Form.Control.Feedback type="invalid">
                              {creditLimitErrors.addCreditLimit}
                            </Form.Control.Feedback>
                          )}
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>
                            <span className="text-danger">*</span>Remarks
                          </Form.Label>
                          <Form.Control
                            as="textarea"
                            rows={3}
                            name="remarks"
                            value={creditLimitFormData.remarks}
                            onChange={handleCreditLimitChange}
                            placeholder="Enter remarks"
                            className={`form-input ${
                              creditLimitErrors.remarks ? "is-invalid" : ""
                            }`}
                            isInvalid={!!creditLimitErrors.remarks}
                          />
                          {creditLimitErrors.remarks && (
                            <Form.Control.Feedback type="invalid">
                              {creditLimitErrors.remarks}
                            </Form.Control.Feedback>
                          )}
                        </Form.Group>
                      </Col>
                    </Row>

                    <hr className="my-3" />

                    <Row>
                      <Col md={4}>
                        <Form.Group className="mb-3">
                          <Form.Label>Total Credit Limit</Form.Label>
                          <Form.Control
                            type="text"
                            value={creditLimitFormData.totalCreditLimit}
                            readOnly
                            className="form-control-plaintext bg-light"
                          />
                        </Form.Group>
                      </Col>
                      <Col md={4}>
                        <Form.Group className="mb-3">
                          <Form.Label>Available Credit Limit</Form.Label>
                          <Form.Control
                            type="text"
                            value={creditLimitFormData.availableCreditLimit}
                            readOnly
                            className="form-control-plaintext bg-light"
                          />
                        </Form.Group>
                      </Col>
                      <Col md={4}>
                        <Form.Group className="mb-3">
                          <Form.Label>Used Credit Limit</Form.Label>
                          <Form.Control
                            type="text"
                            value={creditLimitFormData.usedCreditLimit}
                            readOnly
                            className="form-control-plaintext bg-light"
                          />
                        </Form.Group>
                      </Col>
                    </Row>
                  </>
                )}
              </Form>
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="secondary"
                onClick={closeCreditLimitModal}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleCreditLimitSubmit}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    ></span>
                    {creditLimitType === "initial"
                      ? "Creating..."
                      : "Updating..."}
                  </>
                ) : creditLimitType === "initial" ? (
                  "Save"
                ) : (
                  "Update"
                )}
              </Button>
            </Modal.Footer>
          </Modal>

          {/* Agent Exclusion Modal */}
          <Modal
            show={showExclusionModal}
            onHide={closeExclusionModal}
            centered
            size="md"
            backdrop="static"
            keyboard={false}
          >
            <Modal.Header closeButton={!isLoading}>
              <Modal.Title>
                Agent Exclusion - {editing?.companyName}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form className="agent-exclude-form">
                {/* <Row>
                  <Col md={12}>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        <span className="text-danger">*</span>Exclude
                        Nationality
                      </Form.Label>
                      <Form.Select
                        name="nationality"
                        value={exclusionFormData.nationality}
                        onChange={handleExclusionChange}
                        className={`form-input ${
                          exclusionErrors.nationality ? "is-invalid" : ""
                        }`}
                        isInvalid={!!exclusionErrors.nationality}
                      >
                        <option value="">Select nationality to exclude</option>
                        {countries.map((country) => (
                          <option key={country.id} value={String(country.id)}>
                            {country.name}
                          </option>
                        ))}
                      </Form.Select>
                      {exclusionErrors.nationality && (
                        <Form.Control.Feedback type="invalid">
                          {exclusionErrors.nationality}
                        </Form.Control.Feedback>
                      )}
                    </Form.Group>
                  </Col>
                </Row> */}

                <Row>
                  <Col md={12}>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        <span className="text-danger">*</span>External API
                      </Form.Label>
                      <div className="api-dropdown-container position-relative">
                        {/* Multi-select dropdown for External APIs */}
                        <div
                          className={`form-control d-flex flex-wrap align-items-center ${
                            exclusionErrors.externalApi ? "is-invalid" : ""
                          }`}
                          style={{
                            minHeight: "38px",
                            cursor: "pointer",
                            border: exclusionErrors.externalApi
                              ? "1px solid #dc3545"
                              : "1px solid #ced4da",
                          }}
                          onClick={() => setShowApiDropdown(!showApiDropdown)}
                        >
                          {exclusionFormData.externalApi.length === 0 ? (
                            <span className="text-muted">
                              Select APIs to exclude
                            </span>
                          ) : (
                            exclusionFormData.externalApi.map((apiCode) => {
                              const api = externalApis.find(
                                (a) => a.code === apiCode
                              );
                              return (
                                <span
                                  key={apiCode}
                                  className="badge bg-primary me-1 mb-1 d-flex align-items-center"
                                  style={{ fontSize: "12px" }}
                                >
                                  {api?.name || apiCode}
                                  <button
                                    type="button"
                                    className="btn-close btn-close-white ms-1"
                                    style={{ fontSize: "8px" }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeApi(apiCode);
                                    }}
                                  ></button>
                                </span>
                              );
                            })
                          )}
                        </div>

                        {/* Dropdown list */}
                        {showApiDropdown && (
                          <div
                            className="position-absolute w-100 bg-white border rounded shadow-lg"
                            style={{
                              zIndex: 9999,
                              maxHeight: "200px",
                              overflowY: "auto",
                              minHeight: "120px",
                              border: "2px solid #007bff",
                              boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                              marginBottom: "2px",
                            }}
                          >
                            {externalApis.map((api) => {
                              const isSelected =
                                exclusionFormData.externalApi.includes(
                                  api.code
                                );
                              return (
                                <div
                                  key={api.code}
                                  className="px-3 py-2"
                                  style={{
                                    borderBottom: "1px solid #eee",
                                    cursor: isSelected
                                      ? "not-allowed"
                                      : "pointer",
                                    backgroundColor: "white",
                                    opacity: isSelected ? 0.5 : 1,
                                    color: isSelected ? "#6c757d" : "inherit",
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!isSelected) {
                                      e.target.style.backgroundColor =
                                        "#f8f9fa";
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!isSelected) {
                                      e.target.style.backgroundColor = "white";
                                    }
                                  }}
                                  onClick={() => {
                                    if (!isSelected) {
                                      toggleApi(api.code);
                                    }
                                  }}
                                >
                                  <div className="fw-small">{api.name}</div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {exclusionErrors.externalApi && (
                          <div className="invalid-feedback d-block">
                            {exclusionErrors.externalApi}
                          </div>
                        )}
                      </div>
                    </Form.Group>
                  </Col>
                </Row>

                <div className="alert alert-info">
                  <small>
                    <strong>Note:</strong> This will exclude the selected
                    external API for this agent. The agent will not be able to
                    access bookings through the selected API.
                  </small>
                </div>
              </Form>
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="secondary"
                onClick={closeExclusionModal}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleExclusionSubmit}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    ></span>
                    Submitting...
                  </>
                ) : (
                  "Submit Exclusion"
                )}
              </Button>
            </Modal.Footer>
          </Modal>
        </main>
      </div>
    </div>
  );
};

export default AgentReg;
