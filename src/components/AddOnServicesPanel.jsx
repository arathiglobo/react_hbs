import React, { useEffect, useMemo, useState } from "react";
import { Card, Form, Row, Col, Badge, Accordion } from "react-bootstrap";
import { FaChevronDown } from "react-icons/fa";

// ── Storage key ──────────────────────────────────────────────────────
// The Make Your Own Package flow spans three pages (search → results →
// booking). We persist the selected add-ons in sessionStorage under a
// single key so the panel keeps state when the operator navigates and
// the booking page can pluck the final selections at POST time.
export const ADDON_SERVICES_STORAGE_KEY = "mypkg_addon_services";

/**
 * Catalogue of services + their per-service form fields. Adding a new
 * service is a matter of appending one entry here.
 *
 * Each `fields` entry is rendered as a small inline form when the
 * service is toggled ON. `kind` controls the input type:
 *   "text"     → single-line text
 *   "textarea" → multiline text
 *   "number"   → numeric input
 *   "date"     → date input
 *   "time"     → time input
 *   "select"   → <select> with `options`
 */
// Standard date + time pair appended to every service so the operator
// can always specify when the service is needed. Some services need
// these in addition to their own date/time fields (e.g. Meet & Greet
// has arrival/departure times) — the extra `serviceDate` / `serviceTime`
// represents the day/time the service itself is delivered.
const DATETIME_FIELDS = [
  { name: "serviceDate", label: "Service date", kind: "date" },
  { name: "serviceTime", label: "Service time", kind: "time" },
];

