import { SITE_ORIGIN } from "./site.js";

export const RATHER_VOTE_PATH = "/api/rather-vote";
export const RATHER_SUBMIT_RETRIES = 2;

function canonicalHost(hostname) {
  return String(hostname || "").trim().toLowerCase().replace(/^www\./, "");
}

export function ratherSiteHost() {
  try {
    return canonicalHost(new URL(SITE_ORIGIN).hostname);
  } catch {
    return "dynastyticker.com";
  }
}

export function isLiveRatherHost(location = globalThis.location) {
  return canonicalHost(location?.hostname) === ratherSiteHost();
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

export function ratherVoteUrl(location = globalThis.location) {
  return `${originFrom(location)}${RATHER_VOTE_PATH}`;
}

export function parseRatherCrowdVotes(payload) {
  const rows = Array.isArray(payload?.votes) ? payload.votes : [];
  return rows
    .map((vote) => ({
      eventId: String(vote?.eventId || ""),
      winnerId: String(vote?.winnerId || ""),
      loserId: String(vote?.loserId || ""),
      format: String(vote?.format || ""),
      at: Number(vote?.at) || 0,
    }))
    .filter((vote) => vote.winnerId.startsWith("player:") && vote.loserId.startsWith("player:") && vote.winnerId !== vote.loserId);
}

export async function fetchRatherCrowdVotes({
  fetchFn = globalThis.fetch,
  location = globalThis.location,
} = {}) {
  if (typeof fetchFn !== "function" || !isLiveRatherHost(location)) return null;
  try {
    const response = await fetchFn(ratherVoteUrl(location), { cache: "no-store" });
    if (!response?.ok) return null;
    return parseRatherCrowdVotes(await response.json());
  } catch {
    return null;
  }
}

function createEventId() {
  try {
    if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  } catch {
    // Fall through to a collision-resistant browser-safe fallback.
  }
  return `vote_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

export async function submitRatherCrowdVote(vote, {
  fetchFn = globalThis.fetch,
  location = globalThis.location,
} = {}) {
  if (typeof fetchFn !== "function" || !isLiveRatherHost(location)) return null;
  const eventId = String(vote?.eventId || "").trim() || createEventId();
  const body = JSON.stringify({
    eventId,
    winnerId: vote?.winnerId,
    loserId: vote?.loserId,
    format: vote?.format,
  });

  for (let attempt = 0; attempt <= RATHER_SUBMIT_RETRIES; attempt += 1) {
    try {
      const response = await fetchFn(ratherVoteUrl(location), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        keepalive: true,
      });
      const payload = await response.json().catch(() => null);
      if (response?.ok && payload?.saved === true) return parseRatherCrowdVotes(payload);
      if (response?.status !== 503 || payload?.retryable !== true) return null;
    } catch {
      if (attempt >= RATHER_SUBMIT_RETRIES) return null;
    }
  }
  return null;
}
