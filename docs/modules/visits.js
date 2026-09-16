import { SITE_ORIGIN, SITE_PATH } from "./site.js";

export const VISIT_COUNTED_KEY = "dynasty_desk_visit_counted";
export const VISIT_DAY_KEY = "dynasty_desk_visit_day";
export const VISIT_WEEK_KEY = "dynasty_desk_visit_week";
export const VISIT_YEAR_KEY = "dynasty_desk_visit_year";
export const VISIT_API_BASE = "https://page-views-api.ratneshc.com/api/v1";
export const VISIT_SITE = "nikoskiouris.github.io";
export const VISIT_PATH = String(SITE_PATH || "/").replace(/\/+$/, "") || "/";
export const VISIT_KINDS = ["today", "week", "year", "all"];

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

function pad2(value) {
  return String(value).padStart(2, "0");
}

export function visitPeriodKeys(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = pad2(now.getUTCMonth() + 1);
  const day = pad2(now.getUTCDate());
  const iso = utcIsoWeek(now);
  return {
    day: `${year}-${month}-${day}`,
    week: `${iso.year}-W${pad2(iso.week)}`,
    year: String(year),
  };
}

export function utcIsoWeek(now = new Date()) {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - weekday);
  const weekYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(weekYear, 0, 1));
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return { year: weekYear, week };
}

export function visitPathFor(kind, periods = visitPeriodKeys()) {
  if (kind === "today") return `${VISIT_PATH}/d/${periods.day}`;
  if (kind === "week") return `${VISIT_PATH}/w/${periods.week}`;
  if (kind === "year") return `${VISIT_PATH}/y/${periods.year}`;
  return VISIT_PATH;
}

export function visitTrackUrlFor(path) {
  return `${VISIT_API_BASE}/track?site=${encodeURIComponent(VISIT_SITE)}&path=${encodeURIComponent(path)}`;
}

export function visitCountUrlFor(path) {
  return `${VISIT_API_BASE}/views?site=${encodeURIComponent(VISIT_SITE)}&path=${encodeURIComponent(path)}`;
}

export function visitTrackUrl(now = new Date()) {
  return visitTrackUrlFor(visitPathFor("all", visitPeriodKeys(now)));
}

export function visitCountUrl(now = new Date()) {
  return visitCountUrlFor(visitPathFor("all", visitPeriodKeys(now)));
}

function storageGet(storage, key) {
  try {
    return storage?.getItem(key);
  } catch {
    return "__blocked__";
  }
}

function storageSet(storage, key, value) {
  try {
    storage?.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function readVisitCounted(storage = globalThis.localStorage) {
  return storageGet(storage, VISIT_COUNTED_KEY) === "1";
}

export function writeVisitCounted(storage = globalThis.localStorage) {
  return storageSet(storage, VISIT_COUNTED_KEY, "1");
}

export function pendingVisitKinds({
  storage = globalThis.localStorage,
  now = new Date(),
} = {}) {
  if (storageGet(storage, VISIT_COUNTED_KEY) === "__blocked__") return [];
  const periods = visitPeriodKeys(now);
  const pending = [];
  if (storageGet(storage, VISIT_DAY_KEY) !== periods.day) pending.push("today");
  if (storageGet(storage, VISIT_WEEK_KEY) !== periods.week) pending.push("week");
  if (storageGet(storage, VISIT_YEAR_KEY) !== periods.year) pending.push("year");
  if (storageGet(storage, VISIT_COUNTED_KEY) !== "1") pending.push("all");
  return pending;
}

export function shouldTrackVisit({
  location = globalThis.location,
  storage = globalThis.localStorage,
  now = new Date(),
} = {}) {
  return isLiveDeskHost(location) && pendingVisitKinds({ storage, now }).length > 0;
}

function writeVisitKind(storage, kind, periods) {
  if (kind === "today") return storageSet(storage, VISIT_DAY_KEY, periods.day);
  if (kind === "week") return storageSet(storage, VISIT_WEEK_KEY, periods.week);
  if (kind === "year") return storageSet(storage, VISIT_YEAR_KEY, periods.year);
  return storageSet(storage, VISIT_COUNTED_KEY, "1");
}

export async function recordDeskVisit({
  fetchFn = globalThis.fetch,
  location = globalThis.location,
  storage = globalThis.localStorage,
  now = new Date(),
} = {}) {
  if (typeof fetchFn !== "function") return false;
  if (!isLiveDeskHost(location)) return false;
  const periods = visitPeriodKeys(now);
  const kinds = pendingVisitKinds({ storage, now });
  if (!kinds.length) return false;
  let recorded = false;
  for (const kind of kinds) {
    try {
      const ping = await fetchFn(visitTrackUrlFor(visitPathFor(kind, periods)), {
        method: "GET",
        keepalive: true,
      });
      if (!ping?.ok) continue;
      writeVisitKind(storage, kind, periods);
      recorded = true;
    } catch {
      // Retry this period on a later load.
    }
  }
  return recorded;
}

export function parseVisitCount(payload) {
  const value = Number(payload?.views);
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
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

async function fetchVisitCount(fetchFn, path, timeoutMs) {
  try {
    const response = await raceTimeout(fetchFn(visitCountUrlFor(path)), timeoutMs);
    if (!response?.ok) return 0;
    return parseVisitCount(await response.json());
  } catch {
    return 0;
  }
}

export async function loadSecretNumbers({
  fetchFn = globalThis.fetch,
  now = new Date(),
  timeoutMs = 5000,
} = {}) {
  if (typeof fetchFn !== "function") return [0, 0, 0, 0];
  const wait = Math.max(0, Number(timeoutMs) || 0);
  const periods = visitPeriodKeys(now);
  return Promise.all(
    VISIT_KINDS.map((kind) => fetchVisitCount(fetchFn, visitPathFor(kind, periods), wait)),
  );
}

export function renderSecretNumbers(numbers) {
  const list = Array.isArray(numbers) ? numbers : [];
  return [0, 1, 2, 3].map((index) => String(Number(list[index]) || 0)).join("\n");
}
