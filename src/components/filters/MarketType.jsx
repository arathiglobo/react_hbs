import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Form } from "react-bootstrap";
import axiosInstance from "../AxiosInstance";

export default function MarketType({ value, onChange }) {
  const [marketTypes, setMarketTypes] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const [isPositionReady, setIsPositionReady] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    axiosInstance.get("/api/marketType")
      .then(res => setMarketTypes((res.data || []).filter(m => !m.isDeleted)))
      .catch(err => console.error(err));
  }, []);

  // Calculate dropdown position when it opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      const updatePosition = () => {
        if (inputRef.current) {
          const rect = inputRef.current.getBoundingClientRect();
          setDropdownPosition({
            top: rect.bottom,
            left: rect.left,
            width: rect.width
          });
          setIsPositionReady(true);
        }
      };
      
      // Calculate position immediately
      updatePosition();
      
      // Update position on scroll or resize
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
        setIsPositionReady(false);
      };
    } else {
      setIsPositionReady(false);
    }
  }, [isOpen]);

  const filtered = searchTerm 
    ? marketTypes.filter(m => m.name?.toLowerCase().includes(searchTerm.toLowerCase()))
    : marketTypes;
  const selectedOption = marketTypes.find(opt => String(opt.marketTypeId) === String(value));

  const handleSelect = (opt) => {
    onChange(opt.marketTypeId);
    setIsOpen(false);
    setSearchTerm("");
  };

  const dropdownMenu = isOpen && isPositionReady && (
    <>
      <div 
        className="bg-white border shadow-lg" 
        style={{ 
          position: "fixed",
          top: `${dropdownPosition.top}px`,
          left: `${dropdownPosition.left}px`,
          width: `${dropdownPosition.width}px`,
          zIndex: 9999, 
          maxHeight: "200px", 
          overflowY: "auto",
          transition: "none",
          animation: "none",
          transform: "none",
          willChange: "auto"
        }}
      >
        {filtered.length === 0 ? (
          <div className="px-3 py-2 text-muted">No market types found</div>
        ) : (
          filtered.map(opt => (
            <div 
              key={opt.marketTypeId} 
              className="px-3 py-2" 
              style={{ cursor: "pointer" }}
              onMouseEnter={e => e.target.style.backgroundColor = "#f8f9fa"}
              onMouseLeave={e => e.target.style.backgroundColor = "white"}
              onClick={() => handleSelect(opt)}
            >
              {opt.name}
            </div>
          ))
        )}
      </div>
      <div 
        className="position-fixed" 
        style={{ top: 0, left: 0, right: 0, bottom: 0, zIndex: 9998 }}
        onClick={() => { setIsOpen(false); setSearchTerm(""); }} 
      />
    </>
  );

  return (
    <Form.Group>
      <Form.Label>Market Type</Form.Label>
      <div className="position-relative">
        <Form.Control
          ref={inputRef}
          size="sm"
          value={isOpen ? searchTerm : (selectedOption?.name || "")}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            if (inputRef.current) {
              const rect = inputRef.current.getBoundingClientRect();
              setDropdownPosition({
                top: rect.bottom,
                left: rect.left,
                width: rect.width
              });
              setIsPositionReady(true);
            }
            setIsOpen(true);
          }}
          placeholder="Select Market Type"
          autoComplete="off"
        />
        {isOpen && createPortal(dropdownMenu, document.body)}
      </div>
    </Form.Group>
  );
}



