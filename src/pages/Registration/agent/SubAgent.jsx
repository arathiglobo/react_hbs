import React, { useEffect, useState, useRef } from "react";
import { Card, Button, Table, Modal, Form, Row, Col, Spinner } from "react-bootstrap";
import Sidebar from "../../../components/Sidebar";
import Topbar from "../../../components/TopBar";
import axiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";
import { FaEdit, FaTrash, FaPlus, FaSearch, FaChevronDown, FaUndo, FaTimes, FaCheck } from "react-icons/fa";

// Searchable Select Component for large lists
const SearchableSelect = ({ label, name, value, options, onChange, placeholder, onSearch, isLoading, error, required }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (option) => {
    onChange({ target: { name, value: option.id } });
    setIsOpen(false);
    setSearchTerm("");
  };

  const selectedOption = options.find(opt => String(opt.id) === String(value));

  return (
    <Form.Group className="mb-3" ref={dropdownRef}>
      <Form.Label className="small fw-bold">{required && <span className="text-danger">* </span>}{label}</Form.Label>
      <div className="position-relative">
        <div 
          className={`form-select ${error ? 'is-invalid' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
          style={{ 
            cursor: 'pointer', 
            fontSize: '0.85rem',
            minHeight: '35px',
            backgroundColor: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingRight: '2rem',
            backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 16 16\'%3e%3cpath fill=\'none\' stroke=\'%23343a40\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'m2 5 6 6 6-6\'/%3e%3c/svg%3e")', 
            backgroundRepeat: 'no-repeat', 
            backgroundPosition: 'right .75rem center', 
            backgroundSize: '12px 9px'
          }}
        >
          <span className={selectedOption ? "" : "text-muted"}>
            {selectedOption ? (selectedOption.name || selectedOption.stateName || selectedOption.cityName) : "SELECT"}
          </span>
        </div>
        {error && <div className="invalid-feedback d-block" style={{ fontSize: '0.7rem' }}>{error}</div>}
        
        {isOpen && (
          <div className="position-absolute w-100 bg-white shadow-lg rounded-2 border mt-1" style={{ zIndex: 1050, maxHeight: '200px', overflowY: 'auto' }}>
            <div className="p-2 border-bottom sticky-top bg-white">
              <Form.Control
                size="sm"
                autoFocus
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (onSearch) onSearch(e.target.value);
                }}
              />
            </div>
            <div className="py-1">
              {isLoading ? (
                <div className="text-center py-2"><Spinner animation="border" size="sm" /></div>
              ) : options.length > 0 ? (
                options.map(opt => (
                  <div 
                    key={opt.id} 
                    className="px-3 py-1 cursor-pointer hover-bg-light"
                    style={{ cursor: 'pointer', fontSize: '0.85rem' }}
                    onClick={() => handleSelect(opt)}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#f8f9fa'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                  >
                    {opt.name || opt.stateName || opt.cityName}
                  </div>
                ))
              ) : (
                <div className="px-3 py-1 text-muted small text-center">No options found</div>
              )}
            </div>
          </div>
        )}
      </div>
    </Form.Group>
  );
};

export default function SubAgent() {
  const [items, setItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Master Data States
  const [categories, setCategories] = useState([]);
  const [countries, setCountries] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [places, setPlaces] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  
  const [isDataLoading, setIsDataLoading] = useState({
    countries: false,
    provinces: false,
    places: false
  });

  const initialFormState = {
    businessType: "",
    agentCategoryId: "",
    companyName: "",
    firstName: "",
    lastName: "",
    countryId: "",
    provinceId: "",
    placeId: "",
    personalEmail: "",
    mobileNumber: "",
    address: "",
    companyCode: "",
    zipCode: "",
    contactPerson: "",
    markup: "",
    currency: "",
    status: "Active",
    faxNumber: "",
    telephoneNumber: ""
  };

  const [formData, setFormData] = useState(initialFormState);
  const [validationErrors, setValidationErrors] = useState({});

  // ─── Data Fetching ──────────────────────────────────────────────────────────

  const fetchSubAgents = async () => {
    setIsLoading(true);
    try {
      const res = await axiosInstance.get("/api/sub-agent/my-sub-agents");
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error("Failed to load sub agents");
    } finally {
      setIsLoading(false);
    }
  };

  const searchTimeoutRef = useRef(null);
  const fetchCountries = async (search = "") => {
    setIsDataLoading(prev => ({ ...prev, countries: true }));
    try {
      const res = await axiosInstance.get(`/api/country?page=0&limit=50&search=${encodeURIComponent(search)}`);
      setCountries(res.data || []);
    } catch (err) {
      console.error("Error fetching countries", err);
    } finally {
      setIsDataLoading(prev => ({ ...prev, countries: false }));
    }
  };

  const handleCountrySearch = (val) => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      fetchCountries(val);
    }, 500);
  };

  const fetchProvinces = async (countryId) => {
    if (!countryId) return;
    setIsDataLoading(prev => ({ ...prev, provinces: true }));
    try {
      const res = await axiosInstance.get(`/api/province/getByCountryId/${countryId}`);
      setProvinces(res.data || []);
    } catch (err) {
      console.error("Error fetching provinces", err);
    } finally {
      setIsDataLoading(prev => ({ ...prev, provinces: false }));
    }
  };

  const fetchPlaces = async (provinceId) => {
    if (!provinceId) return;
    setIsDataLoading(prev => ({ ...prev, places: true }));
    try {
      const res = await axiosInstance.get(`/api/destination/getplaces/${provinceId}`);
      setPlaces(res.data || []);
    } catch (err) {
      console.error("Error fetching places", err);
    } finally {
      setIsDataLoading(prev => ({ ...prev, places: false }));
    }
  };

  const fetchInitialMasterData = async () => {
    try {
      const [catRes, currRes] = await Promise.all([
        axiosInstance.get("/api/agentCategory"),
        axiosInstance.get("/api/currency")
      ]);
      setCategories(catRes.data || []);
      setCurrencies(currRes.data || []);
      fetchCountries(""); 
    } catch (err) {
      console.error("Error fetching initial master data", err);
    }
  };

  useEffect(() => {
    fetchSubAgents();
    fetchInitialMasterData();
  }, []);

  useEffect(() => {
    if (formData.countryId) {
      fetchProvinces(formData.countryId);
    } else {
      setProvinces([]);
    }
  }, [formData.countryId]);

  useEffect(() => {
    if (formData.provinceId) {
      fetchPlaces(formData.provinceId);
    } else {
      setPlaces([]);
    }
  }, [formData.provinceId]);

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const validate = () => {
    const errors = {};
    if (!formData.companyName) errors.companyName = "Required";
    if (!formData.businessType) errors.businessType = "Required";
    if (!formData.agentCategoryId) errors.agentCategoryId = "Required";
    if (!formData.firstName) errors.firstName = "Required";
    if (!formData.lastName) errors.lastName = "Required";
    if (!formData.personalEmail) errors.personalEmail = "Required";
    if (!formData.mobileNumber) errors.mobileNumber = "Required";
    if (!formData.countryId) errors.countryId = "Required";
    if (!formData.provinceId) errors.provinceId = "Required";
    if (!formData.placeId) errors.placeId = "Required";
    if (!formData.address) errors.address = "Required";
    if (!formData.markup) errors.markup = "Required";
    if (!formData.status) errors.status = "Required";
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      const payload = {
        ...formData,
        agentCategoryId: parseInt(formData.agentCategoryId),
        countryId: parseInt(formData.countryId),
        provinceId: parseInt(formData.provinceId),
        placeId: parseInt(formData.placeId),
        currency: formData.currency ? parseInt(formData.currency) : null,
      };

      if (editing) {
        await axiosInstance.put(`/api/sub-agent/${editing.id}`, payload);
        toast.success("Sub Agent updated successfully");
      } else {
        await axiosInstance.post("/api/sub-agent/register", payload);
        toast.success("Sub Agent registered successfully");
      }
      fetchSubAgents();
      handleClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Operation failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = (id) => {
    Swal.fire({
      title: "Are you sure?",
      text: "This action cannot be undone!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Yes, delete it!"
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await axiosInstance.delete(`/api/sub-agent/${id}`);
          toast.success("Sub Agent deleted");
          fetchSubAgents();
        } catch (err) {
          toast.error("Delete failed");
        }
      }
    });
  };

  const handleOpen = (item = null) => {
    if (item) {
      setEditing(item);
      setFormData({
        ...initialFormState,
        ...item,
        agentCategoryId: String(item.agentCategoryId || ""),
        countryId: String(item.countryId || ""),
        provinceId: String(item.provinceId || ""),
        placeId: String(item.placeId || ""),
        currency: item.currency ? String(item.currency) : "",
      });
      if (item.countryId) fetchProvinces(item.countryId);
      if (item.provinceId) fetchPlaces(item.provinceId);
    } else {
      setEditing(null);
      setFormData(initialFormState);
    }
    setValidationErrors({});
    setShowModal(true);
  };

  const handleClose = () => {
    setShowModal(false);
    setEditing(null);
  };

  const handleReset = () => {
    setFormData(initialFormState);
    setValidationErrors({});
  };

  const filteredItems = items.filter(item => 
    item.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.lastName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectStyle = { 
    appearance: 'none', 
    backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 16 16\'%3e%3cpath fill=\'none\' stroke=\'%23343a40\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'m2 5 6 6 6-6\'/%3e%3c/svg%3e")', 
    backgroundRepeat: 'no-repeat', 
    backgroundPosition: 'right .75rem center', 
    backgroundSize: '12px 9px',
    fontSize: '0.85rem',
    minHeight: '35px'
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Card className="shadow-sm rounded-3 border-0">
            <Card.Header className="bg-white border-0 py-3 d-flex justify-content-between align-items-center border-bottom">
              <h5 className="mb-0 fw-bold text-dark">Subagent</h5>
              <div className="d-flex gap-2">
                <Button className="btn-indigo d-flex align-items-center gap-2" size="sm" onClick={() => handleOpen()}>
                  Create +
                </Button>
              </div>
            </Card.Header>
            <Card.Body className="p-0">
               <div className="p-3 bg-light border-bottom d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center gap-2">
                  <span className="small text-muted">Display</span>
                  <Form.Select size="sm" style={{ width: '70px' }}>
                    <option>10</option>
                    <option>25</option>
                    <option>50</option>
                  </Form.Select>
                  <span className="small text-muted">records</span>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <span className="small text-muted">Search:</span>
                  <Form.Control 
                    size="sm" 
                    type="text" 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                    style={{ width: '200px' }}
                  />
                </div>
              </div>
              <Table responsive hover className="mb-0 align-middle">
                <thead style={{ backgroundColor: '#2d3e50', color: 'white' }}>
                  <tr>
                    <th className="ps-4 py-2 small">S.N</th>
                    <th className="py-2 small">Company</th>
                    <th className="py-2 small">Name</th>
                    <th className="py-2 small">Contact</th>
                    <th className="text-center py-2 small">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="text-center py-5">
                        <Spinner animation="border" variant="primary" size="sm" />
                      </td>
                    </tr>
                  ) : filteredItems.length > 0 ? (
                    filteredItems.map((item, idx) => (
                      <tr key={item.id} className="small">
                        <td className="ps-4">{idx + 1}</td>
                        <td className="fw-bold text-primary">{item.companyName}</td>
                        <td>{item.firstName} {item.lastName}</td>
                        <td>{item.personalEmail}</td>
                        <td className="text-center">
                          <div className="d-flex justify-content-center gap-2">
                            <FaEdit 
                              className="text-success cursor-pointer" 
                              style={{ cursor: 'pointer' }} 
                              onClick={() => handleOpen(item)} 
                            />
                            <FaTrash 
                              className="text-danger cursor-pointer" 
                              style={{ cursor: 'pointer' }} 
                              onClick={() => handleDelete(item.id)} 
                            />
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-center py-5 text-muted small">No entries found</td>
                    </tr>
                  )}
                </tbody>
              </Table>
              <div className="p-3 bg-light border-top d-flex justify-content-between align-items-center small text-muted">
                <div>Showing 1 to {filteredItems.length} of {items.length} entries</div>
                <div className="d-flex gap-1">
                  <Button variant="outline-secondary" size="sm" disabled>Previous</Button>
                  <Button variant="primary" size="sm">1</Button>
                  <Button variant="outline-secondary" size="sm" disabled>Next</Button>
                </div>
              </div>
            </Card.Body>
          </Card>

          <Modal show={showModal} onHide={handleClose} size="xl" centered backdrop="static">
            <Modal.Body className="p-0">
               <style>{`
                .custom-fieldset {
                  border: 1px solid #ddd;
                  padding: 1.5rem 1rem 1rem 1rem;
                  margin-top: 1rem;
                  position: relative;
                  border-radius: 4px;
                }
                .custom-legend {
                  position: absolute;
                  top: -12px;
                  left: 15px;
                  background: white;
                  padding: 0 10px;
                  font-weight: bold;
                  font-size: 0.85rem;
                  color: #666;
                  border: 1px solid #ddd;
                  border-radius: 4px;
                  width: auto;
                  margin-bottom: 0;
                }
                .form-label-custom {
                  font-size: 0.8rem;
                  font-weight: 600;
                  margin-bottom: 2px;
                }
                .form-control-custom {
                  font-size: 0.85rem;
                  padding: 4px 8px;
                  min-height: 35px;
                }
                .btn-footer {
                  font-size: 0.85rem;
                  font-weight: 600;
                  padding: 6px 20px;
                  border-radius: 4px;
                }
              `}</style>
              
              <div className="p-4 bg-white">
                <Form onSubmit={handleSubmit}>
                  {/* Agent Details Section */}
                  <div className="custom-fieldset">
                    <div className="custom-legend">Agent Details</div>
                    <Row className="g-3">
                      <Col md={4}>
                        <Form.Group>
                          <Form.Label className="form-label-custom"><span className="text-danger">* </span>Company Name</Form.Label>
                          <Form.Control 
                            name="companyName" 
                            value={formData.companyName} 
                            onChange={handleChange} 
                            isInvalid={!!validationErrors.companyName}
                            className="form-control-custom"
                          />
                        </Form.Group>
                      </Col>
                      <Col md={4}>
                        <Form.Group>
                          <Form.Label className="form-label-custom"><span className="text-danger">* </span>Business Type</Form.Label>
                          <Form.Control 
                            name="businessType" 
                            value={formData.businessType} 
                            onChange={handleChange} 
                            isInvalid={!!validationErrors.businessType}
                            className="form-control-custom"
                          />
                        </Form.Group>
                      </Col>
                      <Col md={4}>
                        <Form.Group>
                          <Form.Label className="form-label-custom"><span className="text-danger">* </span>Company Type</Form.Label>
                          <Form.Select 
                            name="agentCategoryId" 
                            value={formData.agentCategoryId} 
                            onChange={handleChange} 
                            isInvalid={!!validationErrors.agentCategoryId}
                            style={selectStyle}
                          >
                            <option value="">SELECT</option>
                            {categories.map(c => <option key={c.agentCategoryId} value={c.agentCategoryId}>{c.name}</option>)}
                          </Form.Select>
                        </Form.Group>
                      </Col>
                      <Col md={4}>
                        <Form.Group>
                          <Form.Label className="form-label-custom"><span className="text-danger">* </span>Company Code</Form.Label>
                          <Form.Control 
                            name="companyCode" 
                            value={formData.companyCode} 
                            onChange={handleChange} 
                            className="form-control-custom"
                          />
                        </Form.Group>
                      </Col>
                      <Col md={4}>
                        <Form.Group>
                          <Form.Label className="form-label-custom"><span className="text-danger">* </span>Authorized person - First Name</Form.Label>
                          <Form.Control 
                            name="firstName" 
                            value={formData.firstName} 
                            onChange={handleChange} 
                            isInvalid={!!validationErrors.firstName}
                            className="form-control-custom"
                          />
                        </Form.Group>
                      </Col>
                      <Col md={4}>
                        <Form.Group>
                          <Form.Label className="form-label-custom"><span className="text-danger">* </span>Authorized person - Last Name</Form.Label>
                          <Form.Control 
                            name="lastName" 
                            value={formData.lastName} 
                            onChange={handleChange} 
                            isInvalid={!!validationErrors.lastName}
                            className="form-control-custom"
                          />
                        </Form.Group>
                      </Col>
                    </Row>
                  </div>

                  <Row className="mt-2 g-3">
                    {/* Contact Details Section */}
                    <Col md={9}>
                      <div className="custom-fieldset h-100">
                        <div className="custom-legend">Contact Details</div>
                        <Row className="g-3">
                          <Col md={4}>
                            <Form.Group>
                              <Form.Label className="form-label-custom"><span className="text-danger">* </span>Agent Email</Form.Label>
                              <Form.Control 
                                name="personalEmail" 
                                type="email"
                                value={formData.personalEmail} 
                                onChange={handleChange} 
                                isInvalid={!!validationErrors.personalEmail}
                                className="form-control-custom"
                              />
                            </Form.Group>
                          </Col>
                          <Col md={4}>
                            <Form.Group>
                              <Form.Label className="form-label-custom">Zip Code</Form.Label>
                              <Form.Control 
                                name="zipCode" 
                                value={formData.zipCode} 
                                onChange={handleChange} 
                                className="form-control-custom"
                              />
                            </Form.Group>
                          </Col>
                          <Col md={4}>
                            <Form.Group>
                              <Form.Label className="form-label-custom"><span className="text-danger">* </span>Mobile Number</Form.Label>
                              <Form.Control 
                                name="mobileNumber" 
                                value={formData.mobileNumber} 
                                onChange={handleChange} 
                                isInvalid={!!validationErrors.mobileNumber}
                                className="form-control-custom"
                              />
                            </Form.Group>
                          </Col>
                          <Col md={4}>
                            <Form.Group>
                              <Form.Label className="form-label-custom">Contact Person</Form.Label>
                              <Form.Control 
                                name="contactPerson" 
                                value={formData.contactPerson} 
                                onChange={handleChange} 
                                className="form-control-custom"
                              />
                            </Form.Group>
                          </Col>
                          <Col md={4}>
                            <Form.Group>
                              <Form.Label className="form-label-custom">Fax Number</Form.Label>
                              <Form.Control 
                                name="faxNumber" 
                                value={formData.faxNumber} 
                                onChange={handleChange} 
                                className="form-control-custom"
                              />
                            </Form.Group>
                          </Col>
                          <Col md={4}>
                            <Form.Group>
                              <Form.Label className="form-label-custom">Telephone Number</Form.Label>
                              <Form.Control 
                                name="telephoneNumber" 
                                value={formData.telephoneNumber} 
                                onChange={handleChange} 
                                className="form-control-custom"
                              />
                            </Form.Group>
                          </Col>
                          <Col md={4}>
                             <SearchableSelect
                              label="Country"
                              name="countryId"
                              value={formData.countryId}
                              options={countries}
                              placeholder="SELECT"
                              onSearch={handleCountrySearch}
                              onChange={handleChange}
                              isLoading={isDataLoading.countries}
                              error={validationErrors.countryId}
                              required
                            />
                          </Col>
                          <Col md={4}>
                             <Form.Group className="mb-3">
                              <Form.Label className="form-label-custom"><span className="text-danger">* </span>Province</Form.Label>
                              <Form.Select 
                                name="provinceId" 
                                value={formData.provinceId} 
                                onChange={handleChange} 
                                isInvalid={!!validationErrors.provinceId}
                                disabled={!formData.countryId}
                                style={selectStyle}
                              >
                                <option value="">SELECT</option>
                                {provinces.map(p => <option key={p.id} value={p.id}>{p.stateName}</option>)}
                              </Form.Select>
                            </Form.Group>
                          </Col>
                          <Col md={4}>
                             <Form.Group className="mb-3">
                              <Form.Label className="form-label-custom"><span className="text-danger">* </span>City</Form.Label>
                              <Form.Select 
                                name="placeId" 
                                value={formData.placeId} 
                                onChange={handleChange} 
                                isInvalid={!!validationErrors.placeId}
                                disabled={!formData.provinceId}
                                style={selectStyle}
                              >
                                <option value="">SELECT</option>
                                {places.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                              </Form.Select>
                            </Form.Group>
                          </Col>
                          <Col md={12}>
                            <Form.Group>
                              <Form.Label className="form-label-custom"><span className="text-danger">* </span>Address</Form.Label>
                              <Form.Control 
                                as="textarea" 
                                rows={3} 
                                name="address" 
                                value={formData.address} 
                                onChange={handleChange} 
                                isInvalid={!!validationErrors.address}
                                className="form-control-custom"
                              />
                            </Form.Group>
                          </Col>
                        </Row>
                      </div>
                    </Col>

                    {/* Settings Section */}
                    <Col md={3}>
                      <div className="custom-fieldset h-100">
                        <div className="custom-legend">Settings</div>
                        <Form.Group className="mb-3">
                          <Form.Label className="form-label-custom"><span className="text-danger">* </span>Markup Type</Form.Label>
                          <div className="input-group input-group-sm">
                            <Form.Control 
                              name="markup" 
                              value={formData.markup} 
                              onChange={handleChange} 
                              isInvalid={!!validationErrors.markup}
                              className="form-control-custom"
                            />
                            <span className="input-group-text bg-light">%</span>
                          </div>
                        </Form.Group>
                        <Form.Group className="mb-3">
                          <Form.Label className="form-label-custom"><span className="text-danger">* </span>Status</Form.Label>
                          <Form.Select 
                            name="status" 
                            value={formData.status} 
                            onChange={handleChange}
                            style={selectStyle}
                          >
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                          </Form.Select>
                        </Form.Group>
                      </div>
                    </Col>
                  </Row>

                  <div className="mt-4 p-3 border-top d-flex justify-content-between align-items-center">
                    <Button variant="danger" className="btn-footer d-flex align-items-center gap-2" onClick={handleClose}>
                      <FaTimes /> Cancel
                    </Button>
                    <div className="d-flex gap-2">
                      <Button variant="success" className="btn-footer d-flex align-items-center gap-2" type="submit" disabled={isLoading}>
                        <FaCheck /> {editing ? "Update" : "Create"}
                      </Button>
                      <Button variant="primary" className="btn-footer d-flex align-items-center gap-2" style={{ backgroundColor: '#4b57cc' }} onClick={handleReset}>
                        <FaUndo /> Reset
                      </Button>
                    </div>
                  </div>
                </Form>
              </div>
            </Modal.Body>
          </Modal>
        </main>
      </div>
    </div>
  );
}
