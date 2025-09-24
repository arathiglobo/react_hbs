import React from "react";
import { Routes, Route, Link } from "react-router-dom";
import Login from "./pages/Login";
import SelectRole from "./pages/SelectRole";
import Register from "./pages/Register";

import Country from "./pages/master/Country";
import Destination from "./pages/master/Destination";
import Hotels from "./pages/master/Hotels";
import PrivateRoute from "./components/PrivateRoute";
import AgentDashboard from "./pages/AgentDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import StaffDashboard from "./pages/StaffDashboard";
import Test from "./pages/Test";
import LandingPage from "./pages/LandingPage";
import { Toaster } from "react-hot-toast";
import Designations from "./pages/master/Designation";
import HotelSearch from "./pages/HotelSearch";
import RoomList from "./pages/RoomList";
import HotelBookingList from "./pages/list/HotelBookingList";
import Bank from "./pages/master/Bank";
import ContactType from "./pages/master/ContactType";
import MarkupType from "./pages/master/MarkupType";
import Currency from "./pages/master/Currency";
import HotelRegistrationActions from "./pages/HotelRegistrationActions";
import MarketType from "./pages/master/MarketType";
import Region from "./pages/master/Region";
import Province from "./pages/master/Province";
import CityMapping from "./pages/master/CityMapping";
import HotelBookingPage from "./pages/HotelBookingPage";
import AgentReg from "./pages/Registration/AgentReg";
import HotelReg from "./pages/Registration/HotelReg";
import HotelList from "./pages/Registration/HotelList";
import EmployeeReg from "./pages/Registration/EmployeeReg";
import CabReg from "./pages/Registration/CabReg";





export default function App() {
  return (
    <div>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/select-userRole" element={<SelectRole />} />
        <Route path="/register" element={<Register />} />
        <Route path="/agentDashboard" element={<AgentDashboard />} />
        {/* Protected Routes */}
       <Route
          path="/hotels"
          element={
            <PrivateRoute>
              <>
                <Hotels />
              </>
            </PrivateRoute>
          }
        />
        <Route
          path="/adminDashboard"
          element={
            <PrivateRoute>
              <AdminDashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/agentDashboard"
          element={
            <PrivateRoute>
              <AgentDashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/booking-details/hotel-booking-list"
          element={
            <PrivateRoute>
              <HotelBookingList />
            </PrivateRoute>
          }
        />
        <Route
          path="/staffDashboard"
          element={
            <PrivateRoute>
              <StaffDashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/landingPage"
          element={
            <PrivateRoute>
              <LandingPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/test"
          element={
            <PrivateRoute>
              <Test />
            </PrivateRoute>
          }
        />
        <Route path="/masters/designations" element={<Designations />} />
        <Route path="/masters/bank" element={<Bank />} />
         <Route path="/masters/contact-type" element={<ContactType />} />
         <Route path="/masters/markup-type" element={<MarkupType />} />
         <Route path="/masters/currency" element={<Currency />} />
        <Route path="/new-booking/hotel" element={<HotelSearch />} />
        <Route path="/room-list" element={<RoomList />} />
        <Route path="/masters/market-type" element={<MarketType />} />
        <Route path="/masters/region" element={<Region />} />
        <Route path="/masters/countries" element={<Country />} />
        <Route path="/masters/states" element={<Province />} />
       <Route path="/masters/destination" element={<Destination />} />
       <Route path="/masters/city-mapping" element={<CityMapping />} />
       <Route path="/hotel-booking-page" element={<HotelBookingPage/>} />
       <Route path="/registration/agent" element={<AgentReg />} />
       <Route path="/registration/employee" element={<EmployeeReg />} />
       <Route path="/registration/cab" element={<CabReg />} />
       <Route path="/registration/hotel" element={<HotelList />} />
       <Route path="/registration/hotel/create" element={<HotelReg />} />
       <Route path="/registration/hotel/create/:id" element={<HotelReg />} />
       <Route path="/hotel-details/:id" element={<HotelRegistrationActions />} />

      </Routes>

      {/* Toast container */}
      <Toaster
        // position="top-center"
        containerStyle={{
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
        toastOptions={{
          duration: 5000,
          style: {
            background: "#363636",
            color: "#fff",
          },
          success: {
            duration: 5000,
            iconTheme: {
              primary: "#4bb543",
              secondary: "#fff",
            },
          },
          error: {
            duration: 6000,
            iconTheme: {
              primary: "#ff3333",
              secondary: "#fff",
            },
          },
        }}
      />
    </div>
  );
}
