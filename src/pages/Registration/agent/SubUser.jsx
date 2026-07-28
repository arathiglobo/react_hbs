import React, { useEffect, useState } from "react";
import { Badge, Card, Button, Table, Modal, Form, Pagination, InputGroup } from "react-bootstrap";
import Sidebar from "../../../components/Sidebar";
import Topbar from "../../../components/TopBar";
import axiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";
import { FaEdit, FaTrash, FaSignInAlt, FaEye, FaEyeSlash } from "react-icons/fa";

const formatMarkupOption = (m) => {
  if (!m) return "";
  const value = m.markup;
  if (value === null || value === undefined || String(value).trim() === "") {
    return m.name || "";
  }
  const isPercent = String(m.markupType || "").toLowerCase() === "percent";
  return `${m.name || ""} - ${value}${isPercent ? "%" : ""}`;
};

const sortMarkupTypesByPercentage = (items = []) => {
  return [...items].sort((a, b) => {
    const aMarkup = Number(a?.markup);
    const bMarkup = Number(b?.markup);
    const aValue = Number.isFinite(aMarkup) ? aMarkup : Number.POSITIVE_INFINITY;
    const bValue = Number.isFinite(bMarkup) ? bMarkup : Number.POSITIVE_INFINITY;

    if (aValue !== bValue) return aValue - bValue;
    return String(a?.name || "").localeCompare(String(b?.name || ""));
  });
};

