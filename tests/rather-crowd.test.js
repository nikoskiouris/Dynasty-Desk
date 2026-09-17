import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  fetchRatherCrowdVotes,
  isLiveRatherHost,
  parseRatherCrowdVotes,
  ratherVoteUrl,
  submitRatherCrowdVote,
} from "../docs/modules/rather-crowd.js";
import {
  applyRatherVote,
  createRatherVoteHandler,
  publicRatherVotes,
  sanitizeRatherVote,
  wrapLambdaHandler,
} from "../netlify/lib/rather-crowd.js";

const NOW = new Date("2026-09-17T02:00:00.000Z");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

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

test("rather vote URLs stay first-party on the live host", () => {
  assert.equal(ratherVoteUrl({ hostname: "dynastyticker.com" }), "https://dynastyticker.com/api/rather-vote");
  assert.equal(isLiveRatherHost({ hostname: "dynastyticker.com" }), true);
  assert.equal(isLiveRatherHost({ hostname: "localhost" }), false);
});

test("localhost does not read or write public rather votes", async () => {
  const calls = [];
  const fetchFn = async (url) => {
    calls.push(url);
    return { ok: true, json: async () => ({ votes: [] }) };
  };
  assert.equal(await fetchRatherCrowdVotes({ fetchFn, location: { hostname: "127.0.0.1" } }), null);
  assert.equal(await submitRatherCrowdVote({ winnerId: "player:1", loserId: "player:2" }, {
    fetchFn,
    location: { hostname: "localhost" },
  }), null);
  assert.equal(calls.length, 0);
});

test("live host posts a vote and reads the public list", async () => {
  const calls = [];
  const fetchFn = async (url, options = {}) => {
    calls.push({ url, method: options.method || "GET", body: options.body });
    return {
      ok: true,
      json: async () => ({
        votes: [{ winnerId: "player:11566", loserId: "player:12504", format: "PPR 12-man Superflex", at: 1 }],
      }),
    };
  };
  const loaded = await fetchRatherCrowdVotes({ fetchFn, location: { hostname: "dynastyticker.com" } });
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].winnerId, "player:11566");
  const posted = await submitRatherCrowdVote({
    winnerId: "player:11566",
    loserId: "player:12504",
    format: "PPR 12-man Superflex",
    at: 2,
  }, { fetchFn, location: { hostname: "www.dynastyticker.com" } });
  assert.equal(posted[0].winnerId, "player:11566");
  assert.equal(calls[1].method, "POST");
});

test("junk votes are dropped", () => {
  assert.equal(sanitizeRatherVote({ winnerId: "player:1", loserId: "player:1" }), null);
  assert.equal(sanitizeRatherVote({ winnerId: "pick:2026:r1:any", loserId: "player:1" }), null);
  assert.deepEqual(parseRatherCrowdVotes({
    votes: [
      { winnerId: "player:a", loserId: "player:b", format: "PPR 12-man Superflex", at: 9 },
      { winnerId: "player:a", loserId: "player:a" },
    ],
  }), [{ winnerId: "player:a", loserId: "player:b", format: "PPR 12-man Superflex", at: 9 }]);
});

test("the rather function stores a public vote and rate-limits a spammer", async () => {
  const store = memoryStore();
  const handler = createRatherVoteHandler({
    getStore: () => store,
    nowFn: () => NOW,
    salt: "test-salt",
    allowedOrigins: ["https://dynastyticker.com"],
  });

  const headers = {
    origin: "https://dynastyticker.com",
    "user-agent": "Mozilla/5.0 Chrome/129.0.0.0",
    "content-type": "application/json",
  };
  const posted = await handler(new Request("https://dynastyticker.com/api/rather-vote", {
    method: "POST",
    headers,
    body: JSON.stringify({ winnerId: "player:11566", loserId: "player:12504", format: "PPR 12-man Superflex", at: NOW.getTime() }),
  }), { ip: "1.2.3.4" });
  assert.equal(posted.status, 200);
  const body = await posted.json();
  assert.equal(body.ok, true);
  assert.equal(body.voteCount, 1);
  assert.equal(body.votes[0].winnerId, "player:11566");

  const spam = await handler(new Request("https://dynastyticker.com/api/rather-vote", {
    method: "POST",
    headers,
    body: JSON.stringify({ winnerId: "player:11566", loserId: "player:12504", format: "PPR 12-man Superflex", at: NOW.getTime() + 1 }),
  }), { ip: "1.2.3.4" });
  assert.equal(spam.status, 429);

  const read = await handler(new Request("https://dynastyticker.com/api/rather-vote"));
  assert.equal(read.status, 200);
  assert.equal((await read.json()).voteCount, 1);
});

test("classic Netlify handler forwards the POST body", async () => {
  const store = memoryStore();
  const handler = wrapLambdaHandler(createRatherVoteHandler({
    getStore: () => store,
    nowFn: () => NOW,
    salt: "test-salt",
    allowedOrigins: ["https://dynastyticker.com"],
  }));
  const posted = await handler({
    httpMethod: "POST",
    path: "/.netlify/functions/rather-vote",
    headers: {
      host: "dynastyticker.com",
      origin: "https://dynastyticker.com",
      "user-agent": "Mozilla/5.0 Chrome/129.0.0.0",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      winnerId: "player:11566",
      loserId: "player:12504",
      format: "PPR 12-man Superflex",
      at: NOW.getTime(),
    }),
  }, { ip: "8.8.8.8" });
  assert.equal(posted.statusCode, 200);
  assert.equal(JSON.parse(posted.body).votes[0].loserId, "player:12504");
});

test("site wiring mentions the rather vote function", () => {
  const netlify = readFileSync(join(root, "netlify.toml"), "utf8");
  const fn = readFileSync(join(root, "netlify/functions/rather-vote.js"), "utf8");
  const app = readFileSync(join(root, "docs/app.js"), "utf8");
  assert.match(netlify, /rather-vote/);
  assert.match(fn, /desk-rather/);
  assert.match(app, /hydrateCrowdVotes/);
  assert.match(app, /submitRatherCrowdVote/);
  assert.equal(publicRatherVotes({ votes: [{ winnerId: "player:a", loserId: "player:b" }] }).voteCount, 1);
  const blocked = applyRatherVote(null, {
    vote: { winnerId: "player:a", loserId: "player:a" },
    visitorHash: "abc",
    now: NOW,
  });
  assert.equal(blocked.ok, false);
});
