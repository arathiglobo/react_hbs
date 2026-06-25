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
  Utensils,
  Trophy,
  Award,
} from "lucide-react";
import { FaAd, FaBrain, FaBullhorn, FaBullseye, FaFileAlt, FaImages, FaRobot, FaTags, FaUser } from "react-icons/fa";
import axiosInstance from "./AxiosInstance";


let labelForDashboard = " ";

export default function Sidebar() {
  const [show, setShow] = useState(false);
  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);
  const [openGroups, setOpenGroups] = useState({});
  const sidebarRef = useRef(null);
  const offcanvasRef = useRef(null);
  const [hotelId, setHotelId] = useState(null);

  // Desktop sidebar collapse (remembered across reloads). When collapsed the
  // <aside> is removed so the page content reclaims the space, and a small
  // floating button restores it.
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("sidebarCollapsed") === "true",
  );
  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem("sidebarCollapsed", String(next));
      return next;
    });
  };

  const storedRoles = (localStorage.getItem("userRole") || "")
    .split(",")
    .map((role) => role.trim().toLowerCase());

  const currentRole =
    localStorage.getItem("currentActiveRole")?.toLowerCase() ||
    storedRoles[0] ||
    "";

  useEffect(() => {
    const fetchHotelId = async () => {
      try {
        const userName = localStorage.getItem("UserName") || sessionStorage.getItem("UserName");
        if (userName && currentRole === "extranet") {
          const response = await axiosInstance.get(`/api/personalProfile/${userName}`);
          if (response.data && response.data.id) {
            setHotelId(response.data.id);
          }
        }
      } catch (error) {
        console.error("Error fetching hotelId for sidebar:", error);
      }
    };

    fetchHotelId();
  }, [currentRole]);

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
            { label: "City / Province", to: "/masters/states" },
            { label: "Destinations", to: "/masters/destination" },
            { label: "Locality", to: "/masters/sub-location" },
            { label: "Airport", to: "/masters/airport" },
          ],
        },
        {
          label: "Mapping settings",
          children: [
            // { label: "Country", to: "/masters/country-mapping" },
            { label: "City", to: "/masters/city-mapping" },
            { label: "Hotel", to: "/masters/hotel-mapping" }, 
            { label: "Fetch Hotels", to: "/masters/fetch-new-hotels" },
          ],
        },
        {
          label: "UnMapping settings",
          children: [
            // { label: "Country", to: "/masters/country-unmapping" },
            { label: "City", to: "/masters/city-unmapping" },
            // { label: "Hotel", to: "/masters/hotel-unmapping" },
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
        { label: "Transfers", to: "/registration/cabProvider" },
        { label: "Tours and Activity", to: "/registration/activityProvider" },
        { label: "Package", to: "/registration/package" },
        { label: "Supplier", to: "/registration/supplier" },
        { label: "Restaurants", to: "/restaurant/list" },
        { label: "Honeymoon Packages", to: "/honeymoon/list" },
        { label: "Ayurveda", to: "/registration/ayurveda" },
        { label: "Scheffer Driver and Limousine", to: "/registration/schefferDriver" },
        { label: "MYOP Package Add-Ons", to: "/registration/package-addons" },
      ],
    },
    {
      label: "Registration",
      roles: ["agent"],
      children: [
        { label: "Sub User", to: "/agent-registration/sub-user" },
        { label: "Sub Agent", to: "/agent-registration/sub-agent" },
      ],
    },
    {
      label: "New Booking",
      roles: ["admin", "agent"],
      children: [
        { label: "Hotel Booking", to: "/new-booking/hotel" },
        // Dedicated 24-Hour Check-In entry — separate route renders the
        // same HotelSearch component with force24Hour=true.
        { label: "24 Hour Check-In", to: "/new-booking/hotel-24hr" },
        // Last Minute Booking — Phase 2 entry (separate flow & APIs)
        { label: "Last Minute Booking", to: "/new-booking/last-minute-booking" },
        { label: "Long Stay Booking", to: "/new-booking/long-stay" },
        { label: "Day Stay Check-In", to: "/new-booking/day-stay" },
        // {
        //   label: "Make Your Own Package",
        //   to: "/new-booking/make-your-own-package",
        // },
        {
          // Parallel v2 flow: add-on services are picked FIRST (visa,
          // transfer, tour, etc.). The next page's tabs / cart options
          // are gated by what's selected here. The legacy entry above
          // is left unchanged so anyone who prefers it can keep using it.
          label: "Make Your Own Package",
          to: "/new-booking/make-your-own-package-v2",
        },
        
        { label: "Package Booking", to: "/new-booking/package-search" },
        { label: "Transfers Booking", to: "/new-booking/cab" },
        { label: "Chauffeur Driver and Limousine Booking", to: "/new-booking/scheffer-driver" },
        {
          label: "Tours and Activity",
          to: "/new-booking/tours-and-activities",
        },
        {
          label: "Offline Booking",
          to: "/new-booking/offline-search",
        },
        {
          label: "Restaurant Booking",
          to: "/new-booking/restaurant",
        },
        {
          label: "Honeymoon Package",
          to: "/new-booking/honeymoon",
        },
        // Meet & Space — new booking flow added as a sibling entry under New Booking
        {
          label: "Meet & Space",
          to: "/new-booking/meet-and-space",
        },
        {
          label: "Government Employee",
          to: "/new-booking/gov-employee",
        },
        // Ayurveda — packages, doctor consultations, courses
        {
          label: "Ayurveda",
          to: "/new-booking/ayurveda",
        },
        {
          label: "Student Booking",
          to: "/new-booking/student",
        },
        {
          label: "Senior Citizen Booking",
          to: "/new-booking/senior-citizen",
        },
      ],
    },
    {
      label: "AI Insights",
      roles: ["admin"],
      children: [
        { label: "Overview", to: "/ai" },
        { label: "Demand & ADR Forecast", to: "/ai/demand-forecast" },
        { label: "Agent Behavior", to: "/ai/agent-behavior" },
        { label: "No-show / Overbooking Risk", to: "/ai/no-show-risk" },
      ],
    },
    {
      label: "Booking List",
      roles: ["admin", "agent", "staff"],
      children: [
        {
          label: "Hotel Bookings",
          to: "/booking-details/hotel-booking-list",
        },
        // Dedicated 24-Hour Check-In list — same page wrapped with
        // force24HourOnly so only is24HourCheckin=true rows are shown.
        {
          label: "24Hrs Bookings",
          to: "/booking-details/24hr-booking-list",
        },
        // Last Minute Booking list — Phase 4 entry
        {
          label: "Last Minute Bookings",
          to: "/booking-details/last-minute-booking-list",
        },
        {
          label: "Long Stay Bookings",
          to: "/booking-details/long-stay-booking-list",
        },
        {
          label: "Day Stay Bookings",
          to: "/booking-details/day-stay-booking-list",
        },
        {
          label: "Custom Bookings",
          to: "/booking-details/custom-booking-list",
        },
        {
          // Listings for the v2 Make-Your-Own-Package flow (separate
          // table tree, separate endpoints).
          label: "Make Your Own Packages",
          to: "/booking-details/make-your-own-package-v2-list",
        },
        {
          label: "Package Bookings",
          to: "/booking-details/package-booking-list",
        },
        {
          label: "Tours and Activity Bookings",
          to: "/booking-details/activity-booking-list",
        },
        {
          label: "Transfer Bookings",
          to: "/booking-details/cab-booking-list",
        },
        {
          label: "Chauffeur Driver and Limousine Bookings",
          to: "/booking-details/scheffer-driver-booking-list", 
        },
        // {
        //   label: "Complete Booking",
        //   to: "/booking-details/complete-booking-list",
        // },
        // {
        //   label: "Quotation List",
        //   to: "/booking-details/quotation-list-list",
        // },
        {
          label: "Offline Bookings",
          to: "/booking-details/offline-booking-list",
        },
        {
          label: "Restaurant Bookings",
          to: "/booking-details/restaurant-booking-list",
        },
        {
          label: "Honeymoon Packages",
          to: "/booking-details/honeymoon-booking-list",
        },
        // Meet & Space booking list — view + cancel from this page
        {
          label: "Meet & Space Bookings",
          to: "/booking-details/meet-and-space-booking-list",
        },
        {
          label: "Government Employee Bookings",
          to: "/booking-details/gov-employee-booking-list",
        },
        {
          label: "Ayurveda Bookings",
          to: "/booking-details/ayurveda-booking-list",
        },
        {
          label: "Student Bookings",
          to: "/booking-details/student-booking-list",
        },
        {
          label: "Senior Citizen Bookings",
          to: "/booking-details/senior-citizen-booking-list",
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
      roles: ["admin", "agent"],
      children: [
        {
          label: "Agent Accounts",
          to: "/inhouse-accounts/agent",
        },
        // {
        //   label: "Payment Gateway Transactions",
        //   to: "/inhouse-accounts/payment-gateway-transactions",
        // },
        // {
        //   label: "Statement of Accounts Online",
        //   to: "/inhouse-accounts/statement-of-accounts-online",
        // },
        // {
        //   label: "Statement of Accounts offline",
        //   to: "/inhouse-accounts/statement-of-accounts-offline",
        // },
      ],
    },
    // {
    //   label: "Assigned Agents",
    //   to: "/assigned-agents",
    //   roles: ["admin"],
    // },
    {
      label: "Calendar",
      // Extranet (hotel) users get their own hotel-scoped calendar page.
      to: currentRole === "extranet" ? "/extranet/calendar" : "/calendar",
      roles: ["admin", "agent", "staff", "extranet"],
    },
    // {
    //   label: "Extranet Contract",
    //   to: "/extranet-contract",
    //   roles: ["admin"],
    // },
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
        // {
        //   label: "Inventory",
        //   to: "/report/inventory",
        // },
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

    // Agent Incentive Module — admin manages rules + reviews claims;
    // agents see their points dashboard and claim history.
    {
      label: "Agent Incentive",
      roles: ["admin"],
      children: [
        { label: "Configuration", to: "/incentive/config" },
        { label: "Agent Summary", to: "/incentive/my-incentives" },
        { label: "Claims", to: "/incentive/claims" },
      ],
    },
    {
      label: "My Incentives",
      roles: ["agent"],
      children: [
        { label: "Dashboard", to: "/incentive/my-incentives" },
        { label: "My Claims", to: "/incentive/claims" },
      ],
    },

  
    {
      label: "Marketing",
      roles: ["admin"],
      children: [
        { label: "Banners", to: "/offer" },
        { label: "Offer Image", to: "/upload-offer-image" },
        { label: "Advertisements", to: "/advertisements" },
      ],
    },


    // {Extranet menus}
    {
      label: "Occupancy",
      to: hotelId ? `/extranet/${hotelId}/occupancy-and-minimumlength` : "#",
      roles: ["extranet"],
    },
    {
      label: "Availability",
      to: hotelId ? `/extranet/${hotelId}/hotel-availability` : "#",
      roles: ["extranet"],
    },
    {
      label: "Contract Rate",
      to: hotelId ? `/extranet/${hotelId}/contract-rate` : "#",
      roles: ["extranet"],
    },
    {
      label: "Promotions",
      to: hotelId ? `/extranet/${hotelId}/promotions` : "#",
      roles: ["extranet"],
    },
    {
      label: "Policy",
      to: hotelId ? `/extranet/${hotelId}/hotel-policy` : "#",
      roles: ["extranet"],
    },
    {
      label: "Gallery",
      to: hotelId ? `/extranet/${hotelId}/gallery` : "#",
      roles: ["extranet"],
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
              // Pin to the top-left, vertically centered within the red
              // TopBar (which is sticky at top:0, ~56px tall). White so it
              // is visible on the red bar; above it via z-index. The TopBar
              // brand has a 40px left margin on mobile to clear this button.
              position: "fixed",
              top: 10,
              left: 10,
              zIndex: 4000,
              color: "#fff",
              fontSize: 26,
              lineHeight: 1,
              padding: "2px 8px",
              textDecoration: "none",
            }}
          >
            ☰
          </Button>
        )}
      </header>

      {/* Floating button to re-open the sidebar when collapsed (desktop) */}
      {collapsed && (
        <button
          type="button"
          className="d-none d-lg-flex"
          onClick={toggleCollapsed}
          aria-label="Open sidebar"
          title="Open sidebar"
          style={{
            position: "fixed",
            top: 70,
            left: 8,
            zIndex: 1500,
            border: "1px solid var(--color-border, #e5e7eb)",
            background: "#fff",
            color: "#EC0B43",
            width: 34,
            height: 34,
            borderRadius: 8,
            cursor: "pointer",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,.12)",
            fontSize: 18,
            lineHeight: 1,
          }}
        >
          ☰
        </button>
      )}

      {/* Sidebar for large screens */}
      {!collapsed && (
      <aside
        className="sidebar d-none d-lg-block"
        ref={sidebarRef}
        style={{
          position: "sticky",
          top: "60px", // 👈 height of top bar
          height: "calc(100vh - 60px)", // 👈 reserve space
          background: "var(--color-bg, #fff)",
          borderRight: "1px solid var(--color-border, #e5e7eb)",
          zIndex: 100,
          // zIndex: 100,
        }}
      >
        {/* Collapse control — pinned to the top-right corner of the sidebar
            so it no longer reserves an empty row above the menu. The <aside>
            is position:sticky, which anchors this absolutely-positioned button. */}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            zIndex: 5,
            border: "1px solid var(--color-border, #e5e7eb)",
            background: "#fff",
            color: "#EC0B43",
            width: 28,
            height: 28,
            borderRadius: 8,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            lineHeight: 1,
          }}
        >
          «
        </button>
        <Nav className="flex-column" style={{ paddingTop: 6 }}>
          {filteredItems.map((item) => {
            const hasChildren =
              Array.isArray(item.children) && item.children.length > 0;
            const hasGroups =
              Array.isArray(item.groups) && item.groups.length > 0;

            return (
              <Nav.Item
                key={item.label}
                className={`nav-item-custom ${hasChildren || hasGroups ? "nav-item-has-children" : ""} ${item.label === "Report" || item.label === "Inhouse Accounts" || item.label === "Agent Incentive" || item.label === "Marketing" ? "submenu-up" : ""} ${item.label === "Booking List" ? "submenu-center" : ""}`}
              >
                <Nav.Link
                  as={hasChildren || hasGroups ? "div" : Link}
                  to={hasChildren || hasGroups ? undefined : item.to || "#"}
                  className={`d-flex align-items-center justify-content-between${(hasChildren || hasGroups) && openGroups[item.label] ? " rw-active" : ""}`}
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
                      borderLeft: "1px solid var(--color-border, #e5e7eb)",

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
                            color: "var(--color-secondary, #111827)",
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
      )}

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

    case "Restaurant":
      return <Utensils {...iconProps} />;

    case "New Booking":
      return <PlusCircle {...iconProps} />;

    case "AI Insights":
      return <FaRobot {...iconProps} />;

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

    // case "Banners":
    //   return <Tag {...iconProps} />;

    // case "Offer Image":
    //   return <ImagePlus {...iconProps} />;

    // case "Advertisements":
    //   return <FaAd {...iconProps} />;

    case "Marketing":
      return <FaBullhorn {...iconProps} />;

    case "Occupancy":
      return <FaUser {...iconProps} />;

    case "Contract Rate":
      return <FileSignature {...iconProps} />;
    
    case "Promotions":
     return <FaTags {...iconProps} />;

    case "Policy":
      return <FaFileAlt {...iconProps} />;

    case "Availability":
      return <FaBullhorn {...iconProps} />;

    case "Gallery":
      return <FaImages {...iconProps} />;
    
    case "Agent Incentive":
      return <Trophy {...iconProps} />;

    case "My Incentives":
      return <Award {...iconProps} />;

    default:
      return <Dot {...iconProps} />;
  }
}