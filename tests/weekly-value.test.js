import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DOUBLE_TEAM_MISSING,
  DYNASTY_SCORE_LABEL,
  NFL_SCHEDULE_PATH,
  NO_RECENT_GAMES,
  OPPONENT_MISSING,
  TARGET_SHARE_MISSING,
  WEEKLY_SCORE_HINT,
  WEEKLY_SCORE_LABEL,
  formatWeeklyScore,
  weeklyScoreChipLabel,
  buildWeeklyContext,
  buildWeeklyPlayerModel,
  dropPctFromStats,
  indexNflSchedule,
  lookupScheduledOpponent,
  normalizeNflTeam,
  opponentsFromTeamStats,
  renderWeeklyPlayerSheet,
  scoreWeeklyValue,
  targetShareFromStats,
  weeksForWeeklyValue,
} from "../docs/modules/weekly-value.js";

const docs = join(dirname(fileURLToPath(import.meta.url)), "../docs");

test("NFL aliases land on Sleeper team codes", () => {
  assert.equal(normalizeNflTeam("wsh"), "WAS");
  assert.equal(normalizeNflTeam("JAC"), "JAX");
  assert.equal(normalizeNflTeam("LA"), "LAR");
});

test("2026 week 2 schedule has DET at BUF", () => {
  const payload = JSON.parse(readFileSync(join(docs, NFL_SCHEDULE_PATH.replace("./", "")), "utf8"));
  const index = indexNflSchedule(payload);
  assert.deepEqual(lookupScheduledOpponent(index, "2026", 2, "BUF"), {
    opponent: "DET",
    home: true,
    bye: false,
    missing: "",
  });
  assert.equal(lookupScheduledOpponent(index, "2026", 5, "BUF").bye || Boolean(lookupScheduledOpponent(index, "2026", 5, "BUF").opponent), true);
});

test("weeks walk back into the previous season", () => {
  assert.deepEqual(
    weeksForWeeklyValue({ season: "2026", week: 2, previousSeason: "2025", count: 3 }).slice(0, 4),
    [
      { season: "2026", week: 2 },
      { season: "2026", week: 1 },
      { season: "2025", week: 18 },
      { season: "2025", week: 17 },
    ]
  );
});

test("target share and drops stay honest when pieces are missing", () => {
  assert.equal(targetShareFromStats({ rec_tgt: 8 }, { rec_tgt: 32 }), 0.25);
  assert.equal(targetShareFromStats({ rec_tgt: 8 }, {}), null);
  assert.equal(dropPctFromStats({ rec_tgt: 10, rec_drop: 2 }), 0.2);
  assert.equal(dropPctFromStats({ rec_tgt: 10 }), null);
});

test("TEAM stat pairing recovers opponents when yards match", () => {
  const paired = opponentsFromTeamStats({
    TEAM_SEA: { off_yd: 400, opp_off_yd: 250 },
    TEAM_NE: { off_yd: 250, opp_off_yd: 400 },
    TEAM_BUF: { off_yd: 111, opp_off_yd: 222 },
  });
  assert.equal(paired.SEA, "NE");
  assert.equal(paired.NE, "SEA");
  assert.equal(paired.BUF, undefined);
});

test("easy opponent lifts weekly score and a hard one cuts it", () => {
  const base = {
    position: "WR",
    recentPoints: 14,
    targetShare: 0.22,
    dropPct: 0.05,
    doubleTeamRate: null,
  };
  const easy = scoreWeeklyValue({ ...base, opponentPtsAllowed: 28, opponentLeagueAvg: 14 });
  const hard = scoreWeeklyValue({ ...base, opponentPtsAllowed: 8, opponentLeagueAvg: 14 });
  assert.ok(easy.score > hard.score, `easy ${easy.score} should beat hard ${hard.score}`);
  assert.equal(easy.matchupMult > hard.matchupMult, true);
  assert.ok(easy.missing.includes(DOUBLE_TEAM_MISSING));
  assert.equal(easy.complete, false);
});

test("dynasty market value never enters the weekly blend", () => {
  const left = scoreWeeklyValue({
    position: "WR",
    recentPoints: 12,
    targetShare: 0.2,
    dropPct: 0.08,
    opponentPtsAllowed: 18,
    opponentLeagueAvg: 16,
    dynastyValue: 9000,
  });
  const right = scoreWeeklyValue({
    position: "WR",
    recentPoints: 12,
    targetShare: 0.2,
    dropPct: 0.08,
    opponentPtsAllowed: 18,
    opponentLeagueAvg: 16,
    dynastyValue: 400,
  });
  assert.equal(left.score, right.score);
});

