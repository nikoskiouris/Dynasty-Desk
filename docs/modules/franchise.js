export function isRealUserId(userId) {
  const id = String(userId ?? "").trim();
  return Boolean(id) && id !== "unknown" && id !== "null" && id !== "undefined";
}

export function placeholderRosterName(rosterId) {
  const id = String(rosterId ?? "").trim() || "?";
  return `Roster ${id}`;
}

export function isPlaceholderRosterName(name) {
  return /^(roster|team)\s+\S+/i.test(String(name || "").trim());
}

export function personManagerKey(userId, leagueId, rosterId) {
  if (isRealUserId(userId)) return `user:${String(userId).trim()}`;
  return `roster:${String(leagueId || "league")}:${String(rosterId || "unknown")}`;
}

export function ownerIdFromRoster(roster) {
  if (isRealUserId(roster?.owner_id)) return String(roster.owner_id).trim();
  const coOwners = Array.isArray(roster?.co_owners) ? roster.co_owners : [];
  const coOwner = coOwners.map((id) => String(id ?? "").trim()).find(isRealUserId);
  return coOwner || "";
}

function displayNameForUser(user, fallback) {
  if (!user) return fallback;
  return user.display_name || user.username || fallback;
}

function userNameById(users = []) {
  const map = new Map();
  (Array.isArray(users) ? users : []).forEach((user) => {
    const id = String(user?.user_id || "").trim();
    if (!id) return;
    const name = displayNameForUser(user, "");
    if (!name || isPlaceholderRosterName(name)) return;
    if (!map.has(id)) map.set(id, name);
  });
  return map;
}

function slotKey(leagueId, rosterId) {
  return `${String(leagueId || "")}:${String(rosterId || "")}`;
}

function seasonSortValue(row) {
  const season = Number(row?.season);
  if (Number.isFinite(season) && season > 0) return season;
  return row?.isCurrent ? 9999 : 0;
}

function collectRosterSlots({ historyEntries = [], currentRosters = [], currentLeagueId = "" } = {}) {
  const byRoster = new Map();
  const push = (rosterId, season, leagueId, ownerId, isCurrent) => {
    const id = String(rosterId ?? "").trim();
    if (!id) return;
    if (!byRoster.has(id)) byRoster.set(id, []);
    const leagueKey = String(leagueId || "");
    const already = byRoster.get(id).some((row) => row.leagueId === leagueKey && leagueKey);
    if (already) return;
    byRoster.get(id).push({
      rosterId: id,
      season: String(season || ""),
      leagueId: leagueKey,
      ownerId: isRealUserId(ownerId) ? String(ownerId).trim() : "",
      isCurrent: Boolean(isCurrent),
    });
  };

  (Array.isArray(historyEntries) ? historyEntries : []).forEach((entry) => {
    (entry?.rosters || []).forEach((roster) => {
      push(
        roster?.roster_id,
        entry.season || entry.league?.season,
        entry.leagueId,
        ownerIdFromRoster(roster),
        entry.isCurrent
      );
    });
  });

  const liveLeagueId = String(
    currentLeagueId
    || (Array.isArray(historyEntries) ? historyEntries.find((entry) => entry?.isCurrent)?.leagueId : "")
    || ""
  );
  (Array.isArray(currentRosters) ? currentRosters : []).forEach((roster) => {
    push(roster?.roster_id, "", liveLeagueId, ownerIdFromRoster(roster), true);
  });

  return byRoster;
}

function inheritOwnerId(slots, index, liveOwnerIds) {
  const current = slots[index];
  if (current.ownerId) return { ownerId: current.ownerId, inferred: false };

  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const previous = slots[cursor];
    if (!previous.ownerId) continue;
    if (!liveOwnerIds.has(previous.ownerId)) {
      return { ownerId: previous.ownerId, inferred: true };
    }
    break;
  }

  for (let cursor = index + 1; cursor < slots.length; cursor += 1) {
    if (slots[cursor].ownerId) {
      return { ownerId: slots[cursor].ownerId, inferred: true };
    }
  }

  return { ownerId: "", inferred: false };
}

function fillVacantOwners(slots, liveOwnerIds) {
  const ordered = [...slots].sort((a, b) => seasonSortValue(a) - seasonSortValue(b) || Number(a.isCurrent) - Number(b.isCurrent));
  return ordered.map((row, index, list) => {
    const inherited = inheritOwnerId(list, index, liveOwnerIds);
    return {
      ...row,
      ownerId: inherited.ownerId,
      inferred: inherited.inferred,
    };
  });
}

