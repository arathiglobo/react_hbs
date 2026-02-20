import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import { Row, Col, Card, Form, Button, Table } from "react-bootstrap";
import axiosInstance from "../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import HotelFilter from "../../components/filters/Hotelfilters";
import MarketType from "../../components/filters/MarketType";

export default function Contractrate() {
  const [contracts, setContracts] = useState([]);
  const [marketTypes, setMarketTypes] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [filters, setFilters] = useState({
    fromDate: "",
    toDate: "",
    marketType: "",
    hotelId: "",
  });

  // Fetch initial contract data
  useEffect(() => {
    const fetchContracts = async () => {
      try {
        const res = await axiosInstance.get("/api/reports/contract-rate/[id]");
        setContracts(res.data || []);
      } catch (e) {
        console.error(e);
      }
    };
    fetchContracts();
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

  const handleSearch = async () => {
    if (!filters.fromDate || !filters.toDate)
      return toast.error("Select From & To Dates");

    setSearchLoading(true);
    try {
      const params = new URLSearchParams({
        fromDate: filters.fromDate,
        toDate: filters.toDate,
        ...(filters.marketType && { marketType: filters.marketType }),
        ...(filters.hotelId && { hotelId: filters.hotelId }),
      }).toString();
      
      const res = await axiosInstance.get(`/api/hotelContractRate?${params}`);

      let data = Array.isArray(res.data) ? res.data : [];

      if (filters.marketType) {
        const id = Number(filters.marketType);
        data = data.filter((c) => (c.markeType || []).includes(id));
      }

      if (filters.hotelId) {
        data = data.filter((c) => String(c.hotelId) === String(filters.hotelId));
      }

      setContracts(data);
      toast.success(`Found ${data.length} contract(s)`);
    } catch (e) {
      toast.error("Failed to fetch contracts");
      setContracts([]);
    }
    setSearchLoading(false);
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
        <h4>Rate Code: ${c.rateCode || "N/A"}</h4>
        <p><b>Market Type:</b> ${getMarketTypeNames(c.markeType)}</p>
        <p><b>Validity:</b><br>${
          c.contractRateValidityDTO?.map(
            (v) => `${v.validityFrom} to ${v.validityTo}<br>`
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
            <td>${r.meal ? "Room with Breakfast" : "Room Only"}</td>
            <td>${r.rate || "-"}</td>
            <td>${r.rate || "-"}</td>
            <td>${r.adultRate || "-"}</td>
            <td>${r.childRate || "-"}</td>
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

    const escapeCSV = (v) => {
      const s = String(v || "");
      return (s.includes(",") || s.includes("\n") || s.includes('"'))
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

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

  return (
    <div className="bg-light d-flex flex-column" style={{ minHeight: "100vh" }}>
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />

        <main className="flex-grow-1 p-4" style={{ overflow: "auto" }}>
          <Card className="shadow-sm rounded-xl">
            <Card.Header>
              <span className="fw-semibold">Contract Rate Report</span>
            </Card.Header>

            {/* Filters */}
            <div className="p-4 bg-light border-bottom">
              <Row className="align-items-end g-4">
                <Col md={3}>
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

                <Col md={3}>
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

                <Col md={3}
>
                  <MarketType
                    value={filters.marketType}
                    onChange={(value) =>
                      setFilters({ ...filters, marketType: value || "" })
                    }
                  />
                </Col>

                <Col md={3}>
                  <HotelFilter
                    value={filters.hotelId}
                    onChange={(value) =>
                      setFilters({ ...filters, hotelId: value })
                    }
                  />
                </Col>
              </Row>

              <Row className="mt-3">
                <Col md={3}>
                  <Button
                    variant="success"
                    className="w-100"
                    size="sm"
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
                </Col>
              </Row>

              {/* Action Buttons */}
              <Row className="mt-4">
                <Col md={12} className="d-flex gap-2 justify-content-end">
                  <Button variant="outline-secondary" size="sm" onClick={handlePrint}>
                    <i className="fas fa-print me-1"></i>Print
                  </Button>
                </Col>
              </Row>
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
        </main>
      </div>
    </div>
  );
}
