import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  VISIT_COUNTED_KEY,
  VISIT_DAY_KEY,
  VISIT_WEEK_KEY,
  VISIT_YEAR_KEY,
  isLiveDeskHost,
  loadSecretNumbers,
  pendingVisitKinds,
  readVisitCounted,
  recordDeskVisit,
  renderSecretNumbers,
  shouldTrackVisit,
  visitCountUrl,
  visitPathFor,
  visitPeriodKeys,
  visitTrackUrl,
  writeVisitCounted,
} from "../docs/modules/visits.js";

const docs = join(dirname(fileURLToPath(import.meta.url)), "../docs");
const NOW = new Date("2026-09-16T18:00:00.000Z");

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

test("visit URLs stay on the public dynastydesk.com path", () => {
  assert.match(visitTrackUrl(NOW), /\/track\?/);
  assert.match(visitTrackUrl(NOW), /dynastydesk\.com/);
  assert.match(visitCountUrl(NOW), /\/views\?/);
  assert.doesNotMatch(visitTrackUrl(NOW), /github\.io/);
});

test("period keys use UTC day, ISO week, and calendar year", () => {
  const periods = visitPeriodKeys(NOW);
  assert.equal(periods.day, "2026-09-16");
  assert.equal(periods.week, "2026-W38");
  assert.equal(periods.year, "2026");
  assert.match(visitPathFor("today", periods), /\/d\/2026-09-16$/);
  assert.match(visitPathFor("week", periods), /\/w\/2026-W38$/);
  assert.match(visitPathFor("year", periods), /\/y\/2026$/);
  assert.equal(visitPathFor("all", periods), "/");
});

test("only the live dynastydesk.com host records a first visit", () => {
  const storage = memoryStorage();
  assert.equal(isLiveDeskHost({ hostname: "127.0.0.1" }), false);
  assert.equal(isLiveDeskHost({ hostname: "nikoskiouris.github.io" }), false);
  assert.equal(isLiveDeskHost({ hostname: "dynastydesk.com" }), true);
  assert.equal(isLiveDeskHost({ hostname: "www.dynastydesk.com" }), true);
  assert.equal(readVisitCounted(storage), false);
  assert.equal(shouldTrackVisit({ location: { hostname: "localhost" }, storage, now: NOW }), false);
  assert.equal(shouldTrackVisit({ location: { hostname: "dynastydesk.com" }, storage, now: NOW }), true);
  writeVisitCounted(storage);
  assert.equal(storage.map.get(VISIT_COUNTED_KEY), "1");
  assert.deepEqual(pendingVisitKinds({ storage, now: NOW }), ["today", "week", "year"]);
});

test("recordDeskVisit pings today, week, year, and all-time on a first live visit", async () => {
  const storage = memoryStorage();
  const calls = [];
  const fetchFn = async (url) => {
    calls.push(url);
    return { ok: true };
  };

  assert.equal(await recordDeskVisit({
    fetchFn,
    location: { hostname: "dynastydesk.com" },
    storage,
    now: NOW,
  }), true);
  assert.equal(calls.length, 4);
  assert.match(calls[0], /path=%2Fd%2F2026-09-16/);
  assert.match(calls[1], /path=%2Fw%2F2026-W38/);
  assert.match(calls[2], /path=%2Fy%2F2026/);
  assert.match(calls[3], /path=%2F$/);
  assert.doesNotMatch(calls.join("\n"), /\/views\?/);
  assert.equal(storage.map.get(VISIT_DAY_KEY), "2026-09-16");
  assert.equal(storage.map.get(VISIT_WEEK_KEY), "2026-W38");
  assert.equal(storage.map.get(VISIT_YEAR_KEY), "2026");
  assert.equal(storage.map.get(VISIT_COUNTED_KEY), "1");

  calls.length = 0;
  assert.equal(await recordDeskVisit({
    fetchFn,
    location: { hostname: "dynastydesk.com" },
    storage,
    now: NOW,
  }), false);
  assert.equal(calls.length, 0);
});

