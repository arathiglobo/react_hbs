import React, { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";

const PrivateRoute = ({ children, roles }) => {
  const location = useLocation();
  const token = localStorage.getItem("authToken");

  // Check if token exists and is not empty
  const isAuthenticated = token && token.trim() !== "" && token !== "null" && token !== "undefined";

  // Debug logging (remove in production)
  useEffect(() => {
    if (!isAuthenticated) {
      console.log("PrivateRoute: No valid token found, redirecting to login");
      console.log("Current location:", location.pathname);
    }
  }, [isAuthenticated, location.pathname]);

  if (!isAuthenticated) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  // Optional role restriction: when a `roles` list is given, the current
  // active role must be in it — otherwise send the user to their dashboard.
  if (Array.isArray(roles) && roles.length > 0) {
    const storedRoles = (localStorage.getItem("userRole") || "")
      .split(",")
      .map((role) => role.trim().toLowerCase());
    const currentRole =
      localStorage.getItem("currentActiveRole")?.toLowerCase() ||
      storedRoles[0] ||
      "";

    if (!roles.includes(currentRole)) {
      const dashboardByRole = {
        admin: "/adminDashboard",
        agent: "/agentDashboard",
        staff: "/staffDashboard",
        extranet: "/extranetDashboard",
      };
      return <Navigate to={dashboardByRole[currentRole] || "/"} replace />;
    }
  }

  return children;
};

export default PrivateRoute;
