import React, { useState } from "react";
import { Card, Form, Button, Table, Spinner, Row, Col } from "react-bootstrap";
import toast from "react-hot-toast";
import axiosInstance from "../../components/AxiosInstance";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import AsyncSelect from "react-select/async";
import BackButton from "../../components/BackButton";

const FetchNewHotels = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hotelList, setHotelList] = useState([]);
  const [isFetchedFromApi, setIsFetchedFromApi] = useState(false);
  const [apiMeta, setApiMeta] = useState({ pageNumber: 1, pageSize: 500 });
  const [selectedCountryOption, setSelectedCountryOption] = useState(null);
  const [selectedCityOption, setSelectedCityOption] = useState(null);
  const [errors, setErrors] = useState({});

  const [platforms] = useState([
    "Iwtx",
    "Darina",
    "Jumeirah",
    "X3",
    "Ratehawk",
    "Atharva",
  ]);

  const [formData, setFormData] = useState({
    apiProvider: "",
    apiCountryId: "",
    apiCityId: "",
  });

  const platformCountryApis = {
    Iwtx: { countries: "api/iwtx/countrylist" },
    Darina: { countries: "/api/darina/countrylist" },
    Jumeirah: { countries: "/api/jumeirah/countrylist" },
    X3: { countries: "api/iwtx/countrylist" },
    Ratehawk: { countries: "/api/ratehawk/countrylist" },
    Atharva: { countries: "/api/atharva/countrylist" },
  };

  const platformCityApis = {
    Iwtx: { cities: "api/iwtx/citylist" },
    Darina: { cities: "/api/darina/citylist" },
    Jumeirah: { cities: "/api/jumeirah/citylist" },
    X3: { cities: "api/iwtx/citylist" },
    Ratehawk: { cities: "/api/ratehawk/citylist" },
    Atharva: { cities: "/api/atharva/citylist" },
  };

  const handlePlatformChange = (e) => {
    const value = e.target.value;
    setFormData({
      apiProvider: value,
      apiCountryId: "",
      apiCityId: "",
    });
    setErrors({});                  // ✅ clear all errors
    setSelectedCountryOption(null);
    setSelectedCityOption(null);
    setHotelList([]);
    setIsFetchedFromApi(false);
  };

  const validateForm = () => {
    let newErrors = {};

    if (!formData.apiProvider) {
      newErrors.apiProvider = "Platform is required";
    }

    if (!formData.apiCountryId) {
      newErrors.apiCountryId = "Country is required";
    }

    // Optional: if city is required, uncomment
    // if (!formData.apiCityName) {
    //   newErrors.apiCityName = "City is required";
    // }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const loadPlatformCountry = async (inputValue) => {
    if (!formData.apiProvider) return [];
    try {
      const apiUrl = platformCountryApis[formData.apiProvider]?.countries;
      if (!apiUrl) return [];

      const response = await axiosInstance.get(apiUrl, {
        params: { search: inputValue },
      });

      return response.data.map((c) => ({
        value: c.id || c.countryId,
        label: c.name || c.countryName,
      }));
    } catch (error) {
      console.error("Error loading platform countries:", error);
      return [];
    }
  };

  const loadPlatformCity = async (inputValue) => {
    if (!formData.apiProvider || !formData.apiCountryId) return [];
    try {
      const apiUrl = platformCityApis[formData.apiProvider]?.cities;
      if (!apiUrl) return [];

      const response = await axiosInstance.get(apiUrl, {
        params: {
          search: inputValue,
          countryId: formData.apiCountryId,
        },
      });

      return response.data.map((c) => ({
        value: c.id || c.cityId, // We use cityID  as value
        label: c.cityName || c.name,
      }));
    } catch (error) {
      console.error("Error loading platform cities:", error);
      return [];
    }
  };

  const handleCountrySelect = (option) => {
    setSelectedCountryOption(option);
    setFormData((prev) => ({
      ...prev,
      apiCountryId: option ? option.value : "",
      apiCityName: "",
    }));
    setErrors((prev) => ({ ...prev, apiCountryId: "" })); // ✅ clear country error
    setSelectedCityOption(null);
  };

  const handleCitySelect = (option) => {
    setSelectedCityOption(option);
    setFormData((prev) => ({
      ...prev,
      apiCityName: option ? option.value : "",
    }));
  };

  const handleFetchFromDB = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const response = await axiosInstance.get(
        "/api/hotelMapping/getHotelMappingList",
        {
          params: {
            countryId: formData.apiCountryId,
            city: formData.apiCityName,
            platform: formData.apiProvider.toLowerCase(),
          },
        },
      );

      setHotelList(Array.isArray(response.data) ? response.data : []);
      setIsFetchedFromApi(false);
      toast.success("Hotels fetched from DB successfully");
    } catch (error) {
      console.error("Error fetching hotels from DB:", error);
      toast.error("Failed to fetch hotels from DB");
      setHotelList([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFetchFromApis = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const response = await axiosInstance.get(
        "api/hotelMapping/fetchFromApi",
        {
          params: {
            countryId: formData.apiCountryId,
            cityId: formData.apiCityName,
            platform: formData.apiProvider.toLowerCase(),
          },
        },
      );

      const hotels = response.data?.hotels;
      setHotelList(Array.isArray(hotels) ? hotels : []);
      setIsFetchedFromApi(true);

      setApiMeta({
        pageNumber: response.data?.pageNumber ?? 1,
        pageSize: response.data?.pageSize ?? 500,
      });

      toast.success(
        `Hotels fetched from API successfully (${response.data?.count ?? 0} results)`,
      );
    } catch (error) {
      console.error("Error fetching hotels from API:", error);
      toast.error("Failed to fetch hotels from API");
      setHotelList([]);
      setIsFetchedFromApi(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveToDB = async () => {
    setIsSaving(true);
    try {
      await axiosInstance.post("/api/hotelMapping/saveFromApi", null, {
        params: {
          platform: formData.apiProvider.toLowerCase(),
          countryId: formData.apiCountryId,
          pageNumber: apiMeta.pageNumber,
          pageSize: apiMeta.pageSize,
        },
      });
      toast.success(`${hotelList.length} hotels saved to DB successfully!`);
      setIsFetchedFromApi(false);
    } catch (error) {
      console.error("Error saving hotels to DB:", error);
      toast.error("Failed to save hotels to DB");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Card className="shadow-sm mb-4">
            <Card.Header className="bg-white py-3 d-flex align-items-center gap-2">
              <BackButton fallback="/adminDashboard" />
              <h5 className="mb-0 fw-bold">Fetch New Hotels</h5>
            </Card.Header>
            <Card.Body>
              <Row className="g-3 align-items-end">
                <Col md={3}>
                  <Form.Group>
                    <Form.Label className="small fw-bold">
                      API (Platform)
                    </Form.Label>
                    <Form.Select
                      value={formData.apiProvider}
                      onChange={handlePlatformChange}
                      isInvalid={!!errors.apiProvider}
                    >
                      <option value="">Select Platform</option>
                      {platforms.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </Form.Select>
                    <Form.Control.Feedback type="invalid">
                      {errors.apiProvider}
                    </Form.Control.Feedback>
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group>
                    <Form.Label className="small fw-bold">Country</Form.Label>
                    <AsyncSelect
                      cacheOptions
                      defaultOptions
                      key={`country-${formData.apiProvider}`}
                      placeholder="Search country..."
                      value={selectedCountryOption}
                      loadOptions={loadPlatformCountry}
                      onChange={handleCountrySelect}
                      isDisabled={!formData.apiProvider}
                      menuPortalTarget={document.body}
                      menuPosition="fixed"
                      styles={{
                        menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                        menu: (base) => ({ ...base, zIndex: 9999 }),
                        control: (base) => ({
                          ...base,
                          borderColor: errors.apiCountryId ? "#dc3545" : base.borderColor,
                          "&:hover": {
                            borderColor: errors.apiCountryId ? "#dc3545" : base["&:hover"]?.borderColor,
                          },
                        }),
                      }}
                    />
                    {errors.apiCountryId && (
                      <div className="text-danger small mt-1">
                        {errors.apiCountryId}
                      </div>
                    )}
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group>
                    <Form.Label className="small fw-bold">City</Form.Label>
                    <AsyncSelect
                      cacheOptions
                      defaultOptions
                      key={`city-${formData.apiProvider}-${formData.apiCountryId}`}
                      placeholder="Search city..."
                      value={selectedCityOption}
                      loadOptions={loadPlatformCity}
                      onChange={handleCitySelect}
                      isDisabled={!formData.apiCountryId}
                      menuPortalTarget={document.body}
                      menuPosition="fixed"
                      styles={{
                        menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                        menu: (base) => ({ ...base, zIndex: 9999 }),
                        control: (base) => ({
                          ...base,
                          borderColor: errors.apiCityName ? "#dc3545" : base.borderColor,
                          "&:hover": {
                            borderColor: errors.apiCityName ? "#dc3545" : base["&:hover"]?.borderColor,
                          },
                        }),
                      }}
                    />
                    {errors.apiCityName && (
                      <div className="text-danger small mt-1">
                        {errors.apiCityName}
                      </div>
                    )}
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <div className="d-flex gap-2">
                    <Button
                      variant="primary"
                      onClick={handleFetchFromDB}
                      disabled={isLoading}
                      className="w-100"
                    >
                      {isLoading ? "Fetching..." : "Fetch from DB"}
                    </Button>
                    <Button
                      variant="success"
                      onClick={handleFetchFromApis}
                      disabled={isLoading}
                      className="w-100"
                    >
                      Fetch from API
                    </Button>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          <Card className="shadow-sm">
            {isFetchedFromApi && hotelList.length > 0 && (
              <Card.Header className="bg-white py-3 d-flex justify-content-between align-items-center">
                <span className="fw-semibold text-muted">
                  {hotelList.length} hotels fetched from API
                </span>
                <Button
                  variant="warning"
                  onClick={handleSaveToDB}
                  disabled={isSaving}
                  className="fw-bold px-4"
                >
                  {isSaving ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Saving...
                    </>
                  ) : (
                    "💾 Save to DB"
                  )}
                </Button>
              </Card.Header>
            )}
            <Card.Body className="p-0">
              <Table responsive hover striped className="mb-0 align-middle">
                <thead className="bg-light">
                  <tr>
                    <th style={{ width: "100px" }} className="ps-4">
                      S/N
                    </th>
                    <th>Hotel Name</th>
                  </tr>
                </thead>
                <tbody>
                  {hotelList.length > 0 ? (
                    hotelList.map((hotel, index) => (
                      <tr key={index}>
                        <td className="ps-4">{index + 1}</td>
                        <td className="fw-medium">
                          {hotel.hotelName || hotel.name || "N/A"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2} className="text-center py-5 text-muted">
                        {isLoading ? (
                          <div className="d-flex flex-column align-items-center">
                            <Spinner
                              animation="border"
                              variant="primary"
                              className="mb-2"
                            />
                            <span>Loading hotels...</span>
                          </div>
                        ) : (
                          "No hotels found. Please search using the filters above."
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </main>
      </div>
    </div>
  );
};

export default FetchNewHotels;