test("missing target share is visible and does not invent a usage rate", () => {
  const scored = scoreWeeklyValue({
    position: "WR",
    recentPoints: 11,
    opponentPtsAllowed: 16,
    opponentLeagueAvg: 16,
  });
  assert.ok(scored.missing.includes(TARGET_SHARE_MISSING));
  assert.ok(scored.missing.includes(DOUBLE_TEAM_MISSING));
  assert.equal(scored.usage, 1);
});

test("player sheet keeps weekly and dynasty on separate badges", () => {
  const context = buildWeeklyContext({
    season: "2026",
    week: 2,
    schedule: { games: [{ season: "2026", week: 1, home: "SEA", away: "NE" }, { season: "2026", week: 2, home: "SEA", away: "ARI" }] },
    players: {
      111: { team: "SEA", position: "WR" },
      222: { team: "NE", position: "WR" },
      333: { team: "ARI", position: "WR" },
    },
    weekRows: [
      {
        season: "2026",
        week: 1,
        stats: {
          111: { gp: 1, rec_tgt: 10, rec_drop: 1, rec: 7, pts_ppr: 18 },
          222: { gp: 1, rec_tgt: 8, rec_drop: 0, rec: 6, pts_ppr: 22 },
          TEAM_SEA: { rec_tgt: 40, rec_drop: 3, rush_att: 22, off_yd: 380, opp_off_yd: 260, opp_pass_fd: 14, opp_rush_fd: 8, opp_fd: 22 },
          TEAM_NE: { rec_tgt: 35, rec_drop: 1, rush_att: 20, off_yd: 260, opp_off_yd: 380, opp_pass_fd: 12, opp_rush_fd: 9, opp_fd: 21 },
        },
      },
    ],
  });
  const model = buildWeeklyPlayerModel({
    playerId: "111",
    name: "Demo WR",
    position: "WR",
    team: "SEA",
    dynastyValue: 8412,
    seasonStats: { gp: 1, pts_ppr: 18 },
    context,
  });
  assert.equal(model.inputs.length, 4);
  assert.equal(model.inputs.find((input) => input.id === "doubleTeam").missing, DOUBLE_TEAM_MISSING);
  assert.equal(model.upcomingOpponent, "ARI");
  assert.ok(model.score >= 1);
  const html = renderWeeklyPlayerSheet(model);
  assert.match(html, /class="weekly-score-badge"/);
  assert.match(html, /class="dynasty-value-badge"/);
  assert.match(html, new RegExp(WEEKLY_SCORE_LABEL));
  assert.match(html, new RegExp(DYNASTY_SCORE_LABEL));
  assert.match(html, /8,412/);
  assert.match(html, /no double-team data/);
  assert.match(html, /\/99/);
  assert.match(html, /Start juice this week\. Not trade value\./);
  assert.doesNotMatch(html, /Incomplete —/);
  assert.doesNotMatch(html, /class="weekly-score-badge"[^>]*>[^<]*Dynasty/);
  const css = readFileSync(join(docs, "styles.css"), "utf8");
  assert.match(css, /\.weekly-score-badge\s*\{/);
  assert.match(css, /\.dynasty-value-badge\s*\{/);
  assert.match(css, /\.weekly-score-max\s*\{/);
  assert.match(css, /\.sheet-metrics\s*\{[^}]*padding:/s);
  assert.match(css, /\.weekly-chip,\s*\.dynasty-chip\s*\{[^}]*display:\s*flex/s);
  assert.ok(!html.includes(NO_RECENT_GAMES) || model.games.length === 0);
});

test("weekly score prints 1–99 scale", () => {
  assert.equal(formatWeeklyScore(59), "59/99");
  assert.equal(formatWeeklyScore(null), "—");
  assert.equal(weeklyScoreChipLabel({ score: 22 }), "22/99");
  assert.match(WEEKLY_SCORE_HINT, /Not trade value/);
});

test("bye week and unknown players fail opponent strength visibly", () => {
  const context = buildWeeklyContext({
    season: "2026",
    week: 5,
    schedule: { games: [{ season: "2026", week: 5, home: "KC", away: "LV" }] },
    players: { 9: { team: "BUF", position: "WR" } },
    weekRows: [],
  });
  const model = buildWeeklyPlayerModel({
    playerId: "9",
    name: "Bye WR",
    position: "WR",
    team: "BUF",
    context,
  });
  assert.ok(model.missing.includes(OPPONENT_MISSING));
  assert.equal(model.inputs.find((input) => input.id === "opponent").value, "Bye");
});
