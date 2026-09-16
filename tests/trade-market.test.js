import test from "node:test";
import assert from "node:assert/strict";
import {
  blendMarketValues,
  coerceTradeMarketBundle,
  composeValuationBundles,
  fetchTradeMarketBundle,
  tradeBlendWeight,
} from "../docs/modules/trade-market.js";

test("more Sleeper trades pull the blended value toward the trade price", () => {
  const ktc = { "player:pw": 5000, "player:star": 9000 };
  const trades = { "player:pw": 7000, "player:star": 8800 };
  const one = blendMarketValues(ktc, trades, { "player:pw": 1, "player:star": 1 });
  const many = blendMarketValues(ktc, trades, { "player:pw": 18, "player:star": 18 });
  assert.ok(one["player:pw"] > 5000);
  assert.ok(one["player:pw"] < many["player:pw"]);
  assert.ok(many["player:pw"] > 6400);
  assert.ok(many["player:pw"] < 7000);
  assert.equal(blendMarketValues(ktc, {}, {})["player:pw"], 5000);
  assert.ok(tradeBlendWeight(18) > 0.85);
  assert.equal(tradeBlendWeight(0), 0);
});

test("composeValuationBundles keeps KeepTradeCut names and trade counts", () => {
  const composed = composeValuationBundles(
    {
      sf: { values: { "player:1": 4000 }, nameMap: { "player:1": "Star" } },
      oneQb: { values: { "player:1": 3000 }, nameMap: { "player:1": "Star" } },
      names: { "player:1": "Star" },
    },
    {
      sf: { values: { "player:1": 5200 }, counts: { "player:1": 12 } },
      oneQb: { values: { "player:1": 3100 }, counts: { "player:1": 3 } },
      meta: { tradeCount: 99, leagueCount: 8 },
    },
  );
  assert.ok(composed.sf.values["player:1"] > 4000);
  assert.ok(composed.sf.values["player:1"] > composed.oneQb.values["player:1"]);
  assert.equal(composed.names["player:1"], "Star");
  assert.equal(composed.tradeMeta.tradeCount, 99);
});

test("fetchTradeMarketBundle survives a missing file", async () => {
  const missing = await fetchTradeMarketBundle(async () => ({ ok: false, status: 404, json: async () => null }));
  assert.deepEqual(missing.sf.values, {});
  const payload = coerceTradeMarketBundle({
    sf: { "player:1": 1111 },
    meta: { tradeCount: 4 },
  });
  assert.equal(payload.sf.values["player:1"], 1111);
});
