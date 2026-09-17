#!/usr/bin/env python3
from pathlib import Path
import re

APP = Path(__file__).resolve().parents[1] / "docs" / "app.js"
text = APP.read_text(encoding="utf-8")


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    text = text.replace(old, new, 1)


replace_once(
    '''function calculatePackageAdjustment({ myValues, theirValues, globalMaxValue }) {
  const myBaseValue = myValues.reduce((sum, value) => sum + value, 0);
  const theirBaseValue = theirValues.reduce((sum, value) => sum + value, 0);
  const tradeMaxValue = Math.max(0, ...myValues, ...theirValues);

  if (!tradeMaxValue) {''',
    '''function calculatePackageAdjustment({ myValues, theirValues, globalMaxValue }) {
  const myBaseValue = myValues.reduce((sum, value) => sum + value, 0);
  const theirBaseValue = theirValues.reduce((sum, value) => sum + value, 0);

  // A consolidation premium only makes sense when one side is actually consolidating.
  // Equal-sized packages, especially elite one-for-one swaps, should remain legible from
  // the displayed individual market values instead of receiving another nonlinear bump.
  if (myValues.length === theirValues.length) {
    return {
      myBaseValue,
      theirBaseValue,
      myAdjustedValue: myBaseValue,
      theirAdjustedValue: theirBaseValue,
      packageAdjustment: 0,
      packageAdjustmentSide: null,
      evenValue: 0,
    };
  }

  const tradeMaxValue = Math.max(0, ...myValues, ...theirValues);

  if (!tradeMaxValue) {''',
    "equal-package calculator guard",
)

replace_once(
    '''function ratherMarketValues() {
  return state.valueBundles?.sf?.values && Object.keys(state.valueBundles.sf.values).length
    ? state.valueBundles.sf.values
    : state.values;
}''',
    '''function ratherMarketValues() {
  const format = state.valueFormat === "oneQb" ? "oneQb" : "sf";
  const selected = state.valueBundles?.[format]?.values;
  return selected && Object.keys(selected).length ? selected : state.values;
}''',
    "format-specific rather values",
)

replace_once(
    '''function refreshCrowdShifts() {
  state.crowdShifts = crowdShiftsFromVotes(crowdVoteSource(), ratherMarketValues(), {
    format: state.valueFormat || "sf",
  });
}''',
    '''function refreshCrowdShifts() {
  state.crowdShifts = crowdShiftsFromVotes(crowdVoteSource(), ratherMarketValues(), {
    format: state.valueFormat || "sf",
  });
  state.valuationRevision = Number(state.valuationRevision || 0) + 1;
}''',
    "valuation revision",
)

replace_once(
    '''function invalidateSeasonModelCache() {
  state.seasonModelCache = { key: "", model: null };
}

function simSignature(model) {''',
    '''function invalidateSeasonModelCache() {
  state.seasonModelCache = { key: "", model: null };
}

function valuationCacheVersion() {
  const sourceVersion = state.valueBundles?.valuationVersion
    || state.tradeMarketBundle?.meta?.updatedAt
    || "local";
  const leagueBasis = state.applyLeagueBoard
    ? `league:${Number(state.leagueBoard?.tradeCount || 0)}`
    : "market";
  return `${sourceVersion}:${Number(state.valuationRevision || 0)}:${leagueBasis}`;
}

function simSignature(model) {''',
    "valuation cache version helper",
)

replace_once(
    '''    Object.keys(state.values).length,
    state.previousRosters.length,''',
    '''    valuationCacheVersion(),
    state.previousRosters.length,''',
    "simulation valuation cache key",
)

replace_once(
    '''    state.historyTransactions.length,
    state.transactions.length,
    Object.keys(state.values || {}).length,
    (state.historyMatchups || []).length,''',
    '''    state.historyTransactions.length,
    state.transactions.length,
    valuationCacheVersion(),
    (state.historyMatchups || []).length,''',
    "history valuation cache key",
)

replace_once(
    '''    state.leagueId || "",
    rosterId || "",
    Object.keys(state.values || {}).length,
    state.playerMetadataLoaded ? "players" : "names",''',
    '''    state.leagueId || "",
    rosterId || "",
    valuationCacheVersion(),
    state.playerMetadataLoaded ? "players" : "names",''',
    "trade match valuation cache key",
)

