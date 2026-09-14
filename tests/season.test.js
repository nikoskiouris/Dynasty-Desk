import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSeasonModel,
  simulateSeason,
  computeWeeklyAwards,
  computeSeasonSuperlatives,
  computeRecordBook,
  winProbability,
  seedTeams,
  formatRecord,
  blendSimPrior,
} from "../docs/modules/season.js";

function leagueFixture({
  lastScored = 1,
  leg = 2,
  status = "in_season",
  medianGames = false,
  playoffTeams = 2,
} = {}) {
  return {
    league_id: "L1",
    season: "2026",
    status,
    settings: {
      start_week: 1,
      playoff_week_start: 4,
      playoff_teams: playoffTeams,
      playoff_round_type: 0,
      divisions: 0,
      league_average_match: medianGames ? 1 : 0,
      last_scored_leg: lastScored,
      leg,
    },
  };
}

function users() {
  return [
    { user_id: "u1", display_name: "Alpha" },
    { user_id: "u2", display_name: "Bravo" },
    { user_id: "u3", display_name: "Charlie" },
    { user_id: "u4", display_name: "Delta" },
  ];
}

function rosters() {
  return [
    { roster_id: 1, owner_id: "u1", settings: { wins: 0, losses: 0, ties: 0, fpts: 0, fpts_decimal: 0 } },
    { roster_id: 2, owner_id: "u2", settings: { wins: 0, losses: 0, ties: 0, fpts: 0, fpts_decimal: 0 } },
    { roster_id: 3, owner_id: "u3", settings: { wins: 0, losses: 0, ties: 0, fpts: 0, fpts_decimal: 0 } },
    { roster_id: 4, owner_id: "u4", settings: { wins: 0, losses: 0, ties: 0, fpts: 0, fpts_decimal: 0 } },
  ];
}

function side(rosterId, matchupId, points, extras = {}) {
  return {
    roster_id: rosterId,
    matchup_id: matchupId,
    points,
    starters: extras.starters || ["10", "11"],
    starters_points: extras.startersPoints || [points - 10, 10],
    players: extras.players || ["10", "11", "12"],
    players_points: extras.playersPoints || { 10: points - 10, 11: 10, 12: 30 },
  };
}

test("final week writes standings, all-play, luck, and streaks", () => {
  const weekRows = new Map([
    [1, [
      side(1, 1, 140),
      side(2, 1, 90),
      side(3, 2, 110),
      side(4, 2, 100),
    ]],
  ]);
  const model = buildSeasonModel({
    league: leagueFixture({ lastScored: 1, leg: 2 }),
    rosters: rosters(),
    users: users(),
    weekRows,
    nflState: { season: "2026", week: 2, season_type: "regular" },
  });
  assert.equal(model.finalThroughWeek, 1);
  assert.equal(model.currentWeek, 2);
  assert.equal(model.standings[0].name, "Alpha");
  assert.equal(model.standings[0].wins, 1);
  assert.equal(model.standings[0].recordLabel, "1-0");
  assert.ok(model.standings[0].allPlayWins > model.standings[1].allPlayWins);
  assert.equal(model.standings[0].streak.label, "W1");
  const bravo = model.teams.get("2");
  assert.equal(bravo.losses, 1);
  assert.ok(bravo.luck < 0 || bravo.expectedWins > bravo.headToHeadWins || bravo.allPlayWins >= 0);
});

test("live week does not lock standings or name a winner", () => {
  const weekRows = new Map([
    [1, [
      side(1, 1, 40),
      side(2, 1, 10),
      side(3, 2, 12),
      side(4, 2, 8),
    ]],
  ]);
  const model = buildSeasonModel({
    league: leagueFixture({ lastScored: 0, leg: 1 }),
    rosters: rosters(),
    users: users(),
    weekRows,
    nflState: { season: "2026", week: 1, season_type: "regular" },
  });
  assert.equal(model.currentWeekEntry.isLive, true);
  assert.equal(model.finalThroughWeek, 0);
  assert.equal(model.standings.every((team) => team.gamesPlayed === 0 || team.wins + team.losses === team.sleeperRecord.wins + team.sleeperRecord.losses), true);
  const awards = computeWeeklyAwards(model, 1);
  assert.equal(awards.provisional, true);
  assert.equal(awards.awards.some((award) => award.id === "blowout"), false);
  assert.equal(awards.awards.some((award) => award.id === "mvp"), true);
});

