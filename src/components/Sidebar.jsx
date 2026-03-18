import React, { useState, useRef, useEffect } from "react";
import { Nav, Button, Offcanvas } from "react-bootstrap";
import { Link } from "react-router-dom";
import "./Sidebar.css";
import {
  LayoutDashboard,
  Puzzle,
  Building2,
  ClipboardList,
  PlusCircle,
  BookOpen,
  FileText,
  Landmark,
  Users,
  CalendarDays,
  FileSignature,
  BarChart3,
  Tag,
  ImagePlus,
  Dot,
} from "lucide-react";

let labelForDashboard = " ";

export default function Sidebar() {
  const [show, setShow] = useState(false);
  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);
  const [openGroups, setOpenGroups] = useState({});
  const sidebarRef = useRef(null);
  const offcanvasRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      const sidebarEl = sidebarRef.current;
      const offcanvasEl = offcanvasRef.current;

      // If click is outside both sidebar and offcanvas
      if (
        sidebarEl &&
        !sidebarEl.contains(event.target) &&
        (!offcanvasEl || !offcanvasEl.contains(event.target))
      ) {
        setOpenGroups({}); // 👈 close all dropdowns
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Get roles as an array
  const storedRoles = (localStorage.getItem("userRole") || "")
    .split(",")
    .map((role) => role.trim().toLowerCase());

  // Get current active role (this could also come from localStorage as "currentActiveRole")
  const currentRole =
    localStorage.getItem("currentActiveRole")?.toLowerCase() ||
    storedRoles[0] ||
    "";
  console.log("currentRole in sidebar::", currentRole);

  // Set dashboard path based on current active role
  let dashboardPath = "/";

  if (currentRole === "admin") {
    dashboardPath = "/adminDashboard";
    labelForDashboard = "Admin Dashboard";
  } else if (currentRole === "agent") {
    dashboardPath = "/agentDashboard";
    labelForDashboard = "Agent Dashboard";
  } else if (currentRole === "staff") {
    dashboardPath = "/staffDashboard";
    labelForDashboard = "Staff Dashboard";
  } else if (currentRole === "extranet") {
    dashboardPath = "/extranetDashboard";
    labelForDashboard = "Hotel Dashboard";
  }

  const items = [
    {
      label: labelForDashboard,
      to: dashboardPath,
      roles: ["admin", "agent", "staff", "extranet"],
    },
    {
      label: "Manage Masters",
      // to: "/manage-masters",
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
            // { label: "Country", to: "/masters/country-mapping" },
            { label: "City", to: "/masters/city-mapping" },
            // { label: "Hotel", to: "/masters/hotel-mapping" },
          ],
        },
        //nee to uncomment once implemented
        // {
        //   label: "UnMapping settings",
        //   children: [
        //     { label: "Country", to: "/masters/country-unmapping" },
        //     { label: "City", to: "/masters/city-unmapping" },
        //     { label: "Hotel", to: "/masters/hotel-unmapping" },
        //   ],
        // },
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
        { label: "Activity", to: "/registration/activityProvider" },
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
      roles: ["admin", "agent"],
      children: [
        { label: "Hotel Booking", to: "/new-booking/hotel" },
        {
          label: "Make Your Own Package",
          to: "/new-booking/make-your-own-package",
        },
        // { label: "Package Booking", to: "/new-booking/package" },
        { label: "Cab Booking", to: "/new-booking/cab" },
        {
          label: "Tours and Activity",
          to: "/new-booking/tours-and-activities",
        },
      ],
    },
    {
      label: "Booking List",
      roles: ["admin", "agent", "staff"],
      children: [
        {
          label: "Hotel Booking",
          to: "/booking-details/hotel-booking-list",
        },
        {
          label: "Custom Booking",
          to: "/booking-details/custom-booking-list",
        },
        // {
        //   label: "Package Booking",
        //   to: "/booking-details/package-booking-list",
        // },
        {
          label: "Activity Booking",
          to: "/booking-details/activity-booking-list",
        },
        {
          label: "Cab Booking",
          to: "/booking-details/cab-booking-list",
        },
        // {
        //   label: "Complete Booking",
        //   to: "/booking-details/complete-booking-list",
        // },
        // {
        //   label: "Quotation List",
        //   to: "/booking-details/quotation-list-list",
        // },
        // {
        //   label: "Offline Booking List",
        //   to: "/booking-details/offline-booking-list",
        // },
      ],
    },
    {
      label: "Invoice",
      to: "/invoice",
      roles: ["admin", "agent"],
    },
    {
      label: "Inhouse Accounts",
      roles: ["admin", "agent"],
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
    {
      label: "Calendar",
      to: "/calendar",
      roles: ["admin", "agent", "staff", "extranet"],
    },
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
          to: "/report/booking",
        },
        {
          label: "Cancellation",
          to: "/report/cancellation",
        },
        {
          label: "Inventory",
          to: "/report/inventory",
        },
        {
          label: "Hotel Wise",
          to: "/report/hotel-wise",
        },
        {
          label: "Accounts",
          to: "/report/accounts",
        },
        {
          label: "Day Wise",
          to: "/report/day-wise",
        },
        {
          label: "Monthly Wise",
          to: "/report/monthly-wise",
        },
        {
          label: "Comparison",
          to: "/report/comparison",
        },
        {
          label: "Agent Wise",
          to: "/report/agent-wise",
        },
        {
          label: "Contract Expiry",
          to: "/report/contract-expiry",
        },
        {
          label: "Contract Rate",
          to: "/report/contract-rate",
        },
        {
          label: "User Report",
          to: "/report/user-report",
        },
        {
          label: "Stop Sale",
          to: "/report/stop-sale",
        },
        {
          label: "User Logins",
          to: "/report/user-logins",
        },
        {
          label: "Offline Daily Sales",
          to: "/report/offline-daily-sales",
        },
        {
          label: "Online Daily Sales",
          to: "/report/online-daily-sales",
        },
        {
          label: "Time Limit Daily Sales",
          to: "/report/time-limit-daily-sales",
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

  const toggleGroup = (groupKey, isTopLevelItem = false) => {
    console.log("Toggling group:", groupKey, "isTopLevelItem:", isTopLevelItem); // Debug log
    setOpenGroups((prev) => {
      const newOpenGroups = {};

      // If it's a top-level menu item (like "Registration", "Manage Masters", etc.)
      if (isTopLevelItem) {
        // Get list of all top-level menu item labels that have children or groups
        const topLevelItems = filteredItems
          .filter(
            (item) =>
              (Array.isArray(item.children) && item.children.length > 0) ||
              (Array.isArray(item.groups) && item.groups.length > 0),
          )
          .map((item) => item.label);

        // Close all other top-level items and their nested groups
        Object.keys(prev).forEach((key) => {
          // Skip the clicked item (we'll handle it separately)
          if (key === groupKey) {
            return;
          }

          // If it's a top-level item, don't keep it (close it)
          if (topLevelItems.includes(key)) {
            return; // Close this top-level item
          }

          // If it's a nested group, check if it belongs to a closed top-level item
          // Nested groups have format: "ParentItem-GroupName"
          if (key.includes("-")) {
            const parentName = key.split("-")[0];
            // Close nested groups that belong to other top-level items
            if (topLevelItems.includes(parentName) && parentName !== groupKey) {
              return; // Close nested groups of other top-level items
            }
            // Keep nested groups that don't belong to top-level items (edge case)
            if (!topLevelItems.includes(parentName)) {
              newOpenGroups[key] = prev[key];
            }
          } else {
            // Keep other non-top-level groups (if any exist)
            newOpenGroups[key] = prev[key];
          }
        });

        // Toggle the clicked top-level item
        newOpenGroups[groupKey] = !prev[groupKey];

        // If we're closing the clicked item, also remove its nested groups
        if (!newOpenGroups[groupKey]) {
          Object.keys(newOpenGroups).forEach((key) => {
            if (key.includes("-") && key.startsWith(groupKey + "-")) {
              delete newOpenGroups[key];
            }
          });
        }
      } else {
        // For nested groups (like "Manage Masters-Basic settings")
        // Copy all existing state and toggle the clicked group
        Object.keys(prev).forEach((key) => {
          newOpenGroups[key] = prev[key];
        });
        newOpenGroups[groupKey] = !prev[groupKey];
      }

      console.log("New open groups:", newOpenGroups); // Debug log
      return newOpenGroups;
    });
  };

  return (
    <>
      {/* Hamburger for small screens */}

      <header className="top-navbar d-flex align-items-center">
        {!show && ( // ✅ hide when offcanvas is open
          <Button
            variant="link"
            className="hamburger d-lg-none"
            onClick={handleShow}
            aria-label="Open menu"
            style={{
              position: "fixed",

              zIndex: 4000,
            }}
          >
            ☰
          </Button>
        )}
      </header>

      {/* Sidebar for large screens */}
      <aside
        className="sidebar d-none d-lg-block"
        ref={sidebarRef}
        style={{
          position: "sticky",
          top: "60px", // 👈 height of top bar
          height: "calc(100vh - 60px)", // 👈 reserve space
          background: "#fff",
          borderRight: "1px solid #e5e7eb",
          zIndex: 100,
          // zIndex: 100,
        }}
      >
        <Nav className="flex-column">
          {filteredItems.map((item) => {
            const hasChildren =
              Array.isArray(item.children) && item.children.length > 0;
            const hasGroups =
              Array.isArray(item.groups) && item.groups.length > 0;

            return (
              <Nav.Item
                key={item.label}
                className={`nav-item-custom ${hasChildren || hasGroups ? "nav-item-has-children" : ""} ${item.label === "Report" || item.label === "Inhouse Accounts" ? "submenu-up" : ""}`}
              >
                <Nav.Link
                  as={hasChildren || hasGroups ? "div" : Link}
                  to={hasChildren || hasGroups ? undefined : item.to || "#"}
                  className="d-flex align-items-center justify-content-between"
                  onClick={
                    hasChildren || hasGroups
                      ? (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log("Clicked on:", item.label); // Debug log
                          const groupKey = item.label;
                          toggleGroup(groupKey, true); // Pass true to indicate it's a top-level item
                        }
                      : undefined
                  }
                  style={{
                    cursor: hasChildren || hasGroups ? "pointer" : "default",
                  }}
                >
                  <span className="d-flex align-items-center">
                    <span className="me-2">{getIcon(item.label)}</span>
                    <span>{item.label}</span>
                  </span>
                  {(hasChildren || hasGroups) && (
                    <span className="caret">
                      {openGroups[item.label] ? "▴" : "▾"}
                    </span>
                  )}
                </Nav.Link>

                {(hasChildren || hasGroups) && (
                  <div
                    className={`submenu ${openGroups[item.label] ? "show" : ""}`}
                    style={{
                      display: openGroups[item.label] ? "block" : "none",
                      zIndex: 9999,
                      marginLeft: "12px",
                      marginTop: "6px",
                      paddingLeft: "8px",
                      borderLeft: "1px solid #e5e7eb",

                      // ⭐ IMPORTANT FIX
                      maxHeight: "380px", // controls submenu height
                      overflowY: "auto", // enables scroll
                      scrollbarWidth: "thin", // Firefox
                      scrollbarColor: "#eeeaea",
                    }}
                  >
                    {hasChildren &&
                      item.children.map((child) => (
                        <Nav.Link
                          as={Link}
                          to={child.to}
                          key={`${item.label}-${child.label}`}
                          className="submenu-link"
                          style={{
                            display: "block",
                            padding: "8px 12px",
                            color: "#111827",
                            textDecoration: "none",
                            cursor: "pointer",
                            fontWeight: 450,
                          }}
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
                              <span className="caret-small">
                                {isOpen ? "▴" : "▾"}
                              </span>
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
        <Offcanvas.Body ref={offcanvasRef}>
          <Nav className="flex-column">
            {filteredItems.map((item) => {
              const hasChildren =
                Array.isArray(item.children) && item.children.length > 0;
              const hasGroups =
                Array.isArray(item.groups) && item.groups.length > 0;

              return (
                <Nav.Item
                  key={item.label}
                  className={`nav-item-custom ${hasChildren || hasGroups ? "nav-item-has-children" : ""}`}
                >
                  <Nav.Link
                    as={hasChildren || hasGroups ? "div" : Link}
                    to={hasChildren || hasGroups ? undefined : item.to || "#"}
                    onClick={
                      hasChildren || hasGroups
                        ? (e) => {
                            e.preventDefault();
                            const groupKey = item.label;
                            toggleGroup(groupKey, true); // Pass true to indicate it's a top-level item
                          }
                        : handleClose
                    }
                    style={{
                      cursor: hasChildren || hasGroups ? "pointer" : "default",
                    }}
                  >
                    {getIcon(item.label)} {item.label}
                    {(hasChildren || hasGroups) && (
                      <span className="caret ms-2">
                        {openGroups[item.label] ? "▴" : "▾"}
                      </span>
                    )}
                  </Nav.Link>

                  {(hasChildren || hasGroups) && (
                    <div
                      className={`submenu ${openGroups[item.label] ? "show" : ""}`}
                      style={{
                        display: openGroups[item.label] ? "block" : "none",
                        zIndex: 9999,
                      }}
                    >
                      {hasChildren &&
                        item.children.map((child) => (
                          <Nav.Link
                            as={Link}
                            to={child.to}
                            key={`${item.label}-mobile-${child.label}`}
                            onClick={handleClose}
                            className="submenu-link"
                            style={{
                              display: "block",
                              padding: "8px 12px",
                              color: "#111827",
                              textDecoration: "none",
                              cursor: "pointer",
                            }}
                          >
                            {child.label}
                          </Nav.Link>
                        ))}
                      {hasGroups &&
                        item.groups.map((group) => {
                          const groupKey = `${item.label}-${group.label}`;
                          const isOpen = !!openGroups[groupKey];
                          return (
                            <div
                              key={`${group.label}-mobile`}
                              className="submenu-group"
                            >
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
                                <span className="caret-small">
                                  {isOpen ? "▴" : "▾"}
                                </span>
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
  const iconProps = {
    size: 18,
    strokeWidth: 1.5, // 👈 thinner (IMPORTANT)
    className: "sidebar-icon",
  };

  switch (label) {
    case labelForDashboard:
      return <LayoutDashboard {...iconProps} />;

    case "Manage Masters":
      return <Puzzle {...iconProps} />;

    case "Company Profile":
      return <Building2 {...iconProps} />;

    case "Registration":
      return <ClipboardList {...iconProps} />;

    case "New Booking":
      return <PlusCircle {...iconProps} />;

    case "Booking List":
      return <BookOpen {...iconProps} />;

    case "Invoice":
      return <FileText {...iconProps} />;

    case "Inhouse Accounts":
      return <Landmark {...iconProps} />;

    case "Assigned Agents":
      return <Users {...iconProps} />;

    case "Calendar":
      return <CalendarDays {...iconProps} />;

    case "Extranet Contract":
      return <FileSignature {...iconProps} />;

    case "Report":
      return <BarChart3 {...iconProps} />;

    case "Offer":
      return <Tag {...iconProps} />;

    case "Upload Offer Image":
      return <ImagePlus {...iconProps} />;

    default:
      return <Dot {...iconProps} />;
  }
}
