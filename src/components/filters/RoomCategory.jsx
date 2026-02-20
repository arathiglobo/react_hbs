import { useEffect, useState } from "react";
import { Form } from "react-bootstrap";
import axiosInstance from "../AxiosInstance";

export default function RoomCategory({ value, onChange, filteredIds = null }) {
  const [roomCategory, setRoomCategory] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    axiosInstance.get("/api/roomCategory")
      .then(res => setRoomCategory(res.data || []))
      .catch(err => console.error(err));
  }, []);

  // Filter by available room category IDs if provided
  const availableCategories = filteredIds && filteredIds.length > 0
    ? roomCategory.filter(rc => filteredIds.includes(Number(rc.roomCategoryId)))
    : roomCategory;

  const filtered = searchTerm 
    ? availableCategories.filter(rc => rc.roomCategory?.toLowerCase().includes(searchTerm.toLowerCase()))
    : availableCategories;
  
  // Find selected option from available categories
  const selectedOption = availableCategories.find(opt => String(opt.roomCategoryId) === String(value));

  return (
    <Form.Group>
      <Form.Label>Room category</Form.Label>
      <div className="position-relative">
        <Form.Control
          size="sm"
          value={isOpen ? searchTerm : (selectedOption?.roomCategory || "")}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Select"
          autoComplete="off"
        />
        {isOpen && (
          <>
            <div className="position-absolute w-100 bg-white border shadow-lg" 
                 style={{ zIndex: 1050, maxHeight: "200px", overflowY: "auto", top: "100%" }}>
              {filtered.map(opt => (
                <div key={opt.roomCategoryId} className="px-3 py-2" 
                     style={{ cursor: "pointer" }}
                     onMouseEnter={e => e.target.style.backgroundColor = "#f8f9fa"}
                     onMouseLeave={e => e.target.style.backgroundColor = "white"}
                     onClick={() => { onChange(opt.roomCategoryId); setIsOpen(false); setSearchTerm(""); }}>
                  {opt.roomCategory}
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
