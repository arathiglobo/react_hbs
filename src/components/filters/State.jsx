import { useEffect, useState } from "react";
import axiosInstance from "../AxiosInstance";
import { Form } from "react-bootstrap";

export default function State({ value, onChange }) {
  const [states, setStates] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    axiosInstance.get("/api/destination?page=0&limit=1000")
      .then((res) => {
        const filtered = res.data.filter(s => !s.isDeleted);
        const uniqueStatesMap = new Map();
        filtered.forEach((dest) => {
          if (dest.stateId && dest.state && !uniqueStatesMap.has(dest.stateId)) {
            uniqueStatesMap.set(dest.stateId, {
              id: dest.stateId,
              stateName: dest.state
            });
          }
        });
        const statesArray = Array.from(uniqueStatesMap.values());
        statesArray.sort((a, b) => a.stateName.localeCompare(b.stateName));
        setStates(statesArray);
      })
      .catch((err) => console.log(err));
  }, []);

  const filtered = searchTerm 
    ? states.filter(s => s.stateName?.toLowerCase().includes(searchTerm.toLowerCase()))
    : states;
  const selectedOption = states.find(opt => String(opt.id) === String(value));

  return (
    <Form.Group>
      <Form.Label>Province</Form.Label>
      <div className="position-relative">
        <Form.Control
          size="sm"
          value={isOpen ? searchTerm : (selectedOption?.stateName || "")}
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
                <div key={opt.id} className="px-3 py-2" 
                     style={{ cursor: "pointer" }}
                     onMouseEnter={e => e.target.style.backgroundColor = "#f8f9fa"}
                     onMouseLeave={e => e.target.style.backgroundColor = "white"}
                     onClick={() => { onChange(opt.id); setIsOpen(false); setSearchTerm(""); }}>
                  {opt.stateName}
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
