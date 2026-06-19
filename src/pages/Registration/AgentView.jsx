import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Card,
  Button,
  Row,
  Col,
  Modal,
  Form,
  Spinner,
} from "react-bootstrap";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";
import {
  FaEdit,
  FaTrash,
  FaSignInAlt,
  FaCreditCard,
  FaBan,
  FaArrowLeft,
  FaKey,
} from "react-icons/fa";

/**
 * Read-only details page for a single agent. Opened from the Agent list
 * View icon. The bottom action bar carries the rest of the actions that
 * used to live as icons in the list — Edit (re-opens the create/edit
 * modal back on the list page), Credit Limit, Exclude, Login and Delete.
 *
 * Login / Credit / Exclude / Delete modals are inline on this page so
 * the admin doesn't have to bounce back to the list to perform routine
 * follow-up actions on an agent they just opened.
 */
const Row2 = ({ label, value }) => (
  <Col md={6} className="mb-3">
    <div className="text-muted small mb-1">{label}</div>
    <div className="fw-semibold" style={{ minHeight: 22 }}>
      {value === null || value === undefined || value === "" ? (
        <span className="text-muted">—</span>
      ) : (
        String(value)
      )}
    </div>
  </Col>
);

const AgentView = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);

  // ---------- Login modal state (mirrors AgentReg) -----------------
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isAlreadyRegistered, setIsAlreadyRegistered] = useState(false);
  const [loginFormData, setLoginFormData] = useState({
    username: "",
    password: "",
    repassword: "",
    userroles: [],
  });
  const [loginErrors, setLoginErrors] = useState({
    username: "",
    password: "",
    repassword: "",
    userroles: "",
  });
  const [loginServerError, setLoginServerError] = useState("");
  const [rolesList, setRolesList] = useState([]);
  const [showRolesDropdown, setShowRolesDropdown] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showRePassword, setShowRePassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // ---------- Credit limit modal state -----------------------------
  const [showCreditLimitModal, setShowCreditLimitModal] = useState(false);
  const [creditLimitType, setCreditLimitType] = useState("initial");
  const [hasInitialCredit, setHasInitialCredit] = useState(false);
  const [creditRowExists, setCreditRowExists] = useState(false);
  const [creditLimitFormData, setCreditLimitFormData] = useState({
    addCreditLimit: "",
    remarks: "",
    totalCreditLimit: "0",
    availableCreditLimit: "0",
    usedCreditLimit: "0",
  });
  const [creditLimitErrors, setCreditLimitErrors] = useState({
    addCreditLimit: "",
    remarks: "",
  });

  // ---------- Exclusion modal state --------------------------------
  const [showExclusionModal, setShowExclusionModal] = useState(false);
  const [exclusionFormData, setExclusionFormData] = useState({
    nationality: "",
    externalApi: [],
  });
  const [exclusionErrors, setExclusionErrors] = useState({
    nationality: "",
    externalApi: "",
  });
  const [showApiDropdown, setShowApiDropdown] = useState(false);
  const externalApis = [
    { code: "Select", name: "Select" },
    { code: "INHOUSE", name: "INHOUSE" },
  ];

  // ---------- Data fetch -------------------------------------------
  const fetchAgent = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(`/api/agent/${id}`);
      setAgent(res.data || null);
    } catch (e) {
      console.error("Failed to load agent:", e);
      toast.error("Failed to load agent details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgent();
    (async () => {
      try {
        const rolesRes = await axiosInstance.get("/api/userRoles");
        setRolesList(rolesRes.data || []);
      } catch (_) {
        /* swallow — roles only needed inside login modal */
      }
    })();
  }, [id]);

  // ===================================================================
  // Edit — bounces back to AgentReg list with ?edit=ID so the existing
  // large form modal stays the single source of truth for edit/create.
  // ===================================================================
  const handleEditClick = () => {
    navigate(`/registration/agent?edit=${id}`);
  };

  // ===================================================================
  // Delete
  // ===================================================================
  const handleDelete = () => {
    Swal.fire({
      title: `Are you sure? You want to delete ${agent?.companyName || ""}`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
    }).then((result) => {
      if (!result.isConfirmed) return;
      axiosInstance
        .delete(`/api/agent/${id}`)
        .then(() => {
          toast.success("Agent deleted successfully");
          navigate("/registration/agent");
        })
        .catch(() => toast.error("Sorry!! Agent not deleted"));
    });
  };

  // ===================================================================
  // Login modal
  // ===================================================================
  const handleLogin = async () => {
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
    setLoginServerError("");
    setShowRolesDropdown(false);
    setShowPassword(false);
    setShowRePassword(false);

    setIsAlreadyRegistered(false);
    try {
      const response = await axiosInstance.post(
        `/auth/checkRegisteredUserExist/${id}`
      );
      if (response.data) {
        const userNameValue =
          response.data.userName || response.data.username || "";
        setLoginFormData((prev) => ({ ...prev, username: userNameValue }));
        if (userNameValue) setIsAlreadyRegistered(true);
      }
    } catch (_) {
      /* normal for un-registered agents */
    }
    setShowLoginModal(true);
  };

  const closeLoginModal = () => {
    setShowLoginModal(false);
    setShowRolesDropdown(false);
    setShowPassword(false);
    setShowRePassword(false);
    setIsAlreadyRegistered(false);
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
    setLoginServerError("");
  };

  const handleLoginChange = (e) => {
    const { name, value } = e.target;
    let fieldName = name;
    if (name === "login-username") fieldName = "username";
    else if (name === "login-password") fieldName = "password";
    else if (name === "login-repassword") fieldName = "repassword";
    setLoginFormData((prev) => ({ ...prev, [fieldName]: value }));
  };

  const toggleRole = (roleId) => {
    setLoginFormData((prev) => ({
      ...prev,
      userroles: prev.userroles.includes(roleId)
        ? prev.userroles.filter((id) => id !== roleId)
        : [...prev.userroles, roleId],
    }));
    setShowRolesDropdown(false);
  };

  const removeRole = (roleId) => {
    setLoginFormData((prev) => ({
      ...prev,
      userroles: prev.userroles.filter((rid) => rid !== roleId),
    }));
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
    setLoginServerError("");

    if (!isValid) {
      toast.error("Please fix the errors in the form");
      return;
    }

    try {
      setIsLoading(true);
      const activeRoleObj = rolesList.find((r) => r.roleName === "AGENT");
      if (!activeRoleObj) {
        setLoginServerError("AGENT role is not configured in the system.");
        setIsLoading(false);
        return;
      }
      const payload = {
        userId: Number(id),
        userTypeId: activeRoleObj.id,
        userName: loginFormData.username,
        userRoleIds: loginFormData.userroles,
        password: loginFormData.password,
      };
      const response = await axiosInstance.post("/auth/register", payload);
      if (response.data) {
        toast.success("Login credentials saved successfully!");
        closeLoginModal();
      }
    } catch (error) {
      const serverMsg =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to save login credentials";
      setLoginServerError(serverMsg);
      toast.error(serverMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetAgentPassword = async () => {
    const confirm = await Swal.fire({
      title: "Reset agent password?",
      text: `A new password will be generated and emailed to ${
        agent?.companyName || "this agent"
      }.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, reset and email",
    });
    if (!confirm.isConfirmed) return;
    try {
      setIsResettingPassword(true);
      const res = await axiosInstance.post(
        `/auth/agent/reset-password/${id}`
      );
      toast.success(
        res?.data?.message ||
          "New password has been generated and emailed to the agent."
      );
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to reset password"
      );
    } finally {
      setIsResettingPassword(false);
    }
  };

  // ===================================================================
  // Credit limit modal
  // ===================================================================
  const handleCreditLimit = async () => {
    setCreditLimitFormData({
      addCreditLimit: "",
      remarks: "",
      totalCreditLimit: "0",
      availableCreditLimit: "0",
      usedCreditLimit: "0",
    });
    setCreditLimitErrors({ addCreditLimit: "", remarks: "" });

    try {
      const response = await axiosInstance.get(
        `/api/agent-credit-limit/agent/${id}`
      );
      const creditData = response.data;
      if (creditData) {
        const initialDone = Number(creditData.totalCreditLimit) > 0;
        setCreditRowExists(true);
        setHasInitialCredit(initialDone);
        setCreditLimitType(initialDone ? "update" : "initial");
        setCreditLimitFormData((prev) => ({
          ...prev,
          totalCreditLimit: creditData.totalCreditLimit || "0",
          availableCreditLimit: creditData.availableCreditLimit || "0",
          usedCreditLimit: creditData.usedCreditLimit || "0",
        }));
      } else {
        setCreditRowExists(false);
        setHasInitialCredit(false);
        setCreditLimitType("initial");
      }
    } catch (_) {
      setCreditRowExists(false);
      setHasInitialCredit(false);
      setCreditLimitType("initial");
    }
    setShowCreditLimitModal(true);
  };

  const closeCreditLimitModal = () => {
    setShowCreditLimitModal(false);
    setCreditLimitType("initial");
    setCreditRowExists(false);
    setHasInitialCredit(false);
    setCreditLimitFormData({
      addCreditLimit: "",
      remarks: "",
      totalCreditLimit: "",
      availableCreditLimit: "",
      usedCreditLimit: "",
    });
    setCreditLimitErrors({ addCreditLimit: "", remarks: "" });
  };

  const handleCreditLimitChange = (e) => {
    const { name, value } = e.target;
    setCreditLimitFormData((prev) => ({ ...prev, [name]: value }));
    if (creditLimitErrors[name]) {
      setCreditLimitErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleCreditLimitTypeChange = (e) => {
    setCreditLimitType(e.target.value);
    setCreditLimitFormData((prev) => ({
      ...prev,
      addCreditLimit: "",
      remarks: "",
    }));
    setCreditLimitErrors({ addCreditLimit: "", remarks: "" });
  };

  const validateCreditLimitForm = (data, type) => {
    const newErrors = {};
    if (!data.addCreditLimit.toString().trim()) {
      newErrors.addCreditLimit =
        type === "initial"
          ? "Add Credit Limit is required"
          : "Add-on Credit Limit is required";
    } else if (isNaN(data.addCreditLimit)) {
      newErrors.addCreditLimit =
        type === "initial"
          ? "Add Credit Limit must be a number"
          : "Add-on Credit Limit must be a number";
    }
    if (type === "update" && !data.remarks.trim()) {
      newErrors.remarks = "Remarks is required";
    }
    return newErrors;
  };

  const handleCreditLimitSubmit = async () => {
    const errors = validateCreditLimitForm(creditLimitFormData, creditLimitType);
    if (Object.keys(errors).length > 0) {
      setCreditLimitErrors(errors);
      return;
    }
    try {
      setIsLoading(true);
      const addAmount = parseFloat(creditLimitFormData.addCreditLimit);
      let response;
      if (creditLimitType === "initial") {
        if (creditRowExists) {
          response = await axiosInstance.put(
            "/api/agent-credit-limit/update",
            {
              agentId: Number(id),
              totalCreditLimit: addAmount,
              availableCreditLimit: 0,
              additionalCredit: addAmount,
            }
          );
        } else {
          response = await axiosInstance.post(
            "/api/agent-credit-limit/create",
            null,
            { params: { agentId: Number(id), totalCreditLimit: addAmount } }
          );
        }
      } else {
        const currentTotal =
          parseFloat(creditLimitFormData.totalCreditLimit) || 0;
        const currentAvailable =
          parseFloat(creditLimitFormData.availableCreditLimit) || 0;
        response = await axiosInstance.put(
          "/api/agent-credit-limit/update",
          {
            agentId: Number(id),
            additionalCredit: addAmount,
            remarks: creditLimitFormData.remarks,
            totalCreditLimit: currentTotal + addAmount,
            availableCreditLimit: currentAvailable,
          }
        );
      }
      if (response.data) {
        toast.success(
          creditLimitType === "initial"
            ? "Initial credit limit created successfully!"
            : "Credit limit updated successfully!"
        );
        setHasInitialCredit(true);
        setCreditRowExists(true);
        closeCreditLimitModal();
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to update credit limit");
    } finally {
      setIsLoading(false);
    }
  };

  // ===================================================================
  // Exclusion modal
  // ===================================================================
  const handleAgentExclude = async () => {
    setExclusionFormData({ nationality: "", externalApi: [] });
    setExclusionErrors({ nationality: "", externalApi: "" });
    try {
      const response = await axiosInstance.get(
        `/api/agent-api-exclusion/agent/${id}`
      );
      if (response.data && Array.isArray(response.data)) {
        const existingApiCodes = response.data
          .map((exclusion) => exclusion.apiCode)
          .filter(Boolean);
        setExclusionFormData((prev) => ({
          ...prev,
          externalApi: existingApiCodes,
        }));
      }
    } catch (_) {
      /* no prior exclusions — normal */
    }
    setShowExclusionModal(true);
  };

  const closeExclusionModal = () => {
    setShowExclusionModal(false);
    setExclusionFormData({ nationality: "", externalApi: [] });
    setExclusionErrors({ nationality: "", externalApi: "" });
    setShowApiDropdown(false);
  };

  const toggleApi = (apiCode) => {
    setExclusionFormData((prev) => ({
      ...prev,
      externalApi: prev.externalApi.includes(apiCode)
        ? prev.externalApi.filter((code) => code !== apiCode)
        : [...prev.externalApi, apiCode],
    }));
    if (exclusionErrors.externalApi) {
      setExclusionErrors((prev) => ({ ...prev, externalApi: "" }));
    }
    setShowApiDropdown(false);
  };

  const removeApi = (apiCode) => {
    setExclusionFormData((prev) => ({
      ...prev,
      externalApi: prev.externalApi.filter((code) => code !== apiCode),
    }));
  };

  const handleExclusionSubmit = async () => {
    try {
      setIsLoading(true);
      let existingApiCodes = [];
      try {
        const existingResponse = await axiosInstance.get(
          `/api/agent-api-exclusion/agent/${id}`
        );
        if (
          existingResponse.data &&
          Array.isArray(existingResponse.data)
        ) {
          existingApiCodes = existingResponse.data
            .map((exclusion) => exclusion.apiCode)
            .filter(Boolean);
        }
      } catch (_) {
        /* none */
      }

      const newApiCodes = exclusionFormData.externalApi.filter(
        (apiCode) => !existingApiCodes.includes(apiCode)
      );
      const removedApiCodes = existingApiCodes.filter(
        (apiCode) => !exclusionFormData.externalApi.includes(apiCode)
      );

      if (newApiCodes.length === 0 && removedApiCodes.length === 0) {
        toast("No changes made to API exclusions.");
        setIsLoading(false);
        return;
      }

      const promises = [];
      newApiCodes.forEach((apiCode) => {
        promises.push(
          axiosInstance.post("/api/agent-api-exclusion/exclude", {
            agentId: Number(id),
            nationality: exclusionFormData.nationality,
            apiCode,
          })
        );
      });
      removedApiCodes.forEach((apiCode) => {
        promises.push(
          axiosInstance.delete(
            `/api/agent-api-exclusion/agent/${id}/api/${apiCode}`
          )
        );
      });
      await Promise.all(promises);
      toast.success("API exclusions updated successfully!", { duration: 1000 });
      closeExclusionModal();
    } catch (e) {
      console.error(e);
      toast.error("Failed to update API exclusions. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // ===================================================================
  // Render
  // ===================================================================
  if (loading) {
    return (
      <div className="min-vh-100 bg-light d-flex flex-column">
        <Topbar />
        <div className="d-flex flex-grow-1">
          <Sidebar />
          <main className="flex-grow-1 p-4 d-flex justify-content-center align-items-center">
            <Spinner animation="border" />
          </main>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-vh-100 bg-light d-flex flex-column">
        <Topbar />
        <div className="d-flex flex-grow-1">
          <Sidebar />
          <main className="flex-grow-1 p-4">
            <Card className="shadow-sm">
              <Card.Body className="text-center text-muted">
                Agent not found.
                <div className="mt-3">
                  <Button
                    variant="secondary"
                    onClick={() => navigate("/registration/agent")}
                  >
                    Back to list
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </main>
        </div>
      </div>
    );
  }

  const gst = agent.agentGSTDetailsDTO || {};

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <Button
                variant="link"
                className="p-0 text-decoration-none"
                onClick={() => navigate("/registration/agent")}
              >
                <FaArrowLeft className="me-2" />
                Back to Agent List
              </Button>
              <h4 className="mt-2 mb-0">
                {agent.companyName}
                {agent.shortName ? (
                  <span className="text-muted small ms-2">
                    ({agent.shortName})
                  </span>
                ) : null}
              </h4>
            </div>
            {agent.agentLogo && (
              <img
                src={
                  typeof agent.agentLogo === "string"
                    ? agent.agentLogo.startsWith("data:")
                      ? agent.agentLogo
                      : `data:image/*;base64,${agent.agentLogo}`
                    : ""
                }
                alt="Agent Logo"
                style={{
                  maxHeight: 60,
                  maxWidth: 160,
                  border: "1px solid #ddd",
                  borderRadius: 4,
                  padding: 2,
                  background: "#fff",
                }}
              />
            )}
          </div>

          <Card className="shadow-sm mb-3">
            <Card.Header>Agent Details</Card.Header>
            <Card.Body>
              <Row>
                <Row2 label="Company Name" value={agent.companyName} />
                <Row2 label="Short Name" value={agent.shortName} />
                <Row2 label="Business Type" value={agent.businessType} />
                <Row2 label="Company Code" value={agent.companyCode} />
                <Row2 label="Agent URL" value={agent.agentUrl} />
                <Row2 label="First Name" value={agent.firstName} />
                <Row2 label="Last Name" value={agent.lastName} />
                <Row2 label="Status" value={agent.status} />
              </Row>
            </Card.Body>
          </Card>

          <Card className="shadow-sm mb-3">
            <Card.Header>Contact Details</Card.Header>
            <Card.Body>
              <Row>
                <Row2 label="Email" value={agent.personalEmail} />
                <Row2 label="Mobile Number" value={agent.mobileNumber} />
                <Row2 label="Telephone Number" value={agent.telephoneNumber} />
                <Row2 label="Zip Code" value={agent.zipCode} />
                <Row2 label="Contact Person" value={agent.contactPerson} />
                <Row2 label="Country" value={agent.countryName} />
                <Row2 label="City" value={agent.provinceName} />
                <Row2 label="Location" value={agent.placeName} />
                <Col md={12} className="mb-3">
                  <div className="text-muted small mb-1">Address</div>
                  <div className="fw-semibold">
                    {agent.address || (
                      <span className="text-muted">—</span>
                    )}
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {String(agent.countryId) === "1" && (
            <Card className="shadow-sm mb-3">
              <Card.Header>GST Information</Card.Header>
              <Card.Body>
                <Row>
                  <Row2
                    label="Agency Classification"
                    value={gst.agentClassification}
                  />
                  <Row2 label="GSTIN" value={gst.agentGstIn} />
                  <Row2
                    label="Provisional GST Number"
                    value={gst.agentProvisionalGstno}
                  />
                  <Row2
                    label="Correspondence Email"
                    value={gst.agentCorrespondmail}
                  />
                  <Row2
                    label="GST Registration Status"
                    value={gst.agentRegisterstatus}
                  />
                  <Row2 label="HSN/SAC Code" value={gst.agentHsncode} />
                  <Row2 label="Agent Status" value={gst.agentStatus} />
                </Row>
              </Card.Body>
            </Card>
          )}

          <Card className="shadow-sm mb-3">
            <Card.Header>Finance Manager & GM</Card.Header>
            <Card.Body>
              <h6 className="text-primary mb-3">Finance Manager</h6>
              <Row>
                <Row2 label="Name" value={agent.financeManagerName} />
                <Row2
                  label="Contact No"
                  value={agent.financeManagerContactNo}
                />
                <Row2 label="Email" value={agent.financeManagerEmail} />
              </Row>
              <hr />
              <h6 className="text-primary mb-3">GM</h6>
              <Row>
                <Row2 label="Name" value={agent.gmName} />
                <Row2 label="Contact No" value={agent.gmContactNo} />
                <Row2 label="Email" value={agent.gmEmail} />
              </Row>
            </Card.Body>
          </Card>

          <Card className="shadow-sm mb-3">
            <Card.Header>Incentive & Settings</Card.Header>
            <Card.Body>
              <Row>
                <Row2
                  label="Preferred Incentive Claim Method"
                  value={agent.preferredClaimMethod}
                />
                <Row2 label="Markup" value={agent.markup} />
                <Row2 label="Currency" value={agent.currencyCode || agent.currency} />
              </Row>
              {agent.preferredClaimMethod === "BANK_TRANSFER" && (
                <>
                  <hr />
                  <h6 className="text-success mb-3">Bank Details</h6>
                  <Row>
                    <Row2
                      label="Account Holder Name"
                      value={agent.bankAccountHolderName}
                    />
                    <Row2 label="Bank Name" value={agent.bankName} />
                    <Row2
                      label="Account Number"
                      value={agent.bankAccountNumber}
                    />
                    <Row2 label="IFSC Code" value={agent.bankIfscCode} />
                    <Row2 label="Branch Name" value={agent.bankBranchName} />
                  </Row>
                </>
              )}
            </Card.Body>
          </Card>

          {/* ------------ Bottom action bar ----------------------- */}
          <Card className="shadow-sm">
            <Card.Body className="d-flex flex-wrap gap-2 justify-content-end">
              <Button
                variant="outline-secondary"
                onClick={() => navigate("/registration/agent")}
              >
                <FaArrowLeft className="me-2" />
                Back
              </Button>
              <Button variant="primary" onClick={handleEditClick}>
                <FaEdit className="me-2" />
                Edit
              </Button>
              <Button variant="warning" onClick={handleCreditLimit}>
                <FaCreditCard className="me-2" />
                Credit Limit
              </Button>
              <Button variant="secondary" onClick={handleAgentExclude}>
                <FaBan className="me-2" />
                Agent Exclude
              </Button>
              <Button variant="success" onClick={handleLogin}>
                <FaSignInAlt className="me-2" />
                Login
              </Button>
              <Button variant="danger" onClick={handleDelete}>
                <FaTrash className="me-2" />
                Delete
              </Button>
            </Card.Body>
          </Card>

          {/* ---------------- Login Modal ---------------- */}
          <Modal
            show={showLoginModal}
            onHide={closeLoginModal}
            centered
            backdrop="static"
            keyboard={false}
          >
            <Modal.Header closeButton>
              <Modal.Title>
                {isAlreadyRegistered ? "Login" : "Create Login"} for Agent:{" "}
                {agent?.companyName}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              {isAlreadyRegistered ? (
                <div>
                  <div className="alert alert-success mb-3 d-flex align-items-center">
                    <i className="fas fa-check-circle me-2"></i>
                    <span className="fw-semibold">Registered Agent</span>
                  </div>
                  <Form.Group className="mb-2">
                    <Form.Label className="fw-semibold">
                      Registered Username
                    </Form.Label>
                    <Form.Control
                      type="text"
                      value={loginFormData.username}
                      readOnly
                      className="bg-light"
                    />
                  </Form.Group>
                  <div className="mt-3 d-flex justify-content-end">
                    <Button
                      variant="outline-warning"
                      size="sm"
                      onClick={handleResetAgentPassword}
                      disabled={isResettingPassword}
                      title="Generate a new password and email it to the agent"
                    >
                      {isResettingPassword ? (
                        <>
                          <span
                            className="spinner-border spinner-border-sm me-2"
                            role="status"
                            aria-hidden="true"
                          ></span>
                          Resetting...
                        </>
                      ) : (
                        <>
                          <FaKey className="me-1" />
                          Reset Password
                        </>
                      )}
                    </Button>
                  </div>
                  <small className="text-muted d-block mt-2">
                    A new password will be generated by the system and emailed
                    to the agent's registered email address.
                  </small>
                </div>
              ) : (
                <Form className="loginForm">
                  {loginServerError && (
                    <div className="alert alert-danger py-2 mb-3" role="alert">
                      <i className="fas fa-exclamation-triangle me-2"></i>
                      {loginServerError}
                    </div>
                  )}
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
                        style={{ paddingRight: 40 }}
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
                        onClick={() => setShowPassword((s) => !s)}
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
                        style={{ paddingRight: 40 }}
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
                        onClick={() => setShowRePassword((s) => !s)}
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
                          minHeight: 38,
                          padding: "4px 8px",
                          cursor: "pointer",
                        }}
                        onClick={() => setShowRolesDropdown((s) => !s)}
                      >
                        {loginFormData.userroles.length > 0 ? (
                          loginFormData.userroles.map((roleId) => {
                            const role = rolesList.find((r) => r.id === roleId);
                            return role ? (
                              <span
                                key={roleId}
                                className="badge bg-primary me-1 mb-1 d-flex align-items-center"
                                style={{ fontSize: 12 }}
                              >
                                {role.roleName}
                                <button
                                  type="button"
                                  className="btn-close btn-close-white ms-1"
                                  style={{ fontSize: 8 }}
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
                            maxHeight: 200,
                            overflowY: "auto",
                            minHeight: 120,
                            border: "2px solid #007bff",
                            marginBottom: 2,
                          }}
                        >
                          {rolesList.map((role) => {
                            const isSelected =
                              loginFormData.userroles.includes(role.id);
                            return (
                              <div
                                key={role.id}
                                className={`px-3 py-2 ${
                                  isSelected ? "bg-light text-muted" : ""
                                }`}
                                style={{
                                  cursor: "pointer",
                                  borderBottom: "1px solid #eee",
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleRole(role.id);
                                }}
                              >
                                {role.roleName}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    {loginErrors.userroles && (
                      <div className="text-danger small mt-1">
                        {loginErrors.userroles}
                      </div>
                    )}
                  </Form.Group>
                </Form>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="secondary"
                onClick={closeLoginModal}
                disabled={isLoading}
              >
                {isAlreadyRegistered ? "Close" : "Cancel"}
              </Button>
              {!isAlreadyRegistered && (
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
              )}
            </Modal.Footer>
          </Modal>

          {/* ---------------- Credit Limit Modal ---------------- */}
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
                Manage Credit Limit - {agent.companyName}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form>
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
                {creditLimitType === "initial" ? (
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
                          isInvalid={!!creditLimitErrors.addCreditLimit}
                          min="0"
                          step="0.01"
                        />
                        <Form.Control.Feedback type="invalid">
                          {creditLimitErrors.addCreditLimit}
                        </Form.Control.Feedback>
                      </Form.Group>
                    </Col>
                  </Row>
                ) : (
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
                            isInvalid={!!creditLimitErrors.addCreditLimit}
                            min="0"
                            step="0.01"
                          />
                          <Form.Control.Feedback type="invalid">
                            {creditLimitErrors.addCreditLimit}
                          </Form.Control.Feedback>
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
                            isInvalid={!!creditLimitErrors.remarks}
                          />
                          <Form.Control.Feedback type="invalid">
                            {creditLimitErrors.remarks}
                          </Form.Control.Feedback>
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
                            className="bg-light"
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
                            className="bg-light"
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
                            className="bg-light"
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
                    {creditLimitType === "initial" ? "Creating..." : "Updating..."}
                  </>
                ) : creditLimitType === "initial" ? (
                  "Save"
                ) : (
                  "Update"
                )}
              </Button>
            </Modal.Footer>
          </Modal>

          {/* ---------------- Exclusion Modal ---------------- */}
          <Modal
            show={showExclusionModal}
            onHide={closeExclusionModal}
            centered
            size="md"
            backdrop="static"
            keyboard={false}
          >
            <Modal.Header closeButton={!isLoading}>
              <Modal.Title>Agent Exclusion - {agent.companyName}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form className="agent-exclude-form">
                <Row>
                  <Col md={12}>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        <span className="text-danger">*</span>External API
                      </Form.Label>
                      <div className="api-dropdown-container position-relative">
                        <div
                          className={`form-control d-flex flex-wrap align-items-center ${
                            exclusionErrors.externalApi ? "is-invalid" : ""
                          }`}
                          style={{
                            minHeight: 38,
                            cursor: "pointer",
                            border: exclusionErrors.externalApi
                              ? "1px solid #dc3545"
                              : "1px solid #ced4da",
                          }}
                          onClick={() => setShowApiDropdown((s) => !s)}
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
                                  style={{ fontSize: 12 }}
                                >
                                  {api?.name || apiCode}
                                  <button
                                    type="button"
                                    className="btn-close btn-close-white ms-1"
                                    style={{ fontSize: 8 }}
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
                        {showApiDropdown && (
                          <div
                            className="position-absolute w-100 bg-white border rounded shadow-lg"
                            style={{
                              zIndex: 9999,
                              maxHeight: 200,
                              overflowY: "auto",
                              minHeight: 120,
                              border: "2px solid #007bff",
                              marginBottom: 2,
                            }}
                          >
                            {externalApis.map((api) => {
                              const isSelected =
                                exclusionFormData.externalApi.includes(api.code);
                              return (
                                <div
                                  key={api.code}
                                  className="px-3 py-2"
                                  style={{
                                    borderBottom: "1px solid #eee",
                                    cursor: isSelected
                                      ? "not-allowed"
                                      : "pointer",
                                    opacity: isSelected ? 0.5 : 1,
                                    color: isSelected
                                      ? "#6c757d"
                                      : "inherit",
                                  }}
                                  onClick={() => {
                                    if (!isSelected) toggleApi(api.code);
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
                    external API for this agent.
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

export default AgentView;
