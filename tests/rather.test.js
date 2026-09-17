import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_RATHER_FORMAT,
  RATHER_SESSION_KEY,
  RATHER_VOTES_KEY,
  applyRatherOverlayHidden,
  decorateRatherPlayer,
  formatRatherDetail,
  formatRatherDetailLong,
  formatRatherDraftLine,
  formatRatherHeadline,
  formatRatherPlayerDetail,
  formatRatherPlayerMeta,
  formatRatherSeasonStats,
  isRatherRookie,
  ratherDepthChartFromNfl,
  listRatherPlayers,
  lookupRatherDraftPick,
  pairKey,
  parseRatherDraftPicks,
  pickRatherPair,
  playerInitials,
  pushRatherRecentKey,
  rankRatherPlayers,
  readRatherRecentKeys,
  readRatherSessionDone,
  readRatherVotes,
  recordRatherVote,
  renderRatherMarkup,
  sleeperPlayerThumbUrl,
  writeRatherSessionDone,
} from "../docs/modules/rather.js";

const docs = join(dirname(fileURLToPath(import.meta.url)), "../docs");

function memoryStorage(seed = {}) {
  const memory = new Map(Object.entries(seed));
  return {
    memory,
    getItem(key) {
      return memory.has(key) ? memory.get(key) : null;
    },
    setItem(key, value) {
      memory.set(key, String(value));
    },
  };
}

test("startup rather copy names two-player PPR 12-man Superflex", () => {
  assert.equal(formatRatherHeadline(), "Who would you rather have?");
  assert.equal(formatRatherDetail(), "PPR 12-man Superflex");
  assert.match(formatRatherDetailLong(), /full PPR scoring/);
  assert.match(formatRatherDetailLong(), /12-man league/);
  assert.match(formatRatherDetailLong(), /Superflex QB/);
  assert.equal(DEFAULT_RATHER_FORMAT.teams, 12);
});

test("listRatherPlayers drops picks and keeps named player assets", () => {
  const players = listRatherPlayers(
    {
      "player:11564": 8510,
      "player:11632": 7223,
      "pick:2027:r1:any": 6100,
      "player:ghost": 9000,
      "player:low": 200,
    },
    {
      "player:11564": "Drake Maye",
      "player:11632": "Malik Nabers",
      "pick:2027:r1:any": "2027 1st",
    }
  );
  assert.deepEqual(players.map((row) => row.name), ["Drake Maye", "Malik Nabers"]);
  assert.equal(players[0].playerId, "11564");
});

test("pickRatherPair returns two different close-ranked players", () => {
  const players = [
    { assetId: "player:a", playerId: "a", name: "A", value: 9000 },
    { assetId: "player:b", playerId: "b", name: "B", value: 8800 },
    { assetId: "player:c", playerId: "c", name: "C", value: 8600 },
  ];
  const pair = pickRatherPair(players, { random: () => 0 });
  assert.ok(pair);
  assert.notEqual(pair.left.assetId, pair.right.assetId);
  assert.equal(pair.key, pairKey(pair.left.assetId, pair.right.assetId));
});

test("pickRatherPair skips recently shown matchups", () => {
  const players = [
    { assetId: "player:a", playerId: "a", name: "A", value: 9000 },
    { assetId: "player:b", playerId: "b", name: "B", value: 8800 },
    { assetId: "player:c", playerId: "c", name: "C", value: 8600 },
    { assetId: "player:d", playerId: "d", name: "D", value: 8400 },
  ];
  const blocked = [pairKey("player:a", "player:b")];
  const pair = pickRatherPair(players, { recentKeys: blocked, random: () => 0 });
  assert.notEqual(pair.key, blocked[0]);
});

test("decorateRatherPlayer adds photo, initials, and roster meta", () => {
  const decorated = decorateRatherPlayer(
    { assetId: "player:11564", playerId: "11564", name: "Drake Maye", value: 8510 },
    { 11564: { position: "QB", team: "NE" } }
  );
  assert.equal(decorated.initials, "DM");
  assert.equal(decorated.meta, "QB · NE");
  assert.equal(decorated.photoUrl, sleeperPlayerThumbUrl("11564"));
  assert.equal(playerInitials("Ja'Marr Chase"), "JC");
});

