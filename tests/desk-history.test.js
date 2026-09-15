import test from "node:test";
import assert from "node:assert/strict";
import { buildDeskHistorySnapshot, deskPlaceKey, isSameDeskPlace } from "../docs/modules/desk-history.js";

test("desk place ignores scroll so back can restore it", () => {
  const league = buildDeskHistorySnapshot({ tab: "league", view: "now", scrollY: 80 });
  const later = buildDeskHistorySnapshot({ tab: "league", view: "now", scrollY: 900 });
  assert.equal(isSameDeskPlace(league, later), true);
  assert.equal(deskPlaceKey(league), "league|now||");
});

test("tabs, rooms, and open trades are different places", () => {
  const team = buildDeskHistorySnapshot({ tab: "team" });
  const trades = buildDeskHistorySnapshot({ tab: "trader", view: "history" });
  const passport = buildDeskHistorySnapshot({ tab: "trader", view: "passport" });
  const file = buildDeskHistorySnapshot({ tab: "trader", view: "history", selectedTradeId: "abc", selectedTradeManagerKey: "user:1" });
  assert.equal(isSameDeskPlace(team, trades), false);
  assert.equal(isSameDeskPlace(trades, passport), false);
  assert.equal(isSameDeskPlace(trades, file), false);
});
