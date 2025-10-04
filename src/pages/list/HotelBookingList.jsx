import React, { useEffect, useMemo, useState } from 'react';
import { Container, Row, Col, Card, Button, Form, Table, Badge, InputGroup, Pagination, Dropdown, Modal, FormCheck } from 'react-bootstrap';
import Sidebar from '../../components/Sidebar';
import TopBar from '../../components/TopBar';

// Demo rows – replace with API data later
const demoRows = Array.from({ length: 20 }, (_, i) => {
  const index = i + 1;
  const startDay = 10 + i;
  const endDay = startDay + 1;
  return {
    id: index,
    agentName: 'Globo Agent',
    customerName: `Customer ${index}`,
    bookingCode: `CNFAGT${1650 + i}`,
    referenceCode: `CNFS20250310052740${(900 + i).toString()}`,
    bookDate: `${String((i % 12) + 1).padStart(2, '0')}/${String((i % 28) + 1).padStart(2, '0')}/2025`,
    bookingDetails: `TEST HOTEL (ONLY FOR TESTING) ${startDay}/10/2025 - ${endDay}/10/2025`,
    deadlineDate: `2025-10-${String(10 + (i % 10)).padStart(2, '0')}`,
    notification: 'Not Confirmed',
    status: ['upcoming', 'completed', 'cancelled'][i % 3],
  };
});

const PER_PAGE_OPTIONS = [10, 25, 50, 100];

