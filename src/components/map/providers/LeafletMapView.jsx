import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Tooltip,
  useMap,
} from "react-leaflet";
import {
  FaSearch,
  FaStar,
  FaMapMarkerAlt,
  FaPhoneAlt,
} from "react-icons/fa";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Webpack/CRA breaks Leaflet's default marker icon URL resolution (the
// bundled paths don't survive the build) — this is the standard fix
// (see Leaflet issue #4968). Runs once at module load.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Re-fits the map to every marker whenever the marker set changes. Only
// needed for the multi-marker case — a single marker is centered directly
// by MapContainer's `center` prop instead.
function FitBounds({ markers }) {
  const map = useMap();
  useEffect(() => {
    if (markers.length < 2) return;
    const bounds = L.latLngBounds(
      markers.map((m) => [Number(m.lat), Number(m.lng)]),
    );
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [markers, map]);
  return null;
}

// Leaflet caches the container's size on first init. When the map mounts
// inside a Bootstrap Modal that is still animating in, that cached size
// is wrong (often zero) — the tiles render but the +/- buttons and
// scroll-wheel zoom compute against stale bounds and appear unresponsive.
// Invalidating the size after the modal finishes animating rebuilds the
// cache from the real DOM dimensions and restores interaction.
function InvalidateSizeOnMount() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 200);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

// Leaflet's own valid zoom range (OpenStreetMap tiles top out around 19;
// values past that — or the previous zoom={100} here — get silently
// clamped and leave the map stuck at max zoom with the +/- controls
// appearing unresponsive). 13 is a sensible city-level starting zoom for
// the single-marker case; FitBounds takes over whenever there's more than
// one marker.
const DEFAULT_ZOOM = 13;
// Zoom level to fly to when a hotel is picked from the search dropdown.
// Close enough to see the neighborhood but not so close the surrounding
// context disappears.
const SEARCH_FOCUS_ZOOM = 15;