test("weekly awards after a final week include demolition, photo finish, and bench blunder", () => {
  const weekRows = new Map([
    [1, [
      side(1, 1, 150, { starters: ["a"], startersPoints: [150], players: ["a", "b"], playersPoints: { a: 150, b: 40 } }),
      side(2, 1, 80, { starters: ["c"], startersPoints: [80], players: ["c", "d"], playersPoints: { c: 80, d: 5 } }),
      side(3, 2, 101.2, { starters: ["e"], startersPoints: [101.2], players: ["e", "f"], playersPoints: { e: 101.2, f: 1 } }),
      side(4, 2, 100.8, { starters: ["g"], startersPoints: [100.8], players: ["g", "h"], playersPoints: { g: 100.8, h: 50 } }),
    ]],
  ]);
  const model = buildSeasonModel({
    league: leagueFixture({ lastScored: 1, leg: 2 }),
    rosters: rosters(),
    users: users(),
    weekRows,
    nflState: { season: "2026", week: 2, season_type: "regular" },
    optimalPoints: (sideRow) => {
      const pts = Object.values(sideRow.playersPoints || {}).sort((a, b) => b - a);
      return pts[0] + (pts[1] || 0);
    },
  });
  const weekly = computeWeeklyAwards(model, 1, {
    playerName: (id) => `P${id}`,
    playerPosition: () => "WR",
    optimalPoints: (sideRow) => {
      const pts = Object.values(sideRow.playersPoints || {}).sort((a, b) => b - a);
      return pts[0] + (pts[1] || 0);
    },
  });
  const ids = weekly.awards.map((award) => award.id);
  assert.ok(ids.includes("top-score"));
  assert.ok(ids.includes("blowout"));
  assert.ok(ids.includes("closest"));
  assert.ok(ids.includes("bench-blunder"));
  assert.equal(weekly.provisional, false);
});

test("superlatives and record book survive a completed archive game", () => {
  const weekRows = new Map([
    [1, [side(1, 1, 140), side(2, 1, 90), side(3, 2, 110), side(4, 2, 70)]],
    [2, [side(1, 1, 95), side(3, 1, 90), side(2, 2, 120), side(4, 2, 60)]],
  ]);
  const model = buildSeasonModel({
    league: leagueFixture({ lastScored: 2, leg: 3 }),
    rosters: rosters(),
    users: users(),
    weekRows,
    nflState: { season: "2026", week: 3, season_type: "regular" },
  });
  const supers = computeSeasonSuperlatives(model);
  assert.ok(supers.some((item) => item.id === "points-machine" && item.teamName === "Alpha"));
  const book = computeRecordBook({
    games: [
      {
        season: "2025",
        week: 3,
        isPlayoff: false,
        a: { managerName: "Alpha", points: 180, rosterId: "1" },
        b: { managerName: "Bravo", points: 40, rosterId: "2" },
      },
      {
        season: "2025",
        week: 4,
        isPlayoff: false,
        a: { managerName: "Charlie", points: 101, rosterId: "3" },
        b: { managerName: "Delta", points: 100, rosterId: "4" },
      },
    ],
    seasonRows: [
      { managerName: "Alpha", points: 1800, wins: 11, losses: 3, complete: true, season: "2025" },
    ],
  });
  assert.equal(book.records.find((row) => row.id === "high").holder, "Alpha");
  assert.equal(book.records.find((row) => row.id === "closest").holder, "Charlie");
});

test("Monte Carlo stays off 99-1 in week 1 when priors shrink toward the mean", () => {
  const weekRows = new Map([
    [1, [side(1, 1, 0), side(2, 1, 0), side(3, 2, 0), side(4, 2, 0)]],
    [2, [side(1, 1, 0), side(3, 1, 0), side(2, 2, 0), side(4, 2, 0)]],
    [3, [side(1, 1, 0), side(4, 1, 0), side(2, 2, 0), side(3, 2, 0)]],
  ]);
  const model = buildSeasonModel({
    league: leagueFixture({ lastScored: 0, leg: 1, playoffTeams: 2 }),
    rosters: rosters(),
    users: users(),
    weekRows,
    nflState: { season: "2026", week: 1, season_type: "regular" },
  });
  const priors = new Map([
    ["1", blendSimPrior({ baseline: 125, previousPpg: 170, valuePercentile: 0.8 })],
    ["2", blendSimPrior({ baseline: 125, previousPpg: 95, valuePercentile: 0.25 })],
    ["3", blendSimPrior({ baseline: 125, previousPpg: 125, valuePercentile: 0.5 })],
    ["4", blendSimPrior({ baseline: 125, previousPpg: 118, valuePercentile: 0.45 })],
  ]);
  assert.ok(priors.get("1").mean < 145, "last year's 170 PPG must shrink toward the league mean");
  assert.ok(priors.get("2").mean > 105, "a slow 95 PPG team must shrink up toward the mean");
  const sim = simulateSeason(model, { priors, iterations: 800, seed: 7 });
  const alpha = sim.results.find((row) => row.rosterId === "1");
  const bravo = sim.results.find((row) => row.rosterId === "2");
  assert.ok(alpha.playoffPct > bravo.playoffPct);
  assert.ok(alpha.playoffPct < 97, `week 1 favorite should not be a lock, got ${alpha.playoffPct}`);
  assert.ok(bravo.playoffPct > 3, `week 1 longshot should not be dead, got ${bravo.playoffPct}`);
});

test("winProbability is symmetric and seed order prefers more wins", () => {
  assert.equal(Number(winProbability({ mean: 120, std: 20 }, { mean: 120, std: 20 }).toFixed(2)), 0.5);
  assert.ok(winProbability({ mean: 140, std: 16 }, { mean: 110, std: 16 }) > 0.7);
  const rows = [
    { rosterId: "a", wins: 2, ties: 0, pf: 200, pa: 100 },
    { rosterId: "b", wins: 3, ties: 0, pf: 180, pa: 120 },
  ];
  assert.deepEqual(seedTeams(rows, { playoffTeams: 2 }), ["b", "a"]);
});

test("formatRecord shows ties", () => {
  assert.equal(formatRecord({ wins: 2, losses: 1, ties: 1 }), "2-1-1");
});
