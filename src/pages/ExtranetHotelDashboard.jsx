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

 const stats = [
  { label: "Total Bookings", value: 1245, delta: "+12%", deltaType: "up" },
  { label: "Cancellations", value: 4, delta: "-2%", deltaType: "down" },
  { label: "Check-In Today", value: 1, delta: "Today", deltaType: "neutral" },
  { label: "Check-Out Today", value: 2, delta: "Today", deltaType: "neutral" },
];

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">

     <TopBar />

      {/* Right column — topbar + scrollable content */}
      <div className="d-flex flex-grow-1">
 <Sidebar />
     
        {/* Scrollable page content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "32px 32px 48px" }}>

          {/* Page header */}
          <div style={{ marginBottom: "28px" }}>
            <h1 style={{ fontSize: "20px", fontWeight: 600, color: "#111827", margin: 0 }}>
              Hotel Dashboard
            </h1>
            <p style={{ fontSize: "13.5px", color: "#6B7280", marginTop: "4px" }}>
              Welcome back. Here's what's happening today.
            </p>
          </div>

          {/* ── Action cards ── */}
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
                  transition: "box-shadow 0.15s, border-color 0.15s",
                  cursor: "pointer",
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.07)";
                  e.currentTarget.style.borderColor = "#D1D5DB";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.borderColor = "#E5E7EB";
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
                  <div style={{ fontSize: "12.5px", color: "#6B7280", marginTop: "2px" }}>
                    {card.description}
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* ── Stat cards ── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "14px",
              marginBottom: "28px",
            }}
          >
            {stats.map((s) => (
              <div
                key={s.label}
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #E5E7EB",
                  borderRadius: "12px",
                  padding: "20px",
                }}
              >
                <div style={{ fontSize: "12px", color: "#6B7280", marginBottom: "8px" }}>
                  {s.label}
                </div>
                <div style={{ fontSize: "28px", fontWeight: 700, color: "#111827", lineHeight: 1 }}>
                  {s.value}
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    marginTop: "8px",
                    color:
                      s.deltaType === "up"
                        ? "#15803D"
                        : s.deltaType === "down"
                        ? "#B91C1C"
                        : "#6B7280",
                  }}
                >
                  {s.deltaType === "up" && "↑ "}
                  {s.deltaType === "down" && "↓ "}
                  {s.delta}
                </div>
              </div>
            ))}
          </div>

   

        </div>
      </div>
    </div>
  );
};

export default ExtranetHotelDashboard;