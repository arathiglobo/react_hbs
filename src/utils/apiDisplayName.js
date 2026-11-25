/**
 * Supplier names shown on the API Access screens (Admin → API Access and
 * Super Admin → API Clients) in place of the backend's external_api.api_name,
 * keyed by api code. Display only: the stored row and the api code are
 * unchanged, so saved credentials and routing are not affected.
 */
const API_DISPLAY_NAMES = {
  ATHARVA_V2: "ATHARVA_V2_API",
};

/** The name to show for a supplier row: the override, else its api name, else its code. */
export const apiDisplayName = (apiCode, apiName) =>
  API_DISPLAY_NAMES[String(apiCode || "").toUpperCase()] || apiName || apiCode;
