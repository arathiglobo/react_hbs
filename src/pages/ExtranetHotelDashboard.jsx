import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import axiosInstance from "../components/AxiosInstance";
import {
  FaUser,
  FaImages,
  FaClipboardList,
  FaCalendarCheck,
} from "react-icons/fa";

const defaultStats = {
  totalBookings: 0,
  cancellations: 0,
  checkInToday: 0,
  checkOutToday: 0,
};

const ExtranetHotelDashboard = () => {
  const [userId, setUserId] = useState(null);
  const [stats, setStats] = useState(defaultStats);
  const [loadingStats, setLoadingStats] = useState(true);

  // ✅ Fetch profile (for navigation links only)
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const userName =
          localStorage.getItem("UserName") ||
          sessionStorage.getItem("UserName");

        if (userName) {
          const response = await axiosInstance.get(
            `/api/personalProfile/${userName}`
          );
          setUserId(response.data.id);
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      }
    };

    fetchProfile();
  }, []);

  // ✅ Fetch dashboard stats
  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        setLoadingStats(true);

        const response = await axiosInstance.get(
          "/api/dashboard/hotel/stats"
        );

        if (response.data && typeof response.data === "object") {
          setStats({
            totalBookings: response.data.totalBookings || 0,
            cancellations: response.data.cancellations || 0,
            checkInToday: response.data.checkInToday || 0,
            checkOutToday: response.data.checkOutToday || 0,
          });
        } else {
          setStats(defaultStats);
        }
      } catch (error) {
        console.error("Error fetching hotel dashboard stats:", error);
        setStats(defaultStats);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchDashboardStats();
  }, []);

  const actionCards = [
    {
      to: userId ? `/registration/hotel/create/${userId}` : "#",
      icon: <FaUser size={22} />,
      label: "My Profile",
      description: "Edit hotel details",
      iconBg: "#EFF6FF",
      iconColor: "#2563EB",
      onClick: (e) => !userId && e.preventDefault(),
    },
    {
      to: `/extranet/${userId}/gallery`,
      icon: <FaImages size={22} />,
      label: "Gallery",
      description: "Manage property photos",
      iconBg: "#F0FDF4",
      iconColor: "#16A34A",
    },
    {
      to: "/calendar",
      icon: <FaClipboardList size={22} />,
      label: "My Bookings",
      description: "View all reservations",
      iconBg: "#FFFBEB",
      iconColor: "#D97706",
    },
    {
      to: "/hotelAvailability",
      icon: <FaCalendarCheck size={22} />,
      label: "Availability",
      description: "Set room availability",
      iconBg: "#F5F3FF",
      iconColor: "#7C3AED",
    },
  ];

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />

      <div className="d-flex flex-grow-1">
        <Sidebar />

        <div style={{ flex: 1, overflowY: "auto", padding: "32px 32px 48px" }}>
          
          {/* Header */}
          <div style={{ marginBottom: "28px" }}>
            <h1 style={{ fontSize: "20px", fontWeight: 600, color: "#111827", margin: 0 }}>
              Hotel Dashboard
            </h1>
            <p style={{ fontSize: "13.5px", color: "#6B7280", marginTop: "4px" }}>
              Welcome back. Here's what's happening today.
            </p>
          </div>

          {/* Action Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "14px",
              marginBottom: "28px",
            }}
          >
            {actionCards.map((card) => (
              <Link
                key={card.label}
                to={card.to}
                className="text-decoration-none"
                onClick={card.onClick}
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #E5E7EB",
                  borderRadius: "12px",
                  padding: "20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "10px",
                    background: card.iconBg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: card.iconColor,
                  }}
                >
                  {card.icon}
                </div>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "#111827" }}>
                    {card.label}
                  </div>
                  <div style={{ fontSize: "12.5px", color: "#6B7280" }}>
                    {card.description}
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Stats Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "14px",
              marginBottom: "28px",
            }}
          >
            {loadingStats ? (
              <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "20px" }}>
                <span>Loading dashboard...</span>
              </div>
            ) : (
              <>
                <StatCard label="Total Bookings" value={stats.totalBookings} />
                <StatCard label="Cancellations" value={stats.cancellations} />
                <StatCard label="Check-In Today" value={stats.checkInToday} />
                <StatCard label="Check-Out Today" value={stats.checkOutToday} />
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

// ✅ Reusable Stat Card
function StatCard({ label, value }) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E5E7EB",
        borderRadius: "12px",
        padding: "20px",
      }}
    >
      <div style={{ fontSize: "12px", color: "#6B7280", marginBottom: "8px" }}>
        {label}
      </div>
      <div style={{ fontSize: "28px", fontWeight: 700, color: "#111827" }}>
        {value}
      </div>
    </div>
  );
}

export default ExtranetHotelDashboard;