import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  VISIT_COUNTED_KEY,
  applyVisitCount,
  isLiveDeskHost,
  loadDeskVisits,
  parseVisitCount,
  readVisitCounted,
  renderVisitCountMarkup,
  shouldTrackVisit,
  visitCountUrl,
  visitTrackUrl,
  writeVisitCounted,
} from "../docs/modules/visits.js";

const docs = join(dirname(fileURLToPath(import.meta.url)), "../docs");

test("visit URLs stay on the public GitHub Pages path", () => {
  assert.match(visitTrackUrl(), /\/track\?/);
  assert.match(visitTrackUrl(), /DynastyDesk/);
  assert.match(visitCountUrl(), /\/views\?/);
  assert.match(visitCountUrl(), /nikoskiouris\.github\.io/);
});

test("parseVisitCount only accepts whole non-negative totals", () => {
  assert.equal(parseVisitCount({ views: 12 }), 12);
  assert.equal(parseVisitCount({ views: 12.9 }), 12);
  assert.equal(parseVisitCount({ views: 0 }), 0);
  assert.equal(parseVisitCount({ views: -1 }), null);
  assert.equal(parseVisitCount({ views: "nope" }), null);
  assert.equal(parseVisitCount(null), null);
});

test("visit copy names people, not page loads", () => {
  assert.equal(renderVisitCountMarkup(1), "<strong>1</strong> person has viewed this desk");
  assert.match(renderVisitCountMarkup(1284), /1,284|1284/);
  assert.match(renderVisitCountMarkup(12), /people have viewed this desk/);
  assert.equal(renderVisitCountMarkup(null), "");
});

test("applyVisitCount hides until a total exists", () => {
  const node = { hidden: true, innerHTML: "stale" };
  applyVisitCount(node, null);
  assert.equal(node.hidden, true);
  assert.equal(node.innerHTML, "");
  applyVisitCount(node, 3);
  assert.equal(node.hidden, false);
  assert.match(node.innerHTML, /<strong>3<\/strong> people have viewed this desk/);
});

test("only the live GitHub Pages host records a first visit", () => {
  const memory = new Map();
  const storage = {
    getItem(key) {
      return memory.has(key) ? memory.get(key) : null;
    },
    setItem(key, value) {
      memory.set(key, String(value));
    },
  };
  assert.equal(isLiveDeskHost({ hostname: "127.0.0.1" }), false);
  assert.equal(isLiveDeskHost({ hostname: "nikoskiouris.github.io" }), true);
  assert.equal(readVisitCounted(storage), false);
  assert.equal(shouldTrackVisit({ location: { hostname: "localhost" }, storage }), false);
  assert.equal(shouldTrackVisit({ location: { hostname: "nikoskiouris.github.io" }, storage }), true);
  writeVisitCounted(storage);
  assert.equal(memory.get(VISIT_COUNTED_KEY), "1");
  assert.equal(shouldTrackVisit({ location: { hostname: "nikoskiouris.github.io" }, storage }), false);
});

test("loadDeskVisits pings once on the live host then reads the total", async () => {
  const calls = [];
  const memory = new Map();
  const storage = {
    getItem(key) {
      return memory.has(key) ? memory.get(key) : null;
    },
    setItem(key, value) {
      memory.set(key, String(value));
    },
  };
  const fetchFn = async (url) => {
    calls.push(url);
    if (String(url).includes("/track")) return { ok: true };
    return { ok: true, json: async () => ({ views: 42 }) };
  };

  const live = await loadDeskVisits({
    fetchFn,
    location: { hostname: "nikoskiouris.github.io" },
    storage,
  });
  assert.equal(live, 42);
  assert.equal(calls.length, 2);
  assert.match(calls[0], /\/track\?/);
  assert.match(calls[1], /\/views\?/);
  assert.equal(memory.get(VISIT_COUNTED_KEY), "1");

  calls.length = 0;
  const again = await loadDeskVisits({
    fetchFn,
    location: { hostname: "nikoskiouris.github.io" },
    storage,
  });
  assert.equal(again, 42);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /\/views\?/);
});

test("localhost reads the public total and does not ping", async () => {
  const calls = [];
  const fetchFn = async (url) => {
    calls.push(url);
    return { ok: true, json: async () => ({ views: 7 }) };
  };
  const count = await loadDeskVisits({
    fetchFn,
    location: { hostname: "127.0.0.1" },
    storage: { getItem: () => null, setItem() {} },
  });
  assert.equal(count, 7);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /\/views\?/);
});

test("a down counter leaves the desk quiet", async () => {
  const count = await loadDeskVisits({
    fetchFn: async () => {
      throw new Error("offline");
    },
    location: { hostname: "nikoskiouris.github.io" },
    storage: { getItem: () => "1", setItem() {} },
  });
  assert.equal(count, null);
});

test("index, notice, and privacy talk about the visit count", () => {
  const index = readFileSync(join(docs, "index.html"), "utf8");
  assert.match(index, /id="landing-visits"/);
  assert.match(index, /id="footer-visits"/);
  assert.match(index, /anonymous visit ping/);

  const privacy = readFileSync(join(docs, "privacy.html"), "utf8");
  assert.match(privacy, /visit count/i);
  assert.match(privacy, /page-views-api\.ratneshc\.com/);
  assert.doesNotMatch(privacy, /Google Analytics or other third-party trackers/);
});
