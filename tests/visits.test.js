import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  isLiveDeskHost,
  isSecretNumbersPath,
  loadSecretNumbers,
  recordDeskVisit,
  renderSecretNumbers,
  shouldTrackVisit,
  visitCountUrl,
  visitTrackUrl,
} from "../docs/modules/visits.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const docs = join(root, "docs");

test("visit URLs stay first-party on the live host", () => {
  const live = { hostname: "dynastyticker.com" };
  assert.equal(visitTrackUrl(live), "https://dynastyticker.com/api/visit");
  assert.equal(visitCountUrl(live), "https://dynastyticker.com/api/views");
  assert.doesNotMatch(visitTrackUrl(live), /page-views-api|ratneshc|github\.io/);
  assert.equal(visitTrackUrl({ hostname: "127.0.0.1" }), "http://127.0.0.1/api/visit");
});

test("only the live dynastyticker.com host records a desk open", () => {
  assert.equal(isLiveDeskHost({ hostname: "127.0.0.1" }), false);
  assert.equal(isLiveDeskHost({ hostname: "nikoskiouris.github.io" }), false);
  assert.equal(isLiveDeskHost({ hostname: "dynastyticker.com" }), true);
  assert.equal(isLiveDeskHost({ hostname: "www.dynastyticker.com" }), true);
  assert.equal(shouldTrackVisit({ location: { hostname: "localhost" } }), false);
  assert.equal(shouldTrackVisit({ location: { hostname: "dynastyticker.com" } }), true);
  assert.equal(isSecretNumbersPath({ pathname: "/secret-numbers/" }), true);
  assert.equal(shouldTrackVisit({
    location: { hostname: "dynastyticker.com", pathname: "/secret-numbers/" },
  }), false);
});

test("recordDeskVisit POSTs every live load and never hits views", async () => {
  const calls = [];
  const fetchFn = async (url, options = {}) => {
    calls.push({ url, method: options.method || "GET" });
    return { ok: true };
  };

  assert.equal(await recordDeskVisit({
    fetchFn,
    location: { hostname: "dynastyticker.com" },
  }), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "POST");
  assert.match(calls[0].url, /\/api\/visit$/);

  assert.equal(await recordDeskVisit({
    fetchFn,
    location: { hostname: "dynastyticker.com" },
  }), true);
  assert.equal(calls.length, 2);
});

test("localhost and the numbers page do not ping the counter", async () => {
  const calls = [];
  const fetchFn = async (url) => {
    calls.push(url);
    return { ok: true };
  };
  assert.equal(await recordDeskVisit({
    fetchFn,
    location: { hostname: "127.0.0.1" },
  }), false);
  assert.equal(await recordDeskVisit({
    fetchFn,
    location: { hostname: "dynastyticker.com", pathname: "/secret-numbers" },
  }), false);
  assert.equal(calls.length, 0);
});

test("a failed ping stays uncounted so the next load can retry", async () => {
  const recorded = await recordDeskVisit({
    fetchFn: async () => {
      throw new Error("offline");
    },
    location: { hostname: "dynastyticker.com" },
  });
  assert.equal(recorded, false);
});

test("secret numbers are eight unlabeled lines", () => {
  assert.equal(renderSecretNumbers([12, 3, 40, 8, 200, 50, 500, 80]), "12\n3\n40\n8\n200\n50\n500\n80");
  assert.equal(renderSecretNumbers(null), "0\n0\n0\n0\n0\n0\n0\n0");
});

test("loadSecretNumbers reads the eight totals and never tracks", async () => {
  const calls = [];
  const counts = await loadSecretNumbers({
    fetchFn: async (url) => {
      calls.push(url);
      return {
        ok: true,
        json: async () => ({
          today: { views: 1, people: 2 },
          week: { views: 3, people: 4 },
          year: { views: 5, people: 6 },
          all: { views: 7, people: 8 },
        }),
      };
    },
  });
  assert.deepEqual(counts, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /\/api\/views$/);
});

