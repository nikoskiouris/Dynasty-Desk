import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const app = readFileSync(join(root, "docs/app.js"), "utf8");

test("equal-sized calculator packages do not receive a consolidation premium", () => {
  const start = app.indexOf("function calculatePackageAdjustment");
  const end = app.indexOf("function buildPackages", start);
  const block = app.slice(start, end);
  assert.match(block, /myValues\.length === theirValues\.length/);
  assert.match(block, /packageAdjustment:\s*0/);
});

test("rather valuations follow the active SF or 1QB format", () => {
  const start = app.indexOf("function ratherMarketValues");
  const end = app.indexOf("function crowdVoteSource", start);
  const block = app.slice(start, end);
  assert.match(block, /state\.valueFormat === "oneQb"/);
  assert.match(block, /state\.valueBundles\?\.\[format\]/);
});

test("vote UI distinguishes saving, saved, and failed persistence", () => {
  const start = app.indexOf("async function chooseRatherPlayer");
  const end = app.indexOf("function handleLandingRatherClick", start);
  const block = app.slice(start, end);
  assert.match(block, /Saving vote/);
  assert.match(block, /Vote not saved/);
  assert.match(block, /Saved\./);
  assert.ok(block.indexOf("submitRatherCrowdVote") < block.indexOf("recordRatherVote"));
});

test("open clients refresh shared crowd evidence", () => {
  assert.match(app, /ensureCrowdRefreshTimer/);
  assert.match(app, /60_000/);
  assert.match(app, /fetchRatherCrowdVotes/);
});

test("valuation-dependent caches key off a valuation revision instead of map size", () => {
  assert.match(app, /function valuationCacheVersion/);
  const uses = app.match(/valuationCacheVersion\(\)/g) || [];
  assert.ok(uses.length >= 4);
  const simStart = app.indexOf("function simSignature");
  const simEnd = app.indexOf("function stopLivePolling", simStart);
  assert.doesNotMatch(app.slice(simStart, simEnd), /Object\.keys\(state\.values\)\.length/);
});
