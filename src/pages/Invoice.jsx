import React, { useEffect, useMemo, useState } from "react";
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
import Sidebar from "../components/Sidebar";
import Topbar from "../components/TopBar";
import axiosInstance from "../components/AxiosInstance";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";
import {
  FaEdit,
  FaTrash,
  FaCalendarAlt,
  FaImage,
  FaTimes,
  FaCheck,
  FaUndo,
  FaPrint,
  FaFileExcel,
} from "react-icons/fa";

// Dummy invoice data for testing
const dummyInvoiceData = [
  {
    id: 1,
    customerName: "John Smith",
    agent: "ABC Travel Agency",
    bookingCode: "BK001234",
    bookingDate: "2024-01-15",
    rate: 1250.00,
  },
  {
    id: 2,
    customerName: "Sarah Johnson",
    agent: "XYZ Tours",
    bookingCode: "BK001235",
    bookingDate: "2024-01-16",
    rate: 890.50,
  },
  {
    id: 3,
    customerName: "Michael Brown",
    agent: "ABC Travel Agency",
    bookingCode: "BK001236",
    bookingDate: "2024-01-17",
    rate: 2100.75,
  },
  {
    id: 4,
    customerName: "Emily Davis",
    agent: "Global Travel Solutions",
    bookingCode: "BK001237",
    bookingDate: "2024-01-18",
    rate: 1750.00,
  },
  {
    id: 5,
    customerName: "David Wilson",
    agent: "XYZ Tours",
    bookingCode: "BK001238",
    bookingDate: "2024-01-19",
    rate: 950.25,
  },
  {
    id: 6,
    customerName: "Lisa Anderson",
    agent: "Premium Travel Co",
    bookingCode: "BK001239",
    bookingDate: "2024-01-20",
    rate: 3200.00,
  },
  {
    id: 7,
    customerName: "Robert Taylor",
    agent: "ABC Travel Agency",
    bookingCode: "BK001240",
    bookingDate: "2024-01-21",
    rate: 1480.50,
  },
  {
    id: 8,
    customerName: "Jessica Martinez",
    agent: "Global Travel Solutions",
    bookingCode: "BK001241",
    bookingDate: "2024-01-22",
    rate: 1120.75,
  },
  {
    id: 9,
    customerName: "William Garcia",
    agent: "XYZ Tours",
    bookingCode: "BK001242",
    bookingDate: "2024-01-23",
    rate: 2350.00,
  },
  {
    id: 10,
    customerName: "Amanda Rodriguez",
    agent: "Premium Travel Co",
    bookingCode: "BK001243",
    bookingDate: "2024-01-24",
    rate: 1680.25,
  },
];

