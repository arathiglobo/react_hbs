import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom"; // ✅ Import Link
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import axiosInstance from "../components/AxiosInstance";
import {
  FaUser,
  FaImages,
  FaClipboardList,
  FaCalendarCheck,
} from "react-icons/fa";

const ExtranetHotelDashboard = () => {
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const userName =
          localStorage.getItem("UserName") ||
          sessionStorage.getItem("UserName");
        if (userName) {
          const response = await axiosInstance.get(
            `/api/personalProfile/${userName}`,
          );
          console.log("Profile Data:", response.data);
          setUserId(response.data.id);
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      }
    };

    fetchProfile();
  }, []);

  return (
    <div className="d-flex">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-grow-1">
        {/* Topbar */}
        <TopBar />

        {/* Dashboard Content */}
        <div className="container-fluid mt-4">
          <h3 className="fw-bold mb-5">Hotel Dashboard</h3>

          {/* Top Four Colored Cards */}
          <div className="d-flex flex-wrap gap-4 mb-5 justify-content-start">
            {/* My Profile */}
            <Link
              to={userId ? `/registration/hotel/create/${userId}` : "#"} // ✅ Redirect to Profile page
              className="text-decoration-none"
              onClick={(e) => !userId && e.preventDefault()}
            >
              <div
                className="card bg-primary text-white p-2 rounded-4 shadow-sm flex-grow-1 d-flex align-items-center justify-content-center flex-column hover-shadow"
                style={{ minWidth: "200px", cursor: "pointer" }}
              >
                <FaUser size={45} className="mb-3" />
                <h5 className="fw-semibold mb-0 text-white">My Profile</h5>
              </div>
            </Link>

            {/* My Pics */}
            <Link to={`/extranet-images`} className="text-decoration-none">
              <div
                className="card bg-success text-white p-2 rounded-4 shadow-sm flex-grow-1 d-flex align-items-center justify-content-center flex-column hover-shadow"
                style={{ minWidth: "200px", cursor: "pointer" }}
              >
                <FaImages size={45} className="mb-3" />
                <h5 className="fw-semibold mb-0 text-white">My Pics</h5>
              </div>
            </Link>

            {/* My Bookings */}
            <Link
              to="/hotelBookings" // ✅ Redirect to Bookings page
              className="text-decoration-none"
            >
              <div
                className="card bg-warning text-white p-2 rounded-4 shadow-sm flex-grow-1 d-flex align-items-center justify-content-center flex-column hover-shadow"
                style={{ minWidth: "200px", cursor: "pointer" }}
              >
                <FaClipboardList size={45} className="mb-3" />
                <h5 className="fw-semibold mb-0 text-white">My Bookings</h5>
              </div>
            </Link>

            {/* My Availability */}
            <Link
              to="/hotelAvailability" // ✅ Redirect to Availability page
              className="text-decoration-none"
            >
              <div
                className="card bg-info text-white p-2 rounded-4 shadow-sm flex-grow-1 d-flex align-items-center justify-content-center flex-column hover-shadow"
                style={{ minWidth: "200px", cursor: "pointer" }}
              >
                <FaCalendarCheck size={45} className="mb-3" />
                <h5 className="fw-semibold mb-0 text-white">My Availability</h5>
              </div>
            </Link>
          </div>

          {/* Bottom Stats Cards */}
          <div className="row g-4">
            <div className="col-md-3">
              <div className="card p-4 shadow-sm border-0 rounded-4 text-center">
                <h3 className="fw-bold text-primary mb-2">1245</h3>
                <p className="mb-0 fw-semibold text-secondary">
                  Total Bookings
                </p>
              </div>
            </div>

            <div className="col-md-3">
              <div className="card p-4 shadow-sm border-0 rounded-4 text-center">
                <h3 className="fw-bold text-primary mb-2">4</h3>
                <p className="mb-0 fw-semibold text-secondary">
                  Total Cancellations
                </p>
              </div>
            </div>

            <div className="col-md-3">
              <div className="card p-4 shadow-sm border-0 rounded-4 text-center">
                <h3 className="fw-bold text-primary mb-2">1</h3>
                <p className="mb-0 fw-semibold text-secondary">
                  Today's Check-In
                </p>
              </div>
            </div>

            <div className="col-md-3">
              <div className="card p-4 shadow-sm border-0 rounded-4 text-center">
                <h3 className="fw-bold text-primary mb-2">2</h3>
                <p className="mb-0 fw-semibold text-secondary">
                  Today's Check-Out
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExtranetHotelDashboard;
