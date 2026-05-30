import React, { useState, useEffect } from "react";
import { Row, Col, Spinner } from "react-bootstrap";
import axiosInstance from "../../../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import { FaHotel } from "react-icons/fa";

const HotelsTab = ({ searchParams, bookingData, updateData, onPrev, onNext }) => {
  const [hotels, setHotels] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Helper to format date from YYYY-MM-DD to DD/MM/YYYY
  const formatDateForApi = (dateStr) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  };

  useEffect(() => {
    fetchHotels();
  }, [searchParams]);

  const fetchHotels = async () => {
    try {
      setIsLoading(true);
      setHasSearched(true);
      const payload = {
        countryId: searchParams.destinationCountryId || "",
        packageid: searchParams.packageId || "",
        packageCategoryid: searchParams.packageCategory || "",
        travelDate: formatDateForApi(searchParams.travelDate) || "",
        adultCount: String(searchParams.adultCount || 1),
        childCount: String(searchParams.childCount || 0),
        infantCount: String(searchParams.infantCount || 0),
        childAge: searchParams.childAge || "",
        infantAge: searchParams.infantAge || "",
        nativeCountry: String(searchParams.nativeCountry || ""),
        agentId: String(searchParams.agentId || ""),
      };

      console.log("Hotels search payload:", payload);
      const response = await axiosInstance.post("/api/v1/package-booking/hotel-details", payload);
      setHotels(Array.isArray(response.data) ? response.data : []);
      
      if (!response.data?.length) {
        toast.error("No hotels available for the selected criteria.");
      } else {
        toast.success(`Found ${response.data.length} hotels.`);
      }
    } catch (error) {
      console.error("Error searching hotels:", error);
      toast.error("Failed to fetch hotels");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectHotel = (hotel) => {
    updateData({
      selectedHotel: hotel,
      hotelPrice: Number(hotel.adultRate || 0) + Number(hotel.childRate || 0),
    });
    toast.success(`${hotel.hotelName} selected!`);
  };

  return (
    <div className="tab-pane-active">
      {isLoading ? (
        <div className="empty-tab-state">
          <Spinner animation="border" variant="primary" style={{ width: 32, height: 32 }} />
          <p style={{ marginTop: 12, color: "#94a3b8", fontSize: "0.85rem" }}>Searching for hotels…</p>
        </div>
      ) : hasSearched && hotels.length > 0 ? (
        <Row className="g-3">
          {hotels.map((hotel) => {
            const isSelected = bookingData.selectedHotel?.hotelId === hotel.hotelId;
            return (
              <Col key={hotel.hotelId} md={6}>
                <div className={`hotel-selection-card${isSelected ? " selected" : ""}`}>
                  <div className="d-flex gap-3">
                    <div className="hotel-thumb">
                      <img
                        src={hotel.image || "https://via.placeholder.com/150?text=Hotel"}
                        alt={hotel.hotelName}
                        style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }}
                      />
                    </div>
                    <div className="flex-grow-1">
                      <h5 className="hotel-name-title mb-1">{hotel.hotelName}</h5>
                      <p className="text-muted small mb-2">{hotel.stateName}</p>
                      <div className="d-flex justify-content-between align-items-end">
                        <div className="hotel-rates-brief">
                          <div className="rate-item">
                            <span className="label">Adult Rate:</span>
                            <span className="value">AED {hotel.adultRate}</span>
                          </div>
                          <div className="rate-item">
                            <span className="label">Child Rate:</span>
                            <span className="value">AED {hotel.childRate}</span>
                          </div>
                          <div className="nights-badge mt-1">
                             {hotel.noOfnight} Night(s)
                          </div>
                        </div>
                        <button
                          className={`btn-nav-next${isSelected ? "" : " btn-nav-prev"}`}
                          style={{ padding: "6px 20px", fontSize: "0.8rem" }}
                          onClick={() => handleSelectHotel(hotel)}
                        >
                          {isSelected ? "✓ Selected" : "Select"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </Col>
            );
          })}
        </Row>
      ) : hasSearched ? (
        <div className="empty-tab-state">
          <div className="empty-tab-icon"><FaHotel /></div>
          <p style={{ fontWeight: 600, color: "#475569", margin: 0 }}>No hotels found</p>
          <p style={{ fontSize: "0.80rem", color: "#94a3b8", marginTop: 4 }}>Try adjusting your search criteria.</p>
        </div>
      ) : (
        <div className="empty-tab-state">
          <div className="empty-tab-icon"><FaHotel /></div>
          <p style={{ fontWeight: 600, color: "#475569", marginBottom: 4 }}>Loading hotels...</p>
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

export default HotelsTab;