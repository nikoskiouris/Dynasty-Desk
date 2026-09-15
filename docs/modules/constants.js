export const API_BASE = "https://api.sleeper.app/v1";
export const SLEEPER_AVATAR_BASE = "https://sleepercdn.com/avatars/thumbs/";
export const SAMPLE_VALUES_PATH = "./data/ktc_values_sample.csv";
export const PLAYERS_CACHE_TTL_MS = 1000 * 60 * 60 * 24;
export const SIM_ITERATIONS = 4000;
export const PAGE_IDS = ["team", "league", "trader"];
export const DEFAULT_PAGE = "league";
export const PAGE_LABELS = {
  team: "My Team",
  league: "League",
  trader: "Trades",
  home: "League",
  teams: "My Team",
  awards: "League",
  analytics: "League",
  recap: "League",
};
export const PAGE_ALIASES = {
  home: "league",
  teams: "team",
  awards: "league",
  analytics: "league",
  recap: "league",
  history: "league",
  trade: "trader",
  trades: "trader",
  calculator: "trader",
  calc: "trader",
  passport: "trader",
  lab: "trader",
  generator: "trader",
};
export const TRADE_ROOMS = ["history", "calculator", "passport", "lab"];
export const DEFAULT_TRADE_ROOM = "history";
export const TRADE_ROOM_LABELS = {
  history: "Trade History",
  calculator: "Calculator",
  passport: "Passport",
  lab: "Find deals",
};
export const TRADE_ROOM_HINTS = {
  history: "Past deals and grades",
  calculator: "Build both sides",
  passport: "Career stamps",
  lab: "Shop, acquire, blockbuster",
};
export const TRADE_TAB_IDLE_HINT = "History, calculator, find deals";
export const TRADE_ROOM_ALIASES = {
  history: "history",
  file: "history",
  tradehistory: "history",
  calculator: "calculator",
  calc: "calculator",
  passport: "passport",
  lab: "lab",
  generator: "lab",
  shop: "lab",
  acquire: "lab",
  blockbuster: "lab",
};
export const LEAGUE_ROOMS = ["now", "awards", "recap", "hall"];
export const DEFAULT_LEAGUE_ROOM = "now";
export const LEAGUE_ROOM_LABELS = {
  now: "Now",
  awards: "Awards",
  recap: "Recap",
  hall: "Hall",
};
export const LEAGUE_ROOM_HINTS = {
  now: "Scores, standings, odds",
  awards: "Weekly honors",
  recap: "Group chat recap",
  hall: "All-time archive",
};
export const LEAGUE_TAB_IDLE_HINT = "Now, awards, recap, hall";
export const LEAGUE_ROOM_ALIASES = {
  now: "now",
  home: "now",
  scores: "now",
  standings: "now",
  awards: "awards",
  recap: "recap",
  hall: "hall",
  analytics: "hall",
  history: "hall",
  wire: "hall",
};
export const PHONE_PAGE_ORDER = ["league", "team", "trader"];
export const DEFAULT_FAIRNESS_PCT = 20;
export const DEFAULT_MAX_RESULTS = 3;
export const DEMO_LEAGUE_ID = "1315165104303513600";
export const AUTOSELECT_MANAGER_BY_LEAGUE = {
  [DEMO_LEAGUE_ID]: "NikoSkiouris",
};
export const TRANSACTION_WEEK_START = 1;
export const TRANSACTION_WEEK_FALLBACK_END = 18;
export const ANALYTICS_RECENT_TRADE_LIMIT = 6;
export const ANALYTICS_POWER_RANK_LIMIT = 12;
export const ANALYTICS_ASSET_LEADER_LIMIT = 8;
export const MAX_HISTORY_SEASONS = 6;
export const HISTORY_TRANSACTION_SEASON_LIMIT = 4;
export const HISTORY_MATCHUP_SEASON_LIMIT = 6;
export const HISTORY_COMPARE_H2H_LIMIT = 6;
export const HISTORY_COMPARE_ROSTER_LIMIT = 8;
export const PHONE_LAYOUT_QUERY = "(max-width: 700px), (max-height: 500px) and (orientation: landscape) and (hover: none) and (pointer: coarse)";
export const LIVE_POLL_INTERVAL_MS = 30000;
export const LIVE_SIM_REFRESH_MS = 180000;
export const MATCHUP_FETCH_CHUNK = 3;
