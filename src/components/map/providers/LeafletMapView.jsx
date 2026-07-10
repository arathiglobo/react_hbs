import React, { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
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

// Leaflet's own valid zoom range (OpenStreetMap tiles top out around 19;
// values past that — or the previous zoom={100} here — get silently
// clamped and leave the map stuck at max zoom with the +/- controls
// appearing unresponsive). 13 is a sensible city-level starting zoom for
// the single-marker case; FitBounds takes over whenever there's more than
// one marker.
const DEFAULT_ZOOM = 13;

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
export default function LeafletMapView({ markers }) {
  const center = useMemo(
    () => [Number(markers[0].lat), Number(markers[0].lng)],
    [markers],
  );

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
      <FitBounds markers={markers} />
      {markers.map((m) => (
        <Marker key={m.id} position={[Number(m.lat), Number(m.lng)]}>
          <Popup>
            <div className="fw-bold mb-1">{m.name}</div>
            {m.address && <div>{m.address}</div>}
            {m.contactNumber && <div>Contact: {m.contactNumber}</div>}
            <div>
              Lat: {Number(m.lat).toFixed(6)}, Lng: {Number(m.lng).toFixed(6)}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
