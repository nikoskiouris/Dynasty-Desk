import { ordinal } from "./season.js";

export const ELITE_VALUE_PREMIUM_TIERS = [
  { floor: 9000, multiplier: 1.32 },
  { floor: 8000, multiplier: 1.27 },
  { floor: 7000, multiplier: 1.21 },
  { floor: 6000, multiplier: 1.15 },
  { floor: 5000, multiplier: 1.09 },
];

export const KTC_GLOBAL_MAX_FALLBACK = 9999;
export const SAMPLE_VALUES_PATH = "./data/ktc_values_sample.csv";
export const VALUES_JSON_PATH = "./data/ktc_values.json";
export const VALUES_SF_PATH = "./data/ktc_values_sf.csv";
export const VALUES_ONE_QB_PATH = "./data/ktc_values_1qb.csv";

const TEP_MULTIPLIERS = {
  0: 1,
  1: 1.06,
  2: 1.12,
  3: 1.18,
};

export function leagueHasSuperflex(league) {
  const slots = Array.isArray(league?.roster_positions) ? league.roster_positions : [];
  const normalized = slots.map((slot) => String(slot || "").toUpperCase());
  if (normalized.some((slot) => slot === "SUPER_FLEX" || slot === "OP")) return true;
  return normalized.filter((slot) => slot === "QB").length >= 2;
}

export function tepLevelFromScoring(scoring = {}) {
  const bonus = Number(scoring.bonus_rec_te ?? scoring.rec_te ?? scoring.bonus_te_rec ?? 0);
  if (bonus >= 1.5) return 3;
  if (bonus >= 1) return 2;
  if (bonus >= 0.5) return 1;
  return 0;
}

export function tepLevel(league) {
  return tepLevelFromScoring(league?.scoring_settings || {});
}

export function tepMultiplier(level) {
  const key = Number(level) || 0;
  return TEP_MULTIPLIERS[key] ?? 1;
}

export function selectValueFormat(league) {
  return leagueHasSuperflex(league) ? "sf" : "oneQb";
}

export function parseCsvValues(csvText) {
  const rows = String(csvText || "").trim().split("\n");
  const values = {};
  const nameMap = {};
  for (let i = 1; i < rows.length; i += 1) {
    const [assetId, rawValue, ...rawNameParts] = rows[i].split(",");
    const value = Number(rawValue);
    const name = rawNameParts.join(",").trim();
    if (assetId && Number.isFinite(value)) {
      values[assetId] = value;
      if (name) nameMap[assetId] = name;
    }
  }
  return { values, nameMap };
}

export function coerceValueMap(payload) {
  if (Array.isArray(payload)) {
    return payload.reduce((acc, item) => {
      if (item?.asset_id && Number.isFinite(item.value)) {
        acc.values[item.asset_id] = item.value;
        if (item.name) acc.nameMap[item.asset_id] = item.name;
      }
      return acc;
    }, { values: {}, nameMap: {} });
  }
  return {
    values: payload?.values && typeof payload.values === "object" ? payload.values : payload || {},
    nameMap: payload?.nameMap && typeof payload.nameMap === "object" ? payload.nameMap : {},
  };
}

export function pickValueBundle(payload, format) {
  if (!payload || typeof payload !== "object") return { values: {}, nameMap: {} };
  if (payload.sf || payload.oneQb) {
    const selected = format === "oneQb"
      ? (payload.oneQb || payload.sf)
      : (payload.sf || payload.oneQb);
    const names = payload.names && typeof payload.names === "object"
      ? payload.names
      : selected?.nameMap || {};
    const values = selected?.values && typeof selected.values === "object" ? selected.values : selected || {};
    return { values, nameMap: selected?.nameMap || names };
  }
  return coerceValueMap(payload);
}

export function playerPositionForRaw(raw) {
  return (raw?.position || raw?.fantasy_positions?.[0] || "").toUpperCase();
}