test("rather cards show age plus last-season stats or rookie draft slot", () => {
  assert.equal(formatRatherPlayerMeta({ position: "QB", team: "NE", age: 24 }), "QB · NE · 24y");
  assert.equal(formatRatherPlayerMeta({ position: "WR", team: "WAS", age: 22, depthChart: "WR3" }), "WR3 · WAS · 22y");
  assert.equal(formatRatherPlayerMeta({ position: "QB", team: "NE", age: 24, depthChart: "QB1" }), "QB1 · NE · 24y");
  assert.equal(ratherDepthChartFromNfl({ depth_chart_order: 1, depth_chart_position: "QB" }, "QB"), "QB1");
  assert.equal(ratherDepthChartFromNfl({ depth_chart_order: 1, depth_chart_position: "LWR" }, "WR"), "WR1");
  assert.equal(ratherDepthChartFromNfl({ depth_chart_order: 3, depth_chart_position: "QB" }, "QB"), "QB3");
  assert.equal(ratherDepthChartFromNfl({ position: "RB" }, "RB"), "");
  assert.equal(
    formatRatherSeasonStats({ gp: 17, pass_yd: 4394, pass_td: 31, pass_int: 8 }, "QB"),
    "4,394 pass yds · 31 TD · 8 INT"
  );
  assert.equal(
    formatRatherSeasonStats({ gp: 4, rec: 18, rec_yd: 271, rec_td: 2 }, "WR"),
    "18 rec · 271 yds · 2 TD"
  );
  assert.equal(formatRatherDraftLine({ round: 1, pick: 3 }), "1st round · pick 3");
  assert.equal(formatRatherDraftLine(null), "Rookie");
  assert.equal(
    formatRatherPlayerDetail({
      isRookie: false,
      stats: { gp: 17, pass_yd: 4394, pass_td: 31, pass_int: 8 },
      position: "QB",
      previousSeason: "2025",
    }),
    "2025 · 4,394 pass yds · 31 TD · 8 INT"
  );
  assert.equal(
    formatRatherPlayerDetail({ isRookie: true, draft: { round: 1, pick: 3 } }),
    "1st round · pick 3"
  );
  assert.equal(isRatherRookie({ years_exp: 0, metadata: { rookie_year: "2026" } }, "2026"), true);
  assert.equal(isRatherRookie({ years_exp: 1, metadata: { rookie_year: "2025" } }, "2026"), false);

  const vet = decorateRatherPlayer(
    { assetId: "player:11564", playerId: "11564", name: "Drake Maye", value: 8510 },
    { 11564: { position: "QB", team: "NE", age: 24, years_exp: 2, depth_chart_position: "QB", depth_chart_order: 1 } },
    {
      currentSeason: "2026",
      previousSeason: "2025",
      seasonStats: { 11564: { gp: 17, pass_yd: 4394, pass_td: 31, pass_int: 8 } },
    }
  );
  assert.equal(vet.meta, "QB1 · NE · 24y");
  assert.equal(vet.detail, "2025 · 4,394 pass yds · 31 TD · 8 INT");

  const rookie = decorateRatherPlayer(
    { assetId: "player:13287", playerId: "13287", name: "Jeremiyah Love", value: 7187 },
    { 13287: { position: "RB", team: "ARI", age: 21, years_exp: 0, metadata: { rookie_year: "2026" }, depth_chart_position: "RB", depth_chart_order: 1 } },
    {
      currentSeason: "2026",
      previousSeason: "2025",
      draftPicks: { 13287: { year: 2026, round: 1, pick: 3, name: "Jeremiyah Love" } },
      seasonStats: { 13287: { gp: 1, rush_yd: 41 } },
    }
  );
  assert.equal(rookie.meta, "RB1 · ARI · 21y");
  assert.equal(rookie.detail, "1st round · pick 3");
  assert.match(rookie.detail, /pick 3/);
  assert.doesNotMatch(rookie.detail, /rush yds/);
});

test("draft pick lookup reads bundled sleeper ids and name fallback", () => {
  const picks = parseRatherDraftPicks({
    picks: { 13287: { year: 2026, round: 1, pick: 3, name: "Jeremiyah Love" } },
  });
  assert.deepEqual(lookupRatherDraftPick("13287", picks), {
    year: 2026,
    round: 1,
    pick: 3,
    name: "Jeremiyah Love",
  });
  assert.equal(lookupRatherDraftPick("missing", picks, { full_name: "Jeremiyah Love" }).pick, 3);

  const bundled = parseRatherDraftPicks(JSON.parse(readFileSync(join(docs, "data/nfl_draft_picks.json"), "utf8")));
  assert.equal(bundled["13287"].round, 1);
  assert.equal(bundled["13287"].pick, 3);
});

