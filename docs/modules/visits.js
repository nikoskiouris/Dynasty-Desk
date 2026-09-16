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

export function shouldTrackVisit({ location = globalThis.location, storage = globalThis.localStorage } = {}) {
  return isLiveDeskHost(location) && !readVisitCounted(storage);
}

export async function recordDeskVisit({
  fetchFn = globalThis.fetch,
  location = globalThis.location,
  storage = globalThis.localStorage,
} = {}) {
  if (typeof fetchFn !== "function") return false;
  if (!shouldTrackVisit({ location, storage })) return false;
  try {
    const ping = await fetchFn(visitTrackUrl(), { method: "GET", keepalive: true });
    if (!ping?.ok) return false;
    writeVisitCounted(storage);
    return true;
  } catch {
    return false;
  }
}
