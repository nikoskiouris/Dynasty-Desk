export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function formatNumber(value) {
  return Number(value).toLocaleString();
}

export function formatSignedNumber(value) {
  const numericValue = Number(value) || 0;
  return `${numericValue > 0 ? "+" : ""}${formatNumber(numericValue)}`;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function renderTradeAssetLabel(item, formatValue = formatNumber) {
  if (item?.draftedPlayerName) {
    const pickLabel = escapeHtml(item.pickLabel || item.name || "Pick");
    const extraValue = Number(item.draftedPlayerValue) > 0
      ? `, ${formatValue(Math.round(item.draftedPlayerValue))}`
      : "";
    return `${pickLabel} <span class="pick-selection">(${escapeHtml(item.draftedPlayerName)}${extraValue})</span>`;
  }
  return escapeHtml(item?.name || "Asset");
}

export function renderTradeMoveSide(items, formatValue = formatNumber) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!list.length) return `<span class="trade-chip trade-chip-empty">picks</span>`;
  return list.map((item) => `<span class="trade-chip">${renderTradeAssetLabel(item, formatValue)}</span>`).join("");
}

export function renderTradeMove(row, formatValue = formatNumber) {
  return `<span class="trade-row-move"><span class="trade-move-side">${renderTradeMoveSide(row?.received, formatValue)}</span><span class="trade-arrow" aria-hidden="true">←</span><span class="trade-move-side">${renderTradeMoveSide(row?.sent, formatValue)}</span></span>`;
}

export async function copyTextToClipboard(text, clipboard = globalThis.navigator?.clipboard, doc = globalThis.document) {
  try {
    if (clipboard?.writeText) {
      await clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path.
  }
  if (!doc?.body) return false;
  try {
    const tempInput = doc.createElement("textarea");
    tempInput.value = text;
    tempInput.setAttribute("readonly", "");
    tempInput.style.position = "absolute";
    tempInput.style.left = "-9999px";
    doc.body.appendChild(tempInput);
    tempInput.select();
    const copied = doc.execCommand("copy");
    doc.body.removeChild(tempInput);
    return copied;
  } catch {
    return false;
  }
}
