import React, { useEffect, useRef, useState } from "react";
import { FaMapMarkerAlt, FaPlaneDeparture } from "react-icons/fa";
import axiosInstance from "../../../components/AxiosInstance";

/*
 * Reusable searchable location select used by both From and To on
 * /new-booking/flight. Debounces user input, hits GET /custom/amadeus/locations,
 * shows a dropdown of matches and calls onChange(suggestion) once the user
 * picks one. The parent supplies label + placeholder + the currently-selected
 * suggestion so the caller controls the value entirely.
 *
 * The server ships rows shaped like the reference getAirPortCodes contract:
 *   { airportcode, name, countrycode, statecode, referencecity, airporttype }
 * where despite the names, countrycode carries the country NAME and
 * referencecity carries the city NAME (the server enriched them from the
 * rcnt / rcty masters). We build a "City, Country (CODE-Name)" display line
 * client-side from these fields.
 */

// One unified format for both fields and both row kinds:
//   "Frankfurt, Germany (FRA-Frankfurt Intl)"  — airport row
//   "Frankfurt, Germany (FRA)"                 — city row where name equals
//                                                the city (avoids "Frankfurt-Frankfurt")
// The From and To fields share this exact same builder — identical behaviour.
const buildDisplay = (s) => {
  if (!s) return "";
  const parts = [];
  if (s.referencecity) parts.push(s.referencecity);
  if (s.countrycode) parts.push(s.countrycode);
  const head = parts.join(", ");
  if (!s.airportcode) return head;
  const nameLc = (s.name || "").trim().toLowerCase();
  const cityLc = (s.referencecity || "").trim().toLowerCase();
  const showName = nameLc && nameLc !== cityLc;
  return `${head} (${s.airportcode}${showName ? "-" + s.name : ""})`;
};
const FlightLocationSelect = ({
  label,
  placeholder = "City or airport",
  value,          // { code, display, ... } | null
  onChange,       // (suggestion) => void
  icon,
  disabled = false,
  minChars = 2,
}) => {
  const currentDisplay = buildDisplay(value);
  const [input, setInput] = useState(currentDisplay);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const typingRef = useRef(false);
  const boxRef = useRef(null);
  const abortRef = useRef(null);

  // Sync from parent whenever the picked airportcode changes AND the change
  // wasn't caused by this component's own typing. typingRef guards the
  // "user is mid-keystroke" window so we don't race the keystroke and wipe
  // the character just entered. On an external swap (parent replaces the
  // selection) or a first-time pick this still fires normally.
  useEffect(() => {
    if (typingRef.current) return;
    setInput(value?.airportcode ? buildDisplay(value) : "");
  }, [value?.airportcode]);

  // Close on outside click.
  useEffect(() => {
    const h = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Debounced fetch — 250ms is enough to feel snappy without hammering the
  // backend as the user types. Runs even with an empty query so the user
  // sees the backend's default top-10 airports the moment they focus the
  // field; typing narrows the list via the same endpoint.
  useEffect(() => {
    if (!open) return;
    const q = input.trim();
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await axiosInstance.get("/custom/amadeus/locations", {
          params: q ? { q } : {},
          signal: controller.signal,
        });
        // Airport rows only — the backend also returns a "city" row per
        // match (e.g. "Dubai (DXB)" alongside "Dubai Intl Arpt (DXB)"), but
        // flight search needs a specific airport, not the city grouping.
        // Hard cap the rendered list at 50 rows so a runaway or misconfigured
        // response can never crash the tab. Real matches stay under this cap.
        const data = Array.isArray(res.data)
          ? res.data.filter((s) => s.type !== "city").slice(0, 50)
          : [];
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
  }, [input, open, minChars]);

  const pick = (s) => {
    typingRef.current = false;
    onChange?.(s);
    setInput(buildDisplay(s) || s.airportcode || "");
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
          {icon || <FaPlaneDeparture style={{ marginRight: 4 }} />} {label}
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
          typingRef.current = true;
          setInput(e.target.value);
          setOpen(true);
          // Clear the parent's selection when the user starts editing —
          // otherwise a stale value.airportcode would survive and be posted.
          if (value && e.target.value !== currentDisplay) onChange?.(null);
        }}
        onBlur={() => { typingRef.current = false; }}
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
              key={`${s.type}-${s.airportcode}-${i}`}
              onMouseDown={(e) => { e.preventDefault(); pick(s); }}
              onMouseEnter={() => setHighlight(i)}
              style={{
                padding: "8px 12px",
                cursor: "pointer",
                background: i === highlight ? "#e7f1ff" : "transparent",
                borderBottom: "1px solid #f1f3f5",
              }}
            >
              <div style={{ fontSize: 14, color: "#111827", fontWeight: 500 }}>
                <FaMapMarkerAlt style={{ marginRight: 6, opacity: 0.7 }} />
                {buildDisplay(s)}
              </div>
              <div style={{ fontSize: 12, color: "#6c757d" }}>
                {s.type === "city" ? "City" : "Airport"} · {s.airportcode}
                {s.countrycode ? ` · ${s.countrycode}` : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FlightLocationSelect;
