# FantasyDynastyAnalyzer

Sleeper dynasty league desk: live scores, standings, playoff odds, awards, archive, and a trade lab. Values are KeepTradeCut-style. The site is static. It talks to Sleeper from the browser.

## What is in this repo
- **Web app (GitHub Pages):** `docs/` — League Command Center.
- **Python CLI:** `src/` — still there if you want terminal trade suggestions.

## Web app

Open `docs/` locally or the GitHub Pages URL. Paste a Sleeper league ID, pick your manager, go.

### Pages
1. **Command Center** — live scoreboard with pre-game win%, standings, luck / all-play, Monte Carlo playoff and title odds, dynasty power board.
2. **Teams** — tap any roster: power scout card, optimal lineup, bench, nicknames, pick vault, season log, jump into a trade.
3. **Awards** — weekly honors (marked live if the week is still going), season superlatives, luck index, all-time record book from archive matchups.
4. **History** — dynasty archive: comparisons, finish matrix, rivalries, trades.
5. **Trade Lab** — shop an asset, acquire a target, generate a blockbuster, or use the **Calculator** to build both sides by hand and get a verdict.
6. **Recap** — group-chat paste in desk / hype / roast voice. Copy to clipboard.

Shareable URLs keep `?league=&me=&tab=`. The last league is remembered. Theme toggle is in the rail.

Demo league on the landing page: [Try Hard or Die Hard](https://sleeper.app/leagues/1315165104303513600) (`1315165104303513600`).

### Value source
- Optional JSON endpoint (`[{"asset_id":"player:8155","value":8200}]`).
- Falls back to `docs/data/ktc_values_sample.csv`.
- Missing assets get a light position/age estimate.
- Elite players get a premium so one star is not a pile of scraps.
- Draft picks show original owner when Sleeper sends it, plus prior-season finish when the previous league is linked.

## GitHub Pages

Workflow: `.github/workflows/deploy-pages.yml`.

1. Repo **Settings → Pages**, source **GitHub Actions**.
2. Wait for **Deploy static site to GitHub Pages**.
3. Open `https://<user>.github.io/<repo>/`.

The deploy job also refreshes KTC sample values via `scripts/update_ktc_values.py`.

## CLI

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

python -m src.cli \
  --league <LEAGUE_ID> \
  --me niko \
  --target-manager demetri \
  --target-player "Jahmyr Gibbs" \
  --allow-extra-target-assets \
  --fairness-pct 15 \
  --max-results 5
```

No league id? Discover it:

```bash
python -m src.cli \
  --username <YOUR_SLEEPER_USERNAME> \
  --season 2026 \
  --me niko \
  --target-manager demetri \
  --target-player "Jahmyr Gibbs"
```

## Notes
- Player assets: `player:<sleeper_player_id>`
- Pick assets: `pick:<season>:r<round>:<original_owner|any>`
- Playoff odds are a 4000-season Monte Carlo. Early weeks shrink last year's pace toward the league mean so one 11-3 campaign is not a 99% lock in Week 1.
