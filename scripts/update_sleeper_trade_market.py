#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
KTC_JSON_PATH = ROOT / "docs" / "data" / "ktc_values.json"
OUTPUT_PATH = ROOT / "docs" / "data" / "sleeper_trade_values.json"
SEED_PATH = ROOT / "scripts" / "sleeper_trade_seeds.txt"
SLEEPER_BASE_URL = "https://api.sleeper.app/v1"
DEFAULT_SEED_LEAGUES = ("1315165104303513600",)
DEFAULT_MAX_LEAGUES = 72
DEFAULT_PREVIOUS_SEASONS = 3
TRANSACTION_WEEKS = tuple(range(0, 19))
REQUEST_TIMEOUT_SECONDS = 18
MIN_REQUEST_INTERVAL_SECONDS = 0.08
MAX_WORKERS = 4
LEARNING_RATE = 0.09
FIT_ITERATIONS = 10
HALF_LIFE_MS = 120 * 24 * 60 * 60 * 1000
MIN_SIDE_VALUE = 350.0
MIN_COUNT_TO_KEEP = 0.75
PICK_YEAR_DISCOUNT = 0.88
PICK_ROUND_MAX_RATIO = 0.78
UNKNOWN_PLAYER_PRIOR = 1200.0
PICK_RE = re.compile(r"^pick:(20\d{2}):r(\d+):(any|early|mid|middle|late)$")


@dataclass(frozen=True)
class TradeObs:
    side_a: tuple[str, ...]
    side_b: tuple[str, ...]
    created_ms: int
    superflex: bool
    transaction_id: str = ""
    league_id: str = ""


class RateLimiter:
    def __init__(self, min_interval: float) -> None:
        self.min_interval = min_interval
        self._lock = Lock()
        self._last = 0.0

    def wait(self) -> None:
        with self._lock:
            now = time.monotonic()
            delay = self.min_interval - (now - self._last)
            if delay > 0:
                time.sleep(delay)
            self._last = time.monotonic()


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    max_leagues = DEFAULT_MAX_LEAGUES
    if "--max-leagues" in args:
        idx = args.index("--max-leagues")
        max_leagues = int(args[idx + 1])

    try:
        ktc = load_ktc_values()
        nfl_state = fetch_json("/state/nfl") or {}
        season = str(nfl_state.get("league_season") or nfl_state.get("season") or datetime.now(timezone.utc).year)
        trades, meta = collect_sleeper_trades(season, max_leagues=max_leagues)
        sf_trades = [trade for trade in trades if trade.superflex]
        one_qb_trades = [trade for trade in trades if not trade.superflex]
        sf_values, sf_counts = fit_trade_values(ktc.get("sf") or {}, sf_trades)
        one_qb_values, one_qb_counts = fit_trade_values(ktc.get("oneQb") or {}, one_qb_trades)
        if not sf_values and not one_qb_values:
            raise RuntimeError(f"No usable Sleeper trades fitted from {meta.get('tradeCount', 0)} collected trades.")
        sf_values = enforce_pick_hierarchy(sf_values)
        one_qb_values = enforce_pick_hierarchy(one_qb_values)
        validate_pick_hierarchy(sf_values)
        validate_pick_hierarchy(one_qb_values)
        write_output(sf_values, sf_counts, one_qb_values, one_qb_counts, meta)
        print(
            f"Wrote {len(sf_values)} SF and {len(one_qb_values)} 1QB trade-implied values "
            f"from {meta.get('tradeCount', 0)} trades in {meta.get('leagueCount', 0)} leagues to {OUTPUT_PATH}"
        )
        return 0
    except Exception as exc:
        print(f"Sleeper trade market update failed: {exc}", file=sys.stderr)
        return 0 if OUTPUT_PATH.exists() else 1


def load_ktc_values() -> dict:
    if not KTC_JSON_PATH.exists():
        return {"sf": {}, "oneQb": {}}
    payload = json.loads(KTC_JSON_PATH.read_text(encoding="utf-8"))
    return {
        "sf": payload.get("sf") or {},
        "oneQb": payload.get("oneQb") or {},
    }


