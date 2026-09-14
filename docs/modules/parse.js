const SLEEPER_LEAGUE_PATH = /leagues\/(\d+)/i;
const SLEEPER_USER_PATH = /sleeper\.app\/(?:u|user)\/([^/?#]+)/i;
const LONG_NUMERIC_ID = /\d{8,}/;

export function parseLeagueId(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";

  const leaguePathMatch = value.match(SLEEPER_LEAGUE_PATH);
  if (leaguePathMatch) return leaguePathMatch[1];

  if (/^\d+$/.test(value)) return value;

  const embeddedId = value.match(LONG_NUMERIC_ID);
  if (embeddedId) return embeddedId[1];

  return "";
}

export function normalizeUsername(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  const urlMatch = value.match(SLEEPER_USER_PATH);
  if (urlMatch) return decodeURIComponent(urlMatch[1]).replace(/^@/, "");
  return value.replace(/^@/, "").replace(/\s+/g, "");
}

export function classifyLeagueInput(raw) {
  const value = String(raw || "").trim();
  if (!value) return { kind: "empty", leagueId: "", username: "" };

  const leaguePathMatch = value.match(SLEEPER_LEAGUE_PATH);
  if (leaguePathMatch) {
    return { kind: "league", leagueId: leaguePathMatch[1], username: "" };
  }

  if (/^\d+$/.test(value)) {
    return { kind: "league", leagueId: value, username: "" };
  }

  const userUrl = normalizeUsername(value);
  if (SLEEPER_USER_PATH.test(value) && userUrl) {
    return { kind: "username", leagueId: "", username: userUrl };
  }

  const embeddedId = value.match(LONG_NUMERIC_ID);
  if (embeddedId && /sleeper\.app/i.test(value)) {
    return { kind: "league", leagueId: embeddedId[1], username: "" };
  }

  return { kind: "username", leagueId: "", username: normalizeUsername(value) };
}

export function uniqueSeasons(currentSeason, extra = 1) {
  const season = Number(currentSeason);
  const base = Number.isFinite(season) && season > 2000 ? season : new Date().getUTCFullYear();
  const seasons = [];
  for (let offset = 0; offset <= extra; offset += 1) {
    seasons.push(String(base - offset));
  }
  return seasons;
}

export function sortUserLeagues(leagues, currentSeason) {
  const current = String(currentSeason || "");
  return [...(leagues || [])].sort((a, b) => {
    const aCurrent = String(a?.season || "") === current ? 0 : 1;
    const bCurrent = String(b?.season || "") === current ? 0 : 1;
    if (aCurrent !== bCurrent) return aCurrent - bCurrent;
    const statusRank = (league) => {
      const status = String(league?.status || "");
      if (status === "in_season") return 0;
      if (status === "pre_draft" || status === "drafting") return 1;
      if (status === "complete") return 2;
      return 3;
    };
    if (statusRank(a) !== statusRank(b)) return statusRank(a) - statusRank(b);
    const rosterDelta = Number(b?.total_rosters || 0) - Number(a?.total_rosters || 0);
    if (rosterDelta) return rosterDelta;
    return String(a?.name || "").localeCompare(String(b?.name || ""));
  });
}

export function buildShareParams({
  leagueId,
  meRosterId = null,
  tab = "",
  week = null,
  tone = "",
} = {}) {
  const params = new URLSearchParams();
  if (leagueId) params.set("league", String(leagueId));
  if (meRosterId) params.set("me", String(meRosterId));
  if (tab && tab !== "home") params.set("tab", String(tab));
  if (Number.isFinite(Number(week)) && Number(week) > 0) params.set("week", String(week));
  if (tone && tone !== "desk") params.set("tone", String(tone));
  return params;
}

export function parseShareParams(search) {
  const params = new URLSearchParams(String(search || "").replace(/^\?/, ""));
  const league = String(params.get("league") || "").trim();
  const me = Number(params.get("me"));
  const tab = String(params.get("tab") || "").trim();
  const week = Number(params.get("week"));
  const tone = String(params.get("tone") || "").trim();
  return {
    leagueId: parseLeagueId(league) || league,
    meRosterId: Number.isFinite(me) && me > 0 ? me : null,
    tab: tab || "",
    week: Number.isFinite(week) && week > 0 ? week : null,
    tone: tone || "",
  };
}

export function buildShareUrl({ origin, pathname, ...rest }) {
  const params = buildShareParams(rest);
  const path = pathname || "/";
  const query = params.toString();
  return `${origin || ""}${path}${query ? `?${query}` : ""}`;
}
