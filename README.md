# FantasyDynastyAnalyzer

Sleeper dynasty league desk: live scores, standings, playoff odds, awards, archive, and a trade lab. Values stay on KeepTradeCut. The site is static. It talks to Sleeper from the browser.

## What is in this repo
- **Web app (GitHub Pages):** `docs/` — League Command Center.
- **Kernels:** `docs/modules/` — parse, Sleeper client, values, live poll, recap card, season engine.
- **Tests:** `tests/` — Node + Python. Run `npm test`.
- **Python CLI:** `src/` — still there if you want terminal trade suggestions.

## Web app

Open `docs/` locally (`npm run serve`) or the GitHub Pages URL.

1. Type a **Sleeper username** and press **Find leagues**.
2. Pick the league.
3. League ID / URL still lives behind “Have a league ID or URL instead?”

Share URLs are free GitHub Pages query strings: `?league=&me=&tab=&week=&tone=`. Recap can copy that link or save a PNG image card. Nothing to pay for.

### Pages
1. **Command Center** — live scoreboard with pre-game win%, standings, luck / all-play, Monte Carlo playoff and title odds, dynasty power board.
2. **Teams** — tap any roster: power scout card, optimal lineup, bench, nicknames, pick vault, season log, jump into a trade.
3. **Awards** — weekly honors (marked live if the week is still going), season superlatives, luck index, all-time record book from archive matchups.
4. **History** — dynasty archive: comparisons, finish matrix, rivalries, trades.
5. **Trade Lab** — shop an asset, acquire a target, generate a blockbuster, or use the **Calculator** to build both sides by hand and get a verdict.
6. **Recap** — group-chat paste in desk / hype / roast voice. Copy text, copy a recap link, or save the image card.

Demo league: [Try Hard or Die Hard](https://sleeper.app/leagues/1315165104303513600) (`1315165104303513600`).

### Live Sunday scores
The desk polls Sleeper matchups on the NFL window (Thu–Mon UTC) and whenever the current week already has points. Scoreboard, ticker, awards, and recap refresh. The 4000-season Monte Carlo does **not** rerun on every point tick. It refreshes when a week finals, remaining games change, or ~3 minutes have passed.

### Value source
KeepTradeCut only, for now:
- Superflex vs 1QB files (`docs/data/ktc_values_sf.csv`, `docs/data/ktc_values_1qb.csv`), plus optional `ktc_values.json`.
- TE premium bump from Sleeper `bonus_rec_te`.
- Missing assets get a position/age estimate labeled **est**.
- Elite players still get a premium so one star is not a pile of scraps.

Refresh rankings with `python scripts/update_ktc_values.py`. Pages deploy tries that scrape and keeps the sample files if KTC is down.

## GitHub Pages

Workflow: `.github/workflows/deploy-pages.yml`. Tests: `.github/workflows/test.yml`.

1. Repo **Settings → Pages**, source **GitHub Actions**.
2. Wait for **Deploy static site to GitHub Pages**.
3. Open `https://<user>.github.io/<repo>/`.

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
- Phone layout (`max-width: 700px`) puts Recap and Trade next to Home. iPad and desktop keep the original tab order.