def collect_sleeper_trades(season: str, max_leagues: int = DEFAULT_MAX_LEAGUES) -> tuple[list[TradeObs], dict]:
    limiter = RateLimiter(MIN_REQUEST_INTERVAL_SECONDS)
    seeds = load_seed_league_ids()
    queue: list[str] = []
    seen: set[str] = set()
    for league_id in seeds:
        push_league(queue, seen, league_id)

    processed: list[str] = []
    trades: list[TradeObs] = []
    discovered_dynasty = 0

    while queue and len(processed) < max_leagues:
        league_id = queue.pop(0)
        try:
            league = fetch_json(f"/league/{league_id}", limiter=limiter)
        except Exception:
            continue
        if not isinstance(league, dict) or not league_is_dynasty(league):
            continue
        discovered_dynasty += 1
        processed.append(league_id)
        superflex = league_is_superflex(league)
        try:
            users = fetch_json(f"/league/{league_id}/users", limiter=limiter) or []
        except Exception:
            users = []
        league_trades = fetch_league_trades(league_id, superflex, limiter)
        trades.extend(league_trades)

        push_league(queue, seen, str(league.get("previous_league_id") or ""))

        for user in users[:10]:
            user_id = user.get("user_id") if isinstance(user, dict) else None
            if not user_id:
                continue
            try:
                user_leagues = fetch_json(f"/user/{user_id}/leagues/nfl/{season}", limiter=limiter) or []
            except Exception:
                continue
            for entry in user_leagues:
                if isinstance(entry, dict) and league_is_dynasty(entry):
                    push_league(queue, seen, str(entry.get("league_id") or ""))

    trades = sorted(trades, key=trade_sort_key)
    meta = {
        "updatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "leagueCount": len(processed),
        "discoveredDynastyLeagues": discovered_dynasty,
        "tradeCount": len(trades),
        "season": season,
        "source": "sleeper",
        "modelVersion": "trade-fit-v2",
    }
    return trades, meta


def fetch_league_trades(league_id: str, superflex: bool, limiter: RateLimiter) -> list[TradeObs]:
    trades: list[TradeObs] = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {
            pool.submit(fetch_json, f"/league/{league_id}/transactions/{week}", limiter): week
            for week in TRANSACTION_WEEKS
        }
        for future in as_completed(futures):
            try:
                payload = future.result()
            except Exception:
                continue
            if not isinstance(payload, list):
                continue
            for transaction in payload:
                parsed = parse_trade_observation(transaction, superflex=superflex, league_id=league_id)
                if parsed:
                    trades.append(parsed)
    return sorted(trades, key=trade_sort_key)


def parse_trade_observation(transaction: dict, superflex: bool, league_id: str = "") -> TradeObs | None:
    if not isinstance(transaction, dict):
        return None
    if transaction.get("type") != "trade" or transaction.get("status") != "complete":
        return None
    roster_ids = [str(roster_id) for roster_id in (transaction.get("roster_ids") or []) if roster_id is not None]
    roster_ids = list(dict.fromkeys(roster_ids))
    if len(roster_ids) != 2:
        return None

    # Ignore trades with FAAB because dropping that side payment would create a false equality.
    waiver_budget = transaction.get("waiver_budget") or []
    if waiver_budget:
        return None

    packages = {roster_ids[0]: [], roster_ids[1]: []}
    adds = transaction.get("adds") if isinstance(transaction.get("adds"), dict) else {}
    for player_id, to_roster_id in adds.items():
        roster_key = str(to_roster_id)
        if roster_key in packages:
            packages[roster_key].append(f"player:{player_id}")

    for pick in transaction.get("draft_picks") or []:
        if not isinstance(pick, dict):
            continue
        roster_key = str(pick.get("owner_id") or "")
        season = pick.get("season")
        round_ = pick.get("round")
        if roster_key not in packages or season in (None, "") or round_ in (None, ""):
            continue
        try:
            round_number = int(round_)
        except (TypeError, ValueError):
            continue
        packages[roster_key].append(f"pick:{season}:r{round_number}:any")

    side_a = tuple(sorted(packages[roster_ids[0]]))
    side_b = tuple(sorted(packages[roster_ids[1]]))
    if not side_a or not side_b:
        return None
    created = transaction.get("status_updated") or transaction.get("created") or 0
    try:
        created_ms = int(created)
    except (TypeError, ValueError):
        created_ms = 0
    return TradeObs(
        side_a=side_a,
        side_b=side_b,
        created_ms=created_ms,
        superflex=superflex,
        transaction_id=str(transaction.get("transaction_id") or ""),
        league_id=str(league_id or ""),
    )


def trade_sort_key(trade: TradeObs) -> tuple:
    return (
        int(trade.created_ms or 0),
        str(trade.league_id or ""),
        str(trade.transaction_id or ""),
        trade.side_a,
        trade.side_b,
    )


