// Shared date/datetime utilities for LocalDateTime support.
// Backend changed from LocalDate to LocalDateTime — strings now come as
// "2026-05-23T14:30:00" instead of "2026-05-23".

const parse = (str) => {
  if (!str) return null;
  // "2026-05-23" → treat as local midnight to avoid UTC offset shifting the day
  const normalized = str.includes("T") ? str : `${str}T00:00:00`;
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
};

/** "23/05/2026 14:30" */
export const formatDateTime = (str) => {
  const d = parse(str);
  if (!d) return "-";
  const day = String(d.getDate()).padStart(2, "0");
  const mon = String(d.getMonth() + 1).padStart(2, "0");
  const hrs = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${mon}/${d.getFullYear()} ${hrs}:${min}`;
};

/** "23/05/2026" — date only */
export const formatDateOnly = (str) => {
  const d = parse(str);
  if (!d) return "-";
  const day = String(d.getDate()).padStart(2, "0");
  const mon = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${mon}/${d.getFullYear()}`;
};

/** "23 May 2026, 14:30" — human-readable datetime */
export const formatDateTimeDisplay = (str) => {
  const d = parse(str);
  if (!d) return "-";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

/** "23 May 2026" — human-readable date only */
export const formatDateDisplay = (str) => {
  const d = parse(str);
  if (!d) return "-";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

/**
 * Convert a plain date string to LocalDateTime for API calls.
 * "2026-05-23" → "2026-05-23T00:00:00"
 * "2026-05-23T14:30:00" → unchanged
 */
export const toLocalDateTime = (dateStr) => {
  if (!dateStr) return null;
  return dateStr.includes("T") ? dateStr : `${dateStr}T00:00:00`;
};

/** Extract just the date part: "2026-05-23T14:30:00" → "2026-05-23" */
export const extractDate = (str) => {
  if (!str) return "";
  return str.split("T")[0];
};

/** Night count between two LocalDateTime strings */
export const nightsBetween = (checkInStr, checkOutStr) => {
  const cin = parse(checkInStr);
  const cout = parse(checkOutStr);
  if (!cin || !cout) return 0;
  return Math.max(0, Math.round((cout - cin) / (1000 * 60 * 60 * 24)));
};
