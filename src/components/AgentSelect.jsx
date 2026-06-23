import React from "react";
import Select from "react-select";

/**
 * Shared agent picker used across the /new-booking/* search pages.
 * Renders each option on two lines — bold company name on top, muted
 * "City, Country" subtitle underneath — so operators can distinguish
 * agents that share a company name. The closed control keeps the same
 * 42px height as the surrounding form fields.
 *
 * Agent JSON shape (from /api/agent): the read-side DTO carries the
 * resolved `placeName`, `provinceName` and `countryName`. Older code
 * paths may have populated the nested `place.name`, `province.name`
 * and `country.name` instead, so we fall through both.
 *
 * Props:
 *   agents  — array of agent records as returned by /api/agent
 *   value   — currently-selected agent id (string or number, or "")
 *   onChange(id) — called with the picked id ("" when cleared)
 *   placeholder — text shown when nothing is selected
 *   isInvalid   — when true, paints the control with the bootstrap
 *                 invalid-feedback red border so it lines up with the
 *                 existing error styling on the page
 */
// Coerce anything (number, null, undefined, object) to a clean
// string. react-select's default `filterOption` calls
// `option.label.replace(...)` internally, which throws
// `str.replace is not a function` if the label isn't a String.
// One bad row in /api/agent (e.g. numeric companyName, null name)
// brings down every page that uses this picker, so we normalise
// every visible field at the source.
const safeStr = (v) => {
  if (v == null) return "";
  return typeof v === "string" ? v : String(v);
};

const buildOption = (a = {}) => {
  // Show the province (e.g. "Abu Dhabi") rather than the more granular
  // place (e.g. "Qasr Al Hosn") in the option subtitle — operators
  // identify agents by emirate/province, not by landmark. Fall back to
  // the place only when no province is resolved.
  const city = safeStr(
    a.provinceName ||
      a.province?.name ||
      a.placeName ||
      a.place?.name ||
      a.city ||
      "",
  );
  const country = safeStr(a.countryName || a.country?.name || "");
  const fullName = [safeStr(a.firstName), safeStr(a.lastName)]
    .filter(Boolean)
    .join(" ")
    .trim();
  const label =
    safeStr(a.companyName) ||
    safeStr(a.name) ||
    fullName ||
    `Agent #${safeStr(a.id) || "?"}`;
  return {
    value: safeStr(a.id),
    label,
    city,
    country,
  };
};

const formatOptionLabel = (opt = {}, { context } = {}) => {
  const label = safeStr(opt.label);
  const sub = [safeStr(opt.city), safeStr(opt.country)]
    .filter(Boolean)
    .join(", ");
  if (context === "value") {
    return (
      <span>
        <span className="fw-semibold">{label}</span>
        {sub && <span className="text-muted ms-2 small">{sub}</span>}
      </span>
    );
  }
  return (
    <div>
      <div className="fw-semibold">{label}</div>
      {sub && <div className="text-muted small">{sub}</div>}
    </div>
  );
};

// Defensive filter: react-select's default one assumes
// option.label is a string and calls `.replace()` on it. We
// already normalise upstream, but this belt-and-braces guard
// stops any future caller from crashing the dropdown.
const safeFilterOption = (option, raw) => {
  const needle = safeStr(raw).trim().toLowerCase();
  if (!needle) return true;
  const opt = option?.data || {};
  const haystack = [safeStr(opt.label), safeStr(opt.city), safeStr(opt.country)]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
};

export default function AgentSelect({
  agents = [],
  value = "",
  onChange,
  placeholder = "Select Agent",
  isInvalid = false,
}) {
  const safeAgents = Array.isArray(agents) ? agents.filter(Boolean) : [];
  const options = safeAgents.map(buildOption);
  const selected =
    options.find((o) => o.value === safeStr(value)) || null;

  return (
    <Select
      classNamePrefix="agent-select"
      placeholder={placeholder}
      isClearable
      value={selected}
      options={options}
      onChange={(opt) => onChange && onChange(opt ? opt.value : "")}
      formatOptionLabel={formatOptionLabel}
      filterOption={safeFilterOption}
      // Render the menu in a body-level portal so it floats above
      // sticky bars / scroll containers and never gets clipped or
      // pushed off-screen on small viewports. Desktop position is
      // unchanged (popper keeps it anchored to the control).
      menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
      menuPosition="fixed"
      styles={{
        control: (base) => ({
          ...base,
          minHeight: 42,
          borderRadius: 8,
          borderColor: isInvalid ? "#dc3545" : base.borderColor,
          boxShadow: isInvalid ? "0 0 0 0.15rem rgba(220,53,69,.15)" : base.boxShadow,
        }),
        menu: (base) => ({ ...base, zIndex: 5 }),
        menuPortal: (base) => ({ ...base, zIndex: 9999 }),
      }}
    />
  );
}
