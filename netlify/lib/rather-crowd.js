import {
  DEFAULT_ORIGINS,
  clientIp,
  isAllowedWrite,
  isBot,
  visitorHash,
  wrapLambdaHandler,
} from "./traffic.js";

export const RATHER_STATE_KEY = "state";
export const RATHER_VOTE_LIMIT = 4000;
export const RATHER_MAX_PER_VISITOR_HOUR = 40;
export const RATHER_MIN_INTERVAL_MS = 400;
export const RATHER_SALT = "dynasty-ticker-rather-v1";
export { wrapLambdaHandler };

export function emptyRatherState() {
  return { votes: [], visitors: {} };
}

export function sanitizeRatherVote(vote) {
  const winnerId = String(vote?.winnerId || "");
  const loserId = String(vote?.loserId || "");
  if (!winnerId.startsWith("player:") || !loserId.startsWith("player:")) return null;
  if (winnerId === loserId) return null;
  if (winnerId.length > 40 || loserId.length > 40) return null;
  const at = Number(vote?.at);
  return {
    winnerId,
    loserId,
    format: String(vote?.format || "").slice(0, 80),
    at: Number.isFinite(at) && at > 0 ? at : 0,
  };
}

export function hourBucket(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const hour = String(now.getUTCHours()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}`;
}

export function normalizeRatherState(raw) {
  if (!raw || typeof raw !== "object") return emptyRatherState();
  const votes = Array.isArray(raw.votes)
    ? raw.votes.map(sanitizeRatherVote).filter(Boolean).slice(0, RATHER_VOTE_LIMIT)
    : [];
  const visitors = raw.visitors && typeof raw.visitors === "object" ? raw.visitors : {};
  return { votes, visitors };
}

export function publicRatherVotes(state) {
  const votes = Array.isArray(state?.votes) ? state.votes : [];
  return { votes, voteCount: votes.length };
}

function pruneVisitors(visitors, nowMs) {
  const keepAfter = nowMs - 2 * 24 * 60 * 60 * 1000;
  const next = {};
  for (const [hash, row] of Object.entries(visitors || {})) {
    const lastAt = Number(row?.lastAt);
    if (Number.isFinite(lastAt) && lastAt >= keepAfter) next[hash] = row;
  }
  return next;
}

export function applyRatherVote(state, { vote, visitorHash: hash, now = new Date() } = {}) {
  const cleaned = sanitizeRatherVote(vote);
  if (!cleaned) return { ok: false, error: "vote", state: normalizeRatherState(state) };

  const current = normalizeRatherState(state);
  const clock = now instanceof Date ? now.getTime() : Number(now) || Date.now();
  if (!cleaned.at) cleaned.at = clock;

  const visitors = { ...current.visitors };
  const visitor = visitors[hash] || { lastAt: 0, hourKey: "", hourCount: 0 };
  if (clock - Number(visitor.lastAt || 0) < RATHER_MIN_INTERVAL_MS) {
    return { ok: false, error: "slow", state: current };
  }
  const key = hourBucket(now instanceof Date ? now : new Date(clock));
  const hourCount = visitor.hourKey === key ? Number(visitor.hourCount || 0) + 1 : 1;
  if (hourCount > RATHER_MAX_PER_VISITOR_HOUR) {
    return { ok: false, error: "limit", state: current };
  }

  visitors[hash] = { lastAt: clock, hourKey: key, hourCount };
  return {
    ok: true,
    state: {
      votes: [cleaned, ...current.votes].slice(0, RATHER_VOTE_LIMIT),
      visitors: pruneVisitors(visitors, clock),
    },
  };
}

function jsonResponse(body, { status = 200 } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
  });
}

export function createRatherVoteHandler({
  getStore,
  nowFn = () => new Date(),
  salt = process.env.RATHER_SALT || RATHER_SALT,
  allowedOrigins = DEFAULT_ORIGINS,
} = {}) {
  return async function ratherVoteHandler(req, context = {}) {
    if (req.method === "OPTIONS") {
      return new Response("", {
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, POST, OPTIONS",
          "access-control-allow-headers": "content-type",
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

    let state = emptyRatherState();
    if (store?.get) {
      try {
        state = normalizeRatherState(await store.get(RATHER_STATE_KEY, { type: "json" }));
      } catch {
        state = emptyRatherState();
      }
    }

    if (req.method === "GET") {
      return jsonResponse(publicRatherVotes(state));
    }

    if (req.method !== "POST") {
      return jsonResponse({ error: "method" }, { status: 405 });
    }

    if (!isAllowedWrite(req, allowedOrigins)) {
      return jsonResponse({ error: "forbidden" }, { status: 403 });
    }

    const userAgent = req.headers.get("user-agent") || "";
    if (isBot(userAgent)) {
      return jsonResponse({ ok: true, skipped: "bot", ...publicRatherVotes(state) });
    }

    let payload = {};
    try {
      payload = await req.json();
    } catch {
      payload = {};
    }

    const result = applyRatherVote(state, {
      vote: payload,
      visitorHash: visitorHash(clientIp(req, context), userAgent, salt),
      now: nowFn(),
    });

    if (!result.ok) {
      const status = result.error === "limit" || result.error === "slow" ? 429 : 400;
      return jsonResponse({ error: result.error, ...publicRatherVotes(result.state) }, { status });
    }

    if (store?.setJSON) {
      try {
        await store.setJSON(RATHER_STATE_KEY, result.state);
      } catch {
        return jsonResponse({ error: "store" }, { status: 503 });
      }
    }

    return jsonResponse({ ok: true, ...publicRatherVotes(result.state) });
  };
}
