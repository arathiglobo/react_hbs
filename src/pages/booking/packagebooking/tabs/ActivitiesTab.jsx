import React, { useState, useEffect } from "react";
import { Row, Col, Spinner } from "react-bootstrap";
import axiosInstance from "../../../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import { FaRunning, FaCheckCircle } from "react-icons/fa";

const ActivitiesTab = ({ searchParams, bookingData, updateData, onPrev, onNext }) => {
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Helper to format date from YYYY-MM-DD to DD/MM/YYYY
  const formatDateForApi = (dateStr) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  };

  useEffect(() => {
    fetchActivities();
  }, [searchParams]);

  const fetchActivities = async () => {
    try {
      setIsLoading(true);
      setHasSearched(true);
      const payload = {
        countryId: String(searchParams.destinationCountryId || ""),
        packageid: String(searchParams.packageId || ""),
        packageCategoryid: String(searchParams.packageCategory || ""),
        travelDate: formatDateForApi(searchParams.travelDate) || "",
        adultCount: Number(searchParams.adultCount || 1),
        childCount: Number(searchParams.childCount || 0),
        infantCount: Number(searchParams.infantCount || 0),
        childAge: searchParams.childAge || "",
        infantAge: searchParams.infantAge || "",
        nativeCountry: String(searchParams.nativeCountry || ""),
        agentId: String(searchParams.agentId || ""),
      };

      console.log("Activities search payload:", payload);
      const response = await axiosInstance.post("/api/v1/package-booking/activity-details", payload);
      setActivities(Array.isArray(response.data) ? response.data : []);
      
      if (response.data?.length) {
        toast.success(`Found ${response.data.length} activities.`);
      }
    } catch (error) {
      console.error("Error searching activities:", error);
      toast.error("Failed to fetch activities");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectActivity = (activity) => {
    const isAlreadySelected = bookingData.selectedActivity?.activityId === activity.activityId;
    
    if (isAlreadySelected) {
      // Deselect if already selected
      updateData({
        selectedActivity: null,
        activityPrice: 0,
      });
      toast.info("Activity deselected");
    } else {
      updateData({
        selectedActivity: activity,
        activityPrice: Number(activity.totalRate || 0),
      });
      toast.success(`${activity.activityName} selected!`);
    }
  };

  return (
    <div className="tab-pane-active">
      {isLoading ? (
        <div className="empty-tab-state">
          <Spinner animation="border" variant="primary" style={{ width: 32, height: 32 }} />
          <p style={{ marginTop: 12, color: "#94a3b8", fontSize: "0.85rem" }}>Searching for activities…</p>
        </div>
      ) : hasSearched && activities.length > 0 ? (
        <Row className="g-3">
          {activities.map((activity) => {
            const isSelected = bookingData.selectedActivity?.activityId === activity.activityId;
            return (
              <Col key={activity.activityId} lg={6}>
                <div className={`hotel-selection-card${isSelected ? " selected" : ""}`}>
                  <div className="d-flex gap-3">
                    <div className="hotel-thumb">
                      <img
                        src={activity.activityImage || "https://via.placeholder.com/150?text=Activity"}
                        alt={activity.activityName}
                        style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }}
                      />
                    </div>
                    <div className="flex-grow-1">
                      <div className="d-flex justify-content-between align-items-start mb-1">
                        <h5 className="hotel-name-title mb-0">{activity.activityName}</h5>
                        {isSelected && <FaCheckCircle className="text-success" />}
                      </div>
                      
                      <div 
                        className="text-muted small mb-2 text-truncate-2" 
                        style={{ 
                          height: "32px", 
                          display: "-webkit-box", 
                          WebkitLineClamp: 2, 
                          WebkitBoxOrient: "vertical", 
                          overflow: "hidden",
                          fontSize: "0.75rem"
                        }}
                        title={activity.activityDetails}
                      >
                        {activity.activityDetails}
                      </div>

                      <div className="d-flex justify-content-between align-items-end">
                        <div className="hotel-rates-brief">
                          <div className="rate-item">
                            <span className="label">Total Rate:</span>
                            <span className="value" style={{ fontSize: "1rem", color: "#0f172a" }}>
                              {activity.currencyCode} {activity.totalRate}
                            </span>
                          </div>
                          <div className="nights-badge mt-1" style={{ fontSize: "0.7rem" }}>
                             {activity.totalUserAllowed} Pax Allowed
                          </div>
                        </div>
                        <button
                          className={`btn-nav-next${isSelected ? "" : " btn-nav-prev"}`}
                          style={{ padding: "6px 20px", fontSize: "0.8rem" }}
                          onClick={() => handleSelectActivity(activity)}
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
          <div className="empty-tab-icon"><FaRunning /></div>
          <p style={{ fontWeight: 600, color: "#475569", margin: 0 }}>No activities found</p>
          <p style={{ fontSize: "0.80rem", color: "#94a3b8", marginTop: 4 }}>Try adjusting your search criteria.</p>
        </div>
      ) : (
        <div className="empty-tab-state">
          <div className="empty-tab-icon"><FaRunning /></div>
          <p style={{ fontWeight: 600, color: "#475569", marginBottom: 4 }}>Loading activities...</p>
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

export default ActivitiesTab;