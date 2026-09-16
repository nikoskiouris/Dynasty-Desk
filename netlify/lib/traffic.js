import { createHash } from "node:crypto";

export const DEFAULT_SALT = "dynasty-desk-traffic-v1";
export const DEFAULT_ORIGINS = Object.freeze([
  "https://dynastyticker.com",
  "https://www.dynastyticker.com",
]);
export const STATE_KEY = "state";
export const TRAFFIC_PERIODS = Object.freeze(["today", "week", "year", "all"]);
export const TRAFFIC_LINES = Object.freeze([
  ["today", "views"],
  ["today", "people"],
  ["week", "views"],
  ["week", "people"],
  ["year", "views"],
  ["year", "people"],
  ["all", "views"],
  ["all", "people"],
]);

const BOT_RE = /(bot|crawler|spider|crawling|prerender|lighthouse|pagespeed|headless|pingdom|uptimerobot|facebookexternalhit|slackbot|twitterbot|linkedinbot|whatsapp|telegrambot|discordbot|google-inspection|preview|curl\/|python-urllib|go-http-client)/i;
const KEEP_DAYS = 40;

function pad2(value) {
  return String(value).padStart(2, "0");
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

export function visitorHash(ip, userAgent, salt = DEFAULT_SALT) {
  return createHash("sha256")
    .update(`${salt}\n${String(ip || "").trim()}\n${String(userAgent || "").trim()}`)
    .digest("hex")
    .slice(0, 32);
}

export function isBot(userAgent) {
  return BOT_RE.test(String(userAgent || ""));
}

export function emptyBucket() {
  return { views: 0, people: 0, seen: {} };
}

export function emptyState() {
  return {
    all: emptyBucket(),
    days: {},
    weeks: {},
    years: {},
  };
}

function asCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.floor(number);
}

function asSeen(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return { ...value };
}

function asBucket(value) {
  if (!value || typeof value !== "object") return emptyBucket();
  return {
    views: asCount(value.views),
    people: asCount(value.people),
    seen: asSeen(value.seen),
  };
}

function asBucketMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out = {};
  for (const [key, bucket] of Object.entries(value)) {
    out[key] = asBucket(bucket);
  }
  return out;
}

export function normalizeState(raw) {
  if (!raw || typeof raw !== "object") return emptyState();
  return {
    all: asBucket(raw.all),
    days: asBucketMap(raw.days),
    weeks: asBucketMap(raw.weeks),
    years: asBucketMap(raw.years),
  };
}

function pickCounts(bucket) {
  return { views: asCount(bucket?.views), people: asCount(bucket?.people) };
}

export function summarize(state, now = new Date()) {
  const periods = visitPeriodKeys(now);
  const current = normalizeState(state);
  return {
    today: pickCounts(current.days[periods.day]),
    week: pickCounts(current.weeks[periods.week]),
    year: pickCounts(current.years[periods.year]),
    all: pickCounts(current.all),
  };
}

export function flattenTrafficCounts(summary) {
  return TRAFFIC_LINES.map(([period, metric]) => asCount(summary?.[period]?.[metric]));
}

function pruneMap(map, keepKey, maxKeys) {
  const keys = Object.keys(map).sort();
  for (const key of keys) {
    if (key !== keepKey) delete map[key].seen;
  }
  if (keys.length <= maxKeys) return;
  for (const key of keys.slice(0, keys.length - maxKeys)) {
    delete map[key];
  }
}

export function pruneState(state, now = new Date()) {
  const current = normalizeState(state);
  const periods = visitPeriodKeys(now);
  pruneMap(current.days, periods.day, KEEP_DAYS);
  pruneMap(current.weeks, periods.week, 12);
  pruneMap(current.years, periods.year, 3);
  return current;
}

function bump(bucket, hash) {
  bucket.views += 1;
  if (!bucket.seen[hash]) {
    bucket.seen[hash] = 1;
    bucket.people += 1;
  }
}