export default function SubUser() {
  const [items, setItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  // Default sub-user shape. Markup config mirrors the sub-agent form
  // (SubAgent.jsx: markup / currency / status with status defaulting to
  // "Active"). Existing sub-users load without markup data — the API returns
  // nulls, which the edit-preload block converts to empty selects.
  const initialFormState = {
    agentName: "",
    email: "",
    mobileNumber: "",
    address: "",
    countryId: "",
    provinceId: "",
    placeId: "",
    markup: "",
    currency: "",
    status: "Active",
  };
  const [formData, setFormData] = useState(initialFormState);
  const [isLoading, setIsLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  // Master lookups for the Country → City dropdowns. ("City" maps to the
  // province/state master — the place level isn't captured for sub-users.)
  const [countries, setCountries] = useState([]);
  const [provinces, setProvinces] = useState([]);
  // Markup Type + Currency master lists. Currency is displayed read-only after
  // resolving the logged-in sub-agent/main-agent currency.
  const [markupTypes, setMarkupTypes] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [subAgentCurrency, setSubAgentCurrency] = useState(null);

  // ── Login credentials (mirrors the Sub Agent login flow) ──────────────
  // Lets the main agent issue login credentials to a sub-user. The username
  // is stored as "prefix.mainAgent" (same convention as sub-agents) and the
  // account is created via /auth/register with subUser:true so the backend
  // resolves the credentials email from the sub_user table.
  const mainAgentName = localStorage.getItem("UserName") || "";
  const [rolesList, setRolesList] = useState([]);
  const [loginTarget, setLoginTarget] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRolesDropdown, setShowRolesDropdown] = useState(false);
  const [loginModalKey, setLoginModalKey] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showRePassword, setShowRePassword] = useState(false);
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

  const openCreate = () => {
    setEditing(null);
    setFormData({
      ...initialFormState,
      currency: subAgentCurrency?.id != null ? String(subAgentCurrency.id) : "",
    });
    setValidationErrors({});
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setFormData({
      ...initialFormState,
      agentName: item.agentName || "",
      email: item.email || "",
      mobileNumber: item.mobileNumber || "",
      address: item.address || "",
      countryId: item.countryId ? String(item.countryId) : "",
      provinceId: item.provinceId ? String(item.provinceId) : "",
      placeId: item.placeId ? String(item.placeId) : "",
      // Markup preload — coerce ids to strings so the <Form.Select> value
      // matches the option value (which is also a string via option.value).
      // Legacy rows without markup data leave the selects empty; the Status
      // select falls back to "Active" via initialFormState.
      markup: item.markup ? String(item.markup) : "",
      currency: subAgentCurrency?.id != null
        ? String(subAgentCurrency.id)
        : (item.currency ? String(item.currency) : ""),
      status: item.status || "Active",
    });
    setValidationErrors({});
    setShowModal(true);
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.agentName.trim()) errors.agentName = "Agent Name is required";
    if (!formData.email.trim()) {
      errors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = "Email is invalid";
    }
    if (!formData.mobileNumber.trim()) errors.mobileNumber = "Mobile Number is required";
    if (!formData.address.trim()) errors.address = "Address is required";
    // Markup config — mirrors sub-agent validation
    // (SubAgent.jsx: markup + status required, currency optional).
    if (!formData.markup) errors.markup = "Markup Type is required";
    if (!formData.status) errors.status = "Status is required";
    return errors;
  };

  const fetchSubUsers = async () => {
    setIsLoading(true);
    try {
      // Scoped to the logged-in main agent — this screen must only list the
      // sub-users that agent created. Mirrors SubAgent.jsx, which fetches
      // "/api/sub-agent/my-sub-agents". The owner is stamped server-side from
      // the JWT on create, so no agent id is sent from here.
      const res = await axiosInstance.get("/api/sub-user/my-sub-users");
      if (res.data && Array.isArray(res.data)) {
        setItems(res.data);
      } else {
        setItems([]);
      }
    } catch (err) {
      toast.error("Failed to load sub users");
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setIsLoading(true);
    try {
      // Send numeric location ids (or null) so the backend can bind them to
      // Long fields — empty selects must not be sent as "". Same rule
      // applies to markup (Long on the DTO) and currency (Integer), mirroring
      // the sub-agent payload in SubAgent.jsx.
      const payload = {
        ...formData,
        countryId: formData.countryId ? Number(formData.countryId) : null,
        provinceId: formData.provinceId ? Number(formData.provinceId) : null,
        placeId: formData.placeId ? Number(formData.placeId) : null,
        markup: formData.markup ? Number(formData.markup) : null,
        currency: formData.currency ? Number(formData.currency) : null,
      };
      if (editing) {
        await axiosInstance.put(`/api/sub-user/${editing.id}`, payload);
        toast.success("Sub User Updated Successfully!");
      } else {
        await axiosInstance.post("/api/sub-user", payload);
        toast.success("Sub User Created Successfully!");
      }
      fetchSubUsers();
      closeModal();
    } catch (error) {
      toast.error(editing ? "Failed to update sub user" : "Failed to create sub user");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = (item) => {
    Swal.fire({
      title: `Are you sure?`,
      text: `You want to delete ${item.agentName}`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
    }).then((result) => {
      if (result.isConfirmed) {
        axiosInstance
          .delete(`/api/sub-user/${item.id}`)
          .then(() => {
            toast.success("Sub User deleted successfully");
            fetchSubUsers();
          })
          .catch(() => {
            toast.error("Failed to delete sub user");
          });
      }
    });
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setFormData({
      ...initialFormState,
      currency: subAgentCurrency?.id != null ? String(subAgentCurrency.id) : "",
    });
    setValidationErrors({});
  };

  // ── Login credentials handlers (mirror SubAgent.jsx) ──────────────────
  const handleLogin = async (item) => {
    setLoginTarget(item);
    setLoginFormData({ username: "", password: "", repassword: "", userroles: [] });
    setLoginErrors({ username: "", password: "", repassword: "", userroles: "" });
    setShowRolesDropdown(false);
    setShowPassword(false);
    setShowRePassword(false);

    try {
      // Scope the "already registered?" check to the AGENT user type so
      // entities of other types sharing the same numeric id don't resolve to
      // this sub-user's account (backend keys user_accounts by user_id +
      // user_type_id).
      const agentRole = rolesList.find((r) => r.roleName === "AGENT");
      const checkUrl = agentRole
        ? `/auth/checkRegisteredUserExist/${item.id}?userTypeId=${agentRole.id}`
        : `/auth/checkRegisteredUserExist/${item.id}`;
      const response = await axiosInstance.post(checkUrl);
      if (response.data) {
        let userNameValue = response.data.userName || response.data.username || "";
        // Strip the ".mainAgent" suffix so only the prefix shows in the input.
        if (mainAgentName && userNameValue.endsWith(`.${mainAgentName}`)) {
          userNameValue = userNameValue.substring(0, userNameValue.length - mainAgentName.length - 1);
        }
        setLoginFormData((prev) => ({ ...prev, username: userNameValue }));
      }
    } catch (error) {
      // No existing login for this sub-user — expected for first-time setup.
    }
    setLoginModalKey((prev) => prev + 1);
    setShowLoginModal(true);
  };

  const handleLoginSubmit = async () => {
    let isValid = true;
    const errors = { username: "", password: "", repassword: "", userroles: "" };

    if (!loginFormData.username.trim()) { errors.username = "Username is required"; isValid = false; }
    if (!loginFormData.password) { errors.password = "Password is required"; isValid = false; }
    if (loginFormData.password !== loginFormData.repassword) { errors.repassword = "Passwords do not match"; isValid = false; }
    if (loginFormData.userroles.length === 0) { errors.userroles = "At least one user role is required"; isValid = false; }

    setLoginErrors(errors);
    if (!isValid) return;

    try {
      setIsLoading(true);
      const activeRoleObj = rolesList.find((role) => role.roleName === "AGENT");
      const loginPayload = {
        userId: loginTarget?.id,
        userTypeId: activeRoleObj?.id,
        userName: `${loginFormData.username}.${mainAgentName}`,
        password: loginFormData.password,
        userRoleIds: loginFormData.userroles,
        // Tells the backend to resolve the credentials email from the
        // sub_user_registration table (the AGENT id space is shared with
        // agents / sub-agents).
        subUser: true,
      };

      const response = await axiosInstance.post("/auth/register", loginPayload);
      if (response.data) {
        toast.success("Login credentials saved successfully!");
        setShowLoginModal(false);
      }
    } catch (error) {
      const serverMsg =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to save login credentials";
      toast.error(serverMsg);
    } finally {
      setIsLoading(false);
    }
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
      userroles: prev.userroles.filter((id) => id !== roleId),
    }));
  };

  const closeLoginModal = () => {
    setShowLoginModal(false);
    setShowRolesDropdown(false);
  };

  useEffect(() => {
    fetchSubUsers();
  }, []);

  // ── Country → Province → City master loading (mirrors the agent forms) ──
  const fetchCountries = async () => {
    try {
      const res = await axiosInstance.get("/api/country?page=0&limit=300&search=");
      setCountries(res.data || []);
    } catch (err) {
      setCountries([]);
    }
  };

  const fetchProvinces = async (countryId) => {
    if (!countryId) {
      setProvinces([]);
      return;
    }
    try {
      const res = await axiosInstance.get(`/api/province/getByCountryId/${countryId}`);
      setProvinces(res.data || []);
    } catch (err) {
      setProvinces([]);
    }
  };

  // Load Markup Type + Currency master lists on mount. Endpoints match the
  // sub-agent form (SubAgent.jsx fetchInitialMasterData) so both flows show
  // the same options. Failures leave the lists empty rather than blocking
  // the form.
  const fetchMarkupMasterData = async () => {
    try {
      const [markupRes, currRes, rolesRes] = await Promise.all([
        axiosInstance.get("/api/markupType"),
        axiosInstance.get("/api/currency"),
        axiosInstance.get("/api/userRoles"),
      ]);
      setMarkupTypes(sortMarkupTypesByPercentage(Array.isArray(markupRes.data) ? markupRes.data : []));
      setCurrencies(Array.isArray(currRes.data) ? currRes.data : []);
      setRolesList(Array.isArray(rolesRes.data) ? rolesRes.data : []);
    } catch (err) {
      setMarkupTypes([]);
      setCurrencies([]);
      setRolesList([]);
    }
  };

  const resolveSubAgentCurrency = async () => {
    try {
      const uname =
        localStorage.getItem("UserName") || sessionStorage.getItem("UserName");
      if (!uname) return;
      const prof = await axiosInstance.get(`/api/personalProfile/${uname}`);
      const agentId = prof?.data?.id;
      if (agentId == null) return;
      const agentRes = await axiosInstance.get(`/api/agent/${agentId}`);
      const currencyId = agentRes?.data?.currency;
      if (currencyId == null) return;
      setSubAgentCurrency({
        id: currencyId,
        code: agentRes?.data?.currencyCode || "",
      });
    } catch (err) {
      console.error("Could not resolve sub-agent currency", err);
    }
  };

  useEffect(() => {
    fetchCountries();
    fetchMarkupMasterData();
    resolveSubAgentCurrency();
  }, []);

  useEffect(() => {
    if (subAgentCurrency?.id != null) {
      setFormData((prev) => ({ ...prev, currency: String(subAgentCurrency.id) }));
    }
  }, [subAgentCurrency]);

  useEffect(() => {
    fetchProvinces(formData.countryId);
  }, [formData.countryId]);

  const filteredItems = items.filter((item) =>
    item.agentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.mobileNumber?.includes(searchTerm)
  );

  const subAgentCurrencyLabel = () => {
    if (!subAgentCurrency) return "Not configured";
    const match = currencies.find(
      (c) => String(c.currencyId || c.id) === String(subAgentCurrency.id)
    );
    const code = subAgentCurrency.code || match?.currencyCode || match?.code || "";
    const name = (match?.name || match?.currencyName || "").trim();
    return name ? `${code} - ${name}` : code || `#${subAgentCurrency.id}`;
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Card className="shadow-sm rounded-xl">
            <Card.Header className="d-flex justify-content-between align-items-center">
              <span className="fw-semibold">Sub User Registration</span>
               <Form.Group className="hotel-search-bar">
                  <Form.Control
                    type="text"
                    placeholder="Search sub users..."
                    className="form-control-modern-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </Form.Group>
              <Button className="btn-green" onClick={openCreate}>
                + Create
              </Button>
            </Card.Header>
            <Card.Body className="p-0">
              <Table responsive hover striped className="mb-0 align-middle">
                <thead className="bg-light">
                  <tr>
                    <th className="ps-4">S/N</th>
                    <th>Sub User Name</th>
                    <th>Email</th>
                    <th>Mobile</th>
                    <th>Country</th>
                    <th>City</th>
                    <th>Address</th>
                    <th className="text-center">Status</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={9} className="text-center py-5">
                        <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                        Loading...
                      </td>
                    </tr>
                  ) : filteredItems.length > 0 ? (
                    filteredItems.map((item, index) => (
                      <tr key={item.id}>
                        <td className="ps-4">{index + 1}</td>
                        <td className="fw-medium">{item.agentName}</td>
                        <td>{item.email}</td>
                        <td>{item.mobileNumber}</td>
                        <td>{item.countryName || "—"}</td>
                        <td>{item.provinceName || "—"}</td>
                        <td>{item.address}</td>
                        {/* Status pill — mirrors the sub-agent convention:
                            anything other than a case-insensitive "inactive"
                            is treated as Active. Legacy rows created before
                            the status column existed (status == null) render
                            as Active. */}
                        <td className="text-center">
                          {(() => {
                            const isActive =
                              String(item.status || "").trim().toLowerCase() !==
                              "inactive";
                            return (
                              <Badge
                                bg={isActive ? "success" : "secondary"}
                                style={{ fontWeight: 600 }}
                              >
                                {isActive ? "Active" : "Inactive"}
                              </Badge>
                            );
                          })()}
                        </td>
                        <td>
                          <div className="d-flex flex-wrap justify-content-center gap-2">
                            <Button
                              variant="outline-primary"
                              size="sm"
                              className="d-flex align-items-center gap-1"
                              onClick={() => handleLogin(item)}
                            >
                              <FaSignInAlt /> Login
                            </Button>
                            <Button
                              variant="outline-success"
                              size="sm"
                              className="d-flex align-items-center gap-1"
                              onClick={() => openEdit(item)}
                            >
                              <FaEdit /> Edit
                            </Button>
                            {/* Delete hidden per request — kept for easy restore.
                            <Button
                              variant="outline-danger"
                              size="sm"
                              className="d-flex align-items-center gap-1"
                              onClick={() => handleDelete(item)}
                            >
                              <FaTrash /> Delete
                            </Button>
                            */}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="text-center py-5 text-muted">
                        No sub users found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </Card.Body>
          </Card>

          <Modal show={showModal} onHide={closeModal} centered size="lg">
            <Modal.Header closeButton className="bg-light">
              <Modal.Title className="h5 fw-bold">
                {editing ? "Update Sub User" : "Register Sub User"}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body className="px-4 py-4">
              <Form>
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <Form.Group>
                      <Form.Label className="small fw-bold">Agent Name</Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="Enter agent name"
                        value={formData.agentName}
                        onChange={(e) => setFormData({ ...formData, agentName: e.target.value })}
                        isInvalid={!!validationErrors.agentName}
                      />
                      <Form.Control.Feedback type="invalid">{validationErrors.agentName}</Form.Control.Feedback>
                    </Form.Group>
                  </div>
                  <div className="col-md-6 mb-3">
                    <Form.Group>
                      <Form.Label className="small fw-bold">Email Address</Form.Label>
                      <Form.Control
                        type="email"
                        placeholder="Enter email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        isInvalid={!!validationErrors.email}
                      />
                      <Form.Control.Feedback type="invalid">{validationErrors.email}</Form.Control.Feedback>
                    </Form.Group>
                  </div>
                  <div className="col-md-6 mb-3">
                    <Form.Group>
                      <Form.Label className="small fw-bold">Mobile Number</Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="Enter mobile number"
                        value={formData.mobileNumber}
                        onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
                        isInvalid={!!validationErrors.mobileNumber}
                      />
                      <Form.Control.Feedback type="invalid">{validationErrors.mobileNumber}</Form.Control.Feedback>
                    </Form.Group>
                  </div>
                  <div className="col-md-6 mb-3">
                    <Form.Group>
                      <Form.Label className="small fw-bold">Country</Form.Label>
                      <Form.Select
                        value={formData.countryId}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            countryId: e.target.value,
                            // Reset the dependent City selection when country changes.
                            provinceId: "",
                          })
                        }
                      >
                        <option value="">Select country</option>
                        {countries.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </div>
                  <div className="col-md-6 mb-3">
                    <Form.Group>
                      <Form.Label className="small fw-bold">City</Form.Label>
                      <Form.Select
                        value={formData.provinceId}
                        disabled={!formData.countryId}
                        onChange={(e) =>
                          setFormData({ ...formData, provinceId: e.target.value })
                        }
                      >
                        <option value="">Select city</option>
                        {provinces.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name || p.stateName}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </div>
                  <div className="col-md-12 mb-3">
                    <Form.Group>
                      <Form.Label className="small fw-bold">Address</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={3}
                        placeholder="Enter address"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        isInvalid={!!validationErrors.address}
                      />
                      <Form.Control.Feedback type="invalid">{validationErrors.address}</Form.Control.Feedback>
                    </Form.Group>
                  </div>
                  {/* ── Markup configuration ─────────────────────────────
                      Mirrors the Settings block on the sub-agent form
                      (Markup Type required, Currency inherited, Status
                      required). Markup options come from /api/markupType. */}
                  <div className="col-md-4 mb-3">
                    <Form.Group>
                      <Form.Label className="small fw-bold">
                        <span className="text-danger">* </span>Markup Type
                      </Form.Label>
                      <Form.Select
                        value={formData.markup}
                        onChange={(e) =>
                          setFormData({ ...formData, markup: e.target.value })
                        }
                        isInvalid={!!validationErrors.markup}
                      >
                        <option value="">SELECT</option>
                        {markupTypes.map((m) => (
                          <option key={m.id} value={m.id}>
                            {formatMarkupOption(m)}
                          </option>
                        ))}
                      </Form.Select>
                      <Form.Control.Feedback type="invalid">
                        {validationErrors.markup}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </div>
                  <div className="col-md-4 mb-3">
                    <Form.Group>
                      <Form.Label className="small fw-bold">Currency</Form.Label>
                      <Form.Control
                        value={subAgentCurrencyLabel()}
                        readOnly
                        disabled
                      />
                    </Form.Group>
                  </div>
                  <div className="col-md-4 mb-3">
                    <Form.Group>
                      <Form.Label className="small fw-bold">
                        <span className="text-danger">* </span>Status
                      </Form.Label>
                      <Form.Select
                        value={formData.status}
                        onChange={(e) =>
                          setFormData({ ...formData, status: e.target.value })
                        }
                        isInvalid={!!validationErrors.status}
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </Form.Select>
                      <Form.Control.Feedback type="invalid">
                        {validationErrors.status}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </div>
                </div>
              </Form>
            </Modal.Body>
            <Modal.Footer className="bg-light border-top-0">
              <Button variant="link" className="text-muted text-decoration-none" onClick={closeModal} disabled={isLoading}>
                Cancel
              </Button>
              <Button className="btn-indigo px-4" onClick={handleSubmit} disabled={isLoading}>
                {isLoading ? "Processing..." : editing ? "Update User" : "Create User"}
              </Button>
            </Modal.Footer>
          </Modal>

          {/* Login Credentials Modal — mirrors the Sub Agent login flow */}
          <Modal show={showLoginModal} onHide={closeLoginModal} centered key={loginModalKey} backdrop="static">
            <Modal.Header closeButton>
              <Modal.Title>Login Details for: {loginTarget?.agentName}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form>
                <Form.Group className="mb-3">
                  <Form.Label>Username</Form.Label>
                  <div className="input-group">
                    <Form.Control
                      name="login-username"
                      value={loginFormData.username}
                      onChange={handleLoginChange}
                      isInvalid={!!loginErrors.username}
                      placeholder="Enter username"
                    />
                    <span className="input-group-text">.</span>
                    <Form.Control
                      value={mainAgentName}
                      readOnly
                      disabled
                      className="bg-light text-muted"
                      style={{ maxWidth: '150px' }}
                    />
                  </div>
                  <div className="mt-2" style={{ fontSize: '0.85rem' }}>
                    Your username is: <span className="text-danger fw-bold">{loginFormData.username ? `${loginFormData.username}.${mainAgentName}` : `prefix.${mainAgentName}`}</span>
                  </div>
                  {loginErrors.username && <div className="text-danger small mt-1">{loginErrors.username}</div>}
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Password</Form.Label>
                  <InputGroup hasValidation>
                    <Form.Control
                      type={showPassword ? "text" : "password"}
                      name="login-password"
                      value={loginFormData.password}
                      onChange={handleLoginChange}
                      isInvalid={!!loginErrors.password}
                    />
                    <Button
                      variant="outline-secondary"
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      title={showPassword ? "Hide password" : "Show password"}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <FaEyeSlash /> : <FaEye />}
                    </Button>
                    <Form.Control.Feedback type="invalid">{loginErrors.password}</Form.Control.Feedback>
                  </InputGroup>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Confirm Password</Form.Label>
                  <InputGroup hasValidation>
                    <Form.Control
                      type={showRePassword ? "text" : "password"}
                      name="login-repassword"
                      value={loginFormData.repassword}
                      onChange={handleLoginChange}
                      isInvalid={!!loginErrors.repassword}
                    />
                    <Button
                      variant="outline-secondary"
                      type="button"
                      onClick={() => setShowRePassword((v) => !v)}
                      title={showRePassword ? "Hide password" : "Show password"}
                      aria-label={showRePassword ? "Hide password" : "Show password"}
                    >
                      {showRePassword ? <FaEyeSlash /> : <FaEye />}
                    </Button>
                    <Form.Control.Feedback type="invalid">{loginErrors.repassword}</Form.Control.Feedback>
                  </InputGroup>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>User Roles</Form.Label>
                  <div className="form-control d-flex flex-wrap align-items-center" style={{ cursor: 'pointer' }} onClick={() => setShowRolesDropdown(!showRolesDropdown)}>
                    {loginFormData.userroles.length > 0 ? loginFormData.userroles.map(roleId => {
                      const role = rolesList.find(r => r.id === roleId);
                      return role ? (
                        <span key={roleId} className="badge bg-primary me-1 mb-1">
                          {role.roleName}
                          <span
                            role="button"
                            className="ms-1"
                            onClick={(e) => { e.stopPropagation(); removeRole(roleId); }}
                          >
                            ×
                          </span>
                        </span>
                      ) : null;
                    }) : <span className="text-muted">Select roles...</span>}
                  </div>
                  {showRolesDropdown && (
                    <div className="border rounded mt-1 bg-white shadow-sm" style={{ maxHeight: '150px', overflowY: 'auto' }}>
                      {rolesList.map(role => (
                        <div key={role.id} className="p-2 cursor-pointer hover-bg-light" onClick={() => toggleRole(role.id)} onMouseEnter={e => e.target.style.backgroundColor='#f8f9fa'} onMouseLeave={e => e.target.style.backgroundColor=''}>
                          {role.roleName}
                        </div>
                      ))}
                    </div>
                  )}
                  {loginErrors.userroles && <div className="text-danger small">{loginErrors.userroles}</div>}
                </Form.Group>
              </Form>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={closeLoginModal}>Cancel</Button>
              <Button variant="primary" onClick={handleLoginSubmit} disabled={isLoading}>Save</Button>
            </Modal.Footer>
          </Modal>
        </main>
      </div>
    </div>
  );
}
