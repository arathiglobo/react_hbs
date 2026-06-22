import React from 'react'

const DashboardRedirections = (role, navigate) => {


  const dashboards = {
    "ADMIN": "/adminDashboard",
    "AGENT": "/agentDashboard",
    "STAFF": "/staffDashboard",
    "EXTRANET":"/extranetDashboard",
    // Restaurant manager portal — same /auth/login flow as the others,
    // role distinguishes destination. Created via /auth/register with
    // userType = RESTAURANT_EXTRANET (UserAccountService.createRestaurantUser).
    "RESTAURANT_EXTRANET": "/restaurant-extranet/dashboard",
    // Add more roles as needed
  };

  const dashboardPath = dashboards[role] || "/landingPage";
  navigate(dashboardPath);
  return (
    <div></div>
  )
}

export default DashboardRedirections;