import React from 'react'

const DashboardRedirections = (role, navigate) => {


  const dashboards = {
    "ADMIN": "/adminDashboard",
    "AGENT": "/agentDashboard",
    "STAFF": "/staffDashboard",
    // Add more roles as needed
  };

  const dashboardPath = dashboards[role] || "/landingPage";
  navigate(dashboardPath);
  return (
    <div></div>
  )
}

export default DashboardRedirections;