import React, { useMemo } from "react";
import { Modal } from "react-bootstrap";
import LeafletMapView from "./providers/LeafletMapView";

// The active map provider. Every caller of MapModal only knows about the
// `markers` prop contract below — swapping to Google Maps (or any other
// provider) later means writing a new component with the same marker
// shape and changing this one import, with no changes required anywhere
// MapModal is used. Required fields: id, name, lat, lng. Optional
// enrichment fields the provider renders in the marker popup when set:
// address, contactNumber, image, rating, channelType, hotelType,
// priceLabel (pre-formatted display string), dealLabels (string[]).
const MapProviderView = LeafletMapView;

const isFiniteCoord = (v) => Number.isFinite(Number(v));

/**
 * "Explore on Map" modal — shows one or more hotel locations. Renders a
 * plain unavailable-location message instead of a map when none of the
 * given markers have usable coordinates.
 *
 * @param {boolean} show
 * @param {() => void} onHide
 * @param {{ id: string|number, name: string, lat: number|string, lng: number|string }[]} markers
 * @param {string} [title]
 * @param {(hotelId: string|number) => void} [onHotelSelect]
 *   Optional. When provided, the marker popup shows a "View Rooms" action
 *   that calls this with the marker's id. The caller decides what happens
 *   (typically: rebuild the room-list payload and open /room-list in a new
 *   tab, matching the row-level "View Rooms" button on the hotel card).
 */
export default function MapModal({
  show,
  onHide,
  markers = [],
  title = "Explore on Map",
  onHotelSelect,
}) {
  // Memoize the filter so `validMarkers` keeps a stable reference across
  // re-renders. Leaflet's FitBounds effect keys off this array — an
  // unstable reference re-fits the bounds on every parent render and
  // snaps the user's zoom back to the fit, making the +/- buttons and
  // scroll-wheel appear to have no effect.
  const validMarkers = useMemo(
    () => markers.filter((m) => m && isFiniteCoord(m.lat) && isFiniteCoord(m.lng)),
    [markers],
  );

  return (
    <Modal show={show} onHide={onHide} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-0" style={{ height: 480 }}>
        {validMarkers.length > 0 ? (
          <MapProviderView
            markers={validMarkers}
            onHotelSelect={onHotelSelect}
          />
        ) : (
          <div className="d-flex align-items-center justify-content-center h-100 text-muted p-4 text-center">
            Hotel location is currently unavailable.
          </div>
        )}
      </Modal.Body>
    </Modal>
  );
}
