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

  // Show / hide toggles for each password field (eye icon).
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Small inline eye button shown inside each password field.
  const eyeBtnStyle = {
    border: "none",
    background: "none",
    color: "#6c757d",
    padding: "0 12px",
    zIndex: 5,
  };

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
      formErrors.newPassword = "Password must be at least 8 characters long";
    } else if (!/(?=.*[A-Z])(?=.*[0-9])/.test(formData.newPassword)) {
      // Same criteria as the agent-login password (registration/agent/view/:id)
      formErrors.newPassword =
        "Password must contain at least one uppercase letter and one number";
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
                <div className="position-relative">
                  <Form.Control
                    type={showOld ? "text" : "password"}
                    name="oldPassword"
                    placeholder="Enter old password"
                    value={formData.oldPassword}
                    onChange={handleChange}
                    isInvalid={!!errors.oldPassword}
                    style={{ paddingRight: 40 }}
                  />
                  <button
                    type="button"
                    className="btn btn-link position-absolute top-50 end-0 translate-middle-y"
                    style={eyeBtnStyle}
                    onClick={() => setShowOld((s) => !s)}
                    tabIndex={-1}
                    aria-label={showOld ? "Hide password" : "Show password"}
                  >
                    <i className={showOld ? "fas fa-eye-slash" : "fas fa-eye"}></i>
                  </button>
                </div>
                {errors.oldPassword && (
                  <div className="text-danger small mt-1">
                    {errors.oldPassword}
                  </div>
                )}
              </Form.Group>

              {/* New Password */}
              <Form.Group className="mb-3" controlId="newPassword">
                <Form.Label>New Password</Form.Label>
                <div className="position-relative">
                  <Form.Control
                    type={showNew ? "text" : "password"}
                    name="newPassword"
                    placeholder="Enter new password"
                    value={formData.newPassword}
                    onChange={handleChange}
                    isInvalid={!!errors.newPassword}
                    style={{ paddingRight: 40 }}
                  />
                  <button
                    type="button"
                    className="btn btn-link position-absolute top-50 end-0 translate-middle-y"
                    style={eyeBtnStyle}
                    onClick={() => setShowNew((s) => !s)}
                    tabIndex={-1}
                    aria-label={showNew ? "Hide password" : "Show password"}
                  >
                    <i className={showNew ? "fas fa-eye-slash" : "fas fa-eye"}></i>
                  </button>
                </div>
                {errors.newPassword && (
                  <div className="text-danger small mt-1">
                    {errors.newPassword}
                  </div>
                )}
              </Form.Group>

              {/* Confirm Password */}
              <Form.Group className="mb-4" controlId="confirmPassword">
                <Form.Label>Confirm Password</Form.Label>
                <div className="position-relative">
                  <Form.Control
                    type={showConfirm ? "text" : "password"}
                    name="confirmPassword"
                    placeholder="Confirm new password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    isInvalid={!!errors.confirmPassword}
                    style={{ paddingRight: 40 }}
                  />
                  <button
                    type="button"
                    className="btn btn-link position-absolute top-50 end-0 translate-middle-y"
                    style={eyeBtnStyle}
                    onClick={() => setShowConfirm((s) => !s)}
                    tabIndex={-1}
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                  >
                    <i className={showConfirm ? "fas fa-eye-slash" : "fas fa-eye"}></i>
                  </button>
                </div>
                {errors.confirmPassword && (
                  <div className="text-danger small mt-1">
                    {errors.confirmPassword}
                  </div>
                )}
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
