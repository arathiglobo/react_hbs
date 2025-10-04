
import React from 'react';
import Sidebar from '../components/Sidebar';
import LineChart from '../components/LineChart';
import BarChart from '../components/BarChart';
import { Container, Row, Col, Button, Card, ProgressBar } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';

const kpiData = {
  totalBookings: 1245,
  todaysBookings: 85,
  totalRevenue: 58300,
  activeAgents: 112,
  hotelsListed: 342,
  apiBookings: 413
};

const bookingsLabels = ['Aug 1','Aug 2','Aug 3','Aug 4','Aug 5'];
const bookingsData = [20,35,50,40,65];
const revenueData = [3000,4800,5500,4000,6800];

// Credit summary shown on the left card (values can be wired to API later)
const creditSummaryBase = {
  creditLimit: 4889,
  used: 4275.4
};
const creditSummary = {
  ...creditSummaryBase,
  available: Number((creditSummaryBase.creditLimit - creditSummaryBase.used).toFixed(1)),
  usedPercent: Math.min(
    100,
    Math.round((creditSummaryBase.used / (creditSummaryBase.creditLimit || 1)) * 100)
  )
};

export default function AgentDashboard(){
  const navigate = useNavigate();
  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar/>
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
        {/* <div className="d-flex justify-content-between align-items-center mb-4">
          <h1 className="h3">Agent</h1>
         
        </div> */}

        <Container fluid>
          {/* Credit summary (left) and Quick Access (right) */}
          <Row className="g-4 mb-4">
            <Col lg={7}>
              <Card className="h-100 shadow-sm">
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <div className="h6 mb-0">Credit Limit Used : {creditSummary.usedPercent}%</div>
                  </div>
                  <ProgressBar
                    now={creditSummary.usedPercent}
                    variant={creditSummary.usedPercent > 80 ? 'danger' : 'success'}
                    className="mb-3"
                  />
                  <div className="d-flex flex-wrap gap-4">
                    <div>
                      <span className="text-muted">Credit :</span>{' '}
                      <span className="fw-semibold">{creditSummary.creditLimit}</span>
                    </div>
                    <div>
                      <span className="text-muted">Used :</span>{' '}
                      <span className="fw-semibold">{creditSummary.used}</span>
                    </div>
                    <div>
                      <span className="text-muted">Available Limit :</span>{' '}
                      <span className="fw-semibold text-danger">{creditSummary.available}</span>
                    </div>
                  </div>
                </Card.Body>
              </Card>
            </Col>
            <Col lg={5}>
              <Card className="h-100 shadow-sm">
                <Card.Body>
                  <div className="h6 mb-3">Quick Access</div>
                  <div className="d-flex flex-wrap gap-2">
                    <Button className="btn-indigo" onClick={()=>navigate('/new-booking/hotel')}>New Booking</Button>
                    <Button className="btn-green" onClick={()=>navigate('/inhouse-accounts/agent')}>Accounts</Button>
                    <Button className="btn-yellow" onClick={()=>navigate('/calender')}>Calendar</Button>
                 </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          <Row xs={1} sm={2} lg={3} className="g-4 mb-3">
            <Col><KpiCard title="Total Bookings" value={kpiData.totalBookings} /></Col>
            <Col><KpiCard title="Today's Bookings" value={kpiData.todaysBookings} /></Col>
            <Col><KpiCard title="Total Revenue" value={`$${kpiData.totalRevenue.toLocaleString()}`} /></Col>
            <Col><KpiCard title="Active Agents" value={kpiData.activeAgents} /></Col>
            <Col><KpiCard title="Hotels Listed" value={kpiData.hotelsListed} /></Col>
            <Col><KpiCard title="API Bookings" value={kpiData.apiBookings} /></Col>
          </Row>

          <Row className="g-4">
            <Col lg={6}>
              <Card className="h-100">
                <Card.Body>
                  <Card.Title>Bookings Over Time</Card.Title>
                  <LineChart labels={bookingsLabels} data={bookingsData} />
                </Card.Body>
              </Card>
            </Col>
            <Col lg={6}>
              <Card className="h-100">
                <Card.Body>
                  <Card.Title>Revenue Trends</Card.Title>
                  <BarChart labels={bookingsLabels} data={revenueData} />
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Container>
        </main>
      </div>
    </div>
  );
}

function KpiCard({title, value}){
  return (
    <Card className="shadow-sm rounded-xl p-3 h-100">
      <div className="text-muted">{title}</div>
      <div className="h4 fw-bold">{value}</div>
    </Card>
  );
}
