import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../../components/AxiosInstance";

const Logout = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const performLogout = async () => {
      try {
        await axiosInstance.post("/auth/logout", {}, { withCredentials: true });
      } catch {
        // Proceed with client-side cleanup even if the server call fails
      } finally {
        localStorage.removeItem("authToken");
        localStorage.removeItem("userRole");
        localStorage.removeItem("UserName");
        localStorage.removeItem("currentActiveRole");
        localStorage.removeItem("makeYourOwnPackageAgentId");
        navigate("/login", { replace: true });
      }
    };

    performLogout();
  }, [navigate]);

  return null;
};

export default Logout;