export function applyVisit(state, { hash, now = new Date() } = {}) {
  const current = pruneState(state, now);
  const id = String(hash || "").trim();
  if (!id) return current;
  const periods = visitPeriodKeys(now);
  if (!current.days[periods.day]) current.days[periods.day] = emptyBucket();
  if (!current.weeks[periods.week]) current.weeks[periods.week] = emptyBucket();
  if (!current.years[periods.year]) current.years[periods.year] = emptyBucket();
  bump(current.all, id);
  bump(current.days[periods.day], id);
  bump(current.weeks[periods.week], id);
  bump(current.years[periods.year], id);
  return current;
}

export function originOf(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw).origin;
  } catch {
    return raw.replace(/\/+$/, "");
  }
}

export function isAllowedWrite(req, allowedOrigins = DEFAULT_ORIGINS) {
  const allowed = new Set(allowedOrigins);
  const origin = originOf(req?.headers?.get?.("origin"));
  if (origin && allowed.has(origin)) return true;
  const referer = originOf(req?.headers?.get?.("referer"));
  return Boolean(referer && allowed.has(referer));
}

export function clientIp(req, context = {}) {
  if (context?.ip) return String(context.ip).trim();
  const headers = req?.headers;
  const forwarded = headers?.get?.("x-nf-client-connection-ip")
    || headers?.get?.("x-forwarded-for")
    || "";
  return String(forwarded).split(",")[0].trim();
}

function jsonResponse(body, { status = 200, cors = false } = {}) {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  };
  if (cors) headers["access-control-allow-origin"] = "*";
  return new Response(JSON.stringify(body), { status, headers });
}

export function lambdaEventToRequest(event) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(event?.headers || {})) {
    if (value == null) continue;
    headers.set(key, String(value));
  }
  const host = headers.get("host") || "dynastyticker.com";
  const proto = headers.get("x-forwarded-proto") || "https";
  const path = event?.path || "/";
  const query = event?.rawQuery
    || new URLSearchParams(event?.queryStringParameters || {}).toString();
  const url = `${proto}://${host}${path}${query ? `?${query}` : ""}`;
  return new Request(url, { method: event?.httpMethod || "GET", headers });
}

export function lambdaIp(event, context = {}) {
  if (context?.ip) return String(context.ip).trim();
  const headers = event?.headers || {};
  const forwarded = headers["x-nf-client-connection-ip"]
    || headers["X-Nf-Client-Connection-Ip"]
    || headers["x-forwarded-for"]
    || headers["X-Forwarded-For"]
    || "";
  return String(forwarded).split(",")[0].trim();
}

export function wrapLambdaHandler(visitHandler) {
  return async function handler(event, context = {}) {
    const response = await visitHandler(lambdaEventToRequest(event), {
      ip: lambdaIp(event, context),
    });
    const body = await response.text();
    const headers = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return { statusCode: response.status, headers, body };
  };
}

export function createVisitHandler({
  getStore,
  nowFn = () => new Date(),
  salt = process.env.VISIT_SALT || DEFAULT_SALT,
  allowedOrigins = DEFAULT_ORIGINS,
} = {}) {
  return async function visitHandler(req, context = {}) {
    if (req.method === "OPTIONS") {
      return new Response("", {
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, POST, OPTIONS",
          "access-control-max-age": "86400",
        },
      });
    }

    let store = null;
    try {
      store = typeof getStore === "function" ? getStore() : null;
    } catch {
      store = null;
    }

    let state = emptyState();
    if (store?.get) {
      try {
        state = normalizeState(await store.get(STATE_KEY, { type: "json" }));
      } catch {
        state = emptyState();
      }
    }

    const now = nowFn();
    if (req.method === "GET") {
      return jsonResponse(summarize(state, now), { cors: true });
    }

    if (req.method !== "POST") {
      return jsonResponse({ error: "method" }, { status: 405 });
    }

    if (!isAllowedWrite(req, allowedOrigins)) {
      return jsonResponse({ error: "forbidden" }, { status: 403 });
    }

    const userAgent = req.headers.get("user-agent") || "";
    if (isBot(userAgent)) {
      return jsonResponse({ ok: true, skipped: "bot" });
    }

    const next = applyVisit(state, {
      hash: visitorHash(clientIp(req, context), userAgent, salt),
      now,
    });

    if (store?.setJSON) {
      try {
        await store.setJSON(STATE_KEY, next);
      } catch {
        return jsonResponse({ error: "store" }, { status: 503 });
      }
    }

    return jsonResponse({ ok: true });
  };
}
