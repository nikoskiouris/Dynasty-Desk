import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, accessSync, constants } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(name) {
  return readFileSync(join(root, name), "utf8");
}

function bash(script, extraEnv = {}) {
  return spawnSync("bash", [join(root, script)], {
    encoding: "utf8",
    env: { ...process.env, ...extraEnv },
  });
}

test("Netlify git builds skip so merges do not publish", () => {
  accessSync(join(root, "scripts/netlify-ignore.sh"), constants.X_OK);
  const toml = read("netlify.toml");
  assert.match(toml, /ignore = "bash \.\/scripts\/netlify-ignore\.sh"/);
  const skipped = bash("scripts/netlify-ignore.sh");
  assert.equal(skipped.status, 0, skipped.stderr);
  assert.match(skipped.stdout, /Skipping Netlify git build/);
});

test("Netlify git/hook command refuses to publish main", () => {
  accessSync(join(root, "scripts/netlify-git-build.sh"), constants.X_OK);
  const toml = read("netlify.toml");
  assert.match(toml, /command = "bash \.\/scripts\/netlify-git-build\.sh"/);
  assert.doesNotMatch(toml, /refresh_market_data/);
  const refused = bash("scripts/netlify-git-build.sh");
  assert.equal(refused.status, 1);
  assert.match(refused.stdout, /Refusing Netlify git\/hook build/);
});

test("live deploy script uses Netlify CLI, not a build hook", () => {
  accessSync(join(root, "scripts/deploy_live_site.sh"), constants.X_OK);
  const script = read("scripts/deploy_live_site.sh");
  assert.match(script, /NETLIFY_AUTH_TOKEN/);
  assert.match(script, /NETLIFY_SITE_ID/);
  assert.match(script, /netlify-cli@27 deploy/);
  assert.match(script, /--prod/);
  assert.match(script, /--no-build/);
  assert.match(script, /--functions=netlify\/functions/);
  assert.match(script, /refresh_market_data\.sh/);
  assert.doesNotMatch(script, /NETLIFY_BUILD_HOOK/);
  assert.doesNotMatch(script, /curl/);

  const missing = bash("scripts/deploy_live_site.sh", {
    NETLIFY_AUTH_TOKEN: "",
    NETLIFY_SITE_ID: "",
  });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /NETLIFY_AUTH_TOKEN/);
});

test("GitHub Actions publish only from a GitHub Release", () => {
  const release = read(".github/workflows/deploy-release.yml");
  assert.match(release, /release:/);
  assert.match(release, /types:\s*\[published\]/);
  assert.match(release, /bash scripts\/deploy_live_site\.sh/);
  assert.match(release, /group: deploy-live/);
  assert.match(release, /Refuse untagged manual deploys/);
  assert.match(release, /Do not deploy main/);
  assert.doesNotMatch(release, /NETLIFY_BUILD_HOOK/);

  const daily = read(".github/workflows/deploy-site.yml");
  assert.match(daily, /releases\/latest/);
  assert.match(daily, /bash scripts\/deploy_live_site\.sh/);
  assert.match(daily, /group: deploy-live/);
  assert.doesNotMatch(daily, /NETLIFY_BUILD_HOOK/);
  assert.doesNotMatch(daily, /curl /);
});
