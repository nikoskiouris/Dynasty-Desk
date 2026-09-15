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

test("share params map old recap/home tabs onto league", () => {
  const url = buildShareUrl({
    origin: "https://nikoskiouris.github.io",
    pathname: "/FantasyDynastyAnalyzer/",
    leagueId: "1315165104303513600",
    meRosterId: 3,
    tab: "recap",
    week: 2,
    tone: "roast",
  });
  assert.doesNotMatch(url, /tab=/);
  assert.match(url, /view=recap/);
  assert.match(url, /week=2/);
  assert.match(url, /tone=roast/);
  const parsed = parseShareParams(url.split("?")[1]);
  assert.equal(parsed.tab, "");
  assert.equal(parsed.view, "recap");
  assert.equal(parsed.week, 2);
  assert.equal(parsed.tone, "roast");
  assert.equal(parsed.meRosterId, 3);
  assert.equal(parseShareParams("league=1&tab=recap").tab, "league");
  assert.equal(parseShareParams("league=1&tab=teams").tab, "team");
  assert.equal(parseShareParams("league=1&tab=trader").tab, "trader");
  assert.equal(parseShareParams("league=1&tab=trader").view, "history");
});

test("share params keep trade rooms on the trades tab", () => {
  const passportUrl = buildShareUrl({
    origin: "https://nikoskiouris.github.io",
    pathname: "/FantasyDynastyAnalyzer/",
    leagueId: "1315165104303513600",
    tab: "trader",
    view: "passport",
  });
  assert.match(passportUrl, /tab=trader/);
  assert.match(passportUrl, /view=passport/);
  assert.equal(parseShareParams(passportUrl.split("?")[1]).view, "passport");

  const historyUrl = buildShareUrl({
    origin: "https://nikoskiouris.github.io",
    pathname: "/FantasyDynastyAnalyzer/",
    leagueId: "1",
    tab: "trader",
    view: "history",
  });
  assert.match(historyUrl, /tab=trader/);
  assert.doesNotMatch(historyUrl, /view=/);

  assert.equal(parseShareParams("league=1&tab=calculator").tab, "trader");
  assert.equal(parseShareParams("league=1&tab=calculator").view, "calculator");
  assert.equal(parseShareParams("league=1&tab=generator").view, "lab");
  assert.equal(parseShareParams("league=1&tab=history").tab, "league");
  assert.equal(parseShareParams("league=1&tab=history").view, "hall");
  assert.equal(parseShareParams("league=1&tab=awards").view, "awards");
  assert.equal(parseShareParams("league=1&tab=analytics").view, "hall");
  assert.equal(parseShareParams("league=1&view=hall").view, "hall");
  assert.equal(parseShareParams("league=1").view, "now");
});