function takeoversFromFilled(filledByRoster, liveOwnerIds, names) {
  const takeovers = [];
  filledByRoster.forEach((slots, rosterId) => {
    const named = slots.filter((row) => row.ownerId);
    if (named.length < 2) return;
    const current = [...named].reverse().find((row) => row.isCurrent) || named[named.length - 1];
    const previous = [...named].reverse().find((row) => row.ownerId !== current.ownerId);
    if (!previous || liveOwnerIds.has(previous.ownerId)) return;
    takeovers.push({
      rosterId,
      fromUserId: previous.ownerId,
      fromName: names.get(previous.ownerId) || "Previous manager",
      toUserId: current.ownerId,
      toName: names.get(current.ownerId) || "Current manager",
    });
  });
  return takeovers;
}

function managerLabel(userId, rosterId, names) {
  if (!isRealUserId(userId)) return placeholderRosterName(rosterId);
  return names.get(String(userId).trim()) || String(userId).trim();
}

export function buildFranchiseIndex({
  currentRosters = [],
  historyEntries = [],
  users = [],
  currentLeagueId = "",
} = {}) {
  const names = userNameById(users);
  const liveOwnerIds = new Set(
    (Array.isArray(currentRosters) ? currentRosters : [])
      .map((roster) => ownerIdFromRoster(roster))
      .filter(Boolean)
  );
  const identities = new Map();
  const filledByRoster = new Map();

  collectRosterSlots({ historyEntries, currentRosters, currentLeagueId }).forEach((slots, rosterId) => {
    const filled = fillVacantOwners(slots, liveOwnerIds);
    filledByRoster.set(rosterId, filled);
    filled.forEach((row) => {
      identities.set(slotKey(row.leagueId, rosterId), {
        leagueId: row.leagueId,
        rosterId,
        season: row.season,
        userId: row.ownerId,
        inferred: Boolean(row.inferred && row.ownerId),
        managerKey: personManagerKey(row.ownerId, row.leagueId, rosterId),
        managerName: managerLabel(row.ownerId, rosterId, names),
      });
    });
  });

  return {
    identities,
    names,
    takeovers: takeoversFromFilled(filledByRoster, liveOwnerIds, names),
  };
}

export function resolveRosterIdentity(index, { userId = "", leagueId = "", rosterId = "" } = {}) {
  const names = index?.names instanceof Map ? index.names : new Map();
  const rosterKey = String(rosterId ?? "").trim();
  const leagueKey = String(leagueId || "");
  if (isRealUserId(userId)) {
    const id = String(userId).trim();
    return {
      leagueId: leagueKey,
      rosterId: rosterKey,
      userId: id,
      inferred: false,
      managerKey: personManagerKey(id),
      managerName: managerLabel(id, rosterKey, names),
    };
  }

  const recovered = index?.identities instanceof Map
    ? index.identities.get(slotKey(leagueKey, rosterKey))
    : null;
  if (recovered?.userId) return recovered;

  return {
    leagueId: leagueKey,
    rosterId: rosterKey,
    userId: "",
    inferred: false,
    managerKey: personManagerKey("", leagueKey, rosterKey),
    managerName: placeholderRosterName(rosterKey),
  };
}

// Kept for callers that still ask for aliases. Identity is the person, so we
// never merge a departed manager onto the current desk.
export function buildTakeoverAliasMap(args = {}) {
  const index = buildFranchiseIndex(args);
  return { aliases: new Map(), takeovers: index.takeovers, index };
}

export function resolveFranchiseManagerKey(userId, leagueId, rosterId, aliases = new Map(), index = null) {
  if (index) {
    return resolveRosterIdentity(index, { userId, leagueId, rosterId }).managerKey;
  }
  if (isRealUserId(userId)) return personManagerKey(userId);
  const map = aliases instanceof Map ? aliases : new Map();
  const raw = personManagerKey(userId, leagueId, rosterId);
  return map.get(raw) || raw;
}

export function takeoverForRoster(takeovers = [], rosterId) {
  const id = String(rosterId ?? "");
  return (Array.isArray(takeovers) ? takeovers : []).find((row) => String(row.rosterId) === id) || null;
}
