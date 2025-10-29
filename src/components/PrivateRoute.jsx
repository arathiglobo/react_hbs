import React, { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";

const PrivateRoute = ({ children }) => {
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
  
  return children;
};

export default PrivateRoute;
