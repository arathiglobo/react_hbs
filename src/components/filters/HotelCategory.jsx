import { useEffect, useState } from "react";
import axiosInstance from "../AxiosInstance";
import { Form } from "react-bootstrap";

export default function HotelCategory({ value, onChange }) {
  const [category, setCategory] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    axiosInstance.get("/api/hotelcategory")
      .then((res) => setCategory(res.data || []))
      .catch((err) => console.log(err));
  }, []);

  const filtered = searchTerm 
    ? category.filter(c => c.hotelCategory?.toLowerCase().includes(searchTerm.toLowerCase()))
    : category;
  const selectedOption = category.find(opt => String(opt.hotelCategoryId) === String(value));

  return (
    <Form.Group>
      <Form.Label>Hotel Category</Form.Label>
      <div className="position-relative">
        <Form.Control
          size="sm"
          value={isOpen ? searchTerm : (selectedOption?.hotelCategory || "")}
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
                <div key={opt.hotelCategoryId} className="px-3 py-2" 
                     style={{ cursor: "pointer" }}
                     onMouseEnter={e => e.target.style.backgroundColor = "#f8f9fa"}
                     onMouseLeave={e => e.target.style.backgroundColor = "white"}
                     onClick={() => { onChange(opt.hotelCategoryId); setIsOpen(false); setSearchTerm(""); }}>
                  {opt.hotelCategory}
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
