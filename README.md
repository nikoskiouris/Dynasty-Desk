# Dynasty Desk

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

Share URLs are free GitHub Pages query strings: `?league=&me=&tab=&view=&week=&tone=`. `tab` is the page, `view` is the room inside it. Old links (`tab=trader`, `tab=analytics`, `tab=team`, `view=passport`, ...) still resolve. Recap can copy that link or save a PNG image card. Nothing to pay for.

### Pages
Four pages. Each page has a row of rooms under it, so every feature is at most two taps away.

1. **League** — this season.
   - **Scores** — live scoreboard with pre-game win%, pulse tiles that jump to the right room.
   - **Standings** — overall / divisions, all-play, luck index.
   - **Power** — dynasty value board (starters, depth, picks, age). Tap a team to open its scout card.
   - **Awards** — weekly honors (marked live if the week is still going) and season superlatives.
   - **Recap** — group-chat paste in desk / hype / roast voice. Copy text, copy a recap link, or save the image card.
2. **Teams** — every roster.
   - **Roster** — tap any team: power scout card, optimal lineup, bench, nicknames, pick vault, season log, jump into a trade.
   - **Loyalty** — kept / gone / new since last season, iron share, DNA keep rate.
   - **Passports** — career stamps for every player on the roster.
   - A **Viewing** picker on Loyalty and Passports switches which roster you are looking at.
3. **Trades** — deals.
   - **Log** — graded trade log with the trade wire. Tap a row to open the trade file (record since, KTC now, later finishes).
   - **Calculator** — build both sides by hand and get a verdict.
   - **Find deals** — shop an asset, target a player, or generate a blockbuster.
4. **History** — the archive.
   - **Hall** — all-time titles, finish matrix, rivalry ledger, league eras, manager lens.
   - **Seasons** — season archive and side-by-side comparisons.
   - **Records** — all-time record book from archive matchups.

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
- Phone layout (`max-width: 700px`) pins the four page tabs to the bottom edge and keeps the room strip sticky under the header. A share button sits in the header. iPad and desktop keep the tabs inline above the room strip.
