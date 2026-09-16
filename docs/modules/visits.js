import { formatNumber } from "./html.js";
import { SITE_ORIGIN, SITE_PATH } from "./site.js";

export const VISIT_COUNTED_KEY = "dynasty_desk_visit_counted";
export const VISIT_API_BASE = "https://page-views-api.ratneshc.com/api/v1";
export const VISIT_SITE = "nikoskiouris.github.io";
export const VISIT_PATH = String(SITE_PATH || "/").replace(/\/+$/, "") || "/";

export function visitSiteHost() {
  try {
    return new URL(SITE_ORIGIN).hostname;
  } catch {
    return VISIT_SITE;
  }
}

export function isLiveDeskHost(location = globalThis.location) {
  return location?.hostname === visitSiteHost();
}

export function visitTrackUrl() {
  return `${VISIT_API_BASE}/track?site=${encodeURIComponent(VISIT_SITE)}&path=${encodeURIComponent(VISIT_PATH)}`;
}

export function visitCountUrl() {
  return `${VISIT_API_BASE}/views?site=${encodeURIComponent(VISIT_SITE)}&path=${encodeURIComponent(VISIT_PATH)}`;
}

export function readVisitCounted(storage = globalThis.localStorage) {
  try {
    return storage?.getItem(VISIT_COUNTED_KEY) === "1";
  } catch {
    return true;
  }
}

export function writeVisitCounted(storage = globalThis.localStorage) {
  try {
    storage?.setItem(VISIT_COUNTED_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

export function parseVisitCount(payload) {
  const value = Number(payload?.views);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.floor(value);
}

export function renderVisitCountMarkup(count) {
  if (count == null) return "";
  const digits = formatNumber(count);
  if (count === 1) return `<strong>${digits}</strong> person has viewed this desk`;
  return `<strong>${digits}</strong> people have viewed this desk`;
}

export function applyVisitCount(node, count) {
  if (!node) return;
  if (count == null) {
    node.hidden = true;
    node.innerHTML = "";
    return;
  }
  node.hidden = false;
  node.innerHTML = renderVisitCountMarkup(count);
}

export function shouldTrackVisit({ location = globalThis.location, storage = globalThis.localStorage } = {}) {
  return isLiveDeskHost(location) && !readVisitCounted(storage);
}

export async function loadDeskVisits({
  fetchFn = globalThis.fetch,
  location = globalThis.location,
  storage = globalThis.localStorage,
} = {}) {
  if (typeof fetchFn !== "function") return null;
  if (shouldTrackVisit({ location, storage })) {
    try {
      const ping = await fetchFn(visitTrackUrl(), { method: "GET", keepalive: true });
      if (ping?.ok) writeVisitCounted(storage);
    } catch {
      // Still try to read the public total.
    }
  }
  try {
    const response = await fetchFn(visitCountUrl());
    if (!response?.ok) return null;
    return parseVisitCount(await response.json());
  } catch {
    return null;
  }
}
