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
import axios from "axios";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";
import {
  FaEdit,
  FaTrash,
  FaEye,
  FaSignInAlt,
  FaCreditCard,
} from "react-icons/fa";

const AgentReg = () => {
  const [items, setItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
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
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginFormData, setLoginFormData] = useState({
    username: "",
    password: "",
    repassword: "",
  });
  const [loginErrors, setLoginErrors] = useState({
    username: "",
    password: "",
    repassword: "",
  });

  const nextId = useMemo(
    () => Math.max(0, ...items.map((i) => i.id)) + 1,
    [items]
  );

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
    });
    setProvinces([]);
    setPlaces([]);
    setError("");
    setShowModal(true);
  };

  const openEdit = (item) => {
    console.log("edit item:::", item);
    setEditing(item);
    setFormData({
      companyName: item.companyName || "",
      shortName: item.shortName || "",
      businessType: item.businessType || "",
      agentCategoryId: item.agentCategoryId || "",
      companyCode: item.companyCode || "",
      agentUrl: item.agentUrl || "",
      firstName: item.firstName || "",
      lastName: item.lastName || "",
      personalEmail: item.personalEmail || "",
      zipCode: item.zipCode || "",
      mobileNumber: item.mobileNumber || "",
      telephoneNumber: item.telephoneNumber || "",
      contactPerson: item.contactPerson || "",
      countryId: item.countryId || "",
      provinceId: item.provinceId || "",
      placeId: item.placeId || "",
      address: item.address || "",
      markup: item.markup || "",
      currency: item.currencyId || "", // Use currencyId from item
      status: item.status || "",
    });
    // Fetch provinces and cities for the selected country and province
    if (item.countryId) {
      provinceList(item.countryId).then(() => {
        if (item.provinceId) {
          cityList(item.provinceId);
        }
      });
    }
    setShowModal(true);
  };

  const agentCategoryList = async () => {
    try {
      const agentCatResponse = await axios.get("/api/agentCategory");
      setAgentCategoryies(agentCatResponse.data);
    } catch (error) {
      console.log("agent category api call error::", error);
    }
  };

  const countryList = async () => {
    try {
      const response = await axios.get("/api/country");
      setCountries(response.data);
    } catch (error) {
      console.log("error for country list :", error);
    }
  };

  const provinceList = async (countryId) => {
    try {
      const response = await axios.get(
        `/api/province/getByCountryId/${countryId}`
      );
      setProvinces(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.log("axios call error for province list : ", error);
    }
  };

  const cityList = async (stateId) => {
    try {
      const response = await axios.get(`/api/destination/getplaces/${stateId}`);
      setPlaces(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.log("axios call error for city list : ", error);
    }
  };

  const markupList = async () => {
    try {
      const response = await axiosInstance.get(`/api/markupType`);
      setMarkup(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.log("axios call error for markup list : ", error);
    }
  };

  const currencyList = async () => {
    try {
      const response = await axiosInstance.get(`/api/currency`);
      setCurrency(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.log("axios call error for currency list : ", error);
    }
  };

  useEffect(() => {
    if (formData.countryId) {
      setProvinces([]);
      setPlaces([]);
      setFormData((prev) => ({
        ...prev,
        provinceId: "",
        placeId: "",
      }));
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
    if (formData.provinceId) {
      setPlaces([]);
      setFormData((prev) => ({
        ...prev,
        placeId: "",
      }));
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
    if (!editing) return;

    try {
      setIsLoading(true);
      const editRes = await axiosInstance.put(
        `/api/agent/${editing.id}`,
        formData
      );

      if (editRes.data) {
        toast.success("Agent Updated Successfully!");
        await fetchAgentList(page, search);
        closeModal();
      }
    } catch (error) {
      setError("Failed to update agent");
      toast.error("Failed to update agent");
    } finally {
      setIsLoading(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
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
    });
    setProvinces([]);
    setPlaces([]);
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
    agentCategoryList();
    markupList();
    currencyList();
  }, []);

  const saveAgent = async () => {
    try {
      setIsLoading(true);
      const agentPayload = { ...formData };
      console.log("agentPayload::", agentPayload);
      const agentSaveRes = await axiosInstance.post(
        "/api/agent/register",
        agentPayload
      );
      if (agentSaveRes.data !== 0) {
        toast.success("Agent added Successfully!");
        await fetchAgentList(page, search);
        closeModal();
      }
    } catch (error) {
      setError("Sorry! Data not saved to db..");
      toast.error("Failed to save agent data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (search !== "") {
      const timeout = setTimeout(() => {
        fetchAgentList(0, search);
      }, 500);
      setSearchTimeout(timeout);
    } else if (search === "") {
      fetchAgentList(0, "");
    }

    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
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

  const handleView = (item) => {
    setEditing(item);
    setFormData({
      companyName: item.companyName || "",
      shortName: item.shortName || "",
      businessType: item.businessType || "",
      agentCategoryId: item.agentCategoryId || "",
      companyCode: item.companyCode || "",
      agentUrl: item.agentUrl || "",
      firstName: item.firstName || "",
      lastName: item.lastName || "",
      personalEmail: item.personalEmail || "",
      zipCode: item.zipCode || "",
      mobileNumber: item.mobileNumber || "",
      telephoneNumber: item.telephoneNumber || "",
      contactPerson: item.contactPerson || "",
      countryId: item.countryId || "",
      provinceId: item.provinceId || "",
      placeId: item.placeId || "",
      address: item.address || "",
      markup: item.markup || "",
      currency: item.currencyId || "",
      status: item.status || "",
    });
    // Fetch provinces and cities for the selected country and province
    if (item.countryId) {
      provinceList(item.countryId).then(() => {
        if (item.provinceId) {
          cityList(item.provinceId);
        }
      });
    }
    setShowModal(true);
  };

  const handleLogin = (item) => {
    setEditing(item);
    setLoginFormData({
      username: "",
      password: "",
      repassword: "",
    });
    setLoginErrors({
      username: "",
      password: "",
      repassword: "",
    });
    setShowLoginModal(true);
  };

  const handleLoginSubmit = () => {
    let isValid = true;
    const errors = { username: "", password: "", repassword: "" };

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

    setLoginErrors(errors);

    if (isValid) {
      console.log("Login data for agent:", editing.companyName, loginFormData);
      toast.success("Login credentials saved successfully!");
      setShowLoginModal(false);
    } else {
      toast.error("Please fix the errors in the form");
    }
  };

  const handleLoginChange = (e) => {
    const { name, value } = e.target;
    setLoginFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const closeLoginModal = () => {
    setShowLoginModal(false);
    setLoginFormData({
      username: "",
      password: "",
      repassword: "",
    });
    setLoginErrors({
      username: "",
      password: "",
      repassword: "",
    });
  };

  const handleCreditLimit = (item) => {
    console.log("Manage credit limit for agent:", item.companyName);
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
                            className="text-primary"
                            style={{ cursor: "pointer", fontSize: "18px" }}
                            onClick={() => openEdit(item)}
                            title="Edit"
                          />
                          <FaEye
                            className="text-info"
                            style={{ cursor: "pointer", fontSize: "18px" }}
                            onClick={() => handleView(item)}
                            title="View"
                          />
                          <FaSignInAlt
                            className="text-success"
                            style={{ cursor: "pointer", fontSize: "18px" }}
                            onClick={() => handleLogin(item)}
                            title="Login"
                          />
                          <FaCreditCard
                            className="text-warning"
                            style={{ cursor: "pointer", fontSize: "18px" }}
                            onClick={() => handleCreditLimit(item)}
                            title="Credit Limit"
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
                        <option
                          key={num}
                          active={num === page}
                          onClick={() => fetchAgentList(num, search)}
                        >
                          {num + 1}
                        </option>
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

          <Modal show={showModal} onHide={closeModal} centered size="lg">
            <Modal.Header closeButton={!isLoading}>
              <Modal.Title>
                {editing ? "Update Agent" : "Create Agent"}
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
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                companyName: e.target.value,
                              })
                            }
                            placeholder="Enter company name"
                            autoFocus
                            isInvalid={!!error}
                          />
                        </Form.Group>
                      </Col>
                      <Col md={3}>
                        <Form.Group className="mb-3">
                          <Form.Label>Short Name</Form.Label>
                          <Form.Control
                            value={formData.shortName}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                shortName: e.target.value,
                              })
                            }
                            placeholder="Enter short name"
                          />
                        </Form.Group>
                      </Col>
                      <Col md={3}>
                        <Form.Group className="mb-3">
                          <Form.Label>Business Type</Form.Label>
                          <Form.Control
                            value={formData.businessType}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                businessType: e.target.value,
                              })
                            }
                            placeholder="Enter business name"
                          />
                        </Form.Group>
                      </Col>
                      <Col md={3}>
                        <Form.Group className="mb-3">
                          <Form.Label>Company Type</Form.Label>
                          <Form.Select
                            value={formData.agentCategoryId}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                agentCategoryId: e.target.value,
                              })
                            }
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
                        </Form.Group>
                      </Col>
                    </Row>
                    <Row>
                      <Col md={3}>
                        <Form.Group className="mb-3">
                          <Form.Label>Company Code</Form.Label>
                          <Form.Control
                            value={formData.companyCode}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                companyCode: e.target.value,
                              })
                            }
                            placeholder="Enter company code"
                          />
                        </Form.Group>
                      </Col>
                      <Col md={3}>
                        <Form.Group className="mb-3">
                          <Form.Label>Agent URL</Form.Label>
                          <Form.Control
                            value={formData.agentUrl}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                agentUrl: e.target.value,
                              })
                            }
                            placeholder="Enter agent URL"
                          />
                        </Form.Group>
                      </Col>
                      <Col md={3}>
                        <Form.Group className="mb-3">
                          <Form.Label>Company Logo</Form.Label>
                          <Form.Control
                            type="file"
                            accept="image/*"
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                agentLogo: e.target.files[0],
                              })
                            }
                          />
                        </Form.Group>
                      </Col>
                      <Col md={3}>
                        <Form.Group className="mb-3">
                          <Form.Label>First Name</Form.Label>
                          <Form.Control
                            value={formData.firstName}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                firstName: e.target.value,
                              })
                            }
                            placeholder="Enter first name"
                          />
                        </Form.Group>
                      </Col>
                      <Col md={3}>
                        <Form.Group className="mb-3">
                          <Form.Label>Last Name</Form.Label>
                          <Form.Control
                            value={formData.lastName}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                lastName: e.target.value,
                              })
                            }
                            placeholder="Enter last name"
                          />
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
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    personalEmail: e.target.value,
                                  })
                                }
                                placeholder="Enter email"
                              />
                            </Form.Group>
                          </Col>
                          <Col md={6}>
                            <Form.Group className="mb-3">
                              <Form.Label>Zip Code</Form.Label>
                              <Form.Control
                                value={formData.zipCode}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    zipCode: e.target.value,
                                  })
                                }
                                placeholder="Enter zip code"
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
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    mobileNumber: e.target.value,
                                  })
                                }
                                placeholder="Enter mobile number"
                              />
                            </Form.Group>
                          </Col>
                          <Col md={6}>
                            <Form.Group className="mb-3">
                              <Form.Label>Telephone Number</Form.Label>
                              <Form.Control
                                value={formData.telephoneNumber}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    telephoneNumber: e.target.value,
                                  })
                                }
                                placeholder="Enter telephone number"
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
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    contactPerson: e.target.value,
                                  })
                                }
                                placeholder="Enter contact person"
                              />
                            </Form.Group>
                          </Col>
                          <Col md={6}>
                            <Form.Group className="mb-3">
                              <Form.Label>Country</Form.Label>
                              <Form.Select
                                name="countryId"
                                value={formData.countryId}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    countryId: e.target.value,
                                  })
                                }
                              >
                                <option value="">Select country</option>
                                {countries.map((country) => (
                                  <option key={country.id} value={country.id}>
                                    {country.name}
                                  </option>
                                ))}
                              </Form.Select>
                            </Form.Group>
                          </Col>
                        </Row>
                        <Row>
                          <Col md={6}>
                            <Form.Group className="mb-3">
                              <Form.Label>Province</Form.Label>
                              <Form.Select
                                name="provinceId"
                                value={formData.provinceId}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    provinceId: e.target.value,
                                  })
                                }
                                disabled={!formData.countryId}
                              >
                                <option value="">Select province/state</option>
                                {Array.isArray(provinces) &&
                                  provinces.map((province) => (
                                    <option
                                      key={province.id}
                                      value={province.id}
                                    >
                                      {province.stateName}
                                    </option>
                                  ))}
                              </Form.Select>
                            </Form.Group>
                          </Col>
                          <Col md={6}>
                            <Form.Group className="mb-3">
                              <Form.Label>City</Form.Label>
                              <Form.Select
                                name="placeId"
                                value={formData.placeId}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    placeId: e.target.value,
                                  })
                                }
                                disabled={!formData.provinceId}
                              >
                                <option value="">Select city</option>
                                {Array.isArray(places) &&
                                  places.map((place) => (
                                    <option key={place.id} value={place.id}>
                                      {place.name}
                                    </option>
                                  ))}
                              </Form.Select>
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
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  address: e.target.value,
                                })
                              }
                              placeholder="Enter address"
                            />
                          </Form.Group>
                        </Col>
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
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                markup: e.target.value,
                              })
                            }
                          >
                            <option value="">Select Markup</option>
                            {Array.isArray(markup) &&
                              markup.map((mar) => (
                                <option key={mar.id} value={mar.id}>
                                  {mar.name}
                                </option>
                              ))}
                          </Form.Select>
                        </Form.Group>
                        <Form.Group className="mb-3">
                          <Form.Label>Currency</Form.Label>
                          <Form.Select
                            value={formData.currency}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                currency: e.target.value,
                              })
                            }
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
                        </Form.Group>
                        <Form.Group className="mb-3">
                          <Form.Label>Status</Form.Label>
                          <Form.Select
                            value={formData.status}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                status: e.target.value,
                              })
                            }
                          >
                            <option value="">SELECT</option>
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                          </Form.Select>
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
                Cancel
              </Button>
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
            </Modal.Footer>
          </Modal>

          <Modal show={showLoginModal} onHide={closeLoginModal} centered>
            <Modal.Header closeButton>
              <Modal.Title>
                Set Login Credentials for {editing?.companyName}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form>
                <Form.Group className="mb-3">
                  <Form.Label>Username</Form.Label>
                  <Form.Control
                    type="text"
                    name="username"
                    value={loginFormData.username}
                    onChange={handleLoginChange}
                    isInvalid={!!loginErrors.username}
                    placeholder="Enter username"
                  />
                  <Form.Control.Feedback type="invalid">
                    {loginErrors.username}
                  </Form.Control.Feedback>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Password</Form.Label>
                  <Form.Control
                    type="password"
                    name="password"
                    value={loginFormData.password}
                    onChange={handleLoginChange}
                    isInvalid={!!loginErrors.password}
                    placeholder="Enter password"
                  />
                  <Form.Control.Feedback type="invalid">
                    {loginErrors.password}
                  </Form.Control.Feedback>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Re-enter Password</Form.Label>
                  <Form.Control
                    type="password"
                    name="repassword"
                    value={loginFormData.repassword}
                    onChange={handleLoginChange}
                    isInvalid={!!loginErrors.repassword}
                    placeholder="Re-enter password"
                  />
                  <Form.Control.Feedback type="invalid">
                    {loginErrors.repassword}
                  </Form.Control.Feedback>
                </Form.Group>
              </Form>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={closeLoginModal}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleLoginSubmit}>
                Save
              </Button>
            </Modal.Footer>
          </Modal>
        </main>
      </div>
    </div>
  );
};

export default AgentReg;