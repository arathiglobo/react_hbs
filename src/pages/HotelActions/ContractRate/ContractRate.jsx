import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Card,
  Button,
  Table,
  Spinner,
  Badge,
  Form,
  Pagination,
} from "react-bootstrap";
import { FaArrowLeft, FaPlus, FaEdit, FaTrash, FaEye } from "react-icons/fa";
import axiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import Sidebar from "../../../components/Sidebar";
import Topbar from "../../../components/TopBar";
import Swal from "sweetalert2";

export default function ContractRate() {
  const { id } = useParams(); // hotelId
  const navigate = useNavigate();
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(false);

  // Pagination and search states
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");
  const [searchTimeout, setSearchTimeout] = useState(null);

  // ✅ Fetch contract rates with pagination and search
  const fetchRates = async (pageNum = 0, searchTerm = search) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: "10",
      });
      if (searchTerm && searchTerm.trim()) {
        params.append("search", searchTerm.trim());
      }

      const res = await axiosInstance.get(`/api/hotelContractRate?${params}`);
      if (res.data && Array.isArray(res.data)) {
        setRates(res.data);
        if (res.data.length < 10) {
          setTotalPages(pageNum + 1);
        } else {
          setTotalPages(Math.max(totalPages, pageNum + 2));
        }
        setPage(pageNum);
      } else if (res.data.content) {
        setRates(res.data.content);
        setTotalPages(res.data.totalPages || 1);
        setPage(pageNum);
      } else {
        setRates([]);
        setTotalPages(0);
        setPage(0);
      }
    } catch (error) {
      console.error("Error loading contract rates:", error);
      toast.error("Failed to load contract rates");
      setRates([]);
      setTotalPages(0);
      setPage(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRates();
  }, []);

  // Search functionality with debounce
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    const timeout = setTimeout(() => {
      fetchRates(0, search);
    }, 500);
    setSearchTimeout(timeout);
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [search]);

  const handleCreate = () => {
    navigate(`/hotel-actions/hotel/${id}/contract-rate/create`);
  };

  const handleEdit = (rateId) => {
    navigate(`/hotel-actions/hotel/${id}/contract-rate/${rateId}/edit`);
  };

  const handleCopy = (rateId) => {
    navigate(`/hotel-actions/hotel/${id}/contract-rate/${rateId}/copy`);
  };

  const handleDelete = async (rateId, rateCode) => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: `You want to delete contract rate "${rateCode}"?`,
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
    });

    if (result.isConfirmed) {
      try {
        await axiosInstance.delete(`/api/hotelContractRate/${rateId}`);
        toast.success("Contract rate deleted successfully");
        fetchRates(page, search);
      } catch (error) {
        toast.error("Failed to delete contract rate");
        console.error("Delete error:", error);
      }
    }
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <div className="d-flex align-items-center gap-3 mb-3">
            <Button
              variant="outline-primary"
              onClick={() => navigate(`/hotel-details/${id}`)}
              className="d-flex align-items-center btn-sm gap-2"
            >
              <FaArrowLeft />
              Back
            </Button>
            <h3 className="mb-0">Contract Rates</h3>
          </div>

          <Card className="shadow-sm rounded-xl mb-3">
            <Card.Header className="d-flex justify-content-between align-items-center text-white">
              <span
                className="fw-semibold cursor-pointer text-primary"
                style={{ padding: "10px" }}
              >
                Contract Rates
              </span>
              <Form.Group className="hotel-search-bar position-relative">
                <Form.Control
                  type="text"
                  placeholder="Search contract rates..."
                  className="form-control-modern-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </Form.Group>
              <Button className="btn-green create-btn" onClick={handleCreate}>
                + Create
              </Button>
            </Card.Header>
            <Card.Body className="p-0">
              <Table
                striped
                bordered
                hover
                responsive
                className="mb-0 align-middle"
              >
                <thead>
                  <tr>
                    <th style={{ width: 100 }}>S/N</th>
                    <th>Rate Code</th>
                    <th>Market Type</th>
                    <th>Exclude Country</th>
                    <th>Season</th>
                    <th>Days</th>
                    <th>Validity Periods</th>
                    <th>Status</th>
                    <th style={{ width: 160 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="text-center py-4">
                        <Spinner animation="border" variant="primary" />
                      </td>
                    </tr>
                  ) : rates.length > 0 ? (
                    rates.map((rate, index) => (
                      <tr key={rate.contractrateId}>
                        <td>{index + 1 + page * 10}</td>
                        <td>
                       {rate.rateCode || "-"}
                        </td>
                        <td>
                          {rate.markeType && rate.markeType.length > 0
                            ? rate.markeType.map((type) => (
                                <Badge key={type.id} bg="info" className="me-1">
                                  {type.name}
                                </Badge>
                              ))
                            : "N/A"}
                        </td>
                        <td>
                          {rate.excludeCountry && rate.excludeCountry.length > 0
                            ? rate.excludeCountry.map((country) => (
                                <Badge
                                  key={country.id}
                                  bg="warning"
                                  className="me-1"
                                >
                                  {country.name}
                                </Badge>
                              ))
                            : "None"}
                        </td>
                        <td>
                          {/* <Badge bg="success"> */}
                            {rate.seasonName || rate.seasonId || "N/A"}
                          {/* </Badge> */}
                        </td>
                        <td>
                          {/* {rate.allDays ? (
                            <Badge bg="primary">All Days</Badge> 
                           ) : (
                            <div>
                              <Badge bg="secondary" className="me-1">
                                {rate.weekDay} Weekday
                              </Badge>
                              <Badge bg="secondary">
                                {rate.weekEndDay} Weekend
                              </Badge>
                            </div>
                          )} */}
                          {rate.allDays ? (
                            <span>All Days</span>
                          ) : (
                            <div>
                              <span>{rate.weekDay}</span>
                              <span className="ms-2">
                                {rate.weekEndDay}
                              </span>
                            </div>
                          )}
                        </td>
                        <td>
                          {rate.contractRateValidityDTO?.length ? (
                            <ul className="list-unstyled mb-0">
                              {rate.contractRateValidityDTO.map((v) => (
                                <li key={v.contractValidityId}>
                                  <small className="text-muted">
                                    {v.validityFrom} → {v.validityTo}
                                  </small>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-muted">No Validity</span>
                          )}
                        </td>
                        <td>
                          <Badge bg={rate.isLive ? "success" : "secondary"}>
                            {rate.isLive ? "Live" : "Draft"}
                          </Badge>
                        </td>
                        <td>
                           <div className="d-flex gap-2">
                              <FaEdit
                                className="text-primary"
                                style={{ cursor: "pointer", fontSize: "18px" }}
                                onClick={() => handleEdit(rate.contractrateId)}
                                title="Edit"
                              />
                             <FaTrash
                                className="text-danger"
                                style={{ cursor: "pointer", fontSize: "18px" }}
                                onClick={() =>  handleDelete(rate.contractrateId, rate.rateCode)}
                                title="Delete"
                              />
                            </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="text-center text-muted py-4">
                        <div className="py-3">
                          <FaPlus
                            className="text-muted mb-2"
                            style={{ fontSize: "2rem" }}
                          />
                          <div>No contract rates found</div>
                          <small>
                            Create your first contract rate to get started
                          </small>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </Card.Body>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="d-flex justify-content-center">
              <Pagination className="mb-0">
                <Pagination.Prev
                  disabled={page === 0}
                  onClick={() => fetchRates(page - 1, search)}
                />
                {[...Array(totalPages).keys()].map((num) => (
                  <Pagination.Item
                    key={num}
                    active={num === page}
                    onClick={() => fetchRates(num, search)}
                  >
                    {num + 1}
                  </Pagination.Item>
                ))}
                <Pagination.Next
                  disabled={page === totalPages - 1}
                  onClick={() => fetchRates(page + 1, search)}
                />
              </Pagination>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
