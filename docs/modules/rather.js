import { escapeHtml } from "./html.js";

export const RATHER_VOTES_KEY = "dynasty_desk_rather_votes";
export const RATHER_RECENT_KEY = "dynasty_desk_rather_recent";
export const RATHER_SESSION_KEY = "dynasty_desk_rather_session";
export const SLEEPER_PLAYER_THUMB_BASE = "https://sleepercdn.com/content/nfl/players/thumb/";
export const RATHER_MIN_PLAYER_VALUE = 1800;
export const RATHER_RECENT_LIMIT = 24;
export const RATHER_VOTE_LIMIT = 200;
export const RATHER_MAX_RANK_GAP = 4;

export const DEFAULT_RATHER_FORMAT = Object.freeze({
  scoring: "PPR",
  teams: 12,
  qb: "Superflex",
  type: "Dynasty",
});

export function formatRatherHeadline() {
  return "Who would you rather have?";
}

export function formatRatherDetail(format = DEFAULT_RATHER_FORMAT) {
  const scoring = String(format?.scoring || DEFAULT_RATHER_FORMAT.scoring);
  const teams = Number(format?.teams || DEFAULT_RATHER_FORMAT.teams);
  const qb = String(format?.qb || DEFAULT_RATHER_FORMAT.qb);
  return `${scoring} ${teams}-man ${qb}`;
}

export function formatRatherDetailLong(format = DEFAULT_RATHER_FORMAT) {
  const scoring = String(format?.scoring || DEFAULT_RATHER_FORMAT.scoring);
  const teams = Number(format?.teams || DEFAULT_RATHER_FORMAT.teams);
  const qb = String(format?.qb || DEFAULT_RATHER_FORMAT.qb);
  const type = String(format?.type || DEFAULT_RATHER_FORMAT.type);
  return `${type} rankings · full ${scoring} scoring · ${teams}-man league · ${qb} QB`;
}

export function playerIdFromAssetId(assetId) {
  const value = String(assetId || "");
  return value.startsWith("player:") ? value.slice("player:".length) : "";
}

export function sleeperPlayerThumbUrl(playerId) {
  const id = String(playerId || "").trim();
  return id ? `${SLEEPER_PLAYER_THUMB_BASE}${encodeURIComponent(id)}.jpg` : "";
}

