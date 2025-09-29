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
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";
import {
  FaEdit,
  FaTrash,
  FaEye,
  FaPlus,
  FaDollarSign,
  FaBackward,
} from "react-icons/fa";

// Enhanced SearchableSelect Component
const SearchableSelect = ({
  options,
  value,
  onChange,
  placeholder,
  className,
  isInvalid,
  name,
  disabled = false,
  isLoading = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredOptions, setFilteredOptions] = useState(options || []);

  useEffect(() => {
    if (!options || !Array.isArray(options)) {
      setFilteredOptions([]);
      return;
    }

    if (searchTerm) {
      const filtered = options.filter((option) => {
        const searchLower = searchTerm.toLowerCase();
        return (
          option.name?.toLowerCase().includes(searchLower) ||
          option.id?.toString().includes(searchTerm)
        );
      });
      setFilteredOptions(filtered);
    } else {
      setFilteredOptions(options);
    }
  }, [searchTerm, options]);

  const handleSelect = (option) => {
    onChange(option);
      setIsOpen(false);
      setSearchTerm("");
  };

  const selectedOption = options?.find((opt) => String(opt.id) === String(value));

  return (
    <div className="position-relative">
      <Form.Control
        type="text"
        placeholder={placeholder}
        value={isOpen ? searchTerm : selectedOption?.name || ""}
        onChange={(e) => setSearchTerm(e.target.value)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        className={`${className} ${isInvalid ? "is-invalid" : ""}`}
        disabled={disabled}
        readOnly={!isOpen}
      />
      {isOpen && (
        <div
          className="position-absolute w-100 bg-white border rounded shadow-lg"
          style={{ zIndex: 1000, maxHeight: "200px", overflowY: "auto" }}
        >
          {isLoading ? (
            <div className="p-2 text-center">
              <div className="spinner-border spinner-border-sm" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <div
                key={option.id}
                className="p-2 cursor-pointer hover-bg-light"
                onClick={() => handleSelect(option)}
                style={{ cursor: "pointer" }}
              >
                {option.name}
              </div>
            ))
          ) : (
            <div className="p-2 text-muted">No options found</div>
          )}
        </div>
      )}
    </div>
  );
};

