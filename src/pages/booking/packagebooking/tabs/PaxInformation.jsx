import React, { useState, useEffect } from "react";
import { Row, Col, Form, Modal, Button, Table } from "react-bootstrap";
import axiosInstance from "../../../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import {
  FaCheckCircle,
  FaClipboardList,
  FaUsers,
  FaMapMarkerAlt,
  FaCalendarAlt,
} from "react-icons/fa";

const PaxInformation = ({
  searchParams,
  bookingData,
  updateData,
  onPrev,
  onFinish,
  packageData,
  totalPrice,
}) => {
  const navigate = useNavigate();
  const [showSummary, setShowSummary] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [localData, setLocalData] = useState(
    bookingData.paxInfo || {
      contactTitle: "Mr",
      contactName: "",
      contactEmail: "",
      contactMobile: "",
      travellers: [],
    },
  );

  useEffect(() => {
    const adults = Number(searchParams.adultCount) || 1;
    const children = Number(searchParams.childCount) || 0;

    // Only initialize if photographers list is empty or doesn't match counts
    if (localData.travellers.length !== adults + children) {
      const list = [];
      for (let i = 1; i <= adults; i++)
        list.push({
          type: "Adult",
          id: `adult-${i}`,
          title: "Mr",
          firstName: "",
          middleName: "",
          lastName: "",
        });
      for (let i = 1; i <= children; i++)
        list.push({
          type: "Child",
          id: `child-${i}`,
          title: "Mr",
          firstName: "",
          middleName: "",
          lastName: "",
        });

      setLocalData((prev) => ({ ...prev, travellers: list }));
    }
  }, [searchParams]);

  const handleContactChange = (field, value) => {
    let updatedTravellers = [...localData.travellers];

    // Automatically sync contact info to the first traveller
    if (updatedTravellers.length > 0) {
      if (field === "contactTitle") {
        updatedTravellers[0] = { ...updatedTravellers[0], title: value };
      } else if (field === "contactName") {
        const nameParts = value.trim().split(/\s+/);
        const firstName = nameParts[0] || "";
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";
        updatedTravellers[0] = {
          ...updatedTravellers[0],
          firstName: firstName,
          lastName: lastName,
        };
      }
    }

    const updated = {
      ...localData,
      [field]: value,
      travellers: updatedTravellers,
    };
    setLocalData(updated);
    updateData({ ...bookingData, paxInfo: updated });
  };

  const handleTravellerChange = (index, field, value) => {
    const updatedTravellers = [...localData.travellers];
    updatedTravellers[index] = { ...updatedTravellers[index], [field]: value };
    const updated = { ...localData, travellers: updatedTravellers };
    setLocalData(updated);
    updateData({ ...bookingData, paxInfo: updated });
  };

  const validatePaxData = () => {
    if (
      !localData.contactName ||
      !localData.contactEmail ||
      !localData.contactMobile
    ) {
      toast.error("Please fill in all contact information.");
      return false;
    }

    const incompleteTraveller = localData.travellers.find(
      (t) => !t.firstName || !t.lastName,
    );
    if (incompleteTraveller) {
      toast.error("Please fill in first and last names for all travellers.");
      return false;
    }

    return true;
  };

  const handleSubmitBooking = async () => {
    try {
      setIsSubmitting(true);

      // Construct the comprehensive payload
      const payload = {
        packageId: searchParams.packageId,
        agentId: searchParams.agentId,
        countryId: searchParams.destinationCountryId,
        cityId: searchParams.destinationCityId || "", // City ID from search or basic details
        travelDate: searchParams.travelDate,
        packageCategory: searchParams.packageCategory,
        nativeCountry: searchParams.nativeCountry,
        totalPrice: totalPrice,
        counts: {
          adultCount: Number(searchParams.adultCount),
          childCount: Number(searchParams.childCount),
          infantCount: Number(searchParams.infantCount),
          childAge: searchParams.childAge,
          infantAge: searchParams.infantAge,
        },
        contactInfo: {
          title: localData.contactTitle,
          name: localData.contactName,
          email: localData.contactEmail,
          mobile: localData.contactMobile,
        },
        travellers: localData.travellers,
        selections: {
          hotels: (bookingData.selections.selectedHotels || []).map((h) => ({
            hotelId: h.hotelId,
            hotelName: h.hotelName,
            selectedRate: h.totalRateWithMarkup,
            currency: h.currencyCode || "AED",
          })),
          cab: null,
          activity: null,
        },
      };

      console.log("Final Booking Payload:", payload);

      const response = await axiosInstance.post(
        "/api/v1/package-booking/book",
        payload,
      );

      if (response.data?.status === "success") {
        toast.success(
          response.data.message || "Booking confirmed successfully!",
        );
        setShowSummary(false);
        navigate("/booking-details/package-booking-list");
      }
    } catch (error) {
      console.error("Booking submission error:", error);
      toast.error(
        error.response?.data?.message ||
          "Failed to confirm booking. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const titleSelect = (value, onChange) => (
    <Form.Select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ height: "58px", minWidth: "50px" }}
      disabled={isViewMode}
    >
      <option value="Mr">Mr</option>
      <option value="Ms">Ms</option>
      <option value="Mrs">Mrs</option>
    </Form.Select>
  );

  const isViewMode = false; // Add check if needed

  return (
    <div className="tab-pane-active">
      {/* Contact info */}
      <p className="tab-section-title">Contact information</p>
      <div className="pax-card mb-2">
        <Row className="g-3">
          <Col md={1}>
            <Form.Group>
              <Form.Label className="booking-field-label">Title</Form.Label>
              {titleSelect(localData.contactTitle, (v) =>
                handleContactChange("contactTitle", v),
              )}
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label className="booking-field-label">Name</Form.Label>
              <Form.Control
                placeholder="Full name"
                value={localData.contactName}
                onChange={(e) =>
                  handleContactChange("contactName", e.target.value)
                }
              />
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group>
              <Form.Label className="booking-field-label">Email</Form.Label>
              <Form.Control
                type="email"
                placeholder="email@example.com"
                value={localData.contactEmail}
                onChange={(e) =>
                  handleContactChange("contactEmail", e.target.value)
                }
              />
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group>
              <Form.Label className="booking-field-label">Mobile</Form.Label>
              <Form.Control
                placeholder="+971 ..."
                value={localData.contactMobile}
                onChange={(e) =>
                  handleContactChange("contactMobile", e.target.value)
                }
              />
            </Form.Group>
          </Col>
        </Row>
      </div>

      {/* Travellers */}
      <p className="tab-section-title">Traveller information</p>
      {localData.travellers.map((pax, index) => (
        <div key={pax.id} className="pax-card">
          <span className="pax-type-badge">
            {pax.type} {index + 1}
          </span>
          <Row className="g-3">
            <Col md={1}>
              <Form.Group>
                <Form.Label className="booking-field-label">Title</Form.Label>
                {titleSelect(pax.title, (v) =>
                  handleTravellerChange(index, "title", v),
                )}
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label className="booking-field-label">
                  First name
                </Form.Label>
                <Form.Control
                  value={pax.firstName}
                  onChange={(e) =>
                    handleTravellerChange(index, "firstName", e.target.value)
                  }
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label className="booking-field-label">
                  Middle name
                </Form.Label>
                <Form.Control
                  value={pax.middleName}
                  onChange={(e) =>
                    handleTravellerChange(index, "middleName", e.target.value)
                  }
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label className="booking-field-label">
                  Last name
                </Form.Label>
                <Form.Control
                  value={pax.lastName}
                  onChange={(e) =>
                    handleTravellerChange(index, "lastName", e.target.value)
                  }
                />
              </Form.Group>
            </Col>
          </Row>
        </div>
      ))}

      <hr className="tab-nav-divider" />
      <div className="d-flex justify-content-between mt-3">
        <button className="btn-nav-prev" onClick={onPrev}>
          ← Previous
        </button>
        <button
          className="btn-nav-next"
          onClick={() => {
            if (validatePaxData()) setShowSummary(true);
          }}
        >
          Confirm booking →
        </button>
      </div>

      {/* Order Summary Modal */}
      <Modal
        show={showSummary}
        onHide={() => setShowSummary(false)}
        size="lg"
        centered
        className="order-summary-modal"
      >
        <Modal.Header closeButton style={{ background: "#f8fafc" }}>
          <Modal.Title className="d-flex align-items-center">
            <FaClipboardList className="me-2 text-primary" />
            Order Summary
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4" style={{ background: "#f8fafc" }}>
          <div className="summary-section mb-4">
            <h6 className="section-header d-flex align-items-center mb-3">
              <FaCalendarAlt className="me-2 text-muted" size={14} />
              Package & Schedule
            </h6>
            <div className="summary-card p-3 bg-white rounded shadow-sm border">
              <Row>
                <Col sm={6}>
                  <p className="mb-1 text-muted small">Package</p>
                  <p className="fw-semibold mb-0">
                    {packageData?.packageName || "Standard Package"}
                  </p>
                </Col>
                <Col sm={3}>
                  <p className="mb-1 text-muted small">Date</p>
                  <p className="fw-semibold mb-0">{searchParams.travelDate}</p>
                </Col>
                <Col sm={3}>
                  <p className="mb-1 text-muted small">Passengers</p>
                  <p className="fw-semibold mb-0">
                    {searchParams.adultCount} Adult, {searchParams.childCount}{" "}
                    Child
                  </p>
                </Col>
              </Row>
            </div>
          </div>

          <div className="summary-section mb-4">
            <h6 className="section-header d-flex align-items-center mb-3">
              <FaMapMarkerAlt className="me-2 text-muted" size={14} />
              Selections
            </h6>
            <Table
              borderless
              className="bg-white rounded shadow-sm border mb-0"
            >
              <thead className="table-light">
                <tr>
                  <th>Service</th>
                  <th>Selection</th>
                  <th className="text-end">Price</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="text-muted">Package Base</td>
                  <td>Included Services</td>
                  <td className="text-end">AED {packageData?.rate || 0}</td>
                </tr>
                {bookingData.selections.selectedHotels && bookingData.selections.selectedHotels.map((hotel, idx) => (
                  <tr key={hotel.hotelId || idx}>
                    <td className="text-muted">Hotel {bookingData.selections.selectedHotels.length > 1 ? idx + 1 : ""}</td>
                    <td>{hotel.hotelName}</td>
                    <td className="text-end">
                      + AED {hotel.totalRateWithMarkup || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="table-light">
                <tr className="fw-bold fw-large">
                  <td colSpan={2}>Grand Total</td>
                  <td
                    className="text-end text-primary"
                    style={{ fontSize: "1.1rem" }}
                  >
                    AED {totalPrice}
                  </td>
                </tr>
              </tfoot>
            </Table>
          </div>

          <div className="summary-section">
            <h6 className="section-header d-flex align-items-center mb-3">
              <FaUsers className="me-2 text-muted" size={14} />
              Contact & Travellers
            </h6>
            <div className="summary-card p-3 bg-white rounded shadow-sm border">
              <p className="mb-2">
                <strong>Contact:</strong> {localData.contactName} (
                {localData.contactEmail})
              </p>
              <p className="mb-0 text-muted small">
                <strong>Travellers:</strong>{" "}
                {localData.travellers
                  .map((t) => `${t.firstName} ${t.lastName}`)
                  .join(", ")}
              </p>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer
          className="border-top-0 p-3"
          style={{ background: "#f1f5f9" }}
        >
          <Button
            variant="outline-secondary"
            onClick={() => setShowSummary(false)}
            disabled={isSubmitting}
          >
            Modify selections
          </Button>
          <Button
            className="btn-nav-next"
            onClick={handleSubmitBooking}
            disabled={isSubmitting}
            style={{ minWidth: "160px" }}
          >
            {isSubmitting ? (
              "Processing..."
            ) : (
              <>
                <FaCheckCircle className="me-2" /> Submit Booking
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      <style>{`
        .order-summary-modal .modal-content {
          border: none;
          box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
          border-radius: 12px;
          overflow: hidden;
        }
        .section-header {
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #64748b;
        }
        .fw-large {
          font-size: 1.1rem;
        }
      `}</style>
    </div>
  );
};

export default PaxInformation;