export const ADDON_SERVICES_CATALOG = [
  {
    key: "visa",
    label: "Visa",
    fields: [
      { name: "adults",      label: "Adults",      kind: "number" },
      { name: "adultRate",   label: "Adult rate",  kind: "number" },
      { name: "children",    label: "Children",    kind: "number" },
      { name: "childRate",   label: "Child rate",  kind: "number" },
      { name: "nationality", label: "Nationality", kind: "text" },
      ...DATETIME_FIELDS,
      { name: "notes",       label: "Notes",       kind: "textarea" },
    ],
  },
  {
    key: "meetAndGreet",
    label: "Meet & Greet",
    fields: [
      { name: "arrivalFlight",   label: "Arrival flight",   kind: "text" },
      { name: "arrivalTime",     label: "Arrival time",     kind: "time" },
      { name: "departureFlight", label: "Departure flight", kind: "text" },
      { name: "departureTime",   label: "Departure time",   kind: "time" },
      { name: "pax",             label: "Pax",              kind: "number" },
      ...DATETIME_FIELDS,
      { name: "notes",           label: "Notes",            kind: "textarea" },
    ],
  },
  {
    key: "airportTransfer",
    label: "Airport transfer (departure combo 10% off)",
    fields: [
      { name: "arrivalFlight", label: "Arrival flight", kind: "text" },
      { name: "arrivalTime",   label: "Arrival time",   kind: "time" },
      { name: "departureCombo", label: "Departure combo", kind: "select",
        options: [
          { value: "no",  label: "No (no discount)" },
          { value: "yes", label: "Yes (10% off)" },
        ] },
      { name: "pickupHotel", label: "Pickup hotel", kind: "text" },
      ...DATETIME_FIELDS,
      { name: "notes",       label: "Notes",        kind: "textarea" },
    ],
  },
  {
    key: "hotelAccommodation",
    label: "Hotel Accommodation (clubbing cities = bigger discount)",
    fields: [
      { name: "preferredCategory", label: "Preferred category", kind: "select",
        options: [
          { value: "",   label: "Any" },
          { value: "3*", label: "3 Star" },
          { value: "4*", label: "4 Star" },
          { value: "5*", label: "5 Star" },
        ] },
      { name: "preferredHotels", label: "Preferred hotels",  kind: "text" },
      { name: "mealPlan",        label: "Meal plan",         kind: "select",
        options: [
          { value: "",    label: "Any" },
          { value: "RO",  label: "Room only" },
          { value: "BB",  label: "Bed & Breakfast" },
          { value: "HB",  label: "Half board" },
          { value: "FB",  label: "Full board" },
          { value: "AI",  label: "All inclusive" },
        ] },
      ...DATETIME_FIELDS,
      { name: "notes", label: "Notes", kind: "textarea" },
    ],
  },
  {
    key: "tours",
    label: "Tours (list of tours)",
    fields: [
      { name: "tourNames", label: "Tour names", kind: "textarea" },
      { name: "pax",       label: "Pax",        kind: "number" },
      ...DATETIME_FIELDS,
      { name: "notes",     label: "Notes",      kind: "textarea" },
    ],
  },
  {
    key: "restaurantsAndDinners",
    label: "Restaurants & Dinners",
    fields: [
      { name: "restaurantNames", label: "Restaurant / dinner names", kind: "textarea" },
      { name: "pax",             label: "Pax",                       kind: "number" },
      ...DATETIME_FIELDS,
      { name: "notes",           label: "Notes",                     kind: "textarea" },
    ],
  },
  {
    key: "optionalTours",
    label: "Optional tours",
    fields: [
      { name: "tourNames", label: "Tour names", kind: "textarea" },
      { name: "pax",       label: "Pax",        kind: "number" },
      ...DATETIME_FIELDS,
      { name: "notes",     label: "Notes",      kind: "textarea" },
    ],
  },
  {
    key: "yachtRental",
    label: "Yacht Rental",
    fields: [
      { name: "durationHours", label: "Duration (hrs)", kind: "number" },
      { name: "pax",           label: "Pax",            kind: "number" },
      ...DATETIME_FIELDS,
      { name: "notes",         label: "Notes",          kind: "textarea" },
    ],
  },
  {
    key: "stretchLimoRental",
    label: "Stretch Limo Rental",
    fields: [
      { name: "durationHours", label: "Duration (hrs)", kind: "number" },
      { name: "pax",           label: "Pax",            kind: "number" },
      ...DATETIME_FIELDS,
      { name: "notes",         label: "Notes",          kind: "textarea" },
    ],
  },
  {
    key: "scubaDiving",
    label: "Scuba Diving",
    fields: [
      { name: "pax",     label: "Pax",   kind: "number" },
      { name: "level",   label: "Level", kind: "select",
        options: [
          { value: "beginner",     label: "Beginner" },
          { value: "intermediate", label: "Intermediate" },
          { value: "advanced",     label: "Advanced" },
        ] },
      ...DATETIME_FIELDS,
      { name: "notes", label: "Notes", kind: "textarea" },
    ],
  },
  {
    key: "jetSkiing",
    label: "Jet Skiing",
    fields: [
      { name: "pax",            label: "Pax",            kind: "number" },
      { name: "durationMinutes", label: "Duration (min)", kind: "number" },
      ...DATETIME_FIELDS,
      { name: "notes",          label: "Notes",          kind: "textarea" },
    ],
  },
  {
    key: "shoppingTour",
    label: "Shopping Tour",
    fields: [
      { name: "pax",      label: "Pax",       kind: "number" },
      { name: "areas",    label: "Areas / malls", kind: "text" },
      ...DATETIME_FIELDS,
      { name: "notes",    label: "Notes",     kind: "textarea" },
    ],
  },
  {
    key: "carWithDriver5h",
    label: "Car with Driver — 5 hrs (half day)",
    fields: [
      { name: "pickup",  label: "Pickup", kind: "text" },
      { name: "dropoff", label: "Dropoff", kind: "text" },
      ...DATETIME_FIELDS,
      { name: "notes",   label: "Notes",  kind: "textarea" },
    ],
  },
  {
    key: "carWithDriver10h",
    label: "Car with Driver — 10 hrs (full day)",
    fields: [
      { name: "pickup",  label: "Pickup",  kind: "text" },
      { name: "dropoff", label: "Dropoff", kind: "text" },
      ...DATETIME_FIELDS,
      { name: "notes",   label: "Notes",   kind: "textarea" },
    ],
  },
];