const ActivityProviderReg = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [isViewMode, setIsViewMode] = useState(false);
  // Removed unused state variables for dropdowns and complex form fields
  const [formData, setFormData] = useState({
    providerName: "",
    providerCode: "",
    firstName: "",
    lastName: "",
    mobileNo: "",
    emailId: "",
    address: "",
  });
  const [error, setError] = useState("");
  const [validationErrors, setValidationErrors] = useState({});
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch activity providers list
  const fetchActivityList = async (pageNum = 0, searchTerm = "") => {
    try {
      setLoading(true);
      const response = await axiosInstance.get(
        `/api/activityProvider?page=${pageNum}&size=10&search=${searchTerm}`
      );
      setItems(response.data.content || response.data || []);
      setTotalPages(response.data.totalPages || 0);
    } catch (error) {
      console.error("Error fetching activity providers:", error);
      toast.error("Failed to fetch activity providers");
    } finally {
      setLoading(false);
    }
  };

  // Note: Dropdown data fetching removed as we're using simple form fields

  useEffect(() => {
    fetchActivityList();
  }, []);

  // Handle search with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchActivityList(page, search);
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [search, page]);

  const openCreate = () => {
    setEditing(null);
    setIsViewMode(false);
    setValidationErrors({});
    setFormData({
      providerName: "",
      providerCode: "",
      firstName: "",
      lastName: "",
      mobileNo: "",
      emailId: "",
      address: "",
    });
    setError("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setIsViewMode(false);
    setValidationErrors({});
    setFormData({
      providerName: "",
      providerCode: "",
      firstName: "",
      lastName: "",
      mobileNo: "",
      emailId: "",
      address: "",
    });
    setError("");
  };

  const openEdit = async (item) => {
    setEditing(item);
    setIsViewMode(false);
    
    setFormData({
      providerName: item.providerName || "",
      providerCode: item.providerCode || "",
      firstName: item.firstName || "",
      lastName: item.lastName || "",
      mobileNo: item.mobileNo || "",
      emailId: item.emailId || "",
      address: item.address || "",
    });

    setValidationErrors({});
    setShowModal(true);
  };

  const handleView = async (item) => {
    setEditing(item);
    setIsViewMode(true);
    
    setFormData({
      providerName: item.providerName || "",
      providerCode: item.providerCode || "",
      firstName: item.firstName || "",
      lastName: item.lastName || "",
      mobileNo: item.mobileNo || "",
      emailId: item.emailId || "",
      address: item.address || "",
    });

    setValidationErrors({});
    setShowModal(true);
  };

  const handleDelete = (item) => {
    Swal.fire({
      title: `Are you sure? You want to delete ${item.providerName}`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
      customClass: {
        popup: "swal-small",
        title: "swal-small-title",
        htmlContainer: "swal-small-text",
      },
    }).then((result) => {
      if (result.isConfirmed) {
        axiosInstance
          .delete(`/api/activityProvider/${item.providerId}`)
          .then(() => {
            toast.success("Activity Provider deleted successfully");
            fetchActivityList(page, search);
          })
          .catch((error) => {
            console.error("Delete error:", error);
            toast.error(`Failed to delete activity provider: ${error.response?.data?.message || error.message}`);
          });
      }
    });
  };

  const handleActivityRates = (item) => {
    console.log("activity rates click with item::" , item)
     navigate('/activity-rates', {
      state: {
        activityProvider: item,
        activityProviderId: item.providerId,
        activityProviderName: item.providerName
      }
    });
  };

  const validateForm = (data) => {
    const errors = {};
    
    if (!data.providerName?.trim()) errors.providerName = "Provider Name is required";
    
    return errors;
  };

  const saveActivity = async (e) => {
    e.preventDefault();
    const errors = validateForm(formData);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    try {
      setIsLoading(true);
      
      const payload = {
        providerName: formData.providerName,
        providerCode: formData.providerCode,
        firstName: formData.firstName,
        lastName: formData.lastName,
        mobileNo: formData.mobileNo,
        emailId: formData.emailId,
        address: formData.address,
      };

      const response = await axiosInstance.post(
        "/api/activityProvider/register",
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      console.log("activity provider save success::" , response)
      if (response.data) {
        toast.success("Activity Provider added successfully!");
        setValidationErrors({});
        await fetchActivityList(page, search);
        closeModal();
      }
    } catch (error) {
      console.error("Save activity error:", error);
      setError("Failed to save activity provider");
      toast.error(`Failed to save activity: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const updateActivity = async (e) => {
    e.preventDefault();
    const errors = validateForm(formData);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    if (!editing) return;

    try {
      setIsLoading(true);
      
      const payload = {
        providerName: formData.providerName,
        providerCode: formData.providerCode,
        firstName: formData.firstName,
        lastName: formData.lastName,
        mobileNo: formData.mobileNo,
        emailId: formData.emailId,
        address: formData.address,
      };

      const response = await axiosInstance.put(
        `/api/activityProvider/${editing.providerId}`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data) {
        toast.success("Activity Provider updated successfully!");
        setValidationErrors({});
        await fetchActivityList(page, search);
        closeModal();
      }
    } catch (error) {
      console.error("Update activity error:", error);
      setError("Failed to update activity provider");
      toast.error(`Failed to update activity: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Card className="shadow-sm rounded-xl">
            <Card.Header className="d-flex justify-content-between align-items-center">
              <span className="fw-semibold">Activity Providers</span>
              <Form.Group className="hotel-search-bar position-relative">
                <Form.Control
                  type="text"
                  placeholder="Search activity provider by name..."
                  className="form-control-modern-sm"
                  value={searchTerm}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSearchTerm(value);
                    setSearch(value);
                    setPage(0);
                  }}
                />
                {searchTerm && (
                  <button
                    type="button"
                    className="btn btn-link position-absolute top-50 end-0 translate-middle-y"
                    style={{
                      border: "none",
                      background: "none",
                      color: "#6c757d",
                      padding: "0 12px",
                      zIndex: 10,
                    }}
                    onClick={() => {
                      setSearchTerm("");
                      setSearch("");
                      setPage(0);
                    }}
                    title="Clear search"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                )}
              </Form.Group>
              <Button className="btn-green" onClick={openCreate}>
                + Create
              </Button>
            </Card.Header>
            <Card.Body className="p-0">
              <Table responsive hover striped className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th style={{ width: 100 }}>S/N</th>
                    <th>Provider Name</th>
                    <th>First Name</th>
                    <th>Last Name</th>
                    <th style={{ width: 160 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.id}>
                      <td>{index + 1 + page * 10}</td>
                      <td>{item.providerName}</td>
                      <td>{item.firstName}</td>
                      <td>{item.lastName}</td>
                      <td>
                        <div className="d-flex gap-2">
                          <FaEdit
                            className="text-primary edit"
                            style={{ cursor: "pointer", fontSize: "18px" }}
                            onClick={() => openEdit(item)}
                            title="Edit"
                          />
                          <FaEye
                            className="text-info view"
                            style={{ cursor: "pointer", fontSize: "18px" }}
                            onClick={() => handleView(item)}
                            title="View"
                          />
                          <FaDollarSign
                            className="text-success"
                            style={{ cursor: "pointer", fontSize: "18px" }}
                            onClick={() => handleActivityRates(item)}
                            title="Activity Rates"
                          />
                          <FaTrash
                            className="text-danger delete"
                            style={{ cursor: "pointer", fontSize: "18px" }}
                            onClick={() => handleDelete(item)}
                            title="Delete"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {loading && (
                    <tr>
                      <td colSpan={5} className="text-center text-muted py-4">
                        <div
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                        >
                          <span className="visually-hidden">Loading...</span>
                        </div>
                        Loading available activity providers...
                      </td>
                    </tr>
                  )}
                  {items.length === 0 && !loading && (
                    <tr>
                      <td colSpan={5} className="text-center text-muted py-4">
                        No activity providers found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>

              {totalPages > 1 && (
                <div className="d-flex justify-content-between align-items-center p-3 border-top">
                  <div>
                    <small className="text-muted">
                      Showing {items.length} of {totalPages * 10} activity providers
                    </small>
                  </div>
                  <div>
                    <Pagination className="mb-0">
                      <Pagination.Prev
                        disabled={page === 0}
                        onClick={() => fetchActivityList(page - 1, search)}
                      />
                      {[...Array(totalPages).keys()].map((num) => (
                        <Pagination.Item
                          key={num}
                          active={num === page}
                          onClick={() => fetchActivityList(num, search)}
                        >
                          {num + 1}
                        </Pagination.Item>
                      ))}
                      <Pagination.Next
                        disabled={page === totalPages - 1}
                        onClick={() => fetchActivityList(page + 1, search)}
                      />
                    </Pagination>
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>

          {/* Modal */}
          <Modal show={showModal} onHide={closeModal} centered size="lg">
            <Modal.Header closeButton={!isLoading} style={{ backgroundColor: '#1e3a8a', color: 'white' }}>
              <Modal.Title>
                {isViewMode
                  ? "View Provider"
                  : editing
                  ? "Update Provider"
                  : "Create Provider"}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <div className="mb-2">
                <small style={{ color: 'red' }}>* mandatory fields</small>
              </div>
              <Form>
                <Row>
                  {/* Left Column */}
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        <span style={{ color: 'red' }}>*</span> Provider Name
                      </Form.Label>
                      <Form.Control
                        type="text"
                        value={formData.providerName}
                        onChange={(e) => setFormData(prev => ({ ...prev, providerName: e.target.value }))}
                        disabled={isViewMode}
                        isInvalid={!!validationErrors.providerName}
                      />
                      {validationErrors.providerName && (
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.providerName}
                        </Form.Control.Feedback>
                      )}
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>First Name</Form.Label>
                      <Form.Control
                        type="text"
                        value={formData.firstName}
                        onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                        disabled={isViewMode}
                      />
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>Mobile No</Form.Label>
                      <Form.Control
                        type="text"
                        value={formData.mobileNo}
                        onChange={(e) => setFormData(prev => ({ ...prev, mobileNo: e.target.value }))}
                        disabled={isViewMode}
                      />
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>Address</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={3}
                        value={formData.address}
                        onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                        disabled={isViewMode}
                      />
                    </Form.Group>
                  </Col>

                  {/* Right Column */}
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Provider Code</Form.Label>
                      <Form.Control
                        type="text"
                        value={formData.providerCode}
                        onChange={(e) => setFormData(prev => ({ ...prev, providerCode: e.target.value }))}
                        disabled={isViewMode}
                      />
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>Last Name</Form.Label>
                      <Form.Control
                        type="text"
                        value={formData.lastName}
                        onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                        disabled={isViewMode}
                      />
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>Email Id</Form.Label>
                      <Form.Control
                        type="email"
                        value={formData.emailId}
                        onChange={(e) => setFormData(prev => ({ ...prev, emailId: e.target.value }))}
                        disabled={isViewMode}
                      />
                    </Form.Group>
                  </Col>
                </Row>

                {error && (
                  <Form.Control.Feedback type="invalid">
                    {error}
                  </Form.Control.Feedback>
                )}
              </Form>
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="danger"
                onClick={closeModal}
                disabled={isLoading}
                className="d-flex align-items-center gap-2"
              >
                <i className="fas fa-times"></i>
                Cancel
              </Button>
              {!isViewMode && (
                <>
                  <Button
                    variant="primary"
                    onClick={editing ? updateActivity : saveActivity}
                    disabled={isLoading}
                    className="d-flex align-items-center gap-2"
                  >
                    <i className="fas fa-arrow-right"></i>
                    {isLoading
                      ? editing
                        ? "Updating..."
                        : "Saving..."
                      : editing
                      ? "Update"
                      : "Create"}
                  </Button>
                  <Button
                    variant="info"
                    onClick={() => {
                      setFormData({
                        providerName: "",
                        providerCode: "",
                        firstName: "",
                        lastName: "",
                        mobileNo: "",
                        emailId: "",
                        address: "",
                      });
                    }}
                    disabled={isLoading}
                    className="d-flex align-items-center gap-2"
                  >
                    <i className="fas fa-undo"></i>
                    Reset
                  </Button>
                </>
              )}
            </Modal.Footer>
          </Modal>
        </main>
      </div>
    </div>
  );
};

export default ActivityProviderReg;