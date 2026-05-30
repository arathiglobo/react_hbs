import { useEffect, useState } from "react";
import { Form } from "react-bootstrap";
import axiosInstance from "../AxiosInstance";

export default function HotelTypefilters({ value, onChange }) {
  const [hotelTypes, setHotelTypes] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    axiosInstance.get("/api/hotelType")
      .then(res => setHotelTypes(res.data || []))
      .catch(err => console.error(err));
  }, []);

  const filtered = searchTerm 
    ? hotelTypes.filter(ht => ht.name?.toLowerCase().includes(searchTerm.toLowerCase()))
    : hotelTypes;
  const selectedOption = hotelTypes.find(opt => String(opt.hotelTypeId) === String(value));

  return (
    <Form.Group>
      <Form.Label>Hotel Type</Form.Label>
      <div className="position-relative">
        <Form.Control
          size="sm"
          value={isOpen ? searchTerm : (selectedOption?.name || "")}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Select Hotel Type"
          autoComplete="off"
        />
        {isOpen && (
          <>
            <div className="position-absolute w-100 bg-white border shadow-lg" 
                 style={{ zIndex: 1050, maxHeight: "200px", overflowY: "auto", top: "100%" }}>
              {filtered.map(opt => (
                <div key={opt.hotelTypeId} className="px-3 py-2" 
                     style={{ cursor: "pointer" }}
                     onMouseEnter={e => e.target.style.backgroundColor = "#f8f9fa"}
                     onMouseLeave={e => e.target.style.backgroundColor = "white"}
                     onClick={() => { onChange(opt.hotelTypeId); setIsOpen(false); setSearchTerm(""); }}>
                  {opt.name}
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
