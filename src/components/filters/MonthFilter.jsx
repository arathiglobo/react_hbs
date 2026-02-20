import { useState } from "react";
import { Form } from "react-bootstrap";

export default function MonthFilter({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const months = [
    { id: "January", name: "January" },
    { id: "February", name: "February" },
    { id: "March", name: "March" },
    { id: "April", name: "April" },
    { id: "May", name: "May" },
    { id: "June", name: "June" },
    { id: "July", name: "July" },
    { id: "August", name: "August" },
    { id: "September", name: "September" },
    { id: "October", name: "October" },
    { id: "November", name: "November" },
    { id: "December", name: "December" },
  ];

  const filtered = searchTerm 
    ? months.filter(m => m.name?.toLowerCase().includes(searchTerm.toLowerCase()))
    : months;
  const selectedOption = months.find(opt => String(opt.id) === String(value));

  return (
    <Form.Group>
      <Form.Label>Month</Form.Label>
      <div className="position-relative">
        <Form.Control
          size="sm"
          value={isOpen ? searchTerm : (selectedOption?.name || "")}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Select Month"
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
