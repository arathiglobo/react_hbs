import {React , useEffect} from 'react';
import { useNavigate } from "react-router-dom";

const Profile = () => {
   const navigate = useNavigate();

    const fetchViewProfile = async () => {
    try {
     
      // const response = await axios.get("/api/user/profile", {
      //   withCredentials: true,
      // });

      // console.log("Profile Data:", response.data);
     

      // navigate("/view-profile", { state: { userProfile: response.data } });
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  };

  useEffect(() => {
      fetchViewProfile();
    }, []);


  return (
    <div>Profile</div>
  )
}

export default Profile;