export function playerInitials(name) {
  const parts = String(name || "")
    .replaceAll(/['’.]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
}

export function pairKey(leftId, rightId) {
  return [String(leftId || ""), String(rightId || "")].sort().join("|");
}

export function listRatherPlayers(values, names, { minValue = RATHER_MIN_PLAYER_VALUE } = {}) {
  const rows = [];
  for (const [assetId, rawValue] of Object.entries(values || {})) {
    if (!String(assetId).startsWith("player:")) continue;
    const value = Number(rawValue);
    const name = String(names?.[assetId] || "").trim();
    const playerId = playerIdFromAssetId(assetId);
    if (!name || !playerId || !Number.isFinite(value) || value < minValue) continue;
    rows.push({ assetId, playerId, name, value });
  }
  return rows.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
}

export function pickRatherPair(players, { recentKeys = [], random = Math.random } = {}) {
  const ranked = Array.isArray(players) ? players.filter((row) => row?.assetId && row?.name) : [];
  if (ranked.length < 2) return null;

  const recent = new Set((recentKeys || []).map(String));
  const options = [];
  for (let index = 0; index < ranked.length - 1; index += 1) {
    for (let gap = 1; gap <= RATHER_MAX_RANK_GAP && index + gap < ranked.length; gap += 1) {
      const left = ranked[index];
      const right = ranked[index + gap];
      if (left.assetId === right.assetId) continue;
      const key = pairKey(left.assetId, right.assetId);
      if (recent.has(key)) continue;
      options.push({ left, right, key });
    }
  }

  const pool = options.length
    ? options
    : [{ left: ranked[0], right: ranked[1], key: pairKey(ranked[0].assetId, ranked[1].assetId) }];
  const roll = clampUnit(random());
  const picked = pool[Math.min(pool.length - 1, Math.floor(roll * pool.length))];
  if (clampUnit(random()) < 0.5) {
    return { left: picked.right, right: picked.left, key: picked.key };
  }
  return picked;
}

export function decorateRatherPlayer(player, nflPlayers = {}) {
  const raw = nflPlayers?.[player?.playerId] || {};
  const position = String(raw.position || raw.fantasy_positions?.[0] || "").toUpperCase();
  const team = String(raw.team || "").toUpperCase();
  return {
    assetId: player.assetId,
    playerId: player.playerId,
    name: player.name,
    value: player.value,
    position,
    team,
    photoUrl: sleeperPlayerThumbUrl(player.playerId),
    initials: playerInitials(player.name),
    meta: [position, team].filter(Boolean).join(" · "),
  };
}

export function renderRatherMarkup(pair, format = DEFAULT_RATHER_FORMAT) {
  const left = pair?.left || {};
  const right = pair?.right || {};
  return `
    <div class="rather-panel">
      <span class="eyebrow">Desk Crowd</span>
      <h2 id="rather-title">${escapeHtml(formatRatherHeadline())}</h2>
      <p class="rather-format" id="rather-format">${escapeHtml(formatRatherDetail(format))}</p>
      <p class="rather-format-detail" id="rather-format-detail">${escapeHtml(formatRatherDetailLong(format))}</p>
      <div class="rather-duel">
        ${renderRatherPlayerButton(left, "left")}
        <span class="rather-or" aria-hidden="true">or</span>
        ${renderRatherPlayerButton(right, "right")}
      </div>
      <button type="button" class="rather-skip ghost-btn" id="rather-skip">Skip for now</button>
    </div>
  `;
}

export function applyRatherOverlayHidden(overlay, hidden) {
  if (!overlay) return;
  const hide = Boolean(hidden);
  overlay.hidden = hide;
  overlay.classList?.toggle?.("hidden", hide);
}

function renderRatherPlayerButton(player, side) {
  const name = player?.name || "Player";
  const initials = player?.initials || playerInitials(name);
  const photo = player?.photoUrl
    ? `<img class="rather-photo" src="${escapeHtml(player.photoUrl)}" alt="" width="96" height="96" data-initials="${escapeHtml(initials)}">`
    : "";
  const meta = player?.meta
    ? `<small class="rather-meta">${escapeHtml(player.meta)}</small>`
    : `<small class="rather-meta rather-meta-empty">Dynasty asset</small>`;
  return `
    <button
      type="button"
      class="rather-player"
      data-rather-pick="${escapeHtml(player?.assetId || "")}"
      data-rather-side="${escapeHtml(side)}"
    >
      <span class="rather-headshot" aria-hidden="true">
        ${photo}
        <span class="rather-initials">${escapeHtml(initials)}</span>
      </span>
      <strong>${escapeHtml(name)}</strong>
      ${meta}
    </button>
  `;
}

export function readRatherSessionDone(storage = globalThis.sessionStorage) {
  try {
    return storage?.getItem(RATHER_SESSION_KEY) === "1";
  } catch {
    return true;
  }
}

export function writeRatherSessionDone(storage = globalThis.sessionStorage) {
  try {
    storage?.setItem(RATHER_SESSION_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

export function readRatherRecentKeys(storage = globalThis.localStorage) {
  const parsed = readJson(storage, RATHER_RECENT_KEY);
  return Array.isArray(parsed) ? parsed.map(String) : [];
}

export function pushRatherRecentKey(key, storage = globalThis.localStorage, limit = RATHER_RECENT_LIMIT) {
  const next = [String(key), ...readRatherRecentKeys(storage).filter((item) => item !== String(key))]
    .slice(0, limit);
  writeJson(storage, RATHER_RECENT_KEY, next);
  return next;
}

export function readRatherVotes(storage = globalThis.localStorage) {
  const parsed = readJson(storage, RATHER_VOTES_KEY);
  return Array.isArray(parsed) ? parsed : [];
}

export function recordRatherVote(vote, storage = globalThis.localStorage, limit = RATHER_VOTE_LIMIT) {
  const winnerId = String(vote?.winnerId || "");
  const loserId = String(vote?.loserId || "");
  if (!winnerId || !loserId || winnerId === loserId) return readRatherVotes(storage);
  const entry = {
    winnerId,
    loserId,
    format: formatRatherDetail(vote?.format || DEFAULT_RATHER_FORMAT),
    at: Number(vote?.at) || Date.now(),
  };
  const next = [entry, ...readRatherVotes(storage)].slice(0, limit);
  writeJson(storage, RATHER_VOTES_KEY, next);
  return next;
}

function clampUnit(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(1, Math.max(0, numeric));
}

function readJson(storage, key) {
  try {
    const raw = storage?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(storage, key, value) {
  try {
    storage?.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
