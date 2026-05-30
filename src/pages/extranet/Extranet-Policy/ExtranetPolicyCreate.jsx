import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Container,
  Row,
  Col,
  Form,
  Button,
  Card,
  InputGroup,
  Spinner,
} from "react-bootstrap";
import { FaArrowLeft, FaPlus, FaTrash } from "react-icons/fa";
import axiosInstance from "../../../components/AxiosInstance";
import Sidebar from "../../../components/Sidebar";
import Topbar from "../../../components/TopBar";
import { toast } from "react-hot-toast";

const ExtranetPolicyCreate = () => {
  const { id } = useParams(); // hotelId
  const navigate = useNavigate();

  const [marketTypes, setMarketTypes] = useState([]);
  const [loadingMarkets, setLoadingMarkets] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  const [formData, setFormData] = useState({
    policyCode: "",
    marketTypeId: [0], // Default "All Market"
    validityPeriods: [{ validityFrom: "", validityTo: "" }],
    cancellationPolicy: [
      { cancellationFee: "", cancellationFeeType: "PERCENT", noOfNights: "" },
    ],
    amendmentPolicy: [
      { amendmentFee: "", amendmentFeeType: "PERCENT", noOfNights: "" },
    ],
    childPolicy: [{ policyText: "" }],
    additionalPolicy: {
      noShowFee: "",
      noShowFeeType: "PERCENT",
      earlyDepartureFee: "",
      earlyDepartureFeeType: "PERCENT",
      nonRefundableFee: "",
      nonRefundableFeeType: "PERCENT",
    },
    remarks: "",
    live: true,
  });

  // ✅ Fetch Market Types
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

  useEffect(() => {
    fetchMarketTypes();
  }, []);

  // ✅ Update array fields
  const handleArrayChange = (section, index, field, value) => {
    const updated = [...formData[section]];
    updated[index][field] = value;
    setFormData({ ...formData, [section]: updated });
  };

  // ✅ Helper function to get minimum date for Validity To (From date + 1 minute)
  const getMinValidityToDate = (fromDate) => {
    if (!fromDate) return "";
    const date = new Date(fromDate);
    date.setMinutes(date.getMinutes() + 1); // Add 1 minute
    return date.toISOString().slice(0, 16);
  };

  // ✅ Update additional policy fields
  const handleAdditionalChange = (field, value) => {
    setFormData({
      ...formData,
      additionalPolicy: { ...formData.additionalPolicy, [field]: value },
    });
  };

  // ✅ Add & Remove Row
  const handleAddRow = (section, obj) => {
    setFormData({ ...formData, [section]: [...formData[section], obj] });
  };

  // ✅ Validation function
  const validateForm = () => {
    // Initialize validation errors
    const newErrors = {};
    let hasErrors = false;

    // Validate Policy Code
    if (!formData.policyCode || formData.policyCode.trim() === "") {
      newErrors.policyCode = "Policy Code is required";
      hasErrors = true;
    } else if (formData.policyCode.trim().length < 3) {
      newErrors.policyCode = "Policy Code must be at least 3 characters long";
      hasErrors = true;
    } else if (!/^[A-Za-z0-9_-]+$/.test(formData.policyCode.trim())) {
      newErrors.policyCode =
        "Policy Code can only contain letters, numbers, hyphens, and underscores";
      hasErrors = true;
    }

    // Validate Validity Dates - First period is required
    const firstPeriod = formData.validityPeriods[0];
    if (!firstPeriod.validityFrom || firstPeriod.validityFrom.trim() === "") {
      newErrors.validityFrom_0 = "Validity From date is required";
      hasErrors = true;
    }
    if (!firstPeriod.validityTo || firstPeriod.validityTo.trim() === "") {
      newErrors.validityTo_0 = "Validity To date is required";
      hasErrors = true;
    }

    // Additional validation for validity dates if they exist
    if (firstPeriod.validityFrom && firstPeriod.validityTo) {
      const fromDate = new Date(firstPeriod.validityFrom);
      const toDate = new Date(firstPeriod.validityTo);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (fromDate < today) {
        newErrors.validityFrom_0 = "Validity From date cannot be in the past";
        hasErrors = true;
      }
      if (toDate < today) {
        newErrors.validityTo_0 = "Validity To date cannot be in the past";
        hasErrors = true;
      }
      if (toDate <= fromDate) {
        newErrors.validityTo_0 =
          "Validity To date must be after Validity From date";
        hasErrors = true;
      }
    }

    return { newErrors, hasErrors };
  };

  const handleRemoveRow = (section, index) => {
    const updated = formData[section].filter((_, i) => i !== index);
    setFormData({ ...formData, [section]: updated });
  };

  // ✅ Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate form using the separate validation function
    const { newErrors, hasErrors } = validateForm();

    // If there are validation errors, show them and return
    if (hasErrors) {
      setValidationErrors(newErrors);
      return;
    }

    // Clear any existing errors
    setValidationErrors({});

    const payload = {
      hotelId: parseInt(id),
      ...formData,
      validityPeriods: formData.validityPeriods.map((period) => ({
        ...period,
        validityFrom: period.validityFrom && period.validityFrom.length === 16 
          ? `${period.validityFrom}:00` 
          : period.validityFrom,
        validityTo: period.validityTo && period.validityTo.length === 16 
          ? `${period.validityTo}:00` 
          : period.validityTo,
      })),
    };

    try {
      const response = await axiosInstance.post(
        "/api/hotelPolicy/register",
        payload,
      );
      if (response && response !== 0) {
        toast.success("Policy created successfully!");
        navigate(`/extranet/${id}/policy`);
      } else {
        toast.error("Failed to save policy. Invalid policyId received.");
      }
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save policy.");
    }
  };

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
              <h4 className="fw-semibold text-dark mb-0">
                Save Extranet Policy Details
              </h4>
            </div>

            <Card className="shadow-sm border-0 p-4 rounded-4 bg-white">
              <Form onSubmit={handleSubmit}>
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
                        value={formData.policyCode}
                        onChange={(e) => {
                          const value = e.target.value;
                          setFormData({
                            ...formData,
                            policyCode: value,
                          });
                          // Clear error when user starts typing
                          if (validationErrors.policyCode) {
                            setValidationErrors({
                              ...validationErrors,
                              policyCode: "",
                            });
                          }
                        }}
                        placeholder="Enter policy code (e.g., POL-001)"
                        isInvalid={!!validationErrors.policyCode}
                        maxLength={50}
                      />
                      {validationErrors.policyCode && (
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.policyCode}
                        </Form.Control.Feedback>
                      )}
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
                          style={{ height: "38px" }}
                          value={formData.marketTypeId[0] || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              marketTypeId: [parseInt(e.target.value)],
                            })
                          }
                        >
                          <option value="0">SELECT</option>
                          <option value="100">All Market</option>
                          {marketTypes.map((m) => (
                            <option key={m.marketTypeId} value={m.marketTypeId}>
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
                        value={formData.remarks}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            remarks: e.target.value,
                          })
                        }
                        placeholder="Remarks"
                      />
                    </Form.Group>
                  </Col>
                </Row>

                {/* Validity Period */}
                <div className="border-top pt-4 mt-3">
                  <h6 className="fw-bold text-dark mb-3">Validity List</h6>
                  {formData.validityPeriods.map((v, index) => (
                    <Row key={index} className="align-items-end mb-2 g-2">
                      <Col md={5}>
                        <Form.Group>
                          <Form.Label className="small text-secondary">
                            Validity From {index === 0 ? "*" : ""}
                          </Form.Label>
                          <Form.Control
                            type="datetime-local"
                            className="rounded-3"
                            value={v.validityFrom}
                            onChange={(e) => {
                              const value = e.target.value;
                              handleArrayChange(
                                "validityPeriods",
                                index,
                                "validityFrom",
                                value,
                              );

                              // Clear Validity To if it becomes invalid (before or equal to From date)
                              const currentToDate =
                                formData.validityPeriods[index].validityTo;
                              if (
                                currentToDate &&
                                value &&
                                new Date(currentToDate) <= new Date(value)
                              ) {
                                handleArrayChange(
                                  "validityPeriods",
                                  index,
                                  "validityTo",
                                  "",
                                );
                              }

                              // Clear errors immediately when user selects a date
                              setValidationErrors((prev) => {
                                const updated = { ...prev };
                                if (value && value.trim() !== "") {
                                  delete updated[`validityFrom_${index}`];
                                }
                                return updated;
                              });
                            }}
                            isInvalid={
                              !!validationErrors[`validityFrom_${index}`]
                            }
                          />
                          {validationErrors[`validityFrom_${index}`] && (
                            <Form.Control.Feedback type="invalid">
                              {validationErrors[`validityFrom_${index}`]}
                            </Form.Control.Feedback>
                          )}
                        </Form.Group>
                      </Col>
                      <Col md={5}>
                        <Form.Group>
                          <Form.Label className="small text-secondary">
                            Validity To {index === 0 ? "*" : ""}
                          </Form.Label>
                          <Form.Control
                            type="datetime-local"
                            className="rounded-3"
                            value={v.validityTo}
                            min={getMinValidityToDate(v.validityFrom)}
                            onChange={(e) => {
                              const value = e.target.value;
                              handleArrayChange(
                                "validityPeriods",
                                index,
                                "validityTo",
                                value,
                              );

                              // Clear errors immediately when user selects a date
                              setValidationErrors((prev) => {
                                const updated = { ...prev };
                                if (value && value.trim() !== "") {
                                  delete updated[`validityTo_${index}`];
                                }
                                return updated;
                              });
                            }}
                            isInvalid={
                              !!validationErrors[`validityTo_${index}`]
                            }
                          />
                          {validationErrors[`validityTo_${index}`] && (
                            <Form.Control.Feedback type="invalid">
                              {validationErrors[`validityTo_${index}`]}
                            </Form.Control.Feedback>
                          )}
                        </Form.Group>
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
                  <h6 className="fw-bold text-dark mb-3">
                    Cancellation Policy
                  </h6>
                  {formData.cancellationPolicy.map((c, index) => (
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
                            placeholder="Fee"
                            value={c.cancellationFee}
                            onChange={(e) =>
                              handleArrayChange(
                                "cancellationPolicy",
                                index,
                                "cancellationFee",
                                e.target.value,
                              )
                            }
                            style={{ width: "120px" }}
                          />
                          <Form.Select
                            value={c.cancellationFeeType}
                            onChange={(e) =>
                              handleArrayChange(
                                "cancellationPolicy",
                                index,
                                "cancellationFeeType",
                                e.target.value,
                              )
                            }
                            style={{ width: "90px" }}
                          >
                            <option value="PERCENT">%</option>
                            <option value="AMOUNT">Amt</option>
                          </Form.Select>
                          <span className="text-muted small">
                            of total booking if cancelled less than
                          </span>
                          <Form.Control
                            type="number"
                            placeholder="Days"
                            value={c.noOfNights}
                            onChange={(e) =>
                              handleArrayChange(
                                "cancellationPolicy",
                                index,
                                "noOfNights",
                                e.target.value,
                              )
                            }
                            style={{ width: "90px" }}
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
                          {formData.cancellationPolicy.length > 1 && (
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
                  {formData.amendmentPolicy.map((a, index) => (
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
                            placeholder="Fee"
                            value={a.amendmentFee}
                            onChange={(e) =>
                              handleArrayChange(
                                "amendmentPolicy",
                                index,
                                "amendmentFee",
                                e.target.value,
                              )
                            }
                            style={{ width: "120px" }}
                          />
                          <Form.Select
                            value={a.amendmentFeeType}
                            onChange={(e) =>
                              handleArrayChange(
                                "amendmentPolicy",
                                index,
                                "amendmentFeeType",
                                e.target.value,
                              )
                            }
                            style={{ width: "90px" }}
                          >
                            <option value="PERCENT">%</option>
                            <option value="AMOUNT">Amt</option>
                          </Form.Select>
                          <span className="text-muted small">
                            of total booking if changed less than
                          </span>
                          <Form.Control
                            type="number"
                            placeholder="Days"
                            value={a.noOfNights}
                            onChange={(e) =>
                              handleArrayChange(
                                "amendmentPolicy",
                                index,
                                "noOfNights",
                                e.target.value,
                              )
                            }
                            style={{ width: "90px" }}
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
                          {formData.amendmentPolicy.length > 1 && (
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
                    {formData.childPolicy.map((c, index) => (
                      <div
                        key={index}
                        className="d-flex align-items-center gap-2 mb-2"
                      >
                        <Form.Control
                          type="text"
                          className="rounded-3"
                          placeholder="Enter child policy text"
                          value={c.policyText}
                          onChange={(e) =>
                            handleArrayChange(
                              "childPolicy",
                              index,
                              "policyText",
                              e.target.value,
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
                        {formData.childPolicy.length > 1 && (
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
                {/* Additional Policy */}
                <div className="border-top pt-4 mt-4">
                  <h6 className="fw-bold text-dark mb-3">
                    Additional Policies
                  </h6>
                  <div className="border rounded-3 p-4 bg-light">
                    {/* No Show */}
                    <div className="d-flex align-items-center flex-wrap gap-2 mb-3">
                      <Form.Label
                        className="fw-semibold small mb-0 text-secondary"
                        style={{ minWidth: "200px" }}
                      >
                        No-Show (All Seasons)
                      </Form.Label>
                      <Form.Control
                        type="number"
                        className="rounded-3"
                        style={{ width: "120px" }}
                        value={formData.additionalPolicy.noShowFee}
                        onChange={(e) =>
                          handleAdditionalChange("noShowFee", e.target.value)
                        }
                      />
                      <Form.Select
                        value={formData.additionalPolicy.noShowFeeType}
                        className="rounded-3"
                        style={{ width: "90px" }}
                        onChange={(e) =>
                          handleAdditionalChange(
                            "noShowFeeType",
                            e.target.value,
                          )
                        }
                      >
                        <option value="PERCENT">%</option>
                        <option value="AMOUNT">Amt</option>
                      </Form.Select>
                      <span className="text-muted small">
                        charge on total booking without exception.
                      </span>
                    </div>

                    {/* Early Departure */}
                    <div className="d-flex align-items-center flex-wrap gap-2 mb-3">
                      <Form.Label
                        className="fw-semibold small mb-0 text-secondary"
                        style={{ minWidth: "200px" }}
                      >
                        Early Departure (All Seasons)
                      </Form.Label>
                      <Form.Control
                        type="number"
                        className="rounded-3"
                        style={{ width: "120px" }}
                        value={formData.additionalPolicy.earlyDepartureFee}
                        onChange={(e) =>
                          handleAdditionalChange(
                            "earlyDepartureFee",
                            e.target.value,
                          )
                        }
                      />
                      <Form.Select
                        value={formData.additionalPolicy.earlyDepartureFeeType}
                        className="rounded-3"
                        style={{ width: "90px" }}
                        onChange={(e) =>
                          handleAdditionalChange(
                            "earlyDepartureFeeType",
                            e.target.value,
                          )
                        }
                      >
                        <option value="PERCENT">%</option>
                        <option value="AMOUNT">Amt</option>
                      </Form.Select>
                      <span className="text-muted small">
                        of the booked period will be charged if the guest
                        departs early. Advance payments are non-refundable.
                      </span>
                    </div>

                    {/* Non Refundable */}
                    <div className="d-flex align-items-center flex-wrap gap-2">
                      <Form.Label
                        className="fw-semibold small mb-0 text-secondary"
                        style={{ minWidth: "200px" }}
                      >
                        Non-Refundable (All Seasons)
                      </Form.Label>
                      <Form.Control
                        type="number"
                        className="rounded-3"
                        style={{ width: "120px" }}
                        value={formData.additionalPolicy.nonRefundableFee}
                        onChange={(e) =>
                          handleAdditionalChange(
                            "nonRefundableFee",
                            e.target.value,
                          )
                        }
                      />
                      <Form.Select
                        value={formData.additionalPolicy.nonRefundableFeeType}
                        className="rounded-3"
                        style={{ width: "90px" }}
                        onChange={(e) =>
                          handleAdditionalChange(
                            "nonRefundableFeeType",
                            e.target.value,
                          )
                        }
                      >
                        <option value="PERCENT">%</option>
                        <option value="AMOUNT">Amt</option>
                      </Form.Select>
                      <span className="text-muted small">
                        charge of total booking without exception.
                      </span>
                    </div>
                  </div>
                </div>

                {/* Buttons */}
                <div className="d-flex justify-content-end gap-3 mt-5 pt-3 border-top">
                  <Button
                    variant="outline-danger"
                    className="px-4 rounded-pill"
                    onClick={() => navigate(`/extranet/${id}/policy`)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="success"
                    className="px-4 rounded-pill"
                  >
                    Create
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

export default ExtranetPolicyCreate;
