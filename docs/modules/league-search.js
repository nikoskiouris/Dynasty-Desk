import { escapeHtml } from "./html.js";
import { sleeperAvatarUrl } from "./sleeper.js";

export function leagueStatusLabel(status) {
  const value = String(status || "").replaceAll("_", " ");
  if (!value) return "league";
  return value;
}

export function renderLeaguePickerMarkup(leagues, currentSeason, selectedId = "") {
  if (!leagues?.length) return "";
  return `
    <div class="league-picker-head">
      <span class="eyebrow">Your leagues</span>
      <strong>Pick a league</strong>
    </div>
    <div class="league-picker-list">
      ${leagues.map((league) => {
        const avatar = sleeperAvatarUrl(league.avatar);
        const current = String(league.season || "") === String(currentSeason || "");
        const selected = String(league.league_id) === String(selectedId || "");
        return `
          <button type="button" class="league-pick ${current ? "current" : ""} ${selected ? "selected" : ""}" data-league-id="${escapeHtml(league.league_id)}" aria-pressed="${selected ? "true" : "false"}">
            <span class="league-pick-avatar">${avatar ? `<img src="${escapeHtml(avatar)}" alt="${escapeHtml(league.name || "League")} logo">` : `<span aria-hidden="true">${escapeHtml((league.name || "L").slice(0, 1))}</span>`}</span>
            <span class="league-pick-copy">
              <strong>${escapeHtml(league.name || "Untitled league")}</strong>
              <small>${escapeHtml(String(league.season || ""))} · ${Number(league.total_rosters || 0)} teams · ${escapeHtml(leagueStatusLabel(league.status))}</small>
            </span>
          </button>
        `;
      }).join("")}
    </div>
  `;
}
