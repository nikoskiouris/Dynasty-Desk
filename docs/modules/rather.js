import { escapeHtml } from "./html.js";

export const RATHER_VOTES_KEY = "dynasty_desk_rather_votes";
export const RATHER_RECENT_KEY = "dynasty_desk_rather_recent";
export const RATHER_SESSION_KEY = "dynasty_desk_rather_session";
export const SLEEPER_PLAYER_THUMB_BASE = "https://sleepercdn.com/content/nfl/players/thumb/";
export const RATHER_MIN_PLAYER_VALUE = 1800;
export const RATHER_RECENT_LIMIT = 24;
export const RATHER_VOTE_LIMIT = 200;
export const RATHER_MAX_RANK_GAP = 4;
export const RATHER_DRAFT_PICKS_PATH = "./data/nfl_draft_picks.json";
const WR_DEPTH_SLOTS = new Set(["WR", "LWR", "RWR", "SWR"]);

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

export function ratherOrdinal(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "";
  const rank = Math.round(numeric);
  const mod100 = rank % 100;
  if (mod100 >= 10 && mod100 <= 20) return `${rank}th`;
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[rank % 10] || "th";
  return `${rank}${suffix}`;
}

export function playerAgeFromNfl(raw) {
  if (raw?.age == null || raw?.age === "") return null;
  const age = Number(raw.age);
  return Number.isFinite(age) && age > 0 ? age : null;
}

export function ratherDepthChartFromNfl(raw, position = "") {
  if (raw?.depth_chart_order == null || raw?.depth_chart_order === "") return "";
  const order = Number(raw.depth_chart_order);
  if (!Number.isFinite(order) || order <= 0) return "";
  const fantasy = String(position || raw?.position || raw?.fantasy_positions?.[0] || "").toUpperCase();
  const slot = String(raw?.depth_chart_position || "").toUpperCase();
  const role = WR_DEPTH_SLOTS.has(slot) ? (fantasy || "WR") : (fantasy || slot);
  return role ? `${role}${order}` : "";
}

export function isRatherRookie(raw, currentSeason) {
  const years = Number(raw?.years_exp);
  if (years === 0) return true;
  const rookieYear = Number(raw?.metadata?.rookie_year);
  const season = Number(currentSeason);
  return Number.isFinite(rookieYear) && Number.isFinite(season) && rookieYear === season;
}

export function parseRatherDraftPicks(payload) {
  if (!payload || typeof payload !== "object") return {};
  if (payload.picks && typeof payload.picks === "object") return payload.picks;
  return payload;
}

export async function fetchRatherDraftPicks(fetchImpl = globalThis.fetch) {
  try {
    const response = await fetchImpl(RATHER_DRAFT_PICKS_PATH, { cache: "no-store" });
    if (!response?.ok) return {};
    return parseRatherDraftPicks(await response.json());
  } catch {
    return {};
  }
}

export function lookupRatherDraftPick(playerId, draftPicks = {}, nflPlayer = {}) {
  const direct = draftPicks?.[String(playerId || "")];
  if (isDraftRow(direct)) return normalizeDraftRow(direct);
  const want = normalizeRatherName(nflPlayer?.full_name || `${nflPlayer?.first_name || ""} ${nflPlayer?.last_name || ""}`);
  if (!want) return null;
  const matches = Object.values(draftPicks || {}).filter((row) => (
    isDraftRow(row) && normalizeRatherName(row.name) === want
  ));
  return matches.length === 1 ? normalizeDraftRow(matches[0]) : null;
}

export function formatRatherDraftLine(draft) {
  if (!draft) return "Rookie";
  const round = ratherOrdinal(draft.round);
  const pick = Number(draft.pick);
  if (round && Number.isFinite(pick)) return `${round} round · pick ${pick}`;
  if (Number.isFinite(pick)) return `Pick ${pick}`;
  return "Rookie";
}

export function formatRatherStatNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "";
  if (Math.abs(numeric - Math.round(numeric)) < 1e-9) {
    return Math.round(numeric).toLocaleString("en-US");
  }
  return numeric.toLocaleString("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 0 });
}

