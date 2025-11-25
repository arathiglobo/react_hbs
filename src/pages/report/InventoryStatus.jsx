import React from "react";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import { Row, Col, Card, Form, Button } from "react-bootstrap";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

export default function InventoryStatus() {
  return (
    <div className="bg-light d-flex flex-column" style={{ minHeight: "100vh" }}>
      {/* ✅ TopBar */}
      <TopBar />
      <div className="d-flex flex-grow-1">
        {/* ✅ Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <main className="flex-grow-1 p-3" style={{ overflow: "auto" }}>
          <Row>
            {/* Calendar */}
            <Col md={9}>
              <Card className="shadow-sm border-0 p-3">
                <FullCalendar
                  plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                  initialView="dayGridMonth"
                  headerToolbar={{
                    left: "prev,next today",
                    center: "title",
                    right: "dayGridMonth,timeGridWeek,timeGridDay",
                  }}
                  events={[]} // 🔹 API data can be mapped here
                  height="80vh"
                />
              </Card>
            </Col>

            {/* Search Criteria Sidebar */}
            <Col md={3}>
              <Card className="p-3 shadow-sm border-0">
                <h5 className="fw-bold text-primary mb-3">Search Criteria</h5>
                <Form>
                  <Form.Group className="mb-3">
                    <Form.Label>Hotel</Form.Label>
                    <Form.Select>
                      <option>Select Hotel</option>
                      <option>Test Hotel</option>
                      <option>City View Hotel</option>
                      <option>Sea Breeze Resort</option>
                    </Form.Select>
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>Room Category</Form.Label>
                    <Form.Select>
                      <option>Select Category</option>
                      <option>Deluxe Suite - DLX SUITE</option>
                      <option>Standard Room</option>
                      <option>Executive Suite</option>
                    </Form.Select>
                  </Form.Group>

                  <Button variant="success" className="w-100">
                    🔍 Search
                  </Button>
                </Form>
              </Card>
            </Col>
          </Row>
        </main>
      </div>
    </div>
  );
}
