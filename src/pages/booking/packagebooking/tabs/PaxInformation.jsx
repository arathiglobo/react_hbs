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
  // When set, the submit button performs an amendment (PUT) on the
  // existing booking instead of creating a new one (POST).
  editingBookingId,
  // When set (Amend → child-booking flow from PackageBookingDetailView),
  // forwarded to /book so the backend stamps "{parent}/{n}" — e.g.
  // amending GPKG-4 yields GPKG-4/1. Mirrors Hotel ADD NEW ITEM.
  parentBookingCode,
}) => {
  const navigate = useNavigate();
  const [showSummary, setShowSummary] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tourismDirham, setTourismDirham] = useState("");

  // The standalone Contact card has been removed — the first traveller IS
  // the contact. Their email + mobile are captured directly on that row
  // and reused as the booking's primary contact at submission time.
  const [localData, setLocalData] = useState(
    bookingData.paxInfo || {
      travellers: [],
    },
  );

  // The package category defines the MAX number of adults and children the
  // user may enter. They start with only the primary (lead) adult and may
  // opt in to enter more via the "Add extra adult" / "Add extra child"
  // buttons — they are not forced to fill every seat the category allows.
  const maxAdults = Number(searchParams.adultCount) || 1;
  const maxChildren = Number(searchParams.childCount) || 0;

  const currentAdults = localData.travellers.filter((t) => t.type === "Adult").length;
  const currentChildren = localData.travellers.filter((t) => t.type === "Child").length;
  const canAddAdult = currentAdults < maxAdults;
  const canAddChild = currentChildren < maxChildren;

  const makeTraveller = (type) => ({
    type,
    id: `${type.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: "Mr",
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    mobile: "",
  });

  // Initialize / reconcile traveller list when the page mounts or the
  // category caps change.
  //   • No travellers yet → seed with one primary Adult.
  //   • Caps reduced (e.g. user went back and picked a smaller category) →
  //     trim extras but always keep the lead Adult.
  useEffect(() => {
    if (!localData.travellers || localData.travellers.length === 0) {
      const seeded = { ...localData, travellers: [makeTraveller("Adult")] };
      setLocalData(seeded);
      updateData({ ...bookingData, paxInfo: seeded });
      return;
    }
    const adults = localData.travellers.filter((t) => t.type === "Adult");
    const children = localData.travellers.filter((t) => t.type === "Child");
    if (adults.length > maxAdults || children.length > maxChildren) {
      const trimmedAdults = adults.slice(0, Math.max(1, maxAdults));
      const trimmedChildren = children.slice(0, maxChildren);
      const merged = [...trimmedAdults, ...trimmedChildren];
      const updated = { ...localData, travellers: merged };
      setLocalData(updated);
      updateData({ ...bookingData, paxInfo: updated });
    }
  }, [maxAdults, maxChildren]);

  const handleTravellerChange = (index, field, value) => {
    const updatedTravellers = [...localData.travellers];
    updatedTravellers[index] = { ...updatedTravellers[index], [field]: value };
    const updated = { ...localData, travellers: updatedTravellers };
    setLocalData(updated);
    updateData({ ...bookingData, paxInfo: updated });
  };

  const addExtraTraveller = (type) => {
    if (type === "Adult" && !canAddAdult) return;
    if (type === "Child" && !canAddChild) return;
    // Keep adults before children so the primary stays first and child rows
    // appear after the adult rows in the UI.
    const adults = localData.travellers.filter((t) => t.type === "Adult");
    const children = localData.travellers.filter((t) => t.type === "Child");
    const newRow = makeTraveller(type);
    const merged = type === "Adult"
      ? [...adults, newRow, ...children]
      : [...adults, ...children, newRow];
    const updated = { ...localData, travellers: merged };
    setLocalData(updated);
    updateData({ ...bookingData, paxInfo: updated });
  };

  const removeTraveller = (index) => {
    // Primary (index 0) cannot be removed — always required as the contact.
    if (index === 0) return;
    const newList = localData.travellers.filter((_, i) => i !== index);
    const updated = { ...localData, travellers: newList };
    setLocalData(updated);
    updateData({ ...bookingData, paxInfo: updated });
  };

  const primary = localData.travellers && localData.travellers[0];

  const validatePaxData = () => {
    if (!primary) {
      toast.error("No travellers configured.");
      return false;
    }
    if (!primary.firstName || !primary.lastName) {
      toast.error("Please fill the lead traveller's first and last name.");
      return false;
    }
    if (!primary.email || !primary.mobile) {
      toast.error("Please fill the lead traveller's email and mobile (contact info).");
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
        // Amend → child-booking lineage. Backend uses this to compute
        // "{parent}/{n}" for the new booking's code.
        parentBookingCode: parentBookingCode || null,
        totalPrice: totalPrice,
        tourismDirham:
          tourismDirham !== "" && !isNaN(Number(tourismDirham))
            ? Number(tourismDirham)
            : null,
        // counts now reflect the actual entered travellers, not the
        // category cap — the user can opt to enter fewer than the package
        // allows.
        counts: {
          adultCount: currentAdults,
          childCount: currentChildren,
          infantCount: Number(searchParams.infantCount) || 0,
          childAge: searchParams.childAge,
          infantAge: searchParams.infantAge,
        },
        // Contact info is now derived from the first (lead) traveller —
        // the standalone Contact card was removed from the UI.
        contactInfo: {
          title: primary?.title || "Mr",
          name: [primary?.firstName, primary?.middleName, primary?.lastName]
            .filter(Boolean)
            .join(" ")
            .trim(),
          email: primary?.email || "",
          mobile: primary?.mobile || "",
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

      // Amendment path uses PUT against /booking/{id}; create path stays
      // on POST /book. Both return { status: "success", ... } on OK.
      const response = editingBookingId
        ? await axiosInstance.put(
            `/api/v1/package-booking/booking/${editingBookingId}`,
            payload,
          )
        : await axiosInstance.post(
            "/api/v1/package-booking/book",
            payload,
          );

      if (response.data?.status === "success") {
        toast.success(
          response.data.message ||
            (editingBookingId
              ? "Booking amended successfully!"
              : "Booking confirmed successfully!"),
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
      {/* Travellers — the first (lead) traveller doubles as the booking's
          contact. Extras (additional adults / children) are opt-in via the
          buttons below this list and are capped at the package category's
          configured adults / children counts. */}
      <p className="tab-section-title">Traveller information</p>
      {localData.travellers.map((pax, index) => {
        // Numbering within type so extras read "Adult 2", "Child 2" etc.
        const sameTypeBefore = localData.travellers
          .slice(0, index)
          .filter((t) => t.type === pax.type).length;
        return (
        <div key={pax.id} className="pax-card">
          <div className="d-flex justify-content-between align-items-center mb-1">
            <span className="pax-type-badge">
              {pax.type} {sameTypeBefore + 1}
              {index === 0 && (
                <span
                  className="ms-2 badge bg-primary"
                  style={{ fontSize: "0.65rem" }}
                >
                  Primary contact
                </span>
              )}
            </span>
            {index > 0 && (
              <Button
                variant="outline-danger"
                size="sm"
                onClick={() => removeTraveller(index)}
              >
                Remove
              </Button>
            )}
          </div>
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
          {/* Only show email + mobile for the lead traveller (acts as contact). */}
          {index === 0 && (
            <Row className="g-3 mt-1">
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="booking-field-label">
                    Email <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    type="email"
                    placeholder="email@example.com"
                    value={pax.email || ""}
                    onChange={(e) =>
                      handleTravellerChange(index, "email", e.target.value)
                    }
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="booking-field-label">
                    Mobile <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    placeholder="+971 ..."
                    value={pax.mobile || ""}
                    onChange={(e) =>
                      handleTravellerChange(index, "mobile", e.target.value)
                    }
                  />
                </Form.Group>
              </Col>
            </Row>
          )}
        </div>
        );
      })}

      {/* Add-extra controls — only render a button when the category allows
          more of that type. Both buttons disable themselves when the user
          has already reached the cap. */}
      {(maxAdults > 1 || maxChildren > 0) && (
        <div className="d-flex flex-wrap gap-2 mt-2">
          {maxAdults > 1 && (
            <Button
              variant="outline-primary"
              size="sm"
              onClick={() => addExtraTraveller("Adult")}
              disabled={!canAddAdult}
              title={
                canAddAdult
                  ? `Add another adult (max ${maxAdults})`
                  : `Maximum ${maxAdults} adult${maxAdults === 1 ? "" : "s"} for this package category`
              }
            >
              + Add extra adult{" "}
              <span className="text-muted">
                ({currentAdults}/{maxAdults})
              </span>
            </Button>
          )}
          {maxChildren > 0 && (
            <Button
              variant="outline-primary"
              size="sm"
              onClick={() => addExtraTraveller("Child")}
              disabled={!canAddChild}
              title={
                canAddChild
                  ? `Add a child (max ${maxChildren})`
                  : `Maximum ${maxChildren} child${maxChildren === 1 ? "" : "ren"} for this package category`
              }
            >
              + Add extra child{" "}
              <span className="text-muted">
                ({currentChildren}/{maxChildren})
              </span>
            </Button>
          )}
        </div>
      )}

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
          {editingBookingId ? "Save amendment →" : "Confirm booking →"}
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
                    {currentAdults} Adult, {currentChildren} Child
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
                    AED {(
                      Number(totalPrice || 0) +
                      (tourismDirham !== "" && !isNaN(Number(tourismDirham))
                        ? Number(tourismDirham)
                        : 0)
                    ).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </Table>
            <div className="mt-3">
              <label className="form-label fw-semibold">Tourism Dirham</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="form-control"
                placeholder="0.00"
                value={tourismDirham}
                onChange={(e) => setTourismDirham(e.target.value)}
              />
              <small className="text-muted">
                Optional — added to the Grand Total above.
              </small>
            </div>
          </div>

          <div className="summary-section">
            <h6 className="section-header d-flex align-items-center mb-3">
              <FaUsers className="me-2 text-muted" size={14} />
              Contact & Travellers
            </h6>
            <div className="summary-card p-3 bg-white rounded shadow-sm border">
              <p className="mb-2">
                <strong>Contact:</strong>{" "}
                {primary
                  ? `${[primary.firstName, primary.lastName].filter(Boolean).join(" ")} (${primary.email || "-"})`
                  : "-"}
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
                <FaCheckCircle className="me-2" />{" "}
                {editingBookingId ? "Save Amendment" : "Submit Booking"}
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
