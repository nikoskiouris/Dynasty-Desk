export function formatRecordLine(wins = 0, losses = 0, ties = 0) {
  const w = Number(wins) || 0;
  const l = Number(losses) || 0;
  const t = Number(ties) || 0;
  return t > 0 ? `${w}-${l}-${t}` : `${w}-${l}`;
}

export function winPctFromRecord({ wins = 0, losses = 0, ties = 0 } = {}) {
  const games = Number(wins) + Number(losses) + Number(ties);
  if (games <= 0) return 0;
  return (Number(wins) + Number(ties) * 0.5) / games;
}

export function recordFromResults(results = []) {
  let wins = 0;
  let losses = 0;
  let ties = 0;
  results.forEach((result) => {
    const mark = String(result?.result || "").toUpperCase();
    if (mark === "W") wins += 1;
    else if (mark === "L") losses += 1;
    else if (mark === "T") ties += 1;
  });
  return {
    wins,
    losses,
    ties,
    games: wins + losses + ties,
    winPct: winPctFromRecord({ wins, losses, ties }),
    label: formatRecordLine(wins, losses, ties),
  };
}

export function gameSortKey(game) {
  return Number(game?.season || 0) * 100 + Number(game?.week || 0);
}

export function gameIsAfter(game, marker) {
  return gameSortKey(game) > gameSortKey(marker);
}

export function buildRosterDna({
  currentIds = [],
  previousIds = [],
  nameOf = (id) => String(id),
  valueOf = () => 0,
  ageOf = () => null,
  limit = 8,
} = {}) {
  const current = new Set([...currentIds].map(String).filter(Boolean));
  const previous = new Set([...previousIds].map(String).filter(Boolean));
  const toChip = (playerId) => ({
    playerId,
    name: nameOf(playerId) || playerId,
    value: Number(valueOf(playerId)) || 0,
    age: ageOf(playerId),
  });
  const sortChips = (chips) => chips.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  const keptAll = [...current].filter((id) => previous.has(id)).map(toChip);
  const addedAll = [...current].filter((id) => !previous.has(id)).map(toChip);
  const lostAll = [...previous].filter((id) => !current.has(id)).map(toChip);
  return {
    kept: sortChips(keptAll).slice(0, limit),
    added: sortChips(addedAll).slice(0, limit),
    lost: sortChips(lostAll).slice(0, limit),
    keptCount: keptAll.length,
    addedCount: addedAll.length,
    lostCount: lostAll.length,
    overlap: current.size === 0 && previous.size === 0
      ? 0
      : keptAll.length / Math.max(current.size, previous.size, 1),
  };
}

export function buildTenure({ currentIds = [], seasons = [] } = {}) {
  const ordered = [...seasons]
    .map((entry) => ({
      season: String(entry.season || ""),
      ids: new Set([...(entry.ids || [])].map(String)),
    }))
    .filter((entry) => entry.season)
    .sort((a, b) => Number(a.season) - Number(b.season));

  return [...currentIds]
    .map(String)
    .filter(Boolean)
    .map((playerId) => {
      let consecutive = 0;
      for (let index = ordered.length - 1; index >= 0; index -= 1) {
        if (!ordered[index].ids.has(playerId)) break;
        consecutive += 1;
      }
      const seasonsPresent = ordered.filter((entry) => entry.ids.has(playerId)).map((entry) => entry.season);
      return {
        playerId,
        consecutiveSeasons: consecutive,
        seasonsPresent: seasonsPresent.length,
        firstSeason: seasonsPresent[0] || null,
        ironman: consecutive >= 3,
      };
    })
    .sort((a, b) => b.consecutiveSeasons - a.consecutiveSeasons || b.seasonsPresent - a.seasonsPresent);
}

export function ironRosterShare(tenures = [], minSeasons = 2) {
  if (!tenures.length) return 0;
  const loyal = tenures.filter((row) => Number(row.consecutiveSeasons) >= minSeasons).length;
  return loyal / tenures.length;
}

export function summarizeCharms(appearances = [], { teamWinPct = 0, minGames = 3 } = {}) {
  const byPlayer = new Map();
  appearances.forEach((row) => {
    const playerId = String(row?.playerId || "");
    if (!playerId || playerId === "0") return;
    if (!byPlayer.has(playerId)) {
      byPlayer.set(playerId, {
        playerId,
        roster: { wins: 0, losses: 0, ties: 0 },
        started: { wins: 0, losses: 0, ties: 0 },
      });
    }
    const bucket = byPlayer.get(playerId);
    const mark = String(row.result || "").toUpperCase();
    const bump = (record) => {
      if (mark === "W") record.wins += 1;
      else if (mark === "L") record.losses += 1;
      else if (mark === "T") record.ties += 1;
    };
    bump(bucket.roster);
    if (row.started) bump(bucket.started);
  });

  return [...byPlayer.values()]
    .map((row) => {
      const roster = {
        ...row.roster,
        games: row.roster.wins + row.roster.losses + row.roster.ties,
        winPct: winPctFromRecord(row.roster),
        label: formatRecordLine(row.roster.wins, row.roster.losses, row.roster.ties),
      };
      const started = {
        ...row.started,
        games: row.started.wins + row.started.losses + row.started.ties,
        winPct: winPctFromRecord(row.started),
        label: formatRecordLine(row.started.wins, row.started.losses, row.started.ties),
      };
      const sample = started.games >= minGames ? started : roster;
      const charmDelta = sample.games >= minGames ? sample.winPct - Number(teamWinPct || 0) : 0;
      return {
        playerId: row.playerId,
        roster,
        started,
        charmDelta,
        badge: charmBadge(started, roster, charmDelta, minGames),
      };
    })
    .filter((row) => row.roster.games >= minGames || row.started.games >= minGames)
    .sort((a, b) => b.charmDelta - a.charmDelta || b.started.games - a.started.games);
}

