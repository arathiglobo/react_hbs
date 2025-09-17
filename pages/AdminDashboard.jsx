
import React from 'react';
import Sidebar from '../components/Sidebar';
import LineChart from '../components/LineChart';
import BarChart from '../components/BarChart';
import { Container, Row, Col, Button, Card } from 'react-bootstrap';
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

export default function AdminDashboard(){
  const navigate = useNavigate();
  return (
    <div className="bg-light d-flex flex-column" style={{ minHeight: '100vh' }}>
      <TopBar/>
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4" style={{ overflow: 'auto' }}>
        <div className="mb-4">
          {/* <h1 className="h3">Admin </h1> */}
          <div className="d-flex flex-wrap gap-2">
            <Button className="btn-indigo" onClick={()=>navigate('/hotels/new')}>Add New Hotel</Button>
            <Button className="btn-green" onClick={()=>navigate('/agents/new')}>Add New Agent</Button>
            <Button className="btn-yellow" onClick={()=>navigate('/new-booking/hotel')}>Accommodation</Button>
            <Button className="btn-blue">Transfer</Button>
            <Button className="btn-pink">Tours & Activities</Button>
            <Button className="btn-purple">Agent Account</Button>
          </div>
        </div>

        <Container fluid className="px-0">
          <Row xs={1} sm={2} lg={3} className="g-4 mb-3 mx-0">
            <Col><KpiCard title="Total Bookings" value={kpiData.totalBookings} /></Col>
            <Col><KpiCard title="Today's Bookings" value={kpiData.todaysBookings} /></Col>
            <Col><KpiCard title="Total Revenue" value={`$${kpiData.totalRevenue.toLocaleString()}`} /></Col>
            <Col><KpiCard title="Active Agents" value={kpiData.activeAgents} /></Col>
            <Col><KpiCard title="Hotels Listed" value={kpiData.hotelsListed} /></Col>
            <Col><KpiCard title="API Bookings" value={kpiData.apiBookings} /></Col>
          </Row>

          <Row className="g-4 mx-0">
            <Col lg={6}>
              <Card className="h-100 border-0 shadow-sm">
                <Card.Body>
                  <Card.Title>Bookings Over Time</Card.Title>
                  <LineChart labels={bookingsLabels} data={bookingsData} />
                </Card.Body>
              </Card>
            </Col>
            <Col lg={6}>
              <Card className="h-100 border-0 shadow-sm">
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
    <Card className="shadow-sm rounded-xl p-3 h-100 border-0">
      <div className="text-muted">{title}</div>
      <div className="h4 fw-bold">{value}</div>
    </Card>
  );
}
