import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import { Row, Col, Card, Form, Button, Table } from "react-bootstrap";
import axiosInstance from "../../components/AxiosInstance";
import { toast } from "react-hot-toast";

export default function Contractrate() {
  const [marketTypes, setMarketTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedMarketType, setSelectedMarketType] = useState("");
  const [hotels, setHotels] = useState([]);
  const [selectedHotel, setSelectedHotel] = useState("");
  const [contracts, setContracts] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [filters, setFilters] = useState({
    fromDate: '',
    toDate: ''
  });

  // Helper function to convert market type IDs to names
  const getMarketTypeNames = (marketTypeIds) => {
    if (!Array.isArray(marketTypeIds) || marketTypeIds.length === 0) {
      return "N/A";
    }
    
    const names = marketTypeIds.map(id => {
      const marketType = marketTypes.find(mt => mt.marketTypeId === Number(id));
      return marketType ? marketType.name : `ID ${id}`;
    });
    
    return names.join(", ");
  };

  const handleSearch = async () => {
    // Check if dates are selected
    if (!filters.fromDate || !filters.toDate) {
      toast.error("Please select both From and To dates");
      return;
    }

    setSearchLoading(true);
    try {
      // Build query parameters for dates
      const params = new URLSearchParams();
      if (filters.fromDate) params.append('fromDate', filters.fromDate);
      if (filters.toDate) params.append('toDate', filters.toDate);

      const queryString = params.toString();
      const url = `/api/hotelContractRate${queryString ? `?${queryString}` : ''}`;
      
      console.log('Fetching from URL:', url);
      
      const res = await axiosInstance.get(url);
      
      if (res && res.data !== undefined) {
        let contractsData = Array.isArray(res.data) ? res.data : [];
        
        // Filter by market type if selected (client-side filtering)
        if (selectedMarketType && contractsData.length > 0) {
          const selectedId = Number(selectedMarketType);
          const beforeCount = contractsData.length;
          
          contractsData = contractsData.filter(contract => {
            // Contract has markeType as array of numbers like [2], [5], [6]
            const contractMarketTypes = contract.markeType || contract.marketType || [];
            
            if (!Array.isArray(contractMarketTypes)) {
              return false;
            }
            
            // Check if the array includes the selected market type ID
            return contractMarketTypes.includes(selectedId);
          });
          
          const selectedMarketTypeName = marketTypes.find(mt => mt.marketTypeId === selectedId)?.name || `ID ${selectedId}`;
          console.log(`Filtered from ${beforeCount} to ${contractsData.length} contracts for market type: ${selectedMarketTypeName} (${selectedId})`);
        }
        
        setContracts(contractsData);
        
        if (contractsData.length === 0) {
          toast("No contract rates found matching your criteria", { icon: 'ℹ️' });
        } else {
          toast.success(`Found ${contractsData.length} contract rate(s)`);
        }
      } else {
        toast("No data returned from server", { icon: '⚠️' });
        setContracts([]);
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || "Failed to fetch contract rates";
      toast.error(errorMessage);
      console.error('Error details:', error);
      console.error('Error response:', error.response);
      setContracts([]);
    } finally {
      setSearchLoading(false);
    }
  };


  // Fetch market types from API
  useEffect(() => {
    const fetchMarketTypes = async () => {
      setLoading(true);
      try {
        const response = await axiosInstance.get('/api/marketType');
        if (response.data && Array.isArray(response.data)) {
          // Filter out deleted items
          const activeMarketTypes = response.data.filter(item => !item.isDeleted);
          setMarketTypes(activeMarketTypes);
        }
      } catch (error) {
        console.error('Error fetching market types:', error);
        toast.error("Failed to load market types");
      } finally {
        setLoading(false);
      }
    };

    fetchMarketTypes();
  }, []);

  // Print handler
  const handlePrint = () => {
    if (!contracts || contracts.length === 0) {
      toast.error("No contract rates to print");
      return;
    }

    const printWindow = window.open('', '_blank');
    let printContent = `
      <html>
        <head>
          <title>Contract Rate Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            h1 { text-align: center; margin-bottom: 20px; }
            .contract-section { margin-bottom: 30px; page-break-inside: avoid; }
            .contract-header { background-color: #e9ecef; padding: 10px; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Contract Rate Report</h1>
    `;

    contracts.forEach((contract, contractIdx) => {
      const marketTypeNames = getMarketTypeNames(contract.markeType || contract.marketType);
      const validityText = contract.contractRateValidityDTO && contract.contractRateValidityDTO.length > 0
        ? contract.contractRateValidityDTO.map(v => `${v.validityFrom} to ${v.validityTo}`).join('<br>')
        : 'N/A';

      printContent += `
        <div class="contract-section">
          <div class="contract-header">Contract ${contractIdx + 1}: ${contract.rateCode || 'N/A'}</div>
          <table>
            <tr><th style="width: 150px;">Market Type</th><td>${marketTypeNames}</td></tr>
            <tr><th>Rate Code</th><td>${contract.rateCode || 'N/A'}</td></tr>
            <tr><th>Validity</th><td>${validityText}</td></tr>
          </table>
      `;

      if (contract.contractRateRoomDTO && contract.contractRateRoomDTO.length > 0) {
        printContent += `
          <table>
            <thead>
              <tr>
                <th>Type Of Room</th>
                <th>Single</th>
                <th>Double</th>
                <th>EB Adult</th>
                <th>EB Child</th>
              </tr>
            </thead>
            <tbody>
        `;

        contract.contractRateRoomDTO.forEach((room, i) => {
          printContent += `
            <tr>
              <td>${room.meal ? "Room with Breakfast" : "Room Only"}</td>
              <td>${room.rate || "-"}</td>
              <td>${room.rate || "-"}</td>
              <td>${room.adultRate || "-"}</td>
              <td>${room.childRate || "-"}</td>
            </tr>
          `;
        });

        printContent += `
            </tbody>
          </table>
        </div>
        `;
      } else {
        printContent += `<p>No room rates available</p></div>`;
      }
    });

    printContent += `
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="bg-light d-flex flex-column" style={{ minHeight: "100vh" }}>
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />

        <main className="flex-grow-1 p-4" style={{ overflow: "auto" }}>
          <Card className="shadow-sm rounded-xl">
            <Card.Header>
              <span className="fw-semibold">Contract Report</span>
            </Card.Header>

            {/* Filters Section */}
            <div className="p-4 bg-light border-bottom">
              <Row className="align-items-end g-4">
                <Col md={3}>
                  <Form.Group className="mb-0">
                    <Form.Label className="small mb-2">From Date</Form.Label>
                    <Form.Control 
                      type="date" 
                      size="sm"
                      value={filters.fromDate}
                      onChange={(e) => setFilters({...filters, fromDate: e.target.value})}
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
                      onChange={(e) => setFilters({...filters, toDate: e.target.value})}
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group className="mb-0">
                    <Form.Label className="small mb-2">Market Type</Form.Label>
                    <Form.Select
                      size="sm"
                      value={selectedMarketType}
                      onChange={(e) => setSelectedMarketType(e.target.value)}
                      disabled={loading}
                    >
                      <option value="">Select</option>
                      {marketTypes.map((marketType) => (
                        <option key={marketType.marketTypeId} value={marketType.marketTypeId}>
                          {marketType.name}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group className="mb-0">
                    <Form.Label className="small mb-2">Hotel</Form.Label>
                    <Form.Select
                      size="sm"
                      value={selectedHotel}
                      onChange={(e) => setSelectedHotel(e.target.value)}
                    >
                      <option value="">Select</option>
                      {hotels.map((hotel) => (
                        <option key={hotel.hotelId || hotel.id} value={hotel.hotelId || hotel.id}>
                          {hotel.hotelName || hotel.name}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={12} className="d-flex justify-content-end gap-2 mt-3">
                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={() => {
                      setFilters({ fromDate: '', toDate: '' });
                      setSelectedMarketType('');
                      setSelectedHotel('');
                      setContracts([]);
                    }}
                  >
                    Clear
                  </Button>
                  <Button 
                    variant="success" 
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
              {contracts && contracts.length > 0 && (
                <Row className="mt-4">
                  <Col md={12} className="d-flex gap-2 justify-content-end">
                    <Button variant="outline-secondary" size="sm" onClick={handlePrint}>
                      <i className="fas fa-print me-1"></i>Print
                    </Button>
                  </Col>
                </Row>
              )}
            </div>

            {/* Results Section */}
            <Card.Body className="p-4">
              {contracts && contracts.length > 0 ? (
                contracts.map((contract, idx) => (
                  <div key={idx} className={idx > 0 ? "mt-4 pt-4 border-top" : ""}>
                    <h5 className="fw-bold text-center mb-3">Contract Rate</h5>
                    
                    <Row className="mb-3">
                      <Col md={4}>
                        <p className="mb-1"><strong>Market Type:</strong></p>
                        <p>{getMarketTypeNames(contract.markeType || contract.marketType)}</p>
                      </Col>
                      <Col md={4}>
                        <p className="mb-1"><strong>Validity:</strong></p>
                        <div>
                          {contract.contractRateValidityDTO && contract.contractRateValidityDTO.length > 0
                            ? contract.contractRateValidityDTO.map((v, i) => (
                                <div key={i} className="mb-1" style={{ fontSize: '0.9rem' }}>
                                  {v.validityFrom} to {v.validityTo}
                                </div>
                              ))
                            : <span className="text-muted">N/A</span>}
                        </div>
                      </Col>
                      <Col md={4}>
                        <p className="mb-1"><strong>Rate Code:</strong></p>
                        <p>{contract.rateCode || "N/A"}</p>
                      </Col>
                    </Row>

                    {contract.contractRateRoomDTO && contract.contractRateRoomDTO.length > 0 ? (
                      <Table responsive hover striped className="mb-0 align-middle">
                        <thead>
                          <tr>
                            <th>Type Of Room</th>
                            <th>Single</th>
                            <th>Double</th>
                            <th>EB Adult</th>
                            <th>EB Child</th>
                          </tr>
                        </thead>
                        <tbody>
                          {contract.contractRateRoomDTO.map((room, i) => (
                            <tr key={i}>
                              <td>{room.meal ? "Room with Breakfast" : "Room Only"}</td>
                              <td>{room.rate || "-"}</td>
                              <td>{room.rate || "-"}</td>
                              <td>{room.adultRate || "-"}</td>
                              <td>{room.childRate || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    ) : (
                      <p className="text-muted text-center">No room rates available</p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-center text-muted mb-0">
                  {contracts.length === 0 ? "No contract rates found. Please use the filters above to search for contract rates." : ""}
                </p>
              )}
            </Card.Body>
          </Card>

        </main>
      </div>
    </div>
  );
}