def parse_pick(asset_id: str) -> tuple[int, int, str] | None:
    match = PICK_RE.match(str(asset_id or ""))
    if not match:
        return None
    bucket = "mid" if match.group(3) == "middle" else match.group(3)
    return int(match.group(1)), int(match.group(2)), bucket


def pick_prior_value(asset_id: str, prior: dict[str, int | float]) -> float | None:
    target = parse_pick(asset_id)
    if not target:
        return None
    target_year, target_round, target_bucket = target
    wanted_bucket = target_bucket if target_round == 1 else "any"
    candidates: list[tuple[int, float]] = []
    for candidate_id, raw_value in (prior or {}).items():
        candidate = parse_pick(candidate_id)
        if not candidate:
            continue
        year, round_, bucket = candidate
        bucket = bucket if round_ == 1 else "any"
        try:
            value = float(raw_value)
        except (TypeError, ValueError):
            continue
        if value <= 0 or round_ != target_round or bucket != wanted_bucket:
            continue
        candidates.append((year, value))
    if not candidates and wanted_bucket != "any":
        generic_id = f"pick:{target_year}:r{target_round}:any"
        return pick_prior_value(generic_id, prior)
    if not candidates:
        return None
    year, value = min(candidates, key=lambda row: (abs(row[0] - target_year), row[0]))
    factor = PICK_YEAR_DISCOUNT ** (target_year - year)
    return max(1.0, value * max(0.5, min(1.5, factor)))


def starting_value(asset_id: str, prior: dict[str, int | float]) -> float:
    raw = prior.get(asset_id)
    try:
        numeric = float(raw)
    except (TypeError, ValueError):
        numeric = 0.0
    if numeric > 0:
        return numeric
    pick_value = pick_prior_value(asset_id, prior)
    if pick_value:
        return pick_value
    return UNKNOWN_PLAYER_PRIOR


def fit_trade_values(
    prior: dict[str, int | float],
    trades: list[TradeObs],
    *,
    now_ms: int | None = None,
    learning_rate: float = LEARNING_RATE,
    iterations: int = FIT_ITERATIONS,
) -> tuple[dict[str, int], dict[str, float]]:
    clock = now_ms if now_ms is not None else int(time.time() * 1000)
    log_value: dict[str, float] = {}
    counts: dict[str, float] = {}

    for asset_id, value in (prior or {}).items():
        numeric = float(value)
        if numeric > 0:
            log_value[asset_id] = math.log(numeric)

    ordered = sorted(trades, key=trade_sort_key)
    for trade in ordered:
        for asset_id in (*trade.side_a, *trade.side_b):
            if asset_id not in log_value:
                log_value[asset_id] = math.log(starting_value(asset_id, prior))

    usable: list[TradeObs] = []
    for trade in ordered:
        value_a = package_value(trade.side_a, log_value)
        value_b = package_value(trade.side_b, log_value)
        if value_a < MIN_SIDE_VALUE or value_b < MIN_SIDE_VALUE:
            continue
        usable.append(trade)
        recency = recency_weight(trade.created_ms, clock)
        for asset_id in (*trade.side_a, *trade.side_b):
            counts[asset_id] = counts.get(asset_id, 0.0) + recency

    if not usable:
        return {}, {}

    for _ in range(iterations):
        for trade in usable:
            recency = recency_weight(trade.created_ms, clock)
            value_a = package_value(trade.side_a, log_value)
            value_b = package_value(trade.side_b, log_value)
            gap = math.log(value_b) - math.log(value_a)
            if abs(gap) < 1e-9:
                continue
            apply_side_update(trade.side_a, log_value, gap, recency, value_a, learning_rate)
            apply_side_update(trade.side_b, log_value, -gap, recency, value_b, learning_rate)

    values: dict[str, int] = {}
    kept_counts: dict[str, float] = {}
    for asset_id, count in counts.items():
        if count < MIN_COUNT_TO_KEEP or asset_id not in log_value:
            continue
        values[asset_id] = max(1, int(round(math.exp(log_value[asset_id]))))
        kept_counts[asset_id] = round(count, 3)
    return enforce_pick_hierarchy(values), kept_counts


def package_value(asset_ids: tuple[str, ...], log_value: dict[str, float]) -> float:
    total = 0.0
    for asset_id in asset_ids:
        if asset_id in log_value:
            total += math.exp(log_value[asset_id])
    return total