// In-map hotel-name search. Sits as an absolute-positioned overlay in the
// top-right of the map (top-left is Leaflet's own +/- zoom controls) so
// the user can jump to a specific hotel without hunting through markers.
// Filters the current marker set by name substring; picking a match
// pans/zooms the map to the hotel and opens its popup. Mouse and wheel
// events are stopped on the wrapper so typing/scrolling the dropdown
// never drags or zooms the map underneath.
function HotelSearchControl({ markers, markerRefs }) {
  const map = useMap();
  const containerRef = useRef(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    // Belt-and-braces: react's stopPropagation covers React's synthetic
    // events; Leaflet listens on the native DOM directly, so we also
    // need to detach map interactions on this DOM subtree.
    L.DomEvent.disableClickPropagation(containerRef.current);
    L.DomEvent.disableScrollPropagation(containerRef.current);
  }, []);

  const trimmed = query.trim().toLowerCase();
  const matches = trimmed
    ? markers
        .filter((m) => (m.name || "").toLowerCase().includes(trimmed))
        .slice(0, 8)
    : [];

  const focusHotel = (m) => {
    setQuery(m.name || "");
    setOpen(false);
    map.flyTo([Number(m.lat), Number(m.lng)], SEARCH_FOCUS_ZOOM, {
      duration: 0.6,
    });
    const markerInstance = markerRefs.current[m.id];
    if (markerInstance) {
      // Wait for flyTo to settle so the popup renders at the final
      // camera position rather than mid-animation.
      setTimeout(() => markerInstance.openPopup(), 650);
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        top: 10,
        right: 10,
        zIndex: 1000,
        width: 260,
      }}
    >
      <div className="input-group input-group-sm shadow-sm">
        <span
          className="input-group-text bg-white border-end-0"
          style={{ color: "#EC0B43" }}
        >
          <FaSearch />
        </span>
        <input
          type="text"
          className="form-control border-start-0"
          placeholder="Search hotel by name..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && matches.length > 0) {
              e.preventDefault();
              focusHotel(matches[0]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
      </div>
      {open && trimmed && (
        <div
          className="bg-white shadow-sm rounded mt-1 overflow-auto"
          style={{ maxHeight: 220 }}
        >
          {matches.length > 0 ? (
            matches.map((m) => (
              <button
                key={m.id}
                type="button"
                className="btn btn-link text-decoration-none text-dark d-block w-100 text-start px-2 py-1"
                style={{ fontSize: "0.875rem" }}
                onClick={() => focusHotel(m)}
              >
                {m.name}
              </button>
            ))
          ) : (
            <div className="px-2 py-1 text-muted small">
              No matching hotels
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Leaflet-backed implementation of the map preview. This is the ONLY file
 * that talks to the Leaflet/OpenStreetMap API directly — MapModal (the
 * caller) only depends on the `markers` prop shape below
 * ({ id, name, lat, lng, address?, contactNumber? }[], lat/lng
 * pre-validated as finite numbers). To swap in Google Maps or another
 * provider later, write a new component with this same prop contract and
 * point MapModal's provider import at it — no changes needed in
 * HotelSearch.jsx or anywhere else that opens the modal.
 */
export default function LeafletMapView({ markers, onHotelSelect }) {
  const center = useMemo(
    () => [Number(markers[0].lat), Number(markers[0].lng)],
    [markers],
  );
  // Marker instances keyed by hotel id, populated by each <Marker>'s ref.
  // HotelSearchControl reads this to call openPopup() on the picked hotel
  // after flyTo settles.
  const markerRefs = useRef({});

  return (
    <MapContainer
      center={center}
      zoom={DEFAULT_ZOOM}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <InvalidateSizeOnMount />
      <FitBounds markers={markers} />
      <HotelSearchControl markers={markers} markerRefs={markerRefs} />
      {markers.map((m) => (
        <Marker
          key={m.id}
          position={[Number(m.lat), Number(m.lng)]}
          ref={(instance) => {
            if (instance) {
              markerRefs.current[m.id] = instance;
            } else {
              delete markerRefs.current[m.id];
            }
          }}
        >
          {m.name && (
            <Tooltip
              permanent
              direction="top"
              offset={[0, -32]}
              className="hbs-map-marker-label"
            >
              {m.name}
            </Tooltip>
          )}
          <Popup>
            <div style={{ minWidth: 220, maxWidth: 260 }}>
              {m.image && (
                <img
                  src={m.image}
                  alt={m.name}
                  style={{
                    width: "100%",
                    height: 110,
                    objectFit: "cover",
                    borderRadius: 4,
                    marginBottom: 8,
                  }}
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              )}
              <div
                className="fw-bold"
                style={{ fontSize: "0.95rem", lineHeight: 1.25 }}
              >
                {m.name}
              </div>

              {(m.rating > 0 || m.hotelType) && (
                <div
                  className="d-flex align-items-center flex-wrap mt-1"
                  style={{ gap: 6, fontSize: "0.72rem" }}
                >
                  {m.rating > 0 && (
                    <span
                      style={{ color: "#f5a623", display: "inline-flex", gap: 1 }}
                    >
                      {Array.from({ length: Math.round(m.rating) }).map((_, i) => (
                        <FaStar key={i} />
                      ))}
                    </span>
                  )}
                  {m.hotelType && (
                    <span
                      className="badge"
                      style={{
                        backgroundColor: "#f1f3f5",
                        color: "#333",
                        fontWeight: 500,
                        textTransform: "capitalize",
                      }}
                    >
                      {m.hotelType}
                    </span>
                  )}
                </div>
              )}

              {m.address && (
                <div
                  className="mt-2 d-flex align-items-start"
                  style={{ gap: 6, fontSize: "0.78rem", color: "#555" }}
                >
                  <FaMapMarkerAlt
                    style={{ color: "#EC0B43", marginTop: 2, flexShrink: 0 }}
                  />
                  <span>{m.address}</span>
                </div>
              )}

              {m.contactNumber && (
                <div
                  className="d-flex align-items-center"
                  style={{ gap: 6, fontSize: "0.78rem", color: "#555" }}
                >
                  <FaPhoneAlt
                    style={{ color: "#EC0B43", flexShrink: 0 }}
                  />
                  <span>{m.contactNumber}</span>
                </div>
              )}

              {m.priceLabel && (
                <div
                  className="mt-2"
                  style={{ fontSize: "0.8rem", color: "#666" }}
                >
                  From{" "}
                  <span
                    className="fw-bold"
                    style={{ color: "#EC0B43", fontSize: "0.95rem" }}
                  >
                    {m.priceLabel}
                  </span>{" "}
                  <span style={{ fontSize: "0.72rem" }}>/ night</span>
                </div>
              )}

              {Array.isArray(m.dealLabels) && m.dealLabels.length > 0 && (
                <div
                  className="mt-2 d-flex flex-wrap"
                  style={{ gap: 4 }}
                >
                  {m.dealLabels.slice(0, 3).map((label) => (
                    <span
                      key={label}
                      className="badge"
                      style={{
                        backgroundColor: "#fff0f3",
                        color: "#EC0B43",
                        fontWeight: 500,
                        fontSize: "0.65rem",
                        border: "1px solid #f8c1cf",
                      }}
                    >
                      {label}
                    </span>
                  ))}
                  {m.dealLabels.length > 3 && (
                    <span
                      className="badge"
                      style={{
                        backgroundColor: "#f1f3f5",
                        color: "#666",
                        fontSize: "0.65rem",
                      }}
                    >
                      +{m.dealLabels.length - 3} more
                    </span>
                  )}
                </div>
              )}

              {onHotelSelect && (
                // Same behavior as the row-level "View Rooms" button on
                // the hotel card — the parent rebuilds the room-list
                // payload and opens /room-list (or the api/24h/religious
                // variant) in a new tab.
                <button
                  type="button"
                  className="btn btn-sm btn-primary mt-2 w-100"
                  onClick={() => onHotelSelect(m.id)}
                >
                  View Rooms
                </button>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
