import test from "node:test";
import assert from "node:assert/strict";
import {
  applyVisit,
  clientIp,
  createVisitHandler,
  flattenTrafficCounts,
  isAllowedWrite,
  isBot,
  summarize,
  visitPeriodKeys,
  visitorHash,
  wrapLambdaHandler,
} from "../netlify/lib/traffic.js";

const NOW = new Date("2026-09-16T18:00:00.000Z");

function memoryStore(initial = null) {
  let value = initial;
  return {
    async get(_key, opts = {}) {
      if (value == null) return null;
      return opts.type === "json" ? structuredClone(value) : value;
    },
    async setJSON(_key, next) {
      value = structuredClone(next);
    },
    snapshot() {
      return structuredClone(value);
    },
  };
}

function request(url, { method = "GET", headers = {} } = {}) {
  return new Request(url, { method, headers });
}

test("period keys use UTC day, ISO week, and calendar year", () => {
  const periods = visitPeriodKeys(NOW);
  assert.equal(periods.day, "2026-09-16");
  assert.equal(periods.week, "2026-W38");
  assert.equal(periods.year, "2026");
});

test("visitor hashes stay stable for the same IP and browser", () => {
  const first = visitorHash("1.2.3.4", "Mozilla/5.0 Desk");
  const second = visitorHash("1.2.3.4", "Mozilla/5.0 Desk");
  const other = visitorHash("5.6.7.8", "Mozilla/5.0 Desk");
  assert.equal(first, second);
  assert.equal(first.length, 32);
  assert.notEqual(first, other);
});

test("bot user-agents are skipped, browsers are not", () => {
  assert.equal(isBot("Mozilla/5.0 Chrome/129.0.0.0"), false);
  assert.equal(isBot("Googlebot/2.1"), true);
  assert.equal(isBot("Slackbot-LinkExpanding 1.0"), true);
  assert.equal(isBot("python-urllib/3.12"), true);
});

test("one person reloading adds views but not people", () => {
  let state = applyVisit(null, { hash: "aaa", now: NOW });
  state = applyVisit(state, { hash: "aaa", now: NOW });
  const summary = summarize(state, NOW);
  assert.deepEqual(summary.today, { views: 2, people: 1 });
  assert.deepEqual(summary.week, { views: 2, people: 1 });
  assert.deepEqual(summary.all, { views: 2, people: 1 });
});

test("two people on the same day count as two people", () => {
  let state = applyVisit(null, { hash: "aaa", now: NOW });
  state = applyVisit(state, { hash: "bbb", now: NOW });
  const summary = summarize(state, NOW);
  assert.deepEqual(summary.today, { views: 2, people: 2 });
  assert.equal(flattenTrafficCounts(summary).length, 8);
  assert.deepEqual(flattenTrafficCounts(summary), [2, 2, 2, 2, 2, 2, 2, 2]);
});

test("a new UTC day starts a fresh people bucket but keeps all-time", () => {
  let state = applyVisit(null, { hash: "aaa", now: NOW });
  const nextDay = new Date("2026-09-17T01:00:00.000Z");
  state = applyVisit(state, { hash: "aaa", now: nextDay });
  assert.deepEqual(summarize(state, nextDay).today, { views: 1, people: 1 });
  assert.deepEqual(summarize(state, nextDay).week, { views: 2, people: 1 });
  assert.deepEqual(summarize(state, nextDay).all, { views: 2, people: 1 });
  assert.deepEqual(summarize(state, NOW).today, { views: 1, people: 1 });
});

test("write access needs the live origin or referer", () => {
  const live = request("https://dynastyticker.com/api/visit", {
    method: "POST",
    headers: { origin: "https://dynastyticker.com" },
  });
  const www = request("https://dynastyticker.com/api/visit", {
    method: "POST",
    headers: { referer: "https://www.dynastyticker.com/privacy.html" },
  });
  const other = request("https://dynastyticker.com/api/visit", {
    method: "POST",
    headers: { origin: "https://evil.example" },
  });
  assert.equal(isAllowedWrite(live), true);
  assert.equal(isAllowedWrite(www), true);
  assert.equal(isAllowedWrite(other), false);
});

test("the visit handler counts people from hashed IP plus user-agent", async () => {
  const store = memoryStore();
  const handler = createVisitHandler({
    getStore: () => store,
    nowFn: () => NOW,
    salt: "test-salt",
  });
  const headers = {
    origin: "https://dynastyticker.com",
    "user-agent": "Mozilla/5.0 Chrome/129.0.0.0",
  };

  const first = await handler(
    request("https://dynastyticker.com/api/visit", { method: "POST", headers }),
    { ip: "1.2.3.4" },
  );
  assert.equal(first.status, 200);
  const reload = await handler(
    request("https://dynastyticker.com/api/visit", { method: "POST", headers }),
    { ip: "1.2.3.4" },
  );
  assert.equal(reload.status, 200);
  const other = await handler(
    request("https://dynastyticker.com/api/visit", { method: "POST", headers }),
    { ip: "9.9.9.9" },
  );
  assert.equal(other.status, 200);

  const bot = await handler(
    request("https://dynastyticker.com/api/visit", {
      method: "POST",
      headers: { ...headers, "user-agent": "Googlebot/2.1" },
    }),
    { ip: "8.8.8.8" },
  );
  assert.equal(bot.status, 200);
  assert.equal((await bot.json()).skipped, "bot");

  const forbidden = await handler(
    request("https://dynastyticker.com/api/visit", {
      method: "POST",
      headers: { origin: "https://evil.example", "user-agent": headers["user-agent"] },
    }),
    { ip: "2.2.2.2" },
  );
  assert.equal(forbidden.status, 403);

  const read = await handler(request("https://dynastyticker.com/api/views"));
  assert.equal(read.status, 200);
  const payload = await read.json();
  assert.deepEqual(payload.today, { views: 3, people: 2 });
  assert.deepEqual(payload.all, { views: 3, people: 2 });
  assert.equal(JSON.stringify(payload).includes("seen"), false);
});

test("client IP prefers Netlify context then forwarded headers", () => {
  const req = request("https://dynastyticker.com/api/visit", {
    headers: {
      "x-forwarded-for": "9.9.9.9, 1.1.1.1",
      "x-nf-client-connection-ip": "8.8.4.4",
    },
  });
  assert.equal(clientIp(req, { ip: "1.2.3.4" }), "1.2.3.4");
  assert.equal(clientIp(req, {}), "8.8.4.4");
});

test("classic Netlify handler reads Lambda events and returns status plus body", async () => {
  const store = memoryStore();
  const handler = wrapLambdaHandler(createVisitHandler({
    getStore: () => store,
    nowFn: () => NOW,
    salt: "test-salt",
  }));
  const posted = await handler({
    httpMethod: "POST",
    path: "/.netlify/functions/visit",
    headers: {
      host: "dynastyticker.com",
      origin: "https://dynastyticker.com",
      "user-agent": "Mozilla/5.0 Chrome/129.0.0.0",
    },
  }, { ip: "1.2.3.4" });
  assert.equal(posted.statusCode, 200);
  assert.equal(JSON.parse(posted.body).ok, true);

  const read = await handler({
    httpMethod: "GET",
    path: "/.netlify/functions/visit",
    headers: { host: "dynastyticker.com" },
  });
  assert.equal(read.statusCode, 200);
  assert.deepEqual(JSON.parse(read.body).today, { views: 1, people: 1 });
});
