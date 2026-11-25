import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import BackButton from "../../components/BackButton";
import { Row, Col, Card, Form, Button, Table, Modal } from "react-bootstrap";
import axiosInstance from "../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import HotelFilter from "../../components/filters/Hotelfilters";
import MarketType from "../../components/filters/MarketType";
import { escapeHtml } from "../../utils/safeHtml";
import { csvCell } from "../../utils/csvSafe";

export default function Contractrate() {
  const [allContracts, setAllContracts] = useState([]);
  const [marketTypes, setMarketTypes] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const initialFilters = {
    fromDate: "",
    toDate: "",
    marketType: "",
    hotelId: "",
  };
  const [filters, setFilters] = useState(initialFilters);

  // Booking-level search filters (sent to the search API) — a contract is
  // listed when its hotel has at least one matching booking. The From/To Date
  // under Contract Details filters the contract validity instead.
  const initialBookingFilters = {
    bookingDateFrom: "",
    bookingDateTo: "",
    deadlineDateFrom: "",
    deadlineDateTo: "",
    reconfirmDateFrom: "",
    reconfirmDateTo: "",
    cancelDateFrom: "",
    cancelDateTo: "",
    status: "",
    bookingType: "",
  };
  const [tempBookingFilters, setTempBookingFilters] = useState(initialBookingFilters);

  // Filters behind the contracts on screen (set on Search / Reset), so the
  // mailed report matches the list even if the inputs were edited afterwards
  // without searching again.
  const [appliedFilters, setAppliedFilters] = useState({});

  // Mail modal
  const [showMailModal, setShowMailModal] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [isSending, setIsSending] = useState(false);

  const updateBookingFilter = (field, value) =>
    setTempBookingFilters((prev) => ({ ...prev, [field]: value }));

  // Fetches contract rates; all filters are optional query params
  const fetchContracts = async (allFilters = {}) => {
    const params = {};
    Object.entries(allFilters).forEach(([key, value]) => {
      const trimmed = typeof value === "string" ? value.trim() : value;
      if (trimmed !== "" && trimmed !== null && trimmed !== undefined) {
        params[key] = trimmed;
      }
    });
    const res = await axiosInstance.get("/api/reports/contract-rate/search", { params });
    return Array.isArray(res.data) ? res.data : [];
  };

  // Fetch initial contract data
  useEffect(() => {
    const loadInitial = async () => {
      try {
        setAllContracts(await fetchContracts());
      } catch (e) {
        console.error(e);
      }
    };
    loadInitial();
  }, []);

  // Fetch market types for display purposes
  useEffect(() => {
    const fetchMarketTypes = async () => {
      try {
        const res = await axiosInstance.get("/api/marketType");
        setMarketTypes(res.data?.filter((i) => !i.isDeleted) || []);
      } catch (e) {
        console.error("Failed to load market types");
      }
    };
    fetchMarketTypes();
  }, []);

  const getMarketTypeNames = (ids) => {
    if (!Array.isArray(ids) || ids.length === 0) return "N/A";
    return ids
      .map((id) => marketTypes.find((m) => m.marketTypeId === id)?.name || id)
      .join(", ");
  };

  // "search here" box: narrows the contracts on screen by the text they show
  // (rate code, market type, validity, room type and rates). Print, PDF,
  // Excel and Mail all use this narrowed list.
  const [searchQuery, setSearchQuery] = useState("");
  const needle = searchQuery.trim().toLowerCase();
  const contracts = !needle
    ? allContracts
    : allContracts.filter((c) => {
        const texts = [
          c.rateCode,
          getMarketTypeNames(c.markeType),
          ...(c.contractRateValidityDTO || []).flatMap((v) => [v.validityFrom, v.validityTo]),
          ...(c.contractRateRoomDTO || []).flatMap((r) => [
            r.meal ? "Room with Breakfast" : "Room Only",
            r.rate,
            r.adultRate,
            r.childRate,
          ]),
        ];
        return texts.some(
          (t) => t !== null && t !== undefined && String(t).toLowerCase().includes(needle)
        );
      });

  const handleSearch = async () => {
    setSearchLoading(true);
    // Contract filters + booking-level filters, all applied server-side
    const searched = { ...filters, ...tempBookingFilters };
    setAppliedFilters(searched);
    try {
      const data = await fetchContracts(searched);
      setAllContracts(data);
      toast.success(`Found ${data.length} contract(s)`);
    } catch (e) {
      toast.error("Failed to fetch contracts");
      setAllContracts([]);
    }
    setSearchLoading(false);
  };

  const handleReset = async () => {
    setFilters(initialFilters);
    setTempBookingFilters(initialBookingFilters);
    setAppliedFilters({});
    setSearchQuery("");
    try {
      setAllContracts(await fetchContracts());
    } catch (e) {
      console.error(e);
      setAllContracts([]);
    }
  };

  const openMailModal = () => {
    if (!contracts.length) {
      toast.error("No data available to email");
      return;
    }
    setShowMailModal(true);
  };

  const handleSendEmail = async () => {
    if (!emailAddress || !/^\S+@\S+\.\S+$/.test(emailAddress)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsSending(true);
    try {
      // The server re-runs the search with the filters behind the list and
      // applies the "search here" text the same way the screen does
      const response = await axiosInstance.post("/api/reports/send-email", {
        email: emailAddress,
        reportType: "contractrate",
        filters: { ...appliedFilters, searchQuery },
        recordCount: contracts.length,
      });
      if (response.data) {
        const sentCount = response.data.recordCount ?? contracts.length;
        toast.success(`Report with ${sentCount} contract(s) sent successfully!`);
        setShowMailModal(false);
        setEmailAddress("");
      }
    } catch (error) {
      console.error("Email send error:", error);
      toast.error(error.response?.data?.message || "Failed to send mail");
    } finally {
      setIsSending(false);
    }
  };

  const handlePrint = () => {
    if (!contracts.length) return toast.error("No data to print");

    const win = window.open("", "_blank");
    let html = `
      <html>
        <head>
          <title>Contract Rate Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            h1 { text-align: center; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <h1>Contract Rate Report</h1>
    `;

    contracts.forEach((c) => {
      html += `
        <h4>Rate Code: ${escapeHtml(c.rateCode || "N/A")}</h4>
        <p><b>Market Type:</b> ${escapeHtml(getMarketTypeNames(c.markeType))}</p>
        <p><b>Validity:</b><br>${
          c.contractRateValidityDTO?.map(
            (v) => `${escapeHtml(v.validityFrom)} to ${escapeHtml(v.validityTo)}<br>`
          ) || "N/A"
        }</p>

        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Single</th>
              <th>Double</th>
              <th>EB Adult</th>
              <th>EB Child</th>
            </tr>
          </thead>
          <tbody>
      `;

      c.contractRateRoomDTO?.forEach((r) => {
        html += `
          <tr>
            <td>${escapeHtml(r.meal ? "Room with Breakfast" : "Room Only")}</td>
            <td>${escapeHtml(r.rate || "-")}</td>
            <td>${escapeHtml(r.rate || "-")}</td>
            <td>${escapeHtml(r.adultRate || "-")}</td>
            <td>${escapeHtml(r.childRate || "-")}</td>
          </tr>
        `;
      });

      html += `</tbody></table><br><hr>`;
    });

    html += `</body></html>`;
    win.document.write(html);
    win.document.close();
    win.print();
  };

  const handlePDF = () => {
    if (!contracts.length) {
      toast.error("No data available to export");
      return;
    }

    const doc = new jsPDF();
    doc.text("Contract Rate Report", 20, 20);

    contracts.forEach((c, idx) => {
      let yPos = 30;
      
      if (idx > 0) {
        doc.addPage();
        yPos = 20;
      }

      doc.text(`Rate Code: ${c.rateCode || "N/A"}`, 20, yPos);
      yPos += 10;
      doc.text(`Market Type: ${getMarketTypeNames(c.markeType)}`, 20, yPos);
      yPos += 10;
      
      if (c.contractRateValidityDTO?.length > 0) {
        doc.text("Validity:", 20, yPos);
        yPos += 7;
        c.contractRateValidityDTO.forEach((v) => {
          doc.text(`${v.validityFrom} to ${v.validityTo}`, 25, yPos);
          yPos += 7;
        });
      }

      if (c.contractRateRoomDTO?.length > 0) {
        const tableData = c.contractRateRoomDTO.map((r) => [
          r.meal ? "Room with Breakfast" : "Room Only",
          r.rate || "-",
          r.rate || "-",
          r.adultRate || "-",
          r.childRate || "-",
        ]);

        autoTable(doc, {
          head: [["Type", "Single", "Double", "EB Adult", "EB Child"]],
          body: tableData,
          startY: yPos + 5,
          margin: { left: 20 },
        });
      }
    });

    doc.save("contract-rate-report.pdf");
    toast.success("PDF downloaded successfully");
  };

  const handleExcel = () => {
    if (!contracts.length) {
      toast.error("No data available to export");
      return;
    }

    // csvCell neutralises text a spreadsheet would run as a formula.
    const escapeCSV = (value) => csvCell(value);

    let csvRows = [];
    
    contracts.forEach((c) => {
      csvRows.push(`Rate Code: ${escapeCSV(c.rateCode || "N/A")}`);
      csvRows.push(`Market Type: ${escapeCSV(getMarketTypeNames(c.markeType))}`);
      
      if (c.contractRateValidityDTO?.length > 0) {
        csvRows.push("Validity:");
        c.contractRateValidityDTO.forEach((v) => {
          csvRows.push(`${escapeCSV(v.validityFrom)} to ${escapeCSV(v.validityTo)}`);
        });
      }

      csvRows.push("Type,Single,Double,EB Adult,EB Child");
      if (c.contractRateRoomDTO?.length > 0) {
        c.contractRateRoomDTO.forEach((r) => {
          csvRows.push([
            escapeCSV(r.meal ? "Room with Breakfast" : "Room Only"),
            escapeCSV(r.rate || "-"),
            escapeCSV(r.rate || "-"),
            escapeCSV(r.adultRate || "-"),
            escapeCSV(r.childRate || "-"),
          ].join(","));
        });
      }
      
      csvRows.push(""); // Empty line between contracts
    });

    const csv = csvRows.join("\n");
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contract-rate-report.csv";
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("Excel file downloaded successfully");
  };

  // Filter grid: 4 equal columns on wide screens (xxl), 2 per row below, so
  // Booking Details and Contract Details line up field under field.
  const filterCol = { md: 6, xxl: 3 };

  // From/To date pair. minWidth 0 lets the two inputs share their column
  // instead of spilling into the next field; the slimmer right padding keeps
  // "dd-mm-yyyy" and the calendar icon visible at that width.
  const dateInputStyle = { minWidth: 0, paddingRight: "0.5rem" };

  return (
    <div className="bg-light d-flex flex-column" style={{ minHeight: "100vh" }}>
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />

        <main className="flex-grow-1 p-4" style={{ overflow: "auto" }}>
          <Card className="shadow-sm rounded-xl">
            <Card.Header className="d-flex align-items-center gap-2">
              <BackButton forceFallback fallback="/adminDashboard" />
              <span className="fw-semibold">Contract Rate Report</span>
            </Card.Header>

            {/* Filters */}
            <div className="p-4 bg-light border-bottom">
              <h6 className="fw-bold text-primary mb-3">Booking Details</h6>
              <Row className="align-items-end g-4 mb-4">

                {/* Booking Date / Cancel Date / Status / Service Type, on the
                    same grid as Contract Details below */}
                <Col {...filterCol}>
                  <Form.Group className="mb-0">
                    <Form.Label className="small mb-2">Booking Date</Form.Label>
                    <div className="d-flex gap-2">
                      <Form.Control type="date" size="sm" title="From" style={dateInputStyle}
                        value={tempBookingFilters.bookingDateFrom}
                        onChange={(e) => updateBookingFilter("bookingDateFrom", e.target.value)} />
                      <Form.Control type="date" size="sm" title="To" style={dateInputStyle}
                        value={tempBookingFilters.bookingDateTo}
                        onChange={(e) => updateBookingFilter("bookingDateTo", e.target.value)} />
                    </div>
                  </Form.Group>
                </Col>
              {/*  <Col md={4}>
                  <Form.Group className="mb-0">
                    <Form.Label className="small mb-2">Cancellation Deadline Date</Form.Label>
                    <div className="d-flex gap-2">
                      <Form.Control type="date" size="sm" title="From"
                        value={tempBookingFilters.deadlineDateFrom}
                        onChange={(e) => updateBookingFilter("deadlineDateFrom", e.target.value)} />
                      <Form.Control type="date" size="sm" title="To"
                        value={tempBookingFilters.deadlineDateTo}
                        onChange={(e) => updateBookingFilter("deadlineDateTo", e.target.value)} />
                    </div>
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className="mb-0">
                    <Form.Label className="small mb-2">Reconfirm Date</Form.Label>
                    <div className="d-flex gap-2">
                      <Form.Control type="date" size="sm" title="From"
                        value={tempBookingFilters.reconfirmDateFrom}
                        onChange={(e) => updateBookingFilter("reconfirmDateFrom", e.target.value)} />
                      <Form.Control type="date" size="sm" title="To"
                        value={tempBookingFilters.reconfirmDateTo}
                        onChange={(e) => updateBookingFilter("reconfirmDateTo", e.target.value)} />
                    </div>
                  </Form.Group>
                </Col>  */}

                <Col {...filterCol}>
                  <Form.Group className="mb-0">
                    <Form.Label className="small mb-2">Cancel Date</Form.Label>
                    <div className="d-flex gap-2">
                      <Form.Control type="date" size="sm" title="From" style={dateInputStyle}
                        value={tempBookingFilters.cancelDateFrom}
                        onChange={(e) => updateBookingFilter("cancelDateFrom", e.target.value)} />
                      <Form.Control type="date" size="sm" title="To" style={dateInputStyle}
                        value={tempBookingFilters.cancelDateTo}
                        onChange={(e) => updateBookingFilter("cancelDateTo", e.target.value)} />
                    </div>
                  </Form.Group>
                </Col>
                <Col {...filterCol}>
                  <Form.Group className="mb-0">
                    <Form.Label className="small mb-2">Status</Form.Label>
                    <Form.Select size="sm"
                      value={tempBookingFilters.status}
                      onChange={(e) => updateBookingFilter("status", e.target.value)}>
                      <option value="">ALL</option>
                      <option value="REQUESTED">Requested</option>
                      <option value="CONFIRMED">Confirmed</option>
                      <option value="RECONFIRMED">ReConfirmed</option>
                      <option value="SOLD_OUT">Sold Out</option>
                      <option value="CANCELLED">Cancelled</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col {...filterCol}>
                  <Form.Group className="mb-0">
                    <Form.Label className="small mb-2">Service Type</Form.Label>
                    <Form.Select size="sm"
                      value={tempBookingFilters.bookingType}
                      onChange={(e) => updateBookingFilter("bookingType", e.target.value)}>
                      <option value="">All Services</option>
                      <option value="NORMAL">Normal</option>
                      <option value="LAST_MINUTE">Last Minute</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>

              <h6 className="fw-bold text-primary mb-3">Contract Details</h6>
              <Row className="align-items-end g-4">
                <Col {...filterCol}>
                  <Form.Group className="mb-0">
                    <Form.Label className="small mb-2">From Date</Form.Label>
                    <Form.Control
                      type="date"
                      size="sm"
                      value={filters.fromDate}
                      onChange={(e) =>
                        setFilters({ ...filters, fromDate: e.target.value })
                      }
                    />
                  </Form.Group>
                </Col>

                <Col {...filterCol}>
                  <Form.Group className="mb-0">
                    <Form.Label className="small mb-2">To Date</Form.Label>
                    <Form.Control
                      type="date"
                      size="sm"
                      value={filters.toDate}
                      onChange={(e) =>
                        setFilters({ ...filters, toDate: e.target.value })
                      }
                    />
                  </Form.Group>
                </Col>

                <Col {...filterCol}>
                  <MarketType
                    value={filters.marketType}
                    onChange={(value) =>
                      setFilters({ ...filters, marketType: value || "" })
                    }
                  />
                </Col>

                <Col {...filterCol}>
                  <HotelFilter
                    value={filters.hotelId}
                    onChange={(value) =>
                      setFilters({ ...filters, hotelId: value })
                    }
                  />
                </Col>
              </Row>

              {/* One line: "search here" box on the left;
                  Search / Reset / Mail / Print / PDF / Excel on the right */}
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="search here"
                  className="form-control form-control-sm"
                  style={{ width: "200px" }}
                />

                <div className="d-flex gap-2 flex-wrap">
                  <Button
                    variant="success"
                    size="sm"
                    style={{ backgroundColor: "#676767", borderColor: "#676767", minWidth: "100px" }}
                    onClick={handleSearch}
                    disabled={searchLoading}
                  >
                    {searchLoading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Searching...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-search me-1"></i>Search
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    style={{ minWidth: "100px" }}
                    onClick={handleReset}
                    disabled={searchLoading}
                  >
                    <i className="fas fa-undo me-1"></i>Reset
                  </Button>
                  <Button variant="outline-primary" size="sm" onClick={openMailModal}>
                    <i className="fas fa-envelope me-1"></i>Mail
                  </Button>
                  <Button variant="outline-secondary" size="sm" onClick={handlePrint}>
                    <i className="fas fa-print me-1"></i>Print
                  </Button>
                  <Button variant="outline-danger" size="sm" onClick={handlePDF}>
                    <i className="fas fa-file-pdf me-1"></i>PDF
                  </Button>
                  <Button variant="outline-success" size="sm" onClick={handleExcel}>
                    <i className="fas fa-file-excel me-1"></i>Excel
                  </Button>
                </div>
              </div>
            </div>

            {/* Results */}
            <Card.Body className="p-0 mt-1">
              {contracts.length > 0 ? (
                contracts.map((c, idx) => (
                  <div key={idx} className="mb-4">
                    <h5 className="text-center">Contract Rate</h5>

                    <Row className="mb-3">
                      <Col md={4}>
                        <b>Market Type:</b>
                        <p>{getMarketTypeNames(c.markeType)}</p>
                      </Col>
                      <Col md={4}>
                        <b>Validity:</b>
                        {c.contractRateValidityDTO?.map((v, i) => (
                          <p key={i}>{v.validityFrom} - {v.validityTo}</p>
                        ))}
                      </Col>
                      <Col md={4}>
                        <b>Rate Code:</b>
                        <p>{c.rateCode || "N/A"}</p>
                      </Col>
                    </Row>

                    {c.contractRateRoomDTO?.length > 0 ? (
                      <Table bordered>
                        <thead>
                          <tr>
                            <th>Type</th>
                            <th>Single</th>
                            <th>Double</th>
                            <th>EB Adult</th>
                            <th>EB Child</th>
                          </tr>
                        </thead>
                        <tbody>
                          {c.contractRateRoomDTO.map((r, i) => (
                            <tr key={i}>
                              <td>{r.meal ? "Room with Breakfast" : "Room Only"}</td>
                              <td>{r.rate}</td>
                              <td>{r.rate}</td>
                              <td>{r.adultRate}</td>
                              <td>{r.childRate}</td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    ) : (
                      <p className="text-muted text-center">
                        No room rate data
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-center text-muted">No contract data</p>
              )}
            </Card.Body>
          </Card>

          <Modal show={showMailModal} onHide={() => !isSending && setShowMailModal(false)} centered>
            <Modal.Header closeButton={!isSending}>
              <Modal.Title>Send Report via Email</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form onSubmit={(e) => { e.preventDefault(); handleSendEmail(); }}>
                <Form.Group className="mb-3">
                  <Form.Label>Email Address<span className="text-danger">*</span></Form.Label>
                  <Form.Control
                    type="email"
                    placeholder="Enter recipient email address"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    disabled={isSending}
                  />
                </Form.Group>
              </Form>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" type="button" onClick={() => setShowMailModal(false)} disabled={isSending}>
                Cancel
              </Button>
              <Button variant="success" type="button" onClick={handleSendEmail} disabled={isSending || !emailAddress}>
                {isSending ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Sending...
                  </>
                ) : (
                  <>
                    <i className="fas fa-paper-plane me-1"></i>Send Email
                  </>
                )}
              </Button>
            </Modal.Footer>
          </Modal>
        </main>
      </div>
    </div>
  );
}
