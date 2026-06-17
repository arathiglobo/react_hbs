import React, { useEffect, useState } from "react";
import axiosInstance from "./AxiosInstance";

/**
 * Small reusable badge that resolves a hotel id to its name and shows it
 * next to a page title. Dropped into every /hotel-actions/:id/* inner tab
 * so the operator never loses track of which hotel they're editing.
 *
 * Caches resolved names in sessionStorage to avoid re-hitting /api/hotels
 * every time the operator moves between tabs of the same hotel.
 */
export default function HotelTitleBadge({ hotelId, className = "" }) {
  const numericId = hotelId == null ? null : String(hotelId);
  const [name, setName] = useState(() => {
    if (!numericId) return "";
    try {
      const cache = JSON.parse(sessionStorage.getItem("hotelNameCache") || "{}");
      return cache[numericId] || "";
    } catch {
      return "";
    }
  });

  useEffect(() => {
    if (!numericId) return;
    let cancelled = false;
    axiosInstance
      .get(`/api/hotels/${numericId}`)
      .then((r) => {
        if (cancelled) return;
        const resolved = r?.data?.hotelName || r?.data?.hotel_name || "";
        setName(resolved);
        try {
          const cache = JSON.parse(sessionStorage.getItem("hotelNameCache") || "{}");
          cache[numericId] = resolved;
          sessionStorage.setItem("hotelNameCache", JSON.stringify(cache));
        } catch {
          /* private mode — non-fatal */
        }
      })
      .catch(() => {
        /* leave whatever the cache returned (likely empty) */
      });
    return () => {
      cancelled = true;
    };
  }, [numericId]);

  if (!name) return null;
  return (
    <span
      className={`badge text-primary bg-primary-subtle border border-primary-subtle ${className}`}
      style={{ fontSize: "0.85rem", padding: "0.55rem 0.85rem", fontWeight: 500 }}
      title={`Hotel: ${name}`}
    >
      <i className="fas fa-hotel me-2" aria-hidden="true" />
      {name}
    </span>
  );
}
