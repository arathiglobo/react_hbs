import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MapContainer, Marker, TileLayer, ZoomControl, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { FaExpand, FaHotel, FaStar, FaTimes } from "react-icons/fa";
import { isAgentLogin } from "../../utils/supplierDisplay";
import {
  boundsOf,
  clusterPoints,
  escapeHtml,
  fitBoundsFor,
  toMapPoints,
} from "./hotelMapData";
import "./HotelResultsMap.css";

/** From this zoom on every hotel has its own marker, however close. */
const CLUSTER_UNTIL_ZOOM = 17;
/** From this zoom on markers show the hotel's name above its price. */
const NAMED_FROM_ZOOM = 15;
/** Zoom-to-fit never goes closer than this, nor a single hotel. */
const FIT_MAX_ZOOM = 15;
/**
 * The card sits along the bottom of the map on touch screens (no hover there,
 * and a thumb covers a floating card) and on a map too narrow to float one.
 */
const DOCKED_BELOW_PX = 320;
const TOUCH_MEDIA = "(hover: none), (pointer: coarse)";
const isTouchScreen = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia(TOUCH_MEDIA).matches;
/** Grace period for moving the pointer from a marker onto its card. */
const HIDE_CARD_MS = 250;

// Leaflet icons are plain HTML, built once per look and reused. Names and
// prices are escaped: they come from supplier data.
const iconCache = new Map();
function cachedIcon(key, build) {
  if (iconCache.size > 4000) iconCache.clear();
  if (!iconCache.has(key)) iconCache.set(key, build());
  return iconCache.get(key);
}

function priceIcon(point, active, named) {
  return cachedIcon(`p|${active}|${named}|${point.name}|${point.priceText}`, () =>
    L.divIcon({
      className: "hrm-marker",
      iconSize: [0, 0],
      iconAnchor: [0, 0],
      html:
        `<div class="hrm-pill${active ? " hrm-pill--active" : ""}${named ? " hrm-pill--named" : ""}"` +
        ` aria-label="${escapeHtml(`${point.name}, ${point.priceText}`)}">` +
        (named ? `<span class="hrm-pill-name">${escapeHtml(point.name)}</span>` : "") +
        `<span class="hrm-pill-price">${escapeHtml(point.priceText)}</span></div>`,
    }),
  );
}

function clusterIcon(count, active) {
  const size = count < 10 ? "s" : count < 50 ? "m" : "l";
  return cachedIcon(`c|${active}|${count}`, () =>
    L.divIcon({
      className: "hrm-marker",
      iconSize: [0, 0],
      iconAnchor: [0, 0],
      html:
        `<div class="hrm-cluster hrm-cluster--${size}${active ? " hrm-cluster--active" : ""}"` +
        ` aria-label="${count} hotels here. Zoom in">${count}</div>`,
    }),
  );
}

const PriceMarker = memo(function PriceMarker({ point, active, named, actions }) {
  const eventHandlers = useMemo(
    () => ({
      mouseover: () => actions.current.hover(point.id),
      mouseout: () => actions.current.leave(point.id),
      click: () => actions.current.select(point.id),
    }),
    [actions, point.id],
  );
  const position = useMemo(() => [point.lat, point.lng], [point.lat, point.lng]);
  return (
    <Marker
      position={position}
      icon={priceIcon(point, active, named)}
      zIndexOffset={active ? 10000 : 0}
      eventHandlers={eventHandlers}
      riseOnHover
    />
  );
});

const ClusterMarker = memo(function ClusterMarker({ group, active, actions }) {
  const eventHandlers = useMemo(
    () => ({ click: () => actions.current.zoomTo(group.points) }),
    [actions, group.points],
  );
  const position = useMemo(() => [group.lat, group.lng], [group.lat, group.lng]);
  return (
    <Marker
      position={position}
      icon={clusterIcon(group.points.length, active)}
      zIndexOffset={active ? 9000 : 1000}
      eventHandlers={eventHandlers}
    />
  );
});

/**
 * The markers. Groups the hotels whose markers would overlap at this zoom, and
 * only mounts those inside (or just outside) the visible area, so a few hundred
 * hotels stay smooth.
 */
