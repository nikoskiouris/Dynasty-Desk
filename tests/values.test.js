import test from "node:test";
import assert from "node:assert/strict";
import {
  parseCsvValues,
  leagueHasSuperflex,
  tepLevel,
  tepMultiplier,
  selectValueFormat,
  getAssetValue,
  isEstimatedAsset,
  parsePickAssetId,
  resolvePickAssetValue,
  fetchValuationBundles,
  pickValueBundle,
} from "../docs/modules/values.js";

test("parseCsvValues reads asset rows", () => {
  const parsed = parseCsvValues("asset_id,value,name\nplayer:1,8000,Star\npick:2026:r1:any,5000,2026 1st\n");
  assert.equal(parsed.values["player:1"], 8000);
  assert.equal(parsed.nameMap["pick:2026:r1:any"], "2026 1st");
});

test("superflex vs 1QB format pick", () => {
  assert.equal(selectValueFormat({ roster_positions: ["QB", "RB", "SUPER_FLEX"] }), "sf");
  assert.equal(selectValueFormat({ roster_positions: ["QB", "RB", "WR", "TE", "FLEX"] }), "oneQb");
  assert.equal(leagueHasSuperflex({ roster_positions: ["QB", "QB", "RB"] }), true);
});

test("TEP bump applies only to tight ends", () => {
  const league = { scoring_settings: { bonus_rec_te: 1 } };
  assert.equal(tepLevel(league), 2);
  assert.equal(tepMultiplier(2), 1.12);
  const te = { assetId: "player:te", assetType: "player", raw: { position: "TE" } };
  const wr = { assetId: "player:wr", assetType: "player", raw: { position: "WR" } };
  const values = { "player:te": 4000, "player:wr": 4000 };
  assert.equal(getAssetValue(te, values, { league }), Math.round(4000 * 1.12));
  assert.equal(getAssetValue(wr, values, { league }), 4000);
});

test("missing market numbers are estimated and labeled", () => {
  const asset = { assetId: "player:unknown", assetType: "player", raw: { position: "WR", age: 24 } };
  assert.equal(isEstimatedAsset(asset, {}), true);
  assert.ok(getAssetValue(asset, {}) > 1000);
  const known = { assetId: "player:1", assetType: "player", raw: { position: "WR" } };
  assert.equal(isEstimatedAsset(known, { "player:1": 3333 }), false);
});

test("elite premium still applies on KTC hits", () => {
  const star = { assetId: "player:gibbs", assetType: "player", raw: { position: "RB" } };
  assert.equal(getAssetValue(star, { "player:gibbs": 9000 }), Math.round(9000 * 1.32));
});

test("pick lookup uses season/round/any and nearest catalog year", () => {
  const pick = { assetId: "pick:2026:r1:late", assetType: "pick", raw: { season: 2026, round: 1, ktcBucket: "late" } };
  const values = { "pick:2026:r1:late": 6100, "pick:2026:r1:any": 5300 };
  assert.equal(resolvePickAssetValue(pick, values), 6100);
  const future = { assetId: "pick:2029:r2:any", assetType: "pick", raw: { season: 2029, round: 2 } };
  const catalogValues = { "pick:2027:r2:any": 3200 };
  assert.equal(resolvePickAssetValue(future, catalogValues), 3200);
  assert.deepEqual(parsePickAssetId("pick:2028:r1:early"), { season: "2028", round: 1, bucket: "early" });
});

test("pickValueBundle prefers 1QB or Superflex maps", () => {
  const payload = {
    sf: { values: { "player:1": 9000 }, nameMap: { "player:1": "Star" } },
    oneQb: { values: { "player:1": 6100 }, nameMap: { "player:1": "Star" } },
  };
  assert.equal(pickValueBundle(payload, "sf").values["player:1"], 9000);
  assert.equal(pickValueBundle(payload, "oneQb").values["player:1"], 6100);
});

test("fetchValuationBundles falls back from JSON to SF then sample CSV", async () => {
  const files = {
    "./data/ktc_values.json": { sf: { "player:1": 8000 }, oneQb: { "player:1": 5000 }, names: { "player:1": "Star" } },
  };
  const fetchImpl = async (path) => {
    if (!(path in files)) return { ok: false, status: 404, text: async () => "", json: async () => null };
    const body = files[path];
    return {
      ok: true,
      status: 200,
      json: async () => body,
      text: async () => String(body),
    };
  };
  const bundle = await fetchValuationBundles(fetchImpl);
  assert.equal(bundle.sf.values["player:1"], 8000);
  assert.equal(bundle.oneQb.values["player:1"], 5000);

  const csvFetch = async (path) => {
    if (path === "./data/ktc_values_sf.csv") {
      return { ok: true, text: async () => "asset_id,value,name\nplayer:9,1111,Nine\n" };
    }
    if (path === "./data/ktc_values_sample.csv") {
      return { ok: true, text: async () => "asset_id,value,name\nplayer:9,2222,Sample\n" };
    }
    return { ok: false, text: async () => "", json: async () => null };
  };
  const csvBundle = await fetchValuationBundles(csvFetch);
  assert.equal(csvBundle.sf.values["player:9"], 1111);
  assert.equal(csvBundle.oneQb.values["player:9"], 1111);
});