function charmBadge(started, roster, charmDelta, minGames) {
  if (started.games >= minGames && charmDelta >= 0.12 && started.winPct >= 0.6) return "charm";
  if (started.games >= minGames && charmDelta <= -0.12) return "jinx";
  if (roster.games >= Math.max(minGames, 6) && roster.winPct >= 0.65) return "anchor";
  return "";
}

export function hindsightGrade(valueDelta = 0, winPct = 0.5) {
  const valueScore = Math.max(-1, Math.min(1, Number(valueDelta) / 2000));
  const recScore = (Number(winPct) - 0.5) * 2;
  const combined = valueScore * 0.65 + recScore * 0.35;
  if (combined > 0.55) return "A+";
  if (combined > 0.32) return "A";
  if (combined > 0.12) return "B";
  if (combined > -0.12) return "C";
  if (combined > -0.35) return "D";
  return "F";
}

export function analyzePastTrades({
  trades = [],
  myRosterId,
  games = [],
  valueOf = () => 0,
} = {}) {
  const mine = String(myRosterId || "");
  return trades
    .map((trade) => {
      const movements = Array.isArray(trade.movements) ? trade.movements : [];
      const received = movements.filter((item) => String(item.toRosterId) === mine);
      const sent = movements.filter((item) => String(item.fromRosterId) === mine);
      if (received.length === 0 && sent.length === 0) return null;
      const receivedNow = received.reduce((sum, item) => sum + (Number(valueOf(item)) || 0), 0);
      const sentNow = sent.reduce((sum, item) => sum + (Number(valueOf(item)) || 0), 0);
      const delta = receivedNow - sentNow;
      const since = recordFromResults(games.filter((game) => gameIsAfter(game, trade)));
      return {
        id: trade.id || `${trade.season}-${trade.week}-${mine}`,
        season: String(trade.season || ""),
        week: Number(trade.week) || 0,
        partnerName: trade.partnerName || "Rival",
        received,
        sent,
        receivedNow,
        sentNow,
        delta,
        since,
        grade: hindsightGrade(delta, since.games ? since.winPct : 0.5),
        verdict: delta > 150 ? "won" : delta < -150 ? "lost" : "even",
      };
    })
    .filter(Boolean)
    .sort((a, b) => gameSortKey(b) - gameSortKey(a) || Math.abs(b.delta) - Math.abs(a.delta));
}

export function biggestTradeMiss(trades = [], { myRosterId, valueOf = () => 0 } = {}) {
  const mine = String(myRosterId || "");
  const lost = [];
  trades.forEach((trade) => {
    (trade.movements || []).forEach((item) => {
      if (String(item.fromRosterId) !== mine) return;
      if (item.assetType && item.assetType !== "player") return;
      lost.push({
        ...item,
        value: Number(valueOf(item)) || 0,
        season: trade.season,
        week: trade.week,
        partnerName: trade.partnerName,
      });
    });
  });
  lost.sort((a, b) => b.value - a.value);
  return lost[0] || null;
}

export function newCorePlayers(added = [], { ageOf = () => null, maxAge = 25 } = {}) {
  return added
    .filter((chip) => {
      const age = Number(chip.age ?? ageOf(chip.playerId));
      return Number.isFinite(age) ? age <= maxAge : true;
    })
    .slice(0, 6);
}

export function buildPlayerPassport({ playerId, name = "", seasons = [] } = {}) {
  const ordered = [...seasons]
    .filter((entry) => entry?.managerKey)
    .sort((a, b) => Number(a.season) - Number(b.season));
  const stops = [];
  ordered.forEach((entry) => {
    const last = stops[stops.length - 1];
    if (last && last.managerKey === entry.managerKey) {
      last.toSeason = String(entry.season);
      return;
    }
    stops.push({
      managerKey: entry.managerKey,
      managerName: entry.managerName || "Unknown",
      fromSeason: String(entry.season),
      toSeason: String(entry.season),
    });
  });
  return {
    playerId: String(playerId || ""),
    name: name || String(playerId || ""),
    stops,
  };
}

export function buildHallRows(dynastyRows = [], { playoffTeams = 6 } = {}) {
  return [...dynastyRows]
    .map((row) => {
      const playoffApps = (row.records || []).filter((record) => {
        if (record.isCurrent) return false;
        if (Number.isFinite(Number(record.playoffFinish))) return true;
        return Number(record.finishRank) > 0 && Number(record.finishRank) <= playoffTeams;
      }).length;
      return {
        managerKey: row.managerKey,
        managerName: row.managerName,
        titles: Number(row.titles) || 0,
        careerWins: Number(row.totalWins) || 0,
        careerLosses: Number(row.totalLosses) || 0,
        careerTies: Number(row.totalTies) || 0,
        playoffApps,
        avgFinish: Number.isFinite(Number(row.avgFinish)) ? Number(row.avgFinish) : null,
        dynastyScore: Number(row.dynastyScore) || 0,
        currentRosterId: row.currentRosterId,
        recordLabel: formatRecordLine(row.totalWins, row.totalLosses, row.totalTies),
      };
    })
    .sort((a, b) => b.titles - a.titles || b.careerWins - a.careerWins || b.dynastyScore - a.dynastyScore);
}

export function loyaltyScore({ tenures = [], charms = [], dna } = {}) {
  const iron = ironRosterShare(tenures, 2);
  const topCharm = charms[0]?.charmDelta || 0;
  const keepRate = Number(dna?.overlap) || 0;
  const raw = iron * 48 + Math.max(0, topCharm) * 80 + keepRate * 28;
  return Math.max(1, Math.min(99, Math.round(raw)));
}
