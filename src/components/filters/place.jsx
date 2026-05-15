import { useEffect, useState } from "react";
import { Form } from "react-bootstrap";
import axiosInstance from "../AxiosInstance";

export default function Place({ value, onChange }) {
  const [places, setPlaces] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPlaces = async () => {
      try {
        setIsLoading(true);
        const res = await axiosInstance.get("/api/destination?page=0&limit=1000");
        if (Array.isArray(res.data)) {
          setPlaces(res.data.filter(p => p && !p.isDeleted));
        } else {
          setPlaces([]);
        }
      } catch (err) {
        console.error("Error fetching places:", err);
        try {
          const res = await axiosInstance.get("/api/destination?page=0&limit=100");
          if (Array.isArray(res.data)) {
            setPlaces(res.data.filter(p => p && !p.isDeleted));
          }
        } catch (retryErr) {
          console.error("Retry also failed:", retryErr);
          setPlaces([]);
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchPlaces();
  }, []);

  const filtered = searchTerm 
    ? places.filter(p => p.name?.toLowerCase().includes(searchTerm.toLowerCase()))
    : places;
  const selectedOption = places.find(opt => String(opt.id) === String(value));

  return (
    <Form.Group>
      <Form.Label>Place</Form.Label>
      <div className="position-relative">
        <Form.Control
          size="sm"
          value={isOpen ? searchTerm : (selectedOption?.name || "")}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={isLoading ? "Loading..." : "Select"}
          autoComplete="off"
          disabled={isLoading}
        />
        {isOpen && !isLoading && (
          <>
            <div className="position-absolute w-100 bg-white border shadow-lg" 
                 style={{ zIndex: 1050, maxHeight: "200px", overflowY: "auto", top: "100%" }}>
              {filtered.length > 0 ? filtered.map(opt => (
                <div key={opt.id} className="px-3 py-2" 
                     style={{ cursor: "pointer" }}
                     onMouseEnter={e => e.target.style.backgroundColor = "#f8f9fa"}
                     onMouseLeave={e => e.target.style.backgroundColor = "white"}
                     onClick={() => { onChange(opt.id); setIsOpen(false); setSearchTerm(""); }}>
                  {opt.name}
                </div>
              )) : (
                <div className="px-3 py-2 text-muted">No places available</div>
              )}
            </div>
            <div className="position-fixed" style={{ top: 0, left: 0, right: 0, bottom: 0, zIndex: 1040 }}
                 onClick={() => { setIsOpen(false); setSearchTerm(""); }} />
          </>
        )}
      </div>
    </Form.Group>
  );
}
