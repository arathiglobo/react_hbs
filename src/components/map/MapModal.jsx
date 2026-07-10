import React from "react";
import { Modal } from "react-bootstrap";
import LeafletMapView from "./providers/LeafletMapView";

// The active map provider. Every caller of MapModal only knows about the
// `markers` prop contract below — swapping to Google Maps (or any other
// provider) later means writing a new component with the same
// { id, name, lat, lng }[] contract and changing this one import, with no
// changes required anywhere MapModal is used.
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
 */
export default function MapModal({
  show,
  onHide,
  markers = [],
  title = "Explore on Map",
}) {
  const validMarkers = markers.filter(
    (m) => m && isFiniteCoord(m.lat) && isFiniteCoord(m.lng),
  );

  return (
    <Modal show={show} onHide={onHide} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-0" style={{ height: 480 }}>
        {validMarkers.length > 0 ? (
          <MapProviderView markers={validMarkers} />
        ) : (
          <div className="d-flex align-items-center justify-content-center h-100 text-muted p-4 text-center">
            Hotel location is currently unavailable.
          </div>
        )}
      </Modal.Body>
    </Modal>
  );
}