test("loadSecretNumbers treats hung views as zero", async () => {
  const counts = await loadSecretNumbers({
    timeoutMs: 20,
    fetchFn: () => new Promise(() => {}),
  });
  assert.deepEqual(counts, [0, 0, 0, 0, 0, 0, 0, 0]);
});

test("the desk stores visits but never prints the total on public pages", () => {
  const index = readFileSync(join(docs, "index.html"), "utf8");
  assert.doesNotMatch(index, /id="landing-visits"/);
  assert.doesNotMatch(index, /id="footer-visits"/);
  assert.doesNotMatch(index, /people have viewed this desk/);
  assert.doesNotMatch(index, /anonymous visit ping/);
  assert.doesNotMatch(index, /secret-numbers/);
  assert.doesNotMatch(index, /privacy\.html/);
  assert.doesNotMatch(index, /terms\.html/);
  assert.doesNotMatch(index, /id="storage-notice"/);

  const app = readFileSync(join(docs, "app.js"), "utf8");
  assert.match(app, /recordDeskVisit/);
  assert.doesNotMatch(app, /applyVisitCount/);
  assert.doesNotMatch(app, /secret-numbers/);

  const privacy = readFileSync(join(docs, "privacy.html"), "utf8");
  assert.doesNotMatch(privacy, /visit count/i);
  assert.doesNotMatch(privacy, /page-views-api/);
  assert.doesNotMatch(privacy, /secret-numbers/);
  assert.match(privacy, /recordDeskVisit/);

  const sitemap = readFileSync(join(docs, "sitemap.xml"), "utf8");
  assert.doesNotMatch(sitemap, /secret-numbers/);

  const robots = readFileSync(join(docs, "robots.txt"), "utf8");
  assert.doesNotMatch(robots, /secret-numbers/);

  for (const name of ["terms.html", "404.html"]) {
    assert.doesNotMatch(readFileSync(join(docs, name), "utf8"), /secret-numbers/);
  }
  assert.match(readFileSync(join(docs, "terms.html"), "utf8"), /recordDeskVisit/);
});

test("the unlisted numbers page is bare and unlabeled", () => {
  const page = join(docs, "secret-numbers/index.html");
  assert.equal(existsSync(page), true);
  const html = readFileSync(page, "utf8");
  assert.match(html, /noindex/);
  assert.match(html, /loadSecretNumbers/);
  assert.match(html, /innerText/);
  assert.match(html, /0<br>0<br>0<br>0<br>0<br>0<br>0<br>0/);
  assert.doesNotMatch(html, /stylesheet/);
  assert.doesNotMatch(html, /Dynasty/);
  assert.doesNotMatch(html, /today|week|year|all.time|users/i);
  assert.doesNotMatch(html, /<nav|<footer|<a /);
});

test("Netlify serves the first-party counter ahead of the 404 catch-all", () => {
  const toml = readFileSync(join(root, "netlify.toml"), "utf8");
  const visitAt = toml.indexOf('from = "/api/visit"');
  const viewsAt = toml.indexOf('from = "/api/views"');
  const notFoundAt = toml.indexOf('from = "/*"');
  assert.ok(visitAt > 0);
  assert.ok(viewsAt > visitAt);
  assert.ok(notFoundAt > viewsAt);
  assert.match(toml, /\.netlify\/functions\/visit/);

  const fn = readFileSync(join(root, "netlify/functions/visit.js"), "utf8");
  assert.match(fn, /desk-traffic/);
  assert.match(fn, /export default/);
  assert.doesNotMatch(fn, /wrapLambdaHandler/);

  const redirects = readFileSync(join(docs, "_redirects"), "utf8");
  assert.match(redirects, /\/api\/visit\s+\/\.netlify\/functions\/visit\s+200!/);
  assert.match(redirects, /\/api\/views\s+\/\.netlify\/functions\/visit\s+200!/);

  const script = readFileSync(join(root, "scripts/desk_visits.py"), "utf8");
  assert.match(script, /dynastyticker\.com\/api\/views/);
  assert.doesNotMatch(script, /page-views-api|ratneshc/);
});
