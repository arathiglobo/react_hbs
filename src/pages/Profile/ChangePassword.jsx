import React, { useState } from "react";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import { Form, Button, Card, Alert } from "react-bootstrap";
import Swal from "sweetalert2";
import axiosInstance from "../../components/AxiosInstance";
import { clearAuthStorage } from "../../components/SessionExpired";

const ChangePassword = () => {
  const [formData, setFormData] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState({});
  const [successMsg, setSuccessMsg] = useState("");
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" }); // clear error when typing
    setServerError("");
  };

  const validateForm = () => {
    let formErrors = {};

    if (!formData.oldPassword.trim()) {
      formErrors.oldPassword = "Old password is required";
    }
    if (!formData.newPassword.trim()) {
      formErrors.newPassword = "New password is required";
    } else if (formData.newPassword.length < 8) {
      formErrors.newPassword = "New password must be at least 8 characters";
    }
    if (!formData.confirmPassword.trim()) {
      formErrors.confirmPassword = "Please confirm your new password";
    } else if (formData.newPassword !== formData.confirmPassword) {
      formErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(formErrors);
    return Object.keys(formErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMsg("");
    setServerError("");

    if (!validateForm()) {
      return;
    }

    try {
      setSubmitting(true);
      await axiosInstance.post("/auth/change-password", {
        oldPassword: formData.oldPassword,
        newPassword: formData.newPassword,
      });

      setFormData({
        oldPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      // Force a re-login with the new credentials.
      await Swal.fire({
        title: "Password Changed",
        text: "Your password has been updated. Please log in again with your new password.",
        icon: "success",
        confirmButtonText: "OK",
      });
      clearAuthStorage();
      window.location.href = "/login";
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        "Could not change your password. Please try again.";
      setServerError(msg);
    } finally {
      setSubmitting(false);
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
          <Card className="p-4 shadow-sm rounded-4 w-100" style={{ maxWidth: "450px" }}>
            <h4 className="fw-bold text-center mb-4">Change Password</h4>

            {successMsg && (
              <Alert variant="success" className="text-center">
                {successMsg}
              </Alert>
            )}

            {serverError && (
              <Alert variant="danger" className="text-center">
                {serverError}
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
                <Button variant="primary" type="submit" disabled={submitting}>
                  {submitting ? "Updating..." : "Update Password"}
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
