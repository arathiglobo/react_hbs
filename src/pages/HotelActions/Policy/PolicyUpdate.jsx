import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Container,
  Row,
  Col,
  Form,
  Button,
  Card,
  Spinner,
} from "react-bootstrap";
import { FaArrowLeft, FaPlus, FaTrash, FaSave } from "react-icons/fa";
import Sidebar from "../../../components/Sidebar";
import Topbar from "../../../components/TopBar";
import axiosInstance from "../../../components/AxiosInstance";
import HotelTitleBadge from "../../../components/HotelTitleBadge";
import { toast } from "react-hot-toast";

const PolicyUpdate = () => {
  const { id, editId } = useParams(); // hotelId, policyId
  const policyId = editId;
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [policy, setPolicy] = useState(null);
  const [marketTypes, setMarketTypes] = useState([]);
  const [loadingMarkets, setLoadingMarkets] = useState(false);

  // ✅ Fetch market types
  const fetchMarketTypes = async () => {
    try {
      setLoadingMarkets(true);
      const res = await axiosInstance.get("/api/marketType");
      setMarketTypes(res.data || []);
    } catch (error) {
      console.error("Error fetching market types:", error);
      toast.error("Failed to load market types");
    } finally {
      setLoadingMarkets(false);
    }
  };

  // ✅ Fetch existing policy
  useEffect(() => {
    const fetchPolicy = async () => {
      try {
        const res = await axiosInstance.get(`/api/hotelPolicy/${policyId}`);
        setPolicy(res.data);
      } catch (error) {
        console.error("Error fetching policy:", error);
        toast.error("Failed to load policy details");
      } finally {
        setLoading(false);
      }
    };
    fetchMarketTypes();
    fetchPolicy();
  }, [policyId]);

  // ✅ Handlers
  const handleChange = (field, value) =>
    setPolicy((prev) => ({ ...prev, [field]: value }));

  const handleNestedChange = (section, index, field, value) => {
    const updated = [...policy[section]];
    updated[index][field] = value;
    setPolicy((prev) => ({ ...prev, [section]: updated }));
  };

  const handleAddRow = (section, obj) =>
    setPolicy((prev) => ({ ...prev, [section]: [...prev[section], obj] }));

  const handleRemoveRow = (section, index) => {
    const updated = policy[section].filter((_, i) => i !== index);
    setPolicy((prev) => ({ ...prev, [section]: updated }));
  };

  const handleAdditionalChange = (field, value) => {
    setPolicy((prev) => ({
      ...prev,
      additionalPolicy: { ...prev.additionalPolicy, [field]: value },
    }));
  };

  // ✅ Normalise any datetime string to "yyyy-MM-ddTHH:mm" for datetime-local inputs.
  // Handles: "2025-01-15T10:30:00", "2025-01-15T10:30:00.000Z", "2025-01-15 10:30", etc.
  const normaliseDateTime = (value) => {
    if (!value) return "";
    // Already in the correct 16-char format
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return value;
    const date = new Date(value);
    if (isNaN(date.getTime())) return "";
    // Use local time components to avoid timezone shift
    const pad = (n) => String(n).padStart(2, "0");
    return (
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
      `T${pad(date.getHours())}:${pad(date.getMinutes())}`
    );
  };

  // ✅ Helper function to get minimum date for Validity To (From date + 1 minute)
  const getMinValidityToDate = (fromDate) => {
    if (!fromDate) return "";
    const date = new Date(fromDate);
    if (isNaN(date.getTime())) return ""; // Guard against invalid dates from API
    date.setMinutes(date.getMinutes() + 1);
    return date.toISOString().slice(0, 16);
  };

  // ✅ Save updates
  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload = {
        ...policy,
        validityPeriods: policy.validityPeriods.map(period => ({
          ...period,
          validityFrom: period.validityFrom ? `${period.validityFrom}:00` : period.validityFrom,
          validityTo: period.validityTo ? `${period.validityTo}:00` : period.validityTo
        }))
      };
      const policyUpdateRes = await axiosInstance.put(`/api/hotelPolicy/${policyId}`, payload);

      if (policyUpdateRes.data != null) {
        toast.success("Policy updated successfully!");
        navigate(`/hotel-actions/${id}/hotel-policy`);
      }

    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to update policy.");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !policy) {
    return (
      <div className="min-vh-100 d-flex flex-column bg-light">
        <Topbar />
        <div className="d-flex flex-grow-1">
          <Sidebar />
          <main className="flex-grow-1 d-flex justify-content-center align-items-center">
            <Spinner animation="border" variant="primary" />
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
          <Container fluid>
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center mb-4 border-bottom pb-2">
              <Button
                variant="outline-secondary"
                className="rounded-pill px-3"
                onClick={() => navigate(-1)}
              >
                <FaArrowLeft className="me-2" /> Back
              </Button>
              <h4 className="fw-semibold text-dark mb-0 d-flex align-items-center gap-2">
                Update Policy Details
                <HotelTitleBadge hotelId={id} />
              </h4>
            </div>

            <Card className="shadow-sm border-0 p-4 rounded-4 bg-white">
              <Form onSubmit={handleSave}>
                {/* Policy Info */}
                <Row className="mb-4">
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label className="fw-semibold small text-secondary">
                        Policy Code *
                      </Form.Label>
                      <Form.Control
                        type="text"
                        className="rounded-3"
                        value={policy.policyCode}
                        onChange={(e) =>
                          handleChange("policyCode", e.target.value)
                        }
                      />
                    </Form.Group>
                  </Col>

                  <Col md={4}>
                    <Form.Group>
                      <Form.Label className="fw-semibold small text-secondary">
                        Market Type
                      </Form.Label>
                      {loadingMarkets ? (
                        <Spinner animation="border" size="sm" />
                      ) : (
                        <Form.Select
                          className="rounded-3"
                          value={policy.marketTypeId?.[0] || ""}
                          onChange={(e) =>
                            handleChange("marketTypeId", [
                              parseInt(e.target.value),
                            ])
                          }
                        >
                          <option value="100">All Market</option>
                          {marketTypes.map((m) => (
                            <option
                              key={m.marketTypeId}
                              value={m.marketTypeId}
                            >
                              {m.name}
                            </option>
                          ))}
                        </Form.Select>
                      )}
                    </Form.Group>
                  </Col>

                  <Col md={4}>
                    <Form.Group>
                      <Form.Label className="fw-semibold small text-secondary">
                        Remarks
                      </Form.Label>
                      <Form.Control
                        type="text"
                        className="rounded-3"
                        value={policy.remarks}
                        onChange={(e) => handleChange("remarks", e.target.value)}
                      />
                    </Form.Group>
                  </Col>
                </Row>

                {/* Validity */}
                <div className="border-top pt-4 mt-3">
                  <h6 className="fw-bold text-dark mb-3">Validity List</h6>
                  {policy.validityPeriods.map((v, index) => (
                    <Row key={index} className="align-items-end mb-2 g-2">
                      <Col md={5}>
                        <Form.Label className="small text-secondary">
                          Validity From
                        </Form.Label>
                        <Form.Control
                          type="datetime-local"
                          className="rounded-3"
                          value={normaliseDateTime(v.validityFrom)}
                          onChange={(e) =>
                            handleNestedChange(
                              "validityPeriods",
                              index,
                              "validityFrom",
                              e.target.value
                            )
                          }
                        />
                      </Col>
                      <Col md={5}>
                        <Form.Label className="small text-secondary">
                          Validity To
                        </Form.Label>
                        <Form.Control
                          type="datetime-local"
                          className="rounded-3"
                          value={normaliseDateTime(v.validityTo)}
                          min={getMinValidityToDate(v.validityFrom)}
                          onChange={(e) =>
                            handleNestedChange(
                              "validityPeriods",
                              index,
                              "validityTo",
                              e.target.value
                            )
                          }
                        />
                      </Col>
                      <Col md={2} className="text-end">
                        <Button
                          variant="outline-danger"
                          size="sm"
                          className="rounded-circle"
                          onClick={() =>
                            handleRemoveRow("validityPeriods", index)
                          }
                        >
                          <FaTrash />
                        </Button>
                      </Col>
                    </Row>
                  ))}
                  <Button
                    size="sm"
                    variant="outline-primary"
                    className="mt-2"
                    onClick={() =>
                      handleAddRow("validityPeriods", {
                        validityFrom: "",
                        validityTo: "",
                      })
                    }
                  >
                    <FaPlus className="me-1" /> Add Validity
                  </Button>
                </div>

                {/* Cancellation Policy */}
                <div className="border-top pt-4 mt-4">
                  <h6 className="fw-bold text-dark mb-3">Cancellation Policy</h6>
                  {policy.cancellationPolicy.map((c, index) => (
                    <Row
                      key={index}
                      className="align-items-center mb-3 bg-light p-3 rounded-3"
                    >
                      <Col md={12}>
                        <Form.Label className="fw-semibold small">
                          Cancellation fee of
                        </Form.Label>
                        <div className="d-flex align-items-center flex-wrap gap-2 mt-1">
                          <Form.Control
                            type="number"
                            style={{ width: "120px" }}
                            value={c.cancellationFee}
                            onChange={(e) =>
                              handleNestedChange(
                                "cancellationPolicy",
                                index,
                                "cancellationFee",
                                e.target.value
                              )
                            }
                          />
                          <Form.Select
                            style={{ width: "90px" }}
                            value={c.cancellationFeeType}
                            onChange={(e) =>
                              handleNestedChange(
                                "cancellationPolicy",
                                index,
                                "cancellationFeeType",
                                e.target.value
                              )
                            }
                          >
                            <option value="PERCENT">%</option>
                            <option value="AMOUNT">Amt</option>
                          </Form.Select>
                          <span className="text-muted small">
                            of total booking if cancelled less than
                          </span>
                          <Form.Control
                            type="number"
                            style={{ width: "90px" }}
                            value={c.noOfNights}
                            onChange={(e) =>
                              handleNestedChange(
                                "cancellationPolicy",
                                index,
                                "noOfNights",
                                e.target.value
                              )
                            }
                          />
                          <span className="text-muted small">
                            days prior to arrival
                          </span>
                          <Button
                            size="sm"
                            variant="outline-primary"
                            className="rounded-circle"
                            onClick={() =>
                              handleAddRow("cancellationPolicy", {
                                cancellationFee: "",
                                cancellationFeeType: "PERCENT",
                                noOfNights: "",
                              })
                            }
                          >
                            <FaPlus />
                          </Button>
                          {policy.cancellationPolicy.length > 1 && (
                            <Button
                              size="sm"
                              variant="outline-danger"
                              className="rounded-circle"
                              onClick={() =>
                                handleRemoveRow("cancellationPolicy", index)
                              }
                            >
                              <FaTrash />
                            </Button>
                          )}
                        </div>
                      </Col>
                    </Row>
                  ))}
                </div>

                {/* Amendment Policy */}
                <div className="border-top pt-4 mt-4">
                  <h6 className="fw-bold text-dark mb-3">Amendment Policy</h6>
                  {policy.amendmentPolicy.map((a, index) => (
                    <Row
                      key={index}
                      className="align-items-center mb-3 bg-light p-3 rounded-3"
                    >
                      <Col md={12}>
                        <Form.Label className="fw-semibold small">
                          Amendment fee of
                        </Form.Label>
                        <div className="d-flex align-items-center flex-wrap gap-2 mt-1">
                          <Form.Control
                            type="number"
                            style={{ width: "120px" }}
                            value={a.amendmentFee}
                            onChange={(e) =>
                              handleNestedChange(
                                "amendmentPolicy",
                                index,
                                "amendmentFee",
                                e.target.value
                              )
                            }
                          />
                          <Form.Select
                            style={{ width: "90px" }}
                            value={a.amendmentFeeType}
                            onChange={(e) =>
                              handleNestedChange(
                                "amendmentPolicy",
                                index,
                                "amendmentFeeType",
                                e.target.value
                              )
                            }
                          >
                            <option value="PERCENT">%</option>
                            <option value="AMOUNT">Amt</option>
                          </Form.Select>
                          <span className="text-muted small">
                            of total booking if changed less than
                          </span>
                          <Form.Control
                            type="number"
                            style={{ width: "90px" }}
                            value={a.noOfNights}
                            onChange={(e) =>
                              handleNestedChange(
                                "amendmentPolicy",
                                index,
                                "noOfNights",
                                e.target.value
                              )
                            }
                          />
                          <span className="text-muted small">
                            days before arrival
                          </span>
                          <Button
                            size="sm"
                            variant="outline-primary"
                            className="rounded-circle"
                            onClick={() =>
                              handleAddRow("amendmentPolicy", {
                                amendmentFee: "",
                                amendmentFeeType: "PERCENT",
                                noOfNights: "",
                              })
                            }
                          >
                            <FaPlus />
                          </Button>
                          {policy.amendmentPolicy.length > 1 && (
                            <Button
                              size="sm"
                              variant="outline-danger"
                              className="rounded-circle"
                              onClick={() =>
                                handleRemoveRow("amendmentPolicy", index)
                              }
                            >
                              <FaTrash />
                            </Button>
                          )}
                        </div>
                      </Col>
                    </Row>
                  ))}
                </div>

                {/* Child Policy */}
                <div className="border-top pt-4 mt-4">
                  <h6 className="fw-bold text-dark mb-3">Child Policy</h6>
                  <div className="border rounded p-3 bg-light mb-3">
                    {policy.childPolicy.map((c, index) => (
                      <div
                        key={index}
                        className="d-flex align-items-center gap-2 mb-2"
                      >
                        <Form.Control
                          type="text"
                          className="rounded-3"
                          value={c.policyText}
                          onChange={(e) =>
                            handleNestedChange(
                              "childPolicy",
                              index,
                              "policyText",
                              e.target.value
                            )
                          }
                        />
                        <Button
                          size="sm"
                          variant="outline-primary"
                          className="rounded-circle"
                          onClick={() =>
                            handleAddRow("childPolicy", { policyText: "" })
                          }
                        >
                          <FaPlus />
                        </Button>
                        {policy.childPolicy.length > 1 && (
                          <Button
                            size="sm"
                            variant="outline-danger"
                            className="rounded-circle"
                            onClick={() =>
                              handleRemoveRow("childPolicy", index)
                            }
                          >
                            <FaTrash />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Additional Policy */}
                <div className="border-top pt-4 mt-4">
                  <h6 className="fw-bold text-dark mb-3">Additional Policies</h6>
                  <div className="border rounded-3 p-4 bg-light">
                    {[
                      {
                        label: "No-Show (All Seasons)",
                        field: "noShowFee",
                        type: "noShowFeeType",
                      },
                      {
                        label: "Early Departure (All Seasons)",
                        field: "earlyDepartureFee",
                        type: "earlyDepartureFeeType",
                      },
                      {
                        label: "Non-Refundable (All Seasons)",
                        field: "nonRefundableFee",
                        type: "nonRefundableFeeType",
                      },
                    ].map((item, i) => (
                      <div
                        key={i}
                        className="d-flex align-items-center flex-wrap gap-2 mb-3"
                      >
                        <Form.Label
                          className="fw-semibold small mb-0 text-secondary"
                          style={{ minWidth: "200px" }}
                        >
                          {item.label}
                        </Form.Label>
                        <Form.Control
                          type="number"
                          className="rounded-3"
                          style={{ width: "120px" }}
                          value={policy.additionalPolicy[item.field]}
                          onChange={(e) =>
                            handleAdditionalChange(item.field, e.target.value)
                          }
                        />
                        <Form.Select
                          value={policy.additionalPolicy[item.type]}
                          className="rounded-3"
                          style={{ width: "90px" }}
                          onChange={(e) =>
                            handleAdditionalChange(item.type, e.target.value)
                          }
                        >
                          <option value="PERCENT">%</option>
                          <option value="AMOUNT">Amt</option>
                        </Form.Select>
                        <span className="text-muted small">
                          charge on total booking without exception.
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Buttons */}
                <div className="d-flex justify-content-end gap-3 mt-5 pt-3 border-top">
                  <Button
                    variant="outline-danger"
                    className="px-4 rounded-pill"
                    // onClick={() => navigate(`/registration/hotel/${id}/policy`)}
                    onClick={() =>  navigate(-1)}
                    
                  >
                    ✖ Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="success"
                    className="px-4 rounded-pill"
                    disabled={saving}
                  >
                    {saving ? (
                      <Spinner size="sm" animation="border" />
                    ) : (
                      <>
                        <FaSave className="me-2" /> Update
                      </>
                    )}
                  </Button>
                </div>
              </Form>
            </Card>
          </Container>
        </main>
      </div>
    </div>
  );
};

export default PolicyUpdate;
