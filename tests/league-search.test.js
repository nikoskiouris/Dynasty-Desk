import test from "node:test";
import assert from "node:assert/strict";
import { leagueStatusLabel, renderLeaguePickerMarkup } from "../docs/modules/league-search.js";

test("leagueStatusLabel humanizes sleeper status", () => {
  assert.equal(leagueStatusLabel("in_season"), "in season");
  assert.equal(leagueStatusLabel(""), "league");
});

test("league picker markup lists seasons and marks the selected league", () => {
  const html = renderLeaguePickerMarkup([
    { league_id: "111", name: "Try Hard or Die Hard", season: "2026", total_rosters: 12, status: "in_season", avatar: "abc123" },
    { league_id: "222", name: "Old Room", season: "2025", total_rosters: 10, status: "complete" },
  ], "2026", "111");
  assert.match(html, /Try Hard or Die Hard/);
  assert.match(html, /data-league-id="111"/);
  assert.match(html, /league-pick current selected/);
  assert.match(html, /alt="Try Hard or Die Hard logo"/);
  assert.match(html, /2025 · 10 teams · complete/);
  assert.equal(renderLeaguePickerMarkup([]), "");
});