// Empty service entry — `enabled: false` + every field empty.
const blankService = (svc) => {
  const fields = {};
  (svc.fields || []).forEach((f) => { fields[f.name] = ""; });
  return { enabled: false, ...fields };
};

const blankState = () => {
  const out = {};
  ADDON_SERVICES_CATALOG.forEach((svc) => { out[svc.key] = blankService(svc); });
  return out;
};

// ── Helpers exposed to other modules ─────────────────────────────────
/**
 * Read the latest panel state from sessionStorage. Returns the empty
 * skeleton (every service `enabled: false`) when nothing has been
 * saved yet — so the booking-page payload code can always assume a
 * well-shaped object.
 */
export const readAddOnServices = () => {
  try {
    const raw = sessionStorage.getItem(ADDON_SERVICES_STORAGE_KEY);
    if (!raw) return blankState();
    const parsed = JSON.parse(raw);
    // Merge with the blank skeleton so new services added to the catalog
    // post-deployment don't crash if old saved state lacks them.
    const merged = blankState();
    Object.keys(parsed || {}).forEach((k) => {
      if (merged[k] != null) merged[k] = { ...merged[k], ...parsed[k] };
    });
    return merged;
  } catch {
    return blankState();
  }
};

/** Convenience for booking-payload code — drops every service that's
 *  toggled off, so the request stays compact. Returns null when the
 *  operator hasn't enabled any service. */
export const collectEnabledAddOnServices = () => {
  const all = readAddOnServices();
  const out = {};
  Object.entries(all).forEach(([key, val]) => {
    if (val && val.enabled === true) out[key] = val;
  });
  return Object.keys(out).length > 0 ? out : null;
};

/**
 * Sticky right-rail panel. Place once on any page in the
 * Make-Your-Own-Package flow; state is shared via sessionStorage.
 */
/**
 * Props:
 *   title           — section title (defaults to "Add-On Services")
 *   hideServiceKeys — array of catalog keys to hide (e.g. ["visa"]) so a
 *                     page can render its own simplified question instead.
 *                     The legacy flow passes nothing and gets every item.
 */
