import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  Button,
  Table,
  Modal,
  Form,
  Row,
  Col,
  Tab,
  Tabs,
  FormCheck,
} from "react-bootstrap";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import { FaEdit, FaTrash, FaEye, FaPlus, FaBackward } from "react-icons/fa";

const PackageReg = () => {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [formData, setFormData] = useState({
    packageName: "",
    packageCode: "",
    packageBasicRate: "",
    currency: "",
    packageType: "",
    packageCategory: "",
    packageImage: null,
    include: {
      hotel: false,
      cab: false,
      activity: false,
    },
    status: "Enable",
    arrivedCountry: "",
    place: "",
    overview: "",
    noOfNights: "1",
  });

  const validateForm = (data) => {
    const errors = {};
    
    if (!data.packageName?.trim()) errors.packageName = "Package Name is required";
    if (!data.packageCode?.trim()) errors.packageCode = "Package Code is required";
    if (!data.packageBasicRate?.trim()) errors.packageBasicRate = "Package Basic Rate is required";
    if (!data.currency?.trim()) errors.currency = "Currency is required";
    if (!data.packageType?.trim()) errors.packageType = "Package Type is required";
    if (!data.packageCategory?.trim()) errors.packageCategory = "Package Category is required";
    if (!data.arrivedCountry?.trim()) errors.arrivedCountry = "Arrived Country is required";
    if (!data.place?.trim()) errors.place = "Place is required";
    if (!data.noOfNights?.trim()) errors.noOfNights = "No of nights is required";
    
    return errors;
  };

  const handleCreate = () => {
    setFormData({
      packageName: "",
      packageCode: "",
      packageBasicRate: "",
      currency: "",
      packageType: "",
      packageCategory: "",
      packageImage: null,
      include: {
        hotel: false,
        cab: false,
        activity: false,
      },
      status: "Enable",
      arrivedCountry: "",
      place: "",
      overview: "",
      noOfNights: "1",
    });
    setValidationErrors({});
    setShowModal(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    const errors = validateForm(formData);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    
    // Here you would add your save logic
    console.log("Form data:", formData);
    setShowModal(false);
  };

  const closeModal = () => {
    setShowModal(false);
    setValidationErrors({});
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
                  variant="outline-primary"
                  onClick={() => navigate("/registration")}
                  className="mb-2 me-3"
                  size="sm"
                >
                  <FaBackward className="me-2" />
                  Back to Registration
                </Button>
                <span className="fw-semibold">
                  <FaPlus className="me-2 text-success" />
                  Packages
                </span>
              </div>
              <Button className="btn-green" onClick={handleCreate}>
                + Create
              </Button>
            </Card.Header>
            <Card.Body className="p-0">
              <Table responsive hover striped className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th style={{ width: 100 }}>S/N</th>
                    <th>Package Name</th>
                    <th>No of nights</th>
                    <th style={{ width: 200 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>1</td>
                    <td>Family Package</td>
                    <td>4</td>
                    <td>
                      <div className="d-flex gap-2">
                        <FaEdit className="text-primary" style={{ cursor: "pointer", fontSize: "18px" }} />
                        <FaEye className="text-info" style={{ cursor: "pointer", fontSize: "18px" }} />
                        <FaTrash className="text-danger" style={{ cursor: "pointer", fontSize: "18px" }} />
                      </div>
                    </td>
                  </tr>
                </tbody>
              </Table>
            </Card.Body>
          </Card>

          <Modal show={showModal} onHide={closeModal} centered size="xl">
            <Modal.Header closeButton>
              <Modal.Title>Create Package</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Tabs defaultActiveKey="basic" id="package-tabs" className="mb-3">
                <Tab eventKey="basic" title="Basic Details">
                  <Form onSubmit={handleSave}>
                    <Row>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Package Name <span className="text-danger">*</span></Form.Label>
                          <Form.Control 
                            type="text" 
                            placeholder="Enter package name"
                            value={formData.packageName}
                            onChange={(e) => setFormData(prev => ({ ...prev, packageName: e.target.value }))}
                            isInvalid={!!validationErrors.packageName}
                          />
                          {validationErrors.packageName && (
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.packageName}
                            </Form.Control.Feedback>
                          )}
                        </Form.Group>
                        <Form.Group className="mb-3">
                          <Form.Label>Package Code <span className="text-danger">*</span></Form.Label>
                          <Form.Control 
                            type="text" 
                            placeholder="Enter package code"
                            value={formData.packageCode}
                            onChange={(e) => setFormData(prev => ({ ...prev, packageCode: e.target.value }))}
                            isInvalid={!!validationErrors.packageCode}
                          />
                          {validationErrors.packageCode && (
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.packageCode}
                            </Form.Control.Feedback>
                          )}
                        </Form.Group>
                        <Form.Group className="mb-3">
                          <Form.Label>Package Basic Rate <span className="text-danger">*</span></Form.Label>
                          <Form.Control 
                            type="number" 
                            placeholder="Enter basic rate"
                            value={formData.packageBasicRate}
                            onChange={(e) => setFormData(prev => ({ ...prev, packageBasicRate: e.target.value }))}
                            isInvalid={!!validationErrors.packageBasicRate}
                          />
                          {validationErrors.packageBasicRate && (
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.packageBasicRate}
                            </Form.Control.Feedback>
                          )}
                        </Form.Group>
                        <Form.Group className="mb-3">
                          <Form.Label>Currency <span className="text-danger">*</span></Form.Label>
                          <Form.Select
                            value={formData.currency}
                            onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                            isInvalid={!!validationErrors.currency}
                          >
                            <option value="">SELECT</option>
                            <option value="USD">USD</option>
                            <option value="EUR">EUR</option>
                            <option value="INR">INR</option>
                          </Form.Select>
                          {validationErrors.currency && (
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.currency}
                            </Form.Control.Feedback>
                          )}
                        </Form.Group>
                        <Form.Group className="mb-3">
                          <Form.Label>Package Type <span className="text-danger">*</span></Form.Label>
                          <Form.Select
                            value={formData.packageType}
                            onChange={(e) => setFormData(prev => ({ ...prev, packageType: e.target.value }))}
                            isInvalid={!!validationErrors.packageType}
                          >
                            <option value="">SELECT</option>
                            <option value="Domestic">Domestic</option>
                            <option value="International">International</option>
                          </Form.Select>
                          {validationErrors.packageType && (
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.packageType}
                            </Form.Control.Feedback>
                          )}
                        </Form.Group>
                        <Form.Group className="mb-3">
                          <Form.Label>Package Category <span className="text-danger">*</span></Form.Label>
                          <Form.Control 
                            type="text" 
                            placeholder="Click to Choose..."
                            value={formData.packageCategory}
                            onChange={(e) => setFormData(prev => ({ ...prev, packageCategory: e.target.value }))}
                            isInvalid={!!validationErrors.packageCategory}
                          />
                          {validationErrors.packageCategory && (
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.packageCategory}
                            </Form.Control.Feedback>
                          )}
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Package Image</Form.Label>
                          <Form.Control 
                            type="file" 
                            accept="image/*"
                            onChange={(e) => setFormData(prev => ({ ...prev, packageImage: e.target.files[0] }))}
                          />
                        </Form.Group>
                        <Form.Group className="mb-3">
                          <Form.Label>Include</Form.Label>
                          <FormCheck 
                            type="checkbox" 
                            label="Hotel" 
                            checked={formData.include.hotel}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              include: { ...prev.include, hotel: e.target.checked }
                            }))}
                          />
                          <FormCheck 
                            type="checkbox" 
                            label="Cab" 
                            checked={formData.include.cab}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              include: { ...prev.include, cab: e.target.checked }
                            }))}
                          />
                          <FormCheck 
                            type="checkbox" 
                            label="Activity" 
                            checked={formData.include.activity}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              include: { ...prev.include, activity: e.target.checked }
                            }))}
                          />
                        </Form.Group>
                        <Form.Group className="mb-3">
                          <Form.Label>Status</Form.Label>
                          <Form.Select
                            value={formData.status}
                            onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                          >
                            <option value="Enable">Enable</option>
                            <option value="Disable">Disable</option>
                          </Form.Select>
                        </Form.Group>
                        <Form.Group className="mb-3">
                          <Form.Label>Arrived Country <span className="text-danger">*</span></Form.Label>
                          <Form.Select
                            value={formData.arrivedCountry}
                            onChange={(e) => setFormData(prev => ({ ...prev, arrivedCountry: e.target.value }))}
                            isInvalid={!!validationErrors.arrivedCountry}
                          >
                            <option value="">SELECT</option>
                            <option value="India">India</option>
                            <option value="UAE">UAE</option>
                            <option value="Thailand">Thailand</option>
                          </Form.Select>
                          {validationErrors.arrivedCountry && (
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.arrivedCountry}
                            </Form.Control.Feedback>
                          )}
                        </Form.Group>
                        <Form.Group className="mb-3">
                          <Form.Label>Place <span className="text-danger">*</span></Form.Label>
                          <Form.Control 
                            type="text" 
                            placeholder="Click to Choose..."
                            value={formData.place}
                            onChange={(e) => setFormData(prev => ({ ...prev, place: e.target.value }))}
                            isInvalid={!!validationErrors.place}
                          />
                          {validationErrors.place && (
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.place}
                            </Form.Control.Feedback>
                          )}
                        </Form.Group>
                        <Form.Group className="mb-3">
                          <Form.Label>Overview</Form.Label>
                          <Form.Control 
                            as="textarea" 
                            rows={4} 
                            placeholder="Enter package overview"
                            value={formData.overview}
                            onChange={(e) => setFormData(prev => ({ ...prev, overview: e.target.value }))}
                          />
                        </Form.Group>
                        <Form.Group className="mb-3">
                          <Form.Label>No of nights <span className="text-danger">*</span></Form.Label>
                          <Form.Select
                            value={formData.noOfNights}
                            onChange={(e) => setFormData(prev => ({ ...prev, noOfNights: e.target.value }))}
                            isInvalid={!!validationErrors.noOfNights}
                          >
                            {[...Array(15)].map((_, i) => (
                              <option key={i + 1} value={i + 1}>{i + 1}</option>
                            ))}
                          </Form.Select>
                          {validationErrors.noOfNights && (
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.noOfNights}
                            </Form.Control.Feedback>
                          )}
                        </Form.Group>
                      </Col>
                    </Row>
                  </Form>
                </Tab>

                <Tab eventKey="itinerary" title="Itinerary">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6>Itinerary Details</h6>
                    <Button variant="outline-primary" size="sm">
                      <FaPlus className="me-2" />
                      Add Day
                    </Button>
                  </div>
                  <Card className="mb-3">
                    <Card.Header>
                      <h6 className="mb-0">Day 1</h6>
                    </Card.Header>
                    <Card.Body>
                      <Row>
                        <Col md={6}>
                          <Form.Group className="mb-3">
                            <Form.Label>Place (Type 3 letters)</Form.Label>
                            <Form.Control type="text" placeholder="Enter place" />
                          </Form.Group>
                        </Col>
                        <Col md={6}>
                          <Form.Group className="mb-3">
                            <Form.Label>Headline</Form.Label>
                            <Form.Control type="text" placeholder="Enter headline" />
                          </Form.Group>
                        </Col>
                      </Row>
                      <Row>
                        <Col md={6}>
                          <Form.Group className="mb-3">
                            <Form.Label>File Upload</Form.Label>
                            <Form.Control type="file" accept="image/*" />
                          </Form.Group>
                        </Col>
                        <Col md={6}>
                          <Form.Group className="mb-3">
                            <Form.Label>Overview</Form.Label>
                            <Form.Control as="textarea" rows={3} placeholder="Enter day overview" />
                          </Form.Group>
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>
                </Tab>

                <Tab eventKey="others" title="Others">
                  <Row>
                    <Col md={4}>
                      <h6>Inclusion</h6>
                      <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                        <FormCheck type="checkbox" label="Accommodation using a Standard Room" defaultChecked />
                        <FormCheck type="checkbox" label="Breakfasts (from the 2nd day of arrival)" defaultChecked />
                        <FormCheck type="checkbox" label="Return Dubai Airport Transfers" defaultChecked />
                        <FormCheck type="checkbox" label="Dubai Mall visits with English Speaking Tour Guide" defaultChecked />
                        <FormCheck type="checkbox" label="Burj Khalifa entry ticket 124th Floor" defaultChecked />
                        <FormCheck type="checkbox" label="Afternoon Desert Safari with Barbecue Buffet Dinner" defaultChecked />
                        <FormCheck type="checkbox" label="Full Day Abu Dhabi City Tour" defaultChecked />
                        <FormCheck type="checkbox" label="Dubai Frame with entry ticket" defaultChecked />
                        <FormCheck type="checkbox" label="Complimentary bottle of water during tours" defaultChecked />
                        <FormCheck type="checkbox" label="Applicable Taxes and Service Charges" defaultChecked />
                        <FormCheck type="checkbox" label="Online Dubai Tourist Visa" defaultChecked />
                        <FormCheck type="checkbox" label="Global Village & Miracle Garden entry ticket" defaultChecked />
                        <FormCheck type="checkbox" label="Dubai Half day city tour on SIC" defaultChecked />
                        <FormCheck type="checkbox" label="Desert dune safari with BBQ dinner on SIC" defaultChecked />
                        <FormCheck type="checkbox" label="Dhow cruise at Dubai creek with dinner on SIC" defaultChecked />
                        <FormCheck type="checkbox" label="Burj Khalifa 124th floor (non-peak hours) on SIC" defaultChecked />
                        <FormCheck type="checkbox" label="Return Dubai (DXB) airport transfers on SIC" defaultChecked />
                        <FormCheck type="checkbox" label="INCLUSIVE OF TOURISM DIRHAM FEE" defaultChecked />
                      </div>
                    </Col>
                    <Col md={4}>
                      <h6>Exclusion</h6>
                      <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                        <FormCheck type="checkbox" label="Return Airfare" defaultChecked />
                        <FormCheck type="checkbox" label="Visa and Travel Insurance" defaultChecked />
                        <FormCheck type="checkbox" label="Room category upgrade at the Hotel" defaultChecked />
                        <FormCheck type="checkbox" label="Meals other than specified" defaultChecked />
                        <FormCheck type="checkbox" label="Sightseeing and Transfers other than specified" defaultChecked />
                        <FormCheck type="checkbox" label="Entrance fees or Fees for video or camera permit other than specified" defaultChecked />
                        <FormCheck type="checkbox" label="Personal expenses like tips, laundry, telephone calls, etc." defaultChecked />
                      </div>
                    </Col>
                    <Col md={4}>
                      <h6>Terms and Conditions</h6>
                      <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                        <FormCheck type="checkbox" label="Confirmation of Hotels and other services will be subject to availability" defaultChecked />
                        <FormCheck type="checkbox" label="Rates are valid during Events, Holidays & Exhibition Period" defaultChecked />
                        <FormCheck type="checkbox" label="Standard Check in Time at 3:00 PM & Standard Check out Time at 12:00 Noon" defaultChecked />
                        <FormCheck type="checkbox" label="Cancellation Policy - Entire room charges will be levied for No-Show" defaultChecked />
                        <FormCheck type="checkbox" label="Kindly be on time for transfer as coach will not wait" defaultChecked />
                        <FormCheck type="checkbox" label="In case we are not able to provide the same hotels as mentioned" defaultChecked />
                        <FormCheck type="checkbox" label="The Rate of Exchange (R.O.E) will be the prevailing rate on the day/date of booking" defaultChecked />
                      </div>
                    </Col>
                  </Row>
                </Tab>
              </Tabs>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="danger" onClick={closeModal}>
                <i className="fas fa-times me-2"></i>
                Cancel
              </Button>
              <Button variant="success" onClick={handleSave}>
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

export default PackageReg;