export function playerPositionForAsset(asset) {
  return playerPositionForRaw(asset?.raw);
}

export function playerAgeForAsset(asset) {
  const age = Number(asset?.raw?.age);
  return Number.isFinite(age) ? age : null;
}

export function isInactivePlayerAsset(asset) {
  if (asset?.assetType !== "player") return false;
  if (asset.raw?.active === false) return true;
  const status = String(asset.raw?.status || "").trim().toLowerCase();
  if (["inactive", "retired", "reserve_retired", "reserve/did_not_report", "did_not_report"].includes(status)) {
    return true;
  }
  const team = String(asset.raw?.team || "").trim().toUpperCase();
  if (!team || team === "FA") {
    const age = playerAgeForAsset(asset);
    if (Number.isFinite(age) && age >= 30) return true;
  }
  return false;
}

export function estimatedValue(asset) {
  if (asset?.assetType === "pick") return 2200;
  if (isInactivePlayerAsset(asset)) return 0;
  const position = playerPositionForAsset(asset);
  const age = Number(asset?.raw?.age || 26);
  const baseByPos = {
    QB: 4300,
    RB: 4200,
    WR: 4000,
    TE: 3000,
    K: 100,
    DEF: 500,
  };
  const base = baseByPos[position] || 1800;
  const ageModifier = Math.max(-1400, (26 - age) * 130);
  return Math.max(300, Math.round(base + ageModifier));
}

export function applyElitePlayerValuePremium(asset, baseValue) {
  if (asset?.assetType !== "player" || !Number.isFinite(baseValue)) return baseValue;
  const premiumTier = ELITE_VALUE_PREMIUM_TIERS.find((tier) => baseValue >= tier.floor);
  if (!premiumTier) return baseValue;
  return Math.round(baseValue * premiumTier.multiplier);
}

export function normalizePickBucket(bucket) {
  const normalized = String(bucket || "any").trim().toLowerCase();
  if (normalized === "middle") return "mid";
  return normalized || "any";
}

export function getPickBucketAliases(bucket) {
  const normalized = normalizePickBucket(bucket);
  if (normalized === "mid") return ["mid", "middle"];
  return [normalized];
}

export function formatPickBucketLabel(bucket) {
  return {
    early: "Early",
    mid: "Middle",
    late: "Late",
  }[normalizePickBucket(bucket)] || "";
}

export function parsePickRoundToken(token) {
  const normalized = String(token || "").trim().toLowerCase();
  if (!normalized) return null;
  if (/^r\d+$/.test(normalized)) return Number(normalized.slice(1));
  if (/^\d+$/.test(normalized)) return Number(normalized);
  if (/^\d+(st|nd|rd|th)$/.test(normalized)) return Number.parseInt(normalized, 10);
  return null;
}

export function parsePickAssetId(assetId) {
  if (!String(assetId || "").startsWith("pick:")) return null;
  const [, season, ...rest] = String(assetId).split(":");
  const roundToken = rest.find((part) => /^r\d+$/i.test(part) || /^\d+$/i.test(part) || /^(?:\d+)(?:st|nd|rd|th)$/i.test(part));
  const bucketToken = rest.find((part) => /^(any|early|mid|middle|late)$/i.test(part));
  const round = parsePickRoundToken(roundToken);
  if (!season || !Number.isFinite(round)) return null;
  return {
    season,
    round,
    bucket: normalizePickBucket(bucketToken || "any"),
  };
}

export function parsePickDescriptor(input) {
  const source = String(input || "").trim();
  if (!source) return null;
  const seasonMatch = source.match(/\b(20\d{2})\b/);
  const bucketMatch = source.match(/\b(early|mid|middle|late)\b/i);
  const roundMatch = source.match(/\b(\d+)(?:st|nd|rd|th)\b/i) || source.match(/\br(?:ound)?\s*(\d+)\b/i);
  const season = seasonMatch?.[1];
  const round = roundMatch ? Number(roundMatch[1]) : null;
  if (!season || !Number.isFinite(round)) return null;
  return {
    season,
    round,
    bucket: normalizePickBucket(bucketMatch?.[1] || "any"),
  };
}

