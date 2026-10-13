// Client-side activity log.
//
// Records page views, button / link clicks, JavaScript errors and API calls
// that failed or never reached the server, and ships them in small batches to
// POST /api/activity-log/client, where the backend writes them to
// frontend.log (see ClientActivityLogController.java). Login / logout,
// searches, bookings, cancellations and admin changes are recorded by the
// backend itself from the API calls, so nothing here needs to be wired into
// individual pages.
//
// Ground rules — keep them if you extend this file:
//   * observe only: never preventDefault / stopPropagation, never change a
//     request, never throw (every hook is wrapped in try/catch);
//   * never read what the user typed (input values), never send query
//     strings, request bodies or tokens — the backend sanitises again anyway;
//   * who the user is comes from the JWT on the server; the user/role sent
//     here is only a hint for events fired while logged out.
//
// Opt-outs: REACT_APP_ACTIVITY_LOG_ENABLED=false disables it at build time;
// data-activity-ignore on an element hides clicks inside it; data-activity="…"
// on an element gives its clicks an explicit label.

import { getAuthToken, getCurrentActiveRole, getUserName, getUserRole } from "./authSession";

const API_BASE = process.env.REACT_APP_API_BASE_URL || "";
const ENDPOINT = `${API_BASE}/api/activity-log/client`;
const ENABLED =
  String(process.env.REACT_APP_ACTIVITY_LOG_ENABLED ?? "true").toLowerCase() !== "false";

const FLUSH_INTERVAL_MS = 5000;
const MAX_BATCH = 25;
const MAX_QUEUE = 200;
const MAX_ERRORS_PER_PAGE_LOAD = 50;
const SID_KEY = "activityLogSid";
const GLOBAL_FLAG = "__hbsActivityLogger";

const CLICKABLE = [
  "button",
  "a[href]",
  '[role="button"]',
  '[role="menuitem"]',
  '[role="tab"]',
  '[role="link"]',
  '[role="option"]',
  '[role="switch"]',
  '[role="checkbox"]',
  'input[type="button"]',
  'input[type="submit"]',
  'input[type="reset"]',
  'input[type="checkbox"]',
  'input[type="radio"]',
  "summary",
  ".btn",
  ".dropdown-item",
  ".nav-link",
  ".page-link",
  "[data-activity]",
].join(",");

const SENSITIVE_KEY = /pass(word|wd|code)?|pwd|secret|token|api[-_]?key|credential|otp|cvv|cvc|card|authorization|cookie/i;

// Saved before anything can wrap it, so our own sends are never observed.
const nativeFetch =
  typeof window !== "undefined" && typeof window.fetch === "function"
    ? window.fetch.bind(window)
    : null;

let queue = [];
let seq = 0;
let started = false;
let pausedUntil = 0;
let consecutiveFailures = 0;
let currentPath = null;
let pageSince = Date.now();
let lastClick = { key: "", at: 0 };
let errorsThisLoad = 0;
const recentKeys = new Map();

// ── helpers ─────────────────────────────────────────────────────────────

