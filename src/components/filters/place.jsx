import { useEffect, useState } from "react";
import { Form } from "react-bootstrap";
import axiosInstance from "../AxiosInstance";

const RESULT_LIMIT = 50;
const SEARCH_DELAY_MS = 300;

// There are far more destinations than can be loaded up front, so the list is
// searched on the server as the user types instead of filtered locally.
// onChange(id, place) also hands back the selected place ({ id, name, country, ... }).
export default function Place({ value, onChange }) {
  const [places, setPlaces] = useState([]);
  const [selected, setSelected] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return undefined;
    const term = searchTerm.trim();
    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const params = { page: 0, limit: RESULT_LIMIT };
        if (term) params.search = term;
        const res = await axiosInstance.get("/api/destination", { params });
        if (!cancelled) {
          setPlaces(Array.isArray(res.data) ? res.data.filter((p) => p && !p.isDeleted) : []);
        }
      } catch (err) {
        console.error("Error fetching places:", err);
        if (!cancelled) setPlaces([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, term ? SEARCH_DELAY_MS : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchTerm, isOpen]);

  const selectedName =
    value && selected && String(selected.id) === String(value) ? selected.name : "";

  const close = () => {
    setIsOpen(false);
    setSearchTerm("");
  };

  return (
    <Form.Group>
      <Form.Label>Place</Form.Label>
      <div className="position-relative">
        <Form.Control
          size="sm"
          value={isOpen ? searchTerm : selectedName}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={isOpen && selectedName ? selectedName : "Select"}
          autoComplete="off"
        />
        {isOpen && (
          <>
            <div className="position-absolute w-100 bg-white border shadow-lg"
                 style={{ zIndex: 1050, maxHeight: "200px", overflowY: "auto", top: "100%" }}>
              {isLoading ? (
                <div className="px-3 py-2 text-muted">Searching...</div>
              ) : places.length > 0 ? places.map((opt) => (
                <div key={opt.id} className="px-3 py-2"
                     style={{ cursor: "pointer" }}
                     onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#f8f9fa"; }}
                     onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "white"; }}
                     onClick={() => { setSelected(opt); onChange(opt.id, opt); close(); }}>
                  {opt.name}
                  {opt.country && <small className="text-muted ms-1">({opt.country})</small>}
                </div>
              )) : (
                <div className="px-3 py-2 text-muted">
                  {searchTerm.trim() ? "No matching places" : "Type to search places"}
                </div>
              )}
            </div>
            <div className="position-fixed" style={{ top: 0, left: 0, right: 0, bottom: 0, zIndex: 1040 }}
                 onClick={close} />
          </>
        )}
      </div>
    </Form.Group>
  );
}