test("a new UTC day only pings the day bucket", async () => {
  const storage = memoryStorage(new Map([
    [VISIT_DAY_KEY, "2026-09-16"],
    [VISIT_WEEK_KEY, "2026-W38"],
    [VISIT_YEAR_KEY, "2026"],
    [VISIT_COUNTED_KEY, "1"],
  ]));
  const calls = [];
  const nextDay = new Date("2026-09-17T01:00:00.000Z");
  await recordDeskVisit({
    fetchFn: async (url) => {
      calls.push(url);
      return { ok: true };
    },
    location: { hostname: "dynastydesk.com" },
    storage,
    now: nextDay,
  });
  assert.equal(calls.length, 1);
  assert.match(calls[0], /path=%2Fd%2F2026-09-17/);
  assert.equal(storage.map.get(VISIT_DAY_KEY), "2026-09-17");
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
    now: NOW,
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
    location: { hostname: "dynastydesk.com" },
    storage,
    now: NOW,
  });
  assert.equal(recorded, false);
  assert.equal(storage.map.get(VISIT_COUNTED_KEY), undefined);
  assert.equal(storage.map.get(VISIT_DAY_KEY), undefined);
});

test("secret numbers are four unlabeled lines", () => {
  assert.equal(renderSecretNumbers([12, 34, 56, 78]), "12\n34\n56\n78");
  assert.equal(renderSecretNumbers(null), "0\n0\n0\n0");
});

test("loadSecretNumbers reads four view totals and never tracks", async () => {
  const calls = [];
  const counts = await loadSecretNumbers({
    now: NOW,
    fetchFn: async (url) => {
      calls.push(url);
      const views = calls.length;
      return { ok: true, json: async () => ({ views }) };
    },
  });
  assert.deepEqual(counts, [1, 2, 3, 4]);
  assert.equal(calls.length, 4);
  for (const url of calls) assert.match(url, /\/views\?/);
});

test("loadSecretNumbers treats hung views as zero", async () => {
  const counts = await loadSecretNumbers({
    now: NOW,
    timeoutMs: 20,
    fetchFn: () => new Promise(() => {}),
  });
  assert.deepEqual(counts, [0, 0, 0, 0]);
});

test("the desk stores visits but never prints the total on public pages", () => {
  const index = readFileSync(join(docs, "index.html"), "utf8");
  assert.doesNotMatch(index, /id="landing-visits"/);
  assert.doesNotMatch(index, /id="footer-visits"/);
  assert.doesNotMatch(index, /people have viewed this desk/);
  assert.doesNotMatch(index, /anonymous visit ping/);
  assert.doesNotMatch(index, /secret-numbers/);

  const app = readFileSync(join(docs, "app.js"), "utf8");
  assert.match(app, /recordDeskVisit/);
  assert.doesNotMatch(app, /applyVisitCount/);
  assert.doesNotMatch(app, /secret-numbers/);

  const privacy = readFileSync(join(docs, "privacy.html"), "utf8");
  assert.doesNotMatch(privacy, /visit count/i);
  assert.doesNotMatch(privacy, /page-views-api/);
  assert.doesNotMatch(privacy, /secret-numbers/);

  const sitemap = readFileSync(join(docs, "sitemap.xml"), "utf8");
  assert.doesNotMatch(sitemap, /secret-numbers/);

  const robots = readFileSync(join(docs, "robots.txt"), "utf8");
  assert.doesNotMatch(robots, /secret-numbers/);

  for (const name of ["terms.html", "404.html"]) {
    assert.doesNotMatch(readFileSync(join(docs, name), "utf8"), /secret-numbers/);
  }
});

test("the unlisted numbers page is bare and unlabeled", () => {
  const page = join(docs, "secret-numbers/index.html");
  assert.equal(existsSync(page), true);
  const html = readFileSync(page, "utf8");
  assert.match(html, /noindex/);
  assert.match(html, /loadSecretNumbers/);
  assert.match(html, /innerText/);
  assert.match(html, /0<br>0<br>0<br>0/);
  assert.doesNotMatch(html, /stylesheet/);
  assert.doesNotMatch(html, /Dynasty/);
  assert.doesNotMatch(html, /today|week|year|all.time|users/i);
  assert.doesNotMatch(html, /<nav|<footer|<a /);
});
