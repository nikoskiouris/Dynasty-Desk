export function personManagerKey(userId, leagueId, rosterId) {
  const normalizedUserId = String(userId || "").trim();
  if (normalizedUserId && normalizedUserId !== "unknown") return `user:${normalizedUserId}`;
  return `roster:${String(leagueId || "league")}:${String(rosterId || "unknown")}`;
}

function displayNameForUser(user, fallback) {
  if (!user) return fallback;
  return user.display_name || user.username || fallback;
}

function userNameById(users = []) {
  const map = new Map();
  (Array.isArray(users) ? users : []).forEach((user) => {
    const id = String(user?.user_id || "").trim();
    if (!id || map.has(id)) return;
    map.set(id, displayNameForUser(user, id));
  });
  return map;
}

export function buildTakeoverAliasMap({
  currentRosters = [],
  historyEntries = [],
  users = [],
} = {}) {
  const aliases = new Map();
  const takeovers = [];
  const names = userNameById(users);
  const liveOwnerIds = new Set(
    (Array.isArray(currentRosters) ? currentRosters : [])
      .map((roster) => String(roster?.owner_id || "").trim())
      .filter((id) => id && id !== "unknown")
  );
  const currentByRoster = new Map();
  (Array.isArray(currentRosters) ? currentRosters : []).forEach((roster) => {
    const rosterId = String(roster?.roster_id ?? "").trim();
    const ownerId = String(roster?.owner_id || "").trim();
    if (!rosterId || !ownerId || ownerId === "unknown") return;
    currentByRoster.set(rosterId, ownerId);
  });

  currentByRoster.forEach((currentOwnerId, rosterId) => {
    const canonicalKey = personManagerKey(currentOwnerId, "", rosterId);
    const seen = new Set();
    (Array.isArray(historyEntries) ? historyEntries : []).forEach((entry) => {
      if (entry?.isCurrent) return;
      const roster = (entry?.rosters || []).find((item) => String(item?.roster_id ?? "") === rosterId);
      if (!roster) return;
      const pastOwnerId = String(roster.owner_id || "").trim();
      if (!pastOwnerId || pastOwnerId === "unknown" || pastOwnerId === currentOwnerId || seen.has(pastOwnerId)) {
        return;
      }
      seen.add(pastOwnerId);
      if (liveOwnerIds.has(pastOwnerId)) return;
      aliases.set(personManagerKey(pastOwnerId, entry.leagueId, rosterId), canonicalKey);
      takeovers.push({
        rosterId,
        fromUserId: pastOwnerId,
        fromName: names.get(pastOwnerId) || "Previous manager",
        toUserId: currentOwnerId,
        toName: names.get(currentOwnerId) || "Current manager",
      });
    });
  });

  return { aliases, takeovers };
}

export function resolveFranchiseManagerKey(userId, leagueId, rosterId, aliases = new Map()) {
  const raw = personManagerKey(userId, leagueId, rosterId);
  const map = aliases instanceof Map ? aliases : new Map();
  return map.get(raw) || raw;
}

export function takeoverForRoster(takeovers = [], rosterId) {
  const id = String(rosterId ?? "");
  return (Array.isArray(takeovers) ? takeovers : []).find((row) => String(row.rosterId) === id) || null;
}