export default function Invoice() {
  const [items, setItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [agent, setAgent] = useState("");
  const [agents, setAgents] = useState([]);

  // Form fields
  const [title, setTitle] = useState("");
  const [bannerImage, setBannerImage] = useState(null);
  const [existingImageUrl, setExistingImageUrl] = useState(null); // Track existing image URL for preview
  const [description, setDescription] = useState("");
  const [validityFrom, setValidityFrom] = useState("");
  const [validityTo, setValidityTo] = useState("");

  const nextId = useMemo(
    () => Math.max(0, ...items.map((i) => i.id)) + 1,
    [items]
  );

  const openCreate = () => {
    setEditing(null);
    setTitle("");
    setBannerImage(null);
    setExistingImageUrl(null);
    setDescription("");
    setValidityFrom("");
    setValidityTo("");
    setError("");
    setShowModal(true);
  };

  const openEdit = (item) => {
    console.log("open edit item::", item);
    setEditing(item);
    setTitle(item.title || "");
    setBannerImage(null); // Reset file input for edit
    setExistingImageUrl(item.bannerImagePah || null); // Set existing image URL for preview
    setDescription(item.description || "");
    
    // Convert LocalDateTime to date string for date inputs
    let fromDate = "";
    let toDate = "";
    
    if (item.validityFrom) {
      // If it's already a date string, use it; otherwise parse LocalDateTime
      if (typeof item.validityFrom === 'string' && item.validityFrom.includes('T')) {
        fromDate = item.validityFrom.split('T')[0];
      } else if (typeof item.validityFrom === 'string') {
        fromDate = item.validityFrom;
      }
    }
    
    if (item.validityTo) {
      // If it's already a date string, use it; otherwise parse LocalDateTime
      if (typeof item.validityTo === 'string' && item.validityTo.includes('T')) {
        toDate = item.validityTo.split('T')[0];
      } else if (typeof item.validityTo === 'string') {
        toDate = item.validityTo;
      }
    }
    
    setValidityFrom(fromDate);
    setValidityTo(toDate);
    setError("");
    setShowModal(true);
  };

  const handleEdit = async () => {
    if (!editing) return;

    // Validation
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!description.trim()) {
      setError("Description is required");
      return;
    }

    try {
      setIsLoading(true);
      setError("");
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      
      // Convert date strings to LocalDateTime format (YYYY-MM-DDTHH:mm:ss)
      if (validityFrom) {
        formData.append("validityFrom", validityFrom + "T00:00:00");
      }
      if (validityTo) {
        formData.append("validityTo", validityTo + "T23:59:59");
      }

      if (bannerImage) {
        formData.append("bannerImage", bannerImage);
      }

      const editRes = await axiosInstance.put(
        `/api/offerDetails/${editing.offerId}`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      if (editRes.data) {
        toast.success("Offer Updated Successfully!");
        await fetchInvoiceList(page, search);
        closeModal();
      }
    } catch (error) {
      setError("Failed to update offer");
      toast.error("Failed to update offer");
    } finally {
      setIsLoading(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setTitle("");
    setBannerImage(null);
    setExistingImageUrl(null);
    setDescription("");
    setValidityFrom("");
    setValidityTo("");
    setError("");
  };

  const fetchInvoiceList = async (pageNum = 0, searchTerm = search) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: "10",
      });

      if (searchTerm && searchTerm.trim()) {
        params.append("search", searchTerm.trim());
      }

      // const res = await axiosInstance.get(
      //   `/api/invoiceList?${params.toString()}`
      // );

      // if (res.data && Array.isArray(res.data)) {
      //   setItems(res.data);
      //   if (res.data.length < 10) {
      //     setTotalPages(pageNum + 1);
      //   } else {
      //     setTotalPages(Math.max(totalPages, pageNum + 2));
      //   }
      //   setPage(pageNum);
      // } else {
      //   setItems([]);
      //   setTotalPages(0);
      //   setPage(0);
      // }

       setItems(dummyInvoiceData);
    } catch (err) {
      toast.error("Failed to load offers");
      setItems([]);
      setTotalPages(0);
      setPage(0);
    } finally {
      setIsLoading(false);
    }
  };

  const saveOffer = async () => {
    // Validation
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!description.trim()) {
      setError("Description is required");
      return;
    }
    if (!bannerImage) {
      setError("Banner image is required");
      return;
    }

    try {
      setIsLoading(true);
      setError("");
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      
      // Convert date strings to LocalDateTime format (YYYY-MM-DDTHH:mm:ss)
      if (validityFrom) {
        formData.append("validityFrom", validityFrom + "T00:00:00");
      }
      if (validityTo) {
        formData.append("validityTo", validityTo + "T23:59:59");
      }

      if (bannerImage) {
        formData.append("bannerImage", bannerImage);
      }

      const saveRes = await axiosInstance.post(
        "/api/offerDetails/save",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      if (saveRes.data !== 0) {
        toast.success("Offer added Successfully!");
        await fetchInvoiceList(page, search);
        closeModal();
      }
    } catch (error) {
      setError("Sorry! Data not saved to db..");
      toast.error("Failed to save offer data");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setBannerImage(null);
    setExistingImageUrl(null);
    setDescription("");
    setValidityFrom("");
    setValidityTo("");
    setError("");
  };

  const agentList = async () => {
    try {
      const response = await axiosInstance.get("/api/agent");
      setAgents(response.data || []);
    } catch (error) {
      console.log("error for agent axios list:", error);
      setAgents([]);
    }
  };

  useEffect(() => {
    // Uncomment the line below when API is ready
    // fetchInvoiceList();
    // For now, use dummy data
    setItems(dummyInvoiceData);
    setTotalPages(Math.ceil(dummyInvoiceData.length / 10));
    agentList();
  }, []);

  // Debounced search effect
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (search !== "") {
      const timeout = setTimeout(() => {
        fetchInvoiceList(0, search);
      }, 500);
      setSearchTimeout(timeout);
    } else if (search === "") {
      fetchInvoiceList(0, "");
    }

    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [search]);

  const handleDelete = (item) => {
    Swal.fire({
      title: `Are you sure? You want to delete ${item.title}`,
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
          .delete(`/api/offerDetails/${item.offerId}`)
          .then(() => {
            toast.success("Offer deleted successfully");
            fetchInvoiceList(page, search);
          })
          .catch(() => {
            toast.error("Sorry!! Offer not deleted");
          });
      }
    });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setBannerImage(file);
      setExistingImageUrl(null); // Clear existing image URL when new file is selected
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExcel = () => {
    // TODO: Implement Excel export functionality
    toast("Excel export functionality coming soon", {
      icon: "ℹ️",
    });
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Card className="shadow-sm rounded-xl mb-4">
            <Card.Header>
              <div className="d-flex align-items-center mb-3">
                <Button variant="link" className="p-0 me-3" onClick={() => window.history.back()}>
                  &lt;&lt; Back
                </Button>
                <h4 className="fw-bold text-primary mb-0">TAX INVOICE</h4>
              </div>
            </Card.Header>
            <Card.Body>
              {/* Search Criteria Section */}
              <div className="mb-4">
                <h6 className="fw-semibold mb-3">Search Criteria</h6>
                <Row className="g-3 align-items-end">
                  <Col md={3}>
                    <Form.Group>
                      <Form.Label>From Date</Form.Label>
                      <div className="position-relative">
                        <Form.Control
                          type="date"
                          value={fromDate}
                          onChange={(e) => setFromDate(e.target.value)}
                          className="pe-5"
                        />
                        <FaCalendarAlt
                          className="position-absolute"
                          style={{
                            right: "12px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            color: "#6c757d",
                            pointerEvents: "none",
                          }}
                        />
                      </div>
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group>
                      <Form.Label>To Date</Form.Label>
                      <div className="position-relative">
                        <Form.Control
                          type="date"
                          value={toDate}
                          onChange={(e) => setToDate(e.target.value)}
                          min={fromDate || undefined}
                          className="pe-5"
                        />
                        <FaCalendarAlt
                          className="position-absolute"
                          style={{
                            right: "12px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            color: "#6c757d",
                            pointerEvents: "none",
                          }}
                        />
                      </div>
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group>
                      <Form.Label>Agent</Form.Label>
                      <Form.Select
                        value={agent}
                        onChange={(e) => setAgent(e.target.value)}
                      >
                        <option value="">Select Agent</option>
                        {agents.map((agentItem) => (
                          <option key={agentItem.id} value={agentItem.id}>
                            {agentItem.companyName}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={3} className="d-flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={handlePrint}
                      className="flex-grow-1"
                    >
                      <FaPrint className="me-2" />
                      Print
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={handleExcel}
                      className="flex-grow-1"
                    >
                      <FaFileExcel className="me-2" />
                      Excel
                    </Button>
                  </Col>
                </Row>
              </div>
            </Card.Body>
          </Card>

          <Card className="shadow-sm rounded-xl">
            <Card.Header className="d-flex justify-content-between align-items-center">
              <span className="fw-semibold">Invoice List</span>
              {/* Search Bar */}
              <Form.Group className="hotel-search-bar">
                <Form.Control
                  type="text"
                  placeholder="Search invoices..."
                  className="form-control-modern-sm"
                  value={searchTerm}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSearchTerm(value);
                    fetchInvoiceList(0, value);
                  }}
                />
              </Form.Group>
             </Card.Header>
             <Card.Body className="p-0">
              <div className="table-responsive">
                <Table className="table-hover mb-0">
                  <thead className="table-light">
                    <tr>
                      <th className="border-0">S.N</th>
                      <th className="border-0">Customer Name</th>
                      <th className="border-0">Agent</th>
                      <th className="border-0">Booking Code</th>
                      <th className="border-0">Booking Date</th>
                      <th className="border-0">Rate</th>
                      <th className="border-0">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan="7" className="text-center py-4">
                          <div className="d-flex justify-content-center align-items-center">
                            <div
                              className="spinner-border text-primary me-2"
                              role="status"
                            >
                              <span className="visually-hidden">
                                Loading...
                              </span>
                 </div>
                            Loading invoices...
               </div>
                        </td>
                      </tr>
                    ) : items.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="text-center py-4 text-muted">
                          No invoices found
                        </td>
                      </tr>
                    ) : (
                      items.map((item, index) => (
                        <tr key={item.id}>
                          <td>{page * 10 + index + 1}</td>
                          <td>{item.customerName || "-"}</td>
                          <td>{item.agent || "-"}</td>
                          <td>{item.bookingCode || "-"}</td>
                          <td>{item.bookingDate || "-"}</td>
                          <td>
                            {item.rate
                              ? `$${item.rate.toLocaleString("en-US", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}`
                              : "-"}
                          </td>
                          <td>
                            <div className="d-flex gap-2">
                              <FaEdit
                                className="text-primary"
                                style={{ cursor: "pointer", fontSize: "18px" }}
                                onClick={() => openEdit(item)}
                                title="Edit"
                              />
                              <FaTrash
                                className="text-danger"
                                style={{ cursor: "pointer", fontSize: "18px" }}
                                onClick={() => handleDelete(item)}
                                title="Delete"
                              />
                     </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </Table>
                 </div>
              {totalPages > 1 && (
                <div className="d-flex justify-content-end p-3">
                  <Pagination>
                    <Pagination.Prev
                      disabled={page === 0}
                      onClick={() => fetchInvoiceList(page - 1, search)}
                    />
                    {Array.from({ length: totalPages }, (_, i) => (
                      <Pagination.Item
                        key={i}
                        active={i === page}
                        onClick={() => fetchInvoiceList(i, search)}
                      >
                        {i + 1}
                      </Pagination.Item>
                    ))}
                    <Pagination.Next
                      disabled={page === totalPages - 1}
                      onClick={() => fetchInvoiceList(page + 1, search)}
                    />
                  </Pagination>
                             </div>
                         )}
             </Card.Body>
           </Card>

          {/* Create/Edit Offers Modal */}
          <Modal show={showModal} onHide={closeModal} centered size="lg">
            <Modal.Header
              closeButton={!isLoading}
              className="bg-primary text-white"
            >
               <Modal.Title>
                {editing ? "Update Offers" : "Create Offers"}
               </Modal.Title>
             </Modal.Header>
             <Modal.Body>
              <Form>
                <Row>
                  <Col md={12}>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        <span className="text-danger">*</span> Title
                      </Form.Label>
                      <Form.Control
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Enter offer title"
                        autoFocus
                        isInvalid={!!error}
                      />
                      {error && (
                        <Form.Control.Feedback type="invalid">
                          {error}
                        </Form.Control.Feedback>
                      )}
                    </Form.Group>
                     </Col>
                   </Row>

                <Row>
                  <Col md={12}>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        <span className="text-danger">*</span> Banner Image
                      </Form.Label>
                      <div className="d-flex align-items-center">
                        <Form.Control
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="me-2"
                          isInvalid={!!error && !bannerImage && !editing}
                        />
                        <span className="text-muted">
                          {bannerImage ? bannerImage.name : "No file chosen"}
                        </span>
                       </div>
                      {error && !bannerImage && !editing && (
                        <Form.Control.Feedback type="invalid">
                          {error}
                        </Form.Control.Feedback>
                      )}
                      
                      {/* Image Preview */}
                      {(bannerImage || existingImageUrl) && (
                        <div className="mt-3">
                          <div className="d-flex align-items-center mb-2">
                            <FaImage className="me-2 text-primary" />
                            <span className="fw-semibold">Image Preview:</span>
                          </div>
                          <div className="border rounded p-2" style={{ maxWidth: '300px' }}>
                            <img
                              src={bannerImage ? URL.createObjectURL(bannerImage) : existingImageUrl}
                              alt="Banner preview"
                              className="img-fluid rounded"
                              style={{ maxHeight: '200px', width: '100%', objectFit: 'cover' }}
                            />
                          </div>
                          {existingImageUrl && !bannerImage && (
                            <small className="text-muted mt-1 d-block">
                              Current image (select a new file to replace)
                            </small>
                          )}
                        </div>
                      )}
                    </Form.Group>
                     </Col>
                   </Row>

                <Row>
                     <Col md={12}>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        <span className="text-danger">*</span> Description
                      </Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={4}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Enter offer description"
                        isInvalid={!!error}
                      />
                      {error && (
                        <Form.Control.Feedback type="invalid">
                          {error}
                        </Form.Control.Feedback>
                      )}
                    </Form.Group>
                     </Col>
                   </Row>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Validity From</Form.Label>
                      <Form.Control
                        type="date"
                        value={validityFrom}
                        onChange={(e) => {
                          setValidityFrom(e.target.value);
                          // If validity to is before the new from date, clear it
                          if (validityTo && e.target.value && validityTo < e.target.value) {
                            setValidityTo("");
                          }
                        }}
                        min={new Date().toISOString().split('T')[0]} // Prevent selecting past dates
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Validity To</Form.Label>
                      <Form.Control
                        type="date"
                        value={validityTo}
                        onChange={(e) => setValidityTo(e.target.value)}
                        min={validityFrom || new Date().toISOString().split('T')[0]} // Only allow dates after validity from
                      />
                    </Form.Group>
                       </Col>
                     </Row>
              </Form>
             </Modal.Body>
             <Modal.Footer>
              <Button
                variant="danger"
                onClick={closeModal}
                disabled={isLoading}
                className="d-flex align-items-center"
              >
                <FaTimes className="me-2" />
                Cancel
              </Button>
              <Button
                className="btn-success d-flex align-items-center"
                onClick={editing ? handleEdit : saveOffer}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    ></span>
                    {editing ? "Updating..." : "Creating..."}
                  </>
                ) : (
                  <>
                    <FaCheck className="me-2" />
                    {editing ? "Update" : "Create"}
                  </>
                )}
              </Button>
              <Button
                variant="info"
                onClick={resetForm}
                disabled={isLoading}
                className="d-flex align-items-center"
              >
                <FaUndo className="me-2" />
                Reset
               </Button>
             </Modal.Footer>
           </Modal>
        </main>
      </div>
    </div>
  );
}
