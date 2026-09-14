export const API_BASE = "https://api.sleeper.app/v1";
export const SLEEPER_AVATAR_BASE = "https://sleepercdn.com/avatars/thumbs/";
export const SAMPLE_VALUES_PATH = "./data/ktc_values_sample.csv";
export const PLAYERS_CACHE_TTL_MS = 1000 * 60 * 60 * 24;
export const SIM_ITERATIONS = 4000;
export const PAGE_IDS = ["home", "teams", "awards", "analytics", "trader", "recap"];
export const PAGE_LABELS = {
  home: "Command Center",
  teams: "Teams",
  awards: "Awards",
  analytics: "History",
  trader: "Trade Lab",
  recap: "Recap",
};
export const PHONE_PAGE_ORDER = ["home", "recap", "trader", "teams", "awards", "analytics"];
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
