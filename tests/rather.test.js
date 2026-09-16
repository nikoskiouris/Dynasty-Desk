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
  formatRatherHeadline,
  listRatherPlayers,
  pairKey,
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

test("renderRatherMarkup shows headline, format detail, and two players", () => {
  const html = renderRatherMarkup({
    left: decorateRatherPlayer({ assetId: "player:11564", playerId: "11564", name: "Drake Maye", value: 8510 }),
    right: decorateRatherPlayer({ assetId: "player:11632", playerId: "11632", name: "Malik Nabers", value: 7223 }),
  });
  assert.match(html, /Who would you rather have\?/);
  assert.match(html, /PPR 12-man Superflex/);
  assert.match(html, /full PPR scoring · 12-man league · Superflex QB/);
  assert.match(html, /Drake Maye/);
  assert.match(html, /Malik Nabers/);
  assert.doesNotMatch(html, /Dynasty asset/);
  assert.match(html, /data-rather-pick="player:11564"/);
  assert.match(html, /id="rather-skip"/);
  assert.match(html, /Skip this matchup/);
  assert.match(html, /Sleeper trades mixed with KeepTradeCut/);
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
  assert.doesNotMatch(css, /\.rather-overlay:not\(\[hidden\]\)/);
  assert.match(app, /bootLandingRather/);
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
