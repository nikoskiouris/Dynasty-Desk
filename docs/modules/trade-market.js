import { parsePickAssetId, pickValueBundle, PICK_YEAR_DISCOUNT } from "./values.js";

export const TRADE_VALUES_JSON_PATH = "./data/sleeper_trade_values.json";
export const TRADE_MARKET_WEIGHT = 2.4;
export const KTC_PRIOR_STRENGTH = 6;
export const VALUATION_MODEL_VERSION = "market-v2";
export const PICK_ROUND_MAX_RATIO = 0.78;

export function emptyTradeMarketBundle() {
  return {
    sf: { values: {}, counts: {} },
    oneQb: { values: {}, counts: {} },
    names: {},
    meta: null,
  };
}

export function coerceTradeFormatMap(payload) {
  if (!payload || typeof payload !== "object") return { values: {}, counts: {} };
  if (payload.values && typeof payload.values === "object") {
    return {
      values: { ...payload.values },
      counts: payload.counts && typeof payload.counts === "object" ? { ...payload.counts } : {},
    };
  }
  return { values: { ...payload }, counts: {} };
}

export function coerceTradeMarketBundle(payload) {
  if (!payload || typeof payload !== "object") return emptyTradeMarketBundle();
  const sf = coerceTradeFormatMap(payload.sf || payload.values || {});
  // Absence of 1QB evidence is an explicit state. Never leak SF evidence into it.
  const oneQb = coerceTradeFormatMap(payload.oneQb || {});
  return {
    sf,
    oneQb,
    names: payload.names && typeof payload.names === "object" ? payload.names : {},
    meta: payload.meta && typeof payload.meta === "object" ? payload.meta : null,
  };
}

export function pickTradeMarket(bundle, format) {
  const coerced = coerceTradeMarketBundle(bundle);
  return format === "oneQb" ? coerced.oneQb : coerced.sf;
}

export function tradeBlendWeight(observationCount) {
  const n = Math.max(0, Number(observationCount) || 0);
  if (n <= 0) return 0;
  return (TRADE_MARKET_WEIGHT * n) / (TRADE_MARKET_WEIGHT * n + KTC_PRIOR_STRENGTH);
}

function inferPickPrior(assetId, priorValues) {
  const meta = parsePickAssetId(assetId);
  if (!meta) return null;
  const targetSeason = Number(meta.season);
  if (!Number.isFinite(targetSeason)) return null;
  const bucket = meta.round === 1 ? meta.bucket : "any";
  const candidates = [];
  for (const [candidateId, rawValue] of Object.entries(priorValues || {})) {
    const candidate = parsePickAssetId(candidateId);
    const value = Number(rawValue);
    if (!candidate || !Number.isFinite(value) || value <= 0) continue;
    if (candidate.round !== meta.round) continue;
    const candidateBucket = candidate.round === 1 ? candidate.bucket : "any";
    if (candidateBucket !== bucket) continue;
    const season = Number(candidate.season);
    if (!Number.isFinite(season)) continue;
    candidates.push({ season, value });
  }
  if (!candidates.length && bucket !== "any") {
    return inferPickPrior(`pick:${meta.season}:r${meta.round}:any`, priorValues);
  }
  candidates.sort((a, b) => Math.abs(a.season - targetSeason) - Math.abs(b.season - targetSeason));
  const nearest = candidates[0];
  if (!nearest) return null;
  const factor = PICK_YEAR_DISCOUNT ** (targetSeason - nearest.season);
  return Math.max(1, Math.round(nearest.value * Math.max(0.5, Math.min(1.5, factor))));
}