test("renderRatherMarkup shows headline, format detail, and two players", () => {
  const html = renderRatherMarkup({
    left: decorateRatherPlayer(
      { assetId: "player:11564", playerId: "11564", name: "Drake Maye", value: 8510 },
      { 11564: { position: "QB", team: "NE", age: 24, years_exp: 2, depth_chart_position: "QB", depth_chart_order: 1 } },
      {
        currentSeason: "2026",
        previousSeason: "2025",
        seasonStats: { 11564: { gp: 17, pass_yd: 4394, pass_td: 31, pass_int: 8 } },
      }
    ),
    right: decorateRatherPlayer(
      { assetId: "player:13287", playerId: "13287", name: "Jeremiyah Love", value: 7187 },
      { 13287: { position: "RB", team: "ARI", age: 21, years_exp: 0, depth_chart_position: "RB", depth_chart_order: 1 } },
      {
        currentSeason: "2026",
        previousSeason: "2025",
        draftPicks: { 13287: { year: 2026, round: 1, pick: 3 } },
      }
    ),
  });
  assert.match(html, /Who would you rather have\?/);
  assert.match(html, /PPR 12-man Superflex/);
  assert.match(html, /full PPR scoring · 12-man league · Superflex QB/);
  assert.match(html, /Drake Maye/);
  assert.match(html, /Jeremiyah Love/);
  assert.match(html, /QB1 · NE · 24y/);
  assert.match(html, /2025 · 4,394 pass yds · 31 TD · 8 INT/);
  assert.match(html, /RB1 · ARI · 21y/);
  assert.match(html, /1st round · pick 3/);
  assert.match(html, /class="rather-stats"/);
  assert.doesNotMatch(html, /Dynasty asset/);
  assert.match(html, /data-rather-pick="player:11564"/);
  assert.match(html, /id="rather-skip"/);
  assert.match(html, />Skip</);
  assert.match(html, /aria-label="Skip this matchup"/);
  assert.match(html, /Sleeper trades mixed with KeepTradeCut/);
  assert.doesNotMatch(html, /Desk Crowd/);
  assert.doesNotMatch(html, /8510/);
});

test("votes and recent pairs persist in browser storage", () => {
  const storage = memoryStorage();
  recordRatherVote({
    winnerId: "player:11564",
    loserId: "player:11632",
    format: DEFAULT_RATHER_FORMAT,
    at: 1700000000000,
  }, storage);
  const votes = readRatherVotes(storage);
  assert.equal(votes[0].winnerId, "player:11564");
  assert.equal(votes[0].loserId, "player:11632");
  assert.equal(votes[0].format, "PPR 12-man Superflex");
  assert.equal(JSON.parse(storage.memory.get(RATHER_VOTES_KEY)).length, 1);

  pushRatherRecentKey("player:11564|player:11632", storage);
  assert.deepEqual(readRatherRecentKeys(storage), ["player:11564|player:11632"]);

  assert.equal(readRatherSessionDone(storage), false);
  writeRatherSessionDone(storage);
  assert.equal(storage.memory.get(RATHER_SESSION_KEY), "1");
  assert.equal(readRatherSessionDone(storage), true);
});

test("applyRatherOverlayHidden toggles the hidden attribute", () => {
  const classes = new Set();
  const overlay = {
    hidden: false,
    classList: {
      toggle(name, force) {
        if (force) classes.add(name);
        else classes.delete(name);
      },
    },
  };
  applyRatherOverlayHidden(overlay, true);
  assert.equal(overlay.hidden, true);
  assert.equal(classes.has("hidden"), true);
});

test("index puts rather on the landing page and never auto-opens a league overlay", () => {
  const index = readFileSync(join(docs, "index.html"), "utf8");
  const css = readFileSync(join(docs, "styles.css"), "utf8");
  const app = readFileSync(join(docs, "app.js"), "utf8");
  assert.match(index, /id="landing-rather"/);
  assert.match(index, /id="landing-username"/);
  assert.match(index, /id="landing-find-btn"/);
  assert.match(index, /Who would you rather have\?/);
  assert.doesNotMatch(index, /id="rather-overlay"/);
  assert.doesNotMatch(index, /id="landing-focus-btn"/);
  assert.match(css, /\.landing-rather\s*\{/);
  assert.match(css, /Phone landing: search first/);
  assert.match(css, /\.landing-rather \.rather-duel\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto minmax\(0, 1fr\)/s);
  assert.doesNotMatch(css, /\.rather-overlay:not\(\[hidden\]\)/);
  assert.match(css, /\.rather-stats\s*\{/);
  assert.match(app, /bootLandingRather/);
  assert.match(app, /landingSearchOffscreen/);
  assert.doesNotMatch(app, /function chooseRatherPlayer[\s\S]*loadLeagueById/);
});

test("rankRatherPlayers prefers the crowd-shifted player", () => {
  const ranked = rankRatherPlayers(
    [
      { assetId: "player:a", name: "A", value: 8000 },
      { assetId: "player:b", name: "B", value: 7990 },
    ],
    { "player:b": 0.08, "player:a": -0.08 }
  );
  assert.equal(ranked[0].assetId, "player:b");
});