export default function AddOnServicesPanel({
  title = "Add-On Services",
  hideServiceKeys = [],
}) {
  const [state, setState] = useState(() => readAddOnServices());
  const visibleCatalog = useMemo(
    () =>
      ADDON_SERVICES_CATALOG.filter(
        (svc) => !hideServiceKeys.includes(svc.key)
      ),
    [hideServiceKeys]
  );

  // Controlled accordion — list of eventKey strings that are currently
  // expanded. Seeded from the already-enabled services so when the
  // operator re-opens the panel they see the same expanded rows.
  const [expandedKeys, setExpandedKeys] = useState(() => {
    const keys = [];
    visibleCatalog.forEach((svc, idx) => {
      const v = (readAddOnServices() || {})[svc.key];
      if (v && v.enabled) keys.push(String(idx));
    });
    return keys;
  });

  // Persist on every change. Browser-only — sessionStorage isn't
  // available during SSR, but this codebase is a CRA SPA so we're safe.
  useEffect(() => {
    try {
      sessionStorage.setItem(ADDON_SERVICES_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // localStorage / sessionStorage can throw in private windows;
      // ignore — the in-memory state still drives the UI.
    }
  }, [state]);

  // React when another tab / another page in the SPA writes a fresh
  // value (e.g. the operator toggled something on the search page,
  // then came to the booking page).
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === ADDON_SERVICES_STORAGE_KEY) {
        setState(readAddOnServices());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const enabledCount = useMemo(
    () => Object.values(state).filter((v) => v && v.enabled).length,
    [state]
  );

  const toggleService = (key, value) => {
    setState((prev) => ({ ...prev, [key]: { ...prev[key], enabled: !!value } }));
    // Auto-expand the row the operator just turned ON so they can
    // immediately start typing details — no second click needed.
    // Auto-collapse on OFF so the panel stays compact.
    const idx = ADDON_SERVICES_CATALOG.findIndex((s) => s.key === key);
    if (idx < 0) return;
    const evKey = String(idx);
    setExpandedKeys((prev) => {
      const has = prev.includes(evKey);
      if (value && !has) return [...prev, evKey];
      if (!value && has) return prev.filter((k) => k !== evKey);
      return prev;
    });
  };

  const updateField = (key, field, value) => {
    setState((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  return (
    <Card className="shadow-sm border-0 rounded-4">
      <Card.Header className="bg-white border-0 pt-3 px-3 pb-2 d-flex align-items-center justify-content-between">
        <h6 className="fw-bold m-0 text-dark">{title}</h6>
        <Badge bg={enabledCount > 0 ? "success-subtle" : "secondary-subtle"}
               text={enabledCount > 0 ? "success" : "secondary"}>
          {enabledCount} on
        </Badge>
      </Card.Header>
      <Card.Body className="px-3 pt-1 pb-2" style={{ maxHeight: 600, overflowY: "auto" }}>
        <Accordion
          alwaysOpen
          activeKey={expandedKeys}
          onSelect={(eventKey) => {
            // Bootstrap passes the new active list (or a single key)
            // — normalise to an array so our state shape is stable.
            if (Array.isArray(eventKey)) {
              setExpandedKeys(eventKey);
            } else if (eventKey == null) {
              setExpandedKeys([]);
            } else {
              setExpandedKeys((prev) =>
                prev.includes(eventKey)
                  ? prev.filter((k) => k !== eventKey)
                  : [...prev, eventKey]
              );
            }
          }}
        >
          {visibleCatalog.map((svc, idx) => {
            const current = state[svc.key] || blankService(svc);
            const isOpen = expandedKeys.includes(String(idx));
            return (
              <Accordion.Item key={svc.key} eventKey={String(idx)}>
                <Accordion.Header>
                  <div className="d-flex w-100 align-items-center justify-content-between pe-2">
                    <span className="d-flex align-items-center gap-2">
                      <FaChevronDown
                        size={12}
                        className="text-muted"
                        style={{
                          transition: "transform 0.15s ease",
                          transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)",
                        }}
                      />
                      <span className="small fw-semibold">{svc.label}</span>
                    </span>
                    <Form.Check
                      type="switch"
                      id={`addon-switch-${svc.key}`}
                      checked={!!current.enabled}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => toggleService(svc.key, e.target.checked)}
                      label={current.enabled ? "Yes" : "No"}
                    />
                  </div>
                </Accordion.Header>
                <Accordion.Body className="p-2">
                  {current.enabled ? (
                    <Row className="g-2">
                      {svc.fields.map((f) => (
                        <Col xs={12} md={f.kind === "textarea" ? 12 : 6} key={f.name}>
                          <Form.Label className="small text-muted fw-semibold mb-1">
                            {f.label}
                          </Form.Label>
                          {f.kind === "textarea" ? (
                            <Form.Control
                              as="textarea"
                              rows={2}
                              size="sm"
                              value={current[f.name] || ""}
                              onChange={(e) =>
                                updateField(svc.key, f.name, e.target.value)
                              }
                            />
                          ) : f.kind === "select" ? (
                            <Form.Select
                              size="sm"
                              value={current[f.name] || ""}
                              onChange={(e) =>
                                updateField(svc.key, f.name, e.target.value)
                              }
                            >
                              {(f.options || []).map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </Form.Select>
                          ) : (
                            <Form.Control
                              size="sm"
                              type={f.kind}
                              value={current[f.name] || ""}
                              onChange={(e) =>
                                updateField(svc.key, f.name, e.target.value)
                              }
                            />
                          )}
                        </Col>
                      ))}
                    </Row>
                  ) : (
                    <div className="text-muted small fst-italic">
                      Toggle ON to capture details.
                    </div>
                  )}
                </Accordion.Body>
              </Accordion.Item>
            );
          })}
        </Accordion>
      </Card.Body>
    </Card>
  );
}