export function blendMarketValues(ktcValues, tradeValues, tradeCounts = {}) {
  const ktc = ktcValues && typeof ktcValues === "object" ? ktcValues : {};
  const trades = tradeValues && typeof tradeValues === "object" ? tradeValues : {};
  const counts = tradeCounts && typeof tradeCounts === "object" ? tradeCounts : {};
  const out = {};
  const ids = new Set([...Object.keys(ktc), ...Object.keys(trades)]);
  for (const assetId of ids) {
    const rawKtcValue = Number(ktc[assetId]);
    const inferredPickPrior = Number.isFinite(rawKtcValue) && rawKtcValue > 0
      ? null
      : inferPickPrior(assetId, ktc);
    const ktcValue = Number.isFinite(rawKtcValue) && rawKtcValue > 0 ? rawKtcValue : inferredPickPrior;
    const tradeValue = Number(trades[assetId]);
    const count = Number(counts[assetId]) || 0;
    const hasKtc = Number.isFinite(ktcValue) && ktcValue > 0;
    const hasTrade = Number.isFinite(tradeValue) && tradeValue > 0 && count > 0;
    if (hasKtc && hasTrade) {
      const weight = tradeBlendWeight(count);
      out[assetId] = Math.max(1, Math.round(Math.exp(
        (1 - weight) * Math.log(ktcValue) + weight * Math.log(tradeValue)
      )));
    } else if (hasTrade) {
      out[assetId] = Math.max(1, Math.round(tradeValue));
    } else if (hasKtc) {
      out[assetId] = Math.round(ktcValue);
    }
  }
  return enforcePickCoherence(out);
}

export function enforcePickCoherence(values) {
  const out = { ...(values || {}) };
  const rows = Object.entries(out)
    .map(([assetId, value]) => ({ assetId, value: Number(value), meta: parsePickAssetId(assetId) }))
    .filter((row) => row.meta && Number.isFinite(row.value) && row.value > 0);

  const seasons = new Set(rows.map((row) => row.meta.season));
  for (const season of seasons) {
    const generic = rows
      .filter((row) => row.meta.season === season && row.meta.bucket === "any")
      .sort((a, b) => a.meta.round - b.meta.round);
    for (let index = 1; index < generic.length; index += 1) {
      const previous = generic[index - 1];
      const current = generic[index];
      if (current.meta.round !== previous.meta.round + 1) continue;
      const ceiling = Math.max(1, Math.round(out[previous.assetId] * PICK_ROUND_MAX_RATIO));
      if (out[current.assetId] >= out[previous.assetId]) out[current.assetId] = ceiling;
    }

    const firstBuckets = Object.fromEntries(
      rows
        .filter((row) => row.meta.season === season && row.meta.round === 1)
        .map((row) => [row.meta.bucket, row.assetId]),
    );
    const earlyId = firstBuckets.early;
    const midId = firstBuckets.mid;
    const lateId = firstBuckets.late;
    const anyId = firstBuckets.any;
    if (earlyId && midId && out[earlyId] < out[midId]) out[earlyId] = out[midId];
    if (midId && lateId && out[midId] < out[lateId]) out[midId] = out[lateId];
    if (anyId && earlyId && out[anyId] > out[earlyId]) out[anyId] = out[earlyId];
    if (anyId && lateId && out[anyId] < out[lateId]) out[anyId] = out[lateId];
  }
  return out;
}

export function composeValuationBundles(ktcBundles, tradeBundle) {
  const trade = coerceTradeMarketBundle(tradeBundle);
  const blendFormat = (format) => {
    const ktc = pickValueBundle(ktcBundles, format);
    const market = pickTradeMarket(trade, format);
    return {
      values: blendMarketValues(ktc.values, market.values, market.counts),
      nameMap: { ...trade.names, ...ktc.nameMap },
    };
  };
  const sf = blendFormat("sf");
  const oneQb = blendFormat("oneQb");
  const asOf = String(trade.meta?.updatedAt || "ktc");
  return {
    sf,
    oneQb,
    names: {
      ...(ktcBundles?.names || {}),
      ...trade.names,
      ...oneQb.nameMap,
      ...sf.nameMap,
    },
    tradeMeta: trade.meta,
    valuationVersion: `${VALUATION_MODEL_VERSION}:${asOf}`,
    modelVersion: VALUATION_MODEL_VERSION,
  };
}

export async function fetchTradeMarketBundle(fetchImpl = globalThis.fetch) {
  try {
    const response = await fetchImpl(TRADE_VALUES_JSON_PATH);
    if (!response?.ok) return emptyTradeMarketBundle();
    return coerceTradeMarketBundle(await response.json());
  } catch {
    return emptyTradeMarketBundle();
  }
}