function short(value, max) {
  if (value === null || value === undefined) return undefined;
  const s = String(value).replace(/\s+/g, " ").trim();
  if (!s) return undefined;
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

// Light client-side masking; the backend applies the full set again.
function mask(text) {
  if (!text) return text;
  return text
    .replace(/eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g, "[JWT]")
    .replace(/([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*(@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, "$1***$2")
    .replace(/\+\d[\d\s-]{6,}\d/g, "[PHONE]");
}

function stripQuery(url) {
  if (!url) return undefined;
  const s = String(url);
  const cut = s.search(/[?#]/);
  return cut >= 0 ? s.slice(0, cut) : s;
}

function sessionId() {
  try {
    let id = sessionStorage.getItem(SID_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID().replace(/-/g, "").slice(0, 16)
          : `${Date.now().toString(16)}${Math.floor(Math.random() * 1e8).toString(16)}`;
      sessionStorage.setItem(SID_KEY, id);
    }
    return id;
  } catch (_) {
    return undefined;
  }
}

function activeRole() {
  try {
    return getCurrentActiveRole() || (getUserRole() || "").split(",")[0].trim() || undefined;
  } catch (_) {
    return undefined;
  }
}

/** Same key seen within windowMs → true (dedupes double clicks, error loops). */
function seenRecently(key, windowMs) {
  const now = Date.now();
  const at = recentKeys.get(key);
  if (recentKeys.size > 500) recentKeys.clear();
  recentKeys.set(key, now);
  return at !== undefined && now - at < windowMs;
}

// ── queue / transport ───────────────────────────────────────────────────

function push(type, data) {
  if (!started) return;
  try {
    const event = { type, ts: new Date().toISOString(), path: window.location.pathname, seq: ++seq };
    Object.keys(data || {}).forEach((k) => {
      if (data[k] !== undefined && data[k] !== null && data[k] !== "") event[k] = data[k];
    });
    queue.push(event);
    if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE);
    if (queue.length >= MAX_BATCH) flush(false);
  } catch (_) {
    /* never break the app */
  }
}

function flush(keepalive) {
  if (!queue.length || !nativeFetch) return;
  if (Date.now() < pausedUntil) return;
  try {
    const batch = queue.splice(0, MAX_BATCH);
    const body = JSON.stringify({
      client: {
        sid: sessionId(),
        user: getUserName() || undefined,
        role: getUserRole() || undefined,
        activeRole: activeRole(),
      },
      events: batch,
    });
    const headers = { "Content-Type": "application/json" };
    const token = getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    nativeFetch(ENDPOINT, {
      method: "POST",
      headers,
      body,
      credentials: "omit",
      // keepalive lets the last batch survive a page unload (64 KB browser cap).
      keepalive: Boolean(keepalive) && body.length < 60000,
    })
      .then((res) => {
        if (res.ok) {
          consecutiveFailures = 0;
          return;
        }
        // A backend without this endpoint (older deploy) answers 401/403/404:
        // stop trying for a while instead of retrying every 5 seconds.
        if ([401, 403, 404, 405, 410].includes(res.status)) {
          pausedUntil = Date.now() + 10 * 60 * 1000;
          queue = [];
        }
      })
      .catch(() => {
        consecutiveFailures += 1;
        if (consecutiveFailures >= 3) pausedUntil = Date.now() + 5 * 60 * 1000;
      });
  } catch (_) {
    /* ignore */
  }
}

// ── page views ──────────────────────────────────────────────────────────

function trackPageView() {
  try {
    const path = window.location.pathname;
    if (path === currentPath) return;
    const now = Date.now();
    const from = currentPath;
    currentPath = path;
    const durationMs = from ? now - pageSince : undefined;
    pageSince = now;
    push("PAGE_VIEW", { from: from || undefined, durationMs, title: short(document.title, 120) });
  } catch (_) {
    /* ignore */
  }
}

function hookHistory() {
  ["pushState", "replaceState"].forEach((name) => {
    const original = window.history[name];
    if (typeof original !== "function" || original.__activityWrapped) return;
    const wrapped = function wrappedHistoryMethod() {
      // eslint-disable-next-line prefer-rest-params
      const result = original.apply(this, arguments);
      setTimeout(trackPageView, 0);
      return result;
    };
    wrapped.__activityWrapped = true;
    window.history[name] = wrapped;
  });
  window.addEventListener("popstate", () => setTimeout(trackPageView, 0));
}

// ── clicks ──────────────────────────────────────────────────────────────

function labelOf(el) {
  let text =
    el.getAttribute("data-activity") || el.getAttribute("aria-label") || el.getAttribute("title");
  if (!text) {
    if (el.tagName === "INPUT") {
      // Button-like inputs show their value as the caption; for checkboxes /
      // radios use the attached <label>, never a typed value.
      if (["button", "submit", "reset"].includes(el.type)) text = el.value;
      else if (el.labels && el.labels[0]) text = el.labels[0].innerText;
    } else {
      text = el.innerText || el.textContent;
    }
  }
  if (!text) {
    const img = el.querySelector && el.querySelector("img[alt]");
    if (img) text = img.getAttribute("alt");
  }
  if (!text) {
    // Icon-only button: fall back to a short class hint.
    const cls = (el.className && typeof el.className === "string" ? el.className : "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .join(".");
    text = cls ? `<${el.tagName.toLowerCase()}.${cls}>` : `<${el.tagName.toLowerCase()}>`;
  }
  return short(mask(text), 80);
}

function linkTarget(a) {
  try {
    const url = new URL(a.getAttribute("href"), window.location.href);
    if (url.origin === window.location.origin) return url.pathname;
    return `${url.protocol}//${url.host}`;
  } catch (_) {
    return undefined;
  }
}

function onClick(ev) {
  try {
    const start = ev.target instanceof Element ? ev.target : null;
    const el = start ? start.closest(CLICKABLE) : null;
    if (!el || el.closest("[data-activity-ignore]")) return;
    const tag = el.tagName.toLowerCase();
    const label = labelOf(el);
    const key = `${tag}|${label}|${el.id || ""}`;
    const now = Date.now();
    if (lastClick.key === key && now - lastClick.at < 400) return;
    lastClick = { key, at: now };

    const data = {
      tag,
      label,
      elementId: short(el.id, 100),
      elementName: short(el.getAttribute("name"), 100),
      elementType: tag === "input" || tag === "button" ? short(el.getAttribute("type"), 30) : undefined,
      elementRole: short(el.getAttribute("role"), 30),
    };
    if (tag === "a") data.href = linkTarget(el);
    if (el.type === "checkbox" || el.type === "radio") data.checked = Boolean(el.checked);
    else if (el.getAttribute("aria-checked")) data.checked = el.getAttribute("aria-checked") === "true";
    push("CLICK", data);

    // The logout handlers clear the token straight after this click, so send
    // now while the event can still be attributed to the user.
    if (/log\s*-?\s*out|sign\s*-?\s*out/i.test(label || "")) flush(true);
  } catch (_) {
    /* ignore */
  }
}

// ── errors ──────────────────────────────────────────────────────────────

function reportError(data) {
  if (errorsThisLoad >= MAX_ERRORS_PER_PAGE_LOAD) return;
  if (seenRecently(`err|${data.kind}|${data.message}|${data.source}`, 10000)) return;
  errorsThisLoad += 1;
  push("CLIENT_ERROR", data);
  setTimeout(() => flush(false), 1000);
}

function onError(ev) {
  try {
    const t = ev.target;
    if (t && t !== window && t.tagName) {
      // Resource failed to load (capture phase). Scripts / stylesheets matter
      // (a failed chunk = blank page); images are ignored — supplier hotel
      // photos fail to load all the time.
      const tag = t.tagName.toLowerCase();
      if (tag === "script" || tag === "link") {
        reportError({ kind: "resource", message: `Failed to load ${tag}`, source: stripQuery(t.src || t.href) });
      }
      return;
    }
    reportError({
      kind: "error",
      message: short(mask(ev.message), 500),
      source: stripQuery(ev.filename),
      line: ev.lineno || undefined,
      column: ev.colno || undefined,
      stack: ev.error && ev.error.stack ? String(ev.error.stack).slice(0, 4000) : undefined,
    });
  } catch (_) {
    /* ignore */
  }
}

function onUnhandledRejection(ev) {
  try {
    const r = ev.reason;
    // Only name / message / stack — an axios error object also carries the
    // request config (headers incl. Authorization, body), which must not leave.
    const message =
      r && typeof r === "object" ? r.message || r.name || "Unhandled rejection" : String(r);
    reportError({
      kind: r && r.isAxiosError ? "unhandled-api-rejection" : "unhandledrejection",
      message: short(mask(message), 500),
      stack: r && r.stack ? String(r.stack).slice(0, 4000) : undefined,
    });
  } catch (_) {
    /* ignore */
  }
}

// ── failed API calls (axios uses XMLHttpRequest) ─────────────────────────

function apiPath(url) {
  try {
    const u = new URL(url, API_BASE || window.location.origin);
    const apiOrigin = API_BASE ? new URL(API_BASE, window.location.origin).origin : window.location.origin;
    if (u.origin !== apiOrigin && u.origin !== window.location.origin) return null; // third-party call
    return u.pathname;
  } catch (_) {
    return null;
  }
}

function recordApiError(method, url, status, reason, durationMs) {
  const path = apiPath(url);
  if (!path || path.startsWith("/api/activity-log/")) return;
  if (seenRecently(`api|${method}|${path}|${status}`, 3000)) return;
  push("API_ERROR", {
    method,
    url: path,
    status,
    reason: reason || (status === 0 ? "network" : undefined),
    durationMs,
  });
  // status 0 = the backend never saw it (offline, CORS, timeout, server down):
  // this event is the only trace, so send it promptly.
  if (status === 0) setTimeout(() => flush(false), 1000);
}

function hookXhr() {
  const Xhr = window.XMLHttpRequest;
  const proto = Xhr && Xhr.prototype;
  if (!proto || proto.__activityWrapped) return;
  const open = proto.open;
  const send = proto.send;
  proto.open = function wrappedOpen(method, url) {
    try {
      this.__activity = { method: String(method || "GET").toUpperCase(), url: String(url) };
    } catch (_) {
      /* ignore */
    }
    // Forward the ORIGINAL argument list: passing an explicit undefined for
    // the optional "async" flag would turn the request synchronous.
    // eslint-disable-next-line prefer-rest-params
    return open.apply(this, arguments);
  };
  proto.send = function wrappedSend() {
    try {
      const meta = this.__activity;
      if (meta) {
        meta.start = Date.now();
        meta.reason = null;
        this.addEventListener("timeout", () => {
          meta.reason = "timeout";
        });
        this.addEventListener("abort", () => {
          meta.reason = "abort";
        });
        this.addEventListener("error", () => {
          meta.reason = meta.reason || "network";
        });
        this.addEventListener("loadend", () => {
          try {
            if (meta.reason === "abort") return; // cancelled by the app itself
            const status = this.status;
            if (status === 0 || status >= 400) {
              recordApiError(meta.method, meta.url, status, meta.reason, Date.now() - meta.start);
            }
          } catch (_) {
            /* ignore */
          }
        });
      }
    } catch (_) {
      /* ignore */
    }
    // eslint-disable-next-line prefer-rest-params
    return send.apply(this, arguments);
  };
  proto.__activityWrapped = true;
}

// ── public API ──────────────────────────────────────────────────────────

/** Starts the logger once. Safe to call more than once (hot reload). */
export function initActivityLogger() {
  if (!ENABLED || typeof window === "undefined" || started) return;
  if (window[GLOBAL_FLAG]) return;
  window[GLOBAL_FLAG] = true;
  started = true;
  const safe = (fn) => {
    try {
      fn();
    } catch (_) {
      /* a hook that cannot install is simply skipped */
    }
  };
  safe(hookHistory);
  safe(hookXhr);
  safe(() => document.addEventListener("click", onClick, true));
  safe(() => window.addEventListener("error", onError, true));
  safe(() => window.addEventListener("unhandledrejection", onUnhandledRejection));
  safe(() =>
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush(true);
    })
  );
  safe(() => window.addEventListener("pagehide", () => flush(true)));
  safe(trackPageView);
  setInterval(() => flush(false), FLUSH_INTERVAL_MS);
}

/**
 * Explicit business event from a page, e.g.
 * logActivity("VOUCHER_DOWNLOAD", { bookingId }). Only primitive values are
 * kept; credential-looking keys are dropped.
 */
export function logActivity(name, details) {
  try {
    const clean = {};
    Object.keys(details || {})
      .slice(0, 20)
      .forEach((k) => {
        const v = details[k];
        if (SENSITIVE_KEY.test(k)) return;
        if (typeof v === "number" || typeof v === "boolean") clean[k] = v;
        else if (typeof v === "string") clean[k] = short(mask(v), 200);
      });
    push("CUSTOM", { name: short(name, 60), details: clean });
  } catch (_) {
    /* ignore */
  }
}
