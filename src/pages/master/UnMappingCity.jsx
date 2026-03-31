import React, { useState, useEffect } from "react";
import {
  Card,
  Form,
  Button,
  Table,
  Badge,
  Spinner,
  Row,
  Col,
  Modal,
} from "react-bootstrap";
import toast from "react-hot-toast";
import axiosInstance from "../../components/AxiosInstance";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import AsyncSelect from "react-select/async";
import { FaUnlink, FaSearch, FaExclamationTriangle } from "react-icons/fa";
import "../../styles/CityMapping.css";

const UnMappingCity = () => {
  const [loading, setLoading] = useState(false);
  const [mappings, setMappings] = useState([]);
  const [platforms] = useState([
    "Iwtx",
    "Darina",
    "Jumeirah",
    "X3",
    "Ratehawk",
    "Atharva",
  ]);

  const [filters, setFilters] = useState({
    apiProvider: "",
    countryId: "",
    cityId: "",
    search: "",
  });

  const [selectedCountryOption, setSelectedCountryOption] = useState(null);
  const [selectedCityOption, setSelectedCityOption] = useState(null);

  // Modal State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [itemToUnmap, setItemToUnmap] = useState(null);
  const [isUnmapping, setIsUnmapping] = useState(false);

  // Load countries for filter
  const loadCountries = async (inputValue) => {
    try {
      const response = await axiosInstance.get("/api/country", {
        params: { search: inputValue },
      });
      return response.data.map((c) => ({ value: c.id, label: c.name }));
    } catch (error) {
      console.error("Error loading countries:", error);
      return [];
    }
  };

  // Load cities for filter
  const loadCities = async (inputValue) => {
    if (!filters.countryId) return [];
    try {
      const response = await axiosInstance.get(
        `/api/province/getByCountryId/${filters.countryId}`,
        { params: { search: inputValue } },
      );
      return response.data.map((c) => ({
        value: c.id,
        label: `${c.stateName}, ${c.country}`,
      }));
    } catch (error) {
      console.error("Error loading cities:", error);
      return [];
    }
  };

  const handleCountrySelect = (option) => {
    setSelectedCountryOption(option);
    setFilters((prev) => ({
      ...prev,
      countryId: option ? option.value : "",
      cityId: "",
    }));
    setSelectedCityOption(null);
  };

  const handleCitySelect = (option) => {
    setSelectedCityOption(option);
    setFilters((prev) => ({
      ...prev,
      cityId: option ? option.value : "",
    }));
  };

  const handlePlatformChange = (e) => {
    setFilters((prev) => ({
      ...prev,
      apiProvider: e.target.value,
    }));
  };

  const fetchMappings = async () => {
    if (!filters.apiProvider) {
      toast.error("Please select a Platform");
      return;
    }

    setLoading(true);
    try {
      const response = await axiosInstance.get("/api/cityMapping", {
        params: {
          apiProvider: filters.apiProvider,
          search: filters.search || "",
          page: 0,
          limit: 100,
        },
      });
      setMappings(response.data || []);
      if (response.data?.length === 0) {
        toast.info("No mapped cities found for the selected filters");
      }
    } catch (error) {
      console.error("Error fetching mappings:", error);
      toast.error("Failed to fetch mappings");
    } finally {
      setLoading(false);
    }
  };

  const initiateUnmap = (item) => {
    setItemToUnmap(item);
    setShowConfirmModal(true);
  };

  const handleUnmap = async () => {
    if (!itemToUnmap) return;

    setIsUnmapping(true);
    try {
      const { id, countryId, apiProvider } = itemToUnmap;
      // Endpoint: api/cityMapping/unmap?id=?&countryId=?&apiProvider=?
      await axiosInstance.post(`/api/cityMapping/unmap`, null, {
        params: {
          id,
          countryId,
          apiProvider,
        },
      });

      toast.success("City unmapped successfully ✅");
      // Optimistic UI update
      setMappings((prev) => prev.filter((m) => m.id !== id));
      setShowConfirmModal(false);
      setItemToUnmap(null);
    } catch (error) {
      console.error("Unmapping error:", error);
      toast.error("Failed to unmap city ❌");
    } finally {
      setIsUnmapping(false);
    }
  };

  const selectStyles = {
    control: (base) => ({
      ...base,
      minHeight: "38px",
      border: "1px solid #dee2e6",
      borderRadius: "6px",
      fontSize: "0.875rem",
      "&:hover": {
        borderColor: "#86b7fe",
      },
    }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <div className="mb-4">
            <h3 className="fw-bold text-dark mb-1">City Unmapping</h3>
            <p className="text-muted">View and remove mapped cities from external API platforms.</p>
          </div>

          {/* Filters Card */}
          <Card className="border-0 shadow-sm mb-4 rounded-4">
            <Card.Body className="p-4">
              <Row className="g-3 align-items-end">
                <Col md={3}>
                  <Form.Group>
                    <Form.Label className="fw-semibold small text-uppercase text-muted">Platform</Form.Label>
                    <Form.Select
                      value={filters.apiProvider}
                      onChange={handlePlatformChange}
                      className="form-control-lg fs-6"
                    >
                      <option value="">Select Platform</option>
                      {platforms.map((p, idx) => (
                        <option key={idx} value={p}>{p}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>

                <Col md={3}>
                  <Form.Group>
                    <Form.Label className="fw-semibold small text-uppercase text-muted">Country</Form.Label>
                    <AsyncSelect
                      cacheOptions
                      defaultOptions
                      placeholder="Search country..."
                      value={selectedCountryOption}
                      loadOptions={loadCountries}
                      onChange={handleCountrySelect}
                      styles={selectStyles}
                      menuPortalTarget={document.body}
                    />
                  </Form.Group>
                </Col>

                <Col md={3}>
                  <Form.Group>
                    <Form.Label className="fw-semibold small text-uppercase text-muted">City</Form.Label>
                    <AsyncSelect
                      cacheOptions
                      defaultOptions
                      placeholder="Search city..."
                      value={selectedCityOption}
                      loadOptions={loadCities}
                      onChange={handleCitySelect}
                      isDisabled={!filters.countryId}
                      styles={selectStyles}
                      menuPortalTarget={document.body}
                    />
                  </Form.Group>
                </Col>

                <Col md={3}>
                  <Button 
                    variant="primary" 
                    className="w-100 btn-lg fs-6 fw-bold d-flex align-items-center justify-content-center"
                    onClick={fetchMappings}
                    style={{ height: "38px" }}
                    disabled={loading}
                  >
                    {loading ? <Spinner size="sm" className="me-2" /> : <FaSearch className="me-2" />}
                    Search
                  </Button>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {/* Table Card */}
          <Card className="border-0 shadow-sm rounded-4 overflow-hidden">
            <Card.Body className="p-0">
              <div className="p-3 bg-white border-bottom d-flex justify-content-between align-items-center">
                <h5 className="mb-0 fw-bold">Mapped Data Overview</h5>
              </div>
              <Table hover responsive className="mb-0 custom-table bg-white">
                <thead className="bg-light text-muted small text-uppercase">
                  <tr>
                    <th className="px-4 py-3 border-0">API Provider</th>
                    <th className="py-3 border-0">Country</th>
                    <th className="py-3 border-0">City</th>
                    <th className="py-3 border-0">Mapped Code</th>
                    <th className="py-3 border-0">Status</th>
                    <th className="py-3 border-0 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="6" className="text-center py-5">
                        <Spinner animation="border" variant="primary" size="sm" className="me-2" />
                        <span className="text-muted">Loading mappings...</span>
                      </td>
                    </tr>
                  ) : mappings.length > 0 ? (
                    mappings.map((item, idx) => (
                      <tr key={idx} className="align-middle border-bottom">
                        <td className="px-4 py-3 fw-medium text-dark">{item.apiProvider}</td>
                        <td className="py-3">{item.countryName || item.masterCountryName || "N/A"}</td>
                        <td className="py-3">{item.cityName || item.masterCityName || "N/A"}</td>
                        <td className="py-3">
                          <code className="bg-light text-primary px-2 py-1 rounded small">
                            {item.apiCityId || item.mappedCode || "N/A"}
                          </code>
                        </td>
                        <td className="py-3">
                          <Badge bg="success-subtle" className="text-success border border-success-subtle px-3 py-2 rounded-pill fw-medium">
                            Active
                          </Badge>
                        </td>
                        <td className="py-3 text-center">
                          <Button
                            variant="outline-danger"
                            size="sm"
                            className="rounded-pill px-3 d-inline-flex align-items-center"
                            onClick={() => initiateUnmap(item)}
                          >
                            <FaUnlink className="me-2" />
                            Un Map
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="text-center py-5 text-muted">
                        No mapped data found. Please select a platform and search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </Card.Body>
          </Card>

          {/* Confirmation Modal */}
          <Modal show={showConfirmModal} onHide={() => !isUnmapping && setShowConfirmModal(false)} centered border="0">
            <Modal.Header closeButton style={{ borderBottom: "none" }}>
              <Modal.Title className="d-flex align-items-center text-danger h5">
                <FaExclamationTriangle className="me-2" />
                Confirm Unmapping
              </Modal.Title>
            </Modal.Header>
            <Modal.Body className="py-4">
              <p className="text-secondary mb-4">Are you sure you want to unmap this city? This action cannot be undone.</p>
              
              <div className="p-3 bg-light rounded-3">
                <div className="d-flex justify-content-between mb-2">
                  <span className="text-muted small">Provider:</span>
                  <span className="fw-bold">{itemToUnmap?.apiProvider}</span>
                </div>
                <div className="d-flex justify-content-between">
                  <span className="text-muted small">City:</span>
                  <span className="fw-bold">{itemToUnmap?.cityName || itemToUnmap?.masterCityName}</span>
                </div>
              </div>
            </Modal.Body>
            <Modal.Footer style={{ borderTop: "none" }}>
              <Button variant="light" onClick={() => setShowConfirmModal(false)} disabled={isUnmapping} className="px-4">
                Cancel
              </Button>
              <Button variant="danger" onClick={handleUnmap} disabled={isUnmapping} className="px-4">
                {isUnmapping ? <Spinner size="sm" className="me-2" /> : null}
                Un Map
              </Button>
            </Modal.Footer>
          </Modal>

        </main>
      </div>
    </div>
  );
};

export default UnMappingCity;
