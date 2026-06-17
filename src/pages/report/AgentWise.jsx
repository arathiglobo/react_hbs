import React, {useEffect, useState, useMemo} from "react";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import { Row, Col, Card, Form, Button, Dropdown, Table, Modal, Pagination } from "react-bootstrap";
import { toast } from "react-hot-toast";
import axiosInstance from "../../components/AxiosInstance";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import RoomCategory from "../../components/filters/RoomCategory";
import HotelCategory from "../../components/filters/HotelCategory";
import HotelTypefilters from "../../components/filters/HotelTypefilters";
import HotelFilter from "../../components/filters/Hotelfilters";
import Agent from "../../components/filters/Agent";

function AgentWise() {

const [inhouseBookings,setInhouseBookings] = useState([]);
const [showMailModal, setShowMailModal] = useState(false);
const [emailAddress, setEmailAddress] = useState("");
const [isSending, setIsSending] = useState(false);
const [reportType,setReportType] = useState(null);

const activeRole = (localStorage.getItem("currentActiveRole") || "").trim().toUpperCase();
const storedRoles = (localStorage.getItem("userRole") || "").toUpperCase();
const isAgentRole = activeRole ? activeRole === "AGENT" : (storedRoles.includes("AGENT") && !storedRoles.includes("ADMIN"));

// Pagination states
const [inhousecurrentPage,setInhouseCurrentPage]=useState(1);
const [inhouseitemsPerPage,setInhouseItemsPerPage]=useState(10);
const [apicurrentPage,setApiCurrentPage]=useState(1);
const [apiitemsPerPage,setApiItemsPerPage]=useState(10);

// Search query states
const [searchInhouseQuery,setSearchInhouseQuery]=useState("");
const [searchApiQuery,setSearchApiQuery]=useState("");
const [tempSearchQuery, setTempSearchQuery] = useState("");

// Temporary filter states (what user sees/edits)
const [tempAgent,setTempAgent]= useState("");
const [tempSelectedhotelfilter,setTempSelectedHotelfilter]= useState("");
const [temphoteltype,setTemphoteltype]=useState("");
const [temphotelCategories,settempHotelCategories]=useState("");
const [temproomCategory,settempRoomCategory]=useState("");
const [tempFromDate,setTempFromDate]=useState("");
const [tempToDate,setTempToDate]=useState("");

// Applied filter states (used for actual filtering)
const [selectedAgent,setSelectedAgent]= useState("");
const [selectedhotelfilter,setSelectedHotelfilter]= useState("");
const [hoteltype,setHotelType]=useState("");
const [hotelcategories,setHotelCategories]=useState("");
const [roomCategory,setRoomCategory]=useState("");
const [fromDate,setFromDate]=useState("");
const [toDate,setToDate]=useState("");

// Store filter options to map IDs to names
const [agentOptions,setAgentOptions]=useState([]);
const [hotelfilterOption,setHotelfilterOption]=useState([]);
const [hotelTypeOptions,setHotelTypeOptions]=useState([]);
const [hotelCategoriesOptions,setHotelCategoriesOptions]=useState([]);
const [roomCategoryOptions,setRoomCategoryOptions]=useState([]);

// API filters (for API report type - keeping for backward compatibility)
const [apiFilters, setApiFilters] = useState({
  agent: '',
  hotel: '',
  platform: '',
  hotelType: '',
  roomCategory: '',
  fromDate: '',
  toDate: ''
});

useEffect(()=>{
  setInhouseCurrentPage(1);
},[searchInhouseQuery]);

useEffect(()=>{
  setApiCurrentPage(1);
},[searchApiQuery]);

useEffect(()=>{
  const fetchInhouse= async()=>{
    try{
    const response = await axiosInstance.get("/api/reports/agentwise")
    setInhouseBookings(response.data);
      }catch(error){
        console.error("failed to fetch data",error)
        toast.error("Failed to fetch Data")
      }
  };fetchInhouse();
},[])

useEffect(()=>{
  const fetchFilterOptions = async ()=>{
    try{
      const [agentRes, hotelRes, hotelFilterRes, hotelCategoriesRes, roomCategoryRes] = await Promise.all([
        axiosInstance.get("/api/agent").catch(()=>({data:[]})),
        axiosInstance.get("/api/hotels").catch(()=>({data:[]})),
        axiosInstance.get("/api/hotelType").catch(()=>({data:[]})),
        axiosInstance.get("/api/hotelcategory").catch(()=>({data:[]})),
        axiosInstance.get("/api/roomCategory").catch(()=>({data:[]}))
      ]);
      setAgentOptions(Array.isArray(agentRes.data) ? agentRes.data.map(a=>({id:a.id || a.agentId, name:a.companyName || a.agentName || a.name})):[]);
      setHotelfilterOption(Array.isArray(hotelRes.data) ? hotelRes.data.map(h=>({id:h.id,name:h.hotelName})):[]);
      setHotelTypeOptions(Array.isArray(hotelFilterRes.data) ? hotelFilterRes.data.map(ht=>({id:ht.hotelTypeId,name:ht.name})):[]);
      setHotelCategoriesOptions(Array.isArray(hotelCategoriesRes.data) ? hotelCategoriesRes.data.map(hc=>({id:hc.hotelCategoryId,name:hc.hotelCategory || hc})):[]);
      setRoomCategoryOptions(Array.isArray(roomCategoryRes.data) ? roomCategoryRes.data.map(rc=>({id:rc.roomCategoryId,name:rc.roomCategory})):[]);
    }catch(error){
      console.error("failed to fetch filter options",error);
    }
  };fetchFilterOptions();
},[])

const handleSendEmail = async () => {
  // Validate email
  if (!emailAddress || !emailAddress.includes('@')) {
    toast.error("Please enter a valid email address");
    return;
  }

    setIsSending(true);
  try {
    // Get the filtered bookings count to include in the email
    const filteredCount = reportType === 'inhouse' ? filteredinhousebookings.length : filteredapiBookings.length;
    const currentFilters = reportType === 'inhouse' ? {
      agent: selectedAgent,
      hotel: selectedhotelfilter,
      hotelType: hoteltype,
      hotelCategory: hotelcategories,
      roomCategory: roomCategory,
      fromDate: fromDate,
      toDate: toDate
    } : apiFilters;
    
    // API call to send email
    const response = await axiosInstance.post('/api/reports/send-email', {
      email: emailAddress,
      reportType: 'agentwise',
      subType: reportType, // 'inhouse' or 'api'
      filters: {
        ...currentFilters,
        searchQuery: reportType === 'inhouse' ? searchInhouseQuery : searchApiQuery
      },
      recordCount: filteredCount
    });

    if (response.data) {
      toast.success(`Report with ${filteredCount} record(s) sent successfully!`);
      setShowMailModal(false);
      setEmailAddress("");
    }
  } catch (error) {
    console.error("Email send error:", error);
    toast.error(error.response?.data?.message || "Failed to send email");
  } finally {
    setIsSending(false);
  }
};

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    
    // Get current filtered data based on report type
    const currentData = reportType === 'inhouse' ? filteredinhousebookings : filteredapiBookings;
  const columns = reportType === 'inhouse' 
    ? ['Sl.No','Agent Name', 'Hotel Name', 'Hotel Type','Hotel Category', 'Room Category', 'No of Booking', 'Cancelled Booking']
    : ['Sl.No', 'Hotel Name', 'Platform', 'Check In', 'Check Out', 'Hotel Type', 'No of Rooms', 'Customer Name'];
  
  printWindow.document.write(`
    <html>
      <head>
        <title>Agent Wise Report - ${reportType === 'inhouse' ? 'Inhouse' : 'API'}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; }
          h1 { text-align: center; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <h1>Agent Wise Report - ${reportType === 'inhouse' ? 'Inhouse' : 'API'}</h1>
        <table>
          <thead>
            <tr>
              ${columns.map(col => `<th>${col}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${currentData.map((booking) => {
              if (reportType === 'inhouse') {
                return `
                  <tr>
                    <td>${booking.slNo}</td>
                    <td>${booking.agentName}</td>
                    <td>${booking.hotelName}</td>
                    <td>${booking.hotelType}</td>
                    <td>${booking.HotelCategory}</td>
                    <td>${booking.roomCategory}</td>
                    <td>${booking.noOfBooking}</td>
                    <td>${booking.cancelledBooking}</td>
                  </tr>
                `;
              } else {
                return `
                  <tr>
                    <td>${booking.slNo}</td>
                    <td>${booking.hotelName}</td>
                    <td>${booking.platform}</td>
                    <td>${booking.checkIn}</td>
                    <td>${booking.checkOut}</td>
                    <td>${booking.hotelType}</td>
                    <td>${booking.noOfRooms}</td>
                    <td>${booking.customerName}</td>
                  </tr>
                `;
              }
            }).join('')}
          </tbody>
        </table>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
};

  const handlePDF = () => {
    const doc = new jsPDF();
    
    // Get current filtered data
    const currentData = reportType === 'inhouse' ? filteredinhousebookings : filteredapiBookings;
  
  doc.text(`Agent Wise Report - ${reportType === 'inhouse' ? 'Inhouse' : 'API'}`, 20, 20);
  
  if (reportType === 'inhouse') {
    autoTable(doc, {
      head: [['Sl.No','Agent Name', 'Hotel Name', 'Hotel Type','Hotel Category', 'Room Category', 'No of Booking', 'Cancelled Booking']],
      body: currentData.map((booking) => [
        booking.slNo,
        booking.agentName,
        booking.hotelName,
        booking.hotelType,
        booking.HotelCategory,
        booking.roomCategory,
        booking.noOfBooking,
        booking.cancelledBooking
      ]),
      startY: 30,
    });
  } else {
    autoTable(doc, {
      head: [['Sl.No', 'Hotel Name', 'Platform', 'Check In', 'Check Out', 'Hotel Type', 'No of Rooms', 'Customer Name']],
      body: currentData.map((booking) => [
        booking.slNo,
        booking.hotelName,
        booking.platform,
        booking.checkIn,
        booking.checkOut,
        booking.hotelType,
        booking.noOfRooms,
        booking.customerName
      ]),
      startY: 30,
    });
  }
  
  doc.save(`agent-wise-${reportType}-report.pdf`);
};

  const handleExcel = () => {
    // Get current filtered data
    const currentData = reportType === 'inhouse' ? filteredinhousebookings : filteredapiBookings;
  const headers = reportType === 'inhouse'
    ? ['Sl.No','Agent Name', 'Hotel Name', 'Hotel Type','Hotel Category', 'Room Category', 'No of Booking', 'Cancelled Booking']
    : ['Sl.No', 'Hotel Name', 'Platform', 'Check In', 'Check Out', 'Hotel Type', 'No of Rooms', 'Customer Name'];
  
  // Create CSV content with proper escaping
  const escapeCSV = (value) => {
    if (value === null || value === undefined) return '';
    const stringValue = String(value);
    if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };
  
  const csvContent = [
    headers.map(escapeCSV).join(','),
    ...currentData.map((booking) => {
      if (reportType === 'inhouse') {
        return [
          booking.slNo,
          booking.agentName,
          booking.hotelName,
          booking.hotelType,
          booking.HotelCategory,
          booking.roomCategory,
          booking.noOfBooking,
          booking.cancelledBooking
        ].map(escapeCSV).join(',');
      } else {
        return [
          booking.slNo,
          booking.hotelName,
          booking.platform,
          booking.checkIn,
          booking.checkOut,
          booking.hotelType,
          booking.noOfRooms,
          booking.customerName
        ].map(escapeCSV).join(',');
      }
    })
  ].join('\n');

  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `agent-wise-${reportType}-report.csv`;
  link.click();
  window.URL.revokeObjectURL(url);
};

//   const inhouseBookings = [
//   {
//     slNo: 1,
//     agentName: "Globo agent",
//     hotelName: "Test Hotel",
//     hotelType: "beach hotel",
//     HotelCategory: "2",
//     roomCategory: "Deluxe Room",
//     noOfBooking: 1,
//     cancelledBooking: "0",
//     checkIn: "07/12/2025",
//     checkOut: "12/12/2025"
//   },
//   {
//     slNo: 2,
//     agentName: "Direct Client",
//     hotelName: "Test Hotel",
//     hotelType: "resort",
//     HotelCategory: "2",
//     roomCategory: "Deluxe Room, Deluxe Room",
//     noOfBooking: 1,
//     cancelledBooking: "0",
//     checkIn: "16/10/2025",
//     checkOut: "21/10/2025"
//   },
//   {
//     slNo: 3,
//     agentName: "Globo agent",
//     hotelName: "Test Hotel Two",
//     hotelType: "apartment",
//     HotelCategory: "3",
//     roomCategory: "Deluxe Room",
//     noOfBooking: 1,
//     cancelledBooking: "0",
//     checkIn: "14/10/2025",
//     checkOut: "20/10/2025"
//   },
//   {
//     slNo: 4,
//     agentName: "Direct Client",
//     hotelName: "Test Hotel Two",
//     hotelType: "villas",
//     HotelCategory: "3",
//     roomCategory: "Deluxe Room, Deluxe Room",
//     noOfBooking: 1,
//     cancelledBooking: "0",
//     checkIn: "01/09/2025",
//     checkOut: "02/09/2025"
//   }
// ];

const apiBookings = [
  {
    slNo: 1,
    agentName: "API Agent",
    hotelName: "Jumeirah Beach Hotel",
    platform: "jumeirah",
    checkIn: "15/09/2025",
    checkOut: "16/09/2025",
    hotelType: "HOTEL",
    roomCategory: "Standard Room",
    noOfRooms: 1,
    customerName: "Mr. tester jum tester"
  },
  {
    slNo: 2,
    agentName: "External Agent",
    hotelName: "Jumeirah Beach Hotel",
    platform: "jumeirah",
    checkIn: "15/09/2025",
    checkOut: "16/09/2025",
    hotelType: "HOTEL",
    roomCategory: "Deluxe Room",
    noOfRooms: 1,
    customerName: "Mr. tester jum tester"
  },
  {
    slNo: 3,
    agentName: "API Agent",
    hotelName: "Test Hotel API",
    platform: "booking",
    checkIn: "12/09/2025",
    checkOut: "13/09/2025",
    hotelType: "RESORT",
    roomCategory: "Suite",
    noOfRooms: 1,
    customerName: "Mr. Dhyan testcase1"
  },
  {
    slNo: 4,
    agentName: "External Agent",
    hotelName: "Test Hotel API",
    platform: "expedia",
    checkIn: "20/09/2025",
    checkOut: "21/09/2025",
    hotelType: "VILLA",
    roomCategory: "Standard Room",
    noOfRooms: 1,
    customerName: "Mr. Amala tset case one"
  }
];



  // Filtered inhouse bookings using useMemo
  const filteredinhousebookings = useMemo(() => {
    return inhouseBookings.filter(a => {
      if (!a) return false;

      // Filter 1: Agent Filter
      if (selectedAgent) {
        let matches = false;
        
        // First try to match by ID
        if (a.agentId && String(a.agentId) === String(selectedAgent)) {
          matches = true;
        } else {
          // If ID doesn't match, try matching by name
          const selectedAgentName = agentOptions.find(opt => String(opt.id) === String(selectedAgent))?.name;
          if (selectedAgentName) {
            const agentNameStr = String(a.agentName || '').trim();
            const selectedAgentNameStr = String(selectedAgentName || '').trim();
            matches = agentNameStr === selectedAgentNameStr || agentNameStr.includes(selectedAgentNameStr);
          }
        }
        
        if (!matches) return false;
      }

      // Filter 2: Hotel Filter
      if (selectedhotelfilter) {
        let matches = false;
        
        // First try to match by ID (most reliable)
        if (a.hotelId && String(a.hotelId) === String(selectedhotelfilter)) {
          matches = true;
        } else {
          // If ID doesn't match, try matching by name
          const selectedHotelName = hotelfilterOption.find(opt => String(opt.id) === String(selectedhotelfilter))?.name;
          if (selectedHotelName) {
            const hotelNameStr = String(a.hotelName || '').trim();
            const selectedHotelNameStr = String(selectedHotelName || '').trim();
            matches = hotelNameStr === selectedHotelNameStr;
          }
        }
        
        if (!matches) return false;
      }

      // Filter 3: Hotel Type Filter
      if (hoteltype) {
        let matches = false;
        
        // First try to match by ID
        if (a.hotelTypeId && String(a.hotelTypeId) === String(hoteltype)) {
          matches = true;
        } else {
          // If ID doesn't match, try matching by name
          const selectedTypeName = hotelTypeOptions.find(opt => String(opt.id) === String(hoteltype))?.name;
          if (selectedTypeName) {
            const hotelTypeStr = String(a.hotelType || '').trim();
            const selectedTypeStr = String(selectedTypeName || '').trim();
            matches = hotelTypeStr === selectedTypeStr;
          }
        }
        
        if (!matches) return false;
      }

      // Filter 4: Hotel Category Filter
      if (hotelcategories) {
        let matches = false;
        
        // First try to match by ID
        if (a.hotelCategoryId && String(a.hotelCategoryId) === String(hotelcategories)) {
          matches = true;
        } else {
          // If ID doesn't match, try matching by category name/value
          const selectedCategory = hotelCategoriesOptions.find(opt => String(opt.id) === String(hotelcategories));
          if (selectedCategory) {
            const categoryValue = selectedCategory.name?.hotelCategory || selectedCategory.name;
            const bookingCategoryStr = String(a.hotelCategory || a.HotelCategory || '').trim();
            const selectedCategoryStr = String(categoryValue || '').trim();
            matches = bookingCategoryStr === selectedCategoryStr || 
                     bookingCategoryStr.includes(selectedCategoryStr) ||
                     selectedCategoryStr.includes(bookingCategoryStr);
          }
        }
        
        if (!matches) return false;
      }

      // Filter 5: Room Category Filter
      if (roomCategory) {
        let matches = false;
        
        // First try to match by ID
        if (a.roomCategoryId && String(a.roomCategoryId) === String(roomCategory)) {
          matches = true;
        } else {
          // If ID doesn't match, try matching by name
          const selectedRoomCategoryName = roomCategoryOptions.find(opt => String(opt.id) === String(roomCategory))?.name;
          if (selectedRoomCategoryName) {
            const roomCategoryStr = String(a.roomCategory || '').trim();
            const selectedRoomCategoryStr = String(selectedRoomCategoryName || '').trim();
            matches = roomCategoryStr === selectedRoomCategoryStr || 
                     roomCategoryStr.includes(selectedRoomCategoryStr);
          }
        }
        
        if (!matches) return false;
      }

      // Filter 6: Date Range Filter
      if (fromDate && toDate) {
        try {
          const from = new Date(fromDate);
          const to = new Date(toDate);
          
          if (a.checkIn) {
            // Handle different date formats
            let itemDate;
            if (typeof a.checkIn === 'string') {
              if (a.checkIn.includes('/')) {
                // Format: DD/MM/YYYY
                itemDate = new Date(a.checkIn.split('/').reverse().join('-'));
              } else {
                itemDate = new Date(a.checkIn);
              }
            } else {
              itemDate = new Date(a.checkIn);
            }
            
            if (isNaN(itemDate.getTime())) return false;
            if (itemDate < from || itemDate > to) return false;
          } else {
            return false;
          }
        } catch (error) {
          console.error("Date parsing error:", error);
          return false;
        }
      }

      // Filter 7: Text Search (using searchInhouseQuery - the applied one)
      if (searchInhouseQuery && searchInhouseQuery.trim()) {
        const search = searchInhouseQuery.trim().toLowerCase();
        const matchesSearch =
          (a.agentName && String(a.agentName).toLowerCase().includes(search)) ||
          (a.hotelName && String(a.hotelName).toLowerCase().includes(search)) ||
          (a.hotelType && String(a.hotelType).toLowerCase().includes(search)) ||
          (a.hotelCategory && String(a.hotelCategory).toLowerCase().includes(search)) ||
          (a.HotelCategory && String(a.HotelCategory).toLowerCase().includes(search)) ||
          (a.roomCategory && String(a.roomCategory).toLowerCase().includes(search)) ||
          (a.noOfBooking && String(a.noOfBooking).toLowerCase().includes(search)) ||
          (a.cancelledBooking && String(a.cancelledBooking).toLowerCase().includes(search));
        
        if (!matchesSearch) return false;
      }

      return true; // If all filters pass, include this booking
    });
  }, [inhouseBookings, selectedAgent, selectedhotelfilter, hoteltype, hotelcategories, roomCategory, fromDate, toDate, searchInhouseQuery, agentOptions, hotelfilterOption, hotelTypeOptions, hotelCategoriesOptions, roomCategoryOptions]);

  // Filtered API bookings using useMemo
  const filteredapiBookings = useMemo(() => {
    return apiBookings.filter(a => {
      if (!a) return false;

      // Filter by Agent
      if (apiFilters.agent) {
        if (a.agentName !== apiFilters.agent) return false;
      }
      
      // Filter by Hotel
      if (apiFilters.hotel) {
        if (a.hotelName !== apiFilters.hotel) return false;
      }
      
      // Filter by Platform
      if (apiFilters.platform) {
        if (a.platform !== apiFilters.platform) return false;
      }
      
      // Filter by Hotel Type
      if (apiFilters.hotelType) {
        if (a.hotelType !== apiFilters.hotelType) return false;
      }
      
      // Filter by Room Category
      if (apiFilters.roomCategory) {
        if (a.roomCategory !== apiFilters.roomCategory) return false;
      }
      
      // Filter by Date Range
      if (apiFilters.fromDate && apiFilters.toDate) {
        try {
          const from = new Date(apiFilters.fromDate);
          const to = new Date(apiFilters.toDate);
          
          if (a.checkIn) {
            let itemDate;
            if (typeof a.checkIn === 'string' && a.checkIn.includes('/')) {
              itemDate = new Date(a.checkIn.split('/').reverse().join('-'));
            } else {
              itemDate = new Date(a.checkIn);
            }
            
            if (isNaN(itemDate.getTime())) return false;
            if (itemDate < from || itemDate > to) return false;
          } else {
            return false;
          }
        } catch (error) {
          return false;
        }
      }

      // Text Search
      if (searchApiQuery && searchApiQuery.trim()) {
        const search = searchApiQuery.trim().toLowerCase();
        const matchesSearch =
          (a.agentName && String(a.agentName).toLowerCase().includes(search)) ||
          (a.hotelName && String(a.hotelName).toLowerCase().includes(search)) ||
          (a.platform && String(a.platform).toLowerCase().includes(search)) ||
          (a.checkIn && String(a.checkIn).toLowerCase().includes(search)) ||
          (a.checkOut && String(a.checkOut).toLowerCase().includes(search)) ||
          (a.hotelType && String(a.hotelType).toLowerCase().includes(search)) ||
          (a.roomCategory && String(a.roomCategory).toLowerCase().includes(search)) ||
          (a.noOfRooms && String(a.noOfRooms).toLowerCase().includes(search)) ||
          (a.customerName && String(a.customerName).toLowerCase().includes(search));
        
        if (!matchesSearch) return false;
      }

      return true;
    });
  }, [apiBookings, apiFilters, searchApiQuery]);

  // Handle search button click
  const handleSearch = () => {
    if (reportType === 'inhouse') {
      // Validate date range for inhouse
      if (tempFromDate && tempToDate) {
        const from = new Date(tempFromDate);
        const to = new Date(tempToDate);
        if (from > to) {
          toast.error("From Date cannot be greater than To Date");
          return;
        }
      }

      // Apply temporary filter values to actual filter values
      setSelectedAgent(tempAgent);
      setSelectedHotelfilter(tempSelectedhotelfilter);
      setHotelType(temphoteltype);
      setHotelCategories(temphotelCategories);
      setRoomCategory(temproomCategory);
      setFromDate(tempFromDate);
      setToDate(tempToDate);
      setSearchInhouseQuery(tempSearchQuery);
      setInhouseCurrentPage(1);
    } else if (reportType === 'api') {
      // Validate date range for API
      if (apiFilters.fromDate && apiFilters.toDate) {
        const from = new Date(apiFilters.fromDate);
        const to = new Date(apiFilters.toDate);
        if (from > to) {
          toast.error("From Date cannot be greater than To Date");
          return;
        }
      }
      setSearchApiQuery(tempSearchQuery);
      setApiCurrentPage(1);
    }
  };

  // Pagination calculations for Inhouse
  const Inhousetotalpages = useMemo(() => Math.ceil(filteredinhousebookings.length / inhouseitemsPerPage), [filteredinhousebookings.length, inhouseitemsPerPage]);
  const inhouseStartIndex = useMemo(() => (inhousecurrentPage -1)* inhouseitemsPerPage, [inhousecurrentPage, inhouseitemsPerPage]);
  const inhouseEndIndex = useMemo(() => inhouseStartIndex + inhouseitemsPerPage, [inhouseStartIndex, inhouseitemsPerPage]);
  const currentInhousebooking = useMemo(() => filteredinhousebookings.slice(inhouseStartIndex,inhouseEndIndex), [filteredinhousebookings, inhouseStartIndex, inhouseEndIndex]);

  // Pagination calculations for API
  const Apitotalpages = useMemo(() => Math.ceil(filteredapiBookings.length / apiitemsPerPage), [filteredapiBookings.length, apiitemsPerPage]);
  const apiStartIndex = useMemo(() => (apicurrentPage -1) * apiitemsPerPage, [apicurrentPage, apiitemsPerPage]);
  const apiEndIndex = useMemo(() => apiStartIndex + apiitemsPerPage, [apiStartIndex, apiitemsPerPage]);
  const currentApibooking = useMemo(() => filteredapiBookings.slice(apiStartIndex,apiEndIndex), [filteredapiBookings, apiStartIndex, apiEndIndex]);

  return (
    <div className="bg-light d-flex flex-column" style={{ minHeight: "100vh" }}>
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />

        <main className="flex-grow-1 p-4" style={{ overflow: "auto" }}>
          <Card className="shadow-sm rounded-xl">
            <Card.Header>
              <span className="fw-semibold">Agent Wise Report</span>
            </Card.Header>

            {/* Filters Section */}
            <div className="p-4 bg-light border-bottom">
              <Form>
                <Form.Group>
                  <Form.Label className="fw-semibold">* Please select:</Form.Label>
                  <div className="d-flex gap-3 mt-2">
                    <Form.Check
                      type="radio"
                      label="Inhouse"
                      name="reportType"
                      onChange={() => {
                        setReportType('inhouse');
                        setTempAgent("");
                        setTempSelectedHotelfilter("");
                        setTemphoteltype("");
                        settempHotelCategories("");
                        settempRoomCategory("");
                        setTempFromDate("");
                        setTempToDate("");
                        setTempSearchQuery("");
                        setSelectedAgent("");
                        setSelectedHotelfilter("");
                        setHotelType("");
                        setHotelCategories("");
                        setRoomCategory("");
                        setFromDate("");
                        setToDate("");
                        setSearchInhouseQuery("");
                        setInhouseCurrentPage(1);
                      }}
                    />
                    <Form.Check
                      type="radio"
                      label="API"
                      name="reportType"
                      style={{display:"none"}}
                      onChange={() => {
                        setReportType('api');
                        setApiFilters({agent: '', hotel: '', platform: '', hotelType: '', roomCategory: '', fromDate: '', toDate: ''});
                        setSearchApiQuery("");
                        setApiCurrentPage(1);
                      }}
                    />
                  </div>
                </Form.Group>

                {/* When reportType is null - show nothing (or a message) */}
                {reportType === null && (
                  <div className="text-center text-muted mt-3">
                    Please select a report type above
                  </div>
                )}
              </Form>

              {/* When reportType is 'inhouse' - show Inhouse filters */}
              {reportType === 'inhouse' && (
                <>
                  <Row className="align-items-end g-4 mt-3">
                    {/* Agent */}
                    {!isAgentRole && (
                    <Col md={2}>
                      <Agent value={tempAgent} onChange={setTempAgent}/>
                    </Col>
                    )}

                    {/* Hotel */}
                    <Col md={2}>
                      <HotelFilter value={tempSelectedhotelfilter} onChange={setTempSelectedHotelfilter}/>
                    </Col>

                    {/* Hotel Type */}
                    <Col md={2}>
                      <HotelTypefilters value={temphoteltype} onChange={setTemphoteltype}/>
                    </Col>

                    {/* Hotel Category */}
                    <Col md={2}>
                      <HotelCategory value={temphotelCategories} onChange={settempHotelCategories}/>
                    </Col>

                    {/* Room Category */}
                    <Col md={2}>
                      <RoomCategory value={temproomCategory} onChange={settempRoomCategory}/>
                    </Col>

                    {/* From Date */}
                    <Col md={3}>
                      <Form.Group className="mb-0">
                        <Form.Label className="small mb-2">From Date</Form.Label>
                        <Form.Control 
                          type="date" 
                          size="sm" 
                          value={tempFromDate}
                          onChange={(e) => setTempFromDate(e.target.value)}
                          max={tempToDate || undefined}
                        />
                      </Form.Group>
                    </Col>

                    {/* To Date */}
                    <Col md={3}>
                      <Form.Group className="mb-0">
                        <Form.Label className="small mb-2">To Date</Form.Label>
                        <Form.Control 
                          type="date" 
                          size="sm" 
                          value={tempToDate}
                          onChange={(e) => setTempToDate(e.target.value)}
                          min={tempFromDate || undefined}
                        />
                      </Form.Group>
                    </Col>

                    {/* Search Button */}
                    <Col md={12} className="d-flex justify-content-end mt-3">
                      <Button variant="success" size="sm" onClick={handleSearch}>
                        <i className="fas fa-search me-1"></i>Search
                      </Button>
                    </Col>
                  </Row>

                  {/* Action Buttons */}
                  <Row className="mt-4">
                    <Col md={12} className="d-flex gap-2 justify-content-end">
                      <Button variant="outline-primary" size="sm" onClick={() => setShowMailModal(true)}>
                        <i className="fas fa-envelope me-1"></i>Mail
                      </Button>
                      <Button variant="outline-secondary" size="sm" onClick={handlePrint}>
                        <i className="fas fa-print me-1"></i>Print
                      </Button>
                      <Button variant="outline-danger" size="sm" onClick={handlePDF}>
                        <i className="fas fa-file-pdf me-1"></i>PDF
                      </Button>
                      <Button variant="outline-success" size="sm" onClick={handleExcel}>
                        <i className="fas fa-file-excel me-1"></i>Excel
                      </Button>
                    </Col>
                  </Row>

                  {/* Search Input */}
                  <Row className="mt-3">
                    <Col className="d-flex justify-content-end">
                      <input
                        type="text"
                        value={tempSearchQuery}
                        onChange={(e)=>setTempSearchQuery(e.target.value)}
                        placeholder="search here"
                        className="form-control form-control-sm w-auto"
                      />
                    </Col>
                  </Row>
                </>
              )}

              {/* When reportType is 'api' - show API filters */}
              {reportType === 'api' && (
                <>
                  <Row className="align-items-end g-4 mt-3">
                    {/* Agent */}
                    <Col md={2}>
                      <Form.Group className="mb-0">
                        <Form.Label className="small mb-2">Agent</Form.Label>
                        <Form.Select 
                          size="sm" 
                          value={apiFilters.agent || ''}
                          onChange={(e) => setApiFilters({...apiFilters, agent: e.target.value})}
                        >
                          <option value="">Select</option>
                          <option value="API Agent">API Agent</option>
                          <option value="External Agent">External Agent</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>

                    {/* Hotel */}
                    <Col md={2}>
                      <Form.Group className="mb-0">
                        <Form.Label className="small mb-2">Hotel</Form.Label>
                        <Form.Select 
                          size="sm"
                          value={apiFilters.hotel || ''}
                          onChange={(e) => setApiFilters({...apiFilters, hotel: e.target.value})}
                        >
                          <option value="">Select</option>
                          <option value="Jumeirah Beach Hotel">Jumeirah Beach Hotel</option>
                          <option value="Test Hotel API">Test Hotel API</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>
                     
                    {/* From Date */}
                    <Col md={3}>
                      <Form.Group className="mb-0">
                        <Form.Label className="small mb-2">From Date</Form.Label>
                        <Form.Control 
                          type="date" 
                          size="sm" 
                          value={apiFilters.fromDate}
                          onChange={(e) => setApiFilters({...apiFilters, fromDate: e.target.value})}
                          max={apiFilters.toDate || undefined}
                        />
                      </Form.Group>
                    </Col>

                    {/* To Date */}
                    <Col md={3}>
                      <Form.Group className="mb-0">
                        <Form.Label className="small mb-2">To Date</Form.Label>
                        <Form.Control 
                          type="date" 
                          size="sm" 
                          value={apiFilters.toDate}
                          onChange={(e) => setApiFilters({...apiFilters, toDate: e.target.value})}
                          min={apiFilters.fromDate || undefined}
                        />
                      </Form.Group>
                    </Col>

                    {/* Search Button */}
                    <Col md={12} className="d-flex justify-content-end mt-3">
                      <Button variant="success" size="sm" onClick={handleSearch}>
                        <i className="fas fa-search me-1"></i>Search
                      </Button>
                    </Col>
                  </Row>

                  {/* Action Buttons */}
                  <Row className="mt-4">
                    <Col md={12} className="d-flex gap-2 justify-content-end">
                      <Button variant="outline-primary" size="sm" onClick={() => setShowMailModal(true)}>
                        <i className="fas fa-envelope me-1"></i>Mail
                      </Button>
                      <Button variant="outline-secondary" size="sm" onClick={handlePrint}>
                        <i className="fas fa-print me-1"></i>Print
                      </Button>
                      <Button variant="outline-danger" size="sm" onClick={handlePDF}>
                        <i className="fas fa-file-pdf me-1"></i>PDF
                      </Button>
                      <Button variant="outline-success" size="sm" onClick={handleExcel}>
                        <i className="fas fa-file-excel me-1"></i>Excel
                      </Button>
                    </Col>
                  </Row>

                  {/* Search Input */}
                  <Row className="mt-3">
                    <Col className="d-flex justify-content-end">
                      <input
                        type="text"
                        value={tempSearchQuery}
                        onChange={(e)=>setTempSearchQuery(e.target.value)}
                        placeholder="search here"
                        className="form-control form-control-sm w-auto"
                      />
                    </Col>
                  </Row>
                </>
              )}
            </div>

            {/* Table Section */}
            <Card.Body className="p-0 mt-1">
              {/* Display Dropdown - Only for Inhouse */}
              {reportType === 'inhouse' && (
                <div className="p-2 border-bottom">
                  <Row className="d-flex justify-content-between align-items-center">
                    <Col md="auto">
                      <span className="text-muted">Display</span>
                      <Form.Select size="sm" className="d-inline-block ms-2" style={{width: '80px'}}
                        value={inhouseitemsPerPage}
                        onChange={(e)=>{setInhouseItemsPerPage(Number(e.target.value))
                          setInhouseCurrentPage(1);
                        }}>
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </Form.Select>
                      <span className="text-muted ms-2">records</span>
                    </Col>
                  </Row>
                </div>
              )}

              {/* Display Dropdown - Only for API */}
              {reportType === 'api' && (
                <div className="p-2 border-bottom">
                  <Row className="d-flex justify-content-between align-items-center">
                    <Col md="auto">
                      <span className="text-muted">Display</span>
                      <Form.Select size="sm" className="d-inline-block ms-2" style={{width: '80px'}}
                        value={apiitemsPerPage}
                        onChange={(e)=>{setApiItemsPerPage(Number(e.target.value))
                          setApiCurrentPage(1);
                        }}>
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </Form.Select>
                      <span className="text-muted ms-2">records</span>
                    </Col>
                  </Row>
                </div>
              )}

              {/* INHOUSE TABLE */}
              {reportType === 'inhouse' && (
                <>
                  <Table responsive hover striped className="mb-0 align-middle">
                    <thead>
                      <tr>
                        <th style={{ width: 100 }}>S/N</th>
                        <th>Agent Name</th>
                        <th>Hotel Name</th>
                        <th>Hotel Type</th>
                        <th>Hotel Category</th> 
                        <th>Room Category</th> 
                        <th>No of Booking</th>
                        <th>Cancelled Booking</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentInhousebooking.length > 0 ? (
                        currentInhousebooking.map((booking, index) => (
                          <tr key={booking.slNo || index}>
                            <td>{inhouseStartIndex + index + 1}</td>
                            <td>{booking.agentName}</td>
                            <td>{booking.hotelName}</td>
                            <td>{booking.hotelType}</td>
                            <td>{booking.hotelCategory || booking.HotelCategory}</td>
                            <td>{booking.roomCategory}</td>
                            <td>{booking.noOfBooking}</td>
                            <td>{booking.cancelledBooking}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="8" className="text-center text-muted py-4">
                            No data found matching your criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                  
                  {/* Pagination */}
                  <div className="d-flex justify-content-between align-items-center p-3 border-top">
                    <div>
                      <small className="text-muted">
                        Showing {filteredinhousebookings.length > 0 ? inhouseStartIndex + 1 : 0} to {Math.min(inhouseEndIndex, filteredinhousebookings.length)} of {filteredinhousebookings.length} entries
                      </small>
                    </div>
                    <div>
                      <Pagination className="mb-0">
                        <Pagination.Prev onClick={()=> setInhouseCurrentPage(prev=> Math.max(1,prev-1))}
                          disabled={inhousecurrentPage === 1}/>

                        {Array.from({length:Inhousetotalpages},(_,i)=>i+1).map((pageNum)=>{
                          if(
                            pageNum === 1||
                            pageNum === Inhousetotalpages ||
                            (pageNum >= inhousecurrentPage -1 && pageNum <=inhousecurrentPage+1)
                          ){
                            return(
                              <Pagination.Item
                              key={pageNum}
                              active={pageNum === inhousecurrentPage}
                              onClick={()=>setInhouseCurrentPage(pageNum)}>
                                {pageNum}
                              </Pagination.Item>
                            )
                          }else if(
                            pageNum === inhousecurrentPage -2||
                            pageNum === inhousecurrentPage +2
                          ){
                            return <Pagination.Ellipsis key={pageNum}/>
                          }
                          return null;
                        })}

                        <Pagination.Next onClick={()=> setInhouseCurrentPage(prev=>Math.min(Inhousetotalpages,prev+1))}
                          disabled={inhousecurrentPage === Inhousetotalpages || Inhousetotalpages === 0}/>

                      </Pagination>
                    </div>
                  </div>
                </>
              )}

              {/* API TABLE */}
              {reportType === 'api' && (
                <>
                  <Table responsive hover striped className="mb-0 align-middle">
                    <thead>
                      <tr>
                        <th style={{ width: 100 }}>S/N</th>
                        <th>Hotel Name</th>
                        <th>Platform</th>
                        <th>Check In</th>
                        <th>Check Out</th>
                        <th>Hotel Type</th>
                        <th>No of Rooms</th>
                        <th>Customer Name</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentApibooking.length > 0 ? (
                        currentApibooking.map((booking, index) => (
                          <tr key={booking.slNo || index}>
                            <td>{apiStartIndex + index + 1}</td>
                            <td>{booking.hotelName}</td>
                            <td>{booking.platform}</td>
                            <td>{booking.checkIn}</td>
                            <td>{booking.checkOut}</td>
                            <td>{booking.hotelType}</td>
                            <td>{booking.noOfRooms}</td>
                            <td>{booking.customerName}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="8" className="text-center text-muted py-4">
                            No data found matching your criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </Table>

                  {/* Pagination */}
                  <div className="d-flex justify-content-between align-items-center p-3 border-top">
                    <div>
                      <small className="text-muted">
                        Showing {filteredapiBookings.length > 0 ? apiStartIndex + 1 : 0} to {Math.min(apiEndIndex, filteredapiBookings.length)} of {filteredapiBookings.length} entries
                      </small>
                    </div>
                    <div>
                      <Pagination className="mb-0">
                        <Pagination.Prev onClick={()=>setApiCurrentPage(prev =>Math.max(1,prev-1))}
                          disabled={apicurrentPage === 1}/>

                        {Array.from({length:Apitotalpages},(_,i)=>i+1).map((pageNum)=>{
                          if(
                            pageNum === 1||
                            pageNum === Apitotalpages||
                            (pageNum >= apicurrentPage -1 && pageNum <=apicurrentPage+1)
                          ){
                            return(
                              <Pagination.Item
                              key={pageNum}
                              active={pageNum===apicurrentPage}
                              onClick={()=>setApiCurrentPage(pageNum)}>
                                {pageNum}
                              </Pagination.Item>
                            )
                          }else if(
                            pageNum === apicurrentPage -2||
                            pageNum === apicurrentPage +2
                          ){
                            return <Pagination.Ellipsis key={pageNum}/>
                          }
                          return null;
                        })}

                        <Pagination.Next onClick={()=>setApiCurrentPage(prev =>Math.min(Apitotalpages,prev+1))}
                          disabled={apicurrentPage === Apitotalpages || Apitotalpages === 0}/>

                      </Pagination>
                    </div>
                  </div>
                </>
              )}
            </Card.Body>
          </Card>

          {/* Mail Modal */}
<Modal show={showMailModal} onHide={() => setShowMailModal(false)} centered>
  <Modal.Header closeButton={!isSending}>
    <Modal.Title>Send Report via Email</Modal.Title>
  </Modal.Header>
  <Modal.Body>
    <Form>
      <Form.Group className="mb-3">
        <Form.Label>Email Address <span className="text-danger">*</span></Form.Label>
        <Form.Control
          type="email"
          placeholder="Enter recipient email address"
          value={emailAddress}
          onChange={(e) => setEmailAddress(e.target.value)}
          disabled={isSending}
        />
      </Form.Group>
    </Form>
  </Modal.Body>
  <Modal.Footer>
    <Button variant="secondary" onClick={() => setShowMailModal(false)} disabled={isSending}>
      Cancel
    </Button>
    <Button variant="success" onClick={handleSendEmail} disabled={isSending || !emailAddress}>
      {isSending ? (
        <>
          <span className="spinner-border spinner-border-sm me-2"></span>
          Sending...
        </>
      ) : (
        <>
          <i className="fas fa-paper-plane me-1"></i>Send Email
        </>
      )}
    </Button>
  </Modal.Footer>
</Modal>
        </main>
      </div>
    </div>
  );
}

export default AgentWise;
