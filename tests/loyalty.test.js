import test from "node:test";
import assert from "node:assert/strict";
import {
  formatRecordLine,
  winPctFromRecord,
  recordFromResults,
  gameIsAfter,
  buildRosterDna,
  buildTenure,
  ironRosterShare,
  summarizeCharms,
  hindsightGrade,
  analyzePastTrades,
  biggestTradeMiss,
  newCorePlayers,
  buildPlayerPassport,
  buildHallRows,
  loyaltyScore,
} from "../docs/modules/loyalty.js";

test("record helpers keep ties and win percentage", () => {
  assert.equal(formatRecordLine(8, 3, 1), "8-3-1");
  assert.equal(formatRecordLine(2, 0), "2-0");
  assert.equal(winPctFromRecord({ wins: 1, losses: 1, ties: 0 }), 0.5);
  const rec = recordFromResults([{ result: "W" }, { result: "L" }, { result: "T" }]);
  assert.equal(rec.label, "1-1-1");
  assert.equal(rec.games, 3);
});

test("roster DNA splits kept, lost, and new", () => {
  const dna = buildRosterDna({
    currentIds: ["1", "2", "9"],
    previousIds: ["1", "3"],
    nameOf: (id) => ({ 1: "Gibbs", 2: "Hurts", 3: "Metcalf", 9: "Rookie" }[id]),
    valueOf: (id) => ({ 1: 9000, 2: 8000, 3: 5000, 9: 4000 }[id]),
  });
  assert.equal(dna.keptCount, 1);
  assert.equal(dna.lostCount, 1);
  assert.equal(dna.addedCount, 2);
  assert.equal(dna.kept[0].name, "Gibbs");
  assert.equal(dna.lost[0].name, "Metcalf");
});

test("tenure counts consecutive seasons from now", () => {
  const tenures = buildTenure({
    currentIds: ["gibbs", "rookie"],
    seasons: [
      { season: "2024", ids: ["gibbs"] },
      { season: "2025", ids: ["gibbs"] },
      { season: "2026", ids: ["gibbs", "rookie"] },
    ],
  });
  const gibbs = tenures.find((row) => row.playerId === "gibbs");
  const rookie = tenures.find((row) => row.playerId === "rookie");
  assert.equal(gibbs.consecutiveSeasons, 3);
  assert.equal(gibbs.ironman, true);
  assert.equal(rookie.consecutiveSeasons, 1);
  assert.ok(ironRosterShare(tenures, 2) > 0);
});

test("luck charms rank players who win more when they start", () => {
  const charms = summarizeCharms([
    { playerId: "charm", started: true, result: "W" },
    { playerId: "charm", started: true, result: "W" },
    { playerId: "charm", started: true, result: "W" },
    { playerId: "jinx", started: true, result: "L" },
    { playerId: "jinx", started: true, result: "L" },
    { playerId: "jinx", started: true, result: "L" },
  ], { teamWinPct: 0.5, minGames: 3 });
  assert.equal(charms[0].playerId, "charm");
  assert.equal(charms[0].badge, "charm");
  assert.equal(charms.at(-1).playerId, "jinx");
  assert.equal(charms.at(-1).badge, "jinx");
});

test("past trade analyzer grades hindsight value and record since", () => {
  const analyzed = analyzePastTrades({
    myRosterId: "1",
    valueOf: (item) => item.value,
    trades: [{
      id: "t1",
      season: "2025",
      week: 4,
      partnerName: "Demetri",
      movements: [
        { fromRosterId: "1", toRosterId: "2", name: "Old WR", value: 1200, assetType: "player" },
        { fromRosterId: "2", toRosterId: "1", name: "Gibbs", value: 9000, assetType: "player" },
      ],
    }],
    games: [
      { season: "2025", week: 5, result: "W" },
      { season: "2025", week: 6, result: "W" },
      { season: "2025", week: 3, result: "L" },
    ],
  });
  assert.equal(analyzed.length, 1);
  assert.equal(analyzed[0].verdict, "won");
  assert.equal(analyzed[0].since.wins, 2);
  assert.equal(analyzed[0].grade, "A+");
  assert.equal(gameIsAfter({ season: "2025", week: 5 }, { season: "2025", week: 4 }), true);
});

test("hindsight grade and biggest miss follow current value", () => {
  assert.equal(hindsightGrade(1800, 0.7), "A+");
  assert.equal(hindsightGrade(-1800, 0.3), "F");
  const miss = biggestTradeMiss([{
    season: "2024",
    week: 8,
    partnerName: "Sam",
    movements: [
      { fromRosterId: "1", toRosterId: "2", name: "Waddle", assetType: "player", assetId: "waddle" },
      { fromRosterId: "1", toRosterId: "2", name: "2025 2nd", assetType: "pick", assetId: "pick" },
    ],
  }], { myRosterId: "1", valueOf: (item) => item.assetId === "waddle" ? 6400 : 400 });
  assert.equal(miss.name, "Waddle");
});

test("passport collapses consecutive seasons with the same manager", () => {
  const passport = buildPlayerPassport({
    playerId: "gibbs",
    name: "Jahmyr Gibbs",
    seasons: [
      { season: "2023", managerKey: "a", managerName: "Night Blood" },
      { season: "2024", managerKey: "a", managerName: "Night Blood" },
      { season: "2025", managerKey: "b", managerName: "Nikoball" },
      { season: "2026", managerKey: "b", managerName: "Nikoball" },
    ],
  });
  assert.equal(passport.stops.length, 2);
  assert.equal(passport.stops[0].fromSeason, "2023");
  assert.equal(passport.stops[0].toSeason, "2024");
  assert.equal(passport.stops[1].managerName, "Nikoball");
});

test("hall rows rank titles then wins", () => {
  const rows = buildHallRows([
    { managerName: "Niko", titles: 1, totalWins: 40, totalLosses: 20, records: [{ finishRank: 2 }, { playoffFinish: 1 }] },
    { managerName: "Sam", titles: 2, totalWins: 30, totalLosses: 22, records: [{ playoffFinish: 1 }, { playoffFinish: 1 }] },
  ]);
  assert.equal(rows[0].managerName, "Sam");
  assert.equal(rows[0].playoffApps, 2);
});

test("new core and loyalty score stay in range", () => {
  const core = newCorePlayers([
    { playerId: "kid", name: "Rookie", age: 22 },
    { playerId: "vet", name: "Vet", age: 31 },
  ]);
  assert.equal(core[0].playerId, "kid");
  const score = loyaltyScore({
    tenures: [{ consecutiveSeasons: 3 }, { consecutiveSeasons: 1 }],
    charms: [{ charmDelta: 0.2 }],
    dna: { overlap: 0.5 },
  });
  assert.ok(score >= 1 && score <= 99);
});
