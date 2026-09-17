import test from "node:test";
import assert from "node:assert/strict";
import {
  blendMarketValues,
  coerceTradeMarketBundle,
  composeValuationBundles,
  enforcePickCoherence,
  fetchTradeMarketBundle,
  tradeBlendWeight,
  VALUATION_MODEL_VERSION,
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

test("composeValuationBundles keeps names, metadata, and a valuation version", () => {
  const composed = composeValuationBundles(
    {
      sf: { values: { "player:1": 4000 }, nameMap: { "player:1": "Star" } },
      oneQb: { values: { "player:1": 3000 }, nameMap: { "player:1": "Star" } },
      names: { "player:1": "Star" },
    },
    {
      sf: { values: { "player:1": 5200 }, counts: { "player:1": 12 } },
      oneQb: { values: { "player:1": 3100 }, counts: { "player:1": 3 } },
      meta: { tradeCount: 99, leagueCount: 8, updatedAt: "2026-09-17T17:06:29Z" },
    },
  );
  assert.ok(composed.sf.values["player:1"] > 4000);
  assert.ok(composed.sf.values["player:1"] > composed.oneQb.values["player:1"]);
  assert.equal(composed.names["player:1"], "Star");
  assert.equal(composed.tradeMeta.tradeCount, 99);
  assert.equal(composed.modelVersion, VALUATION_MODEL_VERSION);
  assert.match(composed.valuationVersion, /^market-v2:/);
});

test("missing 1QB trade evidence stays missing instead of inheriting Superflex", () => {
  const payload = coerceTradeMarketBundle({
    sf: { values: { "player:qb": 9000 }, counts: { "player:qb": 8 } },
  });
  assert.equal(payload.sf.values["player:qb"], 9000);
  assert.deepEqual(payload.oneQb.values, {});
});

test("sparse future-pick trade evidence stays anchored to a time-adjusted prior", () => {
  const ktc = {
    "pick:2027:r1:any": 5200,
    "pick:2027:r2:any": 2800,
  };
  const trades = {
    "pick:2029:r1:any": 1800,
    "pick:2029:r2:any": 6000,
  };
  const counts = {
    "pick:2029:r1:any": 1,
    "pick:2029:r2:any": 1,
  };
  const blended = blendMarketValues(ktc, trades, counts);
  assert.ok(blended["pick:2029:r1:any"] > blended["pick:2029:r2:any"]);
  assert.ok(blended["pick:2029:r1:any"] > 1800);
  assert.ok(blended["pick:2029:r2:any"] < 6000);
});

test("pick coherence prevents a same-year second from outranking a first", () => {
  const fixed = enforcePickCoherence({
    "pick:2029:r1:any": 1803,
    "pick:2029:r2:any": 2269,
    "pick:2030:r1:early": 5000,
    "pick:2030:r1:mid": 5600,
    "pick:2030:r1:late": 5900,
    "pick:2030:r1:any": 6100,
  });
  assert.ok(fixed["pick:2029:r1:any"] > fixed["pick:2029:r2:any"]);
  assert.ok(fixed["pick:2030:r1:early"] >= fixed["pick:2030:r1:mid"]);
  assert.ok(fixed["pick:2030:r1:mid"] >= fixed["pick:2030:r1:late"]);
  assert.ok(fixed["pick:2030:r1:any"] <= fixed["pick:2030:r1:early"]);
  assert.ok(fixed["pick:2030:r1:any"] >= fixed["pick:2030:r1:late"]);
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
