// Helpers for the report screens' "Mail" button (POST /api/reports/send-email).
// The backend re-runs the report with the filters sent here, so a screen sends
// the filters of its last Search plus its "search here" text.

// Merges filter objects, keeping only values in use (drops "", blanks, null, undefined).
export const compactFilters = (...parts) => {
  const out = {};
  parts.forEach((part) => {
    Object.entries(part || {}).forEach(([key, value]) => {
      const v = typeof value === "string" ? value.trim() : value;
      if (v !== "" && v !== null && v !== undefined) out[key] = v;
    });
  });
  return out;
};

// "Report sent successfully (3 records)" from the server's recordCount.
export const emailSentMessage = (data) => {
  const count = data?.recordCount;
  return typeof count === "number"
    ? `Report sent successfully (${count} record${count === 1 ? "" : "s"})`
    : "Report sent successfully!";
};

// The server's reason when it gave one.
export const emailErrorMessage = (error) =>
  error?.response?.data?.message || "Failed to send email";
