import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

const SearchableSelect = ({
  name,
  value,
  onChange,
  options = [],
  placeholder = "Search and select...",
  isInvalid = false,
  disabled = false,
  isLoading = false,
  onInputChange,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredOptions, setFilteredOptions] = useState([]);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef(null);

  useEffect(() => {
    if (!Array.isArray(options)) { setFilteredOptions([]); return; }
    if (searchTerm.trim()) {
      setFilteredOptions(options.filter((opt) =>
        (opt.name || String(opt)).toLowerCase().includes(searchTerm.toLowerCase())
      ));
    } else {
      setFilteredOptions(options);
    }
  }, [searchTerm, options]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const top = spaceBelow < 200
        ? rect.top + window.scrollY - 200
        : rect.bottom + window.scrollY;
      setDropdownPosition({ top, left: rect.left + window.scrollX, width: rect.width });
    }
  }, [isOpen]);

  const openDropdown = () => { if (!disabled) setIsOpen(true); };

  const closeDropdown = () => {
    setIsOpen(false);
    setSearchTerm("");
    if (onInputChange) onInputChange("");
  };

  const toggleDropdown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    if (isOpen) closeDropdown();
    else openDropdown();
  };

  const handleInputChange = (e) => {
    if (disabled) return;
    const val = e.target.value;
    setSearchTerm(val);
    if (!isOpen) setIsOpen(true);
    if (onInputChange) onInputChange(val);
  };

  const handleSelect = (option) => {
    const selectedValue = option.id !== undefined ? option.id : option;
    onChange({ target: { name, value: selectedValue } });
    setIsOpen(false);
    setSearchTerm("");
    if (onInputChange) onInputChange("");
  };

  const selectedOption = Array.isArray(options)
    ? options.find((opt) => String(opt.id) === String(value))
    : null;

  const displayValue = isOpen ? searchTerm : selectedOption?.name || "";

  return (
    <>
      <div
        className={className}
        style={{
          position: "relative",
          display: "block",
          width: "100%",
        }}
      >
        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={openDropdown}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          className={`form-control${isInvalid ? " is-invalid" : ""}`}
          style={{
            paddingRight: "2.5rem",
            width: "100%",
            boxSizing: "border-box",
          }}
        />

        {/* Arrow button — absolute positioned inside wrapper, on top of input */}
        <button
          type="button"
          onClick={toggleDropdown}
          disabled={disabled}
          tabIndex={-1}
          style={{
            position: "absolute",
            right: "1px",
            top: "1px",
            bottom: "1px",
            width: "36px",
            background: "transparent",
            border: "none",
            cursor: disabled ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
            padding: 0,
            outline: "none",
            color: disabled ? "#adb5bd" : "#6c757d",
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{
              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease",
              display: "block",
              flexShrink: 0,
            }}
          >
            <path
              d="M2.5 5L7 9.5L11.5 5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* Dropdown portal */}
      {isOpen && !disabled && createPortal(
        <>
          {/* Backdrop */}
          <div
            onClick={closeDropdown}
            style={{
              position: "fixed",
              top: 0, left: 0, right: 0, bottom: 0,
              zIndex: 999998,
            }}
          />
          {/* Options list */}
          <div
            style={{
              position: "fixed",
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              width: dropdownPosition.width,
              zIndex: 999999,
              maxHeight: "200px",
              overflowY: "auto",
              backgroundColor: "white",
              border: "1px solid #dee2e6",
              borderRadius: "0.375rem",
              boxShadow: "0 0.5rem 1rem rgba(0,0,0,0.15)",
            }}
          >
            {isLoading ? (
              <div style={{ padding: "0.75rem 1rem", textAlign: "center", color: "#6c757d", fontSize: "14px" }}>
                <span className="spinner-border spinner-border-sm me-2" role="status" />
                Loading...
              </div>
            ) : filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <div
                  key={option.id}
                  onClick={() => handleSelect(option)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#f0f4ff";
                    e.currentTarget.style.color = "#0d6efd";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "white";
                    e.currentTarget.style.color = "#212529";
                  }}
                  style={{
                    padding: "0.5rem 1rem",
                    cursor: "pointer",
                    fontSize: "14px",
                    lineHeight: "1.5",
                    color: "#212529",
                    borderBottom: "1px solid #f8f9fa",
                  }}
                >
                  {option.name || option.countryName || option.stateName || option.placeName || String(option)}
                </div>
              ))
            ) : (
              <div style={{ padding: "0.5rem 1rem", color: "#6c757d", fontStyle: "italic", fontSize: "14px" }}>
                No options found
              </div>
            )}
          </div>
        </>,
        document.body
      )}
    </>
  );
};

export default SearchableSelect;