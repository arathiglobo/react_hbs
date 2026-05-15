import React, { useState, useEffect } from "react";
import { Row, Col, Spinner } from "react-bootstrap";
import axiosInstance from "../../../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import { FaCar, FaSearch, FaMapMarkerAlt, FaClock } from "react-icons/fa";

const CabsTab = ({ searchParams, bookingData, updateData, onPrev, onNext }) => {
  const [cabs, setCabs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const formatDateForApi = (dateStr) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  };

  useEffect(() => {
    fetchCabs();
  }, [searchParams]);

  const fetchCabs = async () => {
    try {
      setIsLoading(true);
      setHasSearched(true);
      const payload = {
        countryId: searchParams.destinationCountryId || "",
        packageid: searchParams.packageId || "",
        packageCategoryid: searchParams.packageCategory || "",
        travelDate: formatDateForApi(searchParams.travelDate) || "",
        adultCount: searchParams.adultCount || 1,
        childCount: searchParams.childCount || 0,
        infantCount: searchParams.infantCount || 0,
        childAge: searchParams.childAge || "",
        infantAge: searchParams.infantAge || "",
        nativeCountry: searchParams.nativeCountry || "",
        agentId: searchParams.agentId || "",
      };

      console.log("Cabs search payload:", payload);
      const response = await axiosInstance.post("/api/v1/package-booking/search-cabs", payload);
      setCabs(Array.isArray(response.data) ? response.data : []);
      if (!response.data?.length) {
        toast.error("No cabs available for the selected criteria.");
      } else {
        toast.success(`Found ${response.data.length} vehicles.`);
      }
    } catch (error) {
      console.error("Error searching cabs:", error);
      toast.error("Failed to fetch cabs");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectOption = (cab, option) => {
    updateData({
      selectedCab: { cabid: cab.cabid, cabname: cab.cabname, cabpic: cab.cabpic, ...option },
      cabPrice: option.totalrate || 0,
    });
    toast.success(`${cab.cabname} selected!`);
  };

  return (
    <div className="tab-pane-active">

      {isLoading ? (
        <div className="empty-tab-state">
          <Spinner animation="border" variant="primary" style={{ width: 32, height: 32 }} />
          <p style={{ marginTop: 12, color: "#94a3b8", fontSize: "0.85rem" }}>Finding the best rides…</p>
        </div>
      ) : hasSearched && cabs.length > 0 ? (
        <div>
          {cabs.map((cab) => (
            <div key={cab.cabid} className="cab-card">
              <Row className="g-0">
                <Col md={3}>
                  <div className="cab-image-box">
                    <img
                      src={cab.cabpic || "https://via.placeholder.com/300x180?text=Vehicle"}
                      alt={cab.cabname}
                      style={{ maxHeight: 140, maxWidth: "100%", objectFit: "contain" }}
                    />
                  </div>
                </Col>
                <Col md={9}>
                  <div style={{ padding: "1.25rem 1.5rem" }}>
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <div>
                        <p style={{ fontWeight: 700, fontSize: "1rem", color: "#0f172a", margin: 0 }}>
                          {cab.cabname}
                        </p>
                      </div>
                    </div>
                    <p className="tab-section-title mb-2">Select transfer type</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {cab.searchCabDetailsDTO?.map((option, idx) => {
                        const isSelected =
                          bookingData.selectedCab?.cabid === cab.cabid &&
                          bookingData.selectedCab?.dropdetails === option.dropdetails &&
                          bookingData.selectedCab?.types === option.types;
                        return (
                          <div
                            key={idx}
                            className={`option-row${isSelected ? " selected" : ""}`}
                            onClick={() => handleSelectOption(cab, option)}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span className={option.types === "Private" ? "option-badge-private" : "option-badge-shared"}>
                                {option.types}
                              </span>
                              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#1e293b" }}>
                                {option.location}
                              </span>
                              <span style={{ fontSize: "0.75rem", color: "#94a3b8", display: "flex", alignItems: "center", gap: 4 }}>
                                <FaMapMarkerAlt size={10} /> {option.dropoff}
                              </span>
                              <span style={{ fontSize: "0.75rem", color: "#94a3b8", display: "flex", alignItems: "center", gap: 4 }}>
                                <FaClock size={10} /> {option.validityFrom} – {option.validityTo}
                              </span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <div>
                                <span className="option-currency">{option.currency_code}</span>
                                <span className="option-price">{option.totalrate}</span>
                              </div>
                              <button
                                className={`btn-nav-next${isSelected ? "" : " btn-nav-prev"}`}
                                style={{ padding: "6px 18px", fontSize: "0.78rem" }}
                                onClick={(e) => { e.stopPropagation(); handleSelectOption(cab, option); }}
                              >
                                {isSelected ? "✓ Selected" : "Select"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Col>
              </Row>
            </div>
          ))}
        </div>
      ) : hasSearched ? (
        <div className="empty-tab-state">
          <div className="empty-tab-icon"><FaCar /></div>
          <p style={{ fontWeight: 600, color: "#475569", margin: 0 }}>No cabs found</p>
          <p style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: 4 }}>Try different criteria.</p>
        </div>
      ) : (
        <div className="empty-tab-state">
          <div className="empty-tab-icon"><FaCar /></div>
          <p style={{ fontWeight: 600, color: "#475569", marginBottom: 4 }}>Ready to search</p>
          <p style={{ fontSize: "0.8rem", color: "#94a3b8", margin: 0 }}>
            Click the button above to see available cab options for this package.
          </p>
        </div>
      )}

      <hr className="tab-nav-divider" />
      <div className="d-flex justify-content-between mt-3">
        <button className="btn-nav-prev" onClick={onPrev}>← Previous</button>
        <button className="btn-nav-next" onClick={onNext}>Next →</button>
      </div>
    </div>
  );
};

export default CabsTab;