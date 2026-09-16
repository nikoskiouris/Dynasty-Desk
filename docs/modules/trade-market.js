import { pickValueBundle } from "./values.js";

export const TRADE_VALUES_JSON_PATH = "./data/sleeper_trade_values.json";
export const TRADE_MARKET_WEIGHT = 2.4;
export const KTC_PRIOR_STRENGTH = 6;

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
  const oneQb = coerceTradeFormatMap(payload.oneQb || payload.sf || payload.values || {});
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

export function blendMarketValues(ktcValues, tradeValues, tradeCounts = {}) {
  const ktc = ktcValues && typeof ktcValues === "object" ? ktcValues : {};
  const trades = tradeValues && typeof tradeValues === "object" ? tradeValues : {};
  const counts = tradeCounts && typeof tradeCounts === "object" ? tradeCounts : {};
  const out = {};
  const ids = new Set([...Object.keys(ktc), ...Object.keys(trades)]);
  for (const assetId of ids) {
    const ktcValue = Number(ktc[assetId]);
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
