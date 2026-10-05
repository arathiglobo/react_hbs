/**
 * Agents must never see which API supplier (ATHARVA, GRN, RateHawk, …) a
 * hotel / rate / activity comes from. These helpers are display-only: the
 * underlying data (hotelName, apiType) is left untouched so supplier routing
 * and booking payloads keep working exactly as before.
 */

// Mirrors the backend hotelmapping Supplier enum. The unified room search
// (/api/hotel-rooms/search) appends " (<SUPPLIER>)" to hotelName for hotels
// mapped across several suppliers.
const SUPPLIER_SUFFIX_RE =
  /\s*\((RATEHAWK|IWTX|ATHARVA|JUMEIRAH|DARINA|INHOUSE|X3|GRN|GOGLOBAL)\)\s*$/i;

/**
 * Same agent-login detection used across the app: prefer the multi-role
 * currentActiveRole, fall back to userRole for single-role logins.
 */
export function isAgentLogin() {
  try {
    const activeRole = (localStorage.getItem("currentActiveRole") || "")
      .trim()
      .toUpperCase();
    const storedRoles = (localStorage.getItem("userRole") || "").toUpperCase();
    return activeRole
      ? activeRole === "AGENT"
      : storedRoles.includes("AGENT") && !storedRoles.includes("ADMIN");
  } catch {
    return false;
  }
}

/** Hotel name for display — supplier suffix removed for agent logins. */
export function displayHotelName(name) {
  if (typeof name !== "string" || !isAgentLogin()) return name;
  return name.replace(SUPPLIER_SUFFIX_RE, "");
}
