import React, { useEffect, useMemo, useState } from "react";
import { Card, Form, Row, Col, Badge, Accordion } from "react-bootstrap";
import { FaChevronDown } from "react-icons/fa";
import axiosInstance from "./AxiosInstance";

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
// Canonical catalogue of add-on services for the Make-Your-Own-Package
// v2 wizard. Each entry is rendered as its own wizard step:
//   • a Yes/No question gates the step (No → empty save, skip to next)
//   • when Yes is picked, the listed `fields` collect the details
//
// `kind` controls the rendered input:
//   "text"     → single-line text
//   "textarea" → multiline text
//   "number"   → numeric input
//   "date"     → date input
//   "time"     → time input
//   "select"   → <select> with `options: [{value,label}]`
//   "radio"    → inline radio group with `options: [{value,label}]`
//   "file"     → file picker (stores the chosen filename only — the
//                 backend should accept the file separately via FormData)
export const ADDON_SERVICES_CATALOG = [
  {
    key: "visa",
    label: "Visa Details",
    question: "Do you need visa assistance / want to capture visa details for this booking?",
    fields: [
      { name: "visaStatus", label: "Visa Status", kind: "select",
        options: [
          { value: "",                label: "Select status" },
          { value: "Required",        label: "Required" },
          { value: "Already Issued",  label: "Already Issued" },
          { value: "On Arrival",      label: "On Arrival" },
          { value: "Not Required",    label: "Not Required" },
        ] },
      { name: "visaType", label: "Visa Type", kind: "select",
        options: [
          { value: "",               label: "Select type" },
          { value: "Tourist Visa",   label: "Tourist Visa" },
          { value: "Business Visa",  label: "Business Visa" },
          { value: "Transit Visa",   label: "Transit Visa" },
          { value: "Student Visa",   label: "Student Visa" },
        ] },
      { name: "visaNumber",       label: "Visa Number",         kind: "text" },
      { name: "visaExpiryDate",   label: "Visa Expiry Date",    kind: "date" },
      { name: "countryIssuedFor", label: "Country Issued For",  kind: "text" },
      { name: "passportNumber",   label: "Passport Number",     kind: "text" },
      { name: "visaCopy",         label: "Visa Copy Upload",    kind: "file" },
      { name: "passportCopy",     label: "Passport Upload (optional)", kind: "file" },
      { name: "entryType", label: "Entry Type", kind: "select",
        options: [
          { value: "",                 label: "Select entry type" },
          { value: "Single Entry",     label: "Single Entry" },
          { value: "Double Entry",     label: "Double Entry" },
          { value: "Multiple Entry",   label: "Multiple Entry" },
        ] },
      { name: "remarks", label: "Remarks", kind: "textarea" },
      { name: "notes",   label: "Notes",   kind: "textarea" },
    ],
  },
  {
    key: "meetAndGreet",
    label: "Meet & Greet",
    question: "Do you need a Meet & Greet service at the airport?",
    fields: [
      { name: "airportName",         label: "Airport Name",          kind: "text" },
      { name: "passengerNameBoard",  label: "Passenger Name Board",  kind: "text" },
      { name: "flightNumber",        label: "Flight Number",         kind: "text" },
      { name: "arrivalTime",         label: "Arrival Time",          kind: "time" },
      { name: "passengerCount",      label: "Passenger Count",       kind: "number" },
      { name: "vipAssistance", label: "VIP Assistance", kind: "radio",
        options: [
          { value: "Yes", label: "Yes" },
          { value: "No",  label: "No" },
        ] },
      { name: "specialInstructions", label: "Special Instructions",  kind: "textarea" },
    ],
  },
  {
    key: "travelInsurance",
    label: "Travel Insurance",
    question: "Do you want to add travel insurance to this booking?",
    fields: [
      { name: "insurancePlan", label: "Insurance Plan", kind: "select",
        options: [
          { value: "",                  label: "Select plan" },
          { value: "Medical",           label: "Medical" },
          { value: "Trip Cancellation", label: "Trip Cancellation" },
          { value: "Lost Baggage",      label: "Lost Baggage" },
          { value: "Flight Delay",      label: "Flight Delay" },
        ] },
      { name: "coverageType",      label: "Coverage Type",      kind: "text" },
      { name: "travelerCount",     label: "Traveler Count",     kind: "number" },
      { name: "startDate",         label: "Start Date",         kind: "date" },
      { name: "endDate",           label: "End Date",           kind: "date" },
      { name: "medicalConditions", label: "Medical Conditions", kind: "textarea" },
      { name: "emergencyContact",  label: "Emergency Contact",  kind: "text" },
    ],
  },
  {
    key: "simCard",
    label: "SIM Card / eSIM",
    question: "Do you need a SIM card or eSIM for the trip?",
    fields: [
      { name: "simType", label: "SIM Type", kind: "radio",
        options: [
          { value: "Physical SIM", label: "Physical SIM" },
          { value: "eSIM",         label: "eSIM" },
        ] },
      { name: "destinationCountry", label: "Destination Country", kind: "text" },
      { name: "dataPackage",        label: "Data Package",        kind: "text" },
      { name: "validityDays",       label: "Validity (days)",     kind: "number" },
      { name: "mobileNumber",       label: "Mobile Number",       kind: "text" },
      { name: "deliveryMethod", label: "Delivery Method", kind: "select",
        options: [
          { value: "",                label: "Select delivery" },
          { value: "Airport Pickup",  label: "Airport Pickup" },
          { value: "Hotel Delivery",  label: "Hotel Delivery" },
          { value: "Home Delivery",   label: "Home Delivery" },
        ] },
      { name: "pickupLocation",     label: "Pickup Location",     kind: "text" },
    ],
  },
  {
    key: "fastTrackImmigration",
    label: "Fast Track Immigration",
    question: "Do you need Fast Track Immigration assistance?",
    fields: [
      { name: "airport", label: "Airport", kind: "select",
        options: [
          { value: "",       label: "Select airport" },
          { value: "DXB",    label: "DXB - Dubai International" },
          { value: "AUH",    label: "AUH - Abu Dhabi International" },
          { value: "SHJ",    label: "SHJ - Sharjah International" },
          { value: "DWC",    label: "DWC - Al Maktoum International" },
          { value: "Other",  label: "Other" },
        ] },
      { name: "direction", label: "Arrival / Departure", kind: "radio",
        options: [
          { value: "Arrival",   label: "Arrival" },
          { value: "Departure", label: "Departure" },
        ] },
      { name: "passengerCount", label: "Passenger Count", kind: "number" },
      { name: "flightNumber",   label: "Flight Number",   kind: "text" },
      { name: "travelDate",     label: "Travel Date",     kind: "date" },
      { name: "priorityLevel", label: "Priority Level", kind: "select",
        options: [
          { value: "",          label: "Select priority" },
          { value: "Standard",  label: "Standard" },
          { value: "Premium",   label: "Premium" },
          { value: "VIP",       label: "VIP" },
        ] },
      { name: "notes", label: "Notes", kind: "textarea" },
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

// ── Dynamic catalog (loaded from /api/package-addon/active) ──────────
//
// Server-side codes (UPPER_SNAKE) ↔ existing static-catalog keys. When a
// server entry's code maps to a known key we reuse the rich field schema
// above so VISA / MEET_GREET keep their detailed forms. Anything else
// gets a generic three-field form so the operator can still capture a
// date, quantity, and notes for it.
const CODE_TO_STATIC_KEY = {
  VISA: "visa",
  MEET_GREET: "meetAndGreet",
  TRAVEL_INSURANCE: "travelInsurance",
  SIM_CARD: "simCard",
  FAST_TRACK_IMMIGRATION: "fastTrackImmigration",
};

const buildGenericFields = () => ([
  { name: "serviceDate", label: "Service Date", kind: "date" },
  { name: "quantity",    label: "Quantity",     kind: "number" },
  { name: "notes",       label: "Notes",        kind: "textarea" },
]);

/**
 * Build a runtime catalog entry by merging a server row with the static
 * field schema (when there is one). Output shape matches the static
 * entries so the wizard / panel renderers can treat both kinds uniformly.
 *
 *   serverItem: { addonId, code, name, description, hasDetails, displayOrder,
 *                 discountText, rateId, unitPrice, childPrice, infantPrice, currency }
 */
const buildCatalogEntry = (serverItem) => {
  const code = (serverItem.code || "").toUpperCase();
  const staticKey = CODE_TO_STATIC_KEY[code];
  const staticEntry = staticKey
    ? ADDON_SERVICES_CATALOG.find((s) => s.key === staticKey)
    : null;
  const key = staticKey || code.toLowerCase();
  return {
    key,
    label: serverItem.name || (staticEntry && staticEntry.label) || code,
    question: staticEntry
      ? staticEntry.question
      : `Add ${serverItem.name || code} to this package?`,
    description: serverItem.description || null,
    discountText: serverItem.discountText || null,
    fields: staticEntry ? staticEntry.fields : buildGenericFields(),
    // Pricing snapshot — what to display on the search/booking summary
    // and what to send back as the booking line-item.
    addonId: serverItem.addonId,
    rateId: serverItem.rateId,
    unitPrice: serverItem.unitPrice,
    childPrice: serverItem.childPrice,
    infantPrice: serverItem.infantPrice,
    currency: serverItem.currency || "AED",
    hasDetails: serverItem.hasDetails !== false,
    displayOrder: serverItem.displayOrder ?? 100,
    code,
  };
};

/**
 * Fetch the active add-on catalog from the backend. `pickupDateIso` is
 * optional (YYYY-MM-DD) and lets the backend pick the right rate window.
 * Returns [] if the endpoint isn't deployed yet — callers should treat
 * an empty catalog as "no add-on toggles" rather than as an error.
 */
export const loadActiveAddOnCatalog = async (pickupDateIso) => {
  try {
    const q = pickupDateIso ? `?pickupDate=${encodeURIComponent(pickupDateIso)}` : "";
    const res = await axiosInstance.get(`/api/package-addon/active${q}`);
    const list = Array.isArray(res.data) ? res.data : [];
    return list
      .map(buildCatalogEntry)
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  } catch (e) {
    // Surface errors to the console; calling pages should still render
    // the rest of the search form with an empty add-on list.
    console.warn("loadActiveAddOnCatalog failed:", e?.message || e);
    return [];
  }
};

/**
 * Booking-payload helper — builds the snapshot of priced line-items for the
 * server. Pairs each enabled add-on key with the price from the catalog
 * passed in (so future rate changes can't affect the values that the FE
 * showed the operator at confirm time). Returns null when nothing was
 * enabled.
 */
export const buildAddOnLineItemsForPayload = (catalog) => {
  if (!Array.isArray(catalog) || catalog.length === 0) return null;
  const all = readAddOnServices();
  const out = [];
  for (const entry of catalog) {
    const slot = all[entry.key];
    if (!slot || slot.enabled !== true) continue;
    const qty = Number(slot.quantity) > 0 ? Number(slot.quantity) : 1;
    const unit = entry.unitPrice != null ? Number(entry.unitPrice) : null;
    out.push({
      addonId: entry.addonId,
      addonCode: entry.code,
      addonName: entry.label,
      addonRateId: entry.rateId,
      quantity: qty,
      unitPrice: unit,
      currency: entry.currency || "AED",
      lineTotal: unit != null ? unit * qty : null,
    });
  }
  return out.length > 0 ? out : null;
};

/** Sums catalog-priced enabled add-ons for the booking summary line. */
export const sumEnabledAddOnPrices = (catalog) => {
  const items = buildAddOnLineItemsForPayload(catalog);
  if (!items) return 0;
  return items.reduce((s, i) => s + (Number(i.lineTotal) || 0), 0);
};

/**
 * Single-service form — renders just one entry from
 * ADDON_SERVICES_CATALOG as a Yes/No toggle plus its fields. Reads and
 * writes the same sessionStorage key as <AddOnServicesPanel/>, so a
 * wizard that splits each service into its own step stays in sync with
 * any panel rendered elsewhere on the page.
 */
/**
 * Looks up the schema for a serviceKey — checks the rich static catalog
 * first (visa, meetAndGreet, …), then falls back to the dynamic catalog
 * cached by the search page in sessionStorage under
 * `mypkg_addon_catalog_v2`. Lets admin-added add-ons that have no static
 * field schema still render their generic detail form.
 */
const lookupAnyCatalogEntry = (serviceKey) => {
  const fromStatic = ADDON_SERVICES_CATALOG.find((s) => s.key === serviceKey);
  if (fromStatic) return fromStatic;
  try {
    const raw = sessionStorage.getItem("mypkg_addon_catalog_v2");
    if (!raw) return null;
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return null;
    return list.find((s) => s && s.key === serviceKey) || null;
  } catch {
    return null;
  }
};

export function SingleAddOnService({ serviceKey }) {
  const svc = useMemo(() => lookupAnyCatalogEntry(serviceKey), [serviceKey]);
  const [current, setCurrent] = useState(() => {
    const all = readAddOnServices();
    return all[serviceKey] || (svc ? blankService(svc) : { enabled: false });
  });

  // When the `serviceKey` prop changes (e.g. the parent reused this
  // component instance across wizard steps without giving it a fresh
  // `key`), re-pull the slot for the new service so the toggle + fields
  // don't bleed the previous service's data into this step — and so
  // typing here doesn't accidentally overwrite the new slot with the
  // previous service's content.
  useEffect(() => {
    const all = readAddOnServices();
    setCurrent(all[serviceKey] || (svc ? blankService(svc) : { enabled: false }));
  }, [serviceKey, svc]);

  // Re-sync when another component writes a fresh value to the shared
  // sessionStorage key.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === ADDON_SERVICES_STORAGE_KEY) {
        const all = readAddOnServices();
        setCurrent(all[serviceKey] || (svc ? blankService(svc) : { enabled: false }));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [serviceKey, svc]);

  const persist = (next) => {
    setCurrent(next);
    const all = readAddOnServices();
    all[serviceKey] = next;
    try {
      sessionStorage.setItem(ADDON_SERVICES_STORAGE_KEY, JSON.stringify(all));
    } catch {
      /* ignore */
    }
  };

  if (!svc) {
    return (
      <div className="text-muted small fst-italic">
        Unknown service: {serviceKey}
      </div>
    );
  }

  // Default question if a catalogue entry didn't set one.
  const question = svc.question || `Do you need ${svc.label}?`;

  return (
    <Card className="shadow-sm border-0 rounded-4">
      <Card.Body className="p-4">
        <h5 className="fw-bold mb-1">{svc.label}</h5>
        <div className="mb-3" style={{ color: "#4b5563", fontSize: "0.95rem" }}>
          {question}
        </div>

        {/* Yes / No gate. Picking No clears the field state for this
            service so stale data isn't shipped on save. */}
        <div className="d-flex gap-3 mb-3">
          <Form.Check
            type="radio"
            id={`addon-${svc.key}-yes`}
            name={`addon-${svc.key}-gate`}
            label={
              <span className="fw-semibold" style={{ color: current.enabled ? "#16a34a" : undefined }}>
                Yes
              </span>
            }
            checked={current.enabled === true}
            onChange={() => persist({ ...current, enabled: true })}
          />
          <Form.Check
            type="radio"
            id={`addon-${svc.key}-no`}
            name={`addon-${svc.key}-gate`}
            label={
              <span className="fw-semibold" style={{ color: current.enabled === false ? "#6b7280" : undefined }}>
                No
              </span>
            }
            checked={current.enabled === false}
            // Just flip the gate — keep typed-in field values so the
            // operator doesn't lose work if they toggle Yes→No→Yes.
            // collectEnabledAddOnServices() filters out disabled
            // services at save-time, so the data never ships.
            onChange={() => persist({ ...current, enabled: false })}
          />
        </div>

        {current.enabled === true ? (
          <Row className="g-3">
            {svc.fields.map((f) => {
              const value = current[f.name] || "";
              const isWide = f.kind === "textarea" || f.kind === "file";
              return (
                <Col xs={12} md={isWide ? 12 : 6} key={f.name}>
                  <Form.Label className="small text-muted fw-semibold mb-1">
                    {f.label}
                  </Form.Label>
                  {f.kind === "textarea" ? (
                    <Form.Control
                      as="textarea"
                      rows={3}
                      value={value}
                      onChange={(e) => persist({ ...current, [f.name]: e.target.value })}
                    />
                  ) : f.kind === "select" ? (
                    <Form.Select
                      value={value}
                      onChange={(e) => persist({ ...current, [f.name]: e.target.value })}
                    >
                      {(f.options || []).map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Form.Select>
                  ) : f.kind === "radio" ? (
                    <div className="d-flex flex-wrap gap-3 pt-1">
                      {(f.options || []).map((o) => (
                        <Form.Check
                          key={o.value}
                          type="radio"
                          id={`addon-${svc.key}-${f.name}-${o.value}`}
                          name={`addon-${svc.key}-${f.name}`}
                          label={o.label}
                          checked={value === o.value}
                          onChange={() => persist({ ...current, [f.name]: o.value })}
                        />
                      ))}
                    </div>
                  ) : f.kind === "file" ? (
                    <>
                      <Form.Control
                        type="file"
                        onChange={(e) => {
                          // sessionStorage can't hold a real File object;
                          // we persist the chosen filename only. The
                          // booking page can ask the operator to re-upload
                          // when actually submitting to the backend.
                          const file = e.target.files?.[0];
                          persist({ ...current, [f.name]: file?.name || "" });
                        }}
                      />
                      {value && (
                        <small className="text-success d-block mt-1">
                          ✓ Selected: <span className="fw-semibold">{value}</span>
                        </small>
                      )}
                    </>
                  ) : (
                    <Form.Control
                      type={f.kind}
                      value={value}
                      onChange={(e) => persist({ ...current, [f.name]: e.target.value })}
                    />
                  )}
                </Col>
              );
            })}
          </Row>
        ) : current.enabled === false ? (
          <div className="text-muted fst-italic small py-3 border-top pt-3">
            <span className="fw-semibold text-secondary">Skipped.</span>{" "}
            Click <span className="fw-semibold">Next →</span> to continue.
          </div>
        ) : (
          <div className="text-muted fst-italic small py-3 border-top pt-3">
            Pick <span className="fw-semibold text-success">Yes</span> to
            capture the details, or{" "}
            <span className="fw-semibold text-secondary">No</span> to skip
            this service.
          </div>
        )}
      </Card.Body>
    </Card>
  );
}

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
