import { SITE_ORIGIN } from "./site.js";

export const RATHER_VOTE_PATH = "/api/rather-vote";

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

export async function submitRatherCrowdVote(vote, {
  fetchFn = globalThis.fetch,
  location = globalThis.location,
} = {}) {
  if (typeof fetchFn !== "function" || !isLiveRatherHost(location)) return null;
  try {
    const response = await fetchFn(ratherVoteUrl(location), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        winnerId: vote?.winnerId,
        loserId: vote?.loserId,
        format: vote?.format,
        at: vote?.at,
      }),
      keepalive: true,
    });
    if (!response?.ok) return null;
    return parseRatherCrowdVotes(await response.json());
  } catch {
    return null;
  }
}
