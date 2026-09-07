/**
 * Persistence for promotion flyers.
 *
 * Deliberately isolated behind these six functions so the storage medium is a
 * single-file decision. Today it is localStorage, which means flyers live in
 * the browser that created them — fine for building and reviewing promotions,
 * but they are NOT shared between users or machines.
 *
 * To move them server-side, reimplement these functions against an endpoint
 * (e.g. /api/promotionFlyer) with axiosInstance; every caller already awaits
 * them, so nothing in the page has to change.
 */

const KEY = "hbs.promotionFlyers.v1";

const read = () => {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    // Corrupt or unavailable storage (private window, cleared site data) —
    // start empty rather than breaking the page.
    return [];
  }
};

const write = (list) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
};

const newId = () =>
  `pf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export async function listFlyers() {
  // Newest first, matching every other list in the app.
  return read().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export async function getFlyer(id) {
  return read().find((f) => f.id === id) || null;
}

export async function createFlyer(data) {
  const now = Date.now();
  const flyer = { ...data, id: newId(), createdAt: now, updatedAt: now };
  const list = read();
  list.push(flyer);
  if (!write(list)) throw new Error("Could not save the promotion");
  return flyer;
}

export async function updateFlyer(id, data) {
  const list = read();
  const i = list.findIndex((f) => f.id === id);
  if (i === -1) throw new Error("Promotion not found");
  // id / createdAt are never taken from the caller's payload.
  list[i] = { ...list[i], ...data, id, updatedAt: Date.now() };
  if (!write(list)) throw new Error("Could not save the promotion");
  return list[i];
}

export async function deleteFlyer(id) {
  const next = read().filter((f) => f.id !== id);
  if (!write(next)) throw new Error("Could not delete the promotion");
  return true;
}
