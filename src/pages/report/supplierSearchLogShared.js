/*
 * Shared by the Supplier Search Logs list (SupplierSearchLogs.jsx) and the
 * page of one supplier's file, opened in a new tab (SupplierSearchLogFile.jsx).
 *
 * API: /api/admin/search-response-logs (SearchResponseLogController).
 */

export const API = "/api/admin/search-response-logs";
export const LIST_ROUTE = "/report/supplier-search-logs";
export const FILE_ROUTE = "/report/supplier-search-logs/file";
export const DOWNLOAD_TIMEOUT_MS = 180_000;

/** API address of one file. */
export const fileUrl = (fileName) => `${API}/${encodeURIComponent(fileName)}`;

/** Page address of one supplier's file (the name goes in the query: it contains dots). */
export const fileRoute = (fileName) => `${FILE_ROUTE}?name=${encodeURIComponent(fileName)}`;

/**
 * Opens one supplier's file in a new tab. No "noopener" on purpose: the new
 * tab then gets a copy of this tab's session, so it stays signed in (the same
 * way the app's other new-tab hand-offs work).
 *
 * @returns false when the browser blocked the new tab
 */
export const openFileInNewTab = (fileName) => {
  const tab = window.open(fileRoute(fileName), "_blank");
  return Boolean(tab);
};

export const formatBytes = (bytes) => {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

export const outcomeVariant = (outcome) => {
  switch ((outcome || "").toUpperCase()) {
    case "COMPLETE":
      return "success";
    case "PARTIAL":
      return "warning";
    case "TIMEOUT":
    case "ERROR":
      return "danger";
    default:
      return "secondary";
  }
};

export const flagVariant = (flag) => {
  const f = (flag || "").toLowerCase();
  if (f === "ok") return "success";
  if (f === "late") return "warning";
  return "danger";
};

/** The file name the server suggested, else a fallback. */
export const fileNameFrom = (disposition, fallback) => {
  if (!disposition) return fallback;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (star) {
    try {
      return decodeURIComponent(star[1].replace(/"/g, ""));
    } catch (e) {
      // fall through
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  return plain ? plain[1] : fallback;
};

export const saveBlob = (blob, name) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Replies larger than this are shown as received, without pretty printing. */
const PRETTY_MAX_CHARS = 2_000_000;

/** Indented XML, or null when it does not parse. */
const prettyXml = (text) => {
  try {
    const doc = new DOMParser().parseFromString(text, "application/xml");
    if (doc.getElementsByTagName("parsererror").length > 0) return null;
    const lines = [];
    const walk = (node, depth) => {
      const pad = "  ".repeat(depth);
      if (node.nodeType === Node.TEXT_NODE) {
        const t = node.nodeValue.trim();
        if (t) lines.push(pad + t);
        return;
      }
      if (node.nodeType === Node.CDATA_SECTION_NODE) {
        lines.push(`${pad}<![CDATA[${node.nodeValue}]]>`);
        return;
      }
      if (node.nodeType === Node.COMMENT_NODE) {
        lines.push(`${pad}<!--${node.nodeValue}-->`);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const attrs = Array.from(node.attributes)
        .map((a) => ` ${a.name}="${a.value}"`)
        .join("");
      const kids = Array.from(node.childNodes).filter(
        (c) => !(c.nodeType === Node.TEXT_NODE && !c.nodeValue.trim()),
      );
      if (kids.length === 0) {
        lines.push(`${pad}<${node.nodeName}${attrs}/>`);
      } else if (kids.length === 1 && kids[0].nodeType === Node.TEXT_NODE) {
        lines.push(`${pad}<${node.nodeName}${attrs}>${kids[0].nodeValue.trim()}</${node.nodeName}>`);
      } else {
        lines.push(`${pad}<${node.nodeName}${attrs}>`);
        kids.forEach((c) => walk(c, depth + 1));
        lines.push(`${pad}</${node.nodeName}>`);
      }
    };
    walk(doc.documentElement, 0);
    return lines.join("\n");
  } catch (e) {
    return null;
  }
};

/** Readable JSON or XML; null when it is neither (or too large), so the text is shown as received. */
export const prettyText = (text) => {
  if (!text || text.length > PRETTY_MAX_CHARS) return null;
  const t = text.trim();
  if (t.startsWith("{") || t.startsWith("[")) {
    try {
      return JSON.stringify(JSON.parse(t), null, 2);
    } catch (e) {
      return null;
    }
  }
  if (t.startsWith("<")) return prettyXml(t);
  return null;
};

/** Order of the "Key : value" lines at the top of a file. */
export const HEADER_ORDER = [
  "Agent", "Agent id", "Searched by", "Supplier", "Search id", "Searched at", "Finished at", "Duration",
  "Outcome", "Why partial", "City", "Country", "Check-in", "Check-out", "Rooms", "Guests", "Nationality",
  "Hotels found", "Supplier replies", "Note",
];