old_hydrate = '''async function hydrateCrowdVotes() {
  if (state.crowdVotesLive && Array.isArray(state.crowdVotes)) return true;
  const remote = await fetchRatherCrowdVotes();
  if (!Array.isArray(remote)) return false;
  state.crowdVotes = remote;
  state.crowdVotesLive = true;
  return true;
}'''
new_hydrate = '''let crowdRefreshTimer = null;

function applyRemoteCrowdVotes(remote, { rerender = true } = {}) {
  if (!Array.isArray(remote)) return false;
  const currentFingerprint = (state.crowdVotes || [])
    .map((vote) => vote.eventId || `${vote.winnerId}|${vote.loserId}|${vote.at}|${vote.format}`)
    .join(";");
  const nextFingerprint = remote
    .map((vote) => vote.eventId || `${vote.winnerId}|${vote.loserId}|${vote.at}|${vote.format}`)
    .join(";");
  state.crowdVotes = remote;
  state.crowdVotesLive = true;
  if (currentFingerprint === nextFingerprint) return true;
  refreshCrowdShifts();
  refreshPlayerPositionRanks();
  if (rerender && state.leagueId) {
    renderActivePage();
    renderSessionSnapshot();
  }
  return true;
}

function ensureCrowdRefreshTimer() {
  if (crowdRefreshTimer || typeof globalThis.setInterval !== "function") return;
  crowdRefreshTimer = globalThis.setInterval(async () => {
    if (document.hidden) return;
    const remote = await fetchRatherCrowdVotes();
    applyRemoteCrowdVotes(remote);
  }, 60_000);
}

async function hydrateCrowdVotes() {
  if (state.crowdVotesLive && Array.isArray(state.crowdVotes)) {
    ensureCrowdRefreshTimer();
    return true;
  }
  const remote = await fetchRatherCrowdVotes();
  if (!Array.isArray(remote)) return false;
  applyRemoteCrowdVotes(remote, { rerender: false });
  ensureCrowdRefreshTimer();
  return true;
}'''
replace_once(old_hydrate, new_hydrate, "cross-client crowd refresh")

choose_pattern = re.compile(
    r"function chooseRatherPlayer\(winnerId\) \{.*?\n\}\n\nfunction handleLandingRatherClick",
    re.DOTALL,
)
choose_matches = choose_pattern.findall(text)
if len(choose_matches) != 1:
    raise RuntimeError(f"saved-vote UI: expected one chooseRatherPlayer block, found {len(choose_matches)}")
new_choose = '''async function chooseRatherPlayer(winnerId) {
  const pair = ratherPromptPair;
  if (!pair) {
    showNextRatherMatchup();
    return;
  }
  const ids = [pair.left?.assetId, pair.right?.assetId].filter(Boolean);
  const loserId = ids.find((id) => id !== winnerId) || "";
  const winnerName = winnerId === pair.left?.assetId ? pair.left?.name : pair.right?.name;
  if (!winnerId || !loserId) return;

  const vote = {
    winnerId,
    loserId,
    format: formatRatherDetail(DEFAULT_RATHER_FORMAT),
  };
  el.landingRather.innerHTML = renderRatherMarkup(pair, DEFAULT_RATHER_FORMAT, { status: "Saving vote…" });
  bindRatherPhotos(el.landingRather);
  el.landingRather.querySelectorAll?.("[data-rather-pick], #rather-skip").forEach((button) => {
    button.disabled = true;
  });

  const remote = await submitRatherCrowdVote(vote);
  if (!Array.isArray(remote)) {
    el.landingRather.innerHTML = renderRatherMarkup(pair, DEFAULT_RATHER_FORMAT, {
      status: "Vote not saved. Try again.",
    });
    bindRatherPhotos(el.landingRather);
    return;
  }

  recordRatherVote({ ...vote, at: Date.now(), format: DEFAULT_RATHER_FORMAT });
  applyRemoteCrowdVotes(remote);
  if (pair.key) pushRatherRecentKey(pair.key);

  const names = state.valueBundles?.names || state.valueNameMap || {};
  const nflPlayers = Object.keys(ratherPromptContext.nflPlayers || {}).length
    ? ratherPromptContext.nflPlayers
    : (getPlayersCache()?.players || state.players || {});
  const winnerRow = buildRatherBoard(
    listRatherPlayers(ratherMarketValues(), names, { minValue: 1 }),
    nflPlayers,
    state.crowdShifts
  ).find((row) => row.assetId === winnerId);
  const status = winnerName && winnerRow?.boardRank
    ? `Saved. ${winnerName} is ${winnerRow.boardRank} on the desk.`
    : winnerName
      ? `Saved. ${winnerName}.`
      : "Saved.";
  showNextRatherMatchup({ status });
}

function handleLandingRatherClick'''
text = choose_pattern.sub(new_choose, text, count=1)

APP.write_text(text, encoding="utf-8")
print("Materialized audited app fixes.")