function getCurrentMonthValue() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export default function HotelBookingList() {
  const [status, setStatus] = useState('upcoming');
  const [period, setPeriod] = useState(getCurrentMonthValue());
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [month, setMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [query, setQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [perPage, setPerPage] = useState(PER_PAGE_OPTIONS[0]);
  const [page, setPage] = useState(1);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [sortColumn, setSortColumn] = useState('id');
  const [sortDirection, setSortDirection] = useState('asc');
  const [showBulkActions, setShowBulkActions] = useState(false);

  // When year or month changes, update period (YYYY-MM)
  useEffect(() => {
    setPeriod(`${year}-${month}`);
  }, [year, month]);

  // Debounce search input
  useEffect(() => {
    const id = setTimeout(() => setQuery(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  // Update bulk actions visibility
  useEffect(() => {
    setShowBulkActions(selectedRows.size > 0);
  }, [selectedRows]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const base = demoRows; // In real case, filter by status/period server-side
    if (!normalized) return base;
    return base.filter((r) =>
      [
        r.agentName,
        r.customerName,
        r.bookingCode,
        r.referenceCode,
        r.bookingDetails,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalized)
    );
  }, [query, status, period]);

  const sortedRows = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let aVal = a[sortColumn];
      let bVal = b[sortColumn];
      
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortColumn, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = sortedRows.slice((currentPage - 1) * perPage, currentPage * perPage);

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedRows(new Set(pagedRows.map(row => row.id)));
    } else {
      setSelectedRows(new Set());
    }
  };

  const handleSelectRow = (rowId, checked) => {
    const newSelected = new Set(selectedRows);
    if (checked) {
      newSelected.add(rowId);
    } else {
      newSelected.delete(rowId);
    }
    setSelectedRows(newSelected);
  };

  const handleBulkAction = (action) => {
    console.log(`Bulk ${action} for rows:`, Array.from(selectedRows));
    // Implement bulk actions here
    setSelectedRows(new Set());
  };

  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case 'upcoming': return 'primary';
      case 'completed': return 'success';
      case 'cancelled': return 'danger';
      default: return 'secondary';
    }
  };

  const getNotificationBadgeVariant = (notification) => {
    switch (notification) {
      case 'Confirmed': return 'success';
      case 'Not Confirmed': return 'warning';
      case 'Cancelled': return 'danger';
      default: return 'secondary';
    }
  };

  const SortIcon = ({ column }) => {
    if (sortColumn !== column) return <span className="text-muted">↕</span>;
    return sortDirection === 'asc' ? <span>↑</span> : <span>↓</span>;
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Container fluid className="px-0 booking-list-container">
            {/* Header Section */}
            <div className="d-flex justify-content-between align-items-center mb-4">
              <div>
                <h1 className="h3 mb-1 fw-bold text-dark">Hotel Bookings</h1>
                <p className="text-muted mb-0">Manage and track all hotel reservations</p>
              </div>
              <Button 
                variant="primary" 
                size="lg"
                className="d-flex align-items-center gap-2 px-4 py-2 fw-semibold"
                style={{ borderRadius: '12px', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.15)' }}
              >
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                New Booking
              </Button>
            </div>

            {/* Bulk Actions Bar */}
            {showBulkActions && (
              <Card className="border-0 shadow-sm mb-4" style={{ borderRadius: '16px', backgroundColor: '#f8fafc' }}>
                <Card.Body className="p-3">
                  <div className="d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center gap-3">
                      <span className="fw-semibold text-primary">
                        {selectedRows.size} item{selectedRows.size !== 1 ? 's' : ''} selected
                      </span>
                      <Button 
                        variant="outline-secondary" 
                        size="sm"
                        onClick={() => setSelectedRows(new Set())}
                      >
                        Clear Selection
                      </Button>
                    </div>
                    <div className="d-flex gap-2">
                      <Dropdown>
                        <Dropdown.Toggle variant="outline-primary" size="sm">
                          Bulk Actions
                        </Dropdown.Toggle>
                        <Dropdown.Menu>
                          <Dropdown.Item onClick={() => handleBulkAction('approve')}>
                            <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20" className="me-2">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Approve Selected
                          </Dropdown.Item>
                          <Dropdown.Item onClick={() => handleBulkAction('reject')}>
                            <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20" className="me-2">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                            Reject Selected
                          </Dropdown.Item>
                          <Dropdown.Divider />
                          <Dropdown.Item onClick={() => handleBulkAction('export')}>
                            <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20" className="me-2">
                              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                            Export Selected
                          </Dropdown.Item>
                        </Dropdown.Menu>
                      </Dropdown>
                    </div>
                  </div>
                </Card.Body>
              </Card>
            )}

            {/* Filters Card */}
            <Card className="border-0 shadow-sm mb-4" style={{ borderRadius: '16px' }}>
              <Card.Body className="p-4">
                <Row className="g-4">
                  {/* Booking Type Filter */}
                  <Col lg={6}>
                    <div className="mb-3">
                      <label className="form-label fw-semibold text-dark mb-2">Booking Status</label>
                      <div className="d-flex flex-wrap gap-2">
                        {[
                          { value: 'upcoming', label: 'Upcoming', icon: '📅' },
                          { value: 'completed', label: 'Completed', icon: '✅' },
                          { value: 'cancelled', label: 'Cancelled', icon: '❌' }
                        ].map((option) => (
                          <Button
                            key={option.value}
                            variant={status === option.value ? 'primary' : 'outline-secondary'}
                            size="sm"
                            onClick={() => setStatus(option.value)}
                            className={`d-flex align-items-center gap-2 px-3 py-2 filter-button ${status === option.value ? 'active' : ''}`}
                            style={{ 
                              borderRadius: '10px',
                              border: status === option.value ? 'none' : '1px solid #e5e7eb',
                              fontWeight: '500'
                            }}
                          >
                            <span>{option.icon}</span>
                            {option.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </Col>

                  {/* Time Period Filter */}
                  <Col lg={6}>
                    <div className="mb-3">
                      <label className="form-label fw-semibold text-dark mb-2">Time Period</label>
                      <div className="d-flex gap-2">
                        <Form.Select 
                          value={month} 
                          onChange={(e) => setMonth(e.target.value)}
                          className="border-0 bg-light"
                          style={{ borderRadius: '10px', minWidth: '140px' }}
                        >
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                            <option key={m} value={String(m).padStart(2, '0')}>
                              {new Date(2024, m - 1).toLocaleDateString('en-US', { month: 'long' })}
                            </option>
                          ))}
                        </Form.Select>
                        <Form.Select 
                          value={year} 
                          onChange={(e) => setYear(e.target.value)}
                          className="border-0 bg-light"
                          style={{ borderRadius: '10px', minWidth: '100px' }}
                        >
                          {Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 3 + i).map((y) => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </Form.Select>
                      </div>
                    </div>
                  </Col>

                  {/* Search Filter */}
                  <Col lg={12}>
                    <div className="mb-0">
                      <label className="form-label fw-semibold text-dark mb-2">Search Bookings</label>
                      <InputGroup className="border-0 bg-light search-input" style={{ borderRadius: '12px' }}>
                        <InputGroup.Text className="border-0 bg-transparent">
                          <svg width="18" height="18" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                          </svg>
                        </InputGroup.Text>
                        <Form.Control 
                          placeholder="Search by agent, customer, booking code, or details..." 
                          value={searchInput} 
                          onChange={(e) => setSearchInput(e.target.value)}
                          className="border-0 bg-transparent"
                          style={{ fontSize: '0.95rem' }}
                        />
                        {searchInput && (
                          <Button 
                            variant="outline-secondary" 
                            size="sm" 
                            onClick={() => setSearchInput('')}
                            className="border-0 bg-transparent text-muted"
                          >
                            <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </Button>
                        )}
                      </InputGroup>
                    </div>
                  </Col>
                </Row>
              </Card.Body>
            </Card>

            {/* Results Card */}
            <Card className="border-0 shadow-sm" style={{ borderRadius: '16px' }}>
              <Card.Body className="p-0">
                {/* Table Header */}
                <div className="d-flex justify-content-between align-items-center p-4 border-bottom">
                  <div className="d-flex align-items-center gap-3">
                    <div className="d-flex align-items-center gap-2">
                      <span className="text-muted fw-medium">Show</span>
                      <Form.Select
                        value={perPage}
                        onChange={(e) => {
                          setPerPage(Number(e.target.value));
                          setPage(1);
                        }}
                        className="border-0 bg-light"
                        style={{ width: '80px', borderRadius: '8px' }}
                      >
                        {PER_PAGE_OPTIONS.map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </Form.Select>
                      <span className="text-muted fw-medium">entries</span>
                    </div>
                  </div>
                  
                  <div className="d-flex align-items-center gap-2">
                    <Badge bg="light" text="dark" className="px-3 py-2" style={{ borderRadius: '8px' }}>
                      <span className="fw-semibold">{sortedRows.length}</span> bookings found
                    </Badge>
                  </div>
                </div>

                {/* Table */}
                <div className="table-responsive">
                  <Table className="mb-0 align-middle booking-table" style={{ fontSize: '0.9rem' }}>
                    <thead className="table-light">
                      <tr>
                                                 <th style={{ width: '50px' }}>
                           <FormCheck
                             type="checkbox"
                             checked={selectedRows.size === pagedRows.length && pagedRows.length > 0}
                             onChange={(e) => handleSelectAll(e.target.checked)}
                           />
                         </th>
                        <th 
                          style={{ width: '60px', cursor: 'pointer' }}
                          onClick={() => handleSort('id')}
                          className="user-select-none"
                        >
                          <div className="d-flex align-items-center gap-1">
                            S.N <SortIcon column="id" />
                          </div>
                        </th>
                        <th 
                          style={{ cursor: 'pointer' }}
                          onClick={() => handleSort('agentName')}
                          className="user-select-none"
                        >
                          <div className="d-flex align-items-center gap-1">
                            Agent Name <SortIcon column="agentName" />
                          </div>
                        </th>
                        <th 
                          style={{ cursor: 'pointer' }}
                          onClick={() => handleSort('customerName')}
                          className="user-select-none"
                        >
                          <div className="d-flex align-items-center gap-1">
                            Customer Name <SortIcon column="customerName" />
                          </div>
                        </th>
                        <th 
                          style={{ cursor: 'pointer' }}
                          onClick={() => handleSort('bookingCode')}
                          className="user-select-none"
                        >
                          <div className="d-flex align-items-center gap-1">
                            Booking Code <SortIcon column="bookingCode" />
                          </div>
                        </th>
                        <th>Reference Code</th>
                        <th>Book Date</th>
                        <th>Booking Details</th>
                        <th>Deadline Date</th>
                        <th>Notification</th>
                        <th 
                          style={{ cursor: 'pointer' }}
                          onClick={() => handleSort('status')}
                          className="user-select-none"
                        >
                          <div className="d-flex align-items-center gap-1">
                            Status <SortIcon column="status" />
                          </div>
                        </th>
                        <th style={{ width: '120px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedRows.length === 0 ? (
                        <tr>
                          <td colSpan={12} className="text-center py-5">
                            <div className="empty-state">
                              <div className="empty-icon">📋</div>
                              <h5 className="empty-title">No bookings found</h5>
                              <p className="empty-description">Try adjusting your search criteria or filters</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        pagedRows.map((r, idx) => (
                          <tr key={r.id} className={selectedRows.has(r.id) ? 'table-primary' : ''}>
                                                         <td>
                               <FormCheck
                                 type="checkbox"
                                 checked={selectedRows.has(r.id)}
                                 onChange={(e) => handleSelectRow(r.id, e.target.checked)}
                               />
                             </td>
                            <td>{(currentPage - 1) * perPage + idx + 1}</td>
                            <td>{r.agentName}</td>
                            <td>{r.customerName}</td>
                            <td>{r.bookingCode}</td>
                            <td className="text-wrap-anywhere">{r.referenceCode}</td>
                            <td>{r.bookDate}</td>
                            <td className="text-wrap-anywhere">{r.bookingDetails}</td>
                            <td>{r.deadlineDate}</td>
                            <td>
                              <Badge bg="danger" pill>{r.notification}</Badge>
                            </td>
                            <td>
                              <Badge bg={getStatusBadgeVariant(r.status)} pill>{r.status}</Badge>
                            </td>
                            <td>
                              <Dropdown>
                                <Dropdown.Toggle variant="outline-secondary" size="sm">
                                  Actions
                                </Dropdown.Toggle>
                                <Dropdown.Menu>
                                  <Dropdown.Item>
                                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20" className="me-2">
                                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                    </svg>
                                    View Details
                                  </Dropdown.Item>
                                  <Dropdown.Item>
                                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20" className="me-2">
                                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                    </svg>
                                    Edit
                                  </Dropdown.Item>
                                  <Dropdown.Divider />
                                  <Dropdown.Item className="text-danger">
                                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20" className="me-2">
                                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2h.293l.853 10.24A2 2 0 007.138 18h5.724a2 2 0 001.992-1.76L15.707 6H16a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zm-3.707 4l.833 10h7.748l.833-10H5.293z" clipRule="evenodd" />
                                    </svg>
                                    Delete
                                  </Dropdown.Item>
                                </Dropdown.Menu>
                              </Dropdown>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </Table>
                </div>

                {/* Pagination Footer */}
                <div className="d-flex justify-content-between align-items-center p-4 border-top">
                  <div className="text-muted">
                    Showing <span className="fw-semibold">{(currentPage - 1) * perPage + 1}</span> to{' '}
                    <span className="fw-semibold">{Math.min(currentPage * perPage, sortedRows.length)}</span> of{' '}
                    <span className="fw-semibold">{sortedRows.length}</span> entries
                  </div>
                  
                  <Pagination className="mb-0">
                    <Pagination.Prev 
                      onClick={() => setPage((p) => Math.max(1, p - 1))} 
                      disabled={currentPage === 1}
                      className="border-0"
                      style={{ borderRadius: '8px' }}
                    />
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <Pagination.Item 
                        key={p} 
                        active={p === currentPage} 
                        onClick={() => setPage(p)}
                        className="border-0 mx-1"
                        style={{ borderRadius: '8px' }}
                      >
                        {p}
                      </Pagination.Item>
                    ))}
                    <Pagination.Next 
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))} 
                      disabled={currentPage === totalPages}
                      className="border-0"
                      style={{ borderRadius: '8px' }}
                    />
                  </Pagination>
                </div>
              </Card.Body>
            </Card>
          </Container>
        </main>
      </div>
    </div>
  );
}