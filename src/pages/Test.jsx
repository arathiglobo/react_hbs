import React, { useState } from "react";
import axiosInstance from "../components/AxiosInstance";

const Test = () => {
    const [name , setName] = useState("");
    const [place , setPlace] = useState("");

const handleSubmit = async () => {
  try {
    const response = await axiosInstance.get("/api/hotels");
    console.log("hotel list:" , response.data);
  } catch (error) {
    console.error("Error fetching hotels:", error);
  }
};





  return (
    <div>
      <h1>Its Test</h1>
      <div className="row">
        <div>
          <label htmlFor="name">Name</label>
          <input type="text"
           className="name"
            id="name" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            />
        </div>
        <div>
              <label htmlFor="place">Place</label>
          <input type="text" className="place" id="place" value={place} onChange={(e) => setPlace(e.target.value)}/>
        </div>
        <div>
            <button type="submit" className="submit" onClick={handleSubmit}>Submit</button>
        </div>
      </div>
    </div>
  );
};

export default Test;