def apply_side_update(
    asset_ids: tuple[str, ...],
    log_value: dict[str, float],
    gap: float,
    recency: float,
    side_value: float,
    learning_rate: float,
) -> None:
    if side_value <= 0:
        return
    for asset_id in asset_ids:
        current = math.exp(log_value[asset_id])
        share = current / side_value
        log_value[asset_id] += learning_rate * recency * gap * share
        log_value[asset_id] = max(math.log(50.0), min(math.log(20000.0), log_value[asset_id]))


def enforce_pick_hierarchy(values: dict[str, int]) -> dict[str, int]:
    out = dict(values or {})
    by_year: dict[int, dict[tuple[int, str], str]] = {}
    for asset_id in out:
        parsed = parse_pick(asset_id)
        if not parsed:
            continue
        year, round_, bucket = parsed
        by_year.setdefault(year, {})[(round_, bucket)] = asset_id

    for rows in by_year.values():
        generic_rounds = sorted(round_ for round_, bucket in rows if bucket == "any")
        for round_ in generic_rounds:
            if round_ <= 1:
                continue
            previous_id = rows.get((round_ - 1, "any"))
            current_id = rows.get((round_, "any"))
            if not previous_id or not current_id:
                continue
            if out[current_id] >= out[previous_id]:
                out[current_id] = max(1, int(round(out[previous_id] * PICK_ROUND_MAX_RATIO)))

        early_id = rows.get((1, "early"))
        mid_id = rows.get((1, "mid"))
        late_id = rows.get((1, "late"))
        any_id = rows.get((1, "any"))
        if early_id and mid_id and out[early_id] < out[mid_id]:
            out[early_id] = out[mid_id]
        if mid_id and late_id and out[mid_id] < out[late_id]:
            out[mid_id] = out[late_id]
        if any_id and early_id and out[any_id] > out[early_id]:
            out[any_id] = out[early_id]
        if any_id and late_id and out[any_id] < out[late_id]:
            out[any_id] = out[late_id]
    return out


def validate_pick_hierarchy(values: dict[str, int]) -> None:
    fixed = enforce_pick_hierarchy(values)
    if fixed != values:
        raise RuntimeError("Pick hierarchy validation failed after normalization.")


def recency_weight(created_ms: int, now_ms: int) -> float:
    if not created_ms:
        return 0.7
    age = max(0, now_ms - created_ms)
    return 2 ** (-age / HALF_LIFE_MS)


def league_is_dynasty(league: dict | None) -> bool:
    if not isinstance(league, dict):
        return False
    settings = league.get("settings") or {}
    league_type = settings.get("type")
    try:
        return int(league_type) == 2
    except (TypeError, ValueError):
        return str(league.get("settings", {}).get("type", "")).lower() == "dynasty"


def league_is_superflex(league: dict | None) -> bool:
    slots = [str(slot or "").upper() for slot in (league or {}).get("roster_positions") or []]
    if any(slot in {"SUPER_FLEX", "OP"} for slot in slots):
        return True
    return slots.count("QB") >= 2


def load_seed_league_ids() -> list[str]:
    ids: list[str] = []
    if SEED_PATH.exists():
        for line in SEED_PATH.read_text(encoding="utf-8").splitlines():
            token = line.split("#", 1)[0].strip()
            if token:
                ids.append(token)
    for seed in DEFAULT_SEED_LEAGUES:
        if seed not in ids:
            ids.append(seed)
    return ids


def push_league(queue: list[str], seen: set[str], league_id: str) -> None:
    token = str(league_id or "").strip()
    if not token or token in seen:
        return
    seen.add(token)
    queue.append(token)


def fetch_json(path: str, limiter: RateLimiter | None = None) -> dict | list | None:
    if limiter:
        limiter.wait()
    url = f"{SLEEPER_BASE_URL}{path}"
    request = Request(
        url,
        headers={
            "User-Agent": "DynastyTicker/1.0 (+https://dynastyticker.com)",
            "Accept": "application/json",
        },
    )
    try:
        with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            return json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"Sleeper request failed for {url}: {exc}") from exc


def write_output(
    sf_values: dict[str, int],
    sf_counts: dict[str, float],
    one_qb_values: dict[str, int],
    one_qb_counts: dict[str, float],
    meta: dict,
) -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "sf": {"values": sf_values, "counts": sf_counts},
        "oneQb": {"values": one_qb_values, "counts": one_qb_counts},
        "meta": {
            **meta,
            "sfPlayerCount": len({key for key in sf_values if key.startswith("player:")}),
            "oneQbPlayerCount": len({key for key in one_qb_values if key.startswith("player:")}),
        },
    }
    OUTPUT_PATH.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
