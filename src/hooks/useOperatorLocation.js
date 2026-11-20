import { useEffect, useState } from "react";

/**
 * Where the operator is, for a booking's History (the "Location" column).
 * Same two-step lookup as the hotel booking pages (BookingDetailedView.jsx,
 * HotelBookingPage.jsx): a coarse IP-derived city first, then the precise
 * address if the browser's geolocation lands and permission is granted.
 * Returns null until something resolves (or when both fail). The IP itself
 * is NOT resolved here — the server reads it from the request.
 */

// Reverse-geocode browser coordinates to a readable address. Tries
// OpenStreetMap Nominatim first (street-level detail), then BigDataCloud
// (locality-level, keyless). Null when neither answers.
async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=16&addressdetails=1`,
      { headers: { Accept: "application/json" } },
    );
    if (res.ok) {
      const a = (await res.json())?.address || {};
      const parts = [
        a.road,
        a.neighbourhood || a.suburb,
        a.village || a.town || a.city || a.municipality,
        a.state,
        a.postcode,
        a.country,
      ].filter(Boolean);
      const line = parts.filter((p, i) => parts.indexOf(p) === i).join(", ");
      if (line) return line.slice(0, 255); // DB column is VARCHAR(255)
    }
  } catch {
    // fall through to BigDataCloud
  }
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
    );
    if (res.ok) {
      const d = await res.json();
      const parts = [d.locality, d.city, d.principalSubdivision, d.countryName].filter(Boolean);
      const line = parts.filter((p, i) => parts.indexOf(p) === i).join(", ");
      if (line) return line.slice(0, 255);
    }
  } catch {
    // give up — the caller keeps the IP-based fallback
  }
  return null;
}

export default function useOperatorLocation() {
  const [operatorLocation, setOperatorLocation] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch("https://ipapi.co/json/")
      .then((res) => (res.ok ? res.json() : null))
      .then((info) => {
        if (cancelled || !info) return;
        setOperatorLocation(
          (prev) =>
            // Never clobber a precise geolocation result that already landed.
            prev || [info.city, info.region, info.country_name].filter(Boolean).join(", ") || null,
        );
      })
      .catch(() => {});
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async ({ coords }) => {
          const precise = await reverseGeocode(coords.latitude, coords.longitude);
          if (!cancelled && precise) setOperatorLocation(precise);
        },
        () => {}, // denied / unavailable — keep the IP-derived fallback
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
      );
    }
    return () => {
      cancelled = true;
    };
  }, []);

  return operatorLocation;
}
