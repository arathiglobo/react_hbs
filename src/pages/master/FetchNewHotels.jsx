import React, { useState } from "react";
import { Card, Form, Button, Table, Spinner, Row, Col } from "react-bootstrap";
import toast from "react-hot-toast";
import axiosInstance from "../../components/AxiosInstance";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import AsyncSelect from "react-select/async";

const FetchNewHotels = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [hotelList, setHotelList] = useState([]);
  const [selectedCountryOption, setSelectedCountryOption] = useState(null);
  const [selectedCityOption, setSelectedCityOption] = useState(null);

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
    apiCityName: "",
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
      apiCityName: "",
    });
    setSelectedCountryOption(null);
    setSelectedCityOption(null);
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
        value: c.cityName || c.name, // We use cityName as value since DB fetch needs city name
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
    if (
      !formData.apiProvider ||
      !formData.apiCountryId ||
      !formData.apiCityName
    ) {
      toast.error("Please fill all fields before fetching");
      return;
    }

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
      toast.success("Hotels fetched from DB successfully");
    } catch (error) {
      console.error("Error fetching hotels from DB:", error);
      toast.error("Failed to fetch hotels from DB");
      setHotelList([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Card className="shadow-sm mb-4">
            <Card.Header className="bg-white py-3">
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
                    >
                      <option value="">Select Platform</option>
                      {platforms.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </Form.Select>
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
                      menuPortalTarget={document.body} // ✅ IMPORTANT
                      menuPosition="fixed" // ✅ prevents clipping
                      styles={{
                        menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                        menu: (base) => ({ ...base, zIndex: 9999 }),
                      }}
                    />
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
                      menuPortalTarget={document.body} // ✅ IMPORTANT
                      menuPosition="fixed" // ✅ prevents clipping
                      styles={{
                        menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                        menu: (base) => ({ ...base, zIndex: 9999 }),
                      }}
                    />
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
                      onClick={() =>
                        toast.info("Fetch from API logic coming later")
                      }
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
