// How long a page waits for a backend call that itself waits on supplier
// APIs. The backend gives every supplier up to 90 seconds (room search:
// app.room-search.supplier-timeout-ms), so the page must wait longer than
// that, or it gives up before the answer arrives. The extra 30 seconds
// covers building the reply.
export const SUPPLIER_SEARCH_TIMEOUT_MS = 120000;