export function formatRatherSeasonStats(stats, position) {
  if (!stats || typeof stats !== "object") return "";
  const played = Number(stats.gp) > 0 || Number(stats.gms_active) > 0 || Number(stats.pts_ppr) > 0;
  if (!played) return "";

  const pos = String(position || "").toUpperCase();
  const parts = [];
  if (pos === "QB") {
    pushRatherStat(parts, stats.pass_yd, "pass yds");
    pushRatherStat(parts, stats.pass_td, "TD", { keepZero: true });
    pushRatherStat(parts, stats.pass_int, "INT", { keepZero: true });
  } else if (pos === "RB") {
    pushRatherStat(parts, stats.rush_yd, "rush yds");
    pushRatherStat(parts, stats.rec, "rec");
    const touchdowns = (Number(stats.rush_td) || 0) + (Number(stats.rec_td) || 0);
    pushRatherStat(parts, touchdowns, "TD", { keepZero: true });
  } else if (pos === "WR" || pos === "TE") {
    pushRatherStat(parts, stats.rec, "rec");
    pushRatherStat(parts, stats.rec_yd, "yds");
    pushRatherStat(parts, stats.rec_td, "TD", { keepZero: true });
  } else if (pos === "K") {
    const made = Number(stats.fgm);
    const attempts = Number(stats.fga);
    if (Number.isFinite(made) && Number.isFinite(attempts)) {
      parts.push(`${formatRatherStatNumber(made)}/${formatRatherStatNumber(attempts)} FG`);
    }
  }
  if (!parts.length) {
    pushRatherStat(parts, stats.pts_ppr, "PPR pts");
  }
  return parts.join(" · ");
}

export function formatRatherPlayerMeta({ position, team, age, depthChart } = {}) {
  const numericAge = Number(age);
  const ageLabel = age != null && age !== "" && Number.isFinite(numericAge) && numericAge > 0
    ? `${numericAge}y`
    : "";
  return [position, team, ageLabel, depthChart].filter(Boolean).join(" · ");
}

export function formatRatherPlayerDetail({
  isRookie = false,
  draft = null,
  stats = null,
  position = "",
  previousSeason = "",
} = {}) {
  if (isRookie) return formatRatherDraftLine(draft);
  const line = formatRatherSeasonStats(stats, position);
  if (line) return previousSeason ? `${previousSeason} · ${line}` : line;
  return previousSeason ? `No ${previousSeason} stats` : "";
}

export function decorateRatherPlayer(player, nflPlayers = {}, extras = {}) {
  const raw = nflPlayers?.[player?.playerId] || {};
  const position = String(raw.position || raw.fantasy_positions?.[0] || "").toUpperCase();
  const team = String(raw.team || "").toUpperCase();
  const age = playerAgeFromNfl(raw);
  const depthChart = ratherDepthChartFromNfl(raw, position);
  const isRookie = isRatherRookie(raw, extras.currentSeason);
  const draft = lookupRatherDraftPick(player?.playerId, extras.draftPicks, raw);
  const stats = extras.seasonStats?.[player?.playerId] || extras.seasonStats?.[String(player?.playerId)] || null;
  return {
    assetId: player.assetId,
    playerId: player.playerId,
    name: player.name,
    value: player.value,
    position,
    team,
    age,
    depthChart,
    isRookie,
    photoUrl: sleeperPlayerThumbUrl(player.playerId),
    initials: playerInitials(player.name),
    meta: formatRatherPlayerMeta({ position, team, age, depthChart }),
    detail: formatRatherPlayerDetail({
      isRookie,
      draft,
      stats,
      position,
      previousSeason: extras.previousSeason,
    }),
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
    : "";
  const detail = player?.detail
    ? `<small class="rather-stats">${escapeHtml(player.detail)}</small>`
    : "";
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
      ${detail}
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

function isDraftRow(row) {
  return Number.isFinite(Number(row?.round)) && Number.isFinite(Number(row?.pick));
}

function normalizeDraftRow(row) {
  return {
    year: Number(row.year) || null,
    round: Number(row.round),
    pick: Number(row.pick),
    name: String(row.name || ""),
  };
}

function normalizeRatherName(name) {
  return String(name || "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9\s]/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function pushRatherStat(parts, value, label, { keepZero = false } = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return;
  if (numeric === 0 && !keepZero) return;
  parts.push(`${formatRatherStatNumber(numeric)} ${label}`);
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
