import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRecap,
  selectRecapTrades,
  inferNflKickoffDate,
  buildRecapTradeWindow,
  isTradeInRecapWindow,
} from "../docs/modules/recap.js";

test("inferNflKickoffDate is the Thursday after Labor Day", () => {
  assert.equal(inferNflKickoffDate(2026), "2026-09-10");
  assert.equal(inferNflKickoffDate(2025), "2025-09-04");
});

test("recap trade window is the 7 days before the next week, not all season", () => {
  const window = buildRecapTradeWindow({ week: 2, seasonStartDate: "2026-09-10" });
  assert.ok(window.startMs < window.endMs);
  const inWindow = { type: "trade", status: "complete", status_updated: window.startMs + 1000 };
  const tooOld = { type: "trade", status: "complete", status_updated: window.startMs - 1000 };
  const nextWeek = { type: "trade", status: "complete", status_updated: window.endMs };
  assert.equal(isTradeInRecapWindow(inWindow, window), true);
  assert.equal(isTradeInRecapWindow(tooOld, window), false);
  assert.equal(isTradeInRecapWindow(nextWeek, window), false);
  const selected = selectRecapTrades([inWindow, tooOld, { type: "waiver", status: "complete", status_updated: window.startMs + 10 }], {
    week: 2,
    seasonStartDate: "2026-09-10",
  });
  assert.equal(selected.length, 1);
});

test("desk recap includes scoreboard, honors, and empty trade desk", () => {
  const text = buildRecap({
    leagueName: "Try Hard or Die Hard",
    week: 1,
    tone: "desk",
    provisional: false,
    model: {
      weeks: [{ week: 1, isPlayoff: false }],
      standings: [
        { rank: 1, name: "Niko", recordLabel: "1-0", pf: 140, gamesPlayed: 1, streak: { length: 1, label: "W1" }, luck: 0.4 },
      ],
      remainingGames: [{}, {}],
    },
    games: [
      { total: 220, margin: 40, sides: [{ name: "Niko", points: 130 }, { name: "Demetri", points: 90 }] },
    ],
    awards: [{ id: "mvp", title: "Player of the Week", teamName: "Niko", valueLabel: "38.4", detail: "Gibbs carried Niko." }],
    sim: {
      iterations: 4000,
      remainingGameCount: 2,
      results: [{ rosterId: "1", name: "Niko", playoffPct: 61, titlePct: 22 }],
    },
    trades: [],
  });
  assert.match(text, /TRY HARD OR DIE HARD - WEEK 1 RECAP/);
  assert.match(text, /SCOREBOARD/);
  assert.match(text, /Niko 130\.0 def\. Demetri 90\.0/);
  assert.match(text, /HONORS/);
  assert.match(text, /PLAYOFF PICTURE/);
  assert.match(text, /No completed trades this week/);
});

test("roast recap uses the rude empty-trade line", () => {
  const text = buildRecap({
    leagueName: "League",
    week: 1,
    tone: "roast",
    model: { weeks: [{ week: 1 }], standings: [] },
    games: [],
    awards: [],
    trades: [],
  });
  assert.match(text, /zero courage/i);
});
