import React, { useState } from "react";
import { Nav, Button, Offcanvas } from "react-bootstrap";
import { Link } from "react-router-dom";
  
let labelForDashboard = " ";

export default function Sidebar() {
  const [show, setShow] = useState(false);
  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);
  const [openGroups, setOpenGroups] = useState({});


  const toggleGroup = (groupKey) => {
  setOpenGroups((prev) => {
    const newOpenGroups = {};
    newOpenGroups[groupKey] = !prev[groupKey];
    return newOpenGroups;
  });
};

  // Get roles as an array
  const storedRoles = (localStorage.getItem("userRole") || "")
    .split(",")
    .map((role) => role.trim().toLowerCase());

  // Get current active role (this could also come from localStorage as "currentActiveRole")
  const currentRole = localStorage.getItem("currentActiveRole")?.toLowerCase() || storedRoles[0] || "";
   

  // Set dashboard path based on current active role
  let dashboardPath = "/";

  if (currentRole === "admin") {
    dashboardPath = "/adminDashboard";
    labelForDashboard = "Admin Dashboard"
  } else if (currentRole === "agent") {
    dashboardPath = "/agentDashboard";
    labelForDashboard = "Agent Dashboard"
  } else if (currentRole === "staff") {
    dashboardPath = "/staffDashboard";
    labelForDashboard = "Staff Dashboard"
  } else if (currentRole === "hotel") {
    dashboardPath = "/hotelDashboard";
    labelForDashboard = "Hotel Dashboard"
  }

  const items = [
    { label: labelForDashboard, to: dashboardPath , roles: ["admin", "agent", "staff", "hotel"]},
    {
      label: "Manage Masters",
      to: "/manage-masters",
      roles: ["admin"],
      groups: [
        {
          label: "Basic settings",
          children: [
            { label: "Designation", to: "/masters/designations" },
            { label: "Bank", to: "/masters/bank" },
            { label: "Assign Menu", to: "/masters/assign-menu" },
            { label: "Contact Type", to: "/masters/contact-type" },
            { label: "Markup Type", to: "/masters/markup-type" },
            { label: "Currency", to: "/masters/currency" },
          ],
        },
        {
          label: "Location settings",
          children: [
            { label: "Market Type", to: "/masters/market-type" },
            { label: "Region", to: "/masters/region" },
            { label: "Countries", to: "/masters/countries" },
            { label: "Province", to: "/masters/states" },
            { label: "Destinations", to: "/masters/destination" },
          ],
        },
        {
          label: "Mapping settings",
          children: [
            { label: "Country", to: "/masters/country-mapping" },
            { label: "City", to: "/masters/city-mapping" },
            { label: "Hotel", to: "/masters/hotel-mapping" },
          ],
        },
        {
          label: "UnMapping settings",
          children: [
            { label: "Country", to: "/masters/country-unmapping" },
            { label: "City", to: "/masters/city-unmapping" },
            { label: "Hotel", to: "/masters/hotel-unmapping" },
          ],
        },
        {
          label: "Hotel settings",
          children: [
            { label: "Hotel Category", to: "/masters/hotel-category" },
            { label: "Hotel Type", to: "/masters/hotel-type" },
            { label: "Occupancy Type", to: "/masters/occupancy-type" },
            { label: "Season Type", to: "/masters/season-type" },
            { label: "Room Category", to: "/masters/room-category" },
            { label: "Room Types", to: "/masters/room-types" },
            { label: "Hotel Amenities", to: "/masters/hotel-amenity" },
            { label: "Room Amenities", to: "/masters/room-amenity" },
            { label: "Meal Plans", to: "/masters/meal-plans" },
          ],
        },
        {
          label: "Agent settings",
          children: [
            { label: "Agent Category", to: "/masters/agent-category" },
          ],
        },
        {
          label: "Package settings",
          children: [
            { label: "Package Category", to: "/masters/package-category" },
            { label: "Package Type", to: "/masters/package-type" },
            { label: "Day Activity", to: "/masters/day-activity" },
            { label: "Itinerary Details", to: "/masters/itinerary-details" },
            { label: "Visa Information", to: "/masters/visa-information" },
            {
              label: "Terms and Conditions",
              to: "/masters/terms-and-conditions",
            },
          ],
        },
      ],
    },
    {
      label: "Company Profile",
      to: "/company-profile",
      roles: ["admin"],
      children: [],
    },
    {
      label: "Registration",
      roles: ["admin"],
      children: [
        { label: "Hotel", to: "/registration/hotel" },
        { label: "Agent", to: "/registration/agent" },
        { label: "Employee", to: "/registration/employee" },
        { label: "Cab", to: "/registration/cabProvider" },
        { label: "Activity", to: "/registration/activity" },
        { label: "Package", to: "/registration/package" },
        { label: "Supplier", to: "/registration/supplier" },
      ],
    },
    {
      label: "Registration",
      roles: ["agent"],
      children: [
        { label: "Sub User", to: "/agentregistration/sub-user" },
        { label: "Sub Agent", to: "/agentregistration/sub-agent" },
      
      ],
    },
    {
      label: "New Booking",
      roles: ["admin","agent"],
      children: [
        { label: "Hotel Booking", to: "/new-booking/hotel" },
        {
          label: "Make Your Own Package",
          to: "/new-booking/make-your-own-package",
        },
        { label: "Package Booking", to: "/new-booking/package" },
        {
          label: "Tours and Activity",
          to: "/new-booking/tours-and-activities",
        },
      ],
    },
    {
      label: "Booking List",
      roles: ["admin", "agent", "staff", "hotel"],
      children: [
        {
          label: "Hotel Booking",
          to: "/booking-details/hotel-booking-list",
        },
        {
          label: "Custom Booking",
          to: "/booking-details/custom-booking-list",
        },
        {
          label: "Package Booking",
          to: "/booking-details/package-booking-list",
        },
        {
          label: "Complete Booking",
          to: "/booking-details/complete-booking-list",
        },
        {
          label: "Quotation List",
          to: "/booking-details/quotation-list-list",
        },
        {
          label: "Offline Booking List",
          to: "/booking-details/offline-booking-list",
        },
      ],
    },
    {
      label: "Invoice",
      to: "/invoice",
      roles: ["admin", "agent"],
    },
    {
      label: "Inhouse Accounts",
      roles: ["admin" ,"agent"],
      children: [
        {
          label: "Agent Accounts",
          to: "/inhouse-accounts/agent",
        },
        {
          label: "Payment Gateway Transactions",
          to: "/inhouse-accounts/payment-gateway-transactions",
        },
        {
          label: "Statement of Accounts Online",
          to: "/inhouse-accounts/statement-of-accounts-online",
        },
         {
          label: "Statement of Accounts offline",
          to: "/inhouse-accounts/statement-of-accounts-offline",
        },
      ],
    },
    {
      label: "Assigned Agents",
      to: "/assigned-agents",
      roles: ["admin"],
    },
    { label: "Calendar", to: "/calendar", roles: ["admin", "agent", "staff", "hotel"] },
    {
      label: "Extranet Contract",
      to: "/extranet-contract",
      roles: ["admin"],
    },
    {
      label: "Report",
      to: "/report",
      roles: ["admin", "agent"],
      children: [
        {
          label: "Booking",
          to: "/reports/booking",
        },
        {
          label: "Cancellation",
          to: "/reports/cancellation",
        },
        {
          label: "Inventory",
          to: "/reports/inventory",
        },
        {
          label: "Hotel Wise",
          to: "/reports/hotel-wise",
        },
        {
          label: "Accounts",
          to: "/reports/accounts",
        },
        {
          label: "Day Wise",
          to: "/reports/day-wise",
        },
      ],
    },
    {
      label: "Offer",
      to: "/offer",
      roles: ["admin"],
    },
    {
      label: "Upload Offer Image",
      to: "/upload-offer-image",
      roles: ["admin"],
    },
  ];

  // Filter menu based on allowed roles
  const filteredItems = items.filter((item) => {
    if (!item.roles) return true; // if no roles specified, show for all
    return item.roles.includes(currentRole);
  });

  return (
    <>
      {/* Hamburger for small screens */}
      <Button variant="link" className="hamburger d-lg-none" onClick={handleShow}>
        ☰
      </Button>

      {/* Sidebar for large screens */}
      <aside className="sidebar d-none d-lg-block">
        <Nav className="flex-column">
          {filteredItems.map((item) => {
            const hasChildren = Array.isArray(item.children) && item.children.length > 0;
            const hasGroups = Array.isArray(item.groups) && item.groups.length > 0;

            return (
              <Nav.Item
                key={item.label}
                className={`nav-item-custom ${hasChildren || hasGroups ? "nav-item-has-children" : ""}`}
              >
                <Nav.Link as={Link} to={item.to || "#"} className="d-flex align-items-center justify-content-between">
                  <span className="d-flex align-items-center">
                    <span className="me-2">{getIcon(item.label)}</span>
                    <span>{item.label}</span>
                  </span>
                  {(hasChildren || hasGroups) && <span className="caret">▾</span>}
                </Nav.Link>

                {(hasChildren || hasGroups) && (
                  <div className="submenu">
                    {hasChildren &&
                      item.children.map((child) => (
                        <Nav.Link
                          as={Link}
                          to={child.to}
                          key={`${item.label}-${child.label}`}
                          className="submenu-link"
                        >
                          {child.label}
                        </Nav.Link>
                      ))}
                    {hasGroups &&
                      item.groups.map((group) => {
                        const groupKey = `${item.label}-${group.label}`;
                        const isOpen = !!openGroups[groupKey];
                        return (
                          <div key={group.label} className="submenu-group">
                            <button
                              type="button"
                              className={`submenu-accordion-header d-flex justify-content-between align-items-center ${
                                isOpen ? "open" : ""
                              }`}
                              onClick={(e) => {
                                e.preventDefault();
                                toggleGroup(groupKey);
                              }}
                            >
                              <span>{group.label}</span>
                              <span className="caret-small">{isOpen ? "▴" : "▾"}</span>
                            </button>
                            {isOpen && (
                              <div className="submenu-children">
                                {group.children.map((sub) => (
                                  <Nav.Link
                                    as={Link}
                                    to={sub.to}
                                    key={`${groupKey}-${sub.label}`}
                                    className="submenu-link"
                                  >
                                    {sub.label}
                                  </Nav.Link>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </Nav.Item>
            );
          })}
        </Nav>
      </aside>

      {/* Offcanvas for small screens */}
      <Offcanvas show={show} onHide={handleClose}>
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>Globosoft</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          <Nav className="flex-column">
            {filteredItems.map((item) => {
              const hasChildren = Array.isArray(item.children) && item.children.length > 0;
              const hasGroups = Array.isArray(item.groups) && item.groups.length > 0;

              return (
                <Nav.Item key={item.label} className={`nav-item-custom ${hasChildren || hasGroups ? "nav-item-has-children" : ""}`}>
                  <Nav.Link as={Link} to={item.to || "#"} onClick={handleClose}>
                    {getIcon(item.label)} {item.label}
                  </Nav.Link>

                  {(hasChildren || hasGroups) && (
                    <div className="submenu">
                      {hasChildren &&
                        item.children.map((child) => (
                          <Nav.Link
                            as={Link}
                            to={child.to}
                            key={`${item.label}-mobile-${child.label}`}
                            onClick={handleClose}
                            className="submenu-link"
                          >
                            {child.label}
                          </Nav.Link>
                        ))}
                      {hasGroups &&
                        item.groups.map((group) => {
                          const groupKey = `${item.label}-${group.label}`;
                          const isOpen = !!openGroups[groupKey];
                          return (
                            <div key={`${group.label}-mobile`} className="submenu-group">
                              <button
                                type="button"
                                className={`submenu-accordion-header d-flex justify-content-between align-items-center ${
                                  isOpen ? "open" : ""
                                }`}
                                onClick={(e) => {
                                  e.preventDefault();
                                  toggleGroup(groupKey);
                                }}
                              >
                                <span>{group.label}</span>
                                <span className="caret-small">{isOpen ? "▴" : "▾"}</span>
                              </button>
                              {isOpen && (
                                <div className="submenu-children">
                                  {group.children.map((sub) => (
                                    <Nav.Link
                                      as={Link}
                                      to={sub.to}
                                      key={`${groupKey}-mobile-${sub.label}`}
                                      onClick={handleClose}
                                      className="submenu-link"
                                    >
                                      {sub.label}
                                    </Nav.Link>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </Nav.Item>
              );
            })}
          </Nav>
        </Offcanvas.Body>
      </Offcanvas>
    </>
  );
}

function getIcon(label) {
  switch (label) {
    case labelForDashboard:
      return "🏠";
    case "Manage Masters":
      return "🧩";
    case "Company Profile":
      return "🏢";
    case "Registration":
      return "📝";
    case "New Booking":
      return "🆕";
    case "Booking List":
      return "📚";
    case "Invoice":
      return "🧾";
    case "Inhouse Accounts":
      return "🏦";
    case "Assigned Agents":
      return "👥";
    case "Calendar":
      return "🗓️";
    case "Extranet Contract":
      return "📑";
    case "Report":
      return "📈";
    case "Offer":
      return "🏷️";
    case "Upload Offer Image":
      return "🖼️";
    default:
      return "•";
  }
}
