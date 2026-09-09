import React, { useMemo } from "react";
import { Modal, Button } from "react-bootstrap";
import Select from "react-select";
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
 *
 * Optional filter-toolbar props — when `onStarRatingChange` and
 * `onSortByChange` are both provided the modal renders a compact filter
 * bar above the map (star rating select + Low/High sort pills + Clear).
 * These reuse the parent page's filter state so the same source of truth
 * drives both the results list and the map markers.
 * @param {{ value: number, label: string }[]} [starOptions]
 * @param {{ value: number, label: string } | null} [starRating]
 * @param {(option: object | null) => void} [onStarRatingChange]
 * @param {string} [sortBy]  the parent's current sort value; must equal
 *   either `sortAscValue` or `sortDescValue` for the matching pill to
 *   render as active
 * @param {(sort: string) => void} [onSortByChange]
 * @param {string} [sortAscValue="priceAsc"]   value emitted for "Low to High"
 * @param {string} [sortDescValue="priceDesc"] value emitted for "High to Low"
 * @param {() => void} [onClearFilters]
 */
export default function MapModal({
  show,
  onHide,
  markers = [],
  title = "Explore on Map",
  onHotelSelect,
  starOptions,
  starRating,
  onStarRatingChange,
  sortBy,
  onSortByChange,
  sortAscValue = "priceAsc",
  sortDescValue = "priceDesc",
  onClearFilters,
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

  const showFilterBar =
    typeof onStarRatingChange === "function" &&
    typeof onSortByChange === "function";

  return (
    <Modal show={show} onHide={onHide} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-0" style={{ height: showFilterBar ? 540 : 480 }}>
        {showFilterBar && (
          <div
            className="d-flex align-items-center gap-2 flex-wrap px-3 py-2 border-bottom bg-light"
            style={{ minHeight: 60 }}
          >
            <Select
              options={starOptions || []}
              value={starRating}
              onChange={onStarRatingChange}
              placeholder="All Stars"
              isClearable
              className="modern-select-sm"
              menuPortalTarget={document.body}
              styles={{
                control: (base) => ({
                  ...base,
                  height: "36px",
                  minHeight: "36px",
                  width: "160px",
                  background: "#ffffff",
                  color: "#000000",
                }),
                menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                menu: (base) => ({ ...base, zIndex: 9999 }),
              }}
            />

            <div className="d-flex gap-2">
              <Button
                size="sm"
                className={`sort-pill ${sortBy === sortAscValue ? "active" : ""}`}
                onClick={() => onSortByChange(sortAscValue)}
              >
                Low to High
              </Button>
              <Button
                size="sm"
                className={`sort-pill ${sortBy === sortDescValue ? "active" : ""}`}
                onClick={() => onSortByChange(sortDescValue)}
              >
                High to Low
              </Button>
            </div>

            {typeof onClearFilters === "function" && (
              <Button
                className="clear-pill"
                variant="outline-primary"
                size="sm"
                onClick={onClearFilters}
              >
                Clear
              </Button>
            )}
          </div>
        )}

        <div style={{ height: showFilterBar ? "calc(100% - 60px)" : "100%" }}>
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
        </div>
      </Modal.Body>
    </Modal>
  );
}
