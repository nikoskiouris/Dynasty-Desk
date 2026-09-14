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