export function formatGenericPickAssetLabel(assetId) {
  const pickMeta = parsePickAssetId(assetId);
  if (!pickMeta) return assetId;
  const bucketLabel = pickMeta.bucket && pickMeta.bucket !== "any" ? ` ${formatPickBucketLabel(pickMeta.bucket)}` : "";
  if (Number.isFinite(pickMeta.round)) return `${pickMeta.season}${bucketLabel} ${ordinal(pickMeta.round)}`;
  return assetId;
}

export function resolvePickNameForCatalog(assetId, valueNameMap = {}) {
  if (valueNameMap[assetId]) return valueNameMap[assetId];
  return formatGenericPickAssetLabel(assetId);
}

export function buildPickValuationCatalog(values, valueNameMap = {}) {
  const catalog = [];
  Object.entries(values || {}).forEach(([assetId, value]) => {
    if (!Number.isFinite(value)) return;
    const pickMeta = parsePickAssetId(assetId) || parsePickDescriptor(valueNameMap[assetId] || assetId);
    if (!pickMeta) return;
    catalog.push({
      assetId,
      name: resolvePickNameForCatalog(assetId, valueNameMap),
      value,
      season: pickMeta.season,
      round: pickMeta.round,
      bucket: normalizePickBucket(pickMeta.bucket),
    });
  });
  return catalog;
}

export function getAssetPickBucket(asset) {
  if (asset?.assetType !== "pick") return "any";
  return normalizePickBucket(asset?.raw?.ktcBucket || asset?.valueBucket || "any");
}

export function buildPickLookupMeta(asset) {
  if (asset?.assetType !== "pick") return null;
  const valueMeta = parsePickAssetId(asset.valueAssetId || "");
  if (valueMeta) return valueMeta;
  const assetMeta = parsePickAssetId(asset.assetId || "");
  if (assetMeta) {
    return {
      ...assetMeta,
      bucket: assetMeta.round === 1 ? getAssetPickBucket(asset) : assetMeta.bucket,
    };
  }
  const season = asset?.raw?.season != null ? String(asset.raw.season) : "";
  const round = Number(asset?.raw?.round);
  if (!season || !Number.isFinite(round)) return null;
  return {
    season,
    round,
    bucket: round === 1 ? getAssetPickBucket(asset) : "any",
  };
}

export function buildPickValueLookupIds(asset) {
  const meta = buildPickLookupMeta(asset);
  if (!meta) return [];
  const ids = [];
  const seen = new Set();
  const push = (id) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  };
  if (asset.valueAssetId) push(asset.valueAssetId);
  if (meta.round === 1) {
    getPickBucketAliases(meta.bucket).forEach((bucket) => push(`pick:${meta.season}:r${meta.round}:${bucket}`));
  }
  push(`pick:${meta.season}:r${meta.round}:any`);
  return ids;
}

export function findPickCatalogValue(meta, values, valueNameMap = {}, catalog = null) {
  if (!meta) return null;
  const list = Array.isArray(catalog) && catalog.length > 0
    ? catalog
    : buildPickValuationCatalog(values, valueNameMap);
  const desiredBuckets = meta.round === 1
    ? [...getPickBucketAliases(meta.bucket), "any"]
    : ["any"];
  for (const bucket of desiredBuckets) {
    const exact = list.find((pick) =>
      pick.season === meta.season
      && pick.round === meta.round
      && pick.bucket === normalizePickBucket(bucket)
    );
    if (exact) return exact.value;
  }
  const numericSeason = Number(meta.season);
  if (!Number.isFinite(numericSeason)) return null;
  const nearest = list
    .filter((pick) => pick.round === meta.round && desiredBuckets.includes(pick.bucket))
    .sort((a, b) => Math.abs(Number(a.season) - numericSeason) - Math.abs(Number(b.season) - numericSeason))[0];
  return nearest?.value ?? null;
}

