import React, { useState } from "react";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import { Form, Button, Card, Alert } from "react-bootstrap";

const ChangePassword = () => {
  const [formData, setFormData] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState({});
  const [successMsg, setSuccessMsg] = useState("");

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" }); // clear error when typing
  };

  const validateForm = () => {
    let formErrors = {};

    if (!formData.oldPassword.trim()) {
      formErrors.oldPassword = "Old password is required";
    }
    if (!formData.newPassword.trim()) {
      formErrors.newPassword = "New password is required";
    }
    if (!formData.confirmPassword.trim()) {
      formErrors.confirmPassword = "Please confirm your new password";
    } else if (formData.newPassword !== formData.confirmPassword) {
      formErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(formErrors);
    return Object.keys(formErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSuccessMsg("");

    if (validateForm()) {
      console.log("Password data:", formData);
      setSuccessMsg("Password updated successfully!");
      setFormData({
        oldPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    }
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />

      <div className="d-flex flex-grow-1">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <main className="flex-grow-1 p-3" style={{ minWidth: 0, overflowX: "hidden" }}>
          {/* Content */}
          <div className="container mt-5 d-flex justify-content-center">
          <Card className="p-4 shadow-sm rounded-4" style={{ width: "450px" }}>
            <h4 className="fw-bold text-center mb-4">Change Password</h4>

            {successMsg && (
              <Alert variant="success" className="text-center">
                {successMsg}
              </Alert>
            )}

            <Form onSubmit={handleSubmit}>
              {/* Old Password */}
              <Form.Group className="mb-3" controlId="oldPassword">
                <Form.Label>Old Password</Form.Label>
                <Form.Control
                  type="password"
                  name="oldPassword"
                  placeholder="Enter old password"
                  value={formData.oldPassword}
                  onChange={handleChange}
                  isInvalid={!!errors.oldPassword}
                />
                <Form.Control.Feedback type="invalid">
                  {errors.oldPassword}
                </Form.Control.Feedback>
              </Form.Group>

              {/* New Password */}
              <Form.Group className="mb-3" controlId="newPassword">
                <Form.Label>New Password</Form.Label>
                <Form.Control
                  type="password"
                  name="newPassword"
                  placeholder="Enter new password"
                  value={formData.newPassword}
                  onChange={handleChange}
                  isInvalid={!!errors.newPassword}
                />
                <Form.Control.Feedback type="invalid">
                  {errors.newPassword}
                </Form.Control.Feedback>
              </Form.Group>

              {/* Confirm Password */}
              <Form.Group className="mb-4" controlId="confirmPassword">
                <Form.Label>Confirm Password</Form.Label>
                <Form.Control
                  type="password"
                  name="confirmPassword"
                  placeholder="Confirm new password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  isInvalid={!!errors.confirmPassword}
                />
                <Form.Control.Feedback type="invalid">
                  {errors.confirmPassword}
                </Form.Control.Feedback>
              </Form.Group>

              <div className="d-grid">
                <Button variant="primary" type="submit">
                  Update Password
                </Button>
              </div>
            </Form>
          </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ChangePassword;
