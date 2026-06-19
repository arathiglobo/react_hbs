import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import axiosInstance from "../components/AxiosInstance";
import {
  dashboardCss,
  DashboardHeader,
  DashboardFooter,
  QuickActions,
  KpiCard,
  formatNumber,
} from "./dashboardSkin";

const defaultStats = {
  totalBookings: 0,
  cancellations: 0,
  checkInToday: 0,
  checkOutToday: 0,
};

const ExtranetHotelDashboard = () => {
  const navigate = useNavigate();
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

        const response = await axiosInstance.get("/api/dashboard/hotel/stats");

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

  // Quick Actions — "My Profile" stays disabled until the profile id loads.
  const actions = [
    {
      label: "My Profile",
      icon: "user",
      onClick: userId
        ? () => navigate(`/registration/hotel/create/${userId}`)
        : undefined,
    },
    {
      label: "Gallery",
      icon: "image",
      onClick: userId ? () => navigate(`/extranet/${userId}/gallery`) : undefined,
    },
    { label: "My Bookings",  icon: "list",  onClick: () => navigate("/calendar") },
    { label: "Availability", icon: "check", onClick: () => navigate("/hotelAvailability") },
  ];

  return (
    <>
      <style>{dashboardCss}</style>
      <div className="dash-shell rw-dashboard">
        <TopBar />
        <div className="dash-body">
          <Sidebar />
          <main className="dash-main">

            {/* Header — hotels carry a country relation, so the regional
                clock displays the hotel's local time. */}
            <DashboardHeader title="Hotel Dashboard" />

            {/* ── Quick Actions ── */}
            <QuickActions actions={actions} />

            {/* ── Stats Grid ── */}
            <section>
              <p className="qa-label">Overview</p>
              {loadingStats ? (
                <div className="kpi-grid">
                  {[...Array(4)].map((_, i) => <div key={i} className="kpi-skeleton" />)}
                </div>
              ) : (
                <div className="kpi-grid">
                  <KpiCard title="Total Bookings"  icon="booking"  color="#6366f1" value={formatNumber(stats.totalBookings)} />
                  <KpiCard title="Cancellations"   icon="cancel"   color="#EC0B43" value={formatNumber(stats.cancellations)} />
                  <KpiCard title="Check-In Today"  icon="calendar" color="#10b981" value={formatNumber(stats.checkInToday)} />
                  <KpiCard title="Check-Out Today" icon="check"    color="#f59e0b" value={formatNumber(stats.checkOutToday)} />
                </div>
              )}
            </section>

          </main>
        </div>

        <DashboardFooter label="Hotel Dashboard" />
      </div>
    </>
  );
};

export default ExtranetHotelDashboard;
