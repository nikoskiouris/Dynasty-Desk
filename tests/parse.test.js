import test from "node:test";
import assert from "node:assert/strict";
import {
  parseLeagueId,
  normalizeUsername,
  classifyLeagueInput,
  uniqueSeasons,
  sortUserLeagues,
  parseShareParams,
  buildShareUrl,
  bootSearchFieldValues,
} from "../docs/modules/parse.js";

test("parseLeagueId reads snowflake, path, and embedded URL", () => {
  assert.equal(parseLeagueId("1315165104303513600"), "1315165104303513600");
  assert.equal(parseLeagueId("https://sleeper.app/leagues/1315165104303513600"), "1315165104303513600");
  assert.equal(parseLeagueId("  https://sleeper.app/leagues/1315165104303513600/matchup  "), "1315165104303513600");
  assert.equal(parseLeagueId(""), "");
  assert.equal(parseLeagueId("nikoskiouris"), "");
});

test("classifyLeagueInput prefers username unless the text is clearly a league", () => {
  assert.equal(classifyLeagueInput("").kind, "empty");
  assert.equal(classifyLeagueInput("NikoSkiouris").kind, "username");
  assert.equal(classifyLeagueInput("@niko").username, "niko");
  assert.equal(classifyLeagueInput("https://sleeper.app/u/NikoSkiouris").username, "NikoSkiouris");
  assert.equal(classifyLeagueInput("1315165104303513600").kind, "league");
  assert.equal(classifyLeagueInput("https://sleeper.app/leagues/1315165104303513600").kind, "league");
});

test("uniqueSeasons walks backward from the NFL season", () => {
  assert.deepEqual(uniqueSeasons(2026, 1), ["2026", "2025"]);
});

test("sortUserLeagues puts the current in-season league first", () => {
  const sorted = sortUserLeagues([
    { name: "Old", season: "2025", status: "complete", total_rosters: 12 },
    { name: "Zeta", season: "2026", status: "in_season", total_rosters: 8 },
    { name: "Alpha", season: "2026", status: "in_season", total_rosters: 12 },
  ], "2026");
  assert.equal(sorted[0].name, "Alpha");
  assert.equal(sorted[1].name, "Zeta");
  assert.equal(sorted[2].name, "Old");
});

test("boot search fields stay blank unless the URL has a league", () => {
  assert.deepEqual(bootSearchFieldValues(), { username: "", leagueId: "" });
  assert.deepEqual(bootSearchFieldValues({ leagueFromUrl: "" }), { username: "", leagueId: "" });
  assert.deepEqual(bootSearchFieldValues({ leagueFromUrl: "  1315165104303513600  " }), {
    username: "",
    leagueId: "1315165104303513600",
  });
});

test("share params round-trip week and recap tone", () => {
  const url = buildShareUrl({
    origin: "https://nikoskiouris.github.io",
    pathname: "/FantasyDynastyAnalyzer/",
    leagueId: "1315165104303513600",
    meRosterId: 3,
    tab: "recap",
    week: 2,
    tone: "roast",
  });
  assert.match(url, /tab=recap/);
  assert.match(url, /week=2/);
  assert.match(url, /tone=roast/);
  const parsed = parseShareParams(url.split("?")[1]);
  assert.equal(parsed.tab, "recap");
  assert.equal(parsed.week, 2);
  assert.equal(parsed.tone, "roast");
  assert.equal(parsed.meRosterId, 3);
});
