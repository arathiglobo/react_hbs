import React, { useEffect, useRef, useState } from "react";
import { FaGlobe, FaMapMarkerAlt } from "react-icons/fa";
import axiosInstance from "../../../components/AxiosInstance";

/*
 * Country search for the Native Country field on /new-booking/flight.
 *
 * Behaviour and visual layout deliberately mirror FlightLocationSelect
 * (the From/To picker) so the two fields feel identical to the user:
 *   - Fetches on empty focus so the top-25 default list appears immediately
 *     (backend /api/amadeus/countries already returns an alphabetical
 *     top-25 for a blank/short query).
 *   - Two-line row: bigger blue main line with a location pin + "Name (CODE)"
 *     display, small gray meta line "Country · CODE" underneath.
 */
const CountrySelect = ({
  label = "Native Country of Guest",
  placeholder = "Search country",
  value,           // { code, name, currencyCode } | null
  onChange,
  disabled = false,
}) => {
  const [input, setInput] = useState(value?.name || "");
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const boxRef = useRef(null);
  const abortRef = useRef(null);

  // Only sync from parent when a name is actually set — matches the
  // FlightLocationSelect pattern so keystrokes are never wiped by the
  // parent clearing its selection mid-typing.
  useEffect(() => {
    if (value?.name) setInput(value.name);
    else setItems([]);
  }, [value?.code]);

  useEffect(() => {
    const h = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Debounced fetch — matches FlightLocationSelect's pattern exactly. Runs
  // even for an empty query so the moment the user focuses the field they
  // see the backend's default top-25 country list; typing narrows it via
  // the same endpoint. 250ms debounce is snappy without hammering the API.
  useEffect(() => {
    if (!open) return;
    const q = input.trim();
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await axiosInstance.get("/api/amadeus/countries", {
          params: q ? { q } : {},
          signal: controller.signal,
        });
        // Hard cap the rendered list — never render more than 50 rows even
        // if the server or a misconfigured response floods us with more.
        const data = Array.isArray(res.data) ? res.data.slice(0, 50) : [];
        setItems(data);
        setHighlight(0);
      } catch (err) {
        if (err.name !== "CanceledError" && err.name !== "AbortError") {
          setItems([]);
        }
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [input, open]);

  const pick = (s) => {
    onChange?.(s);
    setInput(s.name || s.code || "");
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => Math.min(items.length - 1, h + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(0, h - 1)); }
    else if (e.key === "Enter" && items[highlight]) { e.preventDefault(); pick(items[highlight]); }
    else if (e.key === "Escape") { setOpen(false); }
  };

  return (
    <div style={{ position: "relative" }} ref={boxRef}>
      {label && (
        <label style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
          <FaGlobe style={{ marginRight: 4 }} /> {label}
        </label>
      )}
      <input
        type="text"
        className="form-control"
        placeholder={placeholder}
        value={input}
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setInput(e.target.value);
          setOpen(true);
          if (value && e.target.value !== value.name) onChange?.(null);
        }}
        onKeyDown={onKeyDown}
        autoComplete="off"
      />
      {open && (
        <div
          style={{
            position: "absolute",
            zIndex: 1050,
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 2,
            background: "#fff",
            border: "1px solid #dee2e6",
            borderRadius: 6,
            boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
            maxHeight: 320,
            overflowY: "auto",
          }}
        >
          {loading && (
            <div style={{ padding: 10, color: "#6b7280", fontSize: 13 }}>Searching…</div>
          )}
          {!loading && items.length === 0 && (
            <div style={{ padding: 10, color: "#6b7280", fontSize: 13 }}>No matches</div>
          )}
          {!loading && items.map((s, i) => (
            <div
              key={`${s.code}-${i}`}
              onMouseDown={(e) => { e.preventDefault(); pick(s); }}
              onMouseEnter={() => setHighlight(i)}
              style={{
                padding: "8px 12px",
                cursor: "pointer",
                background: i === highlight ? "#e7f1ff" : "transparent",
                borderBottom: "1px solid #f1f3f5",
              }}
            >
              {/* Two-line row matches FlightLocationSelect exactly: bigger
                  main line with a location pin + "Name (CODE)", small
                  gray meta line "Country · CODE" underneath. */}
              <div style={{ fontSize: 14, color: "#111827", fontWeight: 500 }}>
                <FaMapMarkerAlt style={{ marginRight: 6, opacity: 0.7 }} />
                {s.name}{s.code ? ` (${s.code})` : ""}
              </div>
              <div style={{ fontSize: 12, color: "#6c757d" }}>
                Country{s.code ? ` · ${s.code}` : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CountrySelect;
