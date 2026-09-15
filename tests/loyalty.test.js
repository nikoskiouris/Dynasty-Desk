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
  scoreTradeSide,
  buildTradeRecap,
  analyzePastTrades,
  analyzeLeagueTradeSides,
  pickLeagueTradeAwards,
  finishesAfterTrade,
  biggestTradeMiss,
  newCorePlayers,
  buildPlayerPassport,
  decoratePassport,
  formatSeasonSpan,
  passportJourneyLabel,
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
    finishes: [
      { season: "2024", label: "3rd" },
      { season: "2025", label: "10th" },
      { season: "2026", label: "live", isCurrent: true },
    ],
  });
  assert.equal(analyzed.length, 1);
  assert.equal(analyzed[0].verdict, "won");
  assert.equal(analyzed[0].since.wins, 2);
  assert.equal(analyzed[0].after[0].week, 5);
  assert.equal(analyzed[0].after[1].week, 6);
  assert.equal(analyzed[0].grade, "A+");
  assert.deepEqual(analyzed[0].laterFinishes.map((row) => row.label), ["10th"]);
  assert.match(analyzed[0].recap, /10th/);
  assert.equal(gameIsAfter({ season: "2025", week: 5 }, { season: "2025", week: 4 }), true);
});

test("later finishes skip prior seasons and the live year", () => {
  const later = finishesAfterTrade([
    { season: "2024", label: "3rd" },
    { season: "2025", label: "10th" },
    { season: "2026", label: "live", isCurrent: true },
  ], { season: "2025", week: 8 });
  assert.deepEqual(later.map((row) => row.label), ["10th"]);
  const laterSeasons = finishesAfterTrade(
    [{ season: "2025", label: "10th" }, { season: "2026", label: "2nd" }],
    { season: "2025", week: 8 },
  );
  assert.deepEqual(laterSeasons.map((row) => row.label), ["10th", "2nd"]);
  const offseason = finishesAfterTrade(
    [{ season: "2025", label: "1st" }],
    { season: "2025", week: 0 },
  );
  assert.equal(offseason[0].label, "1st");
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

test("passport timeline marks origin, visas, and now", () => {
  const decorated = decoratePassport(buildPlayerPassport({
    playerId: "gibbs",
    name: "Jahmyr Gibbs",
    seasons: [
      { season: "2023", managerKey: "a", managerName: "Night Blood" },
      { season: "2024", managerKey: "a", managerName: "Night Blood" },
      { season: "2025", managerKey: "b", managerName: "Nikoball" },
      { season: "2026", managerKey: "b", managerName: "Nikoball" },
    ],
  }), { myManagerKey: "b", currentSeason: "2026" });
  assert.equal(decorated.hops, 1);
  assert.equal(decorated.stops[0].stamp, "origin");
  assert.equal(decorated.stops[0].years, 2);
  assert.equal(decorated.stops[1].stamp, "now");
  assert.equal(decorated.stops[1].current, true);
  assert.equal(formatSeasonSpan("2023", "2024"), "2023–24");
  assert.equal(formatSeasonSpan("2026", "2026"), "2026");
  assert.equal(passportJourneyLabel(decorated), "One visa · still here");
});

test("passport keeps a rename stop when the same person changes display name", () => {
  const passport = buildPlayerPassport({
    playerId: "chase",
    name: "Ja'Marr Chase",
    seasons: [
      { season: "2024", managerKey: "user:juan", managerName: "Old Handle" },
      { season: "2025", managerKey: "user:juan", managerName: "Old Handle" },
      { season: "2026", managerKey: "user:juan", managerName: "JuanPlantis" },
    ],
  });
  assert.equal(passport.stops.length, 2);
  assert.equal(passport.stops[0].managerName, "Old Handle");
  assert.equal(passport.stops[0].toSeason, "2025");
  assert.equal(passport.stops[1].managerName, "JuanPlantis");
});

test("passport treats a desk takeover as two people, not a roster slot", () => {
  const passport = buildPlayerPassport({
    playerId: "chase",
    name: "Ja'Marr Chase",
    seasons: [
      { season: "2024", managerKey: "user:gus", managerName: "gusk" },
      { season: "2025", managerKey: "user:gus", managerName: "gusk" },
      { season: "2026", managerKey: "user:juan", managerName: "JuanPlantis" },
    ],
  });
  assert.equal(passport.stops.length, 2);
  assert.equal(passport.stops[0].managerKey, "user:gus");
  assert.equal(passport.stops[0].managerName, "gusk");
  assert.equal(passport.stops[0].toSeason, "2025");
  assert.equal(passport.stops[1].managerKey, "user:juan");
  assert.equal(passport.stops[1].managerName, "JuanPlantis");
  assert.equal(passport.stops.some((stop) => /roster|team\s+\d+/i.test(stop.managerName)), false);
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

test("trade score trusts record sample and still flags a zero-game steal", () => {
  const freshSteal = scoreTradeSide({
    receivedNow: 9000,
    sentNow: 1200,
    received: [{ value: 9000, name: "Chase" }],
    sent: [{ value: 1200, name: "Old WR" }],
    since: { wins: 0, losses: 0, ties: 0, games: 0, winPct: 0.5 },
  });
  const agedWin = scoreTradeSide({
    receivedNow: 4200,
    sentNow: 2100,
    received: [{ value: 4200, name: "Gibbs" }],
    sent: [{ value: 2100, name: "Vet" }],
    since: { wins: 12, losses: 4, ties: 0, games: 16, winPct: 0.75 },
  });
  assert.ok(freshSteal.fleece > agedWin.fleece);
  assert.ok(agedWin.impact > freshSteal.impact);
  assert.equal(freshSteal.games, 0);
});

test("trade recap names the record since and later finishes", () => {
  const recap = buildTradeRecap({
    managerName: "Niko",
    partnerName: "Conor",
    season: "2025",
    week: 8,
    received: [{ name: "Gibbs" }],
    sent: [{ name: "Daniels" }],
    delta: -1162,
    since: { games: 12, label: "8-4", winPct: 8 / 12 },
    grade: "C",
    finishes: [{ season: "2025", label: "10th" }],
  });
  assert.match(recap, /8-4/);
  assert.match(recap, /Gibbs/);
  assert.match(recap, /10th/);
  assert.match(recap, /Grade C/);
});

test("heater score trusts Wilson sample so 6-0 beats 12-4 and 2-0 cannot", () => {
  const hot = scoreTradeSide({
    receivedNow: 4000,
    sentNow: 3800,
    received: [{ value: 4000 }],
    sent: [{ value: 3800 }],
    since: { wins: 6, losses: 0, ties: 0, games: 6, winPct: 1 },
  });
  const solid = scoreTradeSide({
    receivedNow: 4000,
    sentNow: 3800,
    received: [{ value: 4000 }],
    sent: [{ value: 3800 }],
    since: { wins: 12, losses: 4, ties: 0, games: 16, winPct: 0.75 },
  });
  const tiny = scoreTradeSide({
    receivedNow: 4000,
    sentNow: 3800,
    received: [{ value: 4000 }],
    sent: [{ value: 3800 }],
    since: { wins: 2, losses: 0, ties: 0, games: 2, winPct: 1 },
  });
  assert.ok(hot.heaterScore > solid.heaterScore);
  assert.ok(solid.heaterScore > tiny.heaterScore);
  assert.ok(tiny.wilsonPct < solid.wilsonPct);
});

test("league trade awards keep hottest-since and fleece only", () => {
  const sides = analyzeLeagueTradeSides({
    nameOf: (key) => ({ a: "Niko", b: "Sam", c: "Lee" }[key]),
    valueOf: (item) => item.value,
    gamesByManager: new Map([
      ["a", [{ season: "2025", week: 9, result: "W" }, { season: "2025", week: 10, result: "W" }, { season: "2025", week: 11, result: "W" }, { season: "2025", week: 12, result: "W" }, { season: "2025", week: 13, result: "W" }, { season: "2025", week: 14, result: "W" }]],
      ["b", [{ season: "2025", week: 9, result: "L" }, { season: "2025", week: 10, result: "L" }, { season: "2025", week: 11, result: "L" }, { season: "2025", week: 12, result: "L" }, { season: "2025", week: 13, result: "L" }, { season: "2025", week: 14, result: "L" }]],
      ["c", [{ season: "2025", week: 3, result: "W" }, { season: "2025", week: 4, result: "L" }, { season: "2025", week: 5, result: "W" }, { season: "2025", week: 6, result: "L" }, { season: "2025", week: 7, result: "W" }, { season: "2025", week: 8, result: "L" }]],
    ]),
    trades: [
      {
        id: "steal",
        season: "2025",
        week: 8,
        movements: [
          { fromRosterId: "b", toRosterId: "a", name: "Chase", value: 9000 },
          { fromRosterId: "a", toRosterId: "b", name: "Dust", value: 800 },
        ],
      },
      {
        id: "even",
        season: "2025",
        week: 2,
        movements: [
          { fromRosterId: "c", toRosterId: "a", name: "WR1", value: 5000 },
          { fromRosterId: "a", toRosterId: "c", name: "WR2", value: 4900 },
        ],
      },
    ],
  });
  const awards = pickLeagueTradeAwards(sides);
  assert.equal(awards.fleece.managerKey, "a");
  assert.equal(awards.heater.managerKey, "a");
  assert.ok(awards.heater.since.wins >= 6);
  assert.equal(awards.best, undefined);
  assert.equal(awards.even, undefined);
  assert.equal(awards.worst, undefined);
});