const MarkersLayer = memo(function MarkersLayer({ points, activeIds, actions }) {
  const map = useMap();
  const readView = () => ({ zoom: map.getZoom(), bounds: map.getBounds() });
  const [view, setView] = useState(readView);
  useMapEvents({ moveend: () => setView(readView()), resize: () => setView(readView()) });

  const { zoom } = view;
  const named = zoom >= NAMED_FROM_ZOOM;
  const groups = useMemo(() => {
    if (zoom >= CLUSTER_UNTIL_ZOOM) {
      return points.map((p) => ({
        key: `h:${p.id}`,
        points: [p],
        lat: p.lat,
        lng: p.lng,
      }));
    }
    return clusterPoints(
      points,
      (p) => map.project([p.lat, p.lng], zoom),
      // A marker's footprint: a price pill is ~96×40 px above its point, a
      // named one ~170×56, and a cluster bubble fits inside either.
      named ? { cellW: 170, cellH: 58 } : { cellW: 100, cellH: 46 },
    );
  }, [points, zoom, named, map]);

  const area = view.bounds.pad(0.25);
  return groups
    .filter((g) => area.contains([g.lat, g.lng]))
    .map((g) =>
      g.points.length === 1 ? (
        <PriceMarker
          key={g.key}
          point={g.points[0]}
          active={activeIds.has(g.points[0].id)}
          named={named}
          actions={actions}
        />
      ) : (
        <ClusterMarker
          key={g.key}
          group={g}
          active={g.points.some((p) => activeIds.has(p.id))}
          actions={actions}
        />
      ),
    );
});

/** Closes a pinned card when the map itself is clicked or tapped. */
function MapClicks({ actions }) {
  const handlers = useMemo(() => ({ click: () => actions.current.close() }), [actions]);
  useMapEvents(handlers);
  return null;
}

function Stars({ rating }) {
  if (!rating) return <span className="hrm-card-unrated">No star rating</span>;
  return (
    <span className="hrm-card-stars" aria-label={`${rating} star${rating === 1 ? "" : "s"}`}>
      {Array.from({ length: rating }, (_, i) => (
        <FaStar key={i} aria-hidden="true" />
      ))}
    </span>
  );
}

