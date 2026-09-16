import { SITE_ORIGIN } from "./site.js";

export const VISIT_TRACK_PATH = "/api/visit";
export const VISIT_COUNT_PATH = "/api/views";
export const TRAFFIC_LINES = [
  ["today", "views"],
  ["today", "people"],
  ["week", "views"],
  ["week", "people"],
  ["year", "views"],
  ["year", "people"],
  ["all", "views"],
  ["all", "people"],
];

function canonicalHost(hostname) {
  return String(hostname || "").trim().toLowerCase().replace(/^www\./, "");
}

export function visitSiteHost() {
  try {
    return canonicalHost(new URL(SITE_ORIGIN).hostname);
  } catch {
    return "dynastyticker.com";
  }
}

export function isLiveDeskHost(location = globalThis.location) {
  return canonicalHost(location?.hostname) === visitSiteHost();
}

export function isSecretNumbersPath(location = globalThis.location) {
  return /\/secret-numbers\/?$/.test(String(location?.pathname || ""));
}

function originFrom(location) {
  if (location?.origin) return String(location.origin).replace(/\/+$/, "");
  const host = location?.hostname;
  if (host) {
    const protocol = location.protocol
      || (host === "localhost" || host === "127.0.0.1" ? "http:" : "https:");
    return `${protocol}//${host}`;
  }
  return SITE_ORIGIN;
}

export function visitTrackUrl(location = globalThis.location) {
  return `${originFrom(location)}${VISIT_TRACK_PATH}`;
}

export function visitCountUrl(location = globalThis.location) {
  return `${originFrom(location)}${VISIT_COUNT_PATH}`;
}

export function shouldTrackVisit({
  location = globalThis.location,
} = {}) {
  return isLiveDeskHost(location) && !isSecretNumbersPath(location);
}

function asCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.floor(number);
}

export function parseTrafficCounts(payload) {
  return TRAFFIC_LINES.map(([period, metric]) => asCount(payload?.[period]?.[metric]));
}

export async function recordDeskVisit({
  fetchFn = globalThis.fetch,
  location = globalThis.location,
} = {}) {
  if (typeof fetchFn !== "function") return false;
  if (!shouldTrackVisit({ location })) return false;
  try {
    const ping = await fetchFn(visitTrackUrl(location), {
      method: "POST",
      keepalive: true,
    });
    return Boolean(ping?.ok);
  } catch {
    return false;
  }
}

function raceTimeout(promise, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function loadSecretNumbers({
  fetchFn = globalThis.fetch,
  location = globalThis.location,
  timeoutMs = 5000,
} = {}) {
  if (typeof fetchFn !== "function") return parseTrafficCounts(null);
  try {
    const response = await raceTimeout(fetchFn(visitCountUrl(location)), Math.max(0, Number(timeoutMs) || 0));
    if (!response?.ok) return parseTrafficCounts(null);
    return parseTrafficCounts(await response.json());
  } catch {
    return parseTrafficCounts(null);
  }
}

export function renderSecretNumbers(numbers) {
  const list = Array.isArray(numbers) ? numbers : [];
  return TRAFFIC_LINES.map((_, index) => String(asCount(list[index]))).join("\n");
}
