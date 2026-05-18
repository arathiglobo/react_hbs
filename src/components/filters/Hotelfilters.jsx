import { useEffect, useState } from "react";
import { Form } from "react-bootstrap";
import axiosInstance from "../AxiosInstance";

export default function HotelFilter({ value, onChange }) {
  const [hotels, setHotels] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    axiosInstance.get("/api/hotels")
      .then(res => setHotels(res.data || []))
      .catch(err => console.error(err));
  }, []);

  const filtered = searchTerm 
    ? hotels.filter(h => h.hotelName?.toLowerCase().includes(searchTerm.toLowerCase()))
    : hotels;
  const selectedOption = hotels.find(opt => String(opt.id) === String(value));

  return (
    <Form.Group>
      <Form.Label>Hotel</Form.Label>
      <div className="position-relative">
        <Form.Control
          size="sm"
          value={isOpen ? searchTerm : (selectedOption?.hotelName || "")}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Select Hotel"
          autoComplete="off"
        />
        {isOpen && (
          <>
            <div className="position-absolute w-100 bg-white border shadow-lg" 
                 style={{ zIndex: 1050, maxHeight: "200px", overflowY: "auto", top: "100%" }}>
              {filtered.map(opt => (
                <div key={opt.id} className="px-3 py-2" 
                     style={{ cursor: "pointer" }}
                     onMouseEnter={e => e.target.style.backgroundColor = "#f8f9fa"}
                     onMouseLeave={e => e.target.style.backgroundColor = "white"}
                     onClick={() => { onChange(opt.id); setIsOpen(false); setSearchTerm(""); }}>
                  {opt.hotelName}
                </div>
              ))}
            </div>
            <div className="position-fixed" style={{ top: 0, left: 0, right: 0, bottom: 0, zIndex: 1040 }}
                 onClick={() => { setIsOpen(false); setSearchTerm(""); }} />
          </>
        )}
      </div>
    </Form.Group>
  );
}
