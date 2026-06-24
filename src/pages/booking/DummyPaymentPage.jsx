import React, { useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { Container, Card, Form, Row, Col, Button } from "react-bootstrap";
import { FaLock, FaArrowLeft, FaCreditCard } from "react-icons/fa";
import toast from "react-hot-toast";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";

// Dummy gateway-branded card-entry page reached from the hotel booking
// online-payment flow (/payment/:gateway). This is a placeholder only —
// no real charge is made; "Pay Now" just shows a demo confirmation.
const GATEWAY_LABELS = {
  razorpay: "Razorpay",
  stripe: "Stripe",
  payu: "PayU",
};

export default function DummyPaymentPage() {
  const { gateway } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const gatewayName =
    location.state?.gatewayName || GATEWAY_LABELS[gateway] || gateway || "Gateway";
  const amountLabel = location.state?.amountLabel || "";

  const [card, setCard] = useState({
    name: "",
    number: "",
    expiry: "",
    cvv: "",
  });
  const [processing, setProcessing] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCard((prev) => ({ ...prev, [name]: value }));
  };

  const handlePay = (e) => {
    e.preventDefault();
    setProcessing(true);
    // Dummy — no real gateway call. Simulate a brief processing delay.
    setTimeout(() => {
      setProcessing(false);
      toast.success(`Payment successful via ${gatewayName} (demo)`);
      navigate(-1);
    }, 1200);
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Container style={{ maxWidth: 560 }}>
            <Button
              variant="link"
              className="text-decoration-none mb-3 px-0"
              onClick={() => navigate(-1)}
            >
              <FaArrowLeft className="me-2" />
              Back
            </Button>

            <Card className="shadow-sm border-0">
              <Card.Header className="bg-white border-0 pt-4 px-4">
                <div className="d-flex justify-content-between align-items-center">
                  <h5 className="fw-bold mb-0 d-flex align-items-center">
                    <FaCreditCard className="me-2 text-primary" />
                    {gatewayName} Checkout
                  </h5>
                  <span className="badge bg-warning-subtle text-warning">
                    Demo
                  </span>
                </div>
                {amountLabel && (
                  <div className="mt-2">
                    <span className="text-muted small">Amount payable: </span>
                    <span className="fw-bold">{amountLabel}</span>
                  </div>
                )}
              </Card.Header>
              <Card.Body className="px-4 pb-4">
                <Form onSubmit={handlePay}>
                  <Form.Group className="mb-3">
                    <Form.Label className="small fw-semibold text-muted">
                      Cardholder Name
                    </Form.Label>
                    <Form.Control
                      name="name"
                      value={card.name}
                      onChange={handleChange}
                      placeholder="Name on card"
                      required
                    />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label className="small fw-semibold text-muted">
                      Card Number
                    </Form.Label>
                    <Form.Control
                      name="number"
                      value={card.number}
                      onChange={handleChange}
                      placeholder="1234 5678 9012 3456"
                      inputMode="numeric"
                      maxLength={19}
                      required
                    />
                  </Form.Group>
                  <Row className="g-3">
                    <Col xs={6}>
                      <Form.Group>
                        <Form.Label className="small fw-semibold text-muted">
                          Expiry
                        </Form.Label>
                        <Form.Control
                          name="expiry"
                          value={card.expiry}
                          onChange={handleChange}
                          placeholder="MM/YY"
                          maxLength={5}
                          required
                        />
                      </Form.Group>
                    </Col>
                    <Col xs={6}>
                      <Form.Group>
                        <Form.Label className="small fw-semibold text-muted">
                          CVV
                        </Form.Label>
                        <Form.Control
                          name="cvv"
                          value={card.cvv}
                          onChange={handleChange}
                          placeholder="123"
                          inputMode="numeric"
                          maxLength={4}
                          type="password"
                          required
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  <Button
                    type="submit"
                    variant="success"
                    className="w-100 mt-4 d-flex align-items-center justify-content-center"
                    disabled={processing}
                  >
                    {processing ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                          aria-hidden="true"
                        />
                        Processing...
                      </>
                    ) : (
                      <>
                        <FaLock className="me-2" />
                        Pay {amountLabel}
                      </>
                    )}
                  </Button>
                  <div className="text-center text-muted small mt-3">
                    <FaLock className="me-1" />
                    This is a demo checkout — no real payment is processed.
                  </div>
                </Form>
              </Card.Body>
            </Card>
          </Container>
        </main>
      </div>
    </div>
  );
}
