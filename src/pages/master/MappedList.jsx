import React, { useState } from "react";
import {
  Card,
  Form,
  Button,
  Table,
  Badge,
  Spinner,
  Row,
  Col,
  Pagination,
} from "react-bootstrap";
import toast from "react-hot-toast";
import AsyncSelect from "react-select/async";
import Select from "react-select";
import axiosInstance from "../../components/AxiosInstance";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import BackButton from "../../components/BackButton";
import "../../styles/CityMapping.css";

const PLATFORMS = [
  "Iwtx",
  "Darina",
  "Jumeirah",
  "X3",
  "Ratehawk",
  "Atharva",
  "Grn",
];

const PLATFORM_OPTIONS = PLATFORMS.map((p) => ({ value: p, label: p }));

const PAGE_SIZE = 10;

const asyncSelectStyles = {
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  control: (base) => ({
    ...base,
    minHeight: "36px",
    border: "1px solid #dee2e6",
    borderRadius: "6px",
    fontSize: "0.875rem",
    "&:hover": { borderColor: "#86b7fe" },
  }),
  menu: (base) => ({
    ...base,
    zIndex: 99999,
    position: "absolute",
    marginTop: "2px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
    border: "1px solid #dee2e6",
    borderRadius: "6px",
  }),
};

const MappedList = () => {
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);
  const [selectedPlatform, setSelectedPlatform] = useState("");

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [resultPlatform, setResultPlatform] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Load In-house countries
  const loadCountries = async (inputValue) => {
    try {
      const response = await axiosInstance.get("/api/country", {
        params: { search: inputValue },
      });
      return (response.data || []).map((c) => ({
        value: c.id,
        label: c.name,
      }));
    } catch (error) {
      console.error("Error loading countries:", error);
      return [];
    }
  };

  // Load In-house cities for the selected country
  const loadCities = async (inputValue) => {
    if (!selectedCountry?.value) return [];
    try {
      const response = await axiosInstance.get(
        `/api/province/getByCountryId/${selectedCountry.value}`,
        { params: { search: inputValue } },
      );
      return (response.data || []).map((c) => ({
        value: c.id,
        label: c.stateName,
      }));
    } catch (error) {
      console.error("Error loading cities:", error);
      return [];
    }
  };

  const handleCountrySelect = (option) => {
    setSelectedCountry(option);
    setSelectedCity(null);
  };

  const handleSearch = async () => {
    if (!selectedCountry?.value) {
      toast.error("Please select an In-house Country");
      return;
    }
    if (!selectedPlatform) {
      toast.error("Please select a Platform");
      return;
    }

    setLoading(true);
    setRows([]);
    setCurrentPage(1);

    try {
      // 1) All cities under the selected country
      const cityResp = await axiosInstance.get(
        `/api/province/getByCountryId/${selectedCountry.value}`,
      );
      let cities = cityResp.data || [];

      // Optional narrowing by selected city
      if (selectedCity?.value) {
        cities = cities.filter((c) => c.id === selectedCity.value);
      }

      // 2) All city mappings for this country + platform
      const mappingResp = await axiosInstance.get("/api/cityMapping", {
        params: {
          apiProvider: selectedPlatform.toLowerCase(),
          countryId: selectedCountry.value,
          page: 0,
          limit: 1000,
        },
      });
      const mappings = mappingResp.data || [];
      const mappedCityIds = new Set(
        mappings
          .filter((m) => m.masterCityId != null)
          .map((m) => Number(m.masterCityId)),
      );

      const composed = cities.map((c) => ({
        id: c.id,
        cityName: c.stateName,
        mapped: mappedCityIds.has(Number(c.id)),
      }));

      setRows(composed);
      setResultPlatform(selectedPlatform);

      if (composed.length === 0) {
        toast("No cities found for the selected country", { icon: "ℹ️" });
      }
    } catch (error) {
      console.error("Failed to load mapped list:", error);
      toast.error("Failed to load mapped list");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedCountry(null);
    setSelectedCity(null);
    setSelectedPlatform("");
    setRows([]);
    setResultPlatform("");
    setCurrentPage(1);
  };

  // Client-side pagination
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageRows = rows.slice(pageStart, pageStart + PAGE_SIZE);

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <span className="d-flex align-items-center gap-2 mb-3">
            <BackButton fallback="/adminDashboard" />
            <h3 className="mb-0">Mapped List</h3>
          </span>
          <p className="text-muted">
            View which In-house cities are mapped to an integrated API
            platform.
          </p>

          {/* Filters */}
          <Card className="mb-4 shadow-sm">
            <Card.Body>
              <Row className="mb-3">
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>
                      In-house Country <span className="text-danger">*</span>
                    </Form.Label>
                    <AsyncSelect
                      cacheOptions
                      defaultOptions
                      placeholder="Search country..."
                      value={selectedCountry}
                      loadOptions={loadCountries}
                      onChange={handleCountrySelect}
                      menuPortalTarget={document.body}
                      styles={asyncSelectStyles}
                    />
                  </Form.Group>
                </Col>

                <Col md={4}>
                  <Form.Group>
                    <Form.Label>In-house City</Form.Label>
                    <AsyncSelect
                      key={`city-${selectedCountry?.value || "none"}`}
                      cacheOptions
                      defaultOptions
                      isClearable
                      placeholder="Search & select city..."
                      value={selectedCity}
                      loadOptions={loadCities}
                      onChange={(opt) => setSelectedCity(opt)}
                      isDisabled={!selectedCountry?.value}
                      menuPortalTarget={document.body}
                      styles={asyncSelectStyles}
                    />
                  </Form.Group>
                </Col>

                <Col md={4}>
                  <Form.Group>
                    <Form.Label>
                      Platform <span className="text-danger">*</span>
                    </Form.Label>
                    <Select
                      isClearable
                      placeholder="Select Platform"
                      options={PLATFORM_OPTIONS}
                      value={
                        selectedPlatform
                          ? { value: selectedPlatform, label: selectedPlatform }
                          : null
                      }
                      onChange={(opt) =>
                        setSelectedPlatform(opt ? opt.value : "")
                      }
                      menuPortalTarget={document.body}
                      styles={asyncSelectStyles}
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col className="d-flex gap-2">
                  <Button
                    variant="primary"
                    onClick={handleSearch}
                    disabled={loading}
                  >
                    {loading ? "Searching..." : "Search"}
                  </Button>
                  <Button
                    variant="outline-secondary"
                    onClick={handleReset}
                    disabled={loading}
                  >
                    Reset
                  </Button>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {/* Results */}
          <Card className="shadow-sm">
            <Card.Body>
              <h5 className="mb-3">Mappings Overview</h5>

              {loading ? (
                <div className="d-flex justify-content-center my-5">
                  <Spinner animation="border" variant="primary" />
                </div>
              ) : (
                <>
                  <Table
                    striped
                    bordered
                    hover
                    responsive
                    className="mapping-table"
                  >
                    <thead>
                      <tr>
                        <th style={{ width: 90 }}>SL.No</th>
                        <th>City Name</th>
                        <th style={{ width: 220 }}>
                          {resultPlatform
                            ? `${resultPlatform} Mapping`
                            : "Mapping"}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="text-center text-muted">
                            No data. Select filters and click Search.
                          </td>
                        </tr>
                      ) : (
                        pageRows.map((r, idx) => (
                          <tr key={r.id}>
                            <td>{pageStart + idx + 1}</td>
                            <td>{r.cityName}</td>
                            <td>
                              {r.mapped ? (
                                <Badge bg="success">✔</Badge>
                              ) : (
                                <Badge bg="danger">✖</Badge>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </Table>

                  {rows.length > 0 && (
                    <div className="d-flex justify-content-between align-items-center">
                      <small className="text-muted">
                        Showing {pageStart + 1} to{" "}
                        {Math.min(pageStart + PAGE_SIZE, rows.length)} of{" "}
                        {rows.length} entries
                      </small>
                      <Pagination className="mb-0">
                        <Pagination.Prev
                          disabled={currentPage === 1}
                          onClick={() =>
                            setCurrentPage((p) => Math.max(1, p - 1))
                          }
                        />
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                          (n) => (
                            <Pagination.Item
                              key={n}
                              active={n === currentPage}
                              onClick={() => setCurrentPage(n)}
                            >
                              {n}
                            </Pagination.Item>
                          ),
                        )}
                        <Pagination.Next
                          disabled={currentPage === totalPages}
                          onClick={() =>
                            setCurrentPage((p) => Math.min(totalPages, p + 1))
                          }
                        />
                      </Pagination>
                    </div>
                  )}
                </>
              )}
            </Card.Body>
          </Card>
        </main>
      </div>
    </div>
  );
};

export default MappedList;
