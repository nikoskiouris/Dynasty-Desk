export const SITE_NAME = "Dynasty Desk";
export const SITE_ORIGIN = "https://nikoskiouris.github.io";
export const SITE_PATH = "/FantasyDynastyAnalyzer/";
export const SITE_URL = `${SITE_ORIGIN}${SITE_PATH}`;
export const REPO_URL = "https://github.com/nikoskiouris/FantasyDynastyAnalyzer";
export const CONTACT_URL = `${REPO_URL}/issues`;
export const OG_IMAGE_URL = `${SITE_URL}og-image.jpg`;
export const STORAGE_NOTICE_KEY = "dynasty_desk_storage_notice";

export const DEFAULT_TITLE = "Dynasty Desk — Fantasy League Command Center";
export const DEFAULT_DESCRIPTION =
  "Search a Sleeper username. Open live scores, playoff odds, awards, a dynasty trade lab, and a group-chat recap for your league.";

export const PAGE_META = {
  home: {
    title: "Command Center",
    description: "Live scoreboard, standings, luck, and Monte Carlo playoff odds for your Sleeper dynasty league.",
  },
  teams: {
    title: "Teams",
    description: "Scout any roster: optimal lineup, bench, pick vault, and dynasty power.",
  },
  awards: {
    title: "Awards",
    description: "Weekly honors, season superlatives, luck index, and the all-time record book.",
  },
  analytics: {
    title: "History",
    description: "Dynasty archive: champions, finish matrix, rivalries, and trade roads.",
  },
  trader: {
    title: "Trade Lab",
    description: "Shop an asset, target a player, or grade a trade by hand with KeepTradeCut values.",
  },
  recap: {
    title: "Recap",
    description: "Group-chat recap of scores, awards, standings, and odds. Copy text or save an image card.",
  },
};

export function buildDocumentTitle({ page = "", leagueName = "", loaded = false } = {}) {
  const pageLabel = PAGE_META[page]?.title || "";
  const league = String(leagueName || "").trim();
  if (loaded && league && pageLabel) return `${pageLabel} · ${league} — ${SITE_NAME}`;
  if (loaded && league) return `${league} — ${SITE_NAME}`;
  if (loaded && pageLabel) return `${pageLabel} — ${SITE_NAME}`;
  return DEFAULT_TITLE;
}

export function buildPageDescription({ page = "", leagueName = "", loaded = false } = {}) {
  const pageMeta = PAGE_META[page];
  const league = String(leagueName || "").trim();
  if (loaded && league && pageMeta) return `${pageMeta.description} Now open: ${league}.`;
  return pageMeta?.description || DEFAULT_DESCRIPTION;
}

export function applyDocumentMeta(doc, { title, description } = {}) {
  if (!doc) return;
  if (title) {
    doc.title = title;
    setMetaContent(doc, "property", "og:title", title);
    setMetaContent(doc, "name", "twitter:title", title);
  }
  if (description) {
    setMetaContent(doc, "name", "description", description);
    setMetaContent(doc, "property", "og:description", description);
    setMetaContent(doc, "name", "twitter:description", description);
  }
}

export function readStorageNoticeDismissed(storage = globalThis.localStorage) {
  try {
    return storage?.getItem(STORAGE_NOTICE_KEY) === "1";
  } catch {
    return true;
  }
}

export function writeStorageNoticeDismissed(storage = globalThis.localStorage) {
  try {
    storage?.setItem(STORAGE_NOTICE_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

export function applyStorageNoticeHidden(notice, dismissed) {
  if (!notice) return;
  const hide = Boolean(dismissed);
  notice.hidden = hide;
  notice.classList?.toggle?.("hidden", hide);
}

function setMetaContent(doc, attr, key, value) {
  const node = doc.querySelector(`meta[${attr}="${key}"]`);
  if (!node) return;
  if (typeof node.setAttribute === "function") node.setAttribute("content", value);
  node.content = value;
}
