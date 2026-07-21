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

    // super_admin inherits every admin-gated route so tightening a route
    // to roles={["admin"]} never accidentally locks super_admin out. Routes
    // that are strictly SUPER_ADMIN-only should list roles={["super_admin"]}.
    const superAdminInheritsAdmin =
      currentRole === "super_admin" && roles.includes("admin");
    if (!roles.includes(currentRole) && !superAdminInheritsAdmin) {
      const dashboardByRole = {
        admin: "/adminDashboard",
        agent: "/agentDashboard",
        staff: "/staffDashboard",
        extranet: "/extranetDashboard",
        super_admin: "/superAdminDashboard",
      };
      return <Navigate to={dashboardByRole[currentRole] || "/"} replace />;
    }
  }

  return children;
};

export default PrivateRoute;