function HotelCard({ point, docked, pinned, style, onOpen, onClose, onPointerIn, onPointerOut }) {
  const [failedSrc, setFailedSrc] = useState(null);
  const image = point.image && failedSrc !== point.image ? point.image : null;
  return (
    <div
      className={`hrm-card${docked ? " hrm-card--docked" : ""}`}
      style={style}
      role="dialog"
      aria-label={point.name}
      onMouseEnter={onPointerIn}
      onMouseLeave={onPointerOut}
    >
      <div className="hrm-card-photo">
        {image ? (
          <img src={image} alt="" decoding="async" onError={() => setFailedSrc(image)} />
        ) : (
          <div className="hrm-card-noimage" aria-hidden="true">
            <FaHotel />
          </div>
        )}
      </div>
      <div className="hrm-card-body">
        <div className="hrm-card-name" title={point.name}>
          {point.name || "Hotel"}
        </div>
        <Stars rating={point.rating} />
        <div className="hrm-card-price">
          {point.price != null && <span className="hrm-card-from">from</span>}
          <span>{point.priceText}</span>
        </div>
        <button type="button" className="hrm-card-open" onClick={onOpen}>
          View rooms
        </button>
      </div>
      {(pinned || docked) && (
        <button type="button" className="hrm-card-close" aria-label="Close" onClick={onClose}>
          <FaTimes aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/**
 * The results map: one price marker per hotel (the list's price and
 * currency), grouped where they overlap, with a small card on hover (or tap)
 * that opens the hotel's room page.
 *
 *   hotels        — the filtered hotels, the same objects the list shows
 *   highlightedId — the hotel hovered in the list; its marker stands out
 *   onHoverHotel  — (id | null) when a marker is hovered or left
 *   onOpenHotel   — (hotel) to open its room page, as View Rooms does
 *   fitKey        — changes when the filters change; the map zooms to fit then
 *   loading       — a fetch is under way
 *   note          — an extra line for the bottom note, or null
 *   emptyText     — what to say when there are no hotels, instead of the default
 *   currencyCode  — used when a hotel carries no currency of its own
 */
export default function HotelResultsMap({
  hotels = [],
  highlightedId = null,
  onHoverHotel,
  onOpenHotel,
  fitKey = "",
  loading = false,
  note = null,
  emptyText = null,
  currencyCode = "AED",
  className = "",
}) {
  const hideSupplierSuffix = isAgentLogin();
  const { points, missing } = useMemo(
    () => toMapPoints(hotels, { fallbackCurrency: currencyCode, hideSupplierSuffix }),
    [hotels, currencyCode, hideSupplierSuffix],
  );
  const pointById = useMemo(() => new Map(points.map((p) => [p.id, p])), [points]);
  const hotelById = useMemo(() => new Map(hotels.map((h) => [h.id, h])), [hotels]);

  const rootRef = useRef(null);
  const [map, setMap] = useState(null);
  const [hoverId, setHoverId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [, setViewTick] = useState(0);
  const [docked, setDocked] = useState(false);
  // False until the map has a size: a modal mounts it before it is shown,
  // and zooming to fit a 0×0 map lands on the wrong zoom.
  const [sized, setSized] = useState(false);
  const hideTimer = useRef(null);

  const cancelHide = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = null;
  };
  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      hideTimer.current = null;
      setHoverId(null);
      onHoverHotel?.(null);
    }, HIDE_CARD_MS);
  }, [onHoverHotel]);
  useEffect(() => () => cancelHide(), []);

  // Marker callbacks through one ref, so markers never re-render for them.
  const actions = useRef(null);
  actions.current = {
    hover: (id) => {
      cancelHide();
      setHoverId(id);
      onHoverHotel?.(id);
    },
    leave: () => scheduleHide(),
    select: (id) => {
      cancelHide();
      setSelectedId(id);
      setHoverId(id);
      onHoverHotel?.(id);
    },
    zoomTo: (members) => {
      if (!map) return;
      map.fitBounds(boundsOf(members), { padding: [60, 60], maxZoom: CLUSTER_UNTIL_ZOOM });
    },
    close: () => closeCard(),
  };

  const activeIds = useMemo(
    () => new Set([hoverId, selectedId, highlightedId].filter((v) => v != null)),
    [hoverId, selectedId, highlightedId],
  );

  // A hotel filtered away takes its card with it.
  useEffect(() => {
    if (selectedId != null && !pointById.has(selectedId)) setSelectedId(null);
    if (hoverId != null && !pointById.has(hoverId)) setHoverId(null);
  }, [pointById, selectedId, hoverId]);

  // The card follows its marker while the map moves; the map follows the
  // panel's size (modal opening, window resizing).
  useEffect(() => {
    if (!map) return undefined;
    const tick = () => setViewTick((t) => t + 1);
    map.on("move zoom", tick);
    const el = rootRef.current;
    let ro = null;
    const measure = () => {
      map.invalidateSize({ pan: false });
      const width = el?.clientWidth || 0;
      const height = el?.clientHeight || 0;
      setDocked(width < DOCKED_BELOW_PX || isTouchScreen());
      if (width > 0 && height > 0) setSized(true);
    };
    measure();
    if (el && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(measure);
      ro.observe(el);
    }
    return () => {
      map.off("move zoom", tick);
      if (ro) ro.disconnect();
    };
  }, [map]);

  // Zoom to fit: when the hotels first arrive, whenever the filters change,
  // and as more arrive during the search unless the user has moved the map.
  const userMoved = useRef(false);
  const fitting = useRef(false);
  const lastFitKey = useRef(null);
  const lastCount = useRef(0);
  const fit = useCallback(
    (pts, animate) => {
      if (!map || pts.length === 0) return;
      fitting.current = true;
      setTimeout(() => {
        fitting.current = false;
      }, 600);
      if (pts.length === 1) {
        map.setView([pts[0].lat, pts[0].lng], FIT_MAX_ZOOM, { animate });
      } else {
        map.fitBounds(fitBoundsFor(pts), { padding: [56, 56], maxZoom: FIT_MAX_ZOOM, animate });
      }
    },
    [map],
  );
  useEffect(() => {
    if (!map) return undefined;
    const onMoveStart = () => {
      if (!fitting.current) userMoved.current = true;
    };
    map.on("movestart", onMoveStart);
    return () => map.off("movestart", onMoveStart);
  }, [map]);
  useEffect(() => {
    if (!map || !sized || points.length === 0) return;
    const filtersChanged = lastFitKey.current !== fitKey;
    const grew = points.length !== lastCount.current;
    if (filtersChanged) userMoved.current = false;
    if (filtersChanged || (grew && !userMoved.current)) {
      fit(points, lastFitKey.current !== null);
      lastFitKey.current = fitKey;
      lastCount.current = points.length;
    }
  }, [map, sized, points, fitKey, fit]);

  const showAll = () => {
    userMoved.current = false;
    if (!map || points.length === 0) return;
    fitting.current = true;
    setTimeout(() => {
      fitting.current = false;
    }, 600);
    map.fitBounds(boundsOf(points), { padding: [56, 56], maxZoom: FIT_MAX_ZOOM });
  };

  // Escape closes a pinned card.
  useEffect(() => {
    if (selectedId == null) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  const closeCard = () => {
    cancelHide();
    setSelectedId(null);
    setHoverId(null);
    onHoverHotel?.(null);
  };

  // Which card, and where. On a phone it sits at the bottom of the map; on a
  // wider map it floats above its marker, or below when the marker is near
  // the top edge.
  const cardId = selectedId ?? hoverId;
  const cardPoint = cardId != null ? pointById.get(cardId) : null;
  let cardStyle;
  if (cardPoint && map && !docked) {
    const xy = map.latLngToContainerPoint([cardPoint.lat, cardPoint.lng]);
    const width = rootRef.current?.clientWidth || 0;
    const half = 130;
    const x = Math.min(Math.max(xy.x, half + 8), Math.max(half + 8, width - half - 8));
    // Clear of the marker itself: a price pill stands ~40px above its point,
    // a named one ~56px.
    const lift = map.getZoom() >= NAMED_FROM_ZOOM ? 62 : 46;
    const below = xy.y < 300;
    cardStyle = {
      left: x,
      top: xy.y,
      transform: below
        ? "translate(-50%, 14px)"
        : `translate(-50%, calc(-100% - ${lift}px))`,
    };
  }

  const initialCenter = points[0] ? [points[0].lat, points[0].lng] : [20, 0];
  const hotelWord = (n) => `${n} ${n === 1 ? "hotel" : "hotels"}`;

  return (
    <div className={`hrm-root ${className}`} ref={rootRef}>
      <MapContainer
        ref={setMap}
        center={initialCenter}
        zoom={points[0] ? 12 : 2}
        zoomControl={false}
        scrollWheelZoom
        className="hrm-map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="hrm-tiles"
        />
        <ZoomControl position="bottomright" />
        <MapClicks actions={actions} />
        <MarkersLayer points={points} activeIds={activeIds} actions={actions} />
      </MapContainer>

      <div className="hrm-topleft">
        <div className="hrm-chip" aria-live="polite">
          {hotelWord(points.length)} on map
          {loading && <span className="hrm-updating">Updating…</span>}
        </div>
        {(missing > 0 || note) && (
          <div className="hrm-note">
            {missing > 0 && (
              <div>
                {hotelWord(missing)} {missing === 1 ? "has" : "have"} no location
                and {missing === 1 ? "isn't" : "aren't"} on the map.
              </div>
            )}
            {note && <div>{note}</div>}
          </div>
        )}
      </div>

      {points.length > 1 && (
        <button type="button" className="hrm-chip hrm-chip--fit" onClick={showAll}>
          <FaExpand aria-hidden="true" /> Show all
        </button>
      )}

      {points.length === 0 && (
        <div className="hrm-empty">
          {loading
            ? "Loading hotels…"
            : emptyText
              ? emptyText
              : hotels.length > 0
              ? "None of these hotels has a location to show on the map."
              : "No hotels match these filters."}
        </div>
      )}

      {cardPoint && (docked || cardStyle) && (
        <HotelCard
          key={cardPoint.id}
          point={cardPoint}
          docked={docked}
          pinned={selectedId != null}
          style={docked ? undefined : cardStyle}
          onOpen={() => {
            const hotel = hotelById.get(cardPoint.id);
            if (hotel) onOpenHotel?.(hotel);
          }}
          onClose={closeCard}
          onPointerIn={cancelHide}
          onPointerOut={() => {
            if (selectedId == null) scheduleHide();
          }}
        />
      )}
    </div>
  );
}
