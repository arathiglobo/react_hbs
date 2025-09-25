import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  Button,
  Table,
  Modal,
  Form,
  Pagination,
  Row,
  Col,
} from "react-bootstrap";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import axios from "axios";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";
import { FaEdit, FaTrash, FaEye, FaPlus, FaDollarSign } from "react-icons/fa";

const CabRates = () => {
  const navigate = useNavigate();
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [isViewMode, setIsViewMode] = useState(false);
  const [search, setSearch] = useState("");
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Rate Grid state
  const [rateGridRows, setRateGridRows] = useState([
    {
      id: 1,
      minPax: "",
      maxPax: "",
      location: "",
      sicPerWay: "",
      privatePerWay: "",
      luggage: false,
      type: "",
      hours: "",
    }
  ]);
  
  // Validity dates state
  const [validityDates, setValidityDates] = useState([
    {
      id: 1,
      validityFrom: "",
      validityTo: "",
    }
  ]);

  const openCreate = () => {
    setEditing(null);
    setIsViewMode(false);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setIsViewMode(false);
  };

  // Add new rate grid row
  const addRateGridRow = () => {
    const newRow = {
      id: Date.now(),
      minPax: "",
      maxPax: "",
      location: "",
      sicPerWay: "",
      privatePerWay: "",
      luggage: false,
      type: "",
      hours: "",
    };
    setRateGridRows([...rateGridRows, newRow]);
  };

  // Remove rate grid row
  const removeRateGridRow = (id) => {
    if (rateGridRows.length > 1) {
      setRateGridRows(rateGridRows.filter(row => row.id !== id));
    }
  };

  // Update rate grid row
  const updateRateGridRow = (id, field, value) => {
    setRateGridRows(rateGridRows.map(row => 
      row.id === id ? { ...row, [field]: value } : row
    ));
  };

  // Add new validity date range
  const addValidityDate = () => {
    const newDate = {
      id: Date.now(),
      validityFrom: "",
      validityTo: "",
    };
    setValidityDates([...validityDates, newDate]);
  };

  // Remove validity date range
  const removeValidityDate = (id) => {
    if (validityDates.length > 1) {
      setValidityDates(validityDates.filter(date => date.id !== id));
    }
  };

  // Update validity date
  const updateValidityDate = (id, field, value) => {
    setValidityDates(validityDates.map(date => 
      date.id === id ? { ...date, [field]: value } : date
    ));
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Card className="shadow-sm rounded-xl">
            <Card.Header className="d-flex justify-content-between align-items-center">
              <div>
                <Button
                  variant="outline-secondary"
                  onClick={() => navigate("/registration/cabProvider")}
                  className="mb-2 me-3"
                  size="sm"
                >
                  <FaDollarSign className="me-2" />
                  Back to Cab Providers
                </Button>
                <span className="fw-semibold">
                  <FaDollarSign className="me-2 text-success" />
                  Cab Rates
                </span>
              </div>
              <Button 
                className="btn-green" 
                onClick={() => {
                  console.log("Opening modal...");
                  alert("Button clicked! Opening modal...");
                  openCreate();
                }}
                style={{ backgroundColor: 'red', borderColor: 'red' }}
              >
                + Create - TEST
              </Button>
            </Card.Header>
            <Card.Body className="p-0">
              {/* Debug Modal State */}
              <div className="alert alert-warning mb-3">
                <strong>Debug Info:</strong> Modal State: {showModal ? "TRUE" : "FALSE"} - Updated at {new Date().toLocaleTimeString()}
              </div>
              <Table responsive hover striped className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th style={{ width: 100 }}>S/N</th>
                    <th>Rate Code</th>
                    <th>Cab Provider</th>
                    <th>Cab</th>
                    <th>Market</th>
                    <th>Validity From</th>
                    <th>Validity To</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan="8" className="text-center text-muted py-4">
                      No rates found. Click "Create" to add new rates.
                    </td>
                  </tr>
                </tbody>
              </Table>
            </Card.Body>
          </Card>

          {/* Modal with exact fields from screenshot */}
          <Modal show={showModal} onHide={closeModal} centered size="xl">
            <Modal.Header closeButton>
              <Modal.Title>Save Cab Rate</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <div className="alert alert-success mb-3">
                <strong>Modal is working!</strong> You should see all the form fields below.
              </div>
              
              <Form>
                {/* Main Form Fields - Matching Screenshot */}
                <Row>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>Cab *</Form.Label>
                      <Form.Select>
                        <option value="">SELECT</option>
                        <option value="Alto">Alto</option>
                        <option value="Swift">Swift</option>
                        <option value="Innova">Innova</option>
                        <option value="Fortuner">Fortuner</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>Rate code *</Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="Enter rate code"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>Market *</Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="Click to Choose..."
                      />
                    </Form.Group>
                  </Col>
                </Row>

                {/* Multiple Validity Date Ranges */}
                <div className="mb-3">
                  <h6 className="text-muted mb-3">Validity Periods</h6>
                  {validityDates.map((date, index) => (
                    <Row key={date.id} className="mb-2">
                      <Col md={5}>
                        <Form.Group>
                          <Form.Label>Validity From *</Form.Label>
                          <Form.Control 
                            type="date" 
                            value={date.validityFrom}
                            onChange={(e) => updateValidityDate(date.id, 'validityFrom', e.target.value)}
                          />
                        </Form.Group>
                      </Col>
                      <Col md={5}>
                        <Form.Group>
                          <Form.Label>Validity To *</Form.Label>
                          <Form.Control 
                            type="date" 
                            value={date.validityTo}
                            onChange={(e) => updateValidityDate(date.id, 'validityTo', e.target.value)}
                          />
                        </Form.Group>
                      </Col>
                      <Col md={2}>
                        <div className="d-flex gap-1 mt-4">
                          <Button 
                            variant="outline-primary" 
                            size="sm"
                            onClick={addValidityDate}
                            title="Add Validity Period"
                          >
                            <FaPlus size={10} />
                          </Button>
                          {validityDates.length > 1 && (
                            <Button 
                              variant="outline-danger" 
                              size="sm"
                              onClick={() => removeValidityDate(date.id)}
                              title="Remove Validity Period"
                            >
                              <FaTrash size={10} />
                            </Button>
                          )}
                        </div>
                      </Col>
                    </Row>
                  ))}
                </div>

                {/* Rate Grid Section */}
                <div className="border-top pt-3 mt-3">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 className="text-muted mb-0">Rate Grid</h6>
                    <Button 
                      variant="outline-primary" 
                      size="sm"
                      onClick={addRateGridRow}
                      title="Add Rate Grid Row"
                    >
                      <FaPlus className="me-2" />
                      Add Row
                    </Button>
                  </div>
                  <div className="table-responsive">
                    <Table striped bordered hover size="sm">
                      <thead className="table-light">
                        <tr>
                          <th>Min Pax</th>
                          <th>Max Pax</th>
                          <th>Location</th>
                          <th>SIC (Per Way)</th>
                          <th>Private (Per Way)</th>
                          <th>Luggage</th>
                          <th>Type</th>
                          <th>Hours</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rateGridRows.map((row, index) => (
                          <tr key={row.id}>
                            <td>
                              <Form.Control
                                type="number"
                                size="sm"
                                placeholder="Min"
                                value={row.minPax}
                                onChange={(e) => updateRateGridRow(row.id, 'minPax', e.target.value)}
                              />
                            </td>
                            <td>
                              <Form.Control
                                type="number"
                                size="sm"
                                placeholder="Max"
                                value={row.maxPax}
                                onChange={(e) => updateRateGridRow(row.id, 'maxPax', e.target.value)}
                              />
                            </td>
                            <td>
                              <Form.Select 
                                size="sm"
                                value={row.location}
                                onChange={(e) => updateRateGridRow(row.id, 'location', e.target.value)}
                              >
                                <option value="">Select an Option</option>
                                <option value="Airport">Airport</option>
                                <option value="Hotel">Hotel</option>
                                <option value="Station">Station</option>
                              </Form.Select>
                            </td>
                            <td>
                              <Form.Control
                                type="number"
                                size="sm"
                                placeholder="SIC Rate"
                                value={row.sicPerWay}
                                onChange={(e) => updateRateGridRow(row.id, 'sicPerWay', e.target.value)}
                              />
                            </td>
                            <td>
                              <Form.Control
                                type="number"
                                size="sm"
                                placeholder="Private Rate"
                                value={row.privatePerWay}
                                onChange={(e) => updateRateGridRow(row.id, 'privatePerWay', e.target.value)}
                              />
                            </td>
                            <td>
                              <Form.Check 
                                type="checkbox" 
                                checked={row.luggage}
                                onChange={(e) => updateRateGridRow(row.id, 'luggage', e.target.checked)}
                              />
                            </td>
                            <td>
                              <Form.Select 
                                size="sm"
                                value={row.type}
                                onChange={(e) => updateRateGridRow(row.id, 'type', e.target.value)}
                              >
                                <option value="">Select Type</option>
                                <option value="Airport">Airport</option>
                                <option value="Hotel">Hotel</option>
                                <option value="City">City</option>
                              </Form.Select>
                            </td>
                            <td>
                              <Form.Select 
                                size="sm"
                                value={row.hours}
                                onChange={(e) => updateRateGridRow(row.id, 'hours', e.target.value)}
                              >
                                <option value="">SELEC</option>
                                <option value="1">1 Hour</option>
                                <option value="2">2 Hours</option>
                                <option value="4">4 Hours</option>
                                <option value="8">8 Hours</option>
                                <option value="12">12 Hours</option>
                                <option value="24">24 Hours</option>
                              </Form.Select>
                            </td>
                            <td>
                              <div className="d-flex gap-1">
                                <Button 
                                  variant="outline-primary" 
                                  size="sm"
                                  onClick={addRateGridRow}
                                  title="Clone Row"
                                >
                                  <FaPlus size={10} />
                                </Button>
                                {rateGridRows.length > 1 && (
                                  <Button 
                                    variant="outline-danger" 
                                    size="sm"
                                    onClick={() => removeRateGridRow(row.id)}
                                    title="Remove Row"
                                  >
                                    <FaTrash size={10} />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </div>
              </Form>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="danger" onClick={closeModal}>
                <i className="fas fa-times me-2"></i>
                Cancel
              </Button>
              <Button variant="success" onClick={closeModal}>
                <i className="fas fa-arrow-right me-2"></i>
                Create
              </Button>
            </Modal.Footer>
          </Modal>
        </main>
      </div>
    </div>
  );
};

export default CabRates;