export function resolvePickAssetValue(asset, values, valueNameMap = {}, catalog = null) {
  for (const candidateId of buildPickValueLookupIds(asset)) {
    if (Number.isFinite(values?.[candidateId])) return values[candidateId];
  }
  return findPickCatalogValue(buildPickLookupMeta(asset), values, valueNameMap, catalog);
}

export function lookupMarketValue(asset, values, valueNameMap = {}, catalog = null) {
  const exact = values?.[asset?.assetId];
  if (Number.isFinite(exact)) return { value: exact, estimated: false };
  if (asset?.assetType === "pick") {
    const resolvedPickValue = resolvePickAssetValue(asset, values, valueNameMap, catalog);
    if (Number.isFinite(resolvedPickValue)) return { value: resolvedPickValue, estimated: false };
  }
  return { value: estimatedValue(asset), estimated: true };
}

export function adjustLeagueValue(asset, baseValue, league) {
  let value = applyElitePlayerValuePremium(asset, baseValue);
  if (asset?.assetType === "player" && playerPositionForAsset(asset) === "TE") {
    value = Math.round(value * tepMultiplier(tepLevel(league)));
  }
  return value;
}

export function getAssetValue(asset, values, options = {}) {
  const { valueNameMap = {}, pickCatalog = null, league = null } = options;
  const lookup = lookupMarketValue(asset, values, valueNameMap, pickCatalog);
  return adjustLeagueValue(asset, lookup.value, league);
}

export function isEstimatedAsset(asset, values, options = {}) {
  const { valueNameMap = {}, pickCatalog = null } = options;
  return lookupMarketValue(asset, values, valueNameMap, pickCatalog).estimated;
}

export function getGlobalMaxPlayerValue(values) {
  const max = Math.max(
    ...Object.entries(values || {})
      .filter(([assetId, value]) => assetId.startsWith("player:") && Number.isFinite(value))
      .map(([, value]) => value),
    0
  );
  return Math.max(max, KTC_GLOBAL_MAX_FALLBACK);
}

async function readTextIfOk(fetchImpl, path) {
  try {
    const response = await fetchImpl(path);
    if (!response?.ok) return "";
    return await response.text();
  } catch {
    return "";
  }
}

async function readJsonIfOk(fetchImpl, path) {
  try {
    const response = await fetchImpl(path);
    if (!response?.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export async function fetchValuationBundles(fetchImpl = globalThis.fetch) {
  const jsonBundle = await readJsonIfOk(fetchImpl, VALUES_JSON_PATH);
  if (jsonBundle && (jsonBundle.sf || jsonBundle.oneQb || jsonBundle.values)) {
    if (jsonBundle.sf || jsonBundle.oneQb) {
      const sf = coerceValueMap(jsonBundle.sf || jsonBundle.oneQb);
      const oneQb = coerceValueMap(jsonBundle.oneQb || jsonBundle.sf);
      return {
        sf,
        oneQb,
        names: jsonBundle.names && typeof jsonBundle.names === "object"
          ? jsonBundle.names
          : { ...sf.nameMap, ...oneQb.nameMap },
      };
    }
    const coerced = coerceValueMap(jsonBundle);
    return { sf: coerced, oneQb: coerced, names: coerced.nameMap };
  }

  const [sfCsv, oneQbCsv, sampleCsv] = await Promise.all([
    readTextIfOk(fetchImpl, VALUES_SF_PATH),
    readTextIfOk(fetchImpl, VALUES_ONE_QB_PATH),
    readTextIfOk(fetchImpl, SAMPLE_VALUES_PATH),
  ]);
  const sf = parseCsvValues(sfCsv || sampleCsv);
  const oneQb = parseCsvValues(oneQbCsv || sfCsv || sampleCsv);
  return { sf, oneQb, names: { ...sf.nameMap, ...oneQb.nameMap } };
}
