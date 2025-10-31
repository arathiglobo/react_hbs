import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../../components/AxiosInstance";
import TopBar from "../../components/TopBar";
import Sidebar from "../../components/Sidebar";

const Profile = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);

  const fetchViewProfile = async () => {
    try {
      const userName = localStorage.getItem("UserName");
      console.log("Logged-in user:", userName);

      const response = await axiosInstance.get(`/api/personalProfile/${userName}`);
      console.log("Profile Data:", response.data);

      setProfile(response.data);
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  };

  useEffect(() => {
    fetchViewProfile();
  }, []);

  if (!profile) {
    return <div className="text-center mt-5">Loading profile...</div>;
  }

  return (
    <div className="d-flex">
      {/* Sidebar (fixed on the left) */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex-grow-1">
        {/* Top bar */}
        <TopBar />

        <div className="container-fluid mt-4">
          <h3 className="mb-4 fw-bold">Company Profile</h3>

          <div className="card p-4 shadow rounded-3">
            <div className="row mb-3">
              <div className="col-md-6">
                <label className="form-label fw-semibold">Name</label>
                <input type="text" value={profile.name || ""} readOnly className="form-control" />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold">Authorized Person</label>
                <input type="text" value={profile.authorizedPerson || ""} readOnly className="form-control" />
              </div>
            </div>

            <div className="row mb-3">
              <div className="col-md-6">
                <label className="form-label fw-semibold">Address</label>
                <input type="text" value={profile.address || ""} readOnly className="form-control" />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold">Website</label>
                <input type="text" value={profile.website || ""} readOnly className="form-control" />
              </div>
            </div>

            <div className="row mb-3">
              <div className="col-md-6">
                <label className="form-label fw-semibold">Main Office</label>
                <input type="text" value={profile.mainOffice || ""} readOnly className="form-control" />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold">Mail ID</label>
                <input type="text" value={profile.mailId || ""} readOnly className="form-control" />
              </div>
            </div>

            <div className="row mb-3">
              <div className="col-md-6">
                <label className="form-label fw-semibold">Telephone</label>
                <input type="text" value={profile.telephone || ""} readOnly className="form-control" />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold">Fax Number</label>
                <input type="text" value={profile.faxNumber || ""} readOnly className="form-control" />
              </div>
            </div>

            <div className="row mb-3">
              <div className="col-md-6">
                <label className="form-label fw-semibold">Mobile</label>
                <input type="text" value={profile.mobile || ""} readOnly className="form-control" />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold">Post Office</label>
                <input type="text" value={profile.postOffice || ""} readOnly className="form-control" />
              </div>
            </div>

            <div className="row">
              <div className="col-md-6">
                <label className="form-label fw-semibold">Markup</label>
                <input type="text" value={profile.markup || ""} readOnly className="form-control" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
