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
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";
import { FaEdit, FaTrash } from "react-icons/fa";

const AgentReg = () => {
  const [items, setItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    companyName: "",
    shortName: "",
    businessType: "",
    companyType: "",
    companyCode: "",
    agentUrl: "",
    authorizedPersonFirstName: "",
    authorizedPersonLastName: "",
    agentEmail: "",
    zipCode: "",
    mobileNumber: "",
    telephoneNumber: "",
    contactPerson: "",
    country: "",
    province: "",
    city: "",
    address: "",
    markup: "",
    currency: "",
    status: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [searchTerm, setSearchTerm] = useState(null);

  const nextId = useMemo(
    () => Math.max(0, ...items.map((i) => i.id)) + 1,
    [items]
  );

  const openCreate = () => {
    setEditing(null);
    setFormData({
      companyName: "",
      shortName: "",
      businessType: "",
      companyType: "",
      companyCode: "",
      agentUrl: "",
      authorizedPersonFirstName: "",
      authorizedPersonLastName: "",
      agentEmail: "",
      zipCode: "",
      mobileNumber: "",
      telephoneNumber: "",
      contactPerson: "",
      country: "",
      province: "",
      city: "",
      address: "",
      markup: "",
      currency: "",
      status: "",
    });
    setError("");
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setFormData({
      companyName: item.companyName || "",
      shortName: item.shortName || "",
      businessType: item.businessType || "",
      companyType: item.companyType || "",
      companyCode: item.companyCode || "",
      agentUrl: item.agentUrl || "",
      authorizedPersonFirstName: item.authorizedPersonFirstName || "",
      authorizedPersonLastName: item.authorizedPersonLastName || "",
      agentEmail: item.agentEmail || "",
      zipCode: item.zipCode || "",
      mobileNumber: item.mobileNumber || "",
      telephoneNumber: item.telephoneNumber || "",
      contactPerson: item.contactPerson || "",
      country: item.country || "",
      province: item.province || "",
      city: item.city || "",
      address: item.address || "",
      markup: item.markup || "",
      currency: item.currency || "",
      status: item.status || "",
    });
    setShowModal(true);
  };

  const handleEdit = async () => {
    if (!editing) return;

    try {
      setIsLoading(true);
      const editRes = await axiosInstance.put(
        `/api/agent/${editing.id}`,
        formData
      );

      if (editRes.data) {
        toast.success("Agent Updated Successfully!");
        await fetchAgentList(page, search);
        closeModal();
      }
    } catch (error) {
      setError("Failed to update agent");
      toast.error("Failed to update agent");
    } finally {
      setIsLoading(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setFormData({
      companyName: "",
      shortName: "",
      businessType: "",
      companyType: "",
      companyCode: "",
      agentUrl: "",
      authorizedPersonFirstName: "",
      authorizedPersonLastName: "",
      agentEmail: "",
      zipCode: "",
      mobileNumber: "",
      telephoneNumber: "",
      contactPerson: "",
      country: "",
      province: "",
      city: "",
      address: "",
      markup: "",
      currency: "",
      status: "",
    });
    setError("");
  };

  const fetchAgentList = async (pageNum = 0, searchTerm = search) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: "10",
      });

      if (searchTerm && searchTerm.trim()) {
        params.append("search", searchTerm.trim());
      }

      const res = await axiosInstance.get(`/api/agent?${params.toString()}`);

      if (res.data && Array.isArray(res.data)) {
        setItems(res.data);
        if (res.data.length < 10) {
          setTotalPages(pageNum + 1);
        } else {
          setTotalPages(Math.max(totalPages, pageNum + 2));
        }
        setPage(pageNum);
      } else {
        setItems([]);
        setTotalPages(0);
        setPage(0);
      }
    } catch (err) {
      //   toast.error("Failed to load agents");
      setItems([]);
      setTotalPages(0);
      setPage(0);
    } finally {
      setIsLoading(false);
    }
  };

  const saveAgent = async () => {
    try {
      setIsLoading(true);
      const agentPayload = { ...formData };
      const agentSaveRes = await axiosInstance.post(
        "/api/agent/save",
        agentPayload
      );
      if (agentSaveRes.data !== 0) {
        toast.success("Agent added Successfully!");
        await fetchAgentList(page, search);
        closeModal();
      }
    } catch (error) {
      setError("Sorry! Data not saved to db..");
      toast.error("Failed to save agent data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // fetchAgentList();
  }, []);

  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (search !== "") {
      const timeout = setTimeout(() => {
        fetchAgentList(0, search);
      }, 500);
      setSearchTimeout(timeout);
    } else if (search === "") {
      fetchAgentList(0, "");
    }

    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [search]);

  const handleDelete = (item) => {
    Swal.fire({
      title: `Are you sure? You want to delete ${item.companyName}`,
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
          .delete(`/api/agent/${item.id}`)
          .then(() => {
            toast.success("Agent deleted successfully");
            fetchAgentList(page, search);
          })
          .catch(() => {
            toast.error("Sorry!! Agent not deleted");
          });
      }
    });
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Card className="shadow-sm rounded-xl">
            <Card.Header className="d-flex justify-content-between align-items-center">
              <span className="fw-semibold">Agent</span>
              <Form.Group className="hotel-search-bar">
                <Form.Control
                  type="text"
                  placeholder="Search agent by name..."
                  className="form-control-modern-sm"
                  value={searchTerm}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSearchTerm(value);
                    fetchAgentList(0, value);
                  }}
                />
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
                    <th>Agent Name</th>
                    <th style={{ width: 160 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.id}>
                      <td>{index + 1 + page * 10}</td>
                      <td>{item.companyName}</td>
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
                  ))}
                  {isLoading && (
                    <tr>
                      <td colSpan={3} className="text-center text-muted py-4">
                        <div
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                        >
                          <span className="visually-hidden">Loading...</span>
                        </div>
                        Loading available agents...
                      </td>
                    </tr>
                  )}
                  {items.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan={3} className="text-center text-muted py-4">
                        No agents found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>

              {totalPages > 1 && (
                <div className="d-flex justify-content-between align-items-center p-3 border-top">
                  <div>
                    <small className="text-muted">
                      Showing {items.length} of {totalPages * 10} agents
                    </small>
                  </div>
                  <div>
                    <Pagination className="mb-0">
                      <Pagination.Prev
                        disabled={page === 0}
                        onClick={() => fetchAgentList(page - 1, search)}
                      />
                      {[...Array(totalPages).keys()].map((num) => (
                        <Pagination.Item
                          key={num}
                          active={num === page}
                          onClick={() => fetchAgentList(num, search)}
                        >
                          {num + 1}
                        </Pagination.Item>
                      ))}
                      <Pagination.Next
                        disabled={page === totalPages - 1}
                        onClick={() => fetchAgentList(page + 1, search)}
                      />
                    </Pagination>
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>

          <Modal show={showModal} onHide={closeModal} centered size="lg">
            <Modal.Header closeButton={!isLoading}>
              <Modal.Title>
                {editing ? "Update Agent" : "Create Agent"}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form>
                <Card className="mb-3">
                  <Card.Header>Agent Details</Card.Header>
                  <Card.Body>
                    <Row>
                      <Col md={3}>
                        <Form.Group className="mb-3">
                          <Form.Label>Company Name</Form.Label>
                          <Form.Control
                            value={formData.companyName}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                companyName: e.target.value,
                              })
                            }
                            placeholder="Enter company name"
                            autoFocus
                            isInvalid={!!error}
                          />
                        </Form.Group>
                      </Col>
                      <Col md={3}>
                        <Form.Group className="mb-3">
                          <Form.Label>Short Name</Form.Label>
                          <Form.Control
                            value={formData.shortName}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                shortName: e.target.value,
                              })
                            }
                            placeholder="Enter short name"
                          />
                        </Form.Group>
                      </Col>
                      <Col md={3}>
                        <Form.Group className="mb-3">
                          <Form.Label>Business Type</Form.Label>
                          <Form.Select
                            value={formData.businessType}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                businessType: e.target.value,
                              })
                            }
                          >
                            <option value="">SELECT</option>
                            <option value="Type1">Type1</option>
                            <option value="Type2">Type2</option>
                          </Form.Select>
                        </Form.Group>
                      </Col>
                      <Col md={3}>
                        <Form.Group className="mb-3">
                          <Form.Label>Company Type</Form.Label>
                          <Form.Select
                            value={formData.companyType}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                companyType: e.target.value,
                              })
                            }
                          >
                            <option value="">SELECT</option>
                            <option value="TypeA">TypeA</option>
                            <option value="TypeB">TypeB</option>
                          </Form.Select>
                        </Form.Group>
                      </Col>
                    </Row>
                    <Row>
                      <Col md={3}>
                        <Form.Group className="mb-3">
                          <Form.Label>Company Code</Form.Label>
                          <Form.Control
                            value={formData.companyCode}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                companyCode: e.target.value,
                              })
                            }
                            placeholder="Enter company code"
                          />
                        </Form.Group>
                      </Col>
                      <Col md={3}>
                        <Form.Group className="mb-3">
                          <Form.Label>Agent URL</Form.Label>
                          <Form.Control
                            value={formData.agentUrl}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                agentUrl: e.target.value,
                              })
                            }
                            placeholder="Enter agent URL"
                          />
                        </Form.Group>
                      </Col>
                      <Col md={3}>
                        <Form.Group className="mb-3">
                          <Form.Label>First Name</Form.Label>
                          <Form.Control
                            value={formData.authorizedPersonFirstName}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                authorizedPersonFirstName: e.target.value,
                              })
                            }
                            placeholder="Enter first name"
                          />
                        </Form.Group>
                      </Col>
                      <Col md={3}>
                        <Form.Group className="mb-3">
                          <Form.Label>Last Name</Form.Label>
                          <Form.Control
                            value={formData.authorizedPersonLastName}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                authorizedPersonLastName: e.target.value,
                              })
                            }
                            placeholder="Enter last name"
                          />
                        </Form.Group>
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>

                <Row>
                  <Col md={8}>
                    <Card className="mb-3">
                      <Card.Header>Contact Details</Card.Header>
                      <Card.Body>
                        <Row>
                          <Col md={6}>
                            <Form.Group className="mb-3">
                              <Form.Label>Agent Email</Form.Label>
                              <Form.Control
                                value={formData.agentEmail}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    agentEmail: e.target.value,
                                  })
                                }
                                placeholder="Enter email"
                              />
                            </Form.Group>
                          </Col>
                          <Col md={6}>
                            <Form.Group className="mb-3">
                              <Form.Label>Zip Code</Form.Label>
                              <Form.Control
                                value={formData.zipCode}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    zipCode: e.target.value,
                                  })
                                }
                                placeholder="Enter zip code"
                              />
                            </Form.Group>
                          </Col>
                        </Row>

                        <Row>
                          <Col md={6}>
                            <Form.Group className="mb-3">
                              <Form.Label>Mobile Number</Form.Label>
                              <Form.Control
                                value={formData.mobileNumber}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    mobileNumber: e.target.value,
                                  })
                                }
                                placeholder="Enter mobile number"
                              />
                            </Form.Group>
                          </Col>
                          <Col md={6}>
                            <Form.Group className="mb-3">
                              <Form.Label>Telephone Number</Form.Label>
                              <Form.Control
                                value={formData.telephoneNumber}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    telephoneNumber: e.target.value,
                                  })
                                }
                                placeholder="Enter telephone number"
                              />
                            </Form.Group>
                          </Col>
                        </Row>
                        <Row>
                          <Col md={6}>
                            <Form.Group className="mb-3">
                              <Form.Label>Contact Person</Form.Label>
                              <Form.Control
                                value={formData.contactPerson}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    contactPerson: e.target.value,
                                  })
                                }
                                placeholder="Enter contact person"
                              />
                            </Form.Group>
                          </Col>
                          <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Country</Form.Label>
                          <Form.Select
                            value={formData.country}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                country: e.target.value,
                              })
                            }
                          >
                            <option value="">SELECT</option>
                            <option value="Country1">Country1</option>
                            <option value="Country2">Country2</option>
                          </Form.Select>
                        </Form.Group>
                        </Col>
                        </Row>
                          <Row>
                             
                          <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Province</Form.Label>
                          <Form.Select
                            value={formData.province}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                province: e.target.value,
                              })
                            }
                          >
                            <option value="">SELECT</option>
                            <option value="Province1">Province1</option>
                            <option value="Province2">Province2</option>
                          </Form.Select>
                        </Form.Group>
                        </Col>
  <Col md={6}>
  
   <Form.Group className="mb-3">
                          <Form.Label>City</Form.Label>
                          <Form.Select
                            value={formData.city}
                            onChange={(e) =>
                              setFormData({ ...formData, city: e.target.value })
                            }
                          >
                            <option value="">SELECT</option>
                            <option value="City1">City1</option>
                            <option value="City2">City2</option>
                          </Form.Select>
                        </Form.Group>
  </Col>

                        </Row>
                         <Col md={12}>
                            <Form.Group className="mb-3">
                              <Form.Label>Address</Form.Label>
                              <Form.Control
                                value={formData.address}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    address: e.target.value,
                                  })
                                }
                                placeholder="Enter address"
                              />
                            </Form.Group>
                          </Col>
                       
                      </Card.Body>
                    </Card>
                  </Col>
                  
                  <Col md={4}>
                    <Card className="mb-3">
                      <Card.Header>Settings</Card.Header>
                      <Card.Body>
                        <Form.Group className="mb-3">
                          <Form.Label>Markup</Form.Label>
                          <Form.Select
                            value={formData.markup}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                markup: e.target.value,
                              })
                            }
                          >
                            <option value="">SELECT</option>
                            <option value="Markup1">Markup1</option>
                            <option value="Markup2">Markup2</option>
                          </Form.Select>
                        </Form.Group>
                        <Form.Group className="mb-3">
                          <Form.Label>Currency</Form.Label>
                          <Form.Select
                            value={formData.currency}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                currency: e.target.value,
                              })
                            }
                          >
                            <option value="">SELECT</option>
                            <option value="USD">USD</option>
                            <option value="EUR">EUR</option>
                          </Form.Select>
                        </Form.Group>
                        <Form.Group className="mb-3">
                          <Form.Label>Status</Form.Label>
                          <Form.Select
                            value={formData.status}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                status: e.target.value,
                              })
                            }
                          >
                            <option value="">SELECT</option>
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                          </Form.Select>
                        </Form.Group>
                      </Card.Body>
                    </Card>
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
                variant="secondary"
                onClick={closeModal}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                className="btn-indigo"
                onClick={editing ? handleEdit : saveAgent}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    ></span>
                    {editing ? "Updating..." : "Saving..."}
                  </>
                ) : editing ? (
                  "Update"
                ) : (
                  "Save"
                )}
              </Button>
            </Modal.Footer>
          </Modal>
        </main>
      </div>
    </div>
  );
};

export default AgentReg;
