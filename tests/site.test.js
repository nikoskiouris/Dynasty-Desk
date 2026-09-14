import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  OG_IMAGE_URL,
  SITE_URL,
  applyDocumentMeta,
  buildDocumentTitle,
  buildPageDescription,
} from "../docs/modules/site.js";

const docs = join(dirname(fileURLToPath(import.meta.url)), "../docs");

function readDocs(name) {
  return readFileSync(join(docs, name), "utf8");
}

test("document titles and descriptions change with tab and league", () => {
  assert.equal(buildDocumentTitle({}), DEFAULT_TITLE);
  assert.equal(
    buildDocumentTitle({ page: "recap", leagueName: "Try Hard or Die Hard", loaded: true }),
    "Recap · Try Hard or Die Hard — Dynasty Desk"
  );
  assert.match(
    buildPageDescription({ page: "home", leagueName: "Try Hard or Die Hard", loaded: true }),
    /Now open: Try Hard or Die Hard/
  );
  assert.equal(buildPageDescription({}), DEFAULT_DESCRIPTION);
});

test("applyDocumentMeta writes title and social tags", () => {
  const tags = {
    "og:title": { content: "" },
    description: { content: "" },
    "og:description": { content: "" },
    "twitter:title": { content: "" },
    "twitter:description": { content: "" },
  };
  const doc = {
    title: "",
    querySelector(selector) {
      if (selector.includes("og:title")) return tags["og:title"];
      if (selector.includes('name="description"')) return tags.description;
      if (selector.includes("og:description")) return tags["og:description"];
      if (selector.includes("twitter:title")) return tags["twitter:title"];
      if (selector.includes("twitter:description")) return tags["twitter:description"];
      return null;
    },
  };
  applyDocumentMeta(doc, { title: "Teams · Demo — Dynasty Desk", description: "Scout any roster." });
  assert.equal(doc.title, "Teams · Demo — Dynasty Desk");
  assert.equal(tags["og:title"].content, "Teams · Demo — Dynasty Desk");
  assert.equal(tags.description.content, "Scout any roster.");
  assert.equal(tags["twitter:description"].content, "Scout any roster.");
});

test("ship-ready files exist with titles, robots, sitemap, and a compressed OG image", () => {
  const required = [
    "404.html",
    "privacy.html",
    "terms.html",
    "robots.txt",
    "sitemap.xml",
    "favicon.svg",
    "favicon.ico",
    "apple-touch-icon.png",
    "og-image.jpg",
    "site.webmanifest",
  ];
  for (const name of required) {
    assert.equal(existsSync(join(docs, name)), true, name);
  }

  const index = readDocs("index.html");
  assert.match(index, /property="og:image"/);
  assert.match(index, /og-image\.jpg/);
  assert.match(index, /rel="canonical"/);
  assert.match(index, /apple-touch-icon/);
  assert.match(index, /id="sticky-mobile-cta"/);
  assert.match(index, /id="storage-notice"/);
  assert.match(index, /id="username-error"/);
  assert.match(index, /privacy\.html/);
  assert.match(index, /terms\.html/);

  const robots = readDocs("robots.txt");
  assert.match(robots, /Sitemap: https:\/\/nikoskiouris\.github\.io\/FantasyDynastyAnalyzer\/sitemap\.xml/);

  const sitemap = readDocs("sitemap.xml");
  assert.match(sitemap, /privacy\.html/);
  assert.match(sitemap, /terms\.html/);
  assert.equal(SITE_URL, "https://nikoskiouris.github.io/FantasyDynastyAnalyzer/");
  assert.match(sitemap, /https:\/\/nikoskiouris\.github\.io\/FantasyDynastyAnalyzer\//);

  const notFound = readDocs("404.html");
  assert.match(notFound, /Page not found/);
  assert.match(notFound, /<h1>/);

  const privacy = readDocs("privacy.html");
  assert.match(privacy, /localStorage/);
  assert.match(privacy, /No accounts/);
  assert.match(privacy, /GitHub issues/);

  const terms = readDocs("terms.html");
  assert.match(terms, /not affiliated/i);
  assert.match(terms, /as is/i);

  assert.ok(statSync(join(docs, "og-image.jpg")).size < 120_000);
  assert.match(OG_IMAGE_URL, /og-image\.jpg$/);
});
