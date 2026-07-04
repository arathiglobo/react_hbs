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
  Container,
} from "react-bootstrap";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";
import {
  FaEdit,
  FaSignInAlt,
  FaCreditCard,
  FaBan,
  FaArrowLeft,
  FaKey,
  FaToggleOn,
  FaToggleOff,
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
// ── Look-and-feel tokens, matched to PackageDetailedView so this page
//    shares the same clean "details" styling (gray section header bars,
//    compact label/value rows inside bordered cards). ──
const SECTION_HEADER = {
  backgroundColor: "#f0f0f0",
  padding: "8px 14px",
  fontWeight: 600,
  fontSize: "0.9rem",
  borderBottom: "1px solid #ddd",
  display: "flex",
  alignItems: "center",
  gap: "6px",
  color: "#333",
};

const INFO_LABEL = {
  fontWeight: 600,
  color: "#555",
  fontSize: "0.82rem",
  minWidth: "180px",
  display: "inline-block",
};

const INFO_VALUE = { color: "#222", fontSize: "0.82rem" };

const cardBox = {
  border: "1px solid #ddd",
  borderRadius: "4px",
  marginBottom: "14px",
  overflow: "hidden",
  backgroundColor: "#fff",
  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
};

// One label / value line. Renders a muted em-dash for empty values.
const InfoRow = ({ label, value }) => {
  const blank = value === null || value === undefined || value === "";
  return (
    <div style={{ marginBottom: "6px", display: "flex", alignItems: "flex-start" }}>
      <span style={INFO_LABEL}>{label}</span>
      <span style={{ ...INFO_VALUE, marginLeft: "8px" }}>
        {blank ? <span style={{ color: "#9CA3AF" }}>—</span> : value}
      </span>
    </div>
  );
};

// Section card with a gray header bar (PackageDetailedView pattern).
const Section = ({ title, children }) => (
  <div style={cardBox}>
    <div style={SECTION_HEADER}>{title}</div>
    <div style={{ padding: "12px 16px" }}>{children}</div>
  </div>
);

// dd-MM-yyyy when the value is a valid date, else the raw string.
const formatDob = (v) => {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("en-GB");
};

const AgentView = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  // Active/Inactive toggle in-flight flag (disables the button while saving).
  const [statusUpdating, setStatusUpdating] = useState(false);
  // Card-payment-mode toggle in-flight flag.
  const [cardPaymentUpdating, setCardPaymentUpdating] = useState(false);
  /* Lightbox state — when the user clicks the agent photo on the header,
     the full image is shown enlarged inside a clean Bootstrap Modal. */
  const [showPhotoModal, setShowPhotoModal] = useState(false);

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
    // Payment Mode selected when adding/updating the credit limit. Mirrors the
    // dropdown on inhouse-accounts/agent.
    paymentMode: "",
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

  // Delete handler removed by design — agents are never deleted; access is
  // managed via the Active/Inactive status toggle below.

  // ===================================================================
  // Active / Inactive toggle
  // Flips the agent's access on/off (status + login account) without
  // touching any booking / invoice / payment data. Confirms first.
  // ===================================================================
  const isAgentActive =
    String(agent?.status || "").trim().toLowerCase() !== "inactive";

  const handleToggleStatus = () => {
    const goingInactive = isAgentActive; // currently active → will deactivate
    const nextLabel = goingInactive ? "Inactive" : "Active";
    Swal.fire({
      title: `Set ${agent?.companyName || "this agent"} to ${nextLabel}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: goingInactive ? "#d33" : "#198754",
      cancelButtonColor: "#3085d6",
      confirmButtonText: `Yes, set ${nextLabel}`,
    }).then((result) => {
      if (!result.isConfirmed) return;
      setStatusUpdating(true);
      axiosInstance
        .patch(`/api/agent/${id}/status`, { active: !goingInactive })
        .then((res) => {
          toast.success(res.data?.message || `Agent set to ${nextLabel}`);
          // Reflect the new status without a full reload, then refresh.
          setAgent((prev) =>
            prev ? { ...prev, status: res.data?.status || nextLabel } : prev
          );
          fetchAgent();
        })
        .catch((err) =>
          toast.error(
            err.response?.data?.message || "Failed to update agent status"
          )
        )
        .finally(() => setStatusUpdating(false));
    });
  };

  // ===================================================================
  // Card-payment toggle — flips the per-agent "Card" payment-mode gate.
  // Booking pages read agent.cardPaymentEnabled to decide whether to
  // surface the Card option in the payment-mode dropdown.
  // ===================================================================
  const handleToggleCardPayment = (e) => {
    const enabled = !!e?.target?.checked;
    setCardPaymentUpdating(true);
    axiosInstance
      .patch(`/api/agent/${id}/card-payment`, { enabled })
      .then((res) => {
        toast.success(
          res.data?.message ||
            `Payment gateway ${enabled ? "enabled" : "disabled"} for agent`,
        );
        setAgent((prev) =>
          prev ? { ...prev, cardPaymentEnabled: enabled } : prev,
        );
      })
      .catch((err) =>
        toast.error(
          err.response?.data?.message ||
            "Failed to update payment gateway setting",
        ),
      )
      .finally(() => setCardPaymentUpdating(false));
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
      // Scope the check to the AGENT user type so entities of other types that
      // share the same numeric id don't resolve to this agent's account.
      const agentRole = rolesList.find((r) => r.roleName === "AGENT");
      const response = await axiosInstance.post(
        agentRole
          ? `/auth/checkRegisteredUserExist/${id}?userTypeId=${agentRole.id}`
          : `/auth/checkRegisteredUserExist/${id}`
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
      paymentMode: "",
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
          // Preserve the previously selected payment mode so it's visible
          // when the modal reopens.
          paymentMode: creditData.paymentMode || "",
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
      paymentMode: "",
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
      const pm = creditLimitFormData.paymentMode || undefined;
      if (creditLimitType === "initial") {
        if (creditRowExists) {
          response = await axiosInstance.put(
            "/api/agent-credit-limit/update",
            {
              agentId: Number(id),
              totalCreditLimit: addAmount,
              availableCreditLimit: 0,
              additionalCredit: addAmount,
              paymentMode: pm,
            }
          );
        } else {
          response = await axiosInstance.post(
            "/api/agent-credit-limit/create",
            null,
            {
              params: {
                agentId: Number(id),
                totalCreditLimit: addAmount,
                ...(pm ? { paymentMode: pm } : {}),
              },
            }
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
            paymentMode: pm,
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
        <main className="flex-grow-1 p-4" style={{ overflow: "auto" }}>
          <Container fluid style={{ maxWidth: "1100px" }}>
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
                <span
                  className={`badge ms-2 align-middle ${
                    isAgentActive ? "bg-success" : "bg-secondary"
                  }`}
                  style={{ fontSize: "0.7rem", verticalAlign: "middle" }}
                >
                  {isAgentActive ? "Active" : "Inactive"}
                </span>
              </h4>
            </div>
            {(() => {
              /* Robust agent-logo rendering:
                 - Accept either a data:URL or a raw base64 string.
                 - Detect PNG / JPEG / GIF / WEBP from base64 magic bytes so the
                   browser doesn't reject the wildcard "image/*" MIME we were
                   sending before (which is why the image often didn't show).
                 - If no logo, show a clean initials badge as a fallback. */
              const raw = typeof agent.agentLogo === "string" ? agent.agentLogo.trim() : "";
              let src = "";
              if (raw) {
                if (raw.startsWith("data:")) {
                  src = raw;
                } else {
                  let mime = "image/png";
                  if (raw.startsWith("/9j/")) mime = "image/jpeg";
                  else if (raw.startsWith("iVBORw")) mime = "image/png";
                  else if (raw.startsWith("R0lGOD")) mime = "image/gif";
                  else if (raw.startsWith("UklGR")) mime = "image/webp";
                  src = `data:${mime};base64,${raw}`;
                }
              }
              const initials = ((agent.companyName || agent.firstName || "A")
                .trim()
                .split(/\s+/)
                .map((w) => w[0])
                .slice(0, 2)
                .join("") || "A")
                .toUpperCase();
              return src ? (
                <img
                  src={src}
                  alt={`${agent.companyName || "Agent"} logo`}
                  onClick={() => setShowPhotoModal(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setShowPhotoModal(true);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  title="Click to view full image"
                  onError={(e) => {
                    // If the inferred MIME doesn't match, hide the broken icon.
                    e.currentTarget.style.display = "none";
                  }}
                  style={{
                    width: 96,
                    height: 96,
                    objectFit: "contain",
                    background: "#FAFAF8",
                    border: "1px solid #ECECE8",
                    borderRadius: "16px",
                    padding: "8px",
                    boxShadow: "0 4px 14px rgba(17, 19, 24, .06)",
                    cursor: "pointer",
                    transition: "transform .18s ease, box-shadow .18s ease, border-color .18s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 10px 24px rgba(17, 19, 24, .12)";
                    e.currentTarget.style.borderColor = "#EC0B43";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "";
                    e.currentTarget.style.boxShadow = "0 4px 14px rgba(17, 19, 24, .06)";
                    e.currentTarget.style.borderColor = "#ECECE8";
                  }}
                />
              ) : (
                <div
                  aria-label="Agent initials"
                  style={{
                    width: 96,
                    height: 96,
                    display: "grid",
                    placeItems: "center",
                    background: "#FDE7ED",
                    color: "#EC0B43",
                    border: "1px solid #F8C9D5",
                    borderRadius: "16px",
                    fontWeight: 700,
                    fontSize: "28px",
                    letterSpacing: "-0.02em",
                    boxShadow: "0 4px 14px rgba(17, 19, 24, .06)",
                  }}
                >
                  {initials}
                </div>
              );
            })()}
          </div>

          <Section title="Agent Details">
            <Row>
              <Col md={6}>
                <InfoRow label="Company Name" value={agent.companyName} />
                <InfoRow label="Short Name" value={agent.shortName} />
                <InfoRow label="Business Type" value={agent.businessType} />
                <InfoRow
                  label="Agent Category"
                  value={
                    agent.agentCategoryName ||
                    agent.agentCategory?.categoryName ||
                    agent.agentCategory?.name ||
                    agent.agentCategoryId
                  }
                />
                <InfoRow label="Company Code" value={agent.companyCode} />
                <InfoRow label="Agent URL" value={agent.agentUrl} />
              </Col>
              <Col md={6}>
                <InfoRow label="First Name" value={agent.firstName} />
                <InfoRow label="Last Name" value={agent.lastName} />
                <InfoRow label="Date of Birth" value={formatDob(agent.dateOfBirth)} />
                <InfoRow label="Status" value={agent.status} />
                <InfoRow label="Agent ID" value={agent.id} />
              </Col>
            </Row>
          </Section>

          <Section title="Contact Details">
            <Row>
              <Col md={6}>
                <InfoRow label="Email" value={agent.personalEmail} />
                <InfoRow label="Mobile Number" value={agent.mobileNumber} />
                <InfoRow label="Telephone Number" value={agent.telephoneNumber} />
                <InfoRow label="Contact Person" value={agent.contactPerson} />
                <InfoRow label="Zip Code" value={agent.zipCode} />
              </Col>
              <Col md={6}>
                <InfoRow label="Country" value={agent.countryName} />
                <InfoRow label="City / Province" value={agent.provinceName} />
                <InfoRow label="Location" value={agent.placeName} />
                <InfoRow label="Address" value={agent.address} />
              </Col>
            </Row>
          </Section>

          {String(agent.countryId) === "1" && (
            <Section title="GST Information">
              <Row>
                <Col md={6}>
                  <InfoRow
                    label="Agency Classification"
                    value={gst.agentClassification}
                  />
                  <InfoRow label="GSTIN" value={gst.agentGstIn} />
                  <InfoRow
                    label="Provisional GST Number"
                    value={gst.agentProvisionalGstno}
                  />
                  <InfoRow
                    label="Correspondence Email"
                    value={gst.agentCorrespondmail}
                  />
                </Col>
                <Col md={6}>
                  <InfoRow
                    label="GST Registration Status"
                    value={gst.agentRegisterstatus}
                  />
                  <InfoRow label="HSN/SAC Code" value={gst.agentHsncode} />
                  <InfoRow label="Agent Status" value={gst.agentStatus} />
                </Col>
              </Row>
            </Section>
          )}

          <Section title="Finance Manager & GM">
            <div
              className="fw-semibold mb-2"
              style={{ color: "#c0392b", fontSize: "0.85rem" }}
            >
              Finance Manager
            </div>
            <Row>
              <Col md={6}>
                <InfoRow label="Name" value={agent.financeManagerName} />
                <InfoRow label="Contact No" value={agent.financeManagerContactNo} />
              </Col>
              <Col md={6}>
                <InfoRow label="Email" value={agent.financeManagerEmail} />
              </Col>
            </Row>
            <hr className="my-3" />
            <div
              className="fw-semibold mb-2"
              style={{ color: "#c0392b", fontSize: "0.85rem" }}
            >
              General Manager
            </div>
            <Row>
              <Col md={6}>
                <InfoRow label="Name" value={agent.gmName} />
                <InfoRow label="Contact No" value={agent.gmContactNo} />
              </Col>
              <Col md={6}>
                <InfoRow label="Email" value={agent.gmEmail} />
              </Col>
            </Row>
          </Section>

          {/* Incentive & Settings — hidden by request (code retained). */}
          {false && (
          <Section title="Incentive & Settings">
            <Row>
              <Col md={6}>
                <InfoRow
                  label="Preferred Incentive Claim Method"
                  value={agent.preferredClaimMethod}
                />
                <InfoRow label="Markup" value={`${agent.markup} (${agent.markupType})`} />
              </Col>
              <Col md={6}>
                <InfoRow
                  label="Currency"
                  value={agent.currencyCode || agent.currency}
                />
              </Col>
            </Row>
            {agent.preferredClaimMethod === "BANK_TRANSFER" && (
              <>
                <hr className="my-3" />
                <div
                  className="fw-semibold mb-2"
                  style={{ color: "#16a34a", fontSize: "0.85rem" }}
                >
                  Bank Details
                </div>
                <Row>
                  <Col md={6}>
                    <InfoRow
                      label="Account Holder Name"
                      value={agent.bankAccountHolderName}
                    />
                    <InfoRow label="Bank Name" value={agent.bankName} />
                    <InfoRow
                      label="Account Number"
                      value={agent.bankAccountNumber}
                    />
                  </Col>
                  <Col md={6}>
                    <InfoRow label="IFSC Code" value={agent.bankIfscCode} />
                    <InfoRow label="Branch Name" value={agent.bankBranchName} />
                  </Col>
                </Row>
              </>
            )}
          </Section>
          )}

          {/* ------------ Allow Card payment toggle ----------------- */}
          <div
            className="d-flex justify-content-end align-items-center gap-3 mb-2 px-3 py-2 rounded"
            style={{
              background: "#fff4e5",
              border: "1px solid #ffb84d",
            }}
          >
            <span
              className="fw-bold"
              style={{ fontSize: "1.05rem", color: "#b45309" }}
            >
              Block Payment Gateway
            </span>
            <Form.Check
              type="switch"
              id={`agent-card-payment-${id}`}
              label={
                cardPaymentUpdating
                  ? "Updating…"
                  : Boolean(agent?.cardPaymentEnabled)
                    ? "Yes"
                    : "No"
              }
              checked={Boolean(agent?.cardPaymentEnabled)}
              onChange={handleToggleCardPayment}
              disabled={cardPaymentUpdating}
              className="d-flex align-items-center fw-semibold"
              style={{ fontSize: "1rem" }}
              title="When on, this agent sees the 'Card' option in the booking-page payment-mode dropdown."
            />
          </div>

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
              <Button
                variant={isAgentActive ? "outline-danger" : "outline-success"}
                onClick={handleToggleStatus}
                disabled={statusUpdating}
                title={
                  isAgentActive
                    ? "Deactivate this agent (blocks login and all operations)"
                    : "Reactivate this agent (restores access)"
                }
              >
                {isAgentActive ? (
                  <>
                    <FaToggleOff className="me-2" />
                    {statusUpdating ? "Updating..." : "Set Inactive"}
                  </>
                ) : (
                  <>
                    <FaToggleOn className="me-2" />
                    {statusUpdating ? "Updating..." : "Set Active"}
                  </>
                )}
              </Button>
              {/* Delete removed by design — agents are never deleted; use the
                  Active/Inactive status to manage agent access instead. */}
            </Card.Body>
          </Card>
          </Container>

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
                    {/* Rendered as a plain block (not Form.Control.Feedback)
                        because the input sits inside a wrapper div for the
                        eye toggle, so Bootstrap's sibling rule would keep the
                        feedback hidden — which previously swallowed the
                        password-criteria message. */}
                    {loginErrors.password && (
                      <div className="text-danger small mt-1">
                        {loginErrors.password}
                      </div>
                    )}
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
                    {loginErrors.repassword && (
                      <div className="text-danger small mt-1">
                        {loginErrors.repassword}
                      </div>
                    )}
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
                    <Col md={6}>
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
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Payment Mode</Form.Label>
                        <Form.Select
                          name="paymentMode"
                          value={creditLimitFormData.paymentMode}
                          onChange={handleCreditLimitChange}
                        >
                          <option value="">SELECT</option>
                          <option value="CASH">Cash</option>
                          <option value="CREDIT_CARD">Credit Card</option>
                          <option value="BANK_TRANSFER">Bank Transfer</option>
                        </Form.Select>
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
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Payment Mode</Form.Label>
                          <Form.Select
                            name="paymentMode"
                            value={creditLimitFormData.paymentMode}
                            onChange={handleCreditLimitChange}
                          >
                            <option value="">SELECT</option>
                            <option value="CASH">Cash</option>
                            <option value="CREDIT_CARD">Credit Card</option>
                            <option value="BANK_TRANSFER">Bank Transfer</option>
                          </Form.Select>
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

          {/* ── Agent photo lightbox ──
              Opens when the user clicks the small photo in the page header.
              Renders the same image at a large, contained size for inspection. */}
          <Modal
            show={showPhotoModal}
            onHide={() => setShowPhotoModal(false)}
            size="lg"
            centered
            aria-labelledby="agent-photo-modal-title"
          >
            <Modal.Header closeButton className="border-0 pb-0">
              <Modal.Title id="agent-photo-modal-title" style={{ fontSize: "1rem", fontWeight: 600 }}>
                {agent?.companyName ? `${agent.companyName} — Photo` : "Agent Photo"}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body
              className="d-flex align-items-center justify-content-center"
              style={{ background: "#FAFAF8", padding: "24px" }}
            >
              {(() => {
                const raw = typeof agent?.agentLogo === "string" ? agent.agentLogo.trim() : "";
                let src = "";
                if (raw) {
                  if (raw.startsWith("data:")) {
                    src = raw;
                  } else {
                    let mime = "image/png";
                    if (raw.startsWith("/9j/")) mime = "image/jpeg";
                    else if (raw.startsWith("iVBORw")) mime = "image/png";
                    else if (raw.startsWith("R0lGOD")) mime = "image/gif";
                    else if (raw.startsWith("UklGR")) mime = "image/webp";
                    src = `data:${mime};base64,${raw}`;
                  }
                }
                return src ? (
                  <img
                    src={src}
                    alt={`${agent?.companyName || "Agent"} photo (full size)`}
                    style={{
                      maxWidth: "100%",
                      maxHeight: "70vh",
                      objectFit: "contain",
                      borderRadius: "12px",
                      background: "#fff",
                      boxShadow: "0 8px 24px rgba(17, 19, 24, .10)",
                    }}
                  />
                ) : (
                  <div style={{ color: "#9CA3AF", fontSize: "14px", padding: "40px 0" }}>
                    No photo uploaded for this agent.
                  </div>
                );
              })()}
            </Modal.Body>
          </Modal>
        </main>
      </div>
    </div>
  );
};

export default AgentView;
