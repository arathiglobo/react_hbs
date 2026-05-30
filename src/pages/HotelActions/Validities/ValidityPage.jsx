import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, Button, Row, Col, Badge, Spinner, Table } from "react-bootstrap";
import Sidebar from "../../../components/Sidebar";
import Topbar from "../../../components/TopBar";
import axiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import {
  FaCalendarAlt,
  FaCheckCircle,
  FaTimesCircle,
  FaExclamationTriangle,
  FaInfoCircle,
  FaArrowLeft,
  FaClock,
} from "react-icons/fa";
import { RiArrowLeftSLine } from "react-icons/ri";

export default function ValidityPage() {
  const { id } = useParams(); // hotelId
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [validityData, setValidityData] = useState(null);
  const [error, setError] = useState("");

  // Fetch validity data from API
  const fetchValidityData = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await axiosInstance.get(`/api/hotelInventory/${id}`);
      setValidityData(response.data);
    } catch (error) {
      console.error("Error fetching validity data:", error);
      setError("Failed to load validity data");
      toast.error("Failed to load validity data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchValidityData();
    }
  }, [id]);

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Format date and time for display
  const formatDateTime = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Get status badge
  const getStatusBadge = (status) => {
    return status ? (
      <Badge bg="success" className="d-flex align-items-center gap-1">
        <FaCheckCircle size={12} />
        Active
      </Badge>
    ) : (
      <Badge bg="danger" className="d-flex align-items-center gap-1">
        <FaTimesCircle size={12} />
        Inactive
      </Badge>
    );
  };

  // Render validity list component
  const ValidityList = ({ title, data, icon, color }) => {
    if (!data || data.length === 0) {
      return (
        <Card className="mb-3 shadow-sm">
          <Card.Header className="bg-white border-bottom">
            <h6 className="mb-0 text-primary fw-bold">{title}</h6>
          </Card.Header>
          <Card.Body className="p-3">
            <div className="text-center py-3">
              <p className="text-muted mb-0">No Data Available</p>
            </div>
          </Card.Body>
        </Card>
      );
    }

    return (
      <Card className="mb-3 shadow-sm">
        <Card.Header className="bg-white border-bottom">
          <h6 className="mb-0 text-primary fw-bold">{title}</h6>
        </Card.Header>
        <Card.Body className="p-0">
          <Table responsive className="mb-0">
            <thead className="table-light">
              <tr>
                <th className="border-0 py-3 px-3 fw-semibold">
                  Validity From
                </th>
                <th className="border-0 py-3 px-3 fw-semibold">Validity To</th>
                <th className="border-0 py-3 px-3 fw-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, index) => {
                return (
                  <tr key={index} className="border-bottom">
                    <td className="py-3 px-3">
                      <span className="fw-medium">
                        {formatDate(item.validityFrom)}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="fw-medium">
                        {formatDate(item.validityTo)}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={
                          item.status
                            ? "text-success fw-medium"
                            : "text-danger fw-medium"
                        }
                      >
                        {item.status ? "Live" : "Stop"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="min-vh-100 bg-light d-flex flex-column">
        <Topbar />
        <div className="d-flex flex-grow-1">
          <Sidebar />
          <main className="flex-grow-1 p-4">
            <Card className="shadow-sm rounded-xl">
              <Card.Body className="text-center py-5">
                <Spinner animation="border" className="text-primary mb-3" />
                <h5 className="text-muted">Loading validity data...</h5>
                <p className="text-muted mb-0">
                  Please wait while we fetch the hotel inventory data
                </p>
              </Card.Body>
            </Card>
          </main>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-vh-100 bg-light d-flex flex-column">
        <Topbar />
        <div className="d-flex flex-grow-1">
          <Sidebar />
          <main className="flex-grow-1 p-4">
            <Card className="shadow-sm rounded-xl">
              <Card.Body className="text-center py-5">
                <FaExclamationTriangle className="text-danger mb-3" size={48} />
                <h5 className="text-danger">Error Loading Data</h5>
                <p className="text-muted mb-3">{error}</p>
                <Button variant="primary" onClick={fetchValidityData}>
                  Try Again
                </Button>
              </Card.Body>
            </Card>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          {/* Header */}
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div className="d-flex align-items-center gap-3">
              <Button
                variant="outline-primary"
                onClick={() => navigate(`/hotel-details/${id}`)}
                className="d-flex align-items-center btn-sm gap-2"
              >
                <FaArrowLeft />
                Back
              </Button>
              <h4 className="mb-0 fw-bold text-dark">
                Hotel Validity Period Details
              </h4>
            </div>
            <small className="text-muted">Hotel ID: {id}</small>
          </div>

          {/* Validity Data Display */}
          {validityData && (
            <div>
              {/* Occupancy Validity */}
              <ValidityList
                title="Occupancy"
                data={validityData.occupancyValidtyList}
                icon={<FaCheckCircle size={18} />}
                color="primary"
              />

              {/* Minimum Length Validity */}
              <ValidityList
                title="Minimum Length"
                data={validityData.minimumLengthValidtyList}
                icon={<FaClock size={18} />}
                color="info"
              />

              {/* Contract Rate Validity */}
              <ValidityList
                title="Contract Rate"
                data={validityData.contractRateValiditylist}
                icon={<FaInfoCircle size={18} />}
                color="warning"
              />

              {/* Hotel Available Validity */}
              <ValidityList
                title="Hotel Available"
                data={validityData.hotelAvailableValidityList}
                icon={<FaCalendarAlt size={18} />}
                color="success"
              />

              {/* Special Rate Validity */}
              <ValidityList
                title="Special Rate"
                data={validityData.specialRateValidityList}
                icon={<FaExclamationTriangle size={18} />}
                color="secondary"
              />

              {/* Discount Validity */}
              <ValidityList
                title="Discount Rate"
                data={validityData.discountValidityList}
                icon={<FaTimesCircle size={18} />}
                color="danger"
              />

              {/* Stay Pay Validity */}
              <ValidityList
                title="Stay Pay"
                data={validityData.stayPayValidityList}
                icon={<FaCheckCircle size={18} />}
                color="dark"
              />

              {/* Monthly Validity */}
              {validityData.monthlyValidityList && (
                <ValidityList
                  title="Monthly"
                  data={validityData.monthlyValidityList}
                  icon={<FaCalendarAlt size={18} />}
                  color="primary"
                />
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
