import { useEffect, useState } from "react";
import { Form } from "react-bootstrap";
import axiosInstance from "../AxiosInstance";

export default function City({ value, onChange, countryId }) {
  const [cities, setCities] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!countryId) {
      setCities([]);
      return;
    }
    const fetchCities = async () => {
      try {
        setIsLoading(true);
        const res = await axiosInstance.get(`/api/province/getByCountryId/${countryId}`);
        if (Array.isArray(res.data)) {
          setCities(
            res.data
              .filter(c => c && !c.isDeleted)
              .map(c => ({ id: c.id, name: c.stateName || c.name }))
          );
        } else {
          setCities([]);
        }
      } catch (err) {
        console.error("Error fetching cities:", err);
        setCities([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCities();
  }, [countryId]);

  const filtered = searchTerm
    ? cities.filter(c => c.name?.toLowerCase().includes(searchTerm.toLowerCase()))
    : cities;
  const selectedOption = cities.find(opt => String(opt.id) === String(value));

  return (
    <Form.Group>
      <Form.Label>City</Form.Label>
      <div className="position-relative">
        <Form.Control
          size="sm"
          value={isOpen ? searchTerm : (selectedOption?.name || "")}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={!countryId ? "Select Country first" : (isLoading ? "Loading..." : "Select City")}
          autoComplete="off"
          disabled={!countryId || isLoading}
        />
        {isOpen && !isLoading && countryId && (
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
                <div className="px-3 py-2 text-muted">No cities available</div>
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
