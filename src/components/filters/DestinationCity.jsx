import React, { useEffect, useRef, useState } from "react";
import { Form } from "react-bootstrap";
import axiosInstance from "../AxiosInstance";
import chevronStyle from "./dropdownChevron";

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Destination / City searchable dropdown backed by /api/province — the same
 * source as the hotel search page. Styled like the other filter components
 * (plain Form.Control + dropdown list) so it blends in with sibling filters.
 *
 * onChange receives the plain city/state name (e.g. "Kerala") — the display
 * label shown in the list is "City,Country" (e.g. "Kerala,India").
 */
export default function DestinationCity({ value, onChange, label }) {
  const [options, setOptions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);

  // Parent cleared the filter (e.g. Reset) — drop the shown selection
  useEffect(() => {
    if (!value) setSelectedOption(null);
  }, [value]);

  const mapOptions = (data) =>
    (Array.isArray(data) ? data : []).slice(0, 50).map((city) => ({
      id: city.id,
      name: city.stateName || city.name,
      label: `${city.stateName || city.name},${city.country}`,
    }));

  const loadPopular = async () => {
    setIsLoading(true);
    try {
      const res = await axiosInstance.get("/api/province?limit=50");
      setOptions(mapOptions(res.data));
    } catch (err) {
      console.error("Error fetching cities:", err);
      setOptions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const debouncedSearch = useRef(
    debounce(async (text) => {
      setIsLoading(true);
      try {
        const res = await axiosInstance.get(`/api/province?search=${text}`);
        setOptions(mapOptions(res.data));
      } catch (err) {
        console.error("Error searching cities:", err);
        setOptions([]);
      } finally {
        setIsLoading(false);
      }
    }, 300)
  ).current;

  const handleInput = (text) => {
    setSearchTerm(text);
    if (!isOpen) setIsOpen(true);
    if (text.length >= 2) {
      debouncedSearch(text);
    } else if (text.length === 0) {
      loadPopular();
    }
  };

  // Short terms are filtered client-side; 2+ chars come server-filtered
  const filtered =
    searchTerm && searchTerm.length < 2
      ? options.filter((o) =>
          o.label.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : options;

  return (
    <Form.Group>
      {label ? <Form.Label>{label}</Form.Label> : null}
      <div className="position-relative">
        <Form.Control
          size="sm"
          style={chevronStyle}
          value={isOpen ? searchTerm : (selectedOption?.label || "")}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => {
            setIsOpen(true);
            if (options.length === 0) loadPopular();
          }}
          placeholder="City"
          autoComplete="off"
        />
        {isOpen && (
          <>
            <div
              className="position-absolute w-100 bg-white border shadow-lg"
              style={{ zIndex: 1050, maxHeight: "200px", overflowY: "auto", top: "100%" }}
            >
              {isLoading ? (
                <div className="px-3 py-2 text-muted">Loading...</div>
              ) : filtered.length > 0 ? (
                filtered.map((opt) => (
                  <div
                    key={opt.id}
                    className="px-3 py-2"
                    style={{ cursor: "pointer" }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8f9fa")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "white")}
                    onClick={() => {
                      setSelectedOption(opt);
                      onChange(opt.name);
                      setIsOpen(false);
                      setSearchTerm("");
                    }}
                  >
                    {opt.label}
                  </div>
                ))
              ) : (
                <div className="px-3 py-2 text-muted">
                  {searchTerm.length >= 2 ? "No cities found" : "Type to search cities"}
                </div>
              )}
            </div>
            <div
              className="position-fixed"
              style={{ top: 0, left: 0, right: 0, bottom: 0, zIndex: 1040 }}
              onClick={() => {
                setIsOpen(false);
                setSearchTerm("");
              }}
            />
          </>
        )}
      </div>
    </Form.Group>
  );
}
