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

const PolicyCreate = () => {
  const { id } = useParams(); // hotelId
  const navigate = useNavigate();

  const [marketTypes, setMarketTypes] = useState([]);
  const [loadingMarkets, setLoadingMarkets] = useState(false);

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

  const handleRemoveRow = (section, index) => {
    const updated = formData[section].filter((_, i) => i !== index);
    setFormData({ ...formData, [section]: updated });
  };

  // ✅ Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.policyCode.trim()) {
      toast.error("Policy Code is required!");
      return;
    }

    const payload = {
      hotelId: parseInt(id),
      ...formData,
    };

    try {
      await axiosInstance.post("/api/hotelPolicy/register", payload);
      toast.success("Policy created successfully!");
      navigate(`/registration/hotel/${id}/policy`);
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
          <Button variant="outline-secondary" className="rounded-pill px-3" onClick={() => navigate(-1)}>
            <FaArrowLeft className="me-2" /> Back
          </Button>
          <h4 className="fw-semibold text-dark mb-0">Save Policy Details</h4>
        </div>

        <Card className="shadow-sm border-0 p-4 rounded-4 bg-white">
          <Form onSubmit={handleSubmit}>
            {/* Policy Info */}
            <Row className="mb-4">
              <Col md={4}>
                <Form.Group>
                  <Form.Label className="fw-semibold small text-secondary">Policy Code *</Form.Label>
                  <Form.Control
                    type="text"
                    className="rounded-3"
                    value={formData.policyCode}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        policyCode: e.target.value,
                      })
                    }
                    placeholder="Enter policy code"
                  />
                </Form.Group>
              </Col>

              <Col md={4}>
                <Form.Group>
                  <Form.Label className="fw-semibold small text-secondary">Market Type</Form.Label>
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
                      <option value="0">All Market</option>
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
                  <Form.Label className="fw-semibold small text-secondary">Remarks</Form.Label>
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
                      <Form.Label className="small text-secondary">Validity From</Form.Label>
                      <Form.Control
                        type="date"
                        className="rounded-3"
                        value={v.validityFrom}
                        onChange={(e) =>
                          handleArrayChange("validityPeriods", index, "validityFrom", e.target.value)
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col md={5}>
                    <Form.Group>
                      <Form.Label className="small text-secondary">Validity To</Form.Label>
                      <Form.Control
                        type="date"
                        className="rounded-3"
                        value={v.validityTo}
                        onChange={(e) =>
                          handleArrayChange("validityPeriods", index, "validityTo", e.target.value)
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col md={2} className="text-end">
                    <Button
                      variant="outline-danger"
                      size="sm"
                      className="rounded-circle"
                      onClick={() => handleRemoveRow("validityPeriods", index)}
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
              {formData.cancellationPolicy.map((c, index) => (
                <Row key={index} className="align-items-center mb-3 bg-light p-3 rounded-3">
                  <Col md={12}>
                    <Form.Label className="fw-semibold small">Cancellation fee of</Form.Label>
                    <div className="d-flex align-items-center flex-wrap gap-2 mt-1">
                      <Form.Control
                        type="number"
                        placeholder="Fee"
                        value={c.cancellationFee}
                        onChange={(e) =>
                          handleArrayChange("cancellationPolicy", index, "cancellationFee", e.target.value)
                        }
                        style={{ width: "120px" }}
                      />
                      <Form.Select
                        value={c.cancellationFeeType}
                        onChange={(e) =>
                          handleArrayChange("cancellationPolicy", index, "cancellationFeeType", e.target.value)
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
                          handleArrayChange("cancellationPolicy", index, "noOfNights", e.target.value)
                        }
                        style={{ width: "90px" }}
                      />
                      <span className="text-muted small">days prior to arrival</span>
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
                          onClick={() => handleRemoveRow("cancellationPolicy", index)}
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
                <Row key={index} className="align-items-center mb-3 bg-light p-3 rounded-3">
                  <Col md={12}>
                    <Form.Label className="fw-semibold small">Amendment fee of</Form.Label>
                    <div className="d-flex align-items-center flex-wrap gap-2 mt-1">
                      <Form.Control
                        type="number"
                        placeholder="Fee"
                        value={a.amendmentFee}
                        onChange={(e) =>
                          handleArrayChange("amendmentPolicy", index, "amendmentFee", e.target.value)
                        }
                        style={{ width: "120px" }}
                      />
                      <Form.Select
                        value={a.amendmentFeeType}
                        onChange={(e) =>
                          handleArrayChange("amendmentPolicy", index, "amendmentFeeType", e.target.value)
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
                          handleArrayChange("amendmentPolicy", index, "noOfNights", e.target.value)
                        }
                        style={{ width: "90px" }}
                      />
                      <span className="text-muted small">days before arrival</span>
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
                          onClick={() => handleRemoveRow("amendmentPolicy", index)}
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
                  <div key={index} className="d-flex align-items-center gap-2 mb-2">
                    <Form.Control
                      type="text"
                      className="rounded-3"
                      placeholder="Enter child policy text"
                      value={c.policyText}
                      onChange={(e) =>
                        handleArrayChange("childPolicy", index, "policyText", e.target.value)
                      }
                    />
                    <Button
                      size="sm"
                      variant="outline-primary"
                      className="rounded-circle"
                      onClick={() => handleAddRow("childPolicy", { policyText: "" })}
                    >
                      <FaPlus />
                    </Button>
                    {formData.childPolicy.length > 1 && (
                      <Button
                        size="sm"
                        variant="outline-danger"
                        className="rounded-circle"
                        onClick={() => handleRemoveRow("childPolicy", index)}
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
  <h6 className="fw-bold text-dark mb-3">Additional Policies</h6>
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
        onChange={(e) => handleAdditionalChange("noShowFee", e.target.value)}
      />
      <Form.Select
        value={formData.additionalPolicy.noShowFeeType}
        className="rounded-3"
        style={{ width: "90px" }}
        onChange={(e) =>
          handleAdditionalChange("noShowFeeType", e.target.value)
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
          handleAdditionalChange("earlyDepartureFee", e.target.value)
        }
      />
      <Form.Select
        value={formData.additionalPolicy.earlyDepartureFeeType}
        className="rounded-3"
        style={{ width: "90px" }}
        onChange={(e) =>
          handleAdditionalChange("earlyDepartureFeeType", e.target.value)
        }
      >
        <option value="PERCENT">%</option>
        <option value="AMOUNT">Amt</option>
      </Form.Select>
      <span className="text-muted small">
        of the booked period will be charged if the guest departs early.
        Advance payments are non-refundable.
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
          handleAdditionalChange("nonRefundableFee", e.target.value)
        }
      />
      <Form.Select
        value={formData.additionalPolicy.nonRefundableFeeType}
        className="rounded-3"
        style={{ width: "90px" }}
        onChange={(e) =>
          handleAdditionalChange("nonRefundableFeeType", e.target.value)
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
                onClick={() => navigate(`/registration/hotel/${id}/policy`)}
              >
                ✖ Cancel
              </Button>
              <Button type="submit" variant="success" className="px-4 rounded-pill">
                ✅ Create
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

export default PolicyCreate;

