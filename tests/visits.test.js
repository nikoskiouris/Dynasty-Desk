import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  VISIT_COUNTED_KEY,
  isLiveDeskHost,
  readVisitCounted,
  recordDeskVisit,
  shouldTrackVisit,
  visitCountUrl,
  visitTrackUrl,
  writeVisitCounted,
} from "../docs/modules/visits.js";

const docs = join(dirname(fileURLToPath(import.meta.url)), "../docs");

function memoryStorage(start = new Map()) {
  return {
    getItem(key) {
      return start.has(key) ? start.get(key) : null;
    },
    setItem(key, value) {
      start.set(key, String(value));
    },
    map: start,
  };
}

test("visit URLs stay on the public GitHub Pages path", () => {
  assert.match(visitTrackUrl(), /\/track\?/);
  assert.match(visitTrackUrl(), /DynastyDesk/);
  assert.match(visitCountUrl(), /\/views\?/);
  assert.match(visitCountUrl(), /nikoskiouris\.github\.io/);
});

test("only the live GitHub Pages host records a first visit", () => {
  const storage = memoryStorage();
  assert.equal(isLiveDeskHost({ hostname: "127.0.0.1" }), false);
  assert.equal(isLiveDeskHost({ hostname: "nikoskiouris.github.io" }), true);
  assert.equal(readVisitCounted(storage), false);
  assert.equal(shouldTrackVisit({ location: { hostname: "localhost" }, storage }), false);
  assert.equal(shouldTrackVisit({ location: { hostname: "nikoskiouris.github.io" }, storage }), true);
  writeVisitCounted(storage);
  assert.equal(storage.map.get(VISIT_COUNTED_KEY), "1");
  assert.equal(shouldTrackVisit({ location: { hostname: "nikoskiouris.github.io" }, storage }), false);
});

test("recordDeskVisit pings once on the live host and does not read a public total", async () => {
  const storage = memoryStorage();
  const calls = [];
  const fetchFn = async (url) => {
    calls.push(url);
    return { ok: true };
  };

  assert.equal(await recordDeskVisit({
    fetchFn,
    location: { hostname: "nikoskiouris.github.io" },
    storage,
  }), true);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /\/track\?/);
  assert.doesNotMatch(calls[0], /\/views\?/);
  assert.equal(storage.map.get(VISIT_COUNTED_KEY), "1");

  calls.length = 0;
  assert.equal(await recordDeskVisit({
    fetchFn,
    location: { hostname: "nikoskiouris.github.io" },
    storage,
  }), false);
  assert.equal(calls.length, 0);
});

test("localhost does not ping the live counter", async () => {
  const calls = [];
  const recorded = await recordDeskVisit({
    fetchFn: async (url) => {
      calls.push(url);
      return { ok: true };
    },
    location: { hostname: "127.0.0.1" },
    storage: memoryStorage(),
  });
  assert.equal(recorded, false);
  assert.equal(calls.length, 0);
});

test("a failed ping leaves the browser uncounted so it can retry", async () => {
  const storage = memoryStorage();
  const recorded = await recordDeskVisit({
    fetchFn: async () => {
      throw new Error("offline");
    },
    location: { hostname: "nikoskiouris.github.io" },
    storage,
  });
  assert.equal(recorded, false);
  assert.equal(storage.map.get(VISIT_COUNTED_KEY), undefined);
});

test("the desk stores visits but never prints the total", () => {
  const index = readFileSync(join(docs, "index.html"), "utf8");
  assert.doesNotMatch(index, /id="landing-visits"/);
  assert.doesNotMatch(index, /id="footer-visits"/);
  assert.doesNotMatch(index, /people have viewed this desk/);
  assert.doesNotMatch(index, /anonymous visit ping/);

  const app = readFileSync(join(docs, "app.js"), "utf8");
  assert.match(app, /recordDeskVisit/);
  assert.doesNotMatch(app, /applyVisitCount/);
  assert.doesNotMatch(app, /visitCountUrl/);

  const privacy = readFileSync(join(docs, "privacy.html"), "utf8");
  assert.doesNotMatch(privacy, /visit count/i);
  assert.doesNotMatch(privacy, /page-views-api/);
  assert.doesNotMatch(privacy, /does not show that number/i);
